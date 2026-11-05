import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, user, restaurants, restaurantMembers, categories, products, orders, orderItems, restaurantTables } from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Product Management API & Multi-Tenant Isolation', () => {
  let userAId: string;
  let userBId: string;
  let userKitchenId: string;

  let cookieA: string;
  let cookieB: string;
  let cookieKitchen: string;

  const restAId = crypto.randomUUID();
  const restBId = crypto.randomUUID();

  const memberAId = crypto.randomUUID();
  const memberBId = crypto.randomUUID();
  const memberKitchenId = crypto.randomUUID();

  const catAId = crypto.randomUUID();
  const catBId = crypto.randomUUID();

  let prodA1Id: string;
  let prodA2Id: string;
  let prodB1Id: string;

  const tableAId = crypto.randomUUID();
  const orderAId = crypto.randomUUID();
  const orderItemAId = crypto.randomUUID();

  const now = Date.now();

  before(async () => {
    // 1. Create Users
    const resA = await auth.api.signUpEmail({
      body: { name: 'Owner Prod A', email: `prod-owner-a-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    userAId = (await resA.json()).user.id;

    const resB = await auth.api.signUpEmail({
      body: { name: 'Owner Prod B', email: `prod-owner-b-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    userBId = (await resB.json()).user.id;

    const resK = await auth.api.signUpEmail({
      body: { name: 'Kitchen Prod Staff', email: `prod-kitchen-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieKitchen = resK.headers.get('set-cookie')?.split(';')[0] || '';
    userKitchenId = (await resK.json()).user.id;

    // 2. Create Restaurants
    await db.insert(restaurants).values([
      { id: restAId, name: 'Product Rest A', slug: `prod-rest-a-${now}`, isActive: true },
      { id: restBId, name: 'Product Rest B', slug: `prod-rest-b-${now}`, isActive: true }
    ]);

    // 3. Create Memberships
    await db.insert(restaurantMembers).values([
      { id: memberAId, restaurantId: restAId, userId: userAId, role: 'owner' },
      { id: memberBId, restaurantId: restBId, userId: userBId, role: 'owner' },
      { id: memberKitchenId, restaurantId: restAId, userId: userKitchenId, role: 'kitchen' }
    ]);

    // 4. Create Categories in respective restaurants
    await db.insert(categories).values([
      { id: catAId, restaurantId: restAId, name: 'Cat A Starters', sortOrder: 0, isActive: true },
      { id: catBId, restaurantId: restBId, name: 'Cat B Mains', sortOrder: 0, isActive: true }
    ]);
  });

  after(async () => {
    // Teardown
    await db.delete(orderItems).where(eq(orderItems.id, orderItemAId));
    await db.delete(orders).where(eq(orders.id, orderAId));
    await db.delete(restaurantTables).where(eq(restaurantTables.id, tableAId));

    const prods = [prodA1Id, prodA2Id, prodB1Id].filter(Boolean);
    if (prods.length > 0) {
      await db.delete(products).where(inArray(products.id, prods));
    }

    await db.delete(categories).where(inArray(categories.id, [catAId, catBId]));
    await db.delete(restaurantMembers).where(
      inArray(restaurantMembers.id, [memberAId, memberBId, memberKitchenId])
    );
    await db.delete(restaurants).where(inArray(restaurants.id, [restAId, restBId]));
    const userIds = [userAId, userBId, userKitchenId].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(user).where(inArray(user.id, userIds));
    }
  });

  // -------------------------------------------------------------------------
  // 1. Product Creation & Validation
  // -------------------------------------------------------------------------
  test('Owner A creates product with integer paise price and category verification', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Crispy Dosa',
        description: 'Golden crepe with spiced potato filling',
        categoryId: catAId,
        price: 12000, // ₹120.00 in paise
        isVegetarian: true,
        isAvailable: true,
        sortOrder: 0
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Crispy Dosa');
    assert.equal(res.body.price, 12000);
    assert.equal(res.body.restaurantId, restAId);
    assert.equal(res.body.categoryId, catAId);
    assert.equal(res.body.isVegetarian, true);
    assert.equal(res.body.isAvailable, true);
    prodA1Id = res.body.id;
  });

  test('Product creation auto-computes sequential sortOrder if omitted', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Idli Sambar',
        price: 8000 // ₹80.00
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Idli Sambar');
    assert.equal(res.body.sortOrder, 1); // follows sortOrder 0 of Crispy Dosa
    prodA2Id = res.body.id;
  });

  test('Product creation rejects float prices and negative prices', async () => {
    // Float paise
    const resFloat = await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Float Price Item',
        price: 99.5
      });
    assert.equal(resFloat.status, 400);

    // Negative paise
    const resNeg = await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Negative Price Item',
        price: -100
      });
    assert.equal(resNeg.status, 400);
  });

  test('Cross-tenant category verification: Owner A cannot link product to Owner B category', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Hijacked Category Item',
        categoryId: catBId, // Belongs to Rest B!
        price: 15000
      });

    assert.equal(res.status, 400);
    const errMsg = res.body.error || res.body.message || '';
    assert.ok(
      errMsg.includes('category does not exist or does not belong to this restaurant')
    );
  });

  test('Cross-tenant image reference protection: cannot reference another restaurant image key', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Hijacked Image Item',
        price: 15000,
        imageKey: `${restBId}/products/stolen.jpg`
      });

    assert.equal(res.status, 403);
    const errMsg = res.body.error || res.body.message || '';
    assert.ok(errMsg.includes('Image does not belong to this restaurant'));
  });

  // -------------------------------------------------------------------------
  // 2. Listing & Reading Scoped Products
  // -------------------------------------------------------------------------
  test('List products returns only authorized restaurant products with category details', async () => {
    // First, let Owner B create a product in Rest B
    const resB = await request(app)
      .post('/api/products')
      .set('Cookie', cookieB)
      .set('x-restaurant-id', restBId)
      .send({
        name: 'Rest B Biryani',
        categoryId: catBId,
        price: 25000
      });
    assert.equal(resB.status, 201);
    prodB1Id = resB.body.id;

    // Owner A lists products
    const listA = await request(app)
      .get('/api/products')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId);

    assert.equal(listA.status, 200);
    assert.ok(Array.isArray(listA.body));
    const returnedIds = listA.body.map((p: any) => p.id);
    assert.ok(returnedIds.includes(prodA1Id));
    assert.ok(returnedIds.includes(prodA2Id));
    assert.ok(!returnedIds.includes(prodB1Id), 'Owner A must not see Rest B product');

    // Category name is joined
    const dosa = listA.body.find((p: any) => p.id === prodA1Id);
    assert.equal(dosa.categoryName, 'Cat A Starters');
  });

  test('List products with categoryId filter returns only matching category products', async () => {
    const res = await request(app)
      .get(`/api/products?categoryId=${catAId}`)
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.ok(res.body.every((p: any) => p.categoryId === catAId));
  });

  test('Get single product via GET /:id returns product details and enforces tenant isolation', async () => {
    // Owner A reads prodA1Id
    const res = await request(app)
      .get(`/api/products/${prodA1Id}`)
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, prodA1Id);
    assert.equal(res.body.name, 'Crispy Dosa');

    // IDOR Protection: Owner B attempts to read Owner A product
    const resIdor = await request(app)
      .get(`/api/products/${prodA1Id}`)
      .set('Cookie', cookieB)
      .set('x-restaurant-id', restBId);

    assert.equal(resIdor.status, 404);
  });

  // -------------------------------------------------------------------------
  // 3. Reordering Products
  // -------------------------------------------------------------------------
  test('Reorder products updates sort sequence in database', async () => {
    const res = await request(app)
      .put('/api/products/reorder')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        items: [
          { id: prodA2Id, sortOrder: 0 },
          { id: prodA1Id, sortOrder: 1 }
        ]
      });

    assert.equal(res.status, 200);

    // Verify database
    const [p2] = await db.select().from(products).where(eq(products.id, prodA2Id));
    const [p1] = await db.select().from(products).where(eq(products.id, prodA1Id));
    assert.equal(p2!.sortOrder, 0);
    assert.equal(p1!.sortOrder, 1);
  });

  test('Cross-tenant IDOR attack on product reorder is strictly prevented', async () => {
    // Owner A attempts to reorder Owner B's product
    await request(app)
      .put('/api/products/reorder')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        items: [{ id: prodB1Id, sortOrder: 99 }]
      });

    // Verify Owner B product remains untouched
    const [prodB] = await db.select().from(products).where(eq(products.id, prodB1Id));
    assert.equal(prodB!.sortOrder, 0);
  });

  // -------------------------------------------------------------------------
  // 4. Update Product & Cross-Tenant Protection
  // -------------------------------------------------------------------------
  test('Owner updates product details and price via PATCH /:id', async () => {
    const res = await request(app)
      .patch(`/api/products/${prodA1Id}`)
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Special Ghee Roast Dosa',
        price: 14000 // ₹140.00
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Special Ghee Roast Dosa');
    assert.equal(res.body.price, 14000);
  });

  test('Updating product with cross-tenant category is rejected', async () => {
    const res = await request(app)
      .patch(`/api/products/${prodA1Id}`)
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        categoryId: catBId // Belongs to Rest B!
      });

    assert.equal(res.status, 400);
    const errMsg = res.body.error || res.body.message || '';
    assert.ok(
      errMsg.includes('category does not exist or does not belong to this restaurant')
    );
  });

  test('Cross-tenant IDOR: Owner B cannot edit Owner A product', async () => {
    const res = await request(app)
      .patch(`/api/products/${prodA1Id}`)
      .set('Cookie', cookieB)
      .set('x-restaurant-id', restBId)
      .send({
        name: 'Malicious Name Overwrite'
      });

    assert.equal(res.status, 404);

    // Verify database remains untouched
    const [prodA] = await db.select().from(products).where(eq(products.id, prodA1Id));
    assert.equal(prodA!.name, 'Special Ghee Roast Dosa');
  });

  // -------------------------------------------------------------------------
  // 5. Availability Toggle (Kitchen Staff & Staff Roles)
  // -------------------------------------------------------------------------
  test('Kitchen staff toggles product availability via PATCH /:id/availability', async () => {
    const res = await request(app)
      .patch(`/api/products/${prodA1Id}/availability`)
      .set('Cookie', cookieKitchen)
      .set('x-restaurant-id', restAId)
      .send({
        isAvailable: false
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.isAvailable, false);

    // Verify in database
    const [updated] = await db.select().from(products).where(eq(products.id, prodA1Id));
    assert.equal(updated!.isAvailable, false);
  });

  test('Cross-tenant IDOR: Kitchen staff cannot toggle product in another restaurant', async () => {
    const res = await request(app)
      .patch(`/api/products/${prodB1Id}/availability`)
      .set('Cookie', cookieKitchen)
      .set('x-restaurant-id', restAId) // Scoped to Rest A
      .send({
        isAvailable: false
      });

    assert.equal(res.status, 404);
  });

  // -------------------------------------------------------------------------
  // 6. Role Authorization & Safe Deletion
  // -------------------------------------------------------------------------
  test('Kitchen staff cannot create or delete products (403 Forbidden)', async () => {
    // Kitchen staff attempts create
    const resCreate = await request(app)
      .post('/api/products')
      .set('Cookie', cookieKitchen)
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Unauthorized Kitchen Product',
        price: 10000
      });
    assert.equal(resCreate.status, 403);

    // Kitchen staff attempts delete
    const resDelete = await request(app)
      .delete(`/api/products/${prodA1Id}`)
      .set('Cookie', cookieKitchen)
      .set('x-restaurant-id', restAId);
    assert.equal(resDelete.status, 403);
  });

  test('Owner B cannot delete Owner A product (IDOR 404)', async () => {
    const res = await request(app)
      .delete(`/api/products/${prodA1Id}`)
      .set('Cookie', cookieB)
      .set('x-restaurant-id', restBId);

    assert.equal(res.status, 404);

    // Verify product still exists
    const [prodA] = await db.select().from(products).where(eq(products.id, prodA1Id));
    assert.ok(prodA);
  });

  test('Safe Deletion: Deleting product preserves historical order item snapshots', async () => {
    // 1. Create a table
    await db.insert(restaurantTables).values({
      id: tableAId,
      restaurantId: restAId,
      tableNumber: 'T-99',
      capacity: 4
    });

    // 2. Create an order with order item referencing prodA2Id
    await db.insert(orders).values({
      id: orderAId,
      orderNumber: 'ORD-TEST-99',
      restaurantId: restAId,
      tableId: tableAId,
      totalAmount: 8000,
      status: 'completed'
    });

    await db.insert(orderItems).values({
      id: orderItemAId,
      orderId: orderAId,
      productId: prodA2Id,
      productName: 'Idli Sambar',
      quantity: 1,
      unitPrice: 8000,
      subtotal: 8000
    });

    // 3. Delete prodA2Id as Owner A
    const delRes = await request(app)
      .delete(`/api/products/${prodA2Id}`)
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId);

    assert.equal(delRes.status, 200);

    // 4. Verify product row is deleted
    const [deletedProd] = await db.select().from(products).where(eq(products.id, prodA2Id));
    assert.equal(deletedProd, undefined);

    // 5. Verify historical order item still exists with snapshot data and productId set to null
    const [preservedOrderItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItemAId));

    assert.ok(preservedOrderItem, 'Historical order item must still exist');
    assert.equal(preservedOrderItem!.productName, 'Idli Sambar', 'Snapshot name preserved');
    assert.equal(preservedOrderItem!.unitPrice, 8000, 'Snapshot unitPrice preserved');
    assert.equal(preservedOrderItem!.subtotal, 8000, 'Snapshot subtotal preserved');
    assert.equal(preservedOrderItem!.productId, null, 'productId set to null cleanly');
  });
});
