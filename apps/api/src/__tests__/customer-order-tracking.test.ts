import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { db, restaurants, restaurantTables, orders, orderItems, orderStatusHistory } from '@menugo/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Customer Order Tracking API & Field Filtering (Task 16)', () => {
  const testRestId = crypto.randomUUID();
  const testTableId = crypto.randomUUID();
  const testOrderId = crypto.randomUUID();
  const testValidStatusToken = 'track_token_' + crypto.randomBytes(24).toString('hex');

  before(async () => {
    // 1. Create Restaurant
    await db.insert(restaurants).values({
      id: testRestId,
      name: 'Tracking Test Bistro',
      slug: 'tracking-test-bistro-' + Date.now(),
      currency: 'INR',
      isActive: true
    });

    // 2. Create Table
    await db.insert(restaurantTables).values({
      id: testTableId,
      restaurantId: testRestId,
      tableNumber: 'Table 9',
      capacity: 4,
      tableToken: 'tbl_' + crypto.randomBytes(16).toString('hex')
    });

    // 3. Create Order with sensitive PII and internal fields
    await db.insert(orders).values({
      id: testOrderId,
      restaurantId: testRestId,
      tableId: testTableId,
      orderNumber: 'TRK-9001',
      status: 'new',
      totalAmount: 64000, // 640.00 INR
      customerName: 'Ananya Roy',
      customerPhone: '+91 98765 43210', // PII - should be omitted from tracking
      specialInstructions: 'Please make it extra crispy',
      statusToken: testValidStatusToken,
      idempotencyKey: 'idem_key_trk_' + Date.now()
    });

    // 4. Create Order Items
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: testOrderId,
        productId: null,
        productName: 'Paneer Tikka Roll',
        quantity: 2,
        unitPrice: 22000,
        subtotal: 44000,
        notes: 'Less oil'
      },
      {
        id: crypto.randomUUID(),
        orderId: testOrderId,
        productId: null,
        productName: 'Masala Chai',
        quantity: 2,
        unitPrice: 10000,
        subtotal: 20000,
        notes: null
      }
    ]);
  });

  after(async () => {
    await db.delete(orderItems).where(eq(orderItems.orderId, testOrderId));
    await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, testOrderId));
    await db.delete(orders).where(eq(orders.id, testOrderId));
    await db.delete(restaurantTables).where(eq(restaurantTables.id, testTableId));
    await db.delete(restaurants).where(eq(restaurants.id, testRestId));
  });

  describe('1. Valid Token Resolution & Field Filtering (Requirements 2, 3, 7)', () => {
    test('valid tracking token returns 200 OK with expected customer-visible fields', async () => {
      const res = await request(app).get(`/api/orders/status/${testValidStatusToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.orderNumber, 'TRK-9001');
      assert.equal(res.body.status, 'new');
      assert.equal(res.body.totalAmount, 64000);
      assert.equal(res.body.statusToken, testValidStatusToken);
      assert.equal(res.body.customerName, 'Ananya Roy');
      assert.equal(res.body.specialInstructions, 'Please make it extra crispy');

      // Table & Restaurant objects
      assert.equal(res.body.table?.tableNumber, 'Table 9');
      assert.equal(res.body.restaurant?.name, 'Tracking Test Bistro');

      // Items list
      assert.equal(res.body.items?.length, 2);
      assert.equal(res.body.items[0]?.productName, 'Paneer Tikka Roll');
      assert.equal(res.body.items[0]?.quantity, 2);
      assert.equal(res.body.items[0]?.subtotal, 44000);
      assert.equal(res.body.items[0]?.notes, 'Less oil');
    });

    test('strictly omits internal IDs, staff info, member details and sensitive PII', async () => {
      const res = await request(app).get(`/api/orders/status/${testValidStatusToken}`);
      assert.equal(res.status, 200);

      const jsonStr = JSON.stringify(res.body);

      // 1. Internal Order database UUID must not be present
      assert.equal(res.body.id, undefined);
      assert.equal(jsonStr.includes(testOrderId), false);

      // 2. Table database UUID must not be present
      assert.equal(res.body.table?.id, undefined);
      assert.equal(jsonStr.includes(testTableId), false);

      // 3. Restaurant database UUID must not be present
      assert.equal(res.body.restaurant?.id, undefined);
      assert.equal(jsonStr.includes(testRestId), false);

      // 4. Product IDs and OrderItem IDs must not be present
      for (const item of res.body.items) {
        assert.equal(item.id, undefined);
        assert.equal(item.productId, undefined);
        assert.equal(item.orderId, undefined);
      }

      // 5. Customer Phone Number (PII) must not be exposed in public tracking endpoint
      assert.equal(res.body.customerPhone, undefined);
      assert.equal(jsonStr.includes('+91 98765 43210'), false);

      // 6. Administrative / member data must not be exposed
      assert.equal(res.body.statusHistory, undefined);
      assert.equal(res.body.idempotencyKey, undefined);
    });
  });

  describe('2. Invalid & Malformed Token Handling (Requirement 6)', () => {
    test('non-existent token returns generic 404 without revealing order existence', async () => {
      const fakeToken = 'track_token_' + crypto.randomBytes(24).toString('hex');
      const res = await request(app).get(`/api/orders/status/${fakeToken}`);

      assert.equal(res.status, 404);
      assert.ok(res.body.error?.includes('Order not found or tracking token is invalid'));
    });

    test('short or malformed token returns identical generic 404', async () => {
      const resShort = await request(app).get('/api/orders/status/abc123');

      assert.equal(resShort.status, 404);
      assert.ok(resShort.body.error?.includes('Order not found or tracking token is invalid'));
    });

    test('special character injection in token safely returns generic 404', async () => {
      const resInjection = await request(app).get('/api/orders/status/%27%20OR%201=1--');

      assert.equal(resInjection.status, 404);
      assert.ok(resInjection.body.error?.includes('Order not found or tracking token is invalid'));
    });
  });

  describe('3. Status Progression & Terminal States (Requirement 4)', () => {
    test('reflects status transitions from new -> accepted -> preparing -> ready -> served', async () => {
      // 1. Move to preparing
      await db.update(orders).set({ status: 'preparing' }).where(eq(orders.id, testOrderId));

      const prepRes = await request(app).get(`/api/orders/status/${testValidStatusToken}`);
      assert.equal(prepRes.status, 200);
      assert.equal(prepRes.body.status, 'preparing');

      // 2. Move to ready
      await db.update(orders).set({ status: 'ready' }).where(eq(orders.id, testOrderId));

      const readyRes = await request(app).get(`/api/orders/status/${testValidStatusToken}`);
      assert.equal(readyRes.status, 200);
      assert.equal(readyRes.body.status, 'ready');

      // 3. Move to served (Terminal completed state)
      await db.update(orders).set({ status: 'served' }).where(eq(orders.id, testOrderId));

      const servedRes = await request(app).get(`/api/orders/status/${testValidStatusToken}`);
      assert.equal(servedRes.status, 200);
      assert.equal(servedRes.body.status, 'served');
    });

    test('accurately reflects cancelled status for voided/rejected orders', async () => {
      await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, testOrderId));

      const cancelRes = await request(app).get(`/api/orders/status/${testValidStatusToken}`);
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body.status, 'cancelled');
    });
  });
});
