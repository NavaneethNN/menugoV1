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
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  cinemaPaymentTransactions,
  cinemaRefunds,
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';
import { setRealtimeProvider, RealtimeProvider } from '../lib/realtime';

process.env.NODE_ENV = 'test';

describe('Task 17: Cinema Admin Order Management & Visibility', () => {
  let userCinemaAOwnerId: string;
  let userCinemaAStaffId: string;
  let userCinemaBOwnerId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaAOwner: string;
  let cookieCinemaAStaff: string;
  let cookieCinemaBOwner: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let screenA1Id: string;
  let screenA2Id: string;
  let movieAId: string;
  let showA1Id: string;
  let popcornProductId: string;
  let sodaProductId: string;

  let orderA1NewId: string;
  let orderA2PreparingId: string;
  let orderA3ReadyId: string;
  let orderA4DeliveredId: string;
  let orderA5CancelledId: string;
  let orderBPaidId: string;

  let paymentTransId: string;
  let refundRecordId: string;

  const timestamp = Date.now();
  const createdUsersToClean: string[] = [];
  const publishedRealtimeEvents: { channel: string; event: string; payload: any }[] = [];

  const mockRealtime: RealtimeProvider = {
    async publishToRestaurant(restId, event, payload) {
      publishedRealtimeEvents.push({ channel: `restaurant:${restId}`, event, payload });
    },
    async publishToOrder(token, event, payload) {
      publishedRealtimeEvents.push({ channel: `order:${token}`, event, payload });
    }
  };

  before(async () => {
    setRealtimeProvider(mockRealtime);

    // 1. Create Cinema A Owner User
    const ownerAEmail = `theatreA.admin.${timestamp}@example.com`;
    const ownerARes = await auth.api.signUpEmail({
      body: { name: 'PVR Admin User', email: ownerAEmail, password: 'password123' }
    });
    userCinemaAOwnerId = ownerARes.user.id;
    createdUsersToClean.push(userCinemaAOwnerId);

    const signinAOwner = await auth.api.signInEmail({
      body: { email: ownerAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAOwner = signinAOwner.headers.get('set-cookie') || '';

    // 2. Create Cinema A Staff User (Kitchen/Staff role - non-admin)
    const staffAEmail = `theatreA.staff.${timestamp}@example.com`;
    const staffARes = await auth.api.signUpEmail({
      body: { name: 'PVR Runner Staff', email: staffAEmail, password: 'password123' }
    });
    userCinemaAStaffId = staffARes.user.id;
    createdUsersToClean.push(userCinemaAStaffId);

    const signinAStaff = await auth.api.signInEmail({
      body: { email: staffAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAStaff = signinAStaff.headers.get('set-cookie') || '';

    // 3. Create Cinema B Owner User (For Tenant Isolation)
    const ownerBEmail = `theatreB.admin.${timestamp}@example.com`;
    const ownerBRes = await auth.api.signUpEmail({
      body: { name: 'INOX Admin User', email: ownerBEmail, password: 'password123' }
    });
    userCinemaBOwnerId = ownerBRes.user.id;
    createdUsersToClean.push(userCinemaBOwnerId);

    const signinBOwner = await auth.api.signInEmail({
      body: { email: ownerBEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaBOwner = signinBOwner.headers.get('set-cookie') || '';

    // 4. Create Restaurant Owner User (For Cross-Tenant Security)
    const restEmail = `restaurant.owner.${timestamp}@example.com`;
    const restRes = await auth.api.signUpEmail({
      body: { name: 'Bistro Owner', email: restEmail, password: 'password123' }
    });
    userRestaurantOwnerId = restRes.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    const signinRest = await auth.api.signInEmail({
      body: { email: restEmail, password: 'password123' },
      asResponse: true
    });
    cookieRestaurantOwner = signinRest.headers.get('set-cookie') || '';

    // 5. Seed Restaurants & Memberships
    await db.insert(restaurants).values([
      {
        id: theatreAId,
        name: `PVR Cinemas Multiplex ${timestamp}`,
        slug: `pvr-cinemas-${timestamp}`,
        tenantType: 'cinema',
        currency: 'INR'
      },
      {
        id: theatreBId,
        name: `INOX Leisure ${timestamp}`,
        slug: `inox-leisure-${timestamp}`,
        tenantType: 'cinema',
        currency: 'INR'
      },
      {
        id: restaurantId,
        name: `Urban Bistro ${timestamp}`,
        slug: `urban-bistro-${timestamp}`,
        tenantType: 'restaurant',
        currency: 'INR'
      }
    ]);

    await db.insert(cinemaProfiles).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        theatreName: 'PVR Multiplex',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        contactNumber: '9876543210',
        contactEmail: 'contact@pvrmultiplex.com',
        onboardingStage: 'completed'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreBId,
        theatreName: 'INOX Leisure',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        contactNumber: '9123456789',
        contactEmail: 'contact@inoxleisure.com',
        onboardingStage: 'completed'
      }
    ]);

    await db.insert(restaurantMembers).values([
      {
        id: crypto.randomUUID(),
        restaurantId: theatreAId,
        userId: userCinemaAOwnerId,
        role: 'owner'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: theatreAId,
        userId: userCinemaAStaffId,
        role: 'staff'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: theatreBId,
        userId: userCinemaBOwnerId,
        role: 'owner'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: restaurantId,
        userId: userRestaurantOwnerId,
        role: 'owner'
      }
    ]);

    // 6. Seed Screens, Rows, Seats for Theatre A
    screenA1Id = crypto.randomUUID();
    screenA2Id = crypto.randomUUID();
    await db.insert(cinemaScreens).values([
      {
        id: screenA1Id,
        theatreId: theatreAId,
        screenName: 'Screen 1 IMAX',
        screenType: 'imax',
        totalRows: 1,
        totalSeats: 2,
        seatingConfigured: true
      },
      {
        id: screenA2Id,
        theatreId: theatreAId,
        screenName: 'Screen 2 Gold',
        screenType: 'gold_class',
        totalRows: 1,
        totalSeats: 2,
        seatingConfigured: true
      }
    ]);

    const rowA1Id = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowA1Id,
      theatreId: theatreAId,
      screenId: screenA1Id,
      rowIdentifier: 'E',
      sortOrder: 1,
      startSeatNumber: 10,
      endSeatNumber: 12,
      totalSeats: 3
    });

    await db.insert(cinemaSeats).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'E',
        seatNumber: 10,
        seatIdentifier: 'E10',
        seatCategory: 'standard',
        status: 'active'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'E',
        seatNumber: 11,
        seatIdentifier: 'E11',
        seatCategory: 'standard',
        status: 'active'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'E',
        seatNumber: 12,
        seatIdentifier: 'E12',
        seatCategory: 'standard',
        status: 'active'
      }
    ]);

    // 7. Seed Movie and Show
    movieAId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movieAId,
      theatreId: theatreAId,
      title: 'Oppenheimer Cinema Edit',
      language: 'English',
      durationMinutes: 180,
      status: 'active'
    });

    showA1Id = crypto.randomUUID();
    const today = new Date();
    const showDateStr = today.toISOString().split('T')[0]!;
    await db.insert(cinemaShows).values({
      id: showA1Id,
      theatreId: theatreAId,
      screenId: screenA1Id,
      movieId: movieAId,
      showDate: showDateStr,
      startTime: new Date(Date.now() - 30 * 60000), // Started 30 mins ago
      expectedEndTime: new Date(Date.now() + 150 * 60000),
      orderingStartTime: new Date(Date.now() - 60 * 60000),
      orderingEndTime: new Date(Date.now() + 120 * 60000),
      status: 'published'
    });

    // 8. Seed Products
    const catId = crypto.randomUUID();
    await db.insert(categories).values({
      id: catId,
      restaurantId: theatreAId,
      name: 'Cinema Snacks'
    });

    popcornProductId = crypto.randomUUID();
    sodaProductId = crypto.randomUUID();
    await db.insert(products).values([
      {
        id: popcornProductId,
        restaurantId: theatreAId,
        categoryId: catId,
        name: 'Tub Salted Popcorn',
        price: 35000, // 350 INR in paise
        isAvailable: true
      },
      {
        id: sodaProductId,
        restaurantId: theatreAId,
        categoryId: catId,
        name: 'Chilled Pepsi 500ml',
        price: 15000, // 150 INR in paise
        isAvailable: true
      }
    ]);

    // 9. Seed Orders with Various Lifecycle States in Theatre A
    // Order A1: NEW paid order
    orderA1NewId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA1NewId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-1001',
      orderType: 'cinema',
      status: 'new',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      paymentReference: 'pay_rzp_mock_1001',
      subtotal: 50000,
      taxAmount: 2500,
      totalAmount: 52500,
      screenId: screenA1Id,
      movieId: movieAId,
      showId: showA1Id,
      seatRow: 'E',
      seatNumber: '10',
      customerName: 'Ananya Sharma',
      customerPhone: '+919876543210',
      statusToken: 'tok_cin_1001_secure_key',
      deliveryStatus: 'unassigned',
      createdAt: new Date(Date.now() - 15 * 60000)
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA1NewId,
      productId: popcornProductId,
      productName: 'Tub Salted Popcorn',
      quantity: 1,
      unitPrice: 35000,
      subtotal: 35000
    });
    await db.insert(orderStatusHistory).values({
      id: crypto.randomUUID(),
      orderId: orderA1NewId,
      fromStatus: 'pending',
      toStatus: 'new',
      changedByRole: 'system',
      reason: 'Payment captured via Razorpay'
    });

    // Order A2: PREPARING paid order
    orderA2PreparingId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA2PreparingId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-1002',
      orderType: 'cinema',
      status: 'preparing',
      paymentStatus: 'paid',
      paymentMethod: 'paytm',
      paymentReference: 'pay_ptm_mock_1002',
      subtotal: 35000,
      taxAmount: 1750,
      totalAmount: 36750,
      screenId: screenA1Id,
      movieId: movieAId,
      showId: showA1Id,
      seatRow: 'E',
      seatNumber: '11',
      customerName: 'Vikram Mehta',
      customerPhone: '+919876543211',
      statusToken: 'tok_cin_1002_secure_key',
      deliveryStatus: 'unassigned',
      createdAt: new Date(Date.now() - 25 * 60000)
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA2PreparingId,
      productId: popcornProductId,
      productName: 'Tub Salted Popcorn',
      quantity: 1,
      unitPrice: 35000,
      subtotal: 35000
    });
    await db.insert(orderStatusHistory).values([
      {
        id: crypto.randomUUID(),
        orderId: orderA2PreparingId,
        fromStatus: 'new',
        toStatus: 'accepted',
        changedByRole: 'kitchen',
        reason: 'Kitchen acknowledged order'
      },
      {
        id: crypto.randomUUID(),
        orderId: orderA2PreparingId,
        fromStatus: 'accepted',
        toStatus: 'preparing',
        changedByRole: 'kitchen',
        reason: 'Preparation started'
      }
    ]);

    // Order A3: READY order with payment transaction record & refund record
    orderA3ReadyId = crypto.randomUUID();
    paymentTransId = crypto.randomUUID();
    refundRecordId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA3ReadyId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-1003',
      orderType: 'cinema',
      status: 'ready',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      paymentReference: 'pay_rzp_mock_1003',
      subtotal: 15000,
      taxAmount: 750,
      totalAmount: 15750,
      screenId: screenA1Id,
      movieId: movieAId,
      showId: showA1Id,
      seatRow: 'E',
      seatNumber: '12',
      customerName: 'Rohan Gupta',
      customerPhone: '+919876543212',
      statusToken: 'tok_cin_1003_secure_key',
      deliveryStatus: 'unassigned',
      createdAt: new Date(Date.now() - 35 * 60000)
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA3ReadyId,
      productId: sodaProductId,
      productName: 'Chilled Pepsi 500ml',
      quantity: 1,
      unitPrice: 15000,
      subtotal: 15000
    });
    await db.insert(cinemaPaymentTransactions).values({
      id: paymentTransId,
      theatreId: theatreAId,
      orderId: orderA3ReadyId,
      provider: 'razorpay',
      providerOrderId: 'order_rzp_mock_1003',
      providerPaymentId: 'pay_rzp_mock_1003',
      amount: 15750,
      currency: 'INR',
      status: 'captured'
    });
    await db.insert(cinemaRefunds).values({
      id: refundRecordId,
      theatreId: theatreAId,
      orderId: orderA3ReadyId,
      transactionId: paymentTransId,
      provider: 'razorpay',
      providerRefundId: 'rfnd_rzp_mock_1003',
      amount: 5000,
      status: 'REFUND_PROCESSED',
      initiatedBy: userCinemaAOwnerId,
      reason: 'Partial courtesy refund approved by admin'
    });

    // Order A4: DELIVERED order with staff attribution
    orderA4DeliveredId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA4DeliveredId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-1004',
      orderType: 'cinema',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      paymentReference: 'pay_rzp_mock_1004',
      subtotal: 35000,
      taxAmount: 1750,
      totalAmount: 36750,
      screenId: screenA1Id,
      movieId: movieAId,
      showId: showA1Id,
      seatRow: 'E',
      seatNumber: '10',
      customerName: 'Simran Kaur',
      customerPhone: '+919876543214',
      statusToken: 'tok_cin_1004_secure_key',
      deliveryStatus: 'delivered',
      deliveryStaffName: 'Rahul - Screen Runner',
      assignedAt: new Date(Date.now() - 20 * 60000),
      deliveredAt: new Date(Date.now() - 5 * 60000),
      createdAt: new Date(Date.now() - 50 * 60000)
    });

    // Order A5: CANCELLED order
    orderA5CancelledId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA5CancelledId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-1005',
      orderType: 'cinema',
      status: 'cancelled',
      paymentStatus: 'failed',
      paymentMethod: 'paytm',
      subtotal: 15000,
      taxAmount: 750,
      totalAmount: 15750,
      screenId: screenA1Id,
      movieId: movieAId,
      showId: showA1Id,
      seatRow: 'E',
      seatNumber: '11',
      customerName: 'Cancelled Guest',
      statusToken: 'tok_cin_1005_secure_key',
      createdAt: new Date(Date.now() - 60 * 60000)
    });

    // Order B: Cinema B order (for Tenant Isolation testing)
    orderBPaidId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderBPaidId,
      restaurantId: theatreBId,
      orderNumber: 'INOX-9001',
      orderType: 'cinema',
      status: 'new',
      paymentStatus: 'paid',
      subtotal: 20000,
      taxAmount: 1000,
      totalAmount: 21000,
      customerName: 'Theatre B Guest',
      statusToken: 'tok_cin_b_9001_secure_key',
      createdAt: new Date()
    });
  });

  after(async () => {
    // Clean up created orders & test records
    await db.delete(cinemaRefunds).where(eq(cinemaRefunds.theatreId, theatreAId));
    await db.delete(cinemaPaymentTransactions).where(eq(cinemaPaymentTransactions.theatreId, theatreAId));
    await db.delete(orderStatusHistory).where(inArray(orderStatusHistory.orderId, [
      orderA1NewId,
      orderA2PreparingId,
      orderA3ReadyId,
      orderA4DeliveredId,
      orderA5CancelledId
    ]));
    await db.delete(orderItems).where(inArray(orderItems.orderId, [
      orderA1NewId,
      orderA2PreparingId,
      orderA3ReadyId,
      orderA4DeliveredId,
      orderA5CancelledId
    ]));
    await db.delete(orders).where(inArray(orders.restaurantId, [theatreAId, theatreBId]));
    await db.delete(cinemaShows).where(eq(cinemaShows.id, showA1Id));
    await db.delete(cinemaMovies).where(eq(cinemaMovies.id, movieAId));
    await db.delete(cinemaSeats).where(eq(cinemaSeats.screenId, screenA1Id));
    await db.delete(cinemaRows).where(eq(cinemaRows.screenId, screenA1Id));
    await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, [theatreAId, theatreBId]));
    await db.delete(products).where(eq(products.restaurantId, theatreAId));
    await db.delete(categories).where(eq(categories.restaurantId, theatreAId));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId]));
    await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));

    if (createdUsersToClean.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }

    await pool.end().catch(() => {});
  });

  // =========================================================================
  // 1. Order Listing & Live Statistics
  // =========================================================================
  describe('Order Listing & Summary Metrics (GET /api/cinema/orders)', () => {
    it('should list all cinema orders for Theatre A with pagination and summary metrics', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.theatreId, theatreAId);
      assert.ok(Array.isArray(res.body.orders));
      assert.ok(res.body.orders.length >= 5);

      // Verify Live KPI Summary
      const summary = res.body.summary;
      assert.ok(summary, 'Summary metrics object must be present');
      assert.ok(typeof summary.todaySales === 'number');
      assert.ok(summary.newOrders >= 1);
      assert.ok(summary.preparingOrders >= 1);
      assert.ok(summary.readyOrders >= 1);
      assert.ok(summary.deliveredOrders >= 1);
      assert.ok(summary.cancelledOrders >= 1);

      // Verify Pagination metadata
      assert.strictEqual(res.body.pagination.page, 1);
      assert.ok(res.body.pagination.total >= 5);
      assert.ok(res.body.pagination.totalPages >= 1);
    });

    it('should strictly isolate Theatre B orders from Theatre A listing', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      const theatreBOrderFound = res.body.orders.find(
        (o: any) => o.id === orderBPaidId || o.orderNumber === 'INOX-9001'
      );
      assert.strictEqual(theatreBOrderFound, undefined, 'Theatre B orders must never appear in Theatre A response');
    });
  });

  // =========================================================================
  // 2. Order Filtering
  // =========================================================================
  describe('Order Filtering', () => {
    it('should filter orders by status (preparing)', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', status: 'preparing' })
        .expect(200);

      assert.ok(res.body.orders.length > 0);
      for (const order of res.body.orders) {
        assert.strictEqual(order.status, 'preparing');
      }
    });

    it('should filter orders by payment status (paid vs failed)', async () => {
      const paidRes = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', paymentStatus: 'paid' })
        .expect(200);

      assert.ok(paidRes.body.orders.length >= 4);
      for (const order of paidRes.body.orders) {
        assert.strictEqual(order.paymentStatus, 'paid');
      }

      const failedRes = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', paymentStatus: 'failed' })
        .expect(200);

      assert.ok(failedRes.body.orders.length >= 1);
      for (const order of failedRes.body.orders) {
        assert.strictEqual(order.paymentStatus, 'failed');
      }
    });

    it('should filter orders by screen ID', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', screenId: screenA1Id })
        .expect(200);

      assert.ok(res.body.orders.length >= 5);
      for (const order of res.body.orders) {
        assert.strictEqual(order.screenId, screenA1Id);
      }

      // Query screen A2 (has 0 orders)
      const emptyScreenRes = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', screenId: screenA2Id })
        .expect(200);

      assert.strictEqual(emptyScreenRes.body.orders.length, 0);
    });

    it('should filter orders by delivery status (delivered)', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', deliveryStatus: 'delivered' })
        .expect(200);

      assert.ok(res.body.orders.length >= 1);
      const delivered = res.body.orders.find((o: any) => o.id === orderA4DeliveredId);
      assert.ok(delivered, 'Delivered order must be returned in deliveryStatus=delivered query');
    });
  });

  // =========================================================================
  // 3. Search Orders
  // =========================================================================
  describe('Order Search', () => {
    it('should search orders by order number', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ search: 'CIN-1002' })
        .expect(200);

      assert.strictEqual(res.body.orders.length, 1);
      assert.strictEqual(res.body.orders[0].id, orderA2PreparingId);
      assert.strictEqual(res.body.orders[0].orderNumber, 'CIN-1002');
    });

    it('should search orders by customer name', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ search: 'Vikram Mehta' })
        .expect(200);

      assert.strictEqual(res.body.orders.length, 1);
      assert.strictEqual(res.body.orders[0].customerName, 'Vikram Mehta');
    });

    it('should search orders by seat number', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ search: '12' })
        .expect(200);

      const found = res.body.orders.find((o: any) => o.seatNumber === '12');
      assert.ok(found, 'Should find order placed for seat 12');
      assert.strictEqual(found.id, orderA3ReadyId);
    });
  });

  // =========================================================================
  // 4. Order Details Retrieval (GET /api/cinema/orders/:id)
  // =========================================================================
  describe('Detailed Order View (GET /api/cinema/orders/:id)', () => {
    it('should return rich order details including screen, movie, show, payment transaction, refund and audit history', async () => {
      const res = await request(app)
        .get(`/api/cinema/orders/${orderA3ReadyId}`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      const o = res.body.order;
      assert.strictEqual(o.id, orderA3ReadyId);
      assert.strictEqual(o.orderNumber, 'CIN-1003');

      // Verify screen context
      assert.ok(o.screen);
      assert.strictEqual(o.screen.id, screenA1Id);
      assert.strictEqual(o.screen.screenName, 'Screen 1 IMAX');

      // Verify movie & show context
      assert.ok(o.movie);
      assert.strictEqual(o.movie.title, 'Oppenheimer Cinema Edit');
      assert.ok(o.show);
      assert.strictEqual(o.seatRow, 'E');
      assert.strictEqual(o.seatNumber, '12');

      // Verify items
      assert.ok(Array.isArray(o.items));
      assert.strictEqual(o.items.length, 1);
      assert.strictEqual(o.items[0].productName, 'Chilled Pepsi 500ml');

      // Verify payment transaction details (safe public fields)
      assert.ok(o.paymentTransaction, 'Payment transaction record must be populated');
      assert.strictEqual(o.paymentTransaction.provider, 'razorpay');
      assert.strictEqual(o.paymentTransaction.providerPaymentId, 'pay_rzp_mock_1003');
      assert.strictEqual(o.paymentTransaction.amount, 15750);
      assert.strictEqual(o.paymentTransaction.status, 'captured');

      // Verify refund record
      assert.ok(Array.isArray(o.refunds));
      assert.strictEqual(o.refunds.length, 1);
      assert.strictEqual(o.refunds[0].amount, 5000);
      assert.strictEqual(o.refunds[0].providerRefundId, 'rfnd_rzp_mock_1003');

      // Verify status history
      assert.ok(Array.isArray(o.statusHistory));
    });

    it('should return 404 if Theatre A tries to access Theatre B order', async () => {
      const res = await request(app)
        .get(`/api/cinema/orders/${orderBPaidId}`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .expect(404);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /not found/i);
    });

    it('should return dedicated audit history at /api/cinema/orders/:id/history', async () => {
      const res = await request(app)
        .get(`/api/cinema/orders/${orderA2PreparingId}/history`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.history));
      assert.ok(res.body.history.length >= 2);
      const toPreparing = res.body.history.find((h: any) => h.toStatus === 'preparing');
      assert.ok(toPreparing, 'Must record transition to preparing');
      assert.strictEqual(toPreparing.changedByRole, 'kitchen');
    });
  });

  // =========================================================================
  // 5. Administrative Status Transition (PATCH /api/cinema/orders/:id/status)
  // =========================================================================
  describe('Administrative Status Transition', () => {
    it('should progress a READY order to ASSIGNED_FOR_DELIVERY with staff name and audit reason', async () => {
      const res = await request(app)
        .patch(`/api/cinema/orders/${orderA3ReadyId}/status`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .send({
          toStatus: 'assigned_for_delivery',
          deliveryStaffName: 'Mahesh - Screen 1 Runner',
          reason: 'Dispatched to staff Mahesh for seat delivery'
        })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.order.status, 'assigned_for_delivery');
      assert.strictEqual(res.body.order.deliveryStatus, 'assigned');
      assert.strictEqual(res.body.order.deliveryStaffName, 'Mahesh - Screen 1 Runner');

      // Verify audit trail logged in database
      const [history] = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderA3ReadyId))
        .orderBy(orderStatusHistory.createdAt);
      assert.ok(history);
      assert.strictEqual(history.toStatus, 'assigned_for_delivery');
      assert.strictEqual(history.changedByRole, 'owner');
    });

    it('should complete delivery by transitioning ASSIGNED_FOR_DELIVERY to DELIVERED', async () => {
      const res = await request(app)
        .patch(`/api/cinema/orders/${orderA3ReadyId}/status`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .send({
          toStatus: 'delivered',
          reason: 'Order handed over to customer at Seat E12'
        })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.order.status, 'delivered');
      assert.strictEqual(res.body.order.deliveryStatus, 'delivered');
      assert.ok(res.body.order.deliveredAt);
    });

    it('should reject invalid backward transition (e.g. delivered -> preparing)', async () => {
      const res = await request(app)
        .patch(`/api/cinema/orders/${orderA3ReadyId}/status`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .send({
          toStatus: 'preparing',
          reason: 'Attempt invalid backward transition'
        })
        .expect(400);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /invalid.*transition|cannot/i);
    });

    it('should guard against concurrency conflicts when expectedCurrentStatus is supplied', async () => {
      const res = await request(app)
        .patch(`/api/cinema/orders/${orderA1NewId}/status`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .send({
          expectedCurrentStatus: 'ready', // actual is 'new'
          toStatus: 'delivered',
          reason: 'Stale client update'
        })
        .expect(409);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /conflict/i);
    });
  });

  // =========================================================================
  // 6. Administrative Order Cancellation (POST /api/cinema/orders/:id/cancel)
  // =========================================================================
  describe('Administrative Cancellation (POST /api/cinema/orders/:id/cancel)', () => {
    it('should reject cancellation when mandatory audit reason is missing', async () => {
      const res = await request(app)
        .post(`/api/cinema/orders/${orderA1NewId}/cancel`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .send({ reason: '' })
        .expect(400);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /reason is required/i);
    });

    it('should successfully cancel an active order with mandatory reason', async () => {
      const res = await request(app)
        .post(`/api/cinema/orders/${orderA1NewId}/cancel`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .send({
          reason: 'Customer requested cancellation due to auditorium change'
        })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.order.status, 'cancelled');

      // Verify audit history record in db
      const historyRows = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderA1NewId));
      const cancelEntry = historyRows.find((h) => h.toStatus === 'cancelled');
      assert.ok(cancelEntry, 'Cancellation audit history record must be created');
      assert.strictEqual(
        cancelEntry.reason,
        'Customer requested cancellation due to auditorium change'
      );
      assert.strictEqual(cancelEntry.changedByRole, 'owner');
    });

    it('should reject cancellation if order is already delivered (terminal state)', async () => {
      const res = await request(app)
        .post(`/api/cinema/orders/${orderA4DeliveredId}/cancel`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .send({
          reason: 'Attempt voiding already delivered order'
        })
        .expect(400);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /terminal state/i);
    });
  });

  // =========================================================================
  // 7. Security, Permissions & Tenant Isolation
  // =========================================================================
  describe('Security & Permissions', () => {
    it('should reject unauthenticated requests with 401', async () => {
      await request(app)
        .get('/api/cinema/orders')
        .set('x-restaurant-id', theatreAId)
        .expect(401);
    });

    it('should reject restaurant tenant from accessing cinema orders endpoint with 403', async () => {
      const res = await request(app)
        .get('/api/cinema/orders')
        .set('Cookie', cookieRestaurantOwner)
        .set('x-restaurant-id', restaurantId)
        .expect(403);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message || res.body.error, /cross-module access denied|only accessible by cinema/i);
    });

    it('should reject non-admin staff from cancelling orders with 403', async () => {
      const res = await request(app)
        .post(`/api/cinema/orders/${orderA2PreparingId}/cancel`)
        .set('Cookie', cookieCinemaAStaff)
        .set('x-restaurant-id', theatreAId)
        .send({ reason: 'Unauthorized staff cancellation attempt' })
        .expect(403);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message || res.body.error, /insufficient permissions|forbidden|access/i);
    });
  });

  // =========================================================================
  // 8. Restaurant Regression Check
  // =========================================================================
  describe('Restaurant Dine-in Regression Guard', () => {
    it('should ensure standard restaurant order endpoint (/api/orders) functions independently', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Cookie', cookieRestaurantOwner)
        .set('x-restaurant-id', restaurantId)
        .expect(200);

      assert.ok(Array.isArray(res.body), 'Restaurant orders list must return an array');
    });
  });
});
