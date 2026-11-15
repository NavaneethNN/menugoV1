import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, pool, user, restaurants, restaurantMembers } from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 01: Cinema Module Foundation & Business-Type Isolation', () => {
  let userRestaurantOwnerId: string;
  let userCinemaOwnerId: string;
  let cookieRestaurantOwner: string;
  let cookieCinemaOwner: string;

  const restaurantId = crypto.randomUUID();
  const cinemaTheatreId = crypto.randomUUID();
  const cinemaTheatre2Id = crypto.randomUUID();

  const memberRestId = crypto.randomUUID();
  const memberCinemaId = crypto.randomUUID();

  before(async () => {
    const timestamp = Date.now();

    // 1. Create Restaurant Owner
    const restOwnerRes = await auth.api.signUpEmail({
      body: {
        name: 'Restaurant Owner',
        email: `rest-owner-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieRestaurantOwner = restOwnerRes.headers.get('set-cookie')?.split(';')[0] || '';
    const restJson = await restOwnerRes.json();
    userRestaurantOwnerId = restJson.user.id;

    // 2. Create Cinema Owner
    const cinemaOwnerRes = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner',
        email: `cinema-owner-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaOwner = cinemaOwnerRes.headers.get('set-cookie')?.split(';')[0] || '';
    const cinemaJson = await cinemaOwnerRes.json();
    userCinemaOwnerId = cinemaJson.user.id;

    // 3. Insert Restaurant Tenant (tenant_type = 'restaurant')
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Spice Bistro',
      slug: `spice-bistro-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });

    await db.insert(restaurantMembers).values({
      id: memberRestId,
      restaurantId,
      userId: userRestaurantOwnerId,
      role: 'owner'
    });

    // 4. Insert Cinema Theatre Tenant (tenant_type = 'cinema')
    await db.insert(restaurants).values({
      id: cinemaTheatreId,
      name: 'Grand Cineplex IMAX',
      slug: `grand-cineplex-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });

    await db.insert(restaurantMembers).values({
      id: memberCinemaId,
      restaurantId: cinemaTheatreId,
      userId: userCinemaOwnerId,
      role: 'owner'
    });

    // 5. Insert Second Cinema (for cross-theatre isolation test)
    await db.insert(restaurants).values({
      id: cinemaTheatre2Id,
      name: 'Star Cinemas',
      slug: `star-cinemas-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
  });

  after(async () => {
    // Clean up test records
    await db.delete(restaurantMembers).where(
      inArray(restaurantMembers.id, [memberRestId, memberCinemaId])
    );
    await db.delete(restaurants).where(
      inArray(restaurants.id, [restaurantId, cinemaTheatreId, cinemaTheatre2Id])
    );
    await db.delete(user).where(
      inArray(user.id, [userRestaurantOwnerId, userCinemaOwnerId])
    );
    await pool.end().catch(() => {});
  });

  test('1. Database stores tenantType = "restaurant" and tenantType = "cinema" correctly', async () => {
    const [rest] = await db
      .select({ tenantType: restaurants.tenantType })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId));

    const [cinema] = await db
      .select({ tenantType: restaurants.tenantType })
      .from(restaurants)
      .where(eq(restaurants.id, cinemaTheatreId));

    assert.equal(rest.tenantType, 'restaurant');
    assert.equal(cinema.tenantType, 'cinema');
  });

  test('2. Cinema Owner can successfully access cinema access-check with x-theatre-id', async () => {
    const res = await request(app)
      .get('/api/cinema/access-check')
      .set('Cookie', cookieCinemaOwner)
      .set('x-theatre-id', cinemaTheatreId);

    assert.equal(res.status, 200);
    assert.equal(res.body.hasAccess, true);
    assert.equal(res.body.tenantType, 'cinema');
    assert.equal(res.body.theatre.id, cinemaTheatreId);
    assert.equal(res.body.role, 'owner');
  });

  test('3. Restaurant Owner accessing cinema access-check is REJECTED with 403 Forbidden (Cross-module access denied)', async () => {
    const res = await request(app)
      .get('/api/cinema/access-check')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-theatre-id', restaurantId);

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Forbidden');
    assert.match(res.body.message, /Cross-module access denied/i);
    assert.match(res.body.message, /restaurant/i);
  });

  test('4. Cinema Owner accessing restaurant-specific tables endpoint (/api/tables) is REJECTED with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/tables')
      .set('Cookie', cookieCinemaOwner)
      .set('x-theatre-id', cinemaTheatreId);

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Forbidden');
    assert.match(res.body.message, /Cross-module access denied/i);
  });

  test('5. Restaurant Owner accessing restaurant-specific tables endpoint (/api/tables) SUCCEEDS', async () => {
    const res = await request(app)
      .get('/api/tables')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  test('6. Cinema Owner accessing another cinema theatre (IDOR) is REJECTED with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/cinema/access-check')
      .set('Cookie', cookieCinemaOwner)
      .set('x-theatre-id', cinemaTheatre2Id);

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Forbidden');
    assert.match(res.body.message, /not an authorized member/i);
  });

  test('7. Cinema Dashboard Summary endpoint returns valid metrics and cinema tenant info', async () => {
    const res = await request(app)
      .get('/api/cinema/dashboard/summary')
      .set('Cookie', cookieCinemaOwner)
      .set('x-theatre-id', cinemaTheatreId);

    assert.equal(res.status, 200);
    assert.equal(res.body.theatre.tenantType, 'cinema');
    assert.equal(res.body.theatre.id, cinemaTheatreId);
    assert.equal(res.body.stats.todayOrders, 0);
    assert.equal(res.body.stats.activeScreens, 0);
    assert.equal(res.body.systemStatus.businessType, 'cinema');
  });

  test('8. /api/restaurants/my filters memberships by tenantType correctly', async () => {
    // Cinema filter
    const cinemaRes = await request(app)
      .get('/api/restaurants/my?tenantType=cinema')
      .set('Cookie', cookieCinemaOwner);

    assert.equal(cinemaRes.status, 200);
    assert.equal(cinemaRes.body.length, 1);
    assert.equal(cinemaRes.body[0].restaurant.tenantType, 'cinema');

    // Restaurant filter on cinema user
    const restRes = await request(app)
      .get('/api/restaurants/my?tenantType=restaurant')
      .set('Cookie', cookieCinemaOwner);

    assert.equal(restRes.status, 200);
    assert.equal(restRes.body.length, 0);
  });
});
