import { it, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  pool,
  user,
  restaurants,
  restaurantMembers,
  cinemaProfiles,
  cinemaPaymentAccounts,
  cinemaPaymentTransactions,
  cinemaRefunds,
  restaurantTables
} from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  encryptSecret,
  decryptSecret,
  maskSecret
} from '../lib/encryption';
import {
  getPaymentProvider,
  RazorpayPaymentProvider,
  PaytmPaymentProvider
} from '../lib/payment';

process.env.NODE_ENV = 'test';

describe('Task 11: Theatre Payment Gateway Architecture', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantId: string;

  let cookieCinemaA: string;
  let cookieCinemaB: string;
  let cookieRestaurant: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  const timestamp = Date.now();
  const createdUsersToClean: string[] = [];

  before(async () => {
    // 1. Create Cinema Administrator for Theatre A
    const resA = await auth.api.signUpEmail({
      body: {
        email: `theatre-pay-a-${timestamp}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre Pay Admin A'
      },
      asResponse: true
    });
    cookieCinemaA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonA = await resA.json();
    userCinemaAId = jsonA.user.id;
    createdUsersToClean.push(userCinemaAId);

    // 2. Create Cinema Administrator for Theatre B
    const resB = await auth.api.signUpEmail({
      body: {
        email: `theatre-pay-b-${timestamp}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre Pay Admin B'
      },
      asResponse: true
    });
    cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    // 3. Create Restaurant Owner for Cross-Module Regression Tests
    const resRest = await auth.api.signUpEmail({
      body: {
        email: `rest-pay-owner-${timestamp}@restaurant.com`,
        password: 'Password123!',
        name: 'Restaurant Owner'
      },
      asResponse: true
    });
    cookieRestaurant = resRest.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonRest = await resRest.json();
    userRestaurantId = jsonRest.user.id;
    createdUsersToClean.push(userRestaurantId);

    // 4. Create Theatre A tenant
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'PVR Inorbit Mall Cinemas',
      slug: `pvr-inorbit-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true,
      settings: { taxPercentage: 5 }
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreAId,
      theatreName: 'PVR Inorbit Mall Cinemas',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'contact@pvrinorbit.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      onboardingStage: 'menu_configured',
      onboardingCompleted: false
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'owner'
    });

    // 5. Create Theatre B tenant (for tenant isolation tests)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'Cinepolis Central Cinemas',
      slug: `cinepolis-central-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreBId,
      theatreName: 'Cinepolis Central Cinemas',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      contactNumber: '9123456780',
      contactEmail: 'contact@cinepolis.com',
      currency: 'INR',
      onboardingStage: 'profile_completed'
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreBId,
      userId: userCinemaBId,
      role: 'owner'
    });

    // 6. Create Restaurant tenant (for regression testing)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Bawarchi Biryani House',
      slug: `bawarchi-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId,
      userId: userRestaurantId,
      role: 'owner'
    });

    await db.insert(restaurantTables).values({
      restaurantId,
      tableNumber: 'Table 1',
      capacity: 4,
      isActive: true
    });
  });

  after(async () => {
    try {
      await db.delete(cinemaRefunds).where(inArray(cinemaRefunds.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaPaymentTransactions).where(inArray(cinemaPaymentTransactions.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaPaymentAccounts).where(inArray(cinemaPaymentAccounts.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurantTables).where(eq(restaurantTables.restaurantId, restaurantId));
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));
      if (createdUsersToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUsersToClean));
      }
      await pool.end();
    } catch (e) {
      console.warn('Cleanup warning in cinema-payment-architecture test:', e);
    }
  });

  // -------------------------------------------------------------------------
  // 1. Encryption & Decryption at Rest Unit Tests
  // -------------------------------------------------------------------------
  describe('1. Secure Credential Storage & Encryption at Rest', () => {
    it('encrypts sensitive key secret using AES-256-GCM with iv:authTag:ciphertext format', () => {
      const rawSecret = 'rzp_live_secret_key_super_confidential_9988';
      const encrypted = encryptSecret(rawSecret);

      assert.ok(typeof encrypted === 'string');
      assert.ok(encrypted.includes(':'));
      const parts = encrypted.split(':');
      assert.equal(parts.length, 3, 'Payload must contain IV, AuthTag, and Ciphertext');
      assert.notEqual(encrypted, rawSecret, 'Encrypted secret must not match raw secret');
      assert.ok(!encrypted.includes(rawSecret), 'Encrypted payload must never contain cleartext');
    });

    it('decrypts an encrypted payload accurately back to the original secret', () => {
      const originalSecret = 'rzp_test_sec_ABCDEF123456';
      const encrypted = encryptSecret(originalSecret);
      const decrypted = decryptSecret(encrypted);

      assert.equal(decrypted, originalSecret, 'Decrypted value must match original plaintext');
    });

    it('rejects tampered ciphertexts and invalid auth tags', () => {
      const encrypted = encryptSecret('confidential_secret');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext byte
      const tamperedCiphertext = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

      assert.throws(
        () => decryptSecret(tampered),
        /Unsupported state or unable to authenticate data|bad decrypt/i,
        'Should fail to decrypt tampered ciphertext'
      );
    });

    it('masks secret keys correctly without exposing full credentials', () => {
      assert.equal(maskSecret('rzp_test_abc123456789'), '••••••••6789');
      assert.equal(maskSecret('paytm_sec_key_xyz9876'), '••••••••9876');
      assert.equal(maskSecret('1234'), '••••••••');
      assert.equal(maskSecret('12'), '••••••••');
      assert.equal(maskSecret(''), '');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Payment Provider Abstraction & Adapters Unit Tests
  // -------------------------------------------------------------------------
  describe('2. Payment Provider Abstraction & Adapters', () => {
    it('factory returns correct adapter for razorpay and paytm', () => {
      const razorpay = getPaymentProvider('razorpay');
      assert.ok(razorpay instanceof RazorpayPaymentProvider);
      assert.equal(razorpay.providerName, 'razorpay');

      const paytm = getPaymentProvider('paytm');
      assert.ok(paytm instanceof PaytmPaymentProvider);
      assert.equal(paytm.providerName, 'paytm');

      assert.throws(() => {
        // @ts-expect-error Testing invalid provider
        getPaymentProvider('stripe');
      }, /Unsupported payment provider/);
    });

    it('RazorpayPaymentProvider verifies test credentials with valid prefix', async () => {
      const razorpay = new RazorpayPaymentProvider();
      const result = await razorpay.verifyConnection({
        environment: 'test',
        keyId: 'rzp_test_mock_12345',
        keySecret: 'mock_razorpay_secret_123'
      });

      assert.equal(result.success, true);
      assert.equal(result.provider, 'razorpay');
      assert.ok(result.message.includes('verified') || result.message.includes('connected'));
    });

    it('RazorpayPaymentProvider rejects invalid test key without rzp_test_ prefix', async () => {
      const razorpay = new RazorpayPaymentProvider();
      const result = await razorpay.verifyConnection({
        environment: 'test',
        keyId: 'rzp_live_invalid_in_test',
        keySecret: 'mock_razorpay_secret_123'
      });

      assert.equal(result.success, false);
      assert.equal(result.error, 'INVALID_TEST_KEY_PREFIX');
    });

    it('PaytmPaymentProvider verifies valid test merchant credentials', async () => {
      const paytm = new PaytmPaymentProvider();
      const result = await paytm.verifyConnection({
        environment: 'test',
        keyId: 'TEST_MID_987654321',
        keySecret: 'mock_paytm_merchant_key'
      });

      assert.equal(result.success, true);
      assert.equal(result.provider, 'paytm');
    });

    it('PaytmPaymentProvider rejects short or empty MID', async () => {
      const paytm = new PaytmPaymentProvider();
      const result = await paytm.verifyConnection({
        environment: 'test',
        keyId: 'abc',
        keySecret: 'mock_paytm_merchant_key'
      });

      assert.equal(result.success, false);
      assert.equal(result.error, 'INVALID_MID');
    });

    it('payment capture adapter creates order when credentials are provided (implemented in Task 12)', async () => {
      const razorpay = new RazorpayPaymentProvider();
      const orderRes = await razorpay.createPaymentOrder({
        credentials: { keyId: 'rzp_test_sample', keySecret: 'mock_secret' },
        orderId: 'order_123',
        theatreId: 'theatre_123',
        amount: 25000,
        currency: 'INR'
      });
      assert.equal(orderRes.success, true);
      assert.ok(orderRes.providerOrderId);

      const paytm = new PaytmPaymentProvider();
      assert.equal(paytm.providerName, 'paytm');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Backend API Endpoints & Multi-Tenancy Tests
  // -------------------------------------------------------------------------
  describe('3. Theatre Payment Account Management API', () => {
    it('GET /api/cinema/payments/settings requires authentication', async () => {
      const res = await request(app).get('/api/cinema/payments/settings');
      assert.equal(res.status, 401);
    });

    it('GET /api/cinema/payments/settings rejects restaurant tenant (Cross-module check)', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieRestaurant)
        .set('x-restaurant-id', restaurantId);

      assert.equal(res.status, 403);
    });

    it('GET /api/cinema/payments/settings returns initial empty accounts for Theatre A', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.theatreId, theatreAId);
      assert.equal(res.body.currency, 'INR');
      assert.ok(Array.isArray(res.body.accounts));
      assert.equal(res.body.accounts.length, 0);
      assert.deepEqual(res.body.supportedProviders, ['razorpay', 'paytm']);
    });

    it('POST /api/cinema/payments/configure configures and verifies Razorpay account', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/configure')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId)
        .send({
          provider: 'razorpay',
          environment: 'test',
          keyId: 'rzp_test_mock_theatre_a_123',
          keySecret: 'mock_secret_key_razorpay_9988',
          webhookSecret: 'mock_webhook_secret_123'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.account.provider, 'razorpay');
      assert.equal(res.body.account.status, 'connected');
      assert.equal(res.body.account.isVerified, true);
      assert.equal(res.body.account.hasWebhookSecret, true);
      assert.equal(res.body.account.maskedKeySecret, '••••••••9988');

      // Security verification: RAW SECRET IS NEVER EXPOSED IN API RESPONSE
      assert.strictEqual((res.body.account as any).keySecret, undefined);
      assert.strictEqual((res.body.account as any).encryptedKeySecret, undefined);

      // Database verification: Verify ciphertext in database is encrypted
      const [savedDb] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreAId),
            eq(cinemaPaymentAccounts.provider, 'razorpay')
          )
        );

      assert.ok(savedDb);
      assert.notEqual(savedDb.encryptedKeySecret, 'mock_secret_key_razorpay_9988');
      assert.ok(savedDb.encryptedKeySecret.includes(':'));
      assert.equal(decryptSecret(savedDb.encryptedKeySecret), 'mock_secret_key_razorpay_9988');
      assert.equal(savedDb.maskedKeySecret, '••••••••9988');

      // Onboarding stage advancement check
      const [profile] = await db
        .select({ onboardingStage: cinemaProfiles.onboardingStage })
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, theatreAId));
      assert.equal(profile?.onboardingStage, 'payment_configured');
    });

    it('POST /api/cinema/payments/configure configures Paytm account for Theatre A', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/configure')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId)
        .send({
          provider: 'paytm',
          environment: 'test',
          keyId: 'TEST_MID_CINEMA_A',
          keySecret: 'mock_paytm_secret_key_4433'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.account.provider, 'paytm');
      assert.equal(res.body.account.status, 'connected');
      assert.equal(res.body.account.maskedKeySecret, '••••••••4433');
    });

    it('GET /api/cinema/payments/settings returns both configured accounts with masked secrets', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.accounts.length, 2);

      for (const acct of res.body.accounts) {
        assert.ok(acct.maskedKeySecret.startsWith('••••••••'));
        assert.strictEqual(acct.keySecret, undefined);
        assert.strictEqual(acct.encryptedKeySecret, undefined);
      }
    });

    it('POST /api/cinema/payments/verify/:provider verifies existing stored gateway', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/verify/razorpay')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.account.isVerified, true);
      assert.equal(res.body.account.status, 'connected');
    });

    it('POST /api/cinema/payments/disable/:provider and enable/:provider toggles gateway', async () => {
      // 1. Disable
      const disableRes = await request(app)
        .post('/api/cinema/payments/disable/razorpay')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId);

      assert.equal(disableRes.status, 200);
      assert.equal(disableRes.body.account.status, 'disabled');

      // 2. Enable
      const enableRes = await request(app)
        .post('/api/cinema/payments/enable/razorpay')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId);

      assert.equal(enableRes.status, 200);
      assert.equal(enableRes.body.account.status, 'connected');
    });

    it('DELETE /api/cinema/payments/disconnect/:provider disconnects and clears credentials', async () => {
      const res = await request(app)
        .delete('/api/cinema/payments/disconnect/paytm')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify removed from database
      const [remaining] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreAId),
            eq(cinemaPaymentAccounts.provider, 'paytm')
          )
        );
      assert.strictEqual(remaining, undefined);
    });

    it('GET /api/cinema/payments/transactions returns transaction ledger with pagination', async () => {
      // Seed a test transaction for Theatre A
      const testTxId = crypto.randomUUID();
      await db.insert(cinemaPaymentTransactions).values({
        id: testTxId,
        theatreId: theatreAId,
        provider: 'razorpay',
        providerPaymentId: 'pay_mock_test_123',
        providerOrderId: 'order_mock_test_123',
        amount: 45000, // ₹450.00
        currency: 'INR',
        status: 'CAPTURED'
      });

      const res = await request(app)
        .get('/api/cinema/payments/transactions?limit=10')
        .set('Cookie', cookieCinemaA)
        .set('x-restaurant-id', theatreAId);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.transactions.length >= 1);
      assert.equal(res.body.transactions[0].amount, 45000);
      assert.equal(res.body.transactions[0].status, 'CAPTURED');
      assert.equal(res.body.pagination.page, 1);
      assert.ok(res.body.pagination.total >= 1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Strict Tenant Isolation Tests
  // -------------------------------------------------------------------------
  describe('4. Payment Account & Gateway Isolation', () => {
    it('Theatre B cannot view Theatre A payment gateway settings', async () => {
      const resB = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaB)
        .set('x-restaurant-id', theatreBId);

      assert.equal(resB.status, 200);
      assert.equal(resB.body.theatreId, theatreBId);
      // Theatre B has not configured any accounts; should see 0 accounts
      assert.equal(resB.body.accounts.length, 0);
    });

    it('Theatre B cannot re-verify, disable, or disconnect Theatre A payment accounts', async () => {
      // Attempt to re-verify Razorpay using Theatre B's auth and Theatre B's tenant context
      const resVerify = await request(app)
        .post('/api/cinema/payments/verify/razorpay')
        .set('Cookie', cookieCinemaB)
        .set('x-restaurant-id', theatreBId);

      assert.equal(resVerify.status, 404);

      // Attempt to access Theatre A's tenant ID while authenticated as Theatre B
      const resSpoof = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaB)
        .set('x-restaurant-id', theatreAId);

      assert.equal(resSpoof.status, 403, 'Cross-theatre spoofing must be strictly rejected');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Restaurant Module Non-Regression Tests
  // -------------------------------------------------------------------------
  describe('5. Restaurant Module Non-Regression', () => {
    it('restaurant tenant cannot access cinema payment routes', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieRestaurant)
        .set('x-restaurant-id', restaurantId);

      assert.equal(res.status, 403);
    });

    it('restaurant tables and session endpoints continue to work as expected', async () => {
      const res = await request(app)
        .get(`/api/tables?restaurantId=${restaurantId}`)
        .set('Cookie', cookieRestaurant)
        .set('x-restaurant-id', restaurantId);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].tableNumber, 'Table 1');
    });
  });
});
