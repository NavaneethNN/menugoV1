import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, user, restaurants, restaurantMembers, categories, products } from '@menugo/database';
import { eq, inArray, asc } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Category Management API & Scoping', () => {
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

  let catA1Id: string;
  let catA2Id: string;
  let catB1Id: string;

  const testProdId = crypto.randomUUID();

  const now = Date.now();

  before(async () => {
    // 1. Create Owners & Kitchen user via Better Auth
    const resA = await auth.api.signUpEmail({
      body: { name: 'Owner Cat A', email: `cat-owner-a-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    userAId = (await resA.json()).user.id;

    const resB = await auth.api.signUpEmail({
      body: { name: 'Owner Cat B', email: `cat-owner-b-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    userBId = (await resB.json()).user.id;

    const resK = await auth.api.signUpEmail({
      body: { name: 'Kitchen Staff', email: `cat-kitchen-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieKitchen = resK.headers.get('set-cookie')?.split(';')[0] || '';
    userKitchenId = (await resK.json()).user.id;

    // 2. Seed Restaurants
    await db.insert(restaurants).values([
      { id: restAId, name: 'Category Rest A', slug: `cat-rest-a-${now}`, isActive: true },
      { id: restBId, name: 'Category Rest B', slug: `cat-rest-b-${now}`, isActive: true }
    ]);

    // 3. Seed Memberships
    await db.insert(restaurantMembers).values([
      { id: memberAId, restaurantId: restAId, userId: userAId, role: 'owner' },
      { id: memberBId, restaurantId: restBId, userId: userBId, role: 'owner' },
      { id: memberKitchenId, restaurantId: restAId, userId: userKitchenId, role: 'kitchen' }
    ]);
  });

  after(async () => {
    // Teardown
    await db.delete(products).where(eq(products.id, testProdId));
    const allCats = [catA1Id, catA2Id, catB1Id].filter(Boolean);
    if (allCats.length > 0) {
      await db.delete(categories).where(inArray(categories.id, allCats));
    }
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
  // CRUD & Validation Tests
  // -------------------------------------------------------------------------
  test('Owner A creates category with valid name and sortOrder', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Soups & Starters',
        description: 'Warm soups and crispy finger foods',
        sortOrder: 0,
        isActive: true
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Soups & Starters');
    assert.equal(res.body.restaurantId, restAId);
    catA1Id = res.body.id;

    // Create second category for reordering test
    const res2 = await request(app)
      .post('/api/categories')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Main Courses',
        description: 'Gravies, breads, and curries',
        sortOrder: 1,
        isActive: true
      });

    assert.equal(res2.status, 201);
    catA2Id = res2.body.id;
  });

  test('Duplicate category name in same restaurant returns 409 Conflict', async () => {
    // Exact duplicate
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Soups & Starters'
      });

    assert.equal(res.status, 409);
    assert.ok(JSON.stringify(res.body).includes('already exists'));

    // Case-insensitive duplicate (e.g. "soups & starters")
    const resCase = await request(app)
      .post('/api/categories')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        name: 'soups & starters'
      });

    assert.equal(resCase.status, 409);
    assert.ok(JSON.stringify(resCase.body).includes('already exists'));
  });

  test('Same category name allowed across different restaurants', async () => {
    // Owner B creates 'Soups & Starters' in Restaurant B (should succeed)
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', [cookieB])
      .set('x-restaurant-id', restBId)
      .send({
        name: 'Soups & Starters'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.restaurantId, restBId);
    catB1Id = res.body.id;
  });

  test('List categories returns only authorized restaurant categories in sequence', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].name, 'Soups & Starters');
    assert.equal(res.body[1].name, 'Main Courses');
  });

  // -------------------------------------------------------------------------
  // Reordering Tests
  // -------------------------------------------------------------------------
  test('Reorder categories successfully updates sequence in database', async () => {
    const res = await request(app)
      .put('/api/categories/reorder')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        items: [
          { id: catA2Id, sortOrder: 0 },
          { id: catA1Id, sortOrder: 1 }
        ]
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Categories reordered successfully');

    // Verify list reflects new sequence
    const listRes = await request(app)
      .get('/api/categories')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);

    assert.equal(listRes.body[0].id, catA2Id);
    assert.equal(listRes.body[1].id, catA1Id);
  });

  test('Cross-tenant IDOR attack on reorder is strictly prevented', async () => {
    // User A attempts to reorder Restaurant B's category
    const res = await request(app)
      .put('/api/categories/reorder')
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        items: [{ id: catB1Id, sortOrder: 99 }]
      });

    assert.equal(res.status, 200);

    // Verify Restaurant B's category was untouched
    const [bCat] = await db.select().from(categories).where(eq(categories.id, catB1Id));
    assert.equal(bCat?.sortOrder, 0, 'Competitor category sortOrder must remain untouched');
  });

  // -------------------------------------------------------------------------
  // Edit & Name Conflict Tests
  // -------------------------------------------------------------------------
  test('Owner updates category details via PATCH /:id', async () => {
    const res = await request(app)
      .patch(`/api/categories/${catA1Id}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Deluxe Starters',
        description: 'New premium chef appetizers'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Deluxe Starters');
    assert.equal(res.body.description, 'New premium chef appetizers');
  });

  test('Renaming category to existing name in same restaurant returns 409 Conflict', async () => {
    const res = await request(app)
      .patch(`/api/categories/${catA1Id}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId)
      .send({
        name: 'Main Courses' // Already taken by catA2Id
      });

    assert.equal(res.status, 409);
    assert.ok(JSON.stringify(res.body).includes('already exists'));
  });

  // -------------------------------------------------------------------------
  // Deletion Protection when Products are Attached
  // -------------------------------------------------------------------------
  test('Deleting category with products attached is blocked with 409 Conflict', async () => {
    // Attach a product to catA1Id
    await db.insert(products).values({
      id: testProdId,
      restaurantId: restAId,
      categoryId: catA1Id,
      name: 'Paneer Tikka',
      price: 26000,
      isAvailable: true
    });

    // Attempt to delete catA1Id
    const res = await request(app)
      .delete(`/api/categories/${catA1Id}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 409);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(bodyStr.includes('contains 1 product'));

    // Category still exists in DB
    const [stillExists] = await db.select().from(categories).where(eq(categories.id, catA1Id));
    assert.ok(stillExists);
  });

  test('Deleting category with 0 products succeeds', async () => {
    // Delete catA2Id (which has 0 products)
    const res = await request(app)
      .delete(`/api/categories/${catA2Id}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Category deleted successfully');

    // Verify removed from DB
    const [deleted] = await db.select().from(categories).where(eq(categories.id, catA2Id));
    assert.equal(deleted, undefined);
  });

  // -------------------------------------------------------------------------
  // Role & Cross-Tenant Boundary Tests
  // -------------------------------------------------------------------------
  test('Kitchen staff cannot create, reorder or delete categories (403 Forbidden)', async () => {
    // Create attempt
    const postRes = await request(app)
      .post('/api/categories')
      .set('Cookie', [cookieKitchen])
      .set('x-restaurant-id', restAId)
      .send({ name: 'Kitchen Category' });
    assert.equal(postRes.status, 403);

    // Reorder attempt
    const putRes = await request(app)
      .put('/api/categories/reorder')
      .set('Cookie', [cookieKitchen])
      .set('x-restaurant-id', restAId)
      .send({ items: [{ id: catA1Id, sortOrder: 0 }] });
    assert.equal(putRes.status, 403);

    // Delete attempt
    const delRes = await request(app)
      .delete(`/api/categories/${catA1Id}`)
      .set('Cookie', [cookieKitchen])
      .set('x-restaurant-id', restAId);
    assert.equal(delRes.status, 403);
  });

  test('Cross-tenant IDOR: Owner A cannot read or delete Owner B category', async () => {
    // Attempt delete
    const delRes = await request(app)
      .delete(`/api/categories/${catB1Id}`)
      .set('Cookie', [cookieA])
      .set('x-restaurant-id', restAId);
    assert.equal(delRes.status, 404);

    // Cat B still exists
    const [catB] = await db.select().from(categories).where(eq(categories.id, catB1Id));
    assert.ok(catB);
  });
});

