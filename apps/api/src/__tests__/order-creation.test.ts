import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { db, restaurants, restaurantTables, products, orders, orderItems } from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Order Creation & Idempotency Domain API (Task 12)', () => {
  let restAId: string;
  let restBId: string;

  const now = Date.now();
  const restASlug = `order-test-resto-a-${now}`;
  const restBSlug = `order-test-resto-b-${now}`;

  let tableA1Id: string;
  let tableA1Token: string;
  let tableA2DisabledId: string;
  let tableA2DisabledToken: string;

  let prodA1Id: string; // Butter Chicken: 35000 paise, available
  let prodA2Id: string; // Garlic Naan: 6000 paise, available
  let prodA3SoldOutId: string; // Mango Lassi: 12000 paise, unavailable

  let prodB1Id: string; // Biryani (Restaurant B): 40000 paise

  const createdOrderIds: string[] = [];

  before(async () => {
    // 1. Seed Restaurant A
    restAId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restAId,
      name: 'Spice Symphony',
      slug: restASlug,
      phone: '+91 98765 00001',
      email: `spice-${now}@example.com`,
      currency: 'INR',
      isActive: true
    });

    // 2. Seed Restaurant B (Tenant Isolation testing)
    restBId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restBId,
      name: 'Biryani Palace',
      slug: restBSlug,
      phone: '+91 98765 00002',
      email: `biryani-${now}@example.com`,
      currency: 'INR',
      isActive: true
    });

    // 3. Seed Tables for Restaurant A
    tableA1Id = crypto.randomUUID();
    tableA1Token = crypto.randomBytes(16).toString('hex');
    await db.insert(restaurantTables).values({
      id: tableA1Id,
      restaurantId: restAId,
      tableNumber: 'Table 1',
      tableToken: tableA1Token,
      capacity: 4,
      isActive: true
    });

    tableA2DisabledId = crypto.randomUUID();
    tableA2DisabledToken = crypto.randomBytes(16).toString('hex');
    await db.insert(restaurantTables).values({
      id: tableA2DisabledId,
      restaurantId: restAId,
      tableNumber: 'Table 2 (Disabled)',
      tableToken: tableA2DisabledToken,
      capacity: 2,
      isActive: false // Disabled table
    });

    // 4. Seed Products for Restaurant A
    prodA1Id = crypto.randomUUID();
    await db.insert(products).values({
      id: prodA1Id,
      restaurantId: restAId,
      name: 'Butter Chicken',
      price: 35000, // 35000 paise = ₹350
      isAvailable: true,
      isVegetarian: false
    });

    prodA2Id = crypto.randomUUID();
    await db.insert(products).values({
      id: prodA2Id,
      restaurantId: restAId,
      name: 'Garlic Naan',
      price: 6000, // 6000 paise = ₹60
      isAvailable: true,
      isVegetarian: true
    });

    prodA3SoldOutId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodA3SoldOutId,
      restaurantId: restAId,
      name: 'Mango Lassi (Sold Out)',
      price: 12000, // 12000 paise = ₹120
      isAvailable: false, // Unavailable
      isVegetarian: true
    });

    // 5. Seed Product for Restaurant B (Cross-tenant testing)
    prodB1Id = crypto.randomUUID();
    await db.insert(products).values({
      id: prodB1Id,
      restaurantId: restBId,
      name: 'Hyderabadi Dum Biryani',
      price: 40000,
      isAvailable: true,
      isVegetarian: false
    });
  });

  after(async () => {
    // Clean up created orders & items
    if (createdOrderIds.length > 0) {
      await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds));
      await db.delete(orders).where(inArray(orders.id, createdOrderIds));
    }

    // Clean up products
    await db.delete(products).where(inArray(products.id, [prodA1Id, prodA2Id, prodA3SoldOutId, prodB1Id]));

    // Clean up tables
    await db.delete(restaurantTables).where(inArray(restaurantTables.id, [tableA1Id, tableA2DisabledId]));

    // Clean up restaurants
    await db.delete(restaurants).where(inArray(restaurants.id, [restAId, restBId]));
  });

  test('POST /api/orders — Successfully creates an order with public slug and QR tableToken', async () => {
    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      customerName: 'Aarav Sharma',
      customerPhone: '+91 98765 11111',
      specialInstructions: 'Please make it extra spicy',
      items: [
        {
          productId: prodA1Id,
          quantity: 2,
          notes: 'Boneless if possible'
        },
        {
          productId: prodA2Id,
          quantity: 3,
          notes: 'Crispy buttered'
        }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(201);

    assert.equal(res.body.message, 'Order placed successfully');
    const order = res.body.order;
    assert.ok(order.id);
    createdOrderIds.push(order.id);

    // Initial status must be 'new' on server
    assert.equal(order.status, 'new');

    // Human-friendly order number exists
    assert.ok(order.orderNumber);
    assert.match(order.orderNumber, /^\d+$/);

    // High-entropy customer statusToken exists
    assert.ok(order.statusToken);
    assert.ok(order.statusToken.length >= 32);

    // Total paise: 2 * 35000 + 3 * 6000 = 70000 + 18000 = 88000 paise (₹880)
    assert.equal(order.totalAmount, 88000);

    // Table context resolved
    assert.equal(order.table.id, tableA1Id);
    assert.equal(order.table.tableNumber, 'Table 1');

    // Items snapshots
    assert.equal(order.items.length, 2);
    const item1 = order.items.find((i: any) => i.productId === prodA1Id);
    assert.ok(item1);
    assert.equal(item1.productName, 'Butter Chicken');
    assert.equal(item1.quantity, 2);
    assert.equal(item1.unitPrice, 35000);
    assert.equal(item1.subtotal, 70000);
    assert.equal(item1.notes, 'Boneless if possible');

    const item2 = order.items.find((i: any) => i.productId === prodA2Id);
    assert.ok(item2);
    assert.equal(item2.productName, 'Garlic Naan');
    assert.equal(item2.quantity, 3);
    assert.equal(item2.unitPrice, 6000);
    assert.equal(item2.subtotal, 18000);
    assert.equal(item2.notes, 'Crispy buttered');

    // Internal secrets/keys should NOT be leaked
    assert.equal(order.restaurantId, undefined);
  });

  test('POST /api/orders — Ignores browser-supplied unit prices, totals, or statuses', async () => {
    // Malicious or buggy client attempting to manipulate price and status
    const tamperedPayload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      status: 'ready',
      totalAmount: 100, // Client claims ₹1
      items: [
        {
          productId: prodA1Id,
          quantity: 1,
          unitPrice: 50, // Client claims 50 paise
          subtotal: 50,
          notes: 'Extra onion'
        }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(tamperedPayload)
      .expect(201);

    const order = res.body.order;
    createdOrderIds.push(order.id);

    // Server MUST enforce 'new' status and DB price (35000 paise)
    assert.equal(order.status, 'new');
    assert.equal(order.totalAmount, 35000);
    assert.equal(order.items[0].unitPrice, 35000);
    assert.equal(order.items[0].subtotal, 35000);
  });

  test('POST /api/orders — Rejects unavailable or sold-out product with 400', async () => {
    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      items: [
        {
          productId: prodA3SoldOutId, // Mango Lassi is sold out
          quantity: 1
        }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(400);

    assert.match(res.body.error, /sold out|unavailable/i);
  });

  test('POST /api/orders — Rejects cross-tenant product ID with 400', async () => {
    // Attempting to order Restaurant B's biryani under Restaurant A
    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      items: [
        {
          productId: prodB1Id, // Belongs to Restaurant B
          quantity: 1
        }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(400);

    assert.match(res.body.error, /invalid or does not belong to this restaurant/i);
  });

  test('POST /api/orders — Rejects invalid or unguessable tableToken with 404', async () => {
    const payload = {
      restaurantSlug: restASlug,
      tableToken: 'nonexistent-token-deadbeef12345678',
      items: [
        {
          productId: prodA1Id,
          quantity: 1
        }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(404);

    assert.match(res.body.error, /table not found|invalid table token/i);
  });

  test('POST /api/orders — Rejects disabled / inactive table with 400', async () => {
    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableA2DisabledToken,
      items: [
        {
          productId: prodA1Id,
          quantity: 1
        }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(400);

    assert.match(res.body.error, /disabled or inactive/i);
  });

  test('POST /api/orders — Rejects non-existent restaurant slug with 404', async () => {
    const payload = {
      restaurantSlug: 'this-slug-definitely-does-not-exist-xyz',
      tableToken: tableA1Token,
      items: [
        {
          productId: prodA1Id,
          quantity: 1
        }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(404);

    assert.match(res.body.error, /restaurant is inactive or not found/i);
  });

  test('POST /api/orders — Idempotency protection prevents duplicate orders on retries', async () => {
    const idempotencyKey = `idemp-${crypto.randomUUID()}`;

    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      idempotencyKey,
      customerName: 'Priya Patel',
      items: [
        {
          productId: prodA2Id,
          quantity: 2
        }
      ]
    };

    // First attempt: should succeed and create order (201)
    const res1 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    const firstOrderId = res1.body.order.id;
    createdOrderIds.push(firstOrderId);

    // Second attempt with identical idempotencyKey: should return existing order (200)
    const res2 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(200);

    assert.equal(res2.body.idempotent, true);
    assert.match(res2.body.message, /idempotent replay/i);
    assert.equal(res2.body.order.id, firstOrderId);
    assert.equal(res2.body.order.totalAmount, 12000); // 2 * 6000

    // Verify in database that only ONE order exists with this idempotency key
    const dbOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey));

    assert.equal(dbOrders.length, 1);
  });

  test('GET /api/orders/status/:token — Customer can track order status without authentication', async () => {
    // 1. Create an order to get its status token
    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      customerName: 'Sneha Rao',
      items: [
        {
          productId: prodA1Id,
          quantity: 1,
          notes: 'No coriander'
        }
      ]
    };

    const createRes = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(201);

    const statusToken = createRes.body.order.statusToken;
    const orderId = createRes.body.order.id;
    createdOrderIds.push(orderId);
    assert.ok(statusToken);

    // 2. Query status using public endpoint without auth cookies or tokens
    const statusRes = await request(app)
      .get(`/api/orders/status/${statusToken}`)
      .expect(200);

    assert.equal(statusRes.body.statusToken, statusToken);
    assert.equal(statusRes.body.id, undefined); // Internal ID must not be exposed to customers
    assert.equal(statusRes.body.status, 'new');
    assert.equal(statusRes.body.customerName, 'Sneha Rao');
    assert.equal(statusRes.body.restaurant.slug, restASlug);
    assert.equal(statusRes.body.table.tableNumber, 'Table 1');
    assert.equal(statusRes.body.items.length, 1);
    assert.equal(statusRes.body.items[0].productName, 'Butter Chicken');
    assert.equal(statusRes.body.items[0].notes, 'No coriander');
  });

  test('GET /api/orders/status/:token — Rejects invalid or unknown status token with 404', async () => {
    const fakeToken = crypto.randomBytes(16).toString('hex');
    const res = await request(app)
      .get(`/api/orders/status/${fakeToken}`)
      .expect(404);

    assert.match(res.body.error, /order not found/i);
  });

  test('POST /api/orders — Input validation rejects excessive quantities or item counts', async () => {
    // Quantity > 99
    const excessiveQtyPayload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      items: [
        {
          productId: prodA1Id,
          quantity: 150 // Max is 99
        }
      ]
    };

    const qtyRes = await request(app)
      .post('/api/orders')
      .send(excessiveQtyPayload)
      .expect(400);

    assert.equal(qtyRes.body.error, 'Validation Error');
    assert.ok(qtyRes.body.details?.some((d: any) => /quantity cannot exceed 99/i.test(d.message)));

    // Note > 140 chars
    const longNotePayload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      items: [
        {
          productId: prodA1Id,
          quantity: 1,
          notes: 'a'.repeat(150) // Max is 140
        }
      ]
    };

    const noteRes = await request(app)
      .post('/api/orders')
      .send(longNotePayload)
      .expect(400);

    assert.equal(noteRes.body.error, 'Validation Error');
    assert.ok(noteRes.body.details?.some((d: any) => /cooking note cannot exceed 140 characters/i.test(d.message)));
  });

  test('POST /api/orders — Transaction rollback: database transaction aborts cleanly without orphaned records', async () => {
    const orderCountBefore = await db.select().from(orders);
    const itemsCountBefore = await db.select().from(orderItems);

    // Attempt an order where one item is invalid (sold out) alongside a valid item
    const payload = {
      restaurantSlug: restASlug,
      tableToken: tableA1Token,
      items: [
        { productId: prodA1Id, quantity: 1 },
        { productId: prodA3SoldOutId, quantity: 1 }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(payload)
      .expect(400);

    assert.match(res.body.error, /sold out|unavailable/i);

    const orderCountAfter = await db.select().from(orders);
    const itemsCountAfter = await db.select().from(orderItems);

    // Neither an order nor any order_item should have been inserted
    assert.equal(orderCountAfter.length, orderCountBefore.length);
    assert.equal(itemsCountAfter.length, itemsCountBefore.length);
  });

  test('POST /api/orders — Atomic transaction rollback on database level error', async () => {
    const testOrderId = crypto.randomUUID();
    let caughtError = false;

    // Direct database transaction rollback verification:
    // Inserting an order then throwing an error rolls back the insert completely
    try {
      await db.transaction(async (tx) => {
        await tx.insert(orders).values({
          id: testOrderId,
          orderNumber: '9999',
          restaurantId: restAId,
          tableId: tableA1Id,
          status: 'new',
          totalAmount: 10000
        });

        // Force a simulated transaction failure
        throw new Error('Simulated atomic transaction failure');
      });
    } catch (err: any) {
      if (err.message === 'Simulated atomic transaction failure') {
        caughtError = true;
      }
    }

    assert.equal(caughtError, true);

    // Verify order with testOrderId was NOT committed
    const [found] = await db.select().from(orders).where(eq(orders.id, testOrderId)).limit(1);
    assert.equal(found, undefined);
  });
});
