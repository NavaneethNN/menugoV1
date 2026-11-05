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
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 17 — Service Workflow API & State Transitions', () => {
  // Restaurants
  let restAlphaId: string;
  let restBetaId: string;

  // Users
  let userAlphaStaffId: string;
  let userAlphaKitchenId: string;
  let userAlphaOwnerId: string;
  let userBetaOwnerId: string;

  // Cookies
  let cookieAlphaStaff: string;
  let cookieAlphaKitchen: string;
  let cookieAlphaOwner: string;
  let cookieBetaOwner: string;

  // Tables
  let tableAlpha1Id: string;
  let tableAlpha2Id: string;

  // Orders
  let orderAlphaReady1Id: string;
  let orderAlphaReady2Id: string;
  let orderAlphaPreparingId: string;
  let orderAlphaNewId: string;
  let orderAlphaServedId: string;
  let orderBetaReadyId: string;

  const now = Date.now();
  const restAlphaSlug = `service-alpha-${now}`;
  const restBetaSlug = `service-beta-${now}`;

  before(async () => {
    // 1. Create Restaurants
    restAlphaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restAlphaId,
      name: 'Alpha Dining Room',
      slug: restAlphaSlug,
      currency: 'INR',
      isActive: true
    });

    restBetaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restBetaId,
      name: 'Beta Trattoria',
      slug: restBetaSlug,
      currency: 'INR',
      isActive: true
    });

    // 2. Create Users & Memberships for Alpha
    const alphaStaffRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Floor Waiter',
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

    const alphaKitchenRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Kitchen Chef',
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

    const alphaOwnerRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Manager',
        email: `alpha-manager-${now}@example.com`,
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

    // 3. Create User & Membership for Beta
    const betaOwnerRes = await auth.api.signUpEmail({
      body: {
        name: 'Beta Manager',
        email: `beta-manager-${now}@example.com`,
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
      tableNumber: 'Table 4',
      tableToken: crypto.randomBytes(16).toString('hex'),
      isActive: true
    });

    tableAlpha2Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableAlpha2Id,
      restaurantId: restAlphaId,
      tableNumber: 'Table 12',
      tableToken: crypto.randomBytes(16).toString('hex'),
      isActive: true
    });

    // 5. Seed Orders for Alpha
    // Order 1: READY on pass
    orderAlphaReady1Id = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlphaReady1Id,
      orderNumber: '1041',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'ready',
      totalAmount: 24000,
      customerName: 'Sarah Jenkins',
      statusToken: crypto.randomBytes(16).toString('hex')
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: orderAlphaReady1Id,
        productName: 'Paneer Butter Masala',
        quantity: 2,
        unitPrice: 12000,
        subtotal: 24000
      }
    ]);

    // Order 2: READY on pass
    orderAlphaReady2Id = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlphaReady2Id,
      orderNumber: '1042',
      restaurantId: restAlphaId,
      tableId: tableAlpha2Id,
      status: 'ready',
      totalAmount: 18000,
      customerName: 'Rajesh Patel',
      statusToken: crypto.randomBytes(16).toString('hex')
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: orderAlphaReady2Id,
        productName: 'Butter Naan Basket',
        quantity: 3,
        unitPrice: 6000,
        subtotal: 18000
      }
    ]);

    // Order 3: PREPARING (not ready yet)
    orderAlphaPreparingId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlphaPreparingId,
      orderNumber: '1043',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'preparing',
      totalAmount: 15000,
      statusToken: crypto.randomBytes(16).toString('hex')
    });

    // Order 4: NEW (not ready yet)
    orderAlphaNewId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlphaNewId,
      orderNumber: '1044',
      restaurantId: restAlphaId,
      tableId: tableAlpha2Id,
      status: 'new',
      totalAmount: 32000,
      statusToken: crypto.randomBytes(16).toString('hex')
    });

    // Order 5: SERVED (already completed)
    orderAlphaServedId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderAlphaServedId,
      orderNumber: '1040',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'served',
      totalAmount: 40000,
      statusToken: crypto.randomBytes(16).toString('hex')
    });

    // Order for Beta
    orderBetaReadyId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderBetaReadyId,
      orderNumber: '9001',
      restaurantId: restBetaId,
      status: 'ready',
      totalAmount: 22000,
      statusToken: crypto.randomBytes(16).toString('hex')
    });
  });

  after(async () => {
    // Cleanup
    await db.delete(orderStatusHistory);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(restaurantTables);
    await db.delete(restaurantMembers);
    await db.delete(restaurants);
    await db.delete(session);
    await db.delete(user);
  });

  // ---------------------------------------------------------------------------
  // 1. Service View of READY Orders (Requirement 1 & 4)
  // ---------------------------------------------------------------------------
  test('Requirement 1 & 4: Staff can list READY orders with table and item details', async () => {
    const res = await request(app)
      .get('/api/orders?status=ready')
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 2, 'Should return at least the 2 seeded ready orders');

    // All returned orders must have status === 'ready'
    for (const order of res.body) {
      assert.equal(order.status, 'ready');
      assert.ok(order.orderNumber);
      assert.ok(order.table, 'Order should have table info');
      assert.ok(order.table.tableNumber, 'Order should clearly expose table number');
      assert.ok(Array.isArray(order.items), 'Order should include items snapshot');
      assert.ok(order.items.length > 0, 'Items should not be empty');
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Mark Order SERVED & Enforce READY -> SERVED Transition (Requirements 2 & 3)
  // ---------------------------------------------------------------------------
  test('Requirements 2 & 3: Floor staff successfully marks a READY order as SERVED', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaReady1Id}/status`)
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'served',
        expectedCurrentStatus: 'ready'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.order.status, 'served');
    assert.equal(res.body.order.orderNumber, '1041');
    assert.ok(res.body.order.table, 'Response must include table context');
    assert.equal(res.body.order.table.tableNumber, 'Table 4');

    // Verify in database
    const [dbOrder] = await db.select().from(orders).where(eq(orders.id, orderAlphaReady1Id));
    assert.equal(dbOrder?.status, 'served');
  });

  // ---------------------------------------------------------------------------
  // 3. Status History Audit Trail (Requirement 6)
  // ---------------------------------------------------------------------------
  test('Requirement 6: Served transition records timestamp, actor userId and role in audit history', async () => {
    const [historyEntry] = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderAlphaReady1Id));

    assert.ok(historyEntry, 'Audit record must exist in orderStatusHistory');
    assert.equal(historyEntry.fromStatus, 'ready');
    assert.equal(historyEntry.toStatus, 'served');
    assert.equal(historyEntry.changedByUserId, userAlphaStaffId);
    assert.equal(historyEntry.changedByRole, 'staff');
    assert.ok(historyEntry.createdAt instanceof Date || typeof historyEntry.createdAt === 'string');
  });

  // ---------------------------------------------------------------------------
  // 4. Strict Transition Enforcement: READY -> SERVED ONLY (Requirement 3)
  // ---------------------------------------------------------------------------
  test('Requirement 3: Reject marking NEW order directly as SERVED (status jump)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaNewId}/status`)
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'served'
      });

    assert.equal(res.status, 400);
    assert.ok(
      JSON.stringify(res.body).includes('Invalid transition') ||
      JSON.stringify(res.body).includes('INVALID_TRANSITION')
    );

    // Verify order in DB did not change
    const [dbOrder] = await db.select().from(orders).where(eq(orders.id, orderAlphaNewId));
    assert.equal(dbOrder?.status, 'new');
  });

  test('Requirement 3: Reject marking PREPARING order directly as SERVED (skipping READY)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaPreparingId}/status`)
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'served'
      });

    assert.equal(res.status, 400);
    assert.ok(
      JSON.stringify(res.body).includes('Invalid transition') ||
      JSON.stringify(res.body).includes('INVALID_TRANSITION')
    );

    const [dbOrder] = await db.select().from(orders).where(eq(orders.id, orderAlphaPreparingId));
    assert.equal(dbOrder?.status, 'preparing');
  });

  // ---------------------------------------------------------------------------
  // 5. Duplicate Action Prevention & Concurrency Protection (Requirement 7)
  // ---------------------------------------------------------------------------
  test('Requirement 7: Sending expectedCurrentStatus=ready on already served order returns 409 Conflict', async () => {
    // orderAlphaReady1Id is now already SERVED
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaReady1Id}/status`)
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'served',
        expectedCurrentStatus: 'ready' // Expected ready, but actual is served!
      });

    assert.equal(res.status, 409, 'Must return 409 Conflict on concurrency conflict');
    assert.ok(
      JSON.stringify(res.body).includes('Order status conflict') ||
      JSON.stringify(res.body).includes('conflict')
    );
  });

  test('Requirement 7: Subsequent attempt to mark served order as served without expectedCurrentStatus returns 400', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaReady1Id}/status`)
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'served'
      });

    assert.equal(res.status, 400);
    assert.ok(
      JSON.stringify(res.body).includes('already in status') ||
      JSON.stringify(res.body).includes('terminal') ||
      JSON.stringify(res.body).includes('already been served')
    );
  });

  test('Requirement 7: Served is a terminal state that cannot transition to any other status', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaServedId}/status`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'cancelled'
      });

    assert.equal(res.status, 400);
    assert.ok(
      JSON.stringify(res.body).includes('already been served') ||
      JSON.stringify(res.body).includes('terminal')
    );
  });

  // ---------------------------------------------------------------------------
  // 6. Role Authorization (Requirement 2)
  // ---------------------------------------------------------------------------
  test('Requirement 2: Kitchen role can also mark READY order as SERVED', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaReady2Id}/status`)
      .set('Cookie', cookieAlphaKitchen)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'served',
        expectedCurrentStatus: 'ready'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.order.status, 'served');

    const [dbOrder] = await db.select().from(orders).where(eq(orders.id, orderAlphaReady2Id));
    assert.equal(dbOrder?.status, 'served');
  });

  test('Requirement 2: Unauthenticated request to mark served is rejected with 401', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaReady2Id}/status`)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'served'
      });

    assert.equal(res.status, 401);
  });

  test('Requirement 2: Non-member user is rejected with 403 Forbidden', async () => {
    // Beta owner has no membership in Alpha
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaPreparingId}/status`)
      .set('Cookie', cookieBetaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        status: 'ready'
      });

    assert.equal(res.status, 403);
  });

  // ---------------------------------------------------------------------------
  // 7. Strict Tenant Isolation (Requirement 8)
  // ---------------------------------------------------------------------------
  test('Requirement 8: Staff of Restaurant Alpha cannot update Restaurant Beta order (404 IDOR)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderBetaReadyId}/status`)
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId) // Passing Alpha's header for Beta's order
      .send({
        status: 'served',
        expectedCurrentStatus: 'ready'
      });

    assert.equal(res.status, 404, 'Must return 404 Not Found to prevent leaking existence of other tenants orders');
  });
});

