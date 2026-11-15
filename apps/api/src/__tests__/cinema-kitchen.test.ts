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
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory,
  restaurantTables
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';
import { setRealtimeProvider, RealtimeProvider } from '../lib/realtime';

process.env.NODE_ENV = 'test';

describe('Task 15: Cinema Kitchen Dashboard & Preparation Workflow', () => {
  let userCinemaAOwnerId: string;
  let userCinemaAKitchenId: string;
  let userCinemaAStaffId: string;
  let userCinemaBOwnerId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaAOwner: string;
  let cookieCinemaAKitchen: string;
  let cookieCinemaAStaff: string;
  let cookieCinemaBOwner: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let screenAId: string;
  let movieAId: string;
  let showAId: string;
  let popcornProductId: string;
  let drinkProductId: string;

  let paidConfirmedOrderAId: string;
  let paidNewOrderAId: string;
  let unpaidOrderAId: string;
  let failedPaymentOrderAId: string;
  let paidOrderBId: string;

  const timestamp = Date.now();
  const createdUsersToClean: string[] = [];
  const publishedRealtimeEvents: { channel: string; event: string; payload: any }[] = [];

  // Mock Realtime Provider to verify realtime update delivery & deduplication
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

    // 1. Create Cinema A Owner
    const ownerAEmail = `theatreA.owner.${timestamp}@example.com`;
    const ownerARes = await auth.api.signUpEmail({
      body: { name: 'PVR Theatre Owner', email: ownerAEmail, password: 'password123' }
    });
    userCinemaAOwnerId = ownerARes.user.id;
    createdUsersToClean.push(userCinemaAOwnerId);

    const signinAOwner = await auth.api.signInEmail({
      body: { email: ownerAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAOwner = signinAOwner.headers.get('set-cookie') || '';

    // 2. Create Cinema A Kitchen Staff
    const kitchenAEmail = `theatreA.kitchen.${timestamp}@example.com`;
    const kitchenARes = await auth.api.signUpEmail({
      body: { name: 'Chef Ramesh (PVR Kitchen)', email: kitchenAEmail, password: 'password123' }
    });
    userCinemaAKitchenId = kitchenARes.user.id;
    createdUsersToClean.push(userCinemaAKitchenId);

    const signinAKitchen = await auth.api.signInEmail({
      body: { email: kitchenAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAKitchen = signinAKitchen.headers.get('set-cookie') || '';

    // 3. Create Cinema A Floor Staff
    const staffAEmail = `theatreA.staff.${timestamp}@example.com`;
    const staffARes = await auth.api.signUpEmail({
      body: { name: 'Usher Suresh (Floor Staff)', email: staffAEmail, password: 'password123' }
    });
    userCinemaAStaffId = staffARes.user.id;
    createdUsersToClean.push(userCinemaAStaffId);

    const signinAStaff = await auth.api.signInEmail({
      body: { email: staffAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAStaff = signinAStaff.headers.get('set-cookie') || '';

    // 4. Create Cinema B Owner (Tenant Isolation)
    const ownerBEmail = `theatreB.owner.${timestamp}@example.com`;
    const ownerBRes = await auth.api.signUpEmail({
      body: { name: 'Cinepolis Owner', email: ownerBEmail, password: 'password123' }
    });
    userCinemaBOwnerId = ownerBRes.user.id;
    createdUsersToClean.push(userCinemaBOwnerId);

    const signinBOwner = await auth.api.signInEmail({
      body: { email: ownerBEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaBOwner = signinBOwner.headers.get('set-cookie') || '';

    // 5. Create Restaurant Owner (Cross-Module Non-Regression)
    const restOwnerEmail = `rest.owner.${timestamp}@example.com`;
    const restOwnerRes = await auth.api.signUpEmail({
      body: { name: 'Restaurant Owner', email: restOwnerEmail, password: 'password123' }
    });
    userRestaurantOwnerId = restOwnerRes.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    const signinRestOwner = await auth.api.signInEmail({
      body: { email: restOwnerEmail, password: 'password123' },
      asResponse: true
    });
    cookieRestaurantOwner = signinRestOwner.headers.get('set-cookie') || '';

    // 6. Create Theatre A and Members
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'PVR Nexus Mall Cinemas',
      slug: `pvr-nexus-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true,
      settings: { taxPercentage: 5 }
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreAId,
      theatreName: 'PVR Nexus Mall Cinemas',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'contact@pvrnexus.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      onboardingStage: 'ordering_activated',
      onboardingCompleted: true
    });

    await db.insert(restaurantMembers).values([
      { restaurantId: theatreAId, userId: userCinemaAOwnerId, role: 'owner' },
      { restaurantId: theatreAId, userId: userCinemaAKitchenId, role: 'kitchen' },
      { restaurantId: theatreAId, userId: userCinemaAStaffId, role: 'staff' }
    ]);

    // 7. Create Theatre B (for isolation checks)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'Cinepolis Forum Cinemas',
      slug: `cinepolis-forum-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreBId,
      theatreName: 'Cinepolis Forum Cinemas',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      contactNumber: '9123456789',
      contactEmail: 'contact@cinepolis.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreBId,
      userId: userCinemaBOwnerId,
      role: 'owner'
    });

    // 8. Create Restaurant tenant (for regression check)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Barbeque Nation',
      slug: `bbq-nation-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId,
      userId: userRestaurantOwnerId,
      role: 'owner'
    });

    await db.insert(restaurantTables).values({
      restaurantId,
      tableNumber: 'Table 5',
      capacity: 4,
      isActive: true
    });

    // 9. Seed Theatre A screen, movie, show, category and products
    screenAId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screenAId,
      theatreId: theatreAId,
      screenName: 'Screen 1 (IMAX)',
      screenType: 'IMAX',
      status: 'active',
      totalRows: 1,
      totalSeats: 20,
      seatingConfigured: true
    });

    movieAId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movieAId,
      theatreId: theatreAId,
      title: 'Interstellar',
      language: 'English',
      durationMinutes: 169,
      status: 'active'
    });

    showAId = crypto.randomUUID();
    const showStart = new Date(Date.now() + 3600000);
    const showEnd = new Date(Date.now() + 10800000);
    const orderingStart = new Date(Date.now() - 3600000);
    const orderingEnd = new Date(Date.now() + 7200000);
    await db.insert(cinemaShows).values({
      id: showAId,
      theatreId: theatreAId,
      screenId: screenAId,
      movieId: movieAId,
      showDate: '2026-11-20',
      startTime: showStart,
      expectedEndTime: showEnd,
      orderingStartTime: orderingStart,
      orderingEndTime: orderingEnd,
      status: 'published'
    });

    const categoryId = crypto.randomUUID();
    await db.insert(categories).values({
      id: categoryId,
      restaurantId: theatreAId,
      name: 'Cinema Snacks',
      sortOrder: 1
    });

    popcornProductId = crypto.randomUUID();
    await db.insert(products).values({
      id: popcornProductId,
      restaurantId: theatreAId,
      categoryId,
      name: 'Large Butter Popcorn',
      price: 35000,
      isAvailable: true
    });

    drinkProductId = crypto.randomUUID();
    await db.insert(products).values({
      id: drinkProductId,
      restaurantId: theatreAId,
      categoryId,
      name: 'Cold Beverage 500ml',
      price: 15000,
      isAvailable: true
    });

    // 10. Seed Cinema Orders:
    // Order 1: Paid & Confirmed Cinema Order (Should appear in kitchen queue as NEW)
    paidConfirmedOrderAId = crypto.randomUUID();
    await db.insert(orders).values({
      id: paidConfirmedOrderAId,
      orderNumber: `PVR-ORD-${timestamp.toString().slice(-5)}-1`,
      restaurantId: theatreAId,
      orderType: 'cinema',
      screenId: screenAId,
      movieId: movieAId,
      showId: showAId,
      showDate: '2026-11-20',
      showtime: '10:00:00',
      seatRow: 'F',
      seatNumber: '12',
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      paymentReference: 'pay_rzp_mock_111',
      subtotal: 50000,
      taxAmount: 2500,
      totalAmount: 52500,
      specialInstructions: 'Extra butter on popcorn, no ice in drink',
      customerName: 'Aarav Sharma',
      customerPhone: '9876543210'
    });

    await db.insert(orderItems).values([
      {
        orderId: paidConfirmedOrderAId,
        productId: popcornProductId,
        productName: 'Large Butter Popcorn',
        quantity: 1,
        unitPrice: 35000,
        subtotal: 35000
      },
      {
        orderId: paidConfirmedOrderAId,
        productId: drinkProductId,
        productName: 'Cold Beverage 500ml',
        quantity: 1,
        unitPrice: 15000,
        subtotal: 15000
      }
    ]);

    // Order 2: Paid & New Cinema Order (Should appear in kitchen queue as NEW)
    paidNewOrderAId = crypto.randomUUID();
    await db.insert(orders).values({
      id: paidNewOrderAId,
      orderNumber: `PVR-ORD-${timestamp.toString().slice(-5)}-2`,
      restaurantId: theatreAId,
      orderType: 'cinema',
      screenId: screenAId,
      movieId: movieAId,
      showId: showAId,
      showDate: '2026-11-20',
      showtime: '10:00:00',
      seatRow: 'G',
      seatNumber: '15',
      status: 'new',
      paymentStatus: 'paid',
      paymentMethod: 'paytm',
      paymentReference: 'tx_paytm_mock_222',
      subtotal: 35000,
      taxAmount: 1750,
      totalAmount: 36750,
      customerName: 'Priya Patel',
      customerPhone: '9123456780'
    });

    await db.insert(orderItems).values([
      {
        orderId: paidNewOrderAId,
        productId: popcornProductId,
        productName: 'Large Butter Popcorn',
        quantity: 1,
        unitPrice: 35000,
        subtotal: 35000
      }
    ]);

    // Order 3: Unpaid Pending Order (Must NEVER appear in kitchen queue)
    unpaidOrderAId = crypto.randomUUID();
    await db.insert(orders).values({
      id: unpaidOrderAId,
      orderNumber: `PVR-ORD-${timestamp.toString().slice(-5)}-3`,
      restaurantId: theatreAId,
      orderType: 'cinema',
      screenId: screenAId,
      movieId: movieAId,
      showId: showAId,
      seatRow: 'H',
      seatNumber: '8',
      status: 'pending',
      paymentStatus: 'unpaid',
      totalAmount: 36750
    });

    // Order 4: Failed Payment Order (Must NEVER appear in kitchen queue)
    failedPaymentOrderAId = crypto.randomUUID();
    await db.insert(orders).values({
      id: failedPaymentOrderAId,
      orderNumber: `PVR-ORD-${timestamp.toString().slice(-5)}-4`,
      restaurantId: theatreAId,
      orderType: 'cinema',
      screenId: screenAId,
      movieId: movieAId,
      showId: showAId,
      seatRow: 'H',
      seatNumber: '9',
      status: 'pending',
      paymentStatus: 'failed',
      totalAmount: 36750
    });

    // Order 5: Theatre B Paid Order (Tenant Isolation)
    paidOrderBId = crypto.randomUUID();
    await db.insert(orders).values({
      id: paidOrderBId,
      orderNumber: `CIN-ORD-${timestamp.toString().slice(-5)}-B`,
      restaurantId: theatreBId,
      orderType: 'cinema',
      status: 'confirmed',
      paymentStatus: 'paid',
      totalAmount: 40000
    });
  });

  after(async () => {
    try {
      setRealtimeProvider(null);
      await db.delete(orderStatusHistory).where(
        inArray(orderStatusHistory.orderId, [
          paidConfirmedOrderAId,
          paidNewOrderAId,
          unpaidOrderAId,
          failedPaymentOrderAId,
          paidOrderBId
        ])
      );
      await db.delete(orderItems).where(
        inArray(orderItems.orderId, [
          paidConfirmedOrderAId,
          paidNewOrderAId,
          unpaidOrderAId,
          failedPaymentOrderAId,
          paidOrderBId
        ])
      );
      await db.delete(orders).where(
        inArray(orders.id, [
          paidConfirmedOrderAId,
          paidNewOrderAId,
          unpaidOrderAId,
          failedPaymentOrderAId,
          paidOrderBId
        ])
      );
      await db.delete(products).where(inArray(products.id, [popcornProductId, drinkProductId]));
      await db.delete(categories).where(eq(categories.restaurantId, theatreAId));
      await db.delete(cinemaShows).where(eq(cinemaShows.theatreId, theatreAId));
      await db.delete(cinemaMovies).where(eq(cinemaMovies.theatreId, theatreAId));
      await db.delete(cinemaScreens).where(eq(cinemaScreens.theatreId, theatreAId));
      await db.delete(restaurantTables).where(eq(restaurantTables.restaurantId, restaurantId));
      await db.delete(restaurantMembers).where(
        inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId])
      );
      await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));
      if (createdUsersToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUsersToClean));
      }
      await pool.end().catch(() => {});
    } catch (e) {
      console.warn('Cleanup warning in cinema kitchen test:', e);
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Incoming Paid Order Visibility & Unpaid Exclusion
  // ---------------------------------------------------------------------------
  describe('1. Incoming Paid Order Visibility & Unpaid Exclusion', () => {
    it('GET /api/cinema/kitchen/orders returns only confirmed paid cinema orders', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.orders));

      const returnedOrderIds = res.body.orders.map((o: any) => o.id);

      // Must include paid confirmed and paid new orders
      assert.ok(returnedOrderIds.includes(paidConfirmedOrderAId));
      assert.ok(returnedOrderIds.includes(paidNewOrderAId));

      // STRICT RULE: Unpaid and Failed payment orders must NEVER appear in the kitchen queue
      assert.equal(
        returnedOrderIds.includes(unpaidOrderAId),
        false,
        'Unpaid order must NOT appear in kitchen queue'
      );
      assert.equal(
        returnedOrderIds.includes(failedPaymentOrderAId),
        false,
        'Failed payment order must NOT appear in kitchen queue'
      );
    });

    it('returns complete joined cinema context (screen, row, seat, movie, items, elapsed time)', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 200);
      const targetOrder = res.body.orders.find((o: any) => o.id === paidConfirmedOrderAId);

      assert.ok(targetOrder, 'Target confirmed order must be present');
      assert.equal(targetOrder.orderType, 'cinema');
      assert.equal(targetOrder.paymentStatus, 'paid');
      assert.equal(targetOrder.paymentMethod, 'razorpay');
      assert.equal(targetOrder.seatRow, 'F');
      assert.equal(targetOrder.seatNumber, '12');
      assert.equal(targetOrder.screen?.name, 'Screen 1 (IMAX)');
      assert.equal(targetOrder.movie?.title, 'Interstellar');
      assert.equal(targetOrder.specialInstructions, 'Extra butter on popcorn, no ice in drink');
      assert.ok(Array.isArray(targetOrder.items));
      assert.equal(targetOrder.items.length, 2);
      assert.equal(typeof targetOrder.elapsedMinutes, 'number');
    });

    it('filters orders by screen when screenId query parameter is provided', async () => {
      const res = await request(app)
        .get(`/api/cinema/kitchen/orders?screenId=${screenAId}`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 200);
      assert.ok(res.body.orders.every((o: any) => o.screenId === screenAId));
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Kitchen Lifecycle Actions: Accept -> Prepare -> Ready
  // ---------------------------------------------------------------------------
  describe('2. Kitchen Order Lifecycle Transitions', () => {
    it('POST /api/cinema/kitchen/orders/:orderId/accept moves order from confirmed to accepted', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidConfirmedOrderAId}/accept`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId)
        .send({ reason: 'Kitchen accepted order' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.status, 'accepted');

      // Verify in database
      const [orderDb] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, paidConfirmedOrderAId))
        .limit(1);
      assert.equal(orderDb.status, 'accepted');

      // Verify audit trail in orderStatusHistory
      const [history] = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, paidConfirmedOrderAId));
      assert.ok(history);
      assert.equal(history.toStatus, 'accepted');
      assert.equal(history.changedByRole, 'kitchen');
    });

    it('POST /api/cinema/kitchen/orders/:orderId/prepare moves accepted order to preparing', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidConfirmedOrderAId}/prepare`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId)
        .send({ reason: 'Chef started cooking popcorn' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.status, 'preparing');

      const [orderDb] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, paidConfirmedOrderAId))
        .limit(1);
      assert.equal(orderDb.status, 'preparing');
    });

    it('POST /api/cinema/kitchen/orders/:orderId/ready marks preparing order as ready', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidConfirmedOrderAId}/ready`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId)
        .send({ reason: 'Food ready for delivery' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.status, 'ready');

      const [orderDb] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, paidConfirmedOrderAId))
        .limit(1);
      assert.equal(orderDb.status, 'ready');
    });

    it('allows starting preparation directly from new/confirmed status (Order 2)', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidNewOrderAId}/prepare`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.order.status, 'preparing');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Invalid State Transitions & Unpaid Protection
  // ---------------------------------------------------------------------------
  describe('3. Invalid State Transitions & Unpaid Protection', () => {
    it('rejects accepting an unpaid order with 400', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${unpaidOrderAId}/accept`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /unpaid payment status/i);
    });

    it('rejects preparing a failed payment order with 400', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${failedPaymentOrderAId}/prepare`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /unpaid payment status/i);
    });

    it('rejects marking ready an order that is already in ready status (no-op)', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidConfirmedOrderAId}/ready`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /already marked as ready/i);
    });

    it('rejects moving a ready order back to preparing without correction workflow', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidConfirmedOrderAId}/prepare`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /cannot move ready order back to preparing/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Role Authorization & Permissions
  // ---------------------------------------------------------------------------
  describe('4. Staff Role Authorization & Permissions', () => {
    it('cinema owner can accept and prepare kitchen orders', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidNewOrderAId}/ready`)
        .set('Cookie', cookieCinemaAOwner)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.order.status, 'ready');
    });

    it('floor staff (non-kitchen) CANNOT mark order as ready (rejected with 403)', async () => {
      // Revert Order 2 to preparing for this test
      await db.update(orders).set({ status: 'preparing' }).where(eq(orders.id, paidNewOrderAId));

      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidNewOrderAId}/ready`)
        .set('Cookie', cookieCinemaAStaff)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 403);
      assert.match(res.body.message, /insufficient permissions/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Realtime Updates & Deduplication
  // ---------------------------------------------------------------------------
  describe('5. Realtime Updates & Deduplication', () => {
    it('dispatches realtime order:updated event when kitchen changes order status', async () => {
      publishedRealtimeEvents.length = 0; // Clear history

      const res = await request(app)
        .patch(`/api/cinema/kitchen/orders/${paidNewOrderAId}/status`)
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId)
        .send({ status: 'ready', expectedCurrentStatus: 'preparing' });

      assert.equal(res.status, 200);

      // Verify that realtime update event was published to the theatre channel
      const updateEvent = publishedRealtimeEvents.find(
        (e) => e.channel === `restaurant:${theatreAId}` && e.event === 'order:updated'
      );
      assert.ok(updateEvent, 'Realtime update event must be published to theatre channel');
      assert.equal(updateEvent.payload.orderId, paidNewOrderAId);
      assert.equal(updateEvent.payload.status, 'ready');
      assert.ok(updateEvent.payload.eventId, 'Event must have unique UUID for deduplication');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Tenant Isolation Between Cinema Theatres
  // ---------------------------------------------------------------------------
  describe('6. Tenant Isolation Between Cinema Theatres', () => {
    it('Theatre B admin cannot see Theatre A kitchen orders', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('Cookie', cookieCinemaBOwner)
        .set('x-theatre-id', theatreBId);

      assert.equal(res.status, 200);
      const returnedIds = res.body.orders.map((o: any) => o.id);
      assert.equal(returnedIds.includes(paidConfirmedOrderAId), false);
      assert.equal(returnedIds.includes(paidNewOrderAId), false);
    });

    it('Theatre B admin cannot accept or prepare Theatre A kitchen orders (returns 404)', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${paidConfirmedOrderAId}/accept`)
        .set('Cookie', cookieCinemaBOwner)
        .set('x-theatre-id', theatreBId);

      assert.equal(res.status, 404);
      assert.match(res.body.message, /not found or does not belong to this theatre/i);
    });

    it('Restaurant user cannot access cinema kitchen endpoints (rejected with 403)', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('Cookie', cookieRestaurantOwner)
        .set('x-restaurant-id', restaurantId);

      assert.equal(res.status, 403);
      assert.match(res.body.message, /cross-module access denied/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Restaurant Module Non-Regression
  // ---------------------------------------------------------------------------
  describe('7. Restaurant Module Non-Regression', () => {
    it('restaurant tables and orders endpoints continue operating normally', async () => {
      const res = await request(app)
        .get('/api/tables')
        .set('Cookie', cookieRestaurantOwner)
        .set('x-restaurant-id', restaurantId);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].tableNumber, 'Table 5');
    });
  });
});
