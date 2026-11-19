import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../index';

process.env.SUPER_ADMIN_KEY ||= 'test-only-master-key';
process.env.SUPER_ADMIN_EMAILS ||= 'admin@menugo.in';
process.env.SUPER_ADMIN_PASSWORD ||= 'test-only-admin-password';

describe('Super Admin Authentication & CORS Suite', () => {
  const MASTER_KEY = process.env.SUPER_ADMIN_KEY!;
  const ADMIN_EMAIL = 'admin@menugo.in';
  const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD!;

  after(() => {
    // Graceful exit after test suite completion
    setTimeout(() => process.exit(0), 100);
  });

  it('1. CORS: Preflight OPTIONS request allows x-super-admin-key from main web (localhost:3002)', async () => {
    const res = await request(app)
      .options('/api/super-admin/me')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'content-type,x-super-admin-key');

    assert.ok([200, 204].includes(res.status), `Expected 200 or 204 status, got ${res.status}`);
    const allowedHeaders = res.headers['access-control-allow-headers'];
    assert.ok(allowedHeaders, 'Expected Access-Control-Allow-Headers response header');
    assert.ok(
      allowedHeaders.toLowerCase().includes('x-super-admin-key'),
      'Access-Control-Allow-Headers must include x-super-admin-key'
    );
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3002');
  });

  it('2. GET /api/super-admin/me: Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/super-admin/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
  });

  it('3. GET /api/super-admin/me: Rejects invalid master key with 401', async () => {
    const res = await request(app)
      .get('/api/super-admin/me')
      .set('x-super-admin-key', 'wrong-invalid-key-xyz');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
    assert.ok(res.body.message.includes('Invalid master administration key'));
  });

  it('4. GET /api/super-admin/me: Authorizes valid master platform key with 200', async () => {
    const res = await request(app)
      .get('/api/super-admin/me')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isSuperAdmin, true);
    assert.strictEqual(res.body.user.role, 'super_admin');
    assert.strictEqual(res.body.user.tenantType, 'platform');
  });

  it('5. POST /api/super-admin/login: Authorizes valid master key via dedicated login endpoint', async () => {
    const res = await request(app)
      .post('/api/super-admin/login')
      .send({ masterKey: MASTER_KEY });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.isSuperAdmin, true);
    assert.strictEqual(res.body.authMethod, 'master_key');
  });

  it('6. POST /api/super-admin/login: Rejects invalid master key with 401 and specific message', async () => {
    const res = await request(app)
      .post('/api/super-admin/login')
      .send({ masterKey: 'bad-key-123' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
    assert.ok(res.body.message.includes('Invalid platform master key'));
  });

  it('7. POST /api/super-admin/login: Rejects incorrect email/password with 401', async () => {
    const res = await request(app)
      .post('/api/super-admin/login')
      .send({ email: ADMIN_EMAIL, password: 'WrongPassword999!' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
    assert.ok(res.body.message.includes('Invalid administrator email or password'));
  });

  it('8. POST /api/super-admin/login: Successfully logs in super admin with email/password and sets session cookie', async () => {
    const res = await request(app)
      .post('/api/super-admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.isSuperAdmin, true);
    assert.strictEqual(res.body.authMethod, 'session');
    assert.strictEqual(res.body.user.email, ADMIN_EMAIL);
    assert.strictEqual(res.body.user.role, 'super_admin');

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Expected Set-Cookie header');
    const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    assert.ok(cookieString.includes('better-auth.session_token'), 'Set-Cookie must include better-auth.session_token');

    // Verify the obtained cookie allows access to GET /api/super-admin/me
    const meRes = await request(app)
      .get('/api/super-admin/me')
      .set('Cookie', cookieString);

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.isSuperAdmin, true);
    assert.strictEqual(meRes.body.user.email, ADMIN_EMAIL);
    assert.strictEqual(meRes.body.user.role, 'super_admin');
  });
});
