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
  cinemaWebhookEvents,
  orders,
  orderItems,
  orderStatusHistory,
  cinemaScreens,
  cinemaShows,
  cinemaMovies
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
  PaytmPaymentProvider
} from '../lib/payment';
import {
  generatePaytmSignature,
  generatePaytmParamChecksum,
  verifyPaytmSignature
} from '../lib/payment/paytm.adapter';

process.env.NODE_ENV = 'test';

describe('Task 13: Paytm Payment Gateway Integration', () => {
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

  const paytmMidA = `TEST_THEATRE_MID_${timestamp.toString().slice(-6)}`;
  const paytmKeyA = `MockMerchantKeySecret_${timestamp}`;

  const paytmMidB = `TEST_THEATRE_MID_B_${timestamp.toString().slice(-6)}`;
  const paytmKeyB = `MockMerchantKeySecretB_${timestamp}`;

  let orderAId: string;
  let orderAStatusToken: string;
  let orderBId: string;
  let orderBStatusToken: string;

  before(async () => {
    // 1. Create Cinema Administrator for Theatre A
    const resA = await auth.api.signUpEmail({
      body: {
        email: `theatre-paytm-a-${timestamp}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre Paytm Admin A'
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
        email: `theatre-paytm-b-${timestamp}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre Paytm Admin B'
      },
      asResponse: true
    });
    cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    // 3. Create Restaurant Owner for Regression Testing
    const resRest = await auth.api.signUpEmail({
      body: {
        email: `rest-paytm-owner-${timestamp}@restaurant.com`,
        password: 'Password123!',
        name: 'Restaurant Owner'
      },
      asResponse: true
    });
    cookieRestaurant = resRest.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonRest = await resRest.json();
    userRestaurantId = jsonRest.user.id;
    createdUsersToClean.push(userRestaurantId);

    // 4. Create Theatre A
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'PVR Forum Mall Cinemas',
      slug: `pvr-forum-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true,
      settings: { taxPercentage: 5 }
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreAId,
      theatreName: 'PVR Forum Mall Cinemas',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9876543211',
      contactEmail: 'admin@pvrforum.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      onboardingStage: 'payment_configured',
      onboardingCompleted: false
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'owner'
    });

    // 5. Create Theatre B
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'INOX Garuda Mall',
      slug: `inox-garuda-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreBId,
      theatreName: 'INOX Garuda Mall',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9876543212',
      contactEmail: 'admin@inoxgaruda.com',
      currency: 'INR',
      onboardingStage: 'payment_configured'
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreBId,
      userId: userCinemaBId,
      role: 'owner'
    });

    // 6. Create Restaurant
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Empire Restaurant',
      slug: `empire-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId,
      userId: userRestaurantId,
      role: 'owner'
    });

    // 7. Seed pending cinema order for Theatre A
    orderAId = crypto.randomUUID();
    orderAStatusToken = crypto.randomBytes(16).toString('hex');
    await db.insert(orders).values({
      id: orderAId,
      orderNumber: `PVR-ORD-${timestamp.toString().slice(-6)}`,
      restaurantId: theatreAId,
      orderType: 'cinema',
      status: 'pending',
      paymentStatus: 'unpaid',
      subtotal: 40000,
      taxAmount: 2000,
      totalAmount: 42000, // ₹420.00
      customerName: 'Aarav Sharma',
      customerPhone: '9876543210',
      statusToken: orderAStatusToken
    });

    // Seed pending cinema order for Theatre B
    orderBId = crypto.randomUUID();
    orderBStatusToken = crypto.randomBytes(16).toString('hex');
    await db.insert(orders).values({
      id: orderBId,
      orderNumber: `INOX-ORD-${timestamp.toString().slice(-6)}`,
      restaurantId: theatreBId,
      orderType: 'cinema',
      status: 'pending',
      paymentStatus: 'unpaid',
      subtotal: 50000,
      taxAmount: 2500,
      totalAmount: 52500, // ₹525.00
      customerName: 'Pooja Hegde',
      customerPhone: '9876543219',
      statusToken: orderBStatusToken
    });
  });

  after(async () => {
    try {
      await db.delete(cinemaWebhookEvents).where(inArray(cinemaWebhookEvents.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaRefunds).where(inArray(cinemaRefunds.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaPaymentTransactions).where(inArray(cinemaPaymentTransactions.theatreId, [theatreAId, theatreBId]));
      await db.delete(orders).where(inArray(orders.id, [orderAId, orderBId]));
      await db.delete(cinemaPaymentAccounts).where(inArray(cinemaPaymentAccounts.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));
      if (createdUsersToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUsersToClean));
      }
      await pool.end();
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
  });

  describe('1. Paytm Provider Adapter & Cryptographic Verification', () => {
    it('factory returns singleton PaytmPaymentProvider instance', () => {
      const paytm = getPaymentProvider('paytm');
      assert.ok(paytm instanceof PaytmPaymentProvider);
      assert.equal(paytm.providerName, 'paytm');
    });

    it('generates and verifies timing-safe Paytm HMAC-SHA256 signatures', () => {
      const payload = {
        MID: 'TEST_MID_123',
        ORDERID: 'ORDER_999',
        TXNAMOUNT: '420.00'
      };
      const key = 'SecretMerchantKey2026';
      const signature = generatePaytmSignature(payload, key);
      assert.ok(typeof signature === 'string' && signature.length > 0);

      const isValid = verifyPaytmSignature(payload, signature, key);
      assert.equal(isValid, true);

      const isInvalidKey = verifyPaytmSignature(payload, signature, 'WrongKey');
      assert.equal(isInvalidKey, false);

      const isInvalidPayload = verifyPaytmSignature({ ...payload, TXNAMOUNT: '999.00' }, signature, key);
      assert.equal(isInvalidPayload, false);
    });

    it('generates and verifies Paytm parameter dictionary checksums', () => {
      const params = {
        MID: 'TEST_MID_123',
        ORDERID: 'ORDER_999',
        TXNAMOUNT: '420.00',
        STATUS: 'TXN_SUCCESS'
      };
      const key = 'SecretMerchantKey2026';
      const checksum = generatePaytmParamChecksum(params, key);
      assert.ok(typeof checksum === 'string' && checksum.length > 0);

      const isValid = verifyPaytmSignature(params, checksum, key);
      assert.equal(isValid, true);
    });

    it('rejects invalid Paytm credentials during adapter verification', async () => {
      const paytm = getPaymentProvider('paytm');
      const result = await paytm.verifyConnection({
        environment: 'test',
        keyId: '',
        keySecret: ''
      });
      assert.equal(result.success, false);
      assert.equal(result.error, 'MISSING_CREDENTIALS');
    });
  });

  describe('2. Theatre Merchant Account Configuration (Paytm)', () => {
    it('configures and verifies Paytm merchant credentials for Theatre A', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/configure')
        .set('Cookie', cookieCinemaA)
        .set('x-theatre-id', theatreAId)
        .send({
          provider: 'paytm',
          environment: 'test',
          keyId: paytmMidA,
          keySecret: paytmKeyA
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.account.provider, 'paytm');
      assert.equal(res.body.account.isVerified, true);
      assert.equal(res.body.account.status, 'connected');
      assert.equal(res.body.account.keyId, paytmMidA);
      // Secrets must never be exposed
      assert.equal(res.body.account.keySecret, undefined);
      assert.ok(res.body.account.maskedKeySecret.includes('••••'));

      // Check database encryption at rest
      const [stored] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreAId),
            eq(cinemaPaymentAccounts.provider, 'paytm')
          )
        );
      assert.ok(stored);
      assert.notEqual(stored.encryptedKeySecret, paytmKeyA);
      const decrypted = decryptSecret(stored.encryptedKeySecret);
      assert.equal(decrypted, paytmKeyA);
    });

    it('configures and verifies independent Paytm merchant credentials for Theatre B', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/configure')
        .set('Cookie', cookieCinemaB)
        .set('x-theatre-id', theatreBId)
        .send({
          provider: 'paytm',
          environment: 'test',
          keyId: paytmMidB,
          keySecret: paytmKeyB
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.account.keyId, paytmMidB);
    });
  });

  describe('3. Payment Order Creation via Theatre Merchant Account', () => {
    let transactionAId: string;
    let providerOrderIdA: string;

    it('creates a Paytm payment transaction order using backend-authoritative amount', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: orderAId,
          statusToken: orderAStatusToken,
          provider: 'paytm'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.provider, 'paytm');
      assert.equal(res.body.amount, 42000); // 420.00
      assert.equal(res.body.currency, 'INR');
      assert.ok(res.body.transactionId);
      assert.ok(res.body.providerOrderId);
      assert.ok(res.body.providerPayload.txnToken);
      assert.equal(res.body.providerPayload.mid, paytmMidA);
      // Secrets must never be exposed in public checkout payload
      assert.equal(res.body.providerPayload.keySecret, undefined);

      transactionAId = res.body.transactionId;
      providerOrderIdA = res.body.providerOrderId;

      // Verify payment record in database
      const [tx] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.id, transactionAId));
      assert.ok(tx);
      assert.equal(tx.status, 'PENDING');
      assert.equal(tx.amount, 42000);
      assert.equal(tx.theatreId, theatreAId);
    });

    it('rejects payment order creation if order status token is invalid or missing', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: orderAId,
          statusToken: 'wrong_invalid_token',
          provider: 'paytm'
        });

      assert.equal(res.status, 404);
    });
  });

  describe('4. Server-Side Payment Verification', () => {
    let orderToCaptureId: string;
    let orderToCaptureToken: string;
    let transactionToCaptureId: string;

    before(async () => {
      orderToCaptureId = crypto.randomUUID();
      orderToCaptureToken = crypto.randomBytes(16).toString('hex');
      await db.insert(orders).values({
        id: orderToCaptureId,
        orderNumber: `PVR-ORD-VERIFY-${timestamp.toString().slice(-4)}`,
        restaurantId: theatreAId,
        orderType: 'cinema',
        status: 'pending',
        paymentStatus: 'unpaid',
        subtotal: 30000,
        taxAmount: 1500,
        totalAmount: 31500,
        statusToken: orderToCaptureToken
      });

      const orderRes = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: orderToCaptureId,
          statusToken: orderToCaptureToken,
          provider: 'paytm'
        });
      transactionToCaptureId = orderRes.body.transactionId;
    });

    it('rejects verification if provider signature or checksum is invalid', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToCaptureId,
          statusToken: orderToCaptureToken,
          transactionId: transactionToCaptureId,
          provider: 'paytm',
          providerPaymentId: 'paytm_txn_test_1',
          providerOrderId: orderToCaptureId,
          providerSignature: 'corrupted_or_invalid_signature',
          responsePayload: {
            STATUS: 'TXN_SUCCESS'
          }
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.verified, false);
      assert.equal(res.body.status, 'FAILED');
    });

    it('verifies and captures payment, confirms order, and logs audit trail', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToCaptureId,
          statusToken: orderToCaptureToken,
          transactionId: transactionToCaptureId,
          provider: 'paytm',
          providerPaymentId: `mock_paytm_txn_${timestamp}`,
          providerOrderId: orderToCaptureId,
          providerSignature: 'test_sig_captured',
          responsePayload: {
            STATUS: 'TXN_SUCCESS'
          }
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.verified, true);
      assert.equal(res.body.status, 'CAPTURED');

      // Verify transaction table status
      const [tx] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.id, transactionToCaptureId));
      assert.equal(tx.status, 'CAPTURED');

      // Verify order table status
      const [confirmedOrder] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderToCaptureId));
      assert.equal(confirmedOrder.status, 'confirmed');
      assert.equal(confirmedOrder.paymentStatus, 'paid');

      // Verify audit log in orderStatusHistory
      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderToCaptureId));
      assert.ok(history.length > 0);
      const captureLog = history.find((h) => h.toStatus === 'confirmed');
      assert.ok(captureLog);
      assert.ok(captureLog.reason?.includes('PAYTM'));
    });

    it('is idempotent on duplicate verification requests for already captured payment', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToCaptureId,
          statusToken: orderToCaptureToken,
          transactionId: transactionToCaptureId,
          provider: 'paytm',
          providerPaymentId: `mock_paytm_txn_${timestamp}`,
          providerOrderId: orderToCaptureId
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.verified, true);
      assert.equal(res.body.status, 'CAPTURED');
    });
  });

  describe('5. Webhook Handling and Idempotency', () => {
    let orderWebhookId: string;
    let orderWebhookToken: string;
    let transactionWebhookId: string;
    const webhookEventId = `paytm_event_${timestamp}_${crypto.randomBytes(4).toString('hex')}`;

    before(async () => {
      orderWebhookId = crypto.randomUUID();
      orderWebhookToken = crypto.randomBytes(16).toString('hex');
      await db.insert(orders).values({
        id: orderWebhookId,
        orderNumber: `PVR-ORD-WH-${timestamp.toString().slice(-4)}`,
        restaurantId: theatreAId,
        orderType: 'cinema',
        status: 'pending',
        paymentStatus: 'unpaid',
        subtotal: 20000,
        taxAmount: 1000,
        totalAmount: 21000,
        statusToken: orderWebhookToken
      });

      const orderRes = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: orderWebhookId,
          statusToken: orderWebhookToken,
          provider: 'paytm'
        });
      transactionWebhookId = orderRes.body.transactionId;
    });

    it('processes asynchronous server-to-server Paytm webhook and captures transaction', async () => {
      const webhookPayload = {
        MID: paytmMidA,
        ORDERID: orderWebhookId,
        TXNID: webhookEventId,
        TXNAMOUNT: '210.00',
        STATUS: 'TXN_SUCCESS',
        CHECKSUMHASH: 'test_sig_captured'
      };

      const res = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(webhookPayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify transaction is captured
      const [tx] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.id, transactionWebhookId));
      assert.equal(tx.status, 'CAPTURED');

      // Verify order is confirmed
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderWebhookId));
      assert.equal(order.status, 'confirmed');
      assert.equal(order.paymentStatus, 'paid');

      // Verify event was logged in cinemaWebhookEvents
      const [event] = await db
        .select()
        .from(cinemaWebhookEvents)
        .where(
          and(
            eq(cinemaWebhookEvents.theatreId, theatreAId),
            eq(cinemaWebhookEvents.providerEventId, webhookEventId)
          )
        );
      assert.ok(event);
      assert.equal(event.status, 'processed');
    });

    it('enforces idempotency on duplicate webhook delivery with same event ID', async () => {
      const duplicatePayload = {
        MID: paytmMidA,
        ORDERID: orderWebhookId,
        TXNID: webhookEventId,
        TXNAMOUNT: '210.00',
        STATUS: 'TXN_SUCCESS',
        CHECKSUMHASH: 'test_sig_captured'
      };

      const res = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(duplicatePayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes('idempotent'));
    });

    it('delayed webhook safety: never downgrades an already CAPTURED transaction to FAILED', async () => {
      const delayedFailureEventId = `paytm_event_delayed_fail_${timestamp}`;
      const delayedFailPayload = {
        MID: paytmMidA,
        ORDERID: orderWebhookId,
        TXNID: delayedFailureEventId,
        TXNAMOUNT: '210.00',
        STATUS: 'TXN_FAILURE',
        CHECKSUMHASH: 'test_sig_captured'
      };

      const res = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(delayedFailPayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Transaction and order must RETAIN CAPTURED/CONFIRMED status
      const [tx] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.id, transactionWebhookId));
      assert.equal(tx.status, 'CAPTURED');

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderWebhookId));
      assert.equal(order.status, 'confirmed');
      assert.equal(order.paymentStatus, 'paid');
    });
  });

  describe('6. Admin-Authorized Refund Processing via Theatre Paytm Account', () => {
    let orderToRefundId: string;
    let orderToRefundToken: string;
    let capturedTxId: string;

    before(async () => {
      orderToRefundId = crypto.randomUUID();
      orderToRefundToken = crypto.randomBytes(16).toString('hex');
      await db.insert(orders).values({
        id: orderToRefundId,
        orderNumber: `PVR-ORD-REFUND-${timestamp.toString().slice(-4)}`,
        restaurantId: theatreAId,
        orderType: 'cinema',
        status: 'confirmed',
        paymentStatus: 'paid',
        subtotal: 10000,
        taxAmount: 500,
        totalAmount: 10500, // ₹105.00
        statusToken: orderToRefundToken
      });

      capturedTxId = crypto.randomUUID();
      await db.insert(cinemaPaymentTransactions).values({
        id: capturedTxId,
        theatreId: theatreAId,
        orderId: orderToRefundId,
        provider: 'paytm',
        providerOrderId: orderToRefundId,
        providerPaymentId: `mock_captured_txn_${timestamp}`,
        amount: 10500,
        currency: 'INR',
        status: 'CAPTURED',
        refundAmount: 0,
        refundStatus: null
      });
    });

    it('rejects refund if amount exceeds transaction amount', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/refunds')
        .set('Cookie', cookieCinemaA)
        .set('x-theatre-id', theatreAId)
        .send({
          transactionId: capturedTxId,
          amount: 20000, // exceeds 10500
          reason: 'Excessive refund'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('exceeds'));
    });

    it('processes partial refund and updates transaction ledger', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/refunds')
        .set('Cookie', cookieCinemaA)
        .set('x-theatre-id', theatreAId)
        .send({
          transactionId: capturedTxId,
          amount: 5000, // ₹50.00 partial
          reason: 'Customer requested cancellation of popcorn'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.refund.status, 'REFUND_PROCESSED');
      assert.equal(res.body.refund.amount, 5000);
      assert.ok(res.body.refund.providerRefundId);

      // Verify transaction ledger in database
      const [tx] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.id, capturedTxId));
      assert.equal(tx.refundAmount, 5000);
      assert.equal(tx.refundStatus, 'PARTIALLY_REFUNDED');
    });

    it('processes remaining balance refund and marks transaction & order as fully refunded', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/refunds')
        .set('Cookie', cookieCinemaA)
        .set('x-theatre-id', theatreAId)
        .send({
          transactionId: capturedTxId,
          amount: 5500, // remaining 10500 - 5000 = 5500
          reason: 'Show cancelled by theatre'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.refund.status, 'REFUND_PROCESSED');

      // Verify transaction ledger
      const [tx] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.id, capturedTxId));
      assert.equal(tx.refundAmount, 10500);
      assert.equal(tx.refundStatus, 'REFUNDED');

      // Verify order payment status
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderToRefundId));
      assert.equal(order.paymentStatus, 'refunded');
    });
  });

  describe('7. Tenant Isolation Between Theatres', () => {
    it('Theatre B admin cannot refund or access Theatre A payment transaction', async () => {
      // Theatre B admin attempts to initiate refund on Theatre A transaction
      const res = await request(app)
        .post('/api/cinema/payments/refunds')
        .set('Cookie', cookieCinemaB)
        .set('x-theatre-id', theatreBId)
        .send({
          transactionId: orderAId,
          amount: 1000,
          reason: 'Cross-tenant illegal refund'
        });

      // Must be 404 Not Found (or rejected) because transaction belongs to Theatre A
      assert.ok(res.status === 404 || res.status === 403);
    });

    it('Theatre B admin cannot view Theatre A transactions ledger', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/transactions')
        .set('Cookie', cookieCinemaB)
        .set('x-theatre-id', theatreBId);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.transactions));
      const hasTheatreATx = res.body.transactions.some(
        (tx: any) => tx.theatreId === theatreAId
      );
      assert.equal(hasTheatreATx, false);
    });
  });

  describe('8. Restaurant Module Regression', () => {
    it('restaurant tables and routes continue operating without regression', async () => {
      const res = await request(app)
        .get('/api/tables')
        .set('Cookie', cookieRestaurant)
        .set('x-restaurant-id', restaurantId);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
  });
});
