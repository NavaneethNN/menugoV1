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
  cinemaMovies,
  cinemaShows,
  orders
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 06: Cinema Daily Show Scheduling', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaA: string;
  let cookieCinemaB: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let screen1AId: string;
  let screen2AId: string;
  let screen1BId: string;

  let movie1AId: string;
  let movie2AId: string;

  let show1Id: string;
  let showMidnightId: string;

  const testDate = '2026-11-20';
  const nextDate = '2026-11-21';

  const createdTheatresToClean = [theatreAId, theatreBId, restaurantId];
  const createdUsersToClean: string[] = [];

  before(async () => {
    const timestamp = Date.now();

    // 1. Cinema Owner A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner A',
        email: `shows-a-${timestamp}@test.com`,
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
        email: `shows-b-${timestamp}@test.com`,
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
        email: `shows-rest-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieRestaurantOwner = resRest.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonRest = await resRest.json();
    userRestaurantOwnerId = jsonRest.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    // Seed Theatre A (cinema)
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'PVR Nexus Grand Shows',
      slug: `pvr-nexus-shows-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      theatreName: 'PVR Nexus Grand Shows',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'nexus@pvrtheatres.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      onboardingStagesCompleted: ['profile_completed', 'screens_added', 'seating_configured']
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'owner'
    });

    // Create Screens for Theatre A
    screen1AId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1AId,
      theatreId: theatreAId,
      screenName: 'Screen 1 (IMAX)',
      screenType: 'imax',
      status: 'active'
    });

    screen2AId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen2AId,
      theatreId: theatreAId,
      screenName: 'Screen 2 (Dolby Atmos)',
      screenType: 'dolby_atmos',
      status: 'active'
    });

    // Create Movies for Theatre A
    movie1AId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movie1AId,
      theatreId: theatreAId,
      title: 'Dune: Part Two',
      language: 'English',
      durationMinutes: 166,
      status: 'active'
    });

    movie2AId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movie2AId,
      theatreId: theatreAId,
      title: 'Oppenheimer',
      language: 'English',
      durationMinutes: 180,
      status: 'active'
    });

    // Seed Theatre B (cinema)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'INOX Forum Shows',
      slug: `inox-forum-shows-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreBId,
      theatreName: 'INOX Forum Shows',
      city: 'Kolkata',
      state: 'West Bengal',
      country: 'India',
      contactNumber: '9876543222',
      contactEmail: 'forum@inoxtheatres.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      onboardingStagesCompleted: ['profile_completed']
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreBId,
      userId: userCinemaBId,
      role: 'owner'
    });

    screen1BId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1BId,
      theatreId: theatreBId,
      screenName: 'Audi 1',
      screenType: 'standard',
      status: 'active'
    });

    // Seed Restaurant (restaurant)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Tasty Bites',
      slug: `tasty-bites-shows-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restaurantId,
      userId: userRestaurantOwnerId,
      role: 'owner'
    });
  });

  after(async () => {
    await db.delete(orders).where(inArray(orders.restaurantId, createdTheatresToClean));
    await db.delete(cinemaShows).where(inArray(cinemaShows.theatreId, createdTheatresToClean));
    await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, createdTheatresToClean));
    await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, createdTheatresToClean));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatresToClean));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatresToClean));
    await db.delete(restaurants).where(inArray(restaurants.id, createdTheatresToClean));
    if (createdUsersToClean.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }
    await pool.end().catch(() => {});
  });

  test('POST /api/cinema/shows - Successfully schedules Show 1 (10:00 AM - 1:00 PM) on Screen 1', async () => {
    const startTime = new Date(`${testDate}T10:00:00Z`).toISOString();
    const expectedEndTime = new Date(`${testDate}T13:00:00Z`).toISOString();
    const orderingStartTime = new Date(`${testDate}T09:30:00Z`).toISOString();
    const orderingEndTime = new Date(`${testDate}T12:30:00Z`).toISOString();

    const res = await request(app)
      .post('/api/cinema/shows')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenId: screen1AId,
        movieId: movie1AId,
        showDate: testDate,
        startTime,
        expectedEndTime,
        orderingStartTime,
        orderingEndTime,
        turnaroundBufferMinutes: 15,
        status: 'draft'
      });

    assert.equal(res.status, 201, `Failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.show);
    assert.equal(res.body.show.screenId, screen1AId);
    assert.equal(res.body.show.movieId, movie1AId);
    assert.equal(res.body.show.status, 'draft');
    assert.equal(res.body.show.showDate, testDate);

    show1Id = res.body.show.id;
  });

  test('POST /api/cinema/shows - Rejects direct overlapping show on the same screen (11:00 AM - 2:00 PM)', async () => {
    const startTime = new Date(`${testDate}T11:00:00Z`).toISOString();
    const expectedEndTime = new Date(`${testDate}T14:00:00Z`).toISOString();
    const orderingStartTime = new Date(`${testDate}T10:30:00Z`).toISOString();
    const orderingEndTime = new Date(`${testDate}T13:30:00Z`).toISOString();

    const res = await request(app)
      .post('/api/cinema/shows')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenId: screen1AId,
        movieId: movie2AId,
        showDate: testDate,
        startTime,
        expectedEndTime,
        orderingStartTime,
        orderingEndTime,
        turnaroundBufferMinutes: 15
      });

    assert.equal(res.status, 409, 'Expected 409 Conflict for overlapping show on same screen');
    assert.match(res.body.error, /Scheduling conflict/);
  });

  test('POST /api/cinema/shows - Rejects show overlapping turnaround/cleaning buffer (1:05 PM start when prior ends at 1:00 PM with 15m buffer)', async () => {
    // Show 1 ends at 1:00 PM. Buffer is 15m, so screen is occupied until 1:15 PM.
    // Starting at 1:05 PM must be rejected.
    const startTime = new Date(`${testDate}T13:05:00Z`).toISOString();
    const expectedEndTime = new Date(`${testDate}T16:00:00Z`).toISOString();
    const orderingStartTime = new Date(`${testDate}T12:35:00Z`).toISOString();
    const orderingEndTime = new Date(`${testDate}T15:30:00Z`).toISOString();

    const res = await request(app)
      .post('/api/cinema/shows')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenId: screen1AId,
        movieId: movie2AId,
        showDate: testDate,
        startTime,
        expectedEndTime,
        orderingStartTime,
        orderingEndTime,
        turnaroundBufferMinutes: 15
      });

    assert.equal(res.status, 409, 'Expected 409 Conflict due to turnaround buffer overlap');
  });

  test('POST /api/cinema/shows - Allows overlapping showtimes on DIFFERENT screens (Screen 2)', async () => {
    // Exactly same time 10:00 AM - 1:00 PM, but on Screen 2
    const startTime = new Date(`${testDate}T10:00:00Z`).toISOString();
    const expectedEndTime = new Date(`${testDate}T13:00:00Z`).toISOString();
    const orderingStartTime = new Date(`${testDate}T09:30:00Z`).toISOString();
    const orderingEndTime = new Date(`${testDate}T12:30:00Z`).toISOString();

    const res = await request(app)
      .post('/api/cinema/shows')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenId: screen2AId,
        movieId: movie2AId,
        showDate: testDate,
        startTime,
        expectedEndTime,
        orderingStartTime,
        orderingEndTime,
        turnaroundBufferMinutes: 15,
        status: 'published'
      });

    assert.equal(res.status, 201, `Failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.show.screenId, screen2AId);
  });

  test('POST /api/cinema/shows - Supports midnight-crossing show (10:00 PM - 1:00 AM next day)', async () => {
    const startTime = new Date(`${testDate}T22:00:00Z`).toISOString();
    const expectedEndTime = new Date(`${nextDate}T01:00:00Z`).toISOString();
    const orderingStartTime = new Date(`${testDate}T21:30:00Z`).toISOString();
    const orderingEndTime = new Date(`${nextDate}T00:30:00Z`).toISOString();

    const res = await request(app)
      .post('/api/cinema/shows')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenId: screen1AId,
        movieId: movie2AId,
        showDate: testDate,
        startTime,
        expectedEndTime,
        orderingStartTime,
        orderingEndTime,
        turnaroundBufferMinutes: 15,
        status: 'draft'
      });

    assert.equal(res.status, 201, `Failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.show);
    showMidnightId = res.body.show.id;
  });

  test('POST /api/cinema/shows - Validates food ordering window (rejects closing time before start time)', async () => {
    const startTime = new Date(`${testDate}T15:00:00Z`).toISOString();
    const expectedEndTime = new Date(`${testDate}T18:00:00Z`).toISOString();
    const orderingStartTime = new Date(`${testDate}T16:00:00Z`).toISOString();
    const orderingEndTime = new Date(`${testDate}T14:00:00Z`).toISOString(); // Invalid: end before start

    const res = await request(app)
      .post('/api/cinema/shows')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        screenId: screen1AId,
        movieId: movie1AId,
        showDate: testDate,
        startTime,
        expectedEndTime,
        orderingStartTime,
        orderingEndTime
      });

    assert.equal(res.status, 400, 'Expected 400 Bad Request for invalid ordering window');
  });

  test('GET /api/cinema/shows - Lists shows by date and screen', async () => {
    const res = await request(app)
      .get(`/api/cinema/shows?showDate=${testDate}&screenId=${screen1AId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.shows));
    assert.ok(res.body.shows.length >= 2);
    assert.equal(res.body.shows[0].screenId, screen1AId);
  });

  test('PATCH /api/cinema/shows/:showId - Updates draft show information', async () => {
    const newOrderingEnd = new Date(`${testDate}T12:45:00Z`).toISOString();

    const res = await request(app)
      .patch(`/api/cinema/shows/${show1Id}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        orderingEndTime: newOrderingEnd,
        turnaroundBufferMinutes: 20
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.show.turnaroundBufferMinutes, 20);
  });

  test('POST /api/cinema/shows/:showId/publish - Publishes draft show', async () => {
    const res = await request(app)
      .post(`/api/cinema/shows/${show1Id}/publish`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.show.status, 'published');
  });

  test('POST /api/cinema/shows/:showId/cancel - Cancels show with reason', async () => {
    const res = await request(app)
      .post(`/api/cinema/shows/${showMidnightId}/cancel`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        cancellationReason: 'Scheduled midnight auditorium deep sanitization'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.show.status, 'cancelled');
    assert.equal(res.body.show.cancellationReason, 'Scheduled midnight auditorium deep sanitization');
  });

  test('POST /api/cinema/shows/copy-schedule - Copies daily schedule to target date', async () => {
    const res = await request(app)
      .post('/api/cinema/shows/copy-schedule')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        sourceDate: testDate,
        targetDate: nextDate
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.copiedCount >= 1);

    // Verify copied shows on nextDate
    const resNext = await request(app)
      .get(`/api/cinema/shows?showDate=${nextDate}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(resNext.status, 200);
    assert.ok(resNext.body.shows.length >= 1);
    assert.equal(resNext.body.shows[0].status, 'draft', 'Copied shows should start as drafts');
  });

  test('DELETE /api/cinema/shows/:showId?permanent=true - Blocks hard delete when orders exist', async () => {
    // Insert dummy order for theatre A
    await db.insert(orders).values({
      orderNumber: 'ORD-TEST-SHOW-001',
      restaurantId: theatreAId,
      status: 'completed',
      totalAmount: 35000
    });

    const res = await request(app)
      .delete(`/api/cinema/shows/${show1Id}?permanent=true`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 409, 'Expected 409 Conflict when historical orders exist');
  });

  test('Security: Cinema Owner B cannot access Cinema Owner A show (Tenant Isolation)', async () => {
    const res = await request(app)
      .get(`/api/cinema/shows/${show1Id}`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(res.status, 404, 'Expected 404 Not Found for cross-theatre show access');
  });

  test('Security: Restaurant user cannot access cinema show endpoints', async () => {
    const res = await request(app)
      .get('/api/cinema/shows')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId);

    assert.equal(res.status, 403, 'Expected 403 Forbidden for restaurant user');
  });
});
