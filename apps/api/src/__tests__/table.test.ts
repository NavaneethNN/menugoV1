import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, user, restaurants, restaurantMembers, restaurantTables } from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Table Management & QR Code Verification (Task 10)', () => {
  let userAId: string;
  let userBId: string;
  let staffAId: string;

  let cookieA: string;
  let cookieB: string;
  let cookieStaffA: string;

  let restAId: string;
  let restBId: string;

  let table1AId: string;
  let table1AToken: string;
  let table2AId: string;
  let table2AToken: string;
  let tableBId: string;

  const now = Date.now();
  const slugA = `table-rest-a-${now}`;
  const slugB = `table-rest-b-${now}`;

  before(async () => {
    // 1. Create Owner A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Owner Alice',
        email: `alice-table-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonA = await resA.json();
    userAId = jsonA.user.id;

    // 2. Create Owner B
    const resB = await auth.api.signUpEmail({
      body: {
        name: 'Owner Bob',
        email: `bob-table-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userBId = jsonB.user.id;

    // 3. Create Staff User for Restaurant A
    const resStaff = await auth.api.signUpEmail({
      body: {
        name: 'Staff Charlie',
        email: `charlie-table-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieStaffA = resStaff.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonStaff = await resStaff.json();
    staffAId = jsonStaff.user.id;

    // 4. Seed Restaurant A
    restAId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restAId,
      name: 'Alice Fine Dining',
      slug: slugA,
      isActive: true,
      currency: 'INR'
    });

    await db.insert(restaurantMembers).values([
      {
        id: crypto.randomUUID(),
        restaurantId: restAId,
        userId: userAId,
        role: 'owner'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: restAId,
        userId: staffAId,
        role: 'staff' // Staff has read-only access to tables
      }
    ]);

    // 5. Seed Restaurant B
    restBId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restBId,
      name: 'Bob Burger Bar',
      slug: slugB,
      isActive: true,
      currency: 'INR'
    });

    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restBId,
      userId: userBId,
      role: 'owner'
    });
  });

  after(async () => {
    const restIds = [restAId, restBId].filter(Boolean);
    if (restIds.length > 0) {
      await db.delete(restaurantTables).where(inArray(restaurantTables.restaurantId, restIds));
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, restIds));
      await db.delete(restaurants).where(inArray(restaurants.id, restIds));
    }

    const userIds = [userAId, userBId, staffAId].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(user).where(inArray(user.id, userIds));
    }
  });

  // -------------------------------------------------------------------------
  // 1. Table Creation & QR Generation
  // -------------------------------------------------------------------------
  test('Owner A creates table with unguessable cryptographic QR token', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        tableNumber: 'Table 1',
        capacity: 4,
        isActive: true
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.tableNumber, 'Table 1');
    assert.equal(res.body.capacity, 4);
    assert.equal(res.body.isActive, true);
    assert.equal(res.body.restaurantId, restAId);

    // Cryptographic unguessable token validation
    assert.ok(res.body.tableToken, 'Table must have a tableToken');
    assert.equal(res.body.tableToken.length, 48, 'Token must be 48 hex characters (192 bits of entropy)');
    assert.match(res.body.tableToken, /^[0-9a-f]{48}$/);

    // QR Code URL & Data
    assert.ok(res.body.qrCodeUrl.includes(`/menu/${slugA}?table=${res.body.tableToken}`));
    assert.ok(res.body.qrCodeData.startsWith('data:image/png;base64,'));

    table1AId = res.body.id;
    table1AToken = res.body.tableToken;
  });

  test('Owner A creates a second table', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        tableNumber: 'Table 2',
        capacity: 6,
        isActive: true
      });

    assert.equal(res.status, 201);
    table2AId = res.body.id;
    table2AToken = res.body.tableToken;

    // Tokens must be strictly distinct
    assert.notEqual(table1AToken, table2AToken);
  });

  // -------------------------------------------------------------------------
  // 2. Uniqueness Rules
  // -------------------------------------------------------------------------
  test('Enforces unique table number within the same restaurant (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        tableNumber: 'Table 1', // Already exists in Restaurant A
        capacity: 2
      });

    assert.equal(res.status, 409);
    assert.ok(
      (res.body.message || res.body.error).includes('already exists'),
      'Should inform user that table number exists'
    );
  });

  test('Same table number is allowed across different restaurants', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Cookie', [cookieB])
      .set('x-restaurant-id', restBId)
      .send({
        tableNumber: 'Table 1', // Allowed because this is Restaurant B
        capacity: 4
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.tableNumber, 'Table 1');
    assert.equal(res.body.restaurantId, restBId);
    tableBId = res.body.id;
  });

  // -------------------------------------------------------------------------
  // 3. List Tables
  // -------------------------------------------------------------------------
  test('List tables returns only the authorized restaurant tables in sequence', async () => {
    const res = await request(app)
      .get('/api/tables')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);

    // Verify all belong to restAId
    assert.ok(res.body.every((t: any) => t.restaurantId === restAId));
    assert.equal(res.body[0].tableNumber, 'Table 1');
    assert.equal(res.body[1].tableNumber, 'Table 2');
  });

  // -------------------------------------------------------------------------
  // 4. Public QR Code Verification (/api/tables/verify/:token)
  // -------------------------------------------------------------------------
  test('Customer verifies valid active table token without authentication', async () => {
    // Unauthenticated request (no Cookie header)
    const res = await request(app).get(`/api/tables/verify/${table1AToken}?restaurantSlug=${slugA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.table.id, table1AId);
    assert.equal(res.body.table.tableNumber, 'Table 1');
    assert.equal(res.body.table.capacity, 4);
    assert.equal(res.body.table.isActive, true);

    assert.equal(res.body.restaurant.id, restAId);
    assert.equal(res.body.restaurant.slug, slugA);
    assert.equal(res.body.restaurant.name, 'Alice Fine Dining');
  });

  test('Verification returns 404 for unknown or non-existent token', async () => {
    const fakeToken = crypto.randomBytes(24).toString('hex');
    const res = await request(app).get(`/api/tables/verify/${fakeToken}`);

    assert.equal(res.status, 404);
    assert.ok((res.body.message || res.body.error).includes('Invalid or expired'));
  });

  test('Verification returns 400 for malformed token format', async () => {
    const res = await request(app).get('/api/tables/verify/not-a-valid-hex-token');
    assert.equal(res.status, 400);
    assert.ok((res.body.message || res.body.error).includes('format'));
  });

  test('Verification returns 400 when table is disabled/inactive', async () => {
    // 1. Disable Table 2
    await db
      .update(restaurantTables)
      .set({ isActive: false })
      .where(eq(restaurantTables.id, table2AId));

    // 2. Customer attempts to scan disabled table QR
    const res = await request(app).get(`/api/tables/verify/${table2AToken}?restaurantSlug=${slugA}`);

    assert.equal(res.status, 400);
    assert.ok((res.body.message || res.body.error).includes('disabled or inactive'));

    // Re-enable for subsequent tests
    await db
      .update(restaurantTables)
      .set({ isActive: true })
      .where(eq(restaurantTables.id, table2AId));
  });

  test('Cross-tenant verification: Token from Restaurant A queried with Restaurant B slug returns 403', async () => {
    // Attempt to verify Table 1 from Restaurant A against Restaurant B's slug
    const res = await request(app).get(`/api/tables/verify/${table1AToken}?restaurantSlug=${slugB}`);

    assert.equal(res.status, 403);
    assert.ok((res.body.message || res.body.error).includes('does not belong to this restaurant'));
  });

  // -------------------------------------------------------------------------
  // 5. Token Rotation & Revocation
  // -------------------------------------------------------------------------
  test('Rotating token generates new QR code and revokes previous token immediately', async () => {
    const oldToken = table1AToken;

    // 1. Rotate token
    const rotateRes = await request(app)
      .post(`/api/tables/${table1AId}/rotate-token`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);

    assert.equal(rotateRes.status, 200);
    assert.ok(rotateRes.body.message.includes('rotated successfully'));
    const newToken = rotateRes.body.table.tableToken;

    assert.notEqual(newToken, oldToken);
    assert.equal(newToken.length, 48);

    // 2. Verify OLD token is immediately revoked (404)
    const oldTokenRes = await request(app).get(`/api/tables/verify/${oldToken}?restaurantSlug=${slugA}`);
    assert.equal(oldTokenRes.status, 404);

    // 3. Verify NEW token resolves successfully (200)
    const newTokenRes = await request(app).get(`/api/tables/verify/${newToken}?restaurantSlug=${slugA}`);
    assert.equal(newTokenRes.status, 200);
    assert.equal(newTokenRes.body.table.id, table1AId);

    table1AToken = newToken;
  });

  // -------------------------------------------------------------------------
  // 6. Table Update & Collision on Rename
  // -------------------------------------------------------------------------
  test('Owner updates table details successfully', async () => {
    const res = await request(app)
      .patch(`/api/tables/${table1AId}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        tableNumber: 'Table 1 - Window Side',
        capacity: 5
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.tableNumber, 'Table 1 - Window Side');
    assert.equal(res.body.capacity, 5);
  });

  test('Renaming table to an existing table number returns 409 Conflict', async () => {
    const res = await request(app)
      .patch(`/api/tables/${table1AId}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        tableNumber: 'Table 2' // Already taken by table2AId
      });

    assert.equal(res.status, 409);
    assert.ok((res.body.message || res.body.error).includes('already exists'));
  });

  // -------------------------------------------------------------------------
  // 7. Tenant Isolation & IDOR Protection
  // -------------------------------------------------------------------------
  test('Owner B attempting to update or rotate Owner A table fails (IDOR protection)', async () => {
    // Update attempt
    const updateRes = await request(app)
      .patch(`/api/tables/${table1AId}`)
      .set('Cookie', [cookieB])
      .set('x-restaurant-id', restBId)
      .send({ tableNumber: 'Hacked Table' });

    assert.equal(updateRes.status, 404);

    // Rotate attempt
    const rotateRes = await request(app)
      .post(`/api/tables/${table1AId}/rotate-token`)
      .set('Cookie', [cookieB])
      .set('x-restaurant-id', restBId);

    assert.equal(rotateRes.status, 404);

    // Delete attempt
    const deleteRes = await request(app)
      .delete(`/api/tables/${table1AId}`)
      .set('Cookie', [cookieB])
      .set('x-restaurant-id', restBId);

    assert.equal(deleteRes.status, 404);
  });

  // -------------------------------------------------------------------------
  // 8. Role-Based Permissions
  // -------------------------------------------------------------------------
  test('Staff member can list tables but cannot create, rotate, or delete tables', async () => {
    // List tables (Allowed)
    const listRes = await request(app)
      .get('/api/tables')
      .set('Cookie', [cookieStaffA])
      .set('x-restaurant-id', restAId);

    assert.equal(listRes.status, 200);

    // Create table (Forbidden for staff)
    const createRes = await request(app)
      .post('/api/tables')
      .set('Cookie', [cookieStaffA])
      .set('x-restaurant-id', restAId)
      .send({ tableNumber: 'Table 99' });

    assert.equal(createRes.status, 403);

    // Rotate table (Forbidden for staff)
    const rotateRes = await request(app)
      .post(`/api/tables/${table1AId}/rotate-token`)
      .set('Cookie', [cookieStaffA])
      .set('x-restaurant-id', restAId);

    assert.equal(rotateRes.status, 403);

    // Delete table (Forbidden for staff)
    const deleteRes = await request(app)
      .delete(`/api/tables/${table1AId}`)
      .set('Cookie', [cookieStaffA])
      .set('x-restaurant-id', restAId);

    assert.equal(deleteRes.status, 403);
  });

  // -------------------------------------------------------------------------
  // 9. Delete Table
  // -------------------------------------------------------------------------
  test('Owner deletes table successfully', async () => {
    const res = await request(app)
      .delete(`/api/tables/${table2AId}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Table deleted successfully');

    // Verification of deleted table token returns 404
    const verifyRes = await request(app).get(`/api/tables/verify/${table2AToken}`);
    assert.equal(verifyRes.status, 404);
  });
});

