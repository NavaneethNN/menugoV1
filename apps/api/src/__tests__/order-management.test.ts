import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  user,
  session,
  restaurants,
  restaurantMembers,
  restaurantTables,
  products,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Restaurant Order Management API & Lifecycle (Task 13)', () => {
  // Restaurant Alpha & Beta
  let restAlphaId: string;
  let restBetaId: string;

  // Users for Restaurant Alpha
  let userAlphaOwnerId: string;
  let userAlphaKitchenId: string;
  let userAlphaStaffId: string;

  // User for Restaurant Beta
  let userBetaOwnerId: string;

  // Session Cookies
  let cookieAlphaOwner: string;
  let cookieAlphaKitchen: string;
  let cookieAlphaStaff: string;
  let cookieBetaOwner: string;

  // Tables
  let tableAlpha1Id: string;
  let tableAlpha2Id: string;

  // Products
  let prodAlpha1Id: string;
  let prodAlpha2Id: string;

  // Seeded Orders
  let orderAlpha1Id: string;
  let orderAlpha2Id: string;
  let orderAlphaServedId: string;
  let orderBetaId: string;

  const now = Date.now();
  const restAlphaSlug = `order-mgmt-alpha-${now}`;
  const restBetaSlug = `order-mgmt-beta-${now}`;

  before(async () => {
    // 1. Create Restaurants Alpha & Beta
    restAlphaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restAlphaId,
      name: 'Alpha Gourmet Bistro',
      slug: restAlphaSlug,
      currency: 'INR',
      isActive: true
    });

    restBetaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restBetaId,
      name: 'Beta Spice House',
      slug: restBetaSlug,
      currency: 'INR',
      isActive: true
    });

    // 2. Create Users & Sessions for Alpha using Better Auth
    const alphaOwnerRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Owner',
        email: `alpha-owner-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaOwner = alphaOwnerRes.headers.get('set-cookie')?.split(';')[0] || '';
    const alphaOwnerJson = await alphaOwnerRes.json();
    userAlphaOwnerId = alphaOwnerJson.user.id;
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restAlphaId,
      userId: userAlphaOwnerId,
      role: 'owner'
    });

    const alphaKitchenRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Chef',
        email: `alpha-chef-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaKitchen = alphaKitchenRes.headers.get('set-cookie')?.split(';')[0] || '';
    const alphaKitchenJson = await alphaKitchenRes.json();
    userAlphaKitchenId = alphaKitchenJson.user.id;
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restAlphaId,
      userId: userAlphaKitchenId,
      role: 'kitchen'
    });

    const alphaStaffRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Waiter',
        email: `alpha-waiter-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaStaff = alphaStaffRes.headers.get('set-cookie')?.split(';')[0] || '';
    const alphaStaffJson = await alphaStaffRes.json();
    userAlphaStaffId = alphaStaffJson.user.id;
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restAlphaId,
      userId: userAlphaStaffId,
      role: 'staff'
    });

    // 3. Create User & Session for Beta
    const betaOwnerRes = await auth.api.signUpEmail({
      body: {
        name: 'Beta Owner',
        email: `beta-owner-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieBetaOwner = betaOwnerRes.headers.get('set-cookie')?.split(';')[0] || '';
    const betaOwnerJson = await betaOwnerRes.json();
    userBetaOwnerId = betaOwnerJson.user.id;
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restBetaId,
      userId: userBetaOwnerId,
      role: 'owner'
    });

    // 4. Seed Tables
    tableAlpha1Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableAlpha1Id,
      restaurantId: restAlphaId,
      tableNumber: 'T-101',
      tableToken: crypto.randomBytes(16).toString('hex'),
      capacity: 4,
      isActive: true
    });

    tableAlpha2Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableAlpha2Id,
      restaurantId: restAlphaId,
      tableNumber: 'T-102',
      tableToken: crypto.randomBytes(16).toString('hex'),
      capacity: 2,
      isActive: true
    });

    // 5. Seed Products
    prodAlpha1Id = crypto.randomUUID();
    await db.insert(products).values({
      id: prodAlpha1Id,
      restaurantId: restAlphaId,
      name: 'Paneer Butter Masala',
      price: 28000, // 28000 paise = ₹280
      isAvailable: true
    });

    prodAlpha2Id = crypto.randomUUID();
    await db.insert(products).values({
      id: prodAlpha2Id,
      restaurantId: restAlphaId,
      name: 'Garlic Butter Roti',
      price: 4500, // 4500 paise = ₹45
      isAvailable: true
    });

    // 6. Seed Orders for Alpha
    orderAlpha1Id = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlpha1Id,
      orderNumber: '1001',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'new',
      totalAmount: 37000, // 28000 + 2*4500
      customerName: 'Kavita Iyer',
      customerPhone: '+91 98765 22222',
      specialInstructions: 'Medium spice level'
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: orderAlpha1Id,
        productId: prodAlpha1Id,
        productName: 'Paneer Butter Masala',
        quantity: 1,
        unitPrice: 28000,
        subtotal: 28000
      },
      {
        id: crypto.randomUUID(),
        orderId: orderAlpha1Id,
        productId: prodAlpha2Id,
        productName: 'Garlic Butter Roti',
        quantity: 2,
        unitPrice: 4500,
        subtotal: 9000,
        notes: 'Well crisp'
      }
    ]);

    orderAlpha2Id = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlpha2Id,
      orderNumber: '1002',
      restaurantId: restAlphaId,
      tableId: tableAlpha2Id,
      status: 'preparing',
      totalAmount: 28000,
      customerName: 'Rohan Deshmukh'
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: orderAlpha2Id,
        productId: prodAlpha1Id,
        productName: 'Paneer Butter Masala',
        quantity: 1,
        unitPrice: 28000,
        subtotal: 28000
      }
    ]);

    orderAlphaServedId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlphaServedId,
      orderNumber: '1003',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'served',
      totalAmount: 9000
    });

    // Seed Order for Beta
    orderBetaId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderBetaId,
      orderNumber: '2001',
      restaurantId: restBetaId,
      status: 'new',
      totalAmount: 50000
    });
  });

  after(async () => {
    // Clean up orders, history & items
    await db.delete(orderStatusHistory);
    await db.delete(orderItems);
    await db.delete(orders);

    // Clean up products & tables
    await db.delete(products);
    await db.delete(restaurantTables);

    // Clean up sessions, members, restaurants & users
    await db.delete(session);
    await db.delete(restaurantMembers);
    await db.delete(restaurants);
    await db.delete(user);
  });

  // ---------------------------------------------------------------------------
  // 1. Scoped Order Listing & Filters (Requirement 1, 2, 3)
  // ---------------------------------------------------------------------------
  test('GET /api/orders — Lists orders strictly scoped to active authorized restaurant', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Cookie', [cookieAlphaOwner])
      .set('x-restaurant-id', restAlphaId)
      .expect(200);

    assert.ok(Array.isArray(res.body));
    // Must contain Alpha orders (1001, 1002, 1003) but NOT Beta order (2001)
    const orderNumbers = res.body.map((o: any) => o.orderNumber);
    assert.ok(orderNumbers.includes('1001'));
    assert.ok(orderNumbers.includes('1002'));
    assert.ok(orderNumbers.includes('1003'));
    assert.equal(orderNumbers.includes('2001'), false, 'Beta orders must never appear in Alpha order list');

    // Verify order fields returned
    const o1 = res.body.find((o: any) => o.id === orderAlpha1Id);
    assert.ok(o1);
    assert.equal(o1.orderNumber, '1001');
    assert.equal(o1.totalAmount, 37000);
    assert.equal(o1.customerName, 'Kavita Iyer');
    assert.equal(o1.specialInstructions, 'Medium spice level');
    assert.equal(o1.table.tableNumber, 'T-101');
    assert.equal(o1.items.length, 2);
    assert.equal(o1.items[1].notes, 'Well crisp');
  });

  test('GET /api/orders?view=open — Filters for open active orders (excludes served/cancelled)', async () => {
    const res = await request(app)
      .get('/api/orders?view=open')
      .set('Cookie', [cookieAlphaOwner])
      .set('x-restaurant-id', restAlphaId)
      .expect(200);

    const statuses = res.body.map((o: any) => o.status);
    assert.ok(statuses.includes('new'));
    assert.ok(statuses.includes('preparing'));
    assert.equal(statuses.includes('served'), false, 'Served orders must be excluded from view=open');
    assert.equal(statuses.includes('cancelled'), false, 'Cancelled orders must be excluded from view=open');
  });

  test('GET /api/orders?status=preparing — Filters by specific order status', async () => {
    const res = await request(app)
      .get('/api/orders?status=preparing')
      .set('Cookie', [cookieAlphaKitchen])
      .set('x-restaurant-id', restAlphaId)
      .expect(200);

    assert.ok(res.body.length >= 1);
    for (const o of res.body) {
      assert.equal(o.status, 'preparing');
    }
  });

  test('GET /api/orders?search=Kavita — Filters by customer search query', async () => {
    const res = await request(app)
      .get('/api/orders?search=Kavita')
      .set('Cookie', [cookieAlphaStaff])
      .set('x-restaurant-id', restAlphaId)
      .expect(200);

    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].customerName, 'Kavita Iyer');
    assert.equal(res.body[0].orderNumber, '1001');
  });

  // ---------------------------------------------------------------------------
  // 2. Order Detail View & IDOR Protection (Requirement 4 & 8)
  // ---------------------------------------------------------------------------
  test('GET /api/orders/:id — Retrieves full order detail view for authorized staff', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderAlpha1Id}`)
      .set('Cookie', [cookieAlphaOwner])
      .set('x-restaurant-id', restAlphaId)
      .expect(200);

    assert.equal(res.body.id, orderAlpha1Id);
    assert.equal(res.body.orderNumber, '1001');
    assert.equal(res.body.totalAmount, 37000);
    assert.equal(res.body.table.tableNumber, 'T-101');
    assert.equal(res.body.items.length, 2);
    assert.ok(Array.isArray(res.body.statusHistory));
  });

  test('GET /api/orders/:id — Cross-tenant IDOR: Owner Beta cannot read Restaurant Alpha order (404)', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderAlpha1Id}`)
      .set('Cookie', [cookieBetaOwner])
      .set('x-restaurant-id', restBetaId) // Beta tenant context
      .expect(404);

    assert.match(res.body.error, /order not found or does not belong to this restaurant/i);
  });

  // ---------------------------------------------------------------------------
  // 3. State Machine & Status Transitions (Requirement 5, 6, 7)
  // ---------------------------------------------------------------------------
  test('PATCH /api/orders/:id/status — Valid transition: new -> accepted', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha1Id}/status`)
      .set('Cookie', [cookieAlphaKitchen])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'accepted' })
      .expect(200);

    assert.equal(res.body.order.status, 'accepted');
    assert.equal(res.body.history.fromStatus, 'new');
    assert.equal(res.body.history.toStatus, 'accepted');
    assert.equal(res.body.history.changedByRole, 'kitchen');
  });

  test('PATCH /api/orders/:id/status — Valid transition: accepted -> preparing', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha1Id}/status`)
      .set('Cookie', [cookieAlphaKitchen])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'preparing' })
      .expect(200);

    assert.equal(res.body.order.status, 'preparing');
  });

  test('PATCH /api/orders/:id/status — Role Boundary: Staff cannot mark order as "ready" (403)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha1Id}/status`)
      .set('Cookie', [cookieAlphaStaff])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'ready' })
      .expect(403);

    assert.match(res.body.error, /does not have permission/i);
  });

  test('PATCH /api/orders/:id/status — Valid transition: preparing -> ready by Kitchen', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha1Id}/status`)
      .set('Cookie', [cookieAlphaKitchen])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'ready' })
      .expect(200);

    assert.equal(res.body.order.status, 'ready');
  });

  test('PATCH /api/orders/:id/status — Backward transition rejected: ready -> preparing (400)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha1Id}/status`)
      .set('Cookie', [cookieAlphaKitchen])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'preparing' })
      .expect(400);

    assert.match(res.body.error, /arbitrary or backward status jumps are strictly rejected/i);
  });

  test('PATCH /api/orders/:id/status — Valid transition: ready -> served by Staff', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha1Id}/status`)
      .set('Cookie', [cookieAlphaStaff])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'served' })
      .expect(200);

    assert.equal(res.body.order.status, 'served');
  });

  test('PATCH /api/orders/:id/status — Terminal state "served" rejects further modification (400)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha1Id}/status`)
      .set('Cookie', [cookieAlphaOwner])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'cancelled' })
      .expect(400);

    assert.match(res.body.error, /order has already been served and completed/i);
  });

  test('PATCH /api/orders/:id/status — Cancellation permission: Staff cannot cancel order (403)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha2Id}/status`)
      .set('Cookie', [cookieAlphaStaff])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'cancelled', reason: 'Customer changed mind' })
      .expect(403);

    assert.match(res.body.error, /not permitted to cancel orders/i);
  });

  test('PATCH /api/orders/:id/status — Cancellation permission: Owner cancels order with audit reason', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlpha2Id}/status`)
      .set('Cookie', [cookieAlphaOwner])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'cancelled', reason: 'Customer requested cancellation due to wait time' })
      .expect(200);

    assert.equal(res.body.order.status, 'cancelled');
    assert.equal(res.body.history.reason, 'Customer requested cancellation due to wait time');
    assert.equal(res.body.history.changedByRole, 'owner');
  });

  // ---------------------------------------------------------------------------
  // 4. Concurrency Protection & Stale Overwrite Prevention (Requirement 9)
  // ---------------------------------------------------------------------------
  test('PATCH /api/orders/:id/status — Concurrency conflict: rejects update when expectedCurrentStatus is stale (409)', async () => {
    // Create fresh order in status 'new'
    const newOrderId = crypto.randomUUID();
    await db.insert(orders).values({
      id: newOrderId,
      orderNumber: '3001',
      restaurantId: restAlphaId,
      status: 'new',
      totalAmount: 15000
    });

    // Worker 1 transitions order: 'new' -> 'accepted'
    await request(app)
      .patch(`/api/orders/${newOrderId}/status`)
      .set('Cookie', [cookieAlphaKitchen])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'accepted', expectedCurrentStatus: 'new' })
      .expect(200);

    // Worker 2 (using stale state) attempts to transition with expectedCurrentStatus: 'new'
    const staleRes = await request(app)
      .patch(`/api/orders/${newOrderId}/status`)
      .set('Cookie', [cookieAlphaStaff])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'accepted', expectedCurrentStatus: 'new' })
      .expect(409);

    assert.match(staleRes.body.error, /order status conflict/i);
    assert.match(staleRes.body.error, /currently in status "accepted"/i);
  });

  // ---------------------------------------------------------------------------
  // 5. Cross-Tenant IDOR on Status Updates (Requirement 8)
  // ---------------------------------------------------------------------------
  test('PATCH /api/orders/:id/status — Cross-tenant IDOR: Owner Beta cannot mutate Restaurant Alpha order (404)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaServedId}/status`)
      .set('Cookie', [cookieBetaOwner])
      .set('x-restaurant-id', restBetaId) // Beta tenant
      .send({ status: 'cancelled' })
      .expect(404);

    assert.match(res.body.error, /order not found or does not belong to this restaurant/i);
  });
});
