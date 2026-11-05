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

describe('Security & Reliability Audit Regression Suite (Task 20)', () => {
  let restAlphaId: string;
  let restBetaId: string;

  let userAlphaOwnerId: string;
  let userBetaOwnerId: string;

  let cookieAlphaOwner: string;
  let cookieBetaOwner: string;

  let tableAlpha1Id: string;
  let tableAlphaToken: string;

  let tableBeta1Id: string;
  let tableBetaToken: string;

  let prodAlphaId: string;

  const now = Date.now();
  const restAlphaSlug = `sec-alpha-${now}`;
  const restBetaSlug = `sec-beta-${now}`;

  before(async () => {
    // 1. Seed Restaurants
    restAlphaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restAlphaId,
      name: 'Security Alpha Bistro',
      slug: restAlphaSlug,
      currency: 'INR',
      isActive: true
    });

    restBetaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restBetaId,
      name: 'Security Beta Cafe',
      slug: restBetaSlug,
      currency: 'INR',
      isActive: true
    });

    // 2. Auth Users
    const alphaRes = await auth.api.signUpEmail({
      body: {
        name: 'Alpha Sec Owner',
        email: `alpha-sec-${now}@example.com`,
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
        name: 'Beta Sec Owner',
        email: `beta-sec-${now}@example.com`,
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

    // 3. Tables with cryptographic tokens
    tableAlphaToken = crypto.randomBytes(24).toString('hex');
    tableAlpha1Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableAlpha1Id,
      restaurantId: restAlphaId,
      tableNumber: 'T-01',
      tableToken: tableAlphaToken,
      capacity: 4,
      isActive: true
    });

    tableBetaToken = crypto.randomBytes(24).toString('hex');
    tableBeta1Id = crypto.randomUUID();
    await db.insert(restaurantTables).values({
      id: tableBeta1Id,
      restaurantId: restBetaId,
      tableNumber: 'T-01', // Identical raw table number in different restaurant
      tableToken: tableBetaToken,
      capacity: 4,
      isActive: true
    });

    // 4. Products
    prodAlphaId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodAlphaId,
      restaurantId: restAlphaId,
      name: 'Paneer Tikka',
      price: 25000, // ₹250
      isAvailable: true
    });
  });

  after(async () => {
    await db.delete(orderStatusHistory);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(products);
    await db.delete(restaurantTables);
    await db.delete(restaurantMembers);
    await db.delete(restaurants);
  });

  // ---------------------------------------------------------------------------
  // 1. Raw Table Number Bypass Vulnerability (Patched)
  // ---------------------------------------------------------------------------
  test('1. Regression: Placing order with guessed raw tableNumber is strictly rejected', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        restaurantSlug: restAlphaSlug,
        tableId: 'T-01', // Raw table number instead of token or UUID
        items: [{ productId: prodAlphaId, quantity: 1 }]
      });

    // Must be rejected with 404 (Table not found or does not belong to this restaurant)
    assert.equal(res.status, 404);
  });

  test('2. Verification: Placing order with cryptographic tableToken succeeds', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        restaurantSlug: restAlphaSlug,
        tableToken: tableAlphaToken,
        items: [{ productId: prodAlphaId, quantity: 1 }]
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.order.status, 'new');
    assert.equal(res.body.order.table.tableNumber, 'T-01');
  });

  test('3. Cross-Tenant Protection: Submitting Beta tableToken to Alpha restaurant fails', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        restaurantSlug: restAlphaSlug,
        tableToken: tableBetaToken, // Token belongs to Beta!
        items: [{ productId: prodAlphaId, quantity: 1 }]
      });

    assert.equal(res.status, 404);
  });

  // ---------------------------------------------------------------------------
  // 2. Abuse Controls & Rate Limiting Enforcement
  // ---------------------------------------------------------------------------
  test('4. Rate Limiter: Public Order Creation rate limiter enforces 429 when threshold exceeded', async () => {
    const orderPayload = {
      restaurantSlug: restAlphaSlug,
      tableToken: tableAlphaToken,
      items: [{ productId: prodAlphaId, quantity: 1 }]
    };

    // Send 3 requests (test threshold = 3)
    await request(app).post('/api/orders').set('x-test-rate-limit', 'true').send(orderPayload);
    await request(app).post('/api/orders').set('x-test-rate-limit', 'true').send(orderPayload);
    await request(app).post('/api/orders').set('x-test-rate-limit', 'true').send(orderPayload);

    // 4th request must be rate limited
    const limitedRes = await request(app)
      .post('/api/orders')
      .set('x-test-rate-limit', 'true')
      .send(orderPayload);

    assert.equal(limitedRes.status, 429);
    assert.equal(limitedRes.body.error, 'Too Many Requests');
    assert.ok(limitedRes.headers['ratelimit-limit']);
  });

  test('5. Rate Limiter: Order Tracking endpoint enforces 429 when threshold exceeded', async () => {
    const fakeToken = crypto.randomBytes(16).toString('hex');

    await request(app).get(`/api/orders/status/${fakeToken}`).set('x-test-rate-limit', 'true');
    await request(app).get(`/api/orders/status/${fakeToken}`).set('x-test-rate-limit', 'true');
    await request(app).get(`/api/orders/status/${fakeToken}`).set('x-test-rate-limit', 'true');

    const limitedRes = await request(app)
      .get(`/api/orders/status/${fakeToken}`)
      .set('x-test-rate-limit', 'true');

    assert.equal(limitedRes.status, 429);
    assert.equal(limitedRes.body.error, 'Too Many Requests');
  });

  test('6. Rate Limiter: Table QR verification enforces 429 when threshold exceeded', async () => {
    await request(app).get(`/api/tables/verify/${tableAlphaToken}`).set('x-test-rate-limit', 'true');
    await request(app).get(`/api/tables/verify/${tableAlphaToken}`).set('x-test-rate-limit', 'true');
    await request(app).get(`/api/tables/verify/${tableAlphaToken}`).set('x-test-rate-limit', 'true');

    const limitedRes = await request(app)
      .get(`/api/tables/verify/${tableAlphaToken}`)
      .set('x-test-rate-limit', 'true');

    assert.equal(limitedRes.status, 429);
    assert.equal(limitedRes.body.error, 'Too Many Requests');
  });

  test('6b. Rate Limiter: Safe GET requests on auth routes are never throttled, while POST login attempts are guarded', async () => {
    // 1. Send 10 rapid GET requests to /api/auth/staff-restaurants - none should ever receive 429
    for (let i = 0; i < 10; i++) {
      const getRes = await request(app).get('/api/auth/staff-restaurants');
      assert.notEqual(getRes.status, 429, 'Safe GET requests must never be rate limited');
    }

    // 2. Authentication attempts with x-test-rate-limit should trigger 429 after threshold (5 attempts)
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/staff-login')
        .set('x-test-rate-limit', 'true')
        .send({ restaurantSlug: 'non-existent', pin: '0000' });
    }

    const throttledRes = await request(app)
      .post('/api/auth/staff-login')
      .set('x-test-rate-limit', 'true')
      .send({ restaurantSlug: 'non-existent', pin: '0000' });

    assert.equal(throttledRes.status, 429);
    assert.equal(throttledRes.body.error, 'Too Many Requests');
  });

  // ---------------------------------------------------------------------------
  // 3. CORS & Security Headers
  // ---------------------------------------------------------------------------
  test('7. CORS: Allowed headers includes idempotency-key and exposed headers are present', async () => {
    const preflight = await request(app)
      .options('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key,x-restaurant-id');

    assert.ok([200, 204].includes(preflight.status));
    const allowedHeaders = preflight.headers['access-control-allow-headers'];
    assert.ok(allowedHeaders);
    assert.ok(allowedHeaders.toLowerCase().includes('idempotency-key'));

    // Check exposed headers on normal GET
    const getRes = await request(app)
      .get('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    const exposedHeaders = getRes.headers['access-control-expose-headers'];
    assert.ok(exposedHeaders);
    assert.ok(exposedHeaders.includes('X-Total-Count'));
  });

  test('8. Security Headers: Helmet applies X-Content-Type-Options and CORP headers', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
  });

  // ---------------------------------------------------------------------------
  // 4. Price & Integer Paise Tampering Protection
  // ---------------------------------------------------------------------------
  test('9. Pricing Integrity: Client-supplied malicious unit prices are completely ignored', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        restaurantSlug: restAlphaSlug,
        tableToken: tableAlphaToken,
        totalAmount: 1, // Attacker attempts to pay 1 paise
        items: [
          {
            productId: prodAlphaId,
            quantity: 2,
            unitPrice: 1, // Attacker attempts 1 paise per item
            subtotal: 2
          }
        ]
      });

    assert.equal(res.status, 201);
    // Real DB price is 25000 paise each; 2 * 25000 = 50000 paise
    assert.equal(res.body.order.totalAmount, 50000);
    assert.equal(res.body.order.items[0].unitPrice, 25000);
    assert.equal(res.body.order.items[0].subtotal, 50000);
  });

  // ---------------------------------------------------------------------------
  // 5. Idempotent Deduplication
  // ---------------------------------------------------------------------------
  test('10. Idempotency: Duplicate submissions with identical Idempotency-Key return original order', async () => {
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      restaurantSlug: restAlphaSlug,
      tableToken: tableAlphaToken,
      items: [{ productId: prodAlphaId, quantity: 1 }]
    };

    const firstRes = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    assert.equal(firstRes.status, 201);
    const orderId = firstRes.body.order.id;

    const secondRes = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    assert.equal(secondRes.status, 200);
    assert.equal(secondRes.body.idempotent, true);
    assert.equal(secondRes.body.order.id, orderId);
  });

  // ---------------------------------------------------------------------------
  // 6. Magic Bytes & File Upload Validation
  // ---------------------------------------------------------------------------
  test('11. File Upload: Uploading fake image (plain text disguised as .png) is rejected by magic byte validator', async () => {
    const fakePngBuffer = Buffer.from('This is NOT a PNG file, just plain text payload');

    const res = await request(app)
      .post('/api/uploads/direct')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .attach('file', fakePngBuffer, 'malicious.png');

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('not a supported image format'));
  });

  test('12. Tenant Key Isolation: Attempting to link another tenant imageKey to product fails', async () => {
    const foreignImageKey = `${restBetaId}/products/${crypto.randomUUID()}.png`;

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        name: 'Hacked Product',
        price: 15000,
        imageKey: foreignImageKey
      });

    assert.equal(res.status, 403);
    assert.ok(res.body.message.includes('Image does not belong to this restaurant'));
  });
});

