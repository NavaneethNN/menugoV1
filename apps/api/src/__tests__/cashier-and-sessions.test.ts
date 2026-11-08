import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, restaurants, restaurantMembers, restaurantTables, tableSessions, categories, products, orders, pool } from '@menugo/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Cashier Module & Table Session Security', () => {
  after(async () => {
    await pool.end().catch(() => {});
  });
  let ownerACookie: string;
  let ownerAId: string;
  let restAId: string;
  let slugA: string;

  let staffCookie: string;
  let staffId: string;
  let staffMemberId: string;

  let otherRestCookie: string;
  let otherRestId: string;

  let table1Id: string;
  let table1Token: string;
  let productId: string;

  const now = Date.now();

  before(async () => {
    // 1. Create Owner A & Restaurant A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Owner Alice',
        email: `alice-cashier-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    ownerACookie = resA.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonA = await resA.json();
    ownerAId = jsonA.user.id;

    slugA = `cashier-bistro-${now}`;
    const [restA] = await db
      .insert(restaurants)
      .values({
        id: crypto.randomUUID(),
        name: 'Cashier Bistro',
        slug: slugA,
        currency: 'INR'
      })
      .returning();
    if (!restA) throw new Error('Failed to create restaurant A');
    restAId = restA.id;

    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restAId,
      userId: ownerAId,
      role: 'owner',
      canCashier: true
    });

    // 2. Create Staff member for Restaurant A (initially without cashier permission)
    const resStaff = await auth.api.signUpEmail({
      body: {
        name: 'Waiter Bob',
        email: `bob-waiter-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    staffCookie = resStaff.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonStaff = await resStaff.json();
    staffId = jsonStaff.user.id;

    const [staffMember] = await db
      .insert(restaurantMembers)
      .values({
        id: crypto.randomUUID(),
        restaurantId: restAId,
        userId: staffId,
        role: 'staff',
        staffName: 'Waiter Bob',
        canCashier: false
      })
      .returning();
    if (!staffMember) throw new Error('Failed to create staff member');
    staffMemberId = staffMember.id;

    // 3. Create Owner & Restaurant B for multi-tenant isolation testing
    const resB = await auth.api.signUpEmail({
      body: {
        name: 'Owner B',
        email: `owner-b-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    otherRestCookie = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();

    const [restB] = await db
      .insert(restaurants)
      .values({
        id: crypto.randomUUID(),
        name: 'Other Diner',
        slug: `other-diner-${now}`,
        currency: 'INR'
      })
      .returning();
    if (!restB) throw new Error('Failed to create restaurant B');
    otherRestId = restB.id;

    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: otherRestId,
      userId: jsonB.user.id,
      role: 'owner',
      canCashier: true
    });

    // 4. Create Table 1 for Restaurant A
    table1Token = crypto.randomBytes(24).toString('hex');
    const [t1] = await db
      .insert(restaurantTables)
      .values({
        id: crypto.randomUUID(),
        restaurantId: restAId,
        tableNumber: 'Table 1',
        tableToken: table1Token,
        capacity: 4,
        isActive: true
      })
      .returning();
    if (!t1) throw new Error('Failed to create table 1');
    table1Id = t1.id;

    // 5. Create category & product for ordering
    const [cat] = await db
      .insert(categories)
      .values({
        id: crypto.randomUUID(),
        restaurantId: restAId,
        name: 'Main Course'
      })
      .returning();
    if (!cat) throw new Error('Failed to create category');

    const [prod] = await db
      .insert(products)
      .values({
        id: crypto.randomUUID(),
        restaurantId: restAId,
        categoryId: cat.id,
        name: 'Paneer Butter Masala',
        price: 28000, // ₹280.00
        isAvailable: true
      })
      .returning();
    if (!prod) throw new Error('Failed to create product');
    productId = prod.id;
  });

  let activeCustomerSessionToken: string;
  let activeSessionId: string;

  test('1. First customer scans Table 1 QR: session is auto-created and sessionToken issued', async () => {
    const res = await request(app).get(`/api/tables/verify/${table1Token}?restaurantSlug=${slugA}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.sessionActive, true);
    assert.equal(res.body.sessionMatches, true);
    assert.ok(res.body.session?.sessionToken, 'Must generate and return a session token');
    assert.equal(res.body.session?.status, 'active');

    activeCustomerSessionToken = res.body.session.sessionToken;
    activeSessionId = res.body.session.id;
  });

  test('2. Same customer returns with stored sessionToken: authorized to view menu', async () => {
    const res = await request(app)
      .get(`/api/tables/verify/${table1Token}?restaurantSlug=${slugA}&sessionToken=${activeCustomerSessionToken}`)
      .set('x-table-session-token', activeCustomerSessionToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.sessionMatches, true);
    assert.equal(res.body.session.sessionToken, activeCustomerSessionToken);
  });

  test('3. Second customer scans same QR without active sessionToken: blocked with TABLE_OCCUPIED', async () => {
    const res = await request(app).get(`/api/tables/verify/${table1Token}?restaurantSlug=${slugA}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.isOccupied, true);
    assert.equal(res.body.sessionMatches, false);
    assert.equal(res.body.error, 'TABLE_OCCUPIED');
  });

  test('4. Another party attempts to order at occupied table with wrong session token: rejected with 403', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send({
        restaurantSlug: slugA,
        tableToken: table1Token,
        tableSessionToken: 'wrong-or-imposter-token',
        customerName: 'Eve Imposter',
        items: [{ productId, quantity: 1 }]
      });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /active session from another party/i);
  });

  test('5. Valid customer places order with active sessionToken: succeeds and attaches tableSessionId', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send({
        restaurantSlug: slugA,
        tableToken: table1Token,
        tableSessionToken: activeCustomerSessionToken,
        customerName: 'Alice Customer',
        items: [{ productId, quantity: 2 }] // 2 * 28000 = 56000 paise (₹560)
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.order.totalAmount, 56000);

    // Verify order in DB has tableSessionId set
    const [dbOrder] = await db
      .select({ id: orders.id, tableSessionId: orders.tableSessionId })
      .from(orders)
      .where(eq(orders.id, res.body.order.id));

    assert.ok(dbOrder, 'Order must exist in database');
    assert.equal(dbOrder.tableSessionId, activeSessionId);
  });

  test('6. Staff member without Cashier permission cannot access Cashier Overview (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/cashier/tables')
      .set('Cookie', staffCookie)
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 403);
    assert.match(res.body.message, /canCashier is not granted/i);
  });

  test('7. Admin/Owner grants Cashier permission to Waiter Bob', async () => {
    const res = await request(app)
      .patch(`/api/restaurants/${restAId}/members/${staffMemberId}/cashier-permission`)
      .set('Cookie', ownerACookie)
      .set('x-restaurant-id', restAId)
      .send({ canCashier: true });

    assert.equal(res.status, 200);
    assert.equal(res.body.canCashier, true);
    assert.match(res.body.message, /Cashier permission granted/i);
  });

  test('8. Waiter Bob (now with Cashier permission) views Cashier Overview successfully', async () => {
    const res = await request(app)
      .get('/api/cashier/tables')
      .set('Cookie', staffCookie)
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.summary.totalTables, 1);
    assert.equal(res.body.summary.occupiedCount, 1);
    assert.equal(res.body.summary.totalActiveRevenuePaise, 56000);

    const table1 = res.body.tables.find((t: any) => t.id === table1Id);
    assert.ok(table1);
    assert.equal(table1.status, 'occupied');
    assert.equal(table1.activeSession.totalPaise, 56000);
    assert.equal(table1.activeSession.orderCount, 1);
  });

  test('9. Cashier retrieves itemized bill statement for Table 1', async () => {
    const res = await request(app)
      .get(`/api/cashier/tables/${table1Id}/bill`)
      .set('Cookie', staffCookie)
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.table.tableNumber, 'Table 1');
    assert.equal(res.body.grandTotalPaise, 56000);
    assert.equal(res.body.grandTotalFormatted, '₹560');
    assert.equal(res.body.orders.length, 1);
    assert.equal(res.body.orders[0].items[0].productName, 'Paneer Butter Masala');
  });

  test('10. Multi-tenant security: Cashier from Restaurant B cannot view or close Table 1 of Restaurant A', async () => {
    const viewRes = await request(app)
      .get(`/api/cashier/tables/${table1Id}/bill`)
      .set('Cookie', otherRestCookie)
      .set('x-restaurant-id', otherRestId);

    assert.equal(viewRes.status, 404);

    const closeRes = await request(app)
      .post(`/api/cashier/tables/${table1Id}/close-session`)
      .set('Cookie', otherRestCookie)
      .set('x-restaurant-id', otherRestId)
      .send({});

    assert.equal(closeRes.status, 404);
  });

  test('11. Cashier closes Table 1 session and releases the table', async () => {
    const res = await request(app)
      .post(`/api/cashier/tables/${table1Id}/close-session`)
      .set('Cookie', staffCookie)
      .set('x-restaurant-id', restAId)
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.session.status, 'closed');

    // Overview now shows 0 occupied, 1 available
    const overviewRes = await request(app)
      .get('/api/cashier/tables')
      .set('Cookie', staffCookie)
      .set('x-restaurant-id', restAId);

    assert.equal(overviewRes.status, 200);
    assert.equal(overviewRes.body.summary.occupiedCount, 0);
    assert.equal(overviewRes.body.summary.availableCount, 1);
  });

  test('11b. Cashier can still inspect / print bill statement after session was closed (recent session fallback)', async () => {
    const res = await request(app)
      .get(`/api/cashier/tables/${table1Id}/bill`)
      .set('Cookie', staffCookie)
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.table.tableNumber, 'Table 1');
    assert.equal(res.body.session.status, 'closed');
    assert.equal(res.body.grandTotalPaise, 56000);
    assert.equal(res.body.orders.length, 1);
  });

  test('12. Now a new customer scans Table 1: fresh session is initiated', async () => {
    const res = await request(app).get(`/api/tables/verify/${table1Token}?restaurantSlug=${slugA}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.isOccupied, false);
    assert.notEqual(res.body.session.sessionToken, activeCustomerSessionToken, 'New session must have distinct token');
  });

  test('13. Hierarchy Security: Admin cannot modify cashier permission of the restaurant owner (403 Forbidden)', async () => {
    // 1. Create an Admin user
    const resAdmin = await auth.api.signUpEmail({
      body: {
        name: 'Admin Joe',
        email: `admin-joe-${Date.now()}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    const adminCookie = resAdmin.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonAdmin = await resAdmin.json();

    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restAId,
      userId: jsonAdmin.user.id,
      role: 'admin',
      staffName: 'Admin Joe',
      canCashier: true
    });

    // 2. Fetch Owner A membership
    const [ownerMember] = await db
      .select({ id: restaurantMembers.id })
      .from(restaurantMembers)
      .where(and(eq(restaurantMembers.restaurantId, restAId), eq(restaurantMembers.userId, ownerAId)))
      .limit(1);

    assert.ok(ownerMember);

    // 3. Admin Joe attempts to revoke cashier permission from Owner A
    const res = await request(app)
      .patch(`/api/restaurants/${restAId}/members/${ownerMember.id}/cashier-permission`)
      .set('Cookie', adminCookie)
      .set('x-restaurant-id', restAId)
      .send({ canCashier: false });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /Administrators cannot modify permissions of other administrators or the owner/i);
  });
});
