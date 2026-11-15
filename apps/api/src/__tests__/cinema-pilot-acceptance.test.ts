process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'node:crypto';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  pool,
  restaurants,
  cinemaProfiles,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  cinemaQrCodes,
  cinemaPaymentAccounts,
  cinemaPaymentTransactions,
  cinemaWebhookEvents,
  orders,
  orderItems,
  orderStatusHistory,
  user,
  session,
  restaurantMembers,
  restaurantTables,
  categories,
  products
} from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import { generateRazorpaySignature } from '../lib/payment/razorpay.adapter';
import { generatePaytmSignature, generatePaytmParamChecksum } from '../lib/payment/paytm.adapter';

describe('Task 23: Complete Cinema Pilot Acceptance Workflow (End-to-End)', () => {
  const runId = Date.now();
  const createdUsersToClean: string[] = [];
  const createdTheatresToClean: string[] = [];

  // Theatre Admin
  let adminUserId: string;
  let adminCookie: string;
  let theatreId: string;
  let theatreSlug: string;
  let theatreQrToken: string;

  // Screens
  let screen1Id: string;
  let screen2Id: string;
  let screen1QrToken: string;

  // Seating
  let rowAId: string;
  let seatA4Id: string;

  // Movie & Show
  let movieId: string;
  let showId: string;

  // Food Menu
  let categoryId: string;
  let prodPopcornId: string;
  let prodCokeId: string;

  // Gateways
  const razorpayKeySecret = `mock_rzp_secret_${runId}`;
  const paytmMerchantKey = `mock_paytm_key_${runId}`;

  // Customer Order & Payment
  let cinemaOrderId: string;
  let orderStatusToken: string;
  let transactionId: string;
  let razorpayProviderOrderId: string;

  // Operational Staff
  let kitchenUserId: string;
  let kitchenCookie: string;
  let deliveryUserId: string;
  let deliveryCookie: string;

  // Concurrent Restaurant
  let restaurantId: string;
  let restaurantTableId: string;
  let restaurantProductId: string;

  before(async () => {});

  after(async () => {
    if (createdTheatresToClean.length > 0) {
      await db.delete(orderStatusHistory);
      await db.delete(orderItems);
      await db.delete(orders).where(inArray(orders.restaurantId, createdTheatresToClean));
      await db.delete(cinemaWebhookEvents).where(inArray(cinemaWebhookEvents.theatreId, createdTheatresToClean));
      await db.delete(cinemaPaymentTransactions).where(inArray(cinemaPaymentTransactions.theatreId, createdTheatresToClean));
      await db.delete(cinemaPaymentAccounts).where(inArray(cinemaPaymentAccounts.theatreId, createdTheatresToClean));
      await db.delete(cinemaQrCodes).where(inArray(cinemaQrCodes.theatreId, createdTheatresToClean));
      await db.delete(cinemaShows).where(inArray(cinemaShows.theatreId, createdTheatresToClean));
      await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, createdTheatresToClean));
      await db.delete(cinemaSeats);
      await db.delete(cinemaRows);
      await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, createdTheatresToClean));
      await db.delete(products).where(inArray(products.restaurantId, createdTheatresToClean));
      await db.delete(categories).where(inArray(categories.restaurantId, createdTheatresToClean));
      await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatresToClean));
      await db.delete(restaurantTables).where(inArray(restaurantTables.restaurantId, createdTheatresToClean));
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatresToClean));
      await db.delete(restaurants).where(inArray(restaurants.id, createdTheatresToClean));
    }

    if (createdUsersToClean.length > 0) {
      await db.delete(session).where(inArray(session.userId, createdUsersToClean));
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }
  });

  // ===========================================================================
  // Step 1: Theatre Administrator Registers on MenuGo
  // ===========================================================================
  it('Step 1: Theatre administrator registers on MenuGo', async () => {
    const adminEmail = `pilot-admin-${runId}@menugocinema.test`;
    const signupRes = await auth.api.signUpEmail({
      body: {
        name: 'PVR General Manager',
        email: adminEmail,
        password: 'PilotPassword123!'
      },
      asResponse: true
    });

    assert.equal(signupRes.status, 200);
    adminCookie = signupRes.headers.get('set-cookie')?.split(';')[0] || '';
    const body = await signupRes.json();
    adminUserId = body.user.id;
    createdUsersToClean.push(adminUserId);
    assert.ok(adminUserId);
  });

  // ===========================================================================
  // Step 2: Administrator Creates Theatre Profile
  // ===========================================================================
  it('Step 2: Administrator creates a theatre profile', async () => {
    const res = await request(app)
      .post('/api/cinema/theatres')
      .set('Cookie', adminCookie)
      .send({
        theatreName: `PVR ICON Grand IMAX ${runId}`,
        city: 'Bengaluru',
        state: 'Karnataka',
        contactNumber: '9876543210',
        contactEmail: `contact-${runId}@pvr.test`,
        businessDetails: 'GSTIN: 29PILOTTEST1Z9',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      });

    assert.equal(res.status, 201);
    theatreId = res.body.theatre?.id || res.body.theatreId;
    theatreSlug = res.body.theatre?.slug || res.body.theatreSlug;
    createdTheatresToClean.push(theatreId);
    assert.ok(theatreId);
    assert.ok(theatreSlug);

    // Verify tenant record
    const [theatre] = await db.select().from(restaurants).where(eq(restaurants.id, theatreId));
    assert.ok(theatre);
    assert.equal(theatre.tenantType, 'cinema');
  });

  // ===========================================================================
  // Step 3: Administrator Adds Multiple Screens
  // ===========================================================================
  it('Step 3: Administrator adds multiple screens (Screen 1 & Screen 2)', async () => {
    // Screen 1: IMAX
    const res1 = await request(app)
      .post('/api/cinema/screens')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        screenName: 'Screen 1 - IMAX with Laser',
        screenType: 'imax',
        description: 'Commercial 4K Laser Projection with 12-Channel Immersive Audio',
        status: 'active'
      });

    assert.equal(res1.status, 201);
    screen1Id = res1.body.screen.id;
    assert.ok(screen1Id);

    // Screen 2: Dolby Atmos
    const res2 = await request(app)
      .post('/api/cinema/screens')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        screenName: 'Screen 2 - Dolby Atmos Premium',
        screenType: 'standard',
        description: 'Dolby 7.1 Surround Sound with 4K Christie Digital Projection',
        status: 'active'
      });

    assert.equal(res2.status, 201);
    screen2Id = res2.body.screen.id;
    assert.ok(screen2Id);
  });

  // ===========================================================================
  // Step 4: Administrator Configures Seating Rows and Individual Seats
  // ===========================================================================
  it('Step 4: Administrator configures seating rows and individual seats for Screen 1', async () => {
    const res = await request(app)
      .post(`/api/cinema/screens/${screen1Id}/rows`)
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        rowIdentifier: 'A',
        seatTier: 'premium',
        startSeatNumber: 1,
        endSeatNumber: 10
      });

    assert.equal(res.status, 201);
    rowAId = res.body.row.id;
    assert.ok(rowAId);
    assert.ok(Array.isArray(res.body.seats));
    assert.equal(res.body.seats.length, 10);

    const seat4 = res.body.seats.find((s: any) => s.seatNumber === 4);
    assert.ok(seat4);
    seatA4Id = seat4.id;
    assert.ok(seatA4Id);
  });

  // ===========================================================================
  // Step 5: Administrator Creates Movies
  // ===========================================================================
  it('Step 5: Administrator creates movies in the catalogue', async () => {
    const res = await request(app)
      .post('/api/cinema/movies')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        title: 'Gladiator II: Pilot Release',
        durationMinutes: 148,
        language: 'English',
        censorRating: 'U/A',
        isActive: true
      });

    assert.equal(res.status, 201);
    movieId = res.body.movie.id;
    assert.ok(movieId);
  });

  // ===========================================================================
  // Step 6: Administrator Creates and Publishes Daily Show Schedules
  // ===========================================================================
  it('Step 6: Administrator schedules and publishes a daily show with ordering window', async () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startTime = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const expectedEndTime = new Date(now.getTime() + 120 * 60 * 1000).toISOString();
    const orderingStartTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const orderingEndTime = new Date(now.getTime() + 90 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/cinema/shows')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        screenId: screen1Id,
        movieId,
        showDate: today,
        startTime,
        expectedEndTime,
        orderingStartTime,
        orderingEndTime,
        isPublished: true
      });

    assert.equal(res.status, 201);
    showId = res.body.show.id;
    assert.ok(showId);

    // Publish show
    const pubRes = await request(app)
      .post(`/api/cinema/shows/${showId}/publish`)
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId);
    assert.equal(pubRes.status, 200);
    assert.equal(pubRes.body.show.status, 'published');
  });

  // ===========================================================================
  // Step 7: Administrator Configures Food Categories and Products
  // ===========================================================================
  it('Step 7: Administrator configures food categories and available concessions', async () => {
    // Category
    const catRes = await request(app)
      .post('/api/categories')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        name: 'Cinema Concessions',
        sortOrder: 1
      });

    assert.equal(catRes.status, 201);
    categoryId = catRes.body.id;

    // Popcorn
    const prod1Res = await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        categoryId,
        name: 'Jumbo Caramel Popcorn',
        description: 'Crunchy golden caramel gourmet popcorn',
        price: 32000, // ₹320.00
        isAvailable: true
      });

    assert.equal(prod1Res.status, 201);
    prodPopcornId = prod1Res.body.id;

    // Coke
    const prod2Res = await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        categoryId,
        name: 'Large Fountain Coke',
        description: 'Chilled 750ml draught cola',
        price: 15000, // ₹150.00
        isAvailable: true
      });

    assert.equal(prod2Res.status, 201);
    prodCokeId = prod2Res.body.id;
  });

  // ===========================================================================
  // Step 8: Administrator Connects Razorpay & Paytm Merchant Accounts
  // ===========================================================================
  it('Step 8: Administrator connects eligible Razorpay and Paytm test merchant accounts', async () => {
    // Connect Razorpay
    const rzpRes = await request(app)
      .post('/api/cinema/payments/configure')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        provider: 'razorpay',
        environment: 'test',
        keyId: `rzp_test_pilot_${runId}`,
        keySecret: razorpayKeySecret,
        webhookSecret: `whsec_pilot_${runId}`,
        settings: {
          themeColor: '#E11D48',
          displayName: 'PVR ICON Grand'
        }
      });

    assert.equal(rzpRes.status, 200);
    assert.equal(rzpRes.body.account.isVerified, true);
    assert.equal(rzpRes.body.account.keySecret, undefined); // Masked

    // Connect Paytm
    const paytmRes = await request(app)
      .post('/api/cinema/payments/configure')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId)
      .send({
        provider: 'paytm',
        environment: 'test',
        keyId: `TEST_PILOT_MID_${runId}`,
        keySecret: paytmMerchantKey,
        settings: {
          websiteName: 'WEBSTAGING',
          channelId: 'WAP',
          industryTypeId: 'Retail'
        }
      });

    assert.equal(paytmRes.status, 200);
    assert.equal(paytmRes.body.account.isVerified, true);
  });

  // ===========================================================================
  // Step 9: Administrator Generates and Downloads Theatre and Screen QR Codes
  // ===========================================================================
  it('Step 9: Administrator generates and downloads theatre or screen QR codes', async () => {
    // Theatre QR
    const qrRes = await request(app)
      .post('/api/cinema/qr/theatre')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(qrRes.status, 201);
    theatreQrToken = qrRes.body.qrCode.token;
    assert.ok(theatreQrToken);
    assert.ok(qrRes.body.qrCode.qrCodeData);

    // Screen QR
    const screenQrRes = await request(app)
      .post(`/api/cinema/qr/screens/${screen1Id}`)
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(screenQrRes.status, 201);
    screen1QrToken = screenQrRes.body.qrCode.token;
    assert.ok(screen1QrToken);
  });

  // ===========================================================================
  // Step 10: Customer Scans the QR Code
  // ===========================================================================
  it('Step 10: Customer scans the QR code and resolves public theatre context', async () => {
    const res = await request(app).get(`/api/cinema/public/resolve/${theatreQrToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.theatre.name, `PVR ICON Grand IMAX ${runId}`);
    assert.equal(res.body.screens.length, 2);
  });

  // ===========================================================================
  // Step 11: Customer Selects a Screen
  // ===========================================================================
  it('Step 11: Customer scans/selects Screen 1 and verifies preselected auditorium', async () => {
    const res = await request(app).get(`/api/cinema/public/resolve/${theatreQrToken}/${screen1QrToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.selectedScreen.screenId, screen1Id);
    assert.equal(res.body.selectedScreen.screenName, 'Screen 1 - IMAX with Laser');
  });

  // ===========================================================================
  // Steps 12 & 13: Customer Receives Published Showtimes and Selects Show
  // ===========================================================================
  it('Steps 12 & 13: Customer receives correct published showtimes from backend and selects showtime', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/cinema/public/shows/${theatreQrToken}?screenId=${screen1Id}&date=${today}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.shows));
    const show = res.body.shows.find((s: any) => (s.showId || s.id) === showId);
    assert.ok(show);
    assert.equal(show.movieTitle, 'Gladiator II: Pilot Release');
  });

  // ===========================================================================
  // Step 14: Customer Selects Valid Row and Seat
  // ===========================================================================
  it('Step 14: Customer selects valid row and seat (Row A, Seat 4)', async () => {
    const res = await request(app)
      .get(`/api/cinema/public/seating/${theatreQrToken}/${screen1Id}`);

    assert.equal(res.status, 200);
    const rowA = res.body.rows.find((r: any) => r.rowIdentifier === 'A');
    assert.ok(rowA);
    const seat4 = rowA.seats.find((s: any) => s.seatIdentifier === 'A4' || s.seatNumber === 4);
    assert.ok(seat4);
    assert.equal(seat4.status, 'active');
  });

  // ===========================================================================
  // Step 15 & 16: Customer Browses Food Menu and Adds Products to Cart
  // ===========================================================================
  it('Steps 15 & 16: Customer browses available products and adds to cart', async () => {
    const menuRes = await request(app).get(`/api/cinema/public/menu/${theatreQrToken}`);
    assert.equal(menuRes.status, 200);
    assert.ok(menuRes.body.categories.length > 0);
    assert.ok(menuRes.body.products.length >= 2);

    const popcorn = menuRes.body.products.find((p: any) => p.id === prodPopcornId);
    const coke = menuRes.body.products.find((p: any) => p.id === prodCokeId);
    assert.equal(popcorn.price, 32000);
    assert.equal(coke.price, 15000);
  });

  // ===========================================================================
  // Step 17: Customer Completes Checkout
  // ===========================================================================
  it('Step 17: Customer completes checkout with server-authoritative pricing (₹620 + 5% GST = ₹651)', async () => {
    const idempotencyKey = `pilot-idem-${runId}`;
    const res = await request(app)
      .post('/api/cinema/public/checkout/prepare')
      .set('idempotency-key', idempotencyKey)
      .send({
        theatreToken: theatreQrToken,
        screenId: screen1Id,
        showId,
        seatRow: 'A',
        seatNumber: 'A4',
        items: [
          { productId: prodPopcornId, quantity: 1, unitPrice: 10 }, // Ignored
          { productId: prodCokeId, quantity: 2, unitPrice: 10 }     // Ignored
        ],
        customerName: 'Aarav Patel',
        customerPhone: '+919876543210',
        specialInstructions: 'Warm popcorn please'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.order.subtotal, 62000); // 32000 + 2*15000
    assert.equal(res.body.order.taxAmount, 3100); // 5% GST
    assert.equal(res.body.order.totalAmount, 65100);
    assert.equal(res.body.order.paymentStatus, 'unpaid');
    cinemaOrderId = res.body.order.id;
    orderStatusToken = res.body.statusToken || res.body.order.statusToken;
    assert.ok(cinemaOrderId);
    assert.ok(orderStatusToken);
  });

  // ===========================================================================
  // Step 18: Customer Completes Payment Using Theatre Gateway
  // ===========================================================================
  it('Step 18: Customer creates payment transaction using theatre Razorpay account', async () => {
    const res = await request(app)
      .post('/api/cinema/payments/order')
      .send({
        orderId: cinemaOrderId,
        statusToken: orderStatusToken,
        provider: 'razorpay'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.provider, 'razorpay');
    assert.equal(res.body.amount, 65100);
    assert.ok(res.body.providerOrderId);
    assert.ok(res.body.transactionId);
    razorpayProviderOrderId = res.body.providerOrderId;
    transactionId = res.body.transactionId;
  });

  // ===========================================================================
  // Step 19 & 20: MenuGo Verifies Payment on Server & Confirms Order
  // ===========================================================================
  it('Steps 19 & 20: Server cryptographically verifies payment and confirms order with PAID status', async () => {
    const providerPaymentId = `pay_mock_pilot_rzp_${runId}`;
    const signature = generateRazorpaySignature(
      razorpayProviderOrderId,
      providerPaymentId,
      razorpayKeySecret
    );

    const res = await request(app)
      .post('/api/cinema/payments/verify')
      .send({
        orderId: cinemaOrderId,
        statusToken: orderStatusToken,
        transactionId,
        provider: 'razorpay',
        providerOrderId: razorpayProviderOrderId,
        providerPaymentId,
        providerSignature: signature
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.verified, true);
    assert.equal(res.body.status, 'CAPTURED');

    // Customer can track status anonymously
    const trackRes = await request(app).get(`/api/orders/status/${orderStatusToken}`);
    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.status, 'confirmed');
    assert.equal(trackRes.body.totalAmount, 65100);
  });

  // ===========================================================================
  // Step 21: Kitchen Receives the Paid Order
  // ===========================================================================
  it('Step 21: Kitchen receives the paid order in the KDS queue', async () => {
    // Create Kitchen Staff
    const chefEmail = `pilot-chef-${runId}@menugocinema.test`;
    const chefRes = await auth.api.signUpEmail({
      body: {
        name: 'Chef Vikrant',
        email: chefEmail,
        password: 'PilotPassword123!'
      },
      asResponse: true
    });
    kitchenCookie = chefRes.headers.get('set-cookie')?.split(';')[0] || '';
    const chefJson = await chefRes.json();
    kitchenUserId = chefJson.user.id;
    createdUsersToClean.push(kitchenUserId);

    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      userId: kitchenUserId,
      role: 'kitchen'
    });

    const res = await request(app)
      .get('/api/cinema/kitchen/orders')
      .set('Cookie', kitchenCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(res.status, 200);
    const kdsOrder = res.body.orders.find((o: any) => o.id === cinemaOrderId);
    assert.ok(kdsOrder);
    assert.equal(kdsOrder.paymentStatus, 'paid');
    assert.equal(kdsOrder.seatRow, 'A');
    assert.equal(String(kdsOrder.seatNumber), 'A4');
    assert.equal(kdsOrder.items.length, 2);
  });

  // ===========================================================================
  // Steps 22 & 23: Kitchen Staff Accepts, Prepares, and Marks Ready
  // ===========================================================================
  it('Steps 22 & 23: Kitchen staff accepts, prepares, and marks order READY', async () => {
    // 1. Accept
    const acceptRes = await request(app)
      .post(`/api/cinema/kitchen/orders/${cinemaOrderId}/accept`)
      .set('Cookie', kitchenCookie)
      .set('x-theatre-id', theatreId);
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.order.status, 'accepted');

    // 2. Preparing
    const prepRes = await request(app)
      .post(`/api/cinema/kitchen/orders/${cinemaOrderId}/prepare`)
      .set('Cookie', kitchenCookie)
      .set('x-theatre-id', theatreId);
    assert.equal(prepRes.status, 200);
    assert.equal(prepRes.body.order.status, 'preparing');

    // 3. Ready
    const readyRes = await request(app)
      .post(`/api/cinema/kitchen/orders/${cinemaOrderId}/ready`)
      .set('Cookie', kitchenCookie)
      .set('x-theatre-id', theatreId);
    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.order.status, 'ready');
  });

  // ===========================================================================
  // Steps 24 & 25: Delivery Staff Receives Assignment and Delivers to Seat
  // ===========================================================================
  it('Steps 24 & 25: Delivery staff receives assignment and delivers food to Screen 1, Seat A4', async () => {
    // Create Delivery Staff
    const runnerEmail = `pilot-runner-${runId}@menugocinema.test`;
    const runnerRes = await auth.api.signUpEmail({
      body: {
        name: 'Runner Suresh',
        email: runnerEmail,
        password: 'PilotPassword123!'
      },
      asResponse: true
    });
    deliveryCookie = runnerRes.headers.get('set-cookie')?.split(';')[0] || '';
    const runnerJson = await runnerRes.json();
    deliveryUserId = runnerJson.user.id;
    createdUsersToClean.push(deliveryUserId);

    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      userId: deliveryUserId,
      role: 'staff'
    });

    // Accept Delivery Assignment
    const assignRes = await request(app)
      .post(`/api/cinema/delivery/orders/${cinemaOrderId}/assign`)
      .set('Cookie', deliveryCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(assignRes.status, 200);
    assert.equal(assignRes.body.order.status, 'assigned_for_delivery');
    assert.equal(assignRes.body.order.deliveryStaffName, 'Runner Suresh');

    // Mark Delivered at Screen 1, Seat A4
    const deliverRes = await request(app)
      .post(`/api/cinema/delivery/orders/${cinemaOrderId}/deliver`)
      .set('Cookie', deliveryCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(deliverRes.status, 200);
    assert.equal(deliverRes.body.order.status, 'delivered');
    assert.equal(deliverRes.body.order.deliveryStatus, 'delivered');
    assert.equal(deliverRes.body.order.seatRow, 'A');
    assert.equal(String(deliverRes.body.order.seatNumber), 'A4');
    assert.ok(deliverRes.body.order.deliveredAt);
  });

  // ===========================================================================
  // Step 26: Administrator Views Order and Payment Records
  // ===========================================================================
  it('Step 26: Administrator views order and payment audit records', async () => {
    const res = await request(app)
      .get(`/api/cinema/orders/${cinemaOrderId}`)
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(res.status, 200);
    const o = res.body.order;
    assert.equal(o.id, cinemaOrderId);
    assert.equal(o.status, 'delivered');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.totalAmount, 65100);
    assert.equal(o.seatRow, 'A');
    assert.equal(String(o.seatNumber), 'A4');
    assert.equal(o.delivery.deliveryStatus, 'delivered');
    assert.equal(o.delivery.deliveryStaffName, 'Runner Suresh');
    assert.ok(o.paymentTransaction);
    assert.equal(o.paymentTransaction.provider, 'razorpay');
    assert.equal(o.paymentTransaction.status, 'CAPTURED');
    assert.equal(o.paymentTransaction.amount, 65100);
  });

  // ===========================================================================
  // Step 27: Administrator Views Daily Cinema Sales Reports
  // ===========================================================================
  it('Step 27: Administrator views daily cinema sales reports', async () => {
    const res = await request(app)
      .get('/api/cinema/reports/summary?dateRange=all')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(res.status, 200);
    assert.equal(res.body.summary.totalOrders, 1);
    assert.equal(res.body.summary.deliveredOrders, 1);

    // Screen-wise breakdown
    const screenRes = await request(app)
      .get('/api/cinema/reports/screens?dateRange=all')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(screenRes.status, 200);
    const s1 = screenRes.body.screenReports.find((s: any) => s.screenId === screen1Id);
    assert.ok(s1);
    assert.equal(s1.totalOrders, 1);
    assert.equal(s1.grossSales, 65100);
    assert.equal(s1.netSales, 65100);
  });

  // ===========================================================================
  // Step 28: Existing Restaurant Functionality Continues Working
  // ===========================================================================
  it('Step 28: Existing restaurant functionality continues working without regression', async () => {
    // Create restaurant
    restaurantId = crypto.randomUUID();
    createdTheatresToClean.push(restaurantId);

    const [restaurant] = await db
      .insert(restaurants)
      .values({
        id: restaurantId,
        name: 'The Royal Bistro',
        slug: `royal-bistro-${runId}`,
        tenantType: 'restaurant',
        currency: 'INR',
        isActive: true
      })
      .returning();

    assert.ok(restaurant);
    assert.equal(restaurant.tenantType, 'restaurant');

    // Create Table
    restaurantTableId = crypto.randomUUID();
    const tableToken = crypto.randomBytes(16).toString('hex');
    await db.insert(restaurantTables).values({
      id: restaurantTableId,
      restaurantId,
      tableNumber: 'T-10',
      tableToken,
      capacity: 4,
      isActive: true
    });

    // Create Restaurant Product
    restaurantProductId = crypto.randomUUID();
    await db.insert(products).values({
      id: restaurantProductId,
      restaurantId,
      name: 'Paneer Butter Masala',
      price: 28000,
      isAvailable: true
    });

    // Place Restaurant Dine-in Order
    const restOrderRes = await request(app)
      .post('/api/orders')
      .send({
        restaurantSlug: restaurant.slug,
        tableToken,
        items: [{ productId: restaurantProductId, quantity: 1 }],
        customerName: 'Dine-In Guest'
      });

    assert.equal(restOrderRes.status, 201);
    const restOrderId = restOrderRes.body.order.id;
    assert.ok(restOrderId);

    // Verify Strict Tenant & Module Isolation:
    // Cinema admin cannot see restaurant order
    const cinemaOrdersRes = await request(app)
      .get('/api/cinema/orders')
      .set('Cookie', adminCookie)
      .set('x-theatre-id', theatreId);

    assert.equal(cinemaOrdersRes.status, 200);
    const leaked = cinemaOrdersRes.body.orders.some((o: any) => o.id === restOrderId);
    assert.equal(leaked, false, 'Restaurant order must never leak into Cinema admin order management');
  });
});
