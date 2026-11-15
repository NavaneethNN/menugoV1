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
  cinemaMovies,
  cinemaShows,
  cinemaQrCodes,
  categories,
  products,
  restaurantTables,
  orders
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 09: Customer Cinema Ordering Interface', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantOwnerId: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let screen1AId: string;
  let screen2AId: string;
  let screen1BId: string;

  let movie1AId: string;
  let movie2AId: string;

  let publishedShowOpenId: string;
  let publishedShowClosedId: string;
  let draftShowId: string;
  let cancelledShowId: string;

  let theatreAQrToken: string;
  let screen1AQrToken: string;

  let popcornCatId: string;
  let popcornProdId: string;
  let unavailableProdId: string;

  const todayDate = new Date().toISOString().split('T')[0]!;

  const createdTheatresToClean = [theatreAId, theatreBId, restaurantId];
  const createdUsersToClean: string[] = [];

  before(async () => {
    const timestamp = Date.now();

    // 1. Cinema Owner A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner A',
        email: `cust-a-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    const jsonA = await resA.json();
    userCinemaAId = jsonA.user.id;
    createdUsersToClean.push(userCinemaAId);

    // 2. Cinema Owner B
    const resB = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner B',
        email: `cust-b-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    // 3. Restaurant Owner
    const resRest = await auth.api.signUpEmail({
      body: {
        name: 'Restaurant Owner',
        email: `cust-rest-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    const jsonRest = await resRest.json();
    userRestaurantOwnerId = jsonRest.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    // Seed Theatre A (cinema)
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'Miraj Cinemas Apex',
      slug: `miraj-cinemas-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      theatreName: 'Miraj Cinemas Apex',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      contactNumber: '9988776655',
      contactEmail: 'contact@mirajapex.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
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
      screenName: 'Screen 1 (Dolby Atmos)',
      screenType: 'dolby_atmos',
      totalSeats: 100,
      status: 'active'
    });

    screen2AId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen2AId,
      theatreId: theatreAId,
      screenName: 'Screen 2 (VIP Recliner)',
      screenType: 'vip',
      totalSeats: 60,
      status: 'active'
    });

    // Seed Rows & Seats for Screen 1
    const rowAId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowAId,
      theatreId: theatreAId,
      screenId: screen1AId,
      rowIdentifier: 'A',
      sortOrder: 1,
      startSeatNumber: 1,
      endSeatNumber: 10,
      totalSeats: 10,
      seatCategory: 'regular',
      status: 'active'
    });
    await db.insert(cinemaSeats).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screen1AId,
        rowId: rowAId,
        rowIdentifier: 'A',
        seatNumber: 1,
        seatIdentifier: 'A1',
        seatCategory: 'regular',
        status: 'active'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screen1AId,
        rowId: rowAId,
        rowIdentifier: 'A',
        seatNumber: 2,
        seatIdentifier: 'A2',
        seatCategory: 'regular',
        status: 'active'
      }
    ]);

    const rowBId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowBId,
      theatreId: theatreAId,
      screenId: screen1AId,
      rowIdentifier: 'B',
      sortOrder: 2,
      startSeatNumber: 1,
      endSeatNumber: 10,
      totalSeats: 10,
      seatCategory: 'premium',
      status: 'active'
    });
    await db.insert(cinemaSeats).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      screenId: screen1AId,
      rowId: rowBId,
      rowIdentifier: 'B',
      seatNumber: 1,
      seatIdentifier: 'B1',
      seatCategory: 'premium',
      status: 'active'
    });

    // Seed Movies for Theatre A
    movie1AId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movie1AId,
      theatreId: theatreAId,
      title: 'Interstellar: 10th Anniversary',
      language: 'English',
      durationMinutes: 169,
      status: 'active'
    });

    movie2AId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movie2AId,
      theatreId: theatreAId,
      title: 'Kalki 2898 AD',
      language: 'Hindi',
      durationMinutes: 181,
      status: 'active'
    });

    // Seed Shows for Screen 1
    // 1. Published show with OPEN ordering window (now - 1 hour to now + 2 hours)
    const now = new Date();
    publishedShowOpenId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: publishedShowOpenId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie1AId,
      showDate: todayDate,
      startTime: new Date(now.getTime() - 15 * 60000), // started 15 min ago
      expectedEndTime: new Date(now.getTime() + 150 * 60000), // ends in 2.5 hours
      orderingStartTime: new Date(now.getTime() - 30 * 60000), // opened 30 min ago
      orderingEndTime: new Date(now.getTime() + 60 * 60000), // closes in 1 hour
      turnaroundBufferMinutes: 15,
      status: 'published'
    });

    // 2. Published show with CLOSED ordering window (ended yesterday)
    publishedShowClosedId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: publishedShowClosedId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie2AId,
      showDate: todayDate,
      startTime: new Date(now.getTime() - 300 * 60000),
      expectedEndTime: new Date(now.getTime() - 120 * 60000),
      orderingStartTime: new Date(now.getTime() - 320 * 60000),
      orderingEndTime: new Date(now.getTime() - 180 * 60000), // closed 3 hours ago
      turnaroundBufferMinutes: 15,
      status: 'published'
    });

    // 3. Draft show (should be rejected in public queries)
    draftShowId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: draftShowId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie1AId,
      showDate: todayDate,
      startTime: new Date(now.getTime() + 300 * 60000),
      expectedEndTime: new Date(now.getTime() + 460 * 60000),
      orderingStartTime: new Date(now.getTime() + 270 * 60000),
      orderingEndTime: new Date(now.getTime() + 400 * 60000),
      turnaroundBufferMinutes: 15,
      status: 'draft'
    });

    // 4. Cancelled show (should be rejected)
    cancelledShowId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: cancelledShowId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie2AId,
      showDate: todayDate,
      startTime: new Date(now.getTime() + 500 * 60000),
      expectedEndTime: new Date(now.getTime() + 680 * 60000),
      orderingStartTime: new Date(now.getTime() + 470 * 60000),
      orderingEndTime: new Date(now.getTime() + 600 * 60000),
      turnaroundBufferMinutes: 15,
      status: 'cancelled',
      cancellationReason: 'Technical audio issue'
    });

    // Seed General & Screen QR codes for Theatre A
    theatreAQrToken = crypto.randomBytes(24).toString('hex');
    await db.insert(cinemaQrCodes).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      screenId: null,
      qrType: 'theatre',
      qrName: 'Miraj Apex General Stand',
      token: theatreAQrToken,
      theatreToken: theatreAQrToken,
      targetUrl: `http://localhost:3000/cinema/${theatreAQrToken}`,
      qrCodeData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      status: 'active'
    });

    screen1AQrToken = crypto.randomBytes(24).toString('hex');
    await db.insert(cinemaQrCodes).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      screenId: screen1AId,
      qrType: 'screen',
      qrName: 'Screen 1 Stand QR',
      token: screen1AQrToken,
      theatreToken: theatreAQrToken,
      screenToken: screen1AQrToken,
      targetUrl: `http://localhost:3000/cinema/${theatreAQrToken}/${screen1AQrToken}`,
      qrCodeData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      status: 'active'
    });

    // Seed Food Menu for Theatre A
    popcornCatId = crypto.randomUUID();
    await db.insert(categories).values({
      id: popcornCatId,
      restaurantId: theatreAId,
      name: 'Popcorn & Combos',
      sortOrder: 1,
      isActive: true
    });

    popcornProdId = crypto.randomUUID();
    await db.insert(products).values({
      id: popcornProdId,
      restaurantId: theatreAId,
      categoryId: popcornCatId,
      name: 'Salted Popcorn (Regular)',
      price: 18000, // ₹180.00
      isVegetarian: true,
      isAvailable: true,
      sortOrder: 1
    });

    unavailableProdId = crypto.randomUUID();
    await db.insert(products).values({
      id: unavailableProdId,
      restaurantId: theatreAId,
      categoryId: popcornCatId,
      name: 'Caramel Popcorn (Sold Out)',
      price: 22000,
      isVegetarian: true,
      isAvailable: false, // in stock false
      sortOrder: 2
    });

    // Seed Theatre B (for isolation checks)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'Wave Cinemas B',
      slug: `wave-cinemas-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    screen1BId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1BId,
      theatreId: theatreBId,
      screenName: 'Screen B1',
      screenType: 'standard',
      totalSeats: 80,
      status: 'active'
    });

    // Seed Restaurant (for regression checks)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Curry Kingdom',
      slug: `curry-kingdom-${timestamp}`,
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
    await db.insert(restaurantTables).values({
      id: crypto.randomUUID(),
      restaurantId: restaurantId,
      tableNumber: 'T10',
      capacity: 4,
      tableToken: crypto.randomBytes(24).toString('hex'),
      isActive: true
    });
  });

  after(async () => {
    await db.delete(orders).where(inArray(orders.restaurantId, createdTheatresToClean));
    await db.delete(restaurantTables).where(inArray(restaurantTables.restaurantId, createdTheatresToClean));
    await db.delete(products).where(inArray(products.restaurantId, createdTheatresToClean));
    await db.delete(categories).where(inArray(categories.restaurantId, createdTheatresToClean));
    await db.delete(cinemaQrCodes).where(inArray(cinemaQrCodes.theatreId, createdTheatresToClean));
    await db.delete(cinemaShows).where(inArray(cinemaShows.theatreId, createdTheatresToClean));
    await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, createdTheatresToClean));
    await db.delete(cinemaSeats).where(inArray(cinemaSeats.theatreId, createdTheatresToClean));
    await db.delete(cinemaRows).where(inArray(cinemaRows.theatreId, createdTheatresToClean));
    await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, createdTheatresToClean));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatresToClean));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatresToClean));
    await db.delete(restaurants).where(inArray(restaurants.id, createdTheatresToClean));
    if (createdUsersToClean.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }
    await pool.end().catch(() => {});
  });

  test('Step 1: Public QR Resolution (General Stand) - Returns theatre and active screens', async () => {
    const res = await request(app).get(`/api/cinema/public/resolve/${theatreAQrToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.qrType, 'theatre');
    assert.equal(res.body.theatre.name, 'Miraj Cinemas Apex');
    assert.equal(res.body.isScreenPreselected, false);
    assert.equal(res.body.selectedScreen, null);
    assert.equal(res.body.screens.length, 2);
    assert.ok(res.body.screens[0].id, 'Active screen must include id for selection');
  });

  test('Step 1: Public QR Resolution (Screen Stand) - Preselects auditorium Screen 1', async () => {
    const res = await request(app).get(
      `/api/cinema/public/resolve/${theatreAQrToken}/${screen1AQrToken}`
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.qrType, 'screen');
    assert.equal(res.body.isScreenPreselected, true);
    assert.ok(res.body.selectedScreen);
    assert.equal(res.body.selectedScreen.screenId, screen1AId);
    assert.equal(res.body.selectedScreen.screenName, 'Screen 1 (Dolby Atmos)');
  });

  test('Step 2 & 3: GET /api/cinema/public/shows/:theatreToken - Retrieves published shows and evaluates ordering window', async () => {
    const res = await request(app)
      .get(`/api/cinema/public/shows/${theatreAQrToken}?screenId=${screen1AId}&date=${todayDate}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.screenId, screen1AId);
    assert.ok(Array.isArray(res.body.shows));

    // Must ONLY include published shows (both open and closed window)
    // Draft show and Cancelled show MUST NOT be returned!
    const showIds = res.body.shows.map((s: any) => s.id);
    assert.ok(showIds.includes(publishedShowOpenId), 'Must include published show with open ordering window');
    assert.ok(showIds.includes(publishedShowClosedId), 'Must include published show with closed ordering window');
    assert.ok(!showIds.includes(draftShowId), 'Draft show must NOT be exposed to public customers');
    assert.ok(!showIds.includes(cancelledShowId), 'Cancelled show must NOT be exposed to public customers');

    // Verify ordering window calculation
    const openShow = res.body.shows.find((s: any) => s.id === publishedShowOpenId);
    assert.equal(openShow.isOrderingOpen, true, 'Ordering window should be open');
    assert.equal(openShow.orderingStatus, 'open');

    const closedShow = res.body.shows.find((s: any) => s.id === publishedShowClosedId);
    assert.equal(closedShow.isOrderingOpen, false, 'Ordering window should be closed');
    assert.equal(closedShow.orderingStatus, 'closed');
  });

  test('Step 4: GET /api/cinema/public/seating/:theatreToken/:screenId - Retrieves active rows and seats', async () => {
    const res = await request(app)
      .get(`/api/cinema/public/seating/${theatreAQrToken}/${screen1AId}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.screenId, screen1AId);
    assert.equal(res.body.rowsCount, 2);

    // Verify Row A
    const rowA = res.body.rows.find((r: any) => r.rowIdentifier === 'A');
    assert.ok(rowA);
    assert.equal(rowA.seatCategory, 'regular');
    assert.equal(rowA.seats.length, 2);
    assert.equal(rowA.seats[0].seatIdentifier, 'A1');
    assert.equal(rowA.seats[1].seatIdentifier, 'A2');

    // Verify Row B
    const rowB = res.body.rows.find((r: any) => r.rowIdentifier === 'B');
    assert.ok(rowB);
    assert.equal(rowB.seatCategory, 'premium');
    assert.equal(rowB.seats.length, 1);
    assert.equal(rowB.seats[0].seatIdentifier, 'B1');
  });

  test('Step 5: GET /api/cinema/public/menu/:theatreToken - Retrieves active food menu and filters unavailable items', async () => {
    const res = await request(app)
      .get(`/api/cinema/public/menu/${theatreAQrToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.currency, 'INR');
    assert.ok(Array.isArray(res.body.categories));
    assert.ok(Array.isArray(res.body.products));

    const prodNames = res.body.products.map((p: any) => p.name);
    assert.ok(prodNames.includes('Salted Popcorn (Regular)'));
    assert.ok(!prodNames.includes('Caramel Popcorn (Sold Out)'), 'Sold out items must not be listed in active customer menu');
  });

  test('Step 6: POST /api/cinema/public/validate-selection - Validates correct customer selection', async () => {
    const res = await request(app)
      .post('/api/cinema/public/validate-selection')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        rowIdentifier: 'A',
        seatIdentifier: 'A1'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.selection.screenName, 'Screen 1 (Dolby Atmos)');
    assert.equal(res.body.selection.movieTitle, 'Interstellar: 10th Anniversary');
    assert.equal(res.body.selection.rowIdentifier, 'A');
    assert.equal(res.body.selection.seatIdentifier, 'A1');
    assert.equal(res.body.selection.seatCategory, 'regular');
  });

  test('Validation: Rejects show when food ordering window is closed', async () => {
    const res = await request(app)
      .post('/api/cinema/public/validate-selection')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowClosedId,
        rowIdentifier: 'A',
        seatIdentifier: 'A1'
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('closed'));
  });

  test('Validation: Rejects seat that belongs to another screen', async () => {
    const res = await request(app)
      .post('/api/cinema/public/validate-selection')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen2AId, // Screen 2 selected
        showId: publishedShowOpenId,
        rowIdentifier: 'A',
        seatIdentifier: 'A1' // But A1 belongs to Screen 1!
      });

    assert.equal(res.status, 404); // show doesn't match Screen 2
  });

  test('Validation: Rejects non-existent seat identifier', async () => {
    const res = await request(app)
      .post('/api/cinema/public/validate-selection')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        rowIdentifier: 'Z',
        seatIdentifier: 'Z99'
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('does not exist'));
  });

  test('Tenant Isolation: Theatre B screen/show submitted to Theatre A QR token fails', async () => {
    const res = await request(app)
      .post('/api/cinema/public/validate-selection')
      .send({
        theatreToken: theatreAQrToken, // Theatre A token
        screenId: screen1BId, // Screen from Theatre B!
        showId: publishedShowOpenId,
        rowIdentifier: 'A',
        seatIdentifier: 'A1'
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('does not belong to this theatre'));
  });

  test('Restaurant Regression Check - Table QR verification remains untouched', async () => {
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.restaurantId, restaurantId))
      .limit(1);

    assert.ok(table);
    const verifyRes = await request(app).get(`/api/tables/verify/${table.tableToken}`);

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.table.tableNumber, 'T10');
    assert.equal(verifyRes.body.restaurant.name, 'Curry Kingdom');
  });
});
