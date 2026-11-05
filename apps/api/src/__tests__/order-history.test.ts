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
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Order History, Pagination & Operational Polish API (Task 19)', () => {
  let restAlphaId: string;
  let restBetaId: string;

  let userAlphaOwnerId: string;
  let userBetaOwnerId: string;

  let cookieAlphaOwner: string;
  let cookieBetaOwner: string;

  let tableAlpha1Id: string;
  let tableAlpha2Id: string;
  let tableBeta1Id: string;

  let catAlphaId: string;
  let prodAlpha1Id: string;
  let prodAlpha2Id: string;

  // Order IDs
  let orderAlphaIds: string[] = [];
  let orderBetaId: string;
  let servedOrderAlphaId: string;
  let cancelledOrderAlphaId: string;

  const now = Date.now();
  const restAlphaSlug = `history-alpha-${now}`;
  const restBetaSlug = `history-beta-${now}`;

  before(async () => {
    // 1. Create Restaurants Alpha & Beta
    restAlphaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restAlphaId,
      name: 'Alpha Grand Diner',
      slug: restAlphaSlug,
      currency: 'INR',
      isActive: true
    });

    restBetaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restBetaId,
      name: 'Beta Bistro',
      slug: restBetaSlug,
      currency: 'INR',
      isActive: true
    });

    // 2. Auth Users
    const alphaRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Owner',
        email: `alpha-hist-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaOwner = alphaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const alphaJson = await alphaRes.json();
    userAlphaOwnerId = alphaJson.user.id;
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restAlphaId,
      userId: userAlphaOwnerId,
      role: 'owner'
    });

    const betaRes = await auth.api.signUpEmail({
      body: {
        name: 'Beta Owner',
        email: `beta-hist-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieBetaOwner = betaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const betaJson = await betaRes.json();
    userBetaOwnerId = betaJson.user.id;
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restBetaId,
      userId: userBetaOwnerId,
      role: 'owner'
    });

    // 3. Tables
    tableAlpha1Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableAlpha1Id,
      restaurantId: restAlphaId,
      tableNumber: 'T-01',
      tableToken: crypto.randomBytes(16).toString('hex'),
      capacity: 4,
      isActive: true
    });

    tableAlpha2Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableAlpha2Id,
      restaurantId: restAlphaId,
      tableNumber: 'T-02',
      tableToken: crypto.randomBytes(16).toString('hex'),
      capacity: 2,
      isActive: true
    });

    tableBeta1Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableBeta1Id,
      restaurantId: restBetaId,
      tableNumber: 'B-01',
      tableToken: crypto.randomBytes(16).toString('hex'),
      capacity: 4,
      isActive: true
    });

    // 4. Category & Products
    catAlphaId = crypto.randomUUID();
    await db.insert(categories).values({
      id: catAlphaId,
      restaurantId: restAlphaId,
      name: 'Main Course',
      sortOrder: 1
    });

    prodAlpha1Id = crypto.randomUUID();
    await db.insert(products).values({
      id: prodAlpha1Id,
      restaurantId: restAlphaId,
      categoryId: catAlphaId,
      name: 'Biryani Special',
      price: 32000, // ₹320
      isAvailable: true
    });

    prodAlpha2Id = crypto.randomUUID();
    await db.insert(products).values({
      id: prodAlpha2Id,
      restaurantId: restAlphaId,
      categoryId: catAlphaId,
      name: 'Mango Lassi',
      price: 8000, // ₹80
      isAvailable: true
    });

    // 5. Seed 5 orders for Restaurant Alpha with distinct timestamps
    // Order 1: NEW (T-01, Priya Sharma)
    const o1 = crypto.randomUUID();
    orderAlphaIds.push(o1);
    await db.insert(orders).values({
      id: o1,
      orderNumber: '5001',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'new',
      totalAmount: 40000,
      customerName: 'Priya Sharma',
      customerPhone: '+91 99999 11111',
      createdAt: new Date(Date.now() - 50000)
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: o1,
        productId: prodAlpha1Id,
        productName: 'Biryani Special',
        quantity: 1,
        unitPrice: 32000,
        subtotal: 32000
      },
      {
        id: crypto.randomUUID(),
        orderId: o1,
        productId: prodAlpha2Id,
        productName: 'Mango Lassi',
        quantity: 1,
        unitPrice: 8000,
        subtotal: 8000
      }
    ]);

    // Order 2: ACCEPTED (T-02, Rohan Mehra)
    const o2 = crypto.randomUUID();
    orderAlphaIds.push(o2);
    await db.insert(orders).values({
      id: o2,
      orderNumber: '5002',
      restaurantId: restAlphaId,
      tableId: tableAlpha2Id,
      status: 'accepted',
      totalAmount: 32000,
      customerName: 'Rohan Mehra',
      createdAt: new Date(Date.now() - 40000)
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: o2,
        productId: prodAlpha1Id,
        productName: 'Biryani Special',
        quantity: 1,
        unitPrice: 32000,
        subtotal: 32000
      }
    ]);

    // Order 3: PREPARING (T-01, Ananya Roy)
    const o3 = crypto.randomUUID();
    orderAlphaIds.push(o3);
    await db.insert(orders).values({
      id: o3,
      orderNumber: '5003',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'preparing',
      totalAmount: 16000,
      customerName: 'Ananya Roy',
      createdAt: new Date(Date.now() - 30000)
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: o3,
        productId: prodAlpha2Id,
        productName: 'Mango Lassi',
        quantity: 2,
        unitPrice: 8000,
        subtotal: 16000
      }
    ]);

    // Order 4: SERVED (T-01, Rajesh Khanna)
    servedOrderAlphaId = crypto.randomUUID();
    orderAlphaIds.push(servedOrderAlphaId);
    await db.insert(orders).values({
      id: servedOrderAlphaId,
      orderNumber: '5004',
      restaurantId: restAlphaId,
      tableId: tableAlpha1Id,
      status: 'served',
      totalAmount: 32000,
      customerName: 'Rajesh Khanna',
      createdAt: new Date(Date.now() - 20000)
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: servedOrderAlphaId,
        productId: prodAlpha1Id,
        productName: 'Biryani Special',
        quantity: 1,
        unitPrice: 32000,
        subtotal: 32000
      }
    ]);
    await db.insert(orderStatusHistory).values({
      id: crypto.randomUUID(),
      orderId: servedOrderAlphaId,
      fromStatus: 'ready',
      toStatus: 'served',
      changedByUserId: userAlphaOwnerId,
      changedByRole: 'owner',
      createdAt: new Date(Date.now() - 10000)
    });

    // Order 5: CANCELLED (T-02, Suresh Kumar)
    cancelledOrderAlphaId = crypto.randomUUID();
    orderAlphaIds.push(cancelledOrderAlphaId);
    await db.insert(orders).values({
      id: cancelledOrderAlphaId,
      orderNumber: '5005',
      restaurantId: restAlphaId,
      tableId: tableAlpha2Id,
      status: 'cancelled',
      totalAmount: 8000,
      customerName: 'Suresh Kumar',
      createdAt: new Date(Date.now() - 10000)
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: cancelledOrderAlphaId,
        productId: prodAlpha2Id,
        productName: 'Mango Lassi',
        quantity: 1,
        unitPrice: 8000,
        subtotal: 8000
      }
    ]);
    await db.insert(orderStatusHistory).values({
      id: crypto.randomUUID(),
      orderId: cancelledOrderAlphaId,
      fromStatus: 'new',
      toStatus: 'cancelled',
      changedByUserId: userAlphaOwnerId,
      changedByRole: 'owner',
      reason: 'Customer left',
      createdAt: new Date(Date.now() - 5000)
    });

    // 6. Order for Restaurant Beta
    orderBetaId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderBetaId,
      orderNumber: '9001',
      restaurantId: restBetaId,
      tableId: tableBeta1Id,
      status: 'new',
      totalAmount: 99900,
      customerName: 'Secret Beta Guest'
    });
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

  test('1. Stable Pagination: Returns page 1 with accurate pagination metadata', async () => {
    const res = await request(app)
      .get('/api/orders?page=1&limit=2&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.ok(res.body.orders);
    assert.ok(res.body.pagination);

    assert.equal(res.body.orders.length, 2);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 2);
    assert.equal(res.body.pagination.totalOrders, 5);
    assert.equal(res.body.pagination.totalPages, 3);
    assert.equal(res.body.pagination.hasNextPage, true);
    assert.equal(res.body.pagination.hasPrevPage, false);

    // Should be ordered DESC by createdAt (5005, then 5004)
    assert.equal(res.body.orders[0].orderNumber, '5005');
    assert.equal(res.body.orders[1].orderNumber, '5004');
  });

  test('2. Stable Pagination: Page 2 returns the next distinct slice with no duplicates', async () => {
    const page1Res = await request(app)
      .get('/api/orders?page=1&limit=2&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    const page2Res = await request(app)
      .get('/api/orders?page=2&limit=2&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(page2Res.status, 200);
    assert.equal(page2Res.body.orders.length, 2);
    assert.equal(page2Res.body.pagination.page, 2);
    assert.equal(page2Res.body.pagination.hasNextPage, true);
    assert.equal(page2Res.body.pagination.hasPrevPage, true);

    const p1Ids = page1Res.body.orders.map((o: any) => o.id);
    const p2Ids = page2Res.body.orders.map((o: any) => o.id);

    // Verify completely disjoint
    const overlap = p1Ids.filter((id: string) => p2Ids.includes(id));
    assert.equal(overlap.length, 0, 'Page 1 and Page 2 should not share any orders');

    assert.equal(page2Res.body.orders[0].orderNumber, '5003');
    assert.equal(page2Res.body.orders[1].orderNumber, '5002');
  });

  test('3. Stable Pagination: Final Page 3 returns remainder', async () => {
    const res = await request(app)
      .get('/api/orders?page=3&limit=2&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.orders.length, 1);
    assert.equal(res.body.pagination.page, 3);
    assert.equal(res.body.pagination.hasNextPage, false);
    assert.equal(res.body.pagination.hasPrevPage, true);
    assert.equal(res.body.orders[0].orderNumber, '5001');
  });

  test('4. Backward Compatibility: Omitting page returns raw array with X-Total-Count', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 5);
    assert.equal(res.headers['x-total-count'], '5');
  });

  test('5. Status Filters: view=open returns only open orders', async () => {
    const res = await request(app)
      .get('/api/orders?view=open&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.orders.length, 3); // 5001 (new), 5002 (accepted), 5003 (preparing)
    res.body.orders.forEach((o: any) => {
      assert.ok(['new', 'accepted', 'preparing', 'ready'].includes(o.status));
    });
    assert.equal(res.body.pagination.totalOrders, 3);
  });

  test('6. Status Filters: status=served returns only served orders', async () => {
    const res = await request(app)
      .get('/api/orders?status=served&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.orders.length, 1);
    assert.equal(res.body.orders[0].orderNumber, '5004');
    assert.equal(res.body.orders[0].status, 'served');
    assert.ok(res.body.orders[0].servedAt, 'servedAt timestamp must be populated');
  });

  test('7. Status Filters: status=cancelled returns only cancelled orders', async () => {
    const res = await request(app)
      .get('/api/orders?status=cancelled&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.orders.length, 1);
    assert.equal(res.body.orders[0].orderNumber, '5005');
    assert.equal(res.body.orders[0].status, 'cancelled');
    assert.ok(res.body.orders[0].rejectedAt, 'rejectedAt timestamp must be populated');
  });

  test('8. Date Boundary Filtering: date=today returns all orders created today', async () => {
    const res = await request(app)
      .get('/api/orders?date=today&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.totalOrders, 5);
  });

  test('9. Date Boundary Filtering: date=yesterday returns 0 orders for today seeds', async () => {
    const res = await request(app)
      .get('/api/orders?date=yesterday&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.totalOrders, 0);
    assert.equal(res.body.orders.length, 0);
  });

  test('10. Multi-Column Search: By order number', async () => {
    const res = await request(app)
      .get('/api/orders?search=5003&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.orders.length, 1);
    assert.equal(res.body.orders[0].orderNumber, '5003');
  });

  test('11. Multi-Column Search: By customer name', async () => {
    const res = await request(app)
      .get('/api/orders?search=Priya&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.equal(res.body.orders.length, 1);
    assert.equal(res.body.orders[0].customerName, 'Priya Sharma');
  });

  test('12. Multi-Column Search: By table number', async () => {
    const res = await request(app)
      .get('/api/orders?search=T-02&paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    // T-02 has orders 5002 and 5005
    assert.equal(res.body.orders.length, 2);
    res.body.orders.forEach((o: any) => {
      assert.equal(o.table.tableNumber, 'T-02');
    });
  });

  test('13. Order Detail GET /api/orders/:id includes servedAt / rejectedAt', async () => {
    const servedRes = await request(app)
      .get(`/api/orders/${servedOrderAlphaId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(servedRes.status, 200);
    assert.equal(servedRes.body.status, 'served');
    assert.ok(servedRes.body.servedAt);

    const cancelledRes = await request(app)
      .get(`/api/orders/${cancelledOrderAlphaId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(cancelledRes.status, 200);
    assert.equal(cancelledRes.body.status, 'cancelled');
    assert.ok(cancelledRes.body.rejectedAt);
  });

  test('14. Snapshot Preservation: Updating or archiving product does not alter order item snapshot', async () => {
    // Modify product price and name in the catalog
    await db
      .update(products)
      .set({
        name: 'Biryani Special Supreme (Renamed)',
        price: 99900, // Price hiked to ₹999
        isAvailable: false
      })
      .where(eq(products.id, prodAlpha1Id));

    // Fetch order 5001 which includes Biryani Special
    const res = await request(app)
      .get(`/api/orders/${orderAlphaIds[0]}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    const biryaniItem = res.body.items.find((i: any) => i.productId === prodAlpha1Id);
    assert.ok(biryaniItem);

    // Historic snapshot values MUST remain unchanged
    assert.equal(biryaniItem.productName, 'Biryani Special');
    assert.equal(biryaniItem.unitPrice, 32000);
    assert.equal(biryaniItem.subtotal, 32000);
  });

  test('15. Tenant Isolation: Restaurant Alpha cannot see Restaurant Beta order in list', async () => {
    const res = await request(app)
      .get('/api/orders?paginate=true')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    const betaOrderFound = res.body.orders.some((o: any) => o.id === orderBetaId);
    assert.equal(betaOrderFound, false, 'Restaurant Alpha must not see Beta orders');
  });

  test('16. Tenant Isolation: Restaurant Alpha cannot fetch Restaurant Beta order detail', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderBetaId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    // IDOR protection should return 404
    assert.equal(res.status, 404);
  });

  test('17. Tenant Isolation: Restaurant Alpha cannot update Restaurant Beta order status', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderBetaId}/status`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({ status: 'accepted' });

    assert.equal(res.status, 404);
  });
});
