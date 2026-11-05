import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, user, restaurants, restaurantMembers, categories, products, restaurantTables, orders } from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import { requireTenant, requireTenantPermission, getPermissionsForRole } from '../middleware/tenant-auth';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Multi-Tenant Authorization & IDOR Protection', () => {
  // Test IDs and state
  let userAlphaId: string;
  let userBetaId: string;
  let userKitchenAlphaId: string;

  let cookieAlpha: string;
  let cookieBeta: string;
  let cookieKitchenAlpha: string;

  const restAlphaId = crypto.randomUUID();
  const restBetaId = crypto.randomUUID();
  const restInactiveId = crypto.randomUUID();

  const memberAlphaId = crypto.randomUUID();
  const memberBetaId = crypto.randomUUID();
  const memberKitchenAlphaId = crypto.randomUUID();
  const memberInactiveId = crypto.randomUUID();

  const catAlphaId = crypto.randomUUID();
  const catBetaId = crypto.randomUUID();

  const prodAlphaId = crypto.randomUUID();
  const prodBetaId = crypto.randomUUID();

  const tableAlphaId = crypto.randomUUID();
  const tableBetaId = crypto.randomUUID();

  const orderAlphaId = crypto.randomUUID();
  const orderBetaId = crypto.randomUUID();

  before(async () => {
    // 1. Create Users via Better Auth so genuine HMAC signed cookies are generated
    const now = Date.now();

    const alphaRes = await auth.api.signUpEmail({
      body: {
        name: 'Owner Alpha',
        email: `alpha-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlpha = alphaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const alphaJson = await alphaRes.json();
    userAlphaId = alphaJson.user.id;

    const betaRes = await auth.api.signUpEmail({
      body: {
        name: 'Owner Beta',
        email: `beta-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieBeta = betaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const betaJson = await betaRes.json();
    userBetaId = betaJson.user.id;

    const kitchenRes = await auth.api.signUpEmail({
      body: {
        name: 'Kitchen Staff Alpha',
        email: `kitchen-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieKitchenAlpha = kitchenRes.headers.get('set-cookie')?.split(';')[0] || '';
    const kitchenJson = await kitchenRes.json();
    userKitchenAlphaId = kitchenJson.user.id;

    // 2. Seed Restaurants
    await db.insert(restaurants).values([
      {
        id: restAlphaId,
        name: 'Restaurant Alpha',
        slug: `alpha-${now}`,
        isActive: true
      },
      {
        id: restBetaId,
        name: 'Restaurant Beta',
        slug: `beta-${now}`,
        isActive: true
      },
      {
        id: restInactiveId,
        name: 'Restaurant Inactive',
        slug: `inactive-${now}`,
        isActive: false
      }
    ]);

    // 3. Seed Memberships
    await db.insert(restaurantMembers).values([
      {
        id: memberAlphaId,
        restaurantId: restAlphaId,
        userId: userAlphaId,
        role: 'owner'
      },
      {
        id: memberBetaId,
        restaurantId: restBetaId,
        userId: userBetaId,
        role: 'owner'
      },
      {
        id: memberKitchenAlphaId,
        restaurantId: restAlphaId,
        userId: userKitchenAlphaId,
        role: 'kitchen'
      },
      {
        id: memberInactiveId,
        restaurantId: restInactiveId,
        userId: userAlphaId,
        role: 'owner'
      }
    ]);

    // 4. Seed Categories
    await db.insert(categories).values([
      {
        id: catAlphaId,
        restaurantId: restAlphaId,
        name: 'Alpha Starters',
        sortOrder: 0
      },
      {
        id: catBetaId,
        restaurantId: restBetaId,
        name: 'Beta Starters',
        sortOrder: 0
      }
    ]);

    // 5. Seed Products
    await db.insert(products).values([
      {
        id: prodAlphaId,
        restaurantId: restAlphaId,
        categoryId: catAlphaId,
        name: 'Alpha Burger',
        price: 25000, // 250.00 INR
        isAvailable: true
      },
      {
        id: prodBetaId,
        restaurantId: restBetaId,
        categoryId: catBetaId,
        name: 'Beta Pizza',
        price: 45000, // 450.00 INR
        isAvailable: true
      }
    ]);

    // 6. Seed Tables
    await db.insert(restaurantTables).values([
      {
        id: tableAlphaId,
        restaurantId: restAlphaId,
        tableNumber: 'A1',
        tableToken: crypto.randomBytes(16).toString('hex')
      },
      {
        id: tableBetaId,
        restaurantId: restBetaId,
        tableNumber: 'B1',
        tableToken: crypto.randomBytes(16).toString('hex')
      }
    ]);

    // 7. Seed Orders
    await db.insert(orders).values([
      {
        id: orderAlphaId,
        restaurantId: restAlphaId,
        tableId: tableAlphaId,
        orderNumber: '1001',
        status: 'pending',
        totalAmount: 25000
      },
      {
        id: orderBetaId,
        restaurantId: restBetaId,
        tableId: tableBetaId,
        orderNumber: '2001',
        status: 'pending',
        totalAmount: 45000
      }
    ]);
  });

  after(async () => {
    // Teardown in correct foreign-key order
    await db.delete(orders).where(inArray(orders.id, [orderAlphaId, orderBetaId]));
    await db.delete(restaurantTables).where(inArray(restaurantTables.id, [tableAlphaId, tableBetaId]));
    await db.delete(products).where(inArray(products.id, [prodAlphaId, prodBetaId]));
    await db.delete(categories).where(inArray(categories.id, [catAlphaId, catBetaId]));
    await db.delete(restaurantMembers).where(
      inArray(restaurantMembers.id, [memberAlphaId, memberBetaId, memberKitchenAlphaId, memberInactiveId])
    );
    await db.delete(restaurants).where(inArray(restaurants.id, [restAlphaId, restBetaId, restInactiveId]));
    if (userAlphaId && userBetaId && userKitchenAlphaId) {
      await db.delete(user).where(inArray(user.id, [userAlphaId, userBetaId, userKitchenAlphaId]));
    }
  });

  // -------------------------------------------------------------------------
  // Unit & Context Resolution Tests
  // -------------------------------------------------------------------------
  test('requireTenant rejects request without x-restaurant-id or param with 400 Bad Request', async () => {
    let statusCalled: number | null = null;
    let jsonCalled: any = null;

    const mockReq: any = {
      user: { id: userAlphaId },
      headers: {},
      params: {},
      query: {}
    };
    const mockRes: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      }
    };

    const middleware = requireTenant();
    await middleware(mockReq, mockRes, () => {});

    assert.equal(statusCalled, 400);
    assert.equal(jsonCalled.error, 'Bad Request');
  });

  test('requireTenant rejects inactive restaurant with 403 Forbidden', async () => {
    let statusCalled: number | null = null;
    let jsonCalled: any = null;

    const mockReq: any = {
      user: { id: userAlphaId },
      headers: { 'x-restaurant-id': restInactiveId },
      params: {},
      query: {}
    };
    const mockRes: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      }
    };

    const middleware = requireTenant();
    await middleware(mockReq, mockRes, () => {});

    assert.equal(statusCalled, 403);
    assert.ok(jsonCalled.message.includes('inactive'));
  });

  test('requireTenant attaches strongly-typed req.tenant with role and permissions', async () => {
    let nextCalled = false;

    const mockReq: any = {
      user: { id: userAlphaId },
      headers: { 'x-restaurant-id': restAlphaId },
      params: {},
      query: {}
    };
    const mockRes: any = {
      status() {
        return this;
      },
      json() {}
    };

    const middleware = requireTenant(['owner', 'admin']);
    await middleware(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.ok(mockReq.tenant, 'req.tenant should be defined');
    assert.equal(mockReq.tenant.restaurantId, restAlphaId);
    assert.equal(mockReq.tenant.role, 'owner');
    assert.equal(mockReq.tenant.permissions.canManageRestaurant, true);
    assert.equal(mockReq.tenant.permissions.canManageMenu, true);
    assert.equal(mockReq.tenant.permissions.canCancelOrders, true);
  });

  test('requireTenantPermission grants access when role possesses permission and denies when lacking', async () => {
    let nextCalled = false;
    let statusCalled: number | null = null;

    const mockRes: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json() {}
    };

    // Case A: Owner has canManageMenu -> passes
    const ownerReq: any = {
      tenant: {
        role: 'owner',
        permissions: getPermissionsForRole('owner')
      }
    };
    const menuPermMiddleware = requireTenantPermission('canManageMenu');
    menuPermMiddleware(ownerReq, mockRes, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);

    // Case B: Kitchen lacks canManageMenu -> rejected with 403
    let kitchenNextCalled = false;
    const kitchenReq: any = {
      tenant: {
        role: 'kitchen',
        permissions: getPermissionsForRole('kitchen')
      }
    };
    menuPermMiddleware(kitchenReq, mockRes, () => {
      kitchenNextCalled = true;
    });
    assert.equal(kitchenNextCalled, false);
    assert.equal(statusCalled, 403);
  });

  // -------------------------------------------------------------------------
  // Integration & IDOR Attack Prevention Tests
  // -------------------------------------------------------------------------
  test('IDOR Attack 1: User Alpha attempting to access Restaurant Beta via header receives 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restBetaId); // User Alpha is NOT a member of Restaurant Beta

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Forbidden');
    assert.ok(res.body.message.includes('not an authorized member'));
  });

  test('IDOR Attack 2: User Alpha attempting to update Restaurant Beta category receives 404 Not Found', async () => {
    // User Alpha authenticates for Restaurant Alpha, but targets catBetaId in path
    const res = await request(app)
      .patch(`/api/categories/${catBetaId}`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ name: 'Hacked Beta Category' });

    assert.equal(res.status, 404);

    // Verify database was NOT modified
    const [unchanged] = await db.select().from(categories).where(eq(categories.id, catBetaId));
    assert.equal(unchanged!.name, 'Beta Starters', 'Restaurant Beta category name must not have changed');
  });

  test('IDOR Attack 3: User Alpha attempting to delete Restaurant Beta category receives 404 Not Found', async () => {
    const res = await request(app)
      .delete(`/api/categories/${catBetaId}`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 404);

    // Verify category still exists in database
    const [stillExists] = await db.select().from(categories).where(eq(categories.id, catBetaId));
    assert.ok(stillExists, 'Restaurant Beta category must still exist in DB');
  });

  test('IDOR Attack 4: User Alpha attempting to update Restaurant Beta product receives 404 Not Found', async () => {
    const res = await request(app)
      .patch(`/api/products/${prodBetaId}`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ price: 100 }); // Attempt to change price of competitor product

    assert.equal(res.status, 404);

    const [unchanged] = await db.select().from(products).where(eq(products.id, prodBetaId));
    assert.equal(unchanged!.price, 45000, 'Restaurant Beta product price must remain unchanged');
  });

  test('IDOR Attack 5: User Alpha attempting to delete Restaurant Beta product receives 404 Not Found', async () => {
    const res = await request(app)
      .delete(`/api/products/${prodBetaId}`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 404);

    const [stillExists] = await db.select().from(products).where(eq(products.id, prodBetaId));
    assert.ok(stillExists, 'Restaurant Beta product must still exist');
  });

  test('IDOR Attack 6: User Alpha attempting to regenerate QR for Restaurant Beta table receives 404 Not Found', async () => {
    const [originalTable] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, tableBetaId));

    const res = await request(app)
      .post(`/api/tables/${tableBetaId}/regenerate-qr`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 404);

    const [afterTable] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, tableBetaId));
    assert.equal(afterTable!.tableToken, originalTable!.tableToken, 'Table token must not have changed');
  });

  test('IDOR Attack 7: User Alpha attempting to update Restaurant Beta table receives 404 Not Found', async () => {
    const res = await request(app)
      .patch(`/api/tables/${tableBetaId}`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ tableNumber: 'HACKED-TABLE' });

    assert.equal(res.status, 404);

    const [afterTable] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, tableBetaId));
    assert.equal(afterTable!.tableNumber, 'B1');
  });

  test('IDOR Attack 8: User Alpha attempting to mutate Restaurant Beta order status receives 404 Not Found', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderBetaId}/status`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'preparing' });

    assert.equal(res.status, 404);

    const [unchangedOrder] = await db.select().from(orders).where(eq(orders.id, orderBetaId));
    assert.equal(unchangedOrder!.status, 'pending', 'Order Beta status must remain pending');
  });

  test('IDOR Attack 9: User Alpha attempting to modify Restaurant Beta profile receives 403 Forbidden', async () => {
    const res = await request(app)
      .patch(`/api/restaurants/${restBetaId}`)
      .set('Cookie', [cookieAlpha])
      .send({ name: 'Hacked Restaurant' });

    assert.equal(res.status, 403);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(bodyStr.includes('not an authorized member'));
  });

  test('Role Boundary: Kitchen staff attempting to create category receives 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', [cookieKitchenAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ name: 'Kitchen Created Category' });

    assert.equal(res.status, 403);
    assert.ok(JSON.stringify(res.body).includes('Only owner or admin can create categories'));
  });

  test('Role Boundary: Kitchen staff attempting to cancel order receives 403 Forbidden', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaId}/status`)
      .set('Cookie', [cookieKitchenAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'cancelled' });

    assert.equal(res.status, 403);
    assert.ok(
      JSON.stringify(res.body).includes('Only owner or admin can cancel') ||
      JSON.stringify(res.body).includes('not permitted to cancel orders')
    );
  });

  test('Authorized Action: Kitchen staff successfully updates order status to preparing', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderAlphaId}/status`)
      .set('Cookie', [cookieKitchenAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'preparing' });

    assert.equal(res.status, 200);
    assert.equal(res.body.order.status, 'preparing');

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, orderAlphaId));
    assert.equal(updatedOrder!.status, 'preparing');
  });

  test('Authorized Action: Owner Alpha successfully updates their own category, product and table', async () => {
    // 1. Update Category
    const catRes = await request(app)
      .patch(`/api/categories/${catAlphaId}`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ name: 'Updated Alpha Starters' });

    assert.equal(catRes.status, 200);
    assert.equal(catRes.body.name, 'Updated Alpha Starters');

    // 2. Update Product
    const prodRes = await request(app)
      .patch(`/api/products/${prodAlphaId}`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId)
      .send({ price: 29900 });

    assert.equal(prodRes.status, 200);
    assert.equal(prodRes.body.price, 29900);

    // 3. Regenerate Table QR
    const tableRes = await request(app)
      .post(`/api/tables/${tableAlphaId}/regenerate-qr`)
      .set('Cookie', [cookieAlpha])
      .set('x-restaurant-id', restAlphaId);

    assert.equal(tableRes.status, 200);
    assert.ok(tableRes.body.tableToken);
  });
});
