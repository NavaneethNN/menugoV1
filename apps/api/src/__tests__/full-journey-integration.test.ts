import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  restaurants,
  restaurantMembers,
  restaurantTables,
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 21: Full System Journey, Tenant Isolation & Error Invariants', () => {
  // Tenant A: Grand Masala House
  let restAId: string;
  let restASlug: string;
  let ownerACookie: string;
  let ownerAUserId: string;
  let kitchenACookie: string;
  let staffACookie: string;

  let catAId: string;
  let prodA1Id: string;
  let prodA2Id: string;
  let tableAId: string;
  let tableAToken: string;
  let tableAUrl: string;

  // Tenant B: Blue Ocean Seafood
  let restBId: string;
  let restBSlug: string;
  let ownerBCookie: string;
  let ownerBUserId: string;
  let catBId: string;
  let prodBId: string;
  let tableBId: string;

  // Lifecycle Order State
  let placedOrderId: string;
  let placedOrderNumber: string;
  let orderStatusToken: string;

  const now = Date.now();

  before(async () => {
    restASlug = `journey-grand-masala-${now}`;
    restBSlug = `journey-blue-ocean-${now}`;
  });

  after(async () => {
    await db.delete(orderStatusHistory);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(restaurantTables);
    await db.delete(restaurantMembers);
    await db.delete(restaurants);
  });

  // =========================================================================
  // STEP 1: Owner Signs Up and Creates Restaurant A
  // =========================================================================
  test('Step 1: Owner signs up and creates Restaurant A (Grand Masala House)', async () => {
    // Sign up Owner A
    const signupRes = await auth.api.signUpEmail({
      body: {
        name: 'Chef Vikram',
        email: `vikram-${now}@grandmasala.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    ownerACookie = signupRes.headers.get('set-cookie')?.split(';')[0] || '';
    const signupJson = await signupRes.json();
    ownerAUserId = signupJson.user.id;

    // Create Restaurant A via onboarding endpoint
    const createRestRes = await request(app)
      .post('/api/restaurants')
      .set('Cookie', ownerACookie)
      .send({
        name: 'Grand Masala House',
        slug: restASlug,
        phone: '+91 98765 43210',
        currency: 'INR',
        address: '100 Heritage Lane, Bengaluru'
      });

    assert.equal(createRestRes.status, 201);
    assert.equal(createRestRes.body.restaurant.name, 'Grand Masala House');
    assert.equal(createRestRes.body.membership.role, 'owner');
    restAId = createRestRes.body.restaurant.id;
  });

  // =========================================================================
  // STEP 2: Owner Adds Kitchen and Staff Members to Restaurant A
  // =========================================================================
  test('Step 2: Owner adds Kitchen and Staff roles to Restaurant A', async () => {
    // Create Kitchen User
    const kitchenRes = await auth.api.signUpEmail({
      body: {
        name: 'Kitchen Chef Ravi',
        email: `ravi-${now}@grandmasala.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    kitchenACookie = kitchenRes.headers.get('set-cookie')?.split(';')[0] || '';
    const kitchenJson = await kitchenRes.json();

    await request(app)
      .post('/api/restaurants/members')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId)
      .send({
        email: `ravi-${now}@grandmasala.com`,
        role: 'kitchen'
      });

    // Create Staff User
    const staffRes = await auth.api.signUpEmail({
      body: {
        name: 'Server Priya',
        email: `priya-${now}@grandmasala.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    staffACookie = staffRes.headers.get('set-cookie')?.split(';')[0] || '';
    const staffJson = await staffRes.json();

    await request(app)
      .post('/api/restaurants/members')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId)
      .send({
        email: `priya-${now}@grandmasala.com`,
        role: 'staff'
      });
  });

  // =========================================================================
  // STEP 3: Owner Creates Categories and Products
  // =========================================================================
  test('Step 3: Owner creates Category and Products (available and unavailable items)', async () => {
    // Create Category
    const catRes = await request(app)
      .post('/api/categories')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Chef Specials',
        description: 'Traditional slow-cooked Mughlai curries'
      });

    assert.equal(catRes.status, 201);
    catAId = catRes.body.id;

    // Create Product 1: Dum Biryani (Available, ₹350 = 35000 paise)
    const prod1Res = await request(app)
      .post('/api/products')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Awadhi Dum Biryani',
        description: 'Fragrant basmati rice layered with spiced paneer',
        categoryId: catAId,
        price: 35000,
        isVegetarian: true,
        isAvailable: true
      });

    assert.equal(prod1Res.status, 201);
    prodA1Id = prod1Res.body.id;

    // Create Product 2: Garlic Naan (Available, ₹60 = 6000 paise)
    const prod2Res = await request(app)
      .post('/api/products')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Butter Garlic Naan',
        description: 'Crisp clay oven tandoori bread',
        categoryId: catAId,
        price: 6000,
        isVegetarian: true,
        isAvailable: true
      });

    assert.equal(prod2Res.status, 201);
    prodA2Id = prod2Res.body.id;
  });

  // =========================================================================
  // STEP 4: Owner Creates Table and Generates QR Code
  // =========================================================================
  test('Step 4: Owner creates Table T-04 and generates cryptographic QR token', async () => {
    const tableRes = await request(app)
      .post('/api/tables')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId)
      .send({
        tableNumber: 'T-04',
        capacity: 4,
        isActive: true
      });

    assert.equal(tableRes.status, 201);
    assert.equal(tableRes.body.tableNumber, 'T-04');
    assert.ok(tableRes.body.tableToken.length >= 32);
    assert.ok(tableRes.body.qrCodeData.startsWith('data:image/png;base64,'));

    tableAId = tableRes.body.id;
    tableAToken = tableRes.body.tableToken;
    tableAUrl = tableRes.body.qrCodeUrl;
  });

  // =========================================================================
  // STEP 5: Customer Opens Public Menu via Scanned Table URL
  // =========================================================================
  test('Step 5: Customer scans QR and loads public menu with validated table', async () => {
    // 1. Verify Table Token
    const verifyRes = await request(app)
      .get(`/api/tables/verify/${tableAToken}?restaurantSlug=${restASlug}`);

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.valid, true);
    assert.equal(verifyRes.body.table.tableNumber, 'T-04');
    assert.equal(verifyRes.body.restaurant.slug, restASlug);

    // 2. Fetch Public Menu
    const menuRes = await request(app).get(`/api/restaurants/by-slug/${restASlug}`);
    assert.equal(menuRes.status, 200);
    assert.equal(menuRes.body.restaurant.name, 'Grand Masala House');
    assert.ok(menuRes.body.categories.length > 0);
    assert.ok(menuRes.body.products.length >= 2);
  });

  // =========================================================================
  // STEP 6: Customer Places Dine-in Order
  // =========================================================================
  test('Step 6: Customer composes cart and submits order (Authoritative ₹470)', async () => {
    const orderPayload = {
      restaurantSlug: restASlug,
      tableToken: tableAToken,
      customerName: 'Aarav Patel',
      customerPhone: '+91 98888 77777',
      specialInstructions: 'Less spicy, extra raita please',
      items: [
        {
          productId: prodA1Id, // Awadhi Dum Biryani (1x ₹350 = 35000)
          quantity: 1,
          notes: 'Medium spice'
        },
        {
          productId: prodA2Id, // Butter Garlic Naan (2x ₹60 = 12000)
          quantity: 2,
          notes: 'Crispy'
        }
      ]
    };

    const orderRes = await request(app)
      .post('/api/orders')
      .send(orderPayload);

    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.body.order.status, 'new');
    assert.equal(orderRes.body.order.totalAmount, 47000); // 35000 + 12000 = 47000 paise (₹470)
    assert.equal(orderRes.body.order.table.tableNumber, 'T-04');
    assert.ok(orderRes.body.order.statusToken);

    placedOrderId = orderRes.body.order.id;
    placedOrderNumber = orderRes.body.order.orderNumber;
    orderStatusToken = orderRes.body.order.statusToken;
  });

  // =========================================================================
  // STEP 7: Restaurant & Kitchen Receives NEW Order
  // =========================================================================
  test('Step 7: Restaurant staff lists orders and identifies NEW incoming order', async () => {
    const ordersRes = await request(app)
      .get('/api/orders?view=open&paginate=true')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId);

    assert.equal(ordersRes.status, 200);
    const found = ordersRes.body.orders.find((o: any) => o.id === placedOrderId);
    assert.ok(found, 'Placed order must appear in open orders');
    assert.equal(found.orderNumber, placedOrderNumber);
    assert.equal(found.status, 'new');
    assert.equal(found.customerName, 'Aarav Patel');
  });

  // =========================================================================
  // STEP 8: Kitchen Lifecycle Progression (ACCEPTED -> PREPARING -> READY)
  // =========================================================================
  test('Step 8: Kitchen moves order through lifecycle: new -> accepted -> preparing -> ready', async () => {
    // 1. Accept Order (new -> accepted)
    const acceptRes = await request(app)
      .patch(`/api/orders/${placedOrderId}/status`)
      .set('Cookie', kitchenACookie)
      .set('x-restaurant-id', restAId)
      .send({
        status: 'accepted',
        expectedCurrentStatus: 'new'
      });

    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.order.status, 'accepted');

    // 2. Start Cooking (accepted -> preparing)
    const prepRes = await request(app)
      .patch(`/api/orders/${placedOrderId}/status`)
      .set('Cookie', kitchenACookie)
      .set('x-restaurant-id', restAId)
      .send({
        status: 'preparing',
        expectedCurrentStatus: 'accepted'
      });

    assert.equal(prepRes.status, 200);
    assert.equal(prepRes.body.order.status, 'preparing');

    // 3. Mark Ready for Floor Pass (preparing -> ready)
    const readyRes = await request(app)
      .patch(`/api/orders/${placedOrderId}/status`)
      .set('Cookie', kitchenACookie)
      .set('x-restaurant-id', restAId)
      .send({
        status: 'ready',
        expectedCurrentStatus: 'preparing'
      });

    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.order.status, 'ready');
  });

  // =========================================================================
  // STEP 9: Floor Pass & Staff Service Workflow (READY -> SERVED)
  // =========================================================================
  test('Step 9: Floor Staff sees order on Service Pass and marks it SERVED', async () => {
    // 1. Floor Pass shows READY orders
    const passRes = await request(app)
      .get('/api/orders?status=ready')
      .set('Cookie', staffACookie)
      .set('x-restaurant-id', restAId);

    assert.equal(passRes.status, 200);
    const passOrders = Array.isArray(passRes.body) ? passRes.body : passRes.body.orders;
    const passOrder = passOrders.find((o: any) => o.id === placedOrderId);
    assert.ok(passOrder, 'Order must appear on Floor Service Pass');
    assert.equal(passOrder.status, 'ready');

    // 2. Staff marks SERVED (ready -> served)
    const serveRes = await request(app)
      .patch(`/api/orders/${placedOrderId}/status`)
      .set('Cookie', staffACookie)
      .set('x-restaurant-id', restAId)
      .send({
        status: 'served',
        expectedCurrentStatus: 'ready'
      });

    assert.equal(serveRes.status, 200);
    assert.equal(serveRes.body.order.status, 'served');
  });

  // =========================================================================
  // STEP 10: Customer Order Tracking Page Reflects SERVED
  // =========================================================================
  test('Step 10: Customer tracking page retrieves authoritative SERVED status', async () => {
    const trackRes = await request(app).get(`/api/orders/status/${orderStatusToken}`);

    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.orderNumber, placedOrderNumber);
    assert.equal(trackRes.body.status, 'served');
    assert.equal(trackRes.body.totalAmount, 47000);
    assert.equal(trackRes.body.table.tableNumber, 'T-04');
    // Ensure no private staff names or secrets leaked
    assert.equal(trackRes.body.userId, undefined);
    assert.equal(trackRes.body.statusHistory, undefined);
  });

  // =========================================================================
  // STEP 11: Duplicate Order Submission Idempotency Check
  // =========================================================================
  test('Step 11: Submitting duplicate order with same Idempotency-Key returns idempotent replay', async () => {
    const idemKey = crypto.randomUUID();
    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableAToken,
      items: [{ productId: prodA1Id, quantity: 1 }]
    };

    const firstRes = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idemKey)
      .send(payload);

    assert.equal(firstRes.status, 201);
    const originalId = firstRes.body.order.id;

    // Retry submission with identical key
    const replayRes = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idemKey)
      .send(payload);

    assert.equal(replayRes.status, 200);
    assert.equal(replayRes.body.idempotent, true);
    assert.equal(replayRes.body.order.id, originalId);
  });

  // =========================================================================
  // STEP 12: Unavailable Product Handling
  // =========================================================================
  test('Step 12: Ordering an item marked isAvailable = false is strictly rejected', async () => {
    // Mark Butter Garlic Naan as out of stock
    await db
      .update(products)
      .set({ isAvailable: false })
      .where(eq(products.id, prodA2Id));

    const failOrderRes = await request(app)
      .post('/api/orders')
      .send({
        restaurantSlug: restASlug,
        tableToken: tableAToken,
        items: [{ productId: prodA2Id, quantity: 1 }]
      });

    assert.equal(failOrderRes.status, 400);
    assert.ok(failOrderRes.body.message.includes('sold out'));
  });

  // =========================================================================
  // STEP 13: Tenant B Creation & Strict Multi-Tenant Isolation
  // =========================================================================
  test('Step 13: Tenant A cannot access Tenant B data (Orders, Tables, Products, Staff)', async () => {
    // 1. Create Owner B & Restaurant B
    const signupB = await auth.api.signUpEmail({
      body: {
        name: 'Chef Marin',
        email: `marin-${now}@blueocean.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    ownerBCookie = signupB.headers.get('set-cookie')?.split(';')[0] || '';
    const bJson = await signupB.json();
    ownerBUserId = bJson.user.id;

    const restBRes = await request(app)
      .post('/api/restaurants')
      .set('Cookie', ownerBCookie)
      .send({
        name: 'Blue Ocean Seafood',
        slug: restBSlug,
        currency: 'INR'
      });
    restBId = restBRes.body.restaurant.id;

    // 2. Create Table & Product for Tenant B
    const tableBRes = await request(app)
      .post('/api/tables')
      .set('Cookie', ownerBCookie)
      .set('x-restaurant-id', restBId)
      .send({ tableNumber: 'B-01', capacity: 2 });
    tableBId = tableBRes.body.id;

    const prodBRes = await request(app)
      .post('/api/products')
      .set('Cookie', ownerBCookie)
      .set('x-restaurant-id', restBId)
      .send({ name: 'Grilled Salmon', price: 65000, isAvailable: true });
    prodBId = prodBRes.body.id;

    // 3. Verify Owner A cannot list Tenant B tables (returns 403 Forbidden)
    const crossTableListRes = await request(app)
      .get('/api/tables')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restBId);
    assert.equal(crossTableListRes.status, 403);

    // 4. Verify Owner A cannot fetch Tenant B product by ID (returns 404 Not Found)
    const crossProductRes = await request(app)
      .get(`/api/products/${prodBId}`)
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId);
    assert.equal(crossProductRes.status, 404);

    // 5. Verify Owner A cannot view Tenant B orders (returns 403 Forbidden)
    const crossOrderListRes = await request(app)
      .get('/api/orders')
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restBId);
    assert.equal(crossOrderListRes.status, 403);

    // 6. Verify Owner A cannot delete Tenant B table (returns 404 Not Found)
    const crossDeleteTableRes = await request(app)
      .delete(`/api/tables/${tableBId}`)
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId);
    assert.equal(crossDeleteTableRes.status, 404);
  });
});
