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
  cinemaQrCodes,
  restaurantTables,
  orders
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 08: Cinema General and Screen QR Codes', () => {
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

  let theatreAQrId: string;
  let theatreAToken: string;
  let screen1AQrId: string;
  let screen1AToken: string;

  const createdTheatresToClean = [theatreAId, theatreBId, restaurantId];
  const createdUsersToClean: string[] = [];

  before(async () => {
    const timestamp = Date.now();

    // 1. Cinema Owner A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner A',
        email: `qr-a-${timestamp}@test.com`,
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
        email: `qr-b-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    // 3. Restaurant Owner (for restaurant regression test)
    const resRest = await auth.api.signUpEmail({
      body: {
        name: 'Restaurant Owner',
        email: `qr-rest-${timestamp}@test.com`,
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
      name: 'PVR Heritage QR',
      slug: `pvr-heritage-qr-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      theatreName: 'PVR Heritage QR',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9845012345',
      contactEmail: 'qr@pvrheritage.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      onboardingStage: 'shows_scheduled',
      onboardingCompleted: false,
      onboardingStagesCompleted: ['profile_completed', 'screens_added', 'seating_configured', 'menu_configured', 'shows_scheduled']
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'owner'
    });

    // Seed Screens for Theatre A
    screen1AId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1AId,
      theatreId: theatreAId,
      screenName: 'Screen 1 (IMAX)',
      screenType: 'imax',
      totalSeats: 250,
      status: 'active'
    });

    screen2AId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen2AId,
      theatreId: theatreAId,
      screenName: 'Screen 2 (Dolby Atmos)',
      screenType: 'dolby_atmos',
      totalSeats: 180,
      status: 'active'
    });

    // Seed Theatre B (cinema)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'Cinepolis Megaplex B',
      slug: `cinepolis-b-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreBId,
      theatreName: 'Cinepolis Megaplex B',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      contactNumber: '9123499999',
      contactEmail: 'cinepolis@cine.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
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
      screenName: 'Screen 1 (Audi A)',
      screenType: 'standard',
      totalSeats: 150,
      status: 'active'
    });

    // Seed Restaurant (restaurant tenant for regression)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Spice Trail Restaurant',
      slug: `spice-trail-${timestamp}`,
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
    await db.delete(restaurantTables).where(inArray(restaurantTables.restaurantId, createdTheatresToClean));
    await db.delete(cinemaQrCodes).where(inArray(cinemaQrCodes.theatreId, createdTheatresToClean));
    await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, createdTheatresToClean));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatresToClean));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatresToClean));
    await db.delete(restaurants).where(inArray(restaurants.id, createdTheatresToClean));
    if (createdUsersToClean.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }
    await pool.end().catch(() => {});
  });

  test('Check onboarding status before QR code generation - stage 7 qr_generated is false', async () => {
    const res = await request(app)
      .get('/api/cinema/onboarding/status')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    const qrStage = res.body.stages.find((s: any) => s.key === 'qr_generated');
    assert.ok(qrStage, 'qr_generated stage must exist in onboarding roadmap');
    assert.equal(qrStage.isCompleted, false, 'qr_generated must be false before QR generation');
  });

  test('POST /api/cinema/qr/theatre - Successfully generates General Theatre QR code', async () => {
    const res = await request(app)
      .post('/api/cinema/qr/theatre')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 201);
    assert.ok(res.body.qrCode);
    const qr = res.body.qrCode;

    assert.equal(qr.qrType, 'theatre');
    assert.equal(qr.theatreId, theatreAId);
    assert.equal(qr.screenId, null);
    assert.equal(qr.status, 'active');

    // Cryptographic token validation: 48 hex characters (192 bits entropy)
    assert.equal(qr.token.length, 48);
    assert.match(qr.token, /^[0-9a-f]{48}$/);
    assert.equal(qr.theatreToken, qr.token);

    // Target customer route URL check
    assert.ok(qr.targetUrl.includes(`/cinema/${qr.token}`));

    // Base64 PNG image check
    assert.ok(qr.qrCodeData.startsWith('data:image/png;base64,'));

    theatreAQrId = qr.id;
    theatreAToken = qr.token;
  });

  test('POST /api/cinema/qr/screens/:screenId - Generates Screen-Specific QR code', async () => {
    const res = await request(app)
      .post(`/api/cinema/qr/screens/${screen1AId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 201);
    assert.ok(res.body.qrCode);
    const qr = res.body.qrCode;

    assert.equal(qr.qrType, 'screen');
    assert.equal(qr.theatreId, theatreAId);
    assert.equal(qr.screenId, screen1AId);
    assert.equal(qr.status, 'active');

    // High entropy screenToken
    assert.equal(qr.screenToken.length, 48);
    assert.match(qr.screenToken, /^[0-9a-f]{48}$/);
    assert.equal(qr.theatreToken, theatreAToken);

    // Target customer route URL includes both theatre and screen tokens
    assert.ok(qr.targetUrl.includes(`/cinema/${theatreAToken}/${qr.screenToken}`));
    assert.ok(qr.qrCodeData.startsWith('data:image/png;base64,'));

    screen1AQrId = qr.id;
    screen1AToken = qr.screenToken;
  });

  test('Token Uniqueness - Rapidly generated QR tokens never collide', async () => {
    const res2 = await request(app)
      .post(`/api/cinema/qr/screens/${screen2AId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res2.status, 201);
    const screen2Token = res2.body.qrCode.screenToken;

    assert.notEqual(screen1AToken, screen2Token, 'Screen 1 and Screen 2 tokens must be unique');
    assert.notEqual(theatreAToken, screen2Token, 'Theatre token and Screen token must be unique');
  });

  test('GET /api/cinema/qr - Lists all active and pending QR stands for Theatre A', async () => {
    const res = await request(app)
      .get('/api/cinema/qr')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.ok(res.body.theatreQr, 'theatreQr must exist');
    assert.equal(res.body.theatreQr.id, theatreAQrId);
    assert.equal(res.body.screenQrs.length, 2, 'Must have 2 active screen QRs');
    assert.equal(res.body.screensWithoutQr.length, 0, 'All screens now have QRs');
  });

  test('GET /api/cinema/public/resolve/:theatreToken - Public General Theatre QR resolution succeeds', async () => {
    const res = await request(app)
      .get(`/api/cinema/public/resolve/${theatreAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.qrType, 'theatre');
    assert.equal(res.body.isScreenPreselected, false);
    assert.equal(res.body.selectedScreen, null);

    // Theatre public details (no sequential DB ID or credentials exposed)
    assert.equal(res.body.theatre.name, 'PVR Heritage QR');
    assert.equal(res.body.theatre.city, 'Bangalore');
    assert.equal(res.body.theatre.currency, 'INR');

    // Screens list returned for guest selection
    assert.ok(Array.isArray(res.body.screens));
    assert.equal(res.body.screens.length, 2);
    const screenNames = res.body.screens.map((s: any) => s.screenName);
    assert.ok(screenNames.includes('Screen 1 (IMAX)'));
    assert.ok(screenNames.includes('Screen 2 (Dolby Atmos)'));
  });

  test('GET /api/cinema/public/resolve/:theatreToken/:screenToken - Public Screen QR resolution preselects auditorium', async () => {
    const res = await request(app)
      .get(`/api/cinema/public/resolve/${theatreAToken}/${screen1AToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.qrType, 'screen');
    assert.equal(res.body.isScreenPreselected, true);

    // Selected screen details
    assert.ok(res.body.selectedScreen);
    assert.equal(res.body.selectedScreen.screenName, 'Screen 1 (IMAX)');
    assert.equal(res.body.selectedScreen.screenType, 'imax');
    assert.equal(res.body.selectedScreen.totalSeats, 250);
    assert.equal(res.body.selectedScreen.screenToken, screen1AToken);
  });

  test('Invalid & Revoked Token Handling - Rejects bad format or non-existent tokens with 400 / 404', async () => {
    // 1. Invalid token format (too short / invalid characters)
    const badFormatRes = await request(app)
      .get('/api/cinema/public/resolve/invalid-short-token');
    assert.equal(badFormatRes.status, 400);

    // 2. Non-existent cryptographic token
    const randomHex48 = crypto.randomBytes(24).toString('hex');
    const notFoundRes = await request(app)
      .get(`/api/cinema/public/resolve/${randomHex48}`);
    assert.equal(notFoundRes.status, 404);
  });

  test('POST /api/cinema/qr/:id/revoke - Revokes a Screen QR stand and blocks resolution', async () => {
    // Revoke Screen 1 QR
    const revokeRes = await request(app)
      .post(`/api/cinema/qr/${screen1AQrId}/revoke`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.qrCode.status, 'revoked');
    assert.ok(revokeRes.body.qrCode.revokedAt);

    // Public resolution with revoked screenToken must now return 404
    const resolveRes = await request(app)
      .get(`/api/cinema/public/resolve/${theatreAToken}/${screen1AToken}`);

    assert.equal(resolveRes.status, 404);
  });

  test('POST /api/cinema/qr/:id/regenerate - Replaces a QR token and verifies old token is retired', async () => {
    // Regenerate General Theatre QR
    const regenRes = await request(app)
      .post(`/api/cinema/qr/${theatreAQrId}/regenerate`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(regenRes.status, 200);
    const newQr = regenRes.body.qrCode;
    assert.notEqual(newQr.token, theatreAToken, 'New token must differ from retired token');

    // Old theatre token must now return 404
    const oldResolveRes = await request(app)
      .get(`/api/cinema/public/resolve/${theatreAToken}`);
    assert.equal(oldResolveRes.status, 404);

    // New theatre token resolves successfully
    const newResolveRes = await request(app)
      .get(`/api/cinema/public/resolve/${newQr.token}`);
    assert.equal(newResolveRes.status, 200);
    assert.equal(newResolveRes.body.valid, true);

    theatreAToken = newQr.token;
    theatreAQrId = newQr.id;
  });

  test('Tenant Isolation - Cinema Owner B cannot access, revoke, or regenerate Cinema Owner A QRs', async () => {
    // Cinema Owner B tries to revoke Cinema Owner A's theatre QR
    const revokeRes = await request(app)
      .post(`/api/cinema/qr/${theatreAQrId}/revoke`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(revokeRes.status, 404);

    // Cinema Owner B tries to generate QR for Cinema Owner A's screen
    const genRes = await request(app)
      .post(`/api/cinema/qr/screens/${screen1AId}`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(genRes.status, 404);

    // Listing for Theatre B shows 0 active QRs
    const listB = await request(app)
      .get('/api/cinema/qr')
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(listB.status, 200);
    assert.equal(listB.body.theatreQr, null);
    assert.equal(listB.body.screenQrs.length, 0);
  });

  test('Onboarding status progression - stage 7 qr_generated is now true', async () => {
    const res = await request(app)
      .get('/api/cinema/onboarding/status')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    const qrStage = res.body.stages.find((s: any) => s.key === 'qr_generated');
    assert.ok(qrStage);
    assert.equal(qrStage.isCompleted, true, 'qr_generated must be true now that an active QR exists');
  });

  test('Restaurant Regression Check - Existing table QR code creation & verification remains functional', async () => {
    // 1. Restaurant creates table with QR code
    const tableRes = await request(app)
      .post('/api/tables')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId)
      .send({
        tableNumber: 'Table 42',
        capacity: 4
      });

    assert.equal(tableRes.status, 201);
    assert.ok(tableRes.body.tableToken);
    assert.ok(tableRes.body.qrCodeData);
    assert.equal(tableRes.body.tableToken.length, 48);

    // 2. Customer verifies table QR token
    const verifyRes = await request(app)
      .get(`/api/tables/verify/${tableRes.body.tableToken}`);

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.table.tableNumber, 'Table 42');
    assert.equal(verifyRes.body.restaurant.name, 'Spice Trail Restaurant');
  });
});
