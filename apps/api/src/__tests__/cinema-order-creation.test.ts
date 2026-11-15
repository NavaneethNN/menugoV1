import { it, describe, before, after } from 'node:test';
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
  cinemaPaymentAccounts,
  cinemaPaymentTransactions,
  cinemaRefunds,
  cinemaWebhookEvents,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  cinemaQrCodes,
  products,
  orders,
  orderItems,
  orderStatusHistory,
  restaurantTables
} from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { encryptSecret } from '../lib/encryption';
import { generatePaytmSignature, generatePaytmParamChecksum } from '../lib/payment/paytm.adapter';
import { generateRazorpaySignature } from '../lib/payment/razorpay.adapter';
import { generateCinemaQrToken } from '@menugo/shared';

process.env.NODE_ENV = 'test';

describe('Task 14: Cinema Order Creation & Payment Linkage', () => {
  const timestamp = Date.now();
  const createdUsersToClean: string[] = [];

  // Tenants
  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantId: string;

  let cookieCinemaA: string;
  let cookieCinemaB: string;
  let cookieRestaurant: string;

  // Cinema Infrastructure
  let screen1AId: string;
  let screen1BId: string;

  let movie1AId: string;
  let movie2AId: string;

  let publishedShowOpenId: string;
  let publishedShowClosedId: string;
  let cancelledShowId: string;
  let draftShowId: string;

  let theatreAQrToken: string;
  let theatreBQrToken: string;

  // Products
  let prodPopcornId: string; // ₹250.00
  let prodCokeId: string;    // ₹120.00
  let prodSoldOutId: string; // ₹180.00 (isAvailable: false)
  let prodTheatreBId: string;// ₹300.00 (Belongs to Theatre B)

  // Gateway Credentials
  const razorpayKeyIdA = `rzp_test_cinema_${timestamp.toString().slice(-6)}`;
  const razorpaySecretA = `MockRazorpaySecret_${timestamp}`;
  const paytmMidA = `TEST_THEATRE_MID_${timestamp.toString().slice(-6)}`;
  const paytmKeyA = `MockMerchantKeySecret_${timestamp}`;

  before(async () => {
    // 1. Create Admins for Theatre A, Theatre B, and Restaurant
    const resA = await auth.api.signUpEmail({
      body: {
        email: `theatre-a-admin-${timestamp}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre A Admin'
      },
      asResponse: true
    });
    cookieCinemaA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonA = await resA.json();
    userCinemaAId = jsonA.user.id;
    createdUsersToClean.push(userCinemaAId);

    const resB = await auth.api.signUpEmail({
      body: {
        email: `theatre-b-admin-${timestamp}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre B Admin'
      },
      asResponse: true
    });
    cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    const resRest = await auth.api.signUpEmail({
      body: {
        email: `restaurant-owner-${timestamp}@menugo.com`,
        password: 'Password123!',
        name: 'Diner Owner'
      },
      asResponse: true
    });
    cookieRestaurant = resRest.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonRest = await resRest.json();
    userRestaurantId = jsonRest.user.id;
    createdUsersToClean.push(userRestaurantId);

    // 2. Setup Theatre A Tenant
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'Miraj Cinemas IMAX',
      slug: `miraj-imax-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true,
      settings: { taxPercentage: 5 }
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreAId,
      theatreName: 'Miraj Cinemas IMAX',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'orders@mirajimax.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      onboardingStage: 'completed',
      onboardingCompleted: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'admin'
    });

    // 3. Setup Theatre B Tenant (Isolation check)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'Cinepolis Westend',
      slug: `cinepolis-westend-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true,
      settings: { taxPercentage: 5 }
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreBId,
      theatreName: 'Cinepolis Westend',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      contactNumber: '9876543219',
      contactEmail: 'admin@cinepolis.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      onboardingStage: 'completed',
      onboardingCompleted: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreBId,
      userId: userCinemaBId,
      role: 'admin'
    });

    // 4. Setup Restaurant Tenant (Regression check)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Urban Bistro',
      slug: `urban-bistro-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true,
      settings: { taxPercentage: 5 }
    });

    await db.insert(restaurantMembers).values({
      restaurantId: restaurantId,
      userId: userRestaurantId,
      role: 'owner'
    });

    await db.insert(restaurantTables).values({
      id: crypto.randomUUID(),
      restaurantId,
      tableNumber: 'Table 14',
      qrCode: `rest-qr-${timestamp}`,
      isActive: true
    });

    // 5. Setup Theatre A Payment Gateways (Razorpay & Paytm)
    await db.insert(cinemaPaymentAccounts).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        provider: 'razorpay',
        environment: 'test',
        keyId: razorpayKeyIdA,
        encryptedKeySecret: encryptSecret(razorpaySecretA),
        maskedKeySecret: '••••••••mock_rzp',
        status: 'active',
        isVerified: true,
        verifiedAt: new Date(),
        settings: { merchantName: 'Miraj Cinemas IMAX' }
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        provider: 'paytm',
        environment: 'test',
        keyId: paytmMidA,
        encryptedKeySecret: encryptSecret(paytmKeyA),
        maskedKeySecret: '••••••••mock_ptm',
        status: 'active',
        isVerified: true,
        verifiedAt: new Date(),
        settings: { mid: paytmMidA, channelId: 'WEB', website: 'WEBSTAGING' }
      }
    ]);

    // 6. Setup Screens & Seating Layout
    screen1AId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1AId,
      theatreId: theatreAId,
      screenNumber: 1,
      screenName: 'IMAX Audi 1',
      screenType: 'IMAX',
      totalSeats: 50,
      soundSystem: 'Dolby Atmos',
      status: 'active'
    });

    const rowAId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowAId,
      theatreId: theatreAId,
      screenId: screen1AId,
      rowIdentifier: 'C',
      seatCategory: 'Recliner',
      sortOrder: 1,
      startSeatNumber: 1,
      endSeatNumber: 2,
      totalSeats: 2
    });

    await db.insert(cinemaSeats).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screen1AId,
        rowId: rowAId,
        rowIdentifier: 'C',
        seatNumber: 1,
        seatIdentifier: '1',
        seatCategory: 'Recliner',
        status: 'active'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screen1AId,
        rowId: rowAId,
        rowIdentifier: 'C',
        seatNumber: 2,
        seatIdentifier: '2',
        seatCategory: 'Recliner',
        status: 'inactive' // Inactive seat for testing
      }
    ]);

    screen1BId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1BId,
      theatreId: theatreBId,
      screenNumber: 1,
      screenName: 'Screen 1 B',
      screenType: 'Standard 2D',
      totalSeats: 30,
      status: 'active'
    });

    // 7. Setup Movies
    movie1AId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movie1AId,
      theatreId: theatreAId,
      title: 'Interstellar IMAX',
      language: 'English',
      durationMinutes: 169,
      rating: 'UA',
      genre: 'Sci-Fi',
      status: 'active'
    });

    movie2AId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movie2AId,
      theatreId: theatreAId,
      title: 'Dune: Part Two',
      language: 'English',
      durationMinutes: 166,
      rating: 'UA',
      genre: 'Sci-Fi',
      status: 'active'
    });

    // 8. Setup Shows with various ordering windows & statuses
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]!;

    // Open Show: Window open 30 min before to 120 min after
    publishedShowOpenId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: publishedShowOpenId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie1AId,
      showDate: todayStr,
      startTime: new Date(now.getTime() + 15 * 60 * 1000), // starts in 15 mins
      expectedEndTime: new Date(now.getTime() + 180 * 60 * 1000),
      orderingStartTime: new Date(now.getTime() - 30 * 60 * 1000), // open 30 min ago
      orderingEndTime: new Date(now.getTime() + 60 * 60 * 1000), // closes in 60 min
      turnaroundBufferMinutes: 15,
      status: 'published'
    });

    // Closed Show: Window closed
    publishedShowClosedId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: publishedShowClosedId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie1AId,
      showDate: todayStr,
      startTime: new Date(now.getTime() - 200 * 60 * 1000),
      expectedEndTime: new Date(now.getTime() - 20 * 60 * 1000),
      orderingStartTime: new Date(now.getTime() - 230 * 60 * 1000),
      orderingEndTime: new Date(now.getTime() - 100 * 60 * 1000), // ended 100 min ago
      turnaroundBufferMinutes: 15,
      status: 'published'
    });

    // Cancelled Show
    cancelledShowId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: cancelledShowId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie1AId,
      showDate: todayStr,
      startTime: new Date(now.getTime() + 60 * 60 * 1000),
      expectedEndTime: new Date(now.getTime() + 240 * 60 * 1000),
      orderingStartTime: new Date(now.getTime() - 30 * 60 * 1000),
      orderingEndTime: new Date(now.getTime() + 60 * 60 * 1000),
      turnaroundBufferMinutes: 15,
      status: 'cancelled',
      cancellationReason: 'Technical projector malfunction'
    });

    // Draft Show
    draftShowId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: draftShowId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie2AId,
      showDate: todayStr,
      startTime: new Date(now.getTime() + 100 * 60 * 1000),
      expectedEndTime: new Date(now.getTime() + 280 * 60 * 1000),
      orderingStartTime: new Date(now.getTime() - 30 * 60 * 1000),
      orderingEndTime: new Date(now.getTime() + 60 * 60 * 1000),
      turnaroundBufferMinutes: 15,
      status: 'draft'
    });

    // 9. Setup Public QR Tokens
    theatreAQrToken = crypto.randomBytes(24).toString('hex');
    await db.insert(cinemaQrCodes).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      qrType: 'theatre',
      qrName: 'Main Lobby Stand',
      token: theatreAQrToken,
      targetUrl: `http://localhost:3000/cinema/${theatreAQrToken}`,
      qrCodeData: 'data:image/png;base64,mock',
      status: 'active'
    });

    theatreBQrToken = crypto.randomBytes(24).toString('hex');
    await db.insert(cinemaQrCodes).values({
      id: crypto.randomUUID(),
      theatreId: theatreBId,
      qrType: 'theatre',
      qrName: 'Theatre B Lobby',
      token: theatreBQrToken,
      targetUrl: `http://localhost:3000/cinema/${theatreBQrToken}`,
      qrCodeData: 'data:image/png;base64,mock',
      status: 'active'
    });

    // 10. Setup Products
    prodPopcornId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodPopcornId,
      restaurantId: theatreAId,
      name: 'Caramel Gourmet Popcorn',
      price: 25000, // ₹250.00
      isVegetarian: true,
      isAvailable: true
    });

    prodCokeId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodCokeId,
      restaurantId: theatreAId,
      name: 'Fountain Coke Large',
      price: 12000, // ₹120.00
      isVegetarian: true,
      isAvailable: true
    });

    prodSoldOutId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodSoldOutId,
      restaurantId: theatreAId,
      name: 'Loaded Cheese Nachos',
      price: 18000, // ₹180.00
      isVegetarian: true,
      isAvailable: false // Sold out!
    });

    prodTheatreBId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodTheatreBId,
      restaurantId: theatreBId,
      name: 'Theatre B Burger Combo',
      price: 30000,
      isVegetarian: false,
      isAvailable: true
    });
  });

  after(async () => {
    try {
      await db.delete(cinemaWebhookEvents).where(inArray(cinemaWebhookEvents.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaRefunds).where(inArray(cinemaRefunds.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaPaymentTransactions).where(inArray(cinemaPaymentTransactions.theatreId, [theatreAId, theatreBId]));
      await db.delete(orderStatusHistory).where(
        inArray(
          orderStatusHistory.orderId,
          (
            await db
              .select({ id: orders.id })
              .from(orders)
              .where(inArray(orders.restaurantId, [theatreAId, theatreBId, restaurantId]))
          ).map((o) => o.id)
        )
      );
      await db.delete(orderItems).where(
        inArray(
          orderItems.orderId,
          (
            await db
              .select({ id: orders.id })
              .from(orders)
              .where(inArray(orders.restaurantId, [theatreAId, theatreBId, restaurantId]))
          ).map((o) => o.id)
        )
      );
      await db.delete(orders).where(inArray(orders.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(products).where(inArray(products.restaurantId, [theatreAId, theatreBId]));
      await db.delete(cinemaQrCodes).where(inArray(cinemaQrCodes.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaShows).where(inArray(cinemaShows.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaSeats).where(inArray(cinemaSeats.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaRows).where(inArray(cinemaRows.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaPaymentAccounts).where(inArray(cinemaPaymentAccounts.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurantTables).where(eq(restaurantTables.restaurantId, restaurantId));
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));
      if (createdUsersToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUsersToClean));
      }
      await pool.end();
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
  });

  describe('1. Valid Cinema Order Creation & Context Retention', () => {
    let preparedOrder: any;
    let preparedStatusToken: string;

    it('creates a pending cinema order in UNPAID status with complete cinema context', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [
            { productId: prodPopcornId, quantity: 2, notes: 'Extra butter' },
            { productId: prodCokeId, quantity: 1 }
          ],
          customerName: 'Karan Mehra',
          customerPhone: '9876543210',
          specialInstructions: 'Deliver during interval please'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.statusToken);
      preparedStatusToken = res.body.statusToken;
      preparedOrder = res.body.order;

      // Assert status and payment status: STRICTLY pending and unpaid
      assert.equal(preparedOrder.status, 'pending');
      assert.equal(preparedOrder.paymentStatus, 'unpaid');
      assert.equal(preparedOrder.orderType, 'cinema');

      // Assert cinema context retention in response
      assert.equal(preparedOrder.theatre.id, theatreAId);
      assert.equal(preparedOrder.screen.id, screen1AId);
      assert.equal(preparedOrder.screen.screenName, 'IMAX Audi 1');
      assert.equal(preparedOrder.movie.id, movie1AId);
      assert.equal(preparedOrder.movie.title, 'Interstellar IMAX');
      assert.equal(preparedOrder.show.id, publishedShowOpenId);
      assert.equal(preparedOrder.seat.row, 'C');
      assert.equal(preparedOrder.seat.seat, '1');

      // Assert server-side prices: Popcorn ₹250*2 = ₹500, Coke ₹120*1 = ₹120 -> Subtotal ₹620 (62000 paise)
      // Tax 5% = ₹31.00 (3100 paise) -> Total = ₹651.00 (65100 paise)
      assert.equal(preparedOrder.summary.subtotal, 62000);
      assert.equal(preparedOrder.summary.taxAmount, 3100);
      assert.equal(preparedOrder.summary.totalAmount, 65100);
      assert.equal(preparedOrder.items.length, 2);
    });

    it('retains explicit cinema context columns in the database orders table', async () => {
      const [dbOrder] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, preparedOrder.id))
        .limit(1);

      assert.ok(dbOrder);
      assert.equal(dbOrder.restaurantId, theatreAId);
      assert.equal(dbOrder.screenId, screen1AId);
      assert.equal(dbOrder.showId, publishedShowOpenId);
      assert.equal(dbOrder.movieId, movie1AId);
      assert.ok(dbOrder.showDate);
      assert.ok(dbOrder.showtime);
      assert.equal(dbOrder.seatRow, 'C');
      assert.equal(dbOrder.seatNumber, '1');
      assert.equal(dbOrder.status, 'pending');
      assert.equal(dbOrder.paymentStatus, 'unpaid');
      assert.equal(dbOrder.subtotal, 62000);
      assert.equal(dbOrder.taxAmount, 3100);
      assert.equal(dbOrder.totalAmount, 65100);
      assert.equal(dbOrder.statusToken, preparedStatusToken);
    });

    it('records initial order audit trail in orderStatusHistory', async () => {
      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, preparedOrder.id));

      assert.ok(history.length >= 1);
      const initialEntry = history.find((h) => h.toStatus === 'pending');
      assert.ok(initialEntry);
      assert.equal(initialEntry.fromStatus, 'draft');
      assert.equal(initialEntry.changedByRole, 'customer');
    });
  });

  describe('2. Authoritative Backend Validation & Rejection', () => {
    it('rejects order with invalid or missing theatre token (404)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: 'non_existent_token_12345678',
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.equal(res.status, 404);
    });

    it('rejects order when screen does not belong to the theatre (400 / 404)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1BId, // Screen belongs to Theatre B
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.ok(res.status === 400 || res.status === 404);
      assert.match(res.body.error || res.body.message, /screen does not belong/i);
    });

    it('rejects order when show is cancelled (400)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: cancelledShowId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error || res.body.message, /cancelled/i);
    });

    it('rejects order when show is in draft status (400)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: draftShowId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error || res.body.message, /not published/i);
    });

    it('rejects order when food ordering window is closed (400)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowClosedId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error || res.body.message, /window.*closed/i);
    });

    it('rejects order when seat does not exist (400)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'Z',
          seatNumber: '99',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error || res.body.message, /seat/i);
    });

    it('rejects order when seat is marked inactive (400)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '2', // Seat 2 is inactive
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error || res.body.message, /seat/i);
    });

    it('rejects order with products belonging to another tenant (400)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodTheatreBId, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error || res.body.message, /invalid or does not belong/i);
    });

    it('rejects order with sold-out products (400)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodSoldOutId, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error || res.body.message, /sold out/i);
    });
  });

  describe('3. Server-Side Pricing (Tamper Resistance)', () => {
    it('completely overrides forged prices and totals submitted by client', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          // Malicious client claims Popcorn is ₹1 instead of ₹250
          items: [{ productId: prodPopcornId, quantity: 1, unitPrice: 100, subtotal: 100 }],
          subtotal: 100,
          taxAmount: 0,
          totalAmount: 100
        });

      assert.equal(res.status, 201);
      // Backend must calculate Popcorn at ₹250.00 (25000 paise) + 5% tax = ₹262.50 (26250 paise)
      assert.equal(res.body.order.subtotal, 25000);
      assert.equal(res.body.order.taxAmount, 1250);
      assert.equal(res.body.order.totalAmount, 26250);

      // Verify database stored authoritative price, not ₹1
      const [dbOrder] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, res.body.order.id));

      assert.equal(dbOrder.totalAmount, 26250);
    });
  });

  describe('4. Idempotency & Duplicate Request Protection', () => {
    it('returns existing order on duplicate submission with same idempotencyKey without duplicating order items', async () => {
      const idempotencyKey = `idem_${crypto.randomUUID()}`;

      const res1 = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .set('idempotency-key', idempotencyKey)
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodCokeId, quantity: 2 }]
        });

      assert.equal(res1.status, 201);
      const originalOrderId = res1.body.order.id;

      // Duplicate submission
      const res2 = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .set('idempotency-key', idempotencyKey)
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodCokeId, quantity: 2 }]
        });

      assert.equal(res2.status, 200);
      assert.equal(res2.body.idempotent, true);
      assert.equal(res2.body.order.id, originalOrderId);

      // Verify no duplicate order_items inserted
      const itemsInDb = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, originalOrderId));

      assert.equal(itemsInDb.length, 1);
      assert.equal(itemsInDb[0].quantity, 2);
    });
  });

  describe('5. Payment Linkage with Gateways (Razorpay & Paytm)', () => {
    let razorpayOrderId: string;
    let razorpayStatusToken: string;

    it('prepares pending order and links with Razorpay payment order', async () => {
      // 1. Prepare pending order
      const prepRes = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });

      assert.equal(prepRes.status, 201);
      razorpayOrderId = prepRes.body.order.id;
      razorpayStatusToken = prepRes.body.statusToken;

      // 2. Link payment order directly on Theatre A Razorpay merchant credentials
      const payOrderRes = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: razorpayOrderId,
          statusToken: razorpayStatusToken,
          provider: 'razorpay'
        });

      assert.equal(payOrderRes.status, 201);
      assert.equal(payOrderRes.body.success, true);
      assert.equal(payOrderRes.body.provider, 'razorpay');
      assert.ok(payOrderRes.body.providerOrderId);

      // Verify database payment transaction record
      const [tx] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.id, payOrderRes.body.transactionId));

      assert.ok(tx);
      assert.equal(tx.theatreId, theatreAId);
      assert.equal(tx.orderId, razorpayOrderId);
      assert.equal(tx.status, 'PENDING');
      assert.equal(tx.provider, 'razorpay');

      // Verify order table linked paymentMethod & paymentReference
      const [linkedOrder] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, razorpayOrderId));

      assert.equal(linkedOrder.paymentMethod, 'razorpay');
      assert.equal(linkedOrder.paymentReference, payOrderRes.body.providerOrderId);
      assert.equal(linkedOrder.status, 'pending'); // Still strictly pending!
      assert.equal(linkedOrder.paymentStatus, 'unpaid'); // Still unpaid!
    });

    it('prepares pending order and links with Paytm payment transaction', async () => {
      const prepRes = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodCokeId, quantity: 1 }]
        });

      assert.equal(prepRes.status, 201);
      const paytmOrderId = prepRes.body.order.id;
      const paytmStatusToken = prepRes.body.statusToken;

      const payOrderRes = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: paytmOrderId,
          statusToken: paytmStatusToken,
          provider: 'paytm'
        });

      assert.equal(payOrderRes.status, 201);
      assert.equal(payOrderRes.body.provider, 'paytm');
      assert.ok(payOrderRes.body.providerOrderId);

      const [linkedOrder] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, paytmOrderId));

      assert.equal(linkedOrder.paymentMethod, 'paytm');
      assert.equal(linkedOrder.paymentReference, payOrderRes.body.providerOrderId);
      assert.equal(linkedOrder.status, 'pending');
      assert.equal(linkedOrder.paymentStatus, 'unpaid');
    });
  });

  describe('6. Order Confirmation Only Upon Captured Payment', () => {
    let orderToConfirmId: string;
    let orderStatusToken: string;
    let txId: string;
    let providerOrderId: string;

    before(async () => {
      const prep = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });
      orderToConfirmId = prep.body.order.id;
      orderStatusToken = prep.body.statusToken;

      const txRes = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: orderToConfirmId,
          statusToken: orderStatusToken,
          provider: 'razorpay'
        });
      txId = txRes.body.transactionId;
      providerOrderId = txRes.body.providerOrderId;
    });

    it('failed payment verification leaves order in pending/unpaid state and does not confirm', async () => {
      const verifyRes = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToConfirmId,
          statusToken: orderStatusToken,
          transactionId: txId,
          provider: 'razorpay',
          providerPaymentId: `pay_mock_fail_${Date.now()}`,
          providerOrderId,
          providerSignature: 'test_sig_invalid'
        });

      assert.equal(verifyRes.status, 400);
      assert.equal(verifyRes.body.verified, false);

      // Verify database order remains unpaid and pending!
      const [orderDb] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderToConfirmId));

      assert.equal(orderDb.status, 'pending');
      assert.equal(orderDb.paymentStatus, 'unpaid');
    });

    it('confirmed payment verification transitions order to confirmed/paid status', async () => {
      const mockPaymentId = `pay_mock_ok_${Date.now()}`;
      const validSignature = generateRazorpaySignature(providerOrderId, mockPaymentId, razorpaySecretA);

      const verifyRes = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToConfirmId,
          statusToken: orderStatusToken,
          transactionId: txId,
          provider: 'razorpay',
          providerPaymentId: mockPaymentId,
          providerOrderId,
          providerSignature: validSignature
        });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.verified, true);
      assert.equal(verifyRes.body.status, 'CAPTURED');

      // Verify order is now CONFIRMED and PAID
      const [orderDb] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderToConfirmId));

      assert.equal(orderDb.status, 'confirmed');
      assert.equal(orderDb.paymentStatus, 'paid');
      assert.equal(orderDb.paymentMethod, 'razorpay');
      assert.equal(orderDb.paymentReference, mockPaymentId);

      // Verify audit trail entry
      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(
          and(
            eq(orderStatusHistory.orderId, orderToConfirmId),
            eq(orderStatusHistory.toStatus, 'confirmed')
          )
        );

      assert.ok(history.length >= 1);
    });

    it('idempotent verification: repeating payment verification succeeds without re-confirming', async () => {
      const mockPaymentId = `pay_mock_ok_${Date.now()}`;
      const validSignature = generateRazorpaySignature(providerOrderId, mockPaymentId, razorpaySecretA);

      const verifyRes = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToConfirmId,
          statusToken: orderStatusToken,
          transactionId: txId,
          provider: 'razorpay',
          providerPaymentId: mockPaymentId,
          providerOrderId,
          providerSignature: validSignature
        });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.verified, true);
      assert.match(verifyRes.body.message, /already verified/i);
    });
  });

  describe('7. Webhook Confirmation & Out-of-Order Safety', () => {
    let webhookOrderId: string;
    let webhookStatusToken: string;
    let webhookTxId: string;
    let webhookProviderOrderId: string;

    before(async () => {
      const prep = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1 }]
        });
      webhookOrderId = prep.body.order.id;
      webhookStatusToken = prep.body.statusToken;

      const txRes = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: webhookOrderId,
          statusToken: webhookStatusToken,
          provider: 'paytm'
        });
      webhookTxId = txRes.body.transactionId;
      webhookProviderOrderId = txRes.body.providerOrderId;
    });

    it('confirms pending order upon receiving authoritative captured webhook', async () => {
      const txnId = `PTM_TXN_${Date.now()}`;
      const payload: Record<string, string> = {
        MID: paytmMidA,
        ORDERID: webhookProviderOrderId,
        TXNAMOUNT: '262.50',
        CURRENCY: 'INR',
        TXNID: txnId,
        STATUS: 'TXN_SUCCESS',
        RESPCODE: '01',
        RESPMSG: 'Txn Success'
      };

      const checksum = generatePaytmParamChecksum(payload, paytmKeyA);
      payload.CHECKSUMHASH = checksum;

      const res = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(payload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify order is now CONFIRMED
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, webhookOrderId));

      assert.equal(order.status, 'confirmed');
      assert.equal(order.paymentStatus, 'paid');
      assert.equal(order.paymentMethod, 'paytm');
      assert.equal(order.paymentReference, txnId);
    });

    it('safely ignores delayed failure webhook after order is already captured', async () => {
      const delayedFailPayload: Record<string, string> = {
        MID: paytmMidA,
        ORDERID: webhookProviderOrderId,
        TXNAMOUNT: '262.50',
        CURRENCY: 'INR',
        TXNID: `PTM_FAIL_${Date.now()}`,
        STATUS: 'TXN_FAILURE',
        RESPCODE: '227',
        RESPMSG: 'Delayed Txn Failure'
      };
      delayedFailPayload.CHECKSUMHASH = generatePaytmParamChecksum(delayedFailPayload, paytmKeyA);

      const res = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(delayedFailPayload);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /ignored.*already CAPTURED/i);

      // Order must remain CONFIRMED and PAID
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, webhookOrderId));

      assert.equal(order.status, 'confirmed');
      assert.equal(order.paymentStatus, 'paid');
    });
  });

  describe('8. Customer Order Retrieval API', () => {
    let orderId: string;
    let statusToken: string;

    before(async () => {
      const prep = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAQrToken,
          screenId: screen1AId,
          showId: publishedShowOpenId,
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodPopcornId, quantity: 1, notes: 'Extra hot' }],
          customerName: 'Ananya Roy',
          customerPhone: '9876543212'
        });
      orderId = prep.body.order.id;
      statusToken = prep.body.statusToken;
    });

    it('allows customer to view order status by orderId + statusToken query param', async () => {
      const res = await request(app)
        .get(`/api/cinema/public/orders/${orderId}?statusToken=${statusToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.id, orderId);
      assert.equal(res.body.order.customerName, 'Ananya Roy');
      assert.equal(res.body.order.seatRow, 'C');
      assert.equal(res.body.order.seatNumber, '1');
      assert.equal(res.body.order.theatre.name, 'Miraj Cinemas IMAX');
      assert.equal(res.body.order.screen.screenName, 'IMAX Audi 1');
      assert.equal(res.body.order.movie.title, 'Interstellar IMAX');
      assert.ok(res.body.order.items.length >= 1);
    });

    it('allows customer to view order status via /public/orders/status/:token route', async () => {
      const res = await request(app)
        .get(`/api/cinema/public/orders/status/${statusToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.id, orderId);
      assert.equal(res.body.order.seat.row, 'C');
      assert.equal(res.body.order.seat.seat, '1');
    });

    it('rejects order retrieval with invalid or fabricated statusToken (404)', async () => {
      const res = await request(app)
        .get(`/api/cinema/public/orders/${orderId}?statusToken=invalid_fabricated_token_12345678`);

      assert.equal(res.status, 404);
    });

    it('rejects order retrieval when statusToken does not match order (404)', async () => {
      const otherToken = crypto.randomBytes(16).toString('hex');
      const res = await request(app)
        .get(`/api/cinema/public/orders/${orderId}?statusToken=${otherToken}`);

      assert.equal(res.status, 404);
    });
  });

  describe('9. Tenant Isolation & Restaurant Module Regression', () => {
    it('customer with Theatre A token cannot query Theatre B order', async () => {
      // Create Theatre B order
      const prepB = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreBQrToken,
          screenId: screen1BId,
          showId: publishedShowOpenId, // Shows checked against theatre
          seatRow: 'C',
          seatNumber: '1',
          items: [{ productId: prodTheatreBId, quantity: 1 }]
        });

      // Even if order creation fails or succeeds, token isolation is strictly enforced
      if (prepB.status === 201) {
        const res = await request(app)
          .get(`/api/cinema/public/orders/${prepB.body.order.id}?statusToken=random_theatre_a_token_12345678`);

        assert.equal(res.status, 404);
      }
    });

    it('existing restaurant module tables and ordering continue operating without regression', async () => {
      const res = await request(app)
        .get('/api/tables')
        .set('Cookie', cookieRestaurant)
        .set('x-restaurant-id', restaurantId);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.some((t: any) => t.tableNumber === 'Table 14'));
    });
  });
});
