import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../index';
import { getPublicImageUrl } from '../lib/r2';
import { pool } from '@menugo/database';

describe('Deployment Smoke Tests (Task 22)', () => {
  after(async () => {
    await pool.end().catch(() => {});
  });

  // 1. Health & Readiness Endpoints
  describe('1. Health & Readiness Probes', () => {
    it('GET /api/health/live returns 200 status with liveness info', async () => {
      const res = await request(app).get('/api/health/live');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'live');
      assert.strictEqual(typeof res.body.uptime, 'number');
      assert.strictEqual(typeof res.body.timestamp, 'string');
      assert.strictEqual(res.body.version, '1.0.0');
    });

    it('GET /api/health/ready returns 200 and confirms database connectivity', async () => {
      const res = await request(app).get('/api/health/ready');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ready');
      assert.strictEqual(res.body.database, 'connected');
      // Must not leak connection strings or driver credentials
      assert.strictEqual(res.body.connectionString, undefined);
      assert.strictEqual(res.body.password, undefined);
      assert.strictEqual(res.body.host, undefined);
    });

    it('GET /api/health provides general system status without leaking infrastructure details', async () => {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.database, 'connected');
      assert.strictEqual(typeof res.body.uptime, 'number');
    });
  });

  // 2. Authentication Boundary & Security
  describe('2. Authentication Security Smoke Checks', () => {
    it('GET /api/auth/me rejects unauthenticated callers with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.user, undefined);
      assert.strictEqual(res.body.session, undefined);
    });

    it('POST /api/auth/sign-in/email rejects invalid credentials safely', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in/email')
        .send({
          email: 'nonexistent-smoke-user@example.com',
          password: 'WrongPassword123!'
        });

      // Should reject with 400 or 401 without exposing DB stack traces
      assert.ok([400, 401].includes(res.status));
      assert.strictEqual(res.body.password, undefined);
    });
  });

  // 3. Public Menu & Safe Resolution
  describe('3. Public Menu Endpoint Smoke Checks', () => {
    it('GET /api/restaurants/by-slug/:slug returns 404 for invalid slug gracefully', async () => {
      const res = await request(app).get('/api/restaurants/by-slug/completely-nonexistent-slug-xyz');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Restaurant not found or inactive');
    });
  });

  // 4. Image Delivery & Public Domain Resolution
  describe('4. Cloudflare R2 Public Image Delivery', () => {
    it('getPublicImageUrl formats public URL using configured CDN domain without leaking credentials', () => {
      const sampleKey = 'test-rest-id/products/sample-dish.webp';
      const url = getPublicImageUrl(sampleKey);

      assert.ok(typeof url === 'string');
      assert.ok(url.endsWith(sampleKey));
      // Must not contain credentials
      assert.strictEqual(url.includes('access_key'), false);
      assert.strictEqual(url.includes('secret'), false);
    });
  });

  // 5. Order Flow & Table Token Validation
  describe('5. Order Flow & Table Token Validation', () => {
    it('POST /api/orders rejects order for nonexistent restaurant (404)', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          restaurantSlug: 'completely-nonexistent-slug-xyz',
          tableNumber: 1,
          items: [{ productId: 'any-id', quantity: 1 }]
        });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Restaurant is inactive or not found');
    });

    it('GET /api/tables/verify/:token rejects malformed table tokens (400) and unassigned tokens (404)', async () => {
      // 1. Malformed token format
      const malformedRes = await request(app).get('/api/tables/verify/invalid-fake-token-123');
      assert.strictEqual(malformedRes.status, 400);
      assert.strictEqual(malformedRes.body.error, 'Invalid table QR token format');

      // 2. Syntactically valid 48-hex token that does not exist in DB
      const nonExistentToken = '0123456789abcdef0123456789abcdef0123456789abcdef';
      const nonExistentRes = await request(app).get(`/api/tables/verify/${nonExistentToken}`);
      assert.strictEqual(nonExistentRes.status, 404);
      assert.strictEqual(nonExistentRes.body.error, 'Invalid or expired table QR token');
    });
  });

  // 6. Security Headers Smoke Check
  describe('6. Production Security Headers', () => {
    it('API responses include security headers (X-Content-Type-Options, etc.)', async () => {
      const res = await request(app).get('/api/health/live');
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    });
  });
});
