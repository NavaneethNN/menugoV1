import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { cinemaAuth as auth, restaurantAuth } from '../lib/auth';
import {
  cinemaDb as db,
  restaurantDb,
  cinemaPool as pool,
  user,
  restaurants,
  restaurantMembers,
  cinemaProfiles,
  cinemaScreens,
  orders
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 03: Cinema Screen Management', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaA: string;
  let cookieCinemaB: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let createdScreen1Id: string;
  let createdScreen2Id: string;

  const createdTheatresToClean = [theatreAId, theatreBId, restaurantId];
  const createdUsersToClean: string[] = [];

  before(async () => {
    const timestamp = Date.now();

    // 1. Cinema Owner A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner A',
        email: `theatre-a-${timestamp}@test.com`,
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
        email: `theatre-b-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    // 3. Restaurant Owner (for cross-module tests)
    const resRest = await restaurantAuth.api.signUpEmail({
      body: {
        name: 'Restaurant Owner',
        email: `rest-user-${timestamp}@test.com`,
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
      name: 'PVR Forum Koramangala',
      slug: `pvr-forum-${timestamp}`,
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
      theatreName: 'PVR Forum Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'forum@pvrtheatres.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      onboardingStage: 'profile_completed',
      onboardingStagesCompleted: ['profile_completed']
    });

    // Insert Theatre B
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'INOX Garuda Mall',
      slug: `inox-garuda-${timestamp}`,
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
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreBId,
      theatreName: 'INOX Garuda Mall',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9123456789',
      contactEmail: 'garuda@inoxtheatres.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      onboardingStage: 'profile_completed',
      onboardingStagesCompleted: ['profile_completed']
    });

    // Insert Restaurant
    await restaurantDb.insert(restaurants).values({
      id: restaurantId,
      name: 'Spice Garden Bistro',
      slug: `spice-bistro-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });
    await restaurantDb.insert(restaurantMembers).values({
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

  // 1. Screen Creation
  test('POST /api/cinema/screens - Cinema admin successfully creates a new screen', async () => {
    const res = await request(app)
      .post('/api/cinema/screens')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenName: 'Screen 1 - Audi 1',
        screenType: 'imax',
        description: 'IMAX Laser 4K with Dolby Atmos sound system',
        status: 'active'
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.screen?.id);
    assert.equal(res.body.screen.theatreId, theatreAId);
    assert.equal(res.body.screen.screenName, 'Screen 1 - Audi 1');
    assert.equal(res.body.screen.screenType, 'imax');
    assert.equal(res.body.screen.status, 'active');
    assert.equal(res.body.screen.totalRows, 0); // Prepared for seating integration
    assert.equal(res.body.screen.totalSeats, 0); // No hardcoded seating counts
    assert.equal(res.body.screen.seatingConfigured, false);

    createdScreen1Id = res.body.screen.id;
  });

  // 2. Validation: Empty name
  test('POST /api/cinema/screens - Rejects empty screen name', async () => {
    const res = await request(app)
      .post('/api/cinema/screens')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenName: '',
        screenType: 'standard'
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error || res.body.details);
  });

  // 3. Duplicate Screen Name Prevention
  test('POST /api/cinema/screens - Rejects duplicate screen name within the same theatre', async () => {
    const res = await request(app)
      .post('/api/cinema/screens')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenName: 'screen 1 - audi 1', // Case-insensitive duplicate
        screenType: 'standard'
      });

    assert.equal(res.status, 409);
    assert.match(res.body.error || res.body.message, /already exists/i);
  });

  // 4. Create Second Screen
  test('POST /api/cinema/screens - Creates second screen with different name', async () => {
    const res = await request(app)
      .post('/api/cinema/screens')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenName: 'Screen 2 - Audi 2 (4DX)',
        screenType: '4dx',
        description: '4DX Motion seats with environmental effects',
        status: 'active'
      });

    assert.equal(res.status, 201);
    createdScreen2Id = res.body.screen.id;
  });

  // 5. List Screens
  test('GET /api/cinema/screens - Lists all screens belonging to the theatre', async () => {
    const res = await request(app)
      .get('/api/cinema/screens')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.theatreId, theatreAId);
    assert.equal(Array.isArray(res.body.screens), true);
    assert.equal(res.body.screens.length, 2);

    const screen1 = res.body.screens.find((s: any) => s.id === createdScreen1Id);
    assert.ok(screen1);
    assert.equal(screen1.screenName, 'Screen 1 - Audi 1');
  });

  // 6. View Screen Details
  test('GET /api/cinema/screens/:id - Retrieves details of a specific screen', async () => {
    const res = await request(app)
      .get(`/api/cinema/screens/${createdScreen1Id}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.screen.id, createdScreen1Id);
    assert.equal(res.body.screen.screenType, 'imax');
    assert.ok(res.body.screen.createdAt);
    assert.ok(res.body.screen.updatedAt);
  });

  // 7. Update Screen Information
  test('PATCH /api/cinema/screens/:id - Updates screen details', async () => {
    const res = await request(app)
      .patch(`/api/cinema/screens/${createdScreen1Id}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenName: 'Screen 1 - Grand IMAX Laser',
        description: 'Upgraded 4K Dual Laser with 12-channel immersive sound'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.screen.screenName, 'Screen 1 - Grand IMAX Laser');
    assert.equal(res.body.screen.description, 'Upgraded 4K Dual Laser with 12-channel immersive sound');
  });

  // 8. Screen Deactivation and Activation
  test('POST /api/cinema/screens/:id/deactivate and /activate - Changes screen operational status', async () => {
    // Deactivate
    const deactRes = await request(app)
      .post(`/api/cinema/screens/${createdScreen2Id}/deactivate`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(deactRes.status, 200);
    assert.equal(deactRes.body.screen.status, 'inactive');

    // Activate
    const actRes = await request(app)
      .post(`/api/cinema/screens/${createdScreen2Id}/activate`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(actRes.status, 200);
    assert.equal(actRes.body.screen.status, 'active');
  });

  // 9. Historical Data Protection: Archival vs Permanent Deletion
  test('DELETE /api/cinema/screens/:id - Safely archives screen by default', async () => {
    const res = await request(app)
      .delete(`/api/cinema/screens/${createdScreen2Id}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.screen.status, 'archived');

    // Excluded from standard screen list
    const listRes = await request(app)
      .get('/api/cinema/screens')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(listRes.body.screens.length, 1);
  });

  test('DELETE /api/cinema/screens/:id?permanent=true - Blocks permanent deletion when historical orders exist', async () => {
    // Simulate historical order in theatre
    await db.insert(orders).values({
      id: crypto.randomUUID(),
      restaurantId: theatreAId,
      orderNumber: 101,
      orderType: 'dine_in',
      status: 'served',
      customerName: 'Patron A',
      customerPhone: '9876543210',
      totalPaise: 45000,
      subtotalPaise: 45000,
      taxPaise: 0
    });

    const res = await request(app)
      .delete(`/api/cinema/screens/${createdScreen1Id}?permanent=true`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 409);
    assert.match(res.body.error || res.body.message, /Cannot permanently delete screen/i);
  });

  // 10. Cross-Tenant and Cross-Module Security Isolation
  test('Security: Cinema Owner B cannot access Cinema Owner A screens', async () => {
    const res = await request(app)
      .get(`/api/cinema/screens/${createdScreen1Id}`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(res.status, 404);
  });

  test('Security: Restaurant user cannot access cinema screen endpoints', async () => {
    const res = await request(app)
      .get('/api/cinema/screens')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId);

    assert.equal(res.status, 403);
  });

  test('Security: Unauthenticated request is rejected', async () => {
    const res = await request(app)
      .get('/api/cinema/screens')
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 401);
  });

  // 11. Onboarding Progress Milestone dynamically reflects screens_added
  test('Onboarding status reflects screens_added stage completed once screen is added', async () => {
    const res = await request(app)
      .get('/api/cinema/onboarding/status')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    const screensStage = res.body.stages.find((s: any) => s.key === 'screens_added');
    assert.ok(screensStage);
    assert.equal(screensStage.isCompleted, true);

    // Seating stage is now unlocked for Task 04
    const seatingStage = res.body.stages.find((s: any) => s.key === 'seating_configured');
    assert.ok(seatingStage);
    assert.equal(seatingStage.isLocked, false);
    assert.equal(seatingStage.isCompleted, false);
  });
});
