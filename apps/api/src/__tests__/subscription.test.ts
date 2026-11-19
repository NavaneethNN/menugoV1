import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../index';
import { getPlatformRazorpayCredentials, syncSubscriptionExpirations } from '../lib/subscription-service';
import { restaurantDb, cinemaDb, subscriptionPlans, tenantSubscriptions, restaurants } from '@menugo/database';
import { eq } from 'drizzle-orm';

process.env.SUPER_ADMIN_KEY ||= 'test-only-master-key';

describe('Subscription & Razorpay Platform Billing Suite', () => {
  const MASTER_KEY = process.env.SUPER_ADMIN_KEY!;

  after(() => {
    // Graceful exit
    setTimeout(() => process.exit(0), 100);
  });

  it('1. Platform Razorpay credentials helper loads key ID', () => {
    const creds = getPlatformRazorpayCredentials();
    assert.ok(creds.keyId, 'Expected platform Razorpay keyId');
    assert.strictEqual(typeof creds.keyId, 'string');
  });

  it('2. GET /api/subscriptions/plans returns plans list', async () => {
    const res = await request(app).get('/api/subscriptions/plans');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body), 'Expected array of plans');
    assert.ok(res.body.length > 0, 'Expected at least 1 plan');

    const first = res.body[0];
    assert.ok(first.id, 'Plan must have id');
    assert.ok(first.name, 'Plan must have name');
    assert.ok(first.priceMonthlyPaise !== undefined, 'Plan must have monthly price');
    assert.ok(first.priceAnnualPaise !== undefined, 'Plan must have annual price');
  });

  it('3. GET /api/subscriptions/plans?tenantType=cinema returns cinema-compatible plans', async () => {
    const res = await request(app).get('/api/subscriptions/plans?tenantType=cinema');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const plan of res.body) {
      assert.ok(
        plan.tenantType === 'cinema' || plan.tenantType === 'all',
        `Plan ${plan.name} must be cinema or all`
      );
    }
  });

  it('4. GET /api/subscriptions/plans?tenantType=restaurant returns restaurant-compatible plans', async () => {
    const res = await request(app).get('/api/subscriptions/plans?tenantType=restaurant');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const plan of res.body) {
      assert.ok(
        plan.tenantType === 'restaurant' || plan.tenantType === 'all',
        `Plan ${plan.name} must be restaurant or all`
      );
    }
  });

  it('5. GET /api/subscriptions/current rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/subscriptions/current');
    assert.strictEqual(res.status, 401);
  });

  it('6. POST /api/subscriptions/create-checkout-order rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/subscriptions/create-checkout-order')
      .send({ planId: 'dummy-id', billingCycle: 'monthly' });
    assert.strictEqual(res.status, 401);
  });

  it('7. GET /api/super-admin/tenant-subscriptions requires super admin authorization', async () => {
    const unauthorizedRes = await request(app).get('/api/super-admin/tenant-subscriptions');
    assert.strictEqual(unauthorizedRes.status, 401);

    const authorizedRes = await request(app)
      .get('/api/super-admin/tenant-subscriptions')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(authorizedRes.status, 200);
    assert.ok(Array.isArray(authorizedRes.body));
  });

  it('8. POST /api/super-admin/check-expirations runs automatic expiration sync', async () => {
    const res = await request(app)
      .post('/api/super-admin/check-expirations')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.totalExpired !== undefined);
  });

  it('9. Super admin duration adjustment: PATCH /api/super-admin/tenant-subscriptions/:id/duration', async () => {
    // 1. Fetch existing subscriptions
    const listRes = await request(app)
      .get('/api/super-admin/tenant-subscriptions')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(listRes.status, 200);

    if (listRes.body.length > 0) {
      const targetSub = listRes.body[0];

      // Add 30 days
      const extendRes = await request(app)
        .patch(`/api/super-admin/tenant-subscriptions/${targetSub.id}/duration`)
        .set('x-super-admin-key', MASTER_KEY)
        .send({ daysToAdd: 30 });

      assert.strictEqual(extendRes.status, 200);
      assert.strictEqual(extendRes.body.success, true);
      assert.ok(extendRes.body.subscription.currentPeriodEnd);

      // Verify status modification
      const statusRes = await request(app)
        .patch(`/api/super-admin/tenant-subscriptions/${targetSub.id}/status`)
        .set('x-super-admin-key', MASTER_KEY)
        .send({ status: 'active' });

      assert.strictEqual(statusRes.status, 200);
      assert.strictEqual(statusRes.body.subscription.status, 'active');
    }
  });

  it('10. GET /api/super-admin/subscription-payments returns payment log', async () => {
    const res = await request(app)
      .get('/api/super-admin/subscription-payments')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});
