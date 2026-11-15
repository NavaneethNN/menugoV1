import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  pool,
  user,
  restaurants,
  restaurantMembers,
  cinemaProfiles,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  orders
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 04: Cinema Seating Configuration', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaA: string;
  let cookieCinemaB: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let screenAId: string;
  let rowAId: string;
  let rowBId: string;
  let rowCId: string;

  let seatA1Id: string;

  const createdTheatresToClean = [theatreAId, theatreBId, restaurantId];
  const createdUsersToClean: string[] = [];

  before(async () => {
    const timestamp = Date.now();

    // 1. Cinema Owner A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner A',
        email: `seating-a-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonA = await resA.json();
    userCinemaAId = jsonA.user.id;
    createdUsersToClean.push(userCinemaAId);

    // 2. Cinema Owner B (for cross-tenant tests)
    const resB = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner B',
        email: `seating-b-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    // 3. Restaurant Owner (for cross-module tests)
    const resRest = await auth.api.signUpEmail({
      body: {
        name: 'Restaurant Owner',
        email: `seating-rest-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieRestaurantOwner = resRest.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonRest = await resRest.json();
    userRestaurantOwnerId = jsonRest.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    // Insert Theatre A
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'PVR Nexus Grand Audi 1',
      slug: `pvr-nexus-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'owner'
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      theatreName: 'PVR Nexus Grand Audi 1',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'nexus@pvrtheatres.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      onboardingStage: 'screens_added',
      onboardingStagesCompleted: ['profile_completed', 'screens_added']
    });

    // Create Screen A
    screenAId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screenAId,
      theatreId: theatreAId,
      screenName: 'Screen 1 - Audi 1 (IMAX)',
      screenType: 'imax',
      status: 'active',
      totalRows: 0,
      totalSeats: 0,
      seatingConfigured: false
    });

    // Insert Theatre B
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'INOX Forum Mall',
      slug: `inox-forum-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreBId,
      userId: userCinemaBId,
      role: 'owner'
    });

    // Insert Restaurant
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Urban Spice Cafe',
      slug: `urban-spice-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId,
      userId: userRestaurantOwnerId,
      role: 'owner'
    });
  });

  after(async () => {
    try {
      if (createdTheatresToClean.length > 0) {
        await db.delete(orders).where(inArray(orders.restaurantId, createdTheatresToClean));
        await db.delete(cinemaSeats).where(inArray(cinemaSeats.theatreId, createdTheatresToClean));
        await db.delete(cinemaRows).where(inArray(cinemaRows.theatreId, createdTheatresToClean));
        await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, createdTheatresToClean));
        await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatresToClean));
        await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatresToClean));
        await db.delete(restaurants).where(inArray(restaurants.id, createdTheatresToClean));
      }
      if (createdUsersToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUsersToClean));
      }
      await pool.end().catch(() => {});
    } catch (err) {
      console.warn('Test cleanup warning:', err);
    }
  });

  // 1. Creating Rows and Automatic Seat Generation
  test('POST /api/cinema/screens/:screenId/rows - Creates Row A and automatically generates 25 individual seats', async () => {
    const res = await request(app)
      .post(`/api/cinema/screens/${screenAId}/rows`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        rowIdentifier: 'A',
        startSeatNumber: 1,
        endSeatNumber: 25,
        seatCategory: 'regular',
        status: 'active',
        sortOrder: 1
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.row?.id);
    assert.equal(res.body.row.rowIdentifier, 'A');
    assert.equal(res.body.row.totalSeats, 25);
    assert.equal(Array.isArray(res.body.seats), true);
    assert.equal(res.body.seats.length, 25);

    // Verify first and last seat identifiers
    assert.equal(res.body.seats[0].seatIdentifier, 'A1');
    assert.equal(res.body.seats[24].seatIdentifier, 'A25');
    assert.equal(res.body.seats[0].seatCategory, 'regular');

    rowAId = res.body.row.id;
    seatA1Id = res.body.seats[0].id;

    // Verify screen stats were synchronized
    const [screen] = await db
      .select()
      .from(cinemaScreens)
      .where(eq(cinemaScreens.id, screenAId));

    assert.equal(screen.totalRows, 1);
    assert.equal(screen.totalSeats, 25);
    assert.equal(screen.seatingConfigured, true);
  });

  // 2. Different Row Lengths & Different Categories
  test('POST /api/cinema/screens/:screenId/rows - Supports different row lengths and tiers (Row B: 20 seats Premium, Row C: 15 seats Recliner)', async () => {
    // Row B: 20 Premium seats
    const resB = await request(app)
      .post(`/api/cinema/screens/${screenAId}/rows`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        rowIdentifier: 'B',
        startSeatNumber: 1,
        endSeatNumber: 20,
        seatCategory: 'premium',
        sortOrder: 2
      });

    assert.equal(resB.status, 201);
    assert.equal(resB.body.row.totalSeats, 20);
    assert.equal(resB.body.seats[0].seatCategory, 'premium');
    rowBId = resB.body.row.id;

    // Row C: 15 Recliner seats
    const resC = await request(app)
      .post(`/api/cinema/screens/${screenAId}/rows`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        rowIdentifier: 'C',
        startSeatNumber: 1,
        endSeatNumber: 15,
        seatCategory: 'recliner',
        sortOrder: 3
      });

    assert.equal(resC.status, 201);
    assert.equal(resC.body.row.totalSeats, 15);
    assert.equal(resC.body.seats[0].seatCategory, 'recliner');
    rowCId = resC.body.row.id;

    // Total seats on screen should be 25 + 20 + 15 = 60 across 3 rows
    const [screen] = await db
      .select()
      .from(cinemaScreens)
      .where(eq(cinemaScreens.id, screenAId));

    assert.equal(screen.totalRows, 3);
    assert.equal(screen.totalSeats, 60);
  });

  // 3. Duplicate Row Rejection
  test('POST /api/cinema/screens/:screenId/rows - Rejects duplicate row identifier within the same screen', async () => {
    const res = await request(app)
      .post(`/api/cinema/screens/${screenAId}/rows`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        rowIdentifier: 'a', // Case-insensitive duplicate of Row A
        startSeatNumber: 1,
        endSeatNumber: 20
      });

    assert.equal(res.status, 409);
    assert.match(res.body.error || res.body.message, /already exists/i);
  });

  // 4. Validation: Invalid seat range
  test('POST /api/cinema/screens/:screenId/rows - Rejects invalid seat range (endSeatNumber < startSeatNumber)', async () => {
    const res = await request(app)
      .post(`/api/cinema/screens/${screenAId}/rows`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        rowIdentifier: 'D',
        startSeatNumber: 25,
        endSeatNumber: 10
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error || res.body.details);
  });

  // 5. Get Screen Seating Layout & Breakdowns
  test('GET /api/cinema/screens/:screenId/seating - Returns full layout and category statistics', async () => {
    const res = await request(app)
      .get(`/api/cinema/screens/${screenAId}/seating`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.totalRows, 3);
    assert.equal(res.body.totalSeats, 60);
    assert.equal(res.body.categoryBreakdown.regular, 25);
    assert.equal(res.body.categoryBreakdown.premium, 20);
    assert.equal(res.body.categoryBreakdown.recliner, 15);
    assert.equal(res.body.rows.length, 3);

    // Each row contains embedded seats
    const rowA = res.body.rows.find((r: any) => r.rowIdentifier === 'A');
    assert.equal(rowA.seats.length, 25);
  });

  // 6. Row Updates & Cascading Category
  test('PATCH /api/cinema/rows/:rowId - Updates row category and cascades to all row seats', async () => {
    const res = await request(app)
      .patch(`/api/cinema/rows/${rowBId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        seatCategory: 'vip'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.row.seatCategory, 'vip');

    // Verify all seats in Row B now have category = vip
    const rowBSeats = await db
      .select()
      .from(cinemaSeats)
      .where(eq(cinemaSeats.rowId, rowBId));

    assert.ok(rowBSeats.every((s) => s.seatCategory === 'vip'));
  });

  // 7. Add Individual Seat
  test('POST /api/cinema/screens/:screenId/seats - Adds individual seat C16 to Row C', async () => {
    const res = await request(app)
      .post(`/api/cinema/screens/${screenAId}/seats`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        rowId: rowCId,
        seatNumber: 16,
        seatCategory: 'recliner'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.seat.seatIdentifier, 'C16');
    assert.equal(res.body.seat.seatCategory, 'recliner');

    // Total seats increases from 60 to 61
    const [screen] = await db
      .select()
      .from(cinemaScreens)
      .where(eq(cinemaScreens.id, screenAId));

    assert.equal(screen.totalSeats, 61);
  });

  // 8. Duplicate Seat Rejection
  test('POST /api/cinema/screens/:screenId/seats - Rejects duplicate seat identifier on the same screen', async () => {
    const res = await request(app)
      .post(`/api/cinema/screens/${screenAId}/seats`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        rowId: rowCId,
        seatNumber: 16 // C16 already added
      });

    assert.equal(res.status, 409);
    assert.match(res.body.error || res.body.message, /already exists/i);
  });

  // 9. Seat Activation & Deactivation
  test('POST /api/cinema/seats/:seatId/deactivate and /activate - Toggles individual seat operational status', async () => {
    // Deactivate seat A1
    const deactRes = await request(app)
      .post(`/api/cinema/seats/${seatA1Id}/deactivate`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(deactRes.status, 200);
    assert.equal(deactRes.body.seat.status, 'inactive');

    // Activate seat A1
    const actRes = await request(app)
      .post(`/api/cinema/seats/${seatA1Id}/activate`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(actRes.status, 200);
    assert.equal(actRes.body.seat.status, 'active');
  });

  // 10. Historical Data Protection: Archival vs Permanent Deletion
  test('DELETE /api/cinema/rows/:rowId - Safely archives row and seats by default', async () => {
    const res = await request(app)
      .delete(`/api/cinema/rows/${rowCId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);

    // Screen total rows reduces to 2, total seats reduces to 45
    const [screen] = await db
      .select()
      .from(cinemaScreens)
      .where(eq(cinemaScreens.id, screenAId));

    assert.equal(screen.totalRows, 2);
    assert.equal(screen.totalSeats, 45);
  });

  test('DELETE /api/cinema/seats/:seatId?permanent=true - Blocks permanent deletion when historical orders exist', async () => {
    // Simulate historical order in theatre
    await db.insert(orders).values({
      id: crypto.randomUUID(),
      restaurantId: theatreAId,
      orderNumber: 201,
      orderType: 'dine_in',
      status: 'served',
      customerName: 'Patron Seating',
      customerPhone: '9876543210',
      totalPaise: 35000,
      subtotalPaise: 35000,
      taxPaise: 0
    });

    const res = await request(app)
      .delete(`/api/cinema/seats/${seatA1Id}?permanent=true`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 409);
    assert.match(res.body.error || res.body.message, /Cannot permanently delete seat/i);
  });

  // 11. Cross-Tenant and Cross-Module Security
  test('Security: Cinema Owner B cannot access Cinema Owner A seating layout', async () => {
    const res = await request(app)
      .get(`/api/cinema/screens/${screenAId}/seating`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(res.status, 404);
  });

  test('Security: Restaurant user cannot access cinema seating endpoints', async () => {
    const res = await request(app)
      .get(`/api/cinema/screens/${screenAId}/seating`)
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId);

    assert.equal(res.status, 403);
  });

  // 12. Dynamic Onboarding Progress Milestone
  test('Onboarding status reflects seating_configured stage completed', async () => {
    const res = await request(app)
      .get('/api/cinema/onboarding/status')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    const seatingStage = res.body.stages.find((s: any) => s.key === 'seating_configured');
    assert.ok(seatingStage);
    assert.equal(seatingStage.isCompleted, true);

    // Food menu stage (Task 05) is now unlocked
    const menuStage = res.body.stages.find((s: any) => s.key === 'menu_configured');
    assert.ok(menuStage);
    assert.equal(menuStage.isLocked, false);
    assert.equal(menuStage.isCompleted, false);
  });
});
