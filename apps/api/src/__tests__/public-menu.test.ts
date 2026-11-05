import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { db, restaurants, categories, products } from '@menugo/database';
import { inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Public Restaurant Menu API (Task 09)', () => {
  let restActiveId: string;
  let restInactiveId: string;
  let restEmptyId: string;

  let activeCatId: string;
  let inactiveCatId: string;

  let prodAvailableActiveCatId: string;
  let prodUnavailableActiveCatId: string;
  let prodInactiveCatId: string;
  let prodUncategorizedId: string;

  const now = Date.now();
  const slugActive = `menu-active-${now}`;
  const slugInactive = `menu-inactive-${now}`;
  const slugEmpty = `menu-empty-${now}`;

  before(async () => {
    // 1. Seed Active Restaurant with public fields and internal keys
    restActiveId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restActiveId,
      name: 'Spice Symphony Bistro',
      slug: slugActive,
      phone: '+91 98765 43210',
      email: 'contact@spicesymphony.com',
      address: '42 Brigade Road, Indiranagar, Bengaluru',
      logoKey: `restaurants/${restActiveId}/logo-internal-secret.png`,
      logoUrl: 'https://cdn.example.com/spicesymphony-logo.png',
      coverImageKey: `restaurants/${restActiveId}/cover-internal-secret.png`,
      coverImageUrl: 'https://cdn.example.com/spicesymphony-cover.jpg',
      currency: 'INR',
      isActive: true,
      settings: { allowSpecialInstructions: true, spiceLevelSelector: true }
    });

    // 2. Seed Inactive Restaurant
    restInactiveId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restInactiveId,
      name: 'Closed Kitchen',
      slug: slugInactive,
      currency: 'INR',
      isActive: false
    });

    // 3. Seed Empty Active Restaurant (no categories or products)
    restEmptyId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restEmptyId,
      name: 'Freshly Opened Cafe',
      slug: slugEmpty,
      currency: 'INR',
      isActive: true
    });

    // 4. Seed Categories for Active Restaurant:
    // One active category, one inactive category
    activeCatId = crypto.randomUUID();
    await db.insert(categories).values({
      id: activeCatId,
      restaurantId: restActiveId,
      name: 'Starters & Appetizers',
      description: 'Crispy and savory delicacies to begin your meal',
      sortOrder: 1,
      isActive: true
    });

    inactiveCatId = crypto.randomUUID();
    await db.insert(categories).values({
      id: inactiveCatId,
      restaurantId: restActiveId,
      name: 'Seasonal Monsoon Specials',
      description: 'Available only during monsoon season',
      sortOrder: 2,
      isActive: false // INACTIVE category
    });

    // 5. Seed Products:
    // Product A: Available in active category
    prodAvailableActiveCatId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodAvailableActiveCatId,
      restaurantId: restActiveId,
      categoryId: activeCatId,
      name: 'Crispy Paneer 65',
      description: 'Fried spicy paneer cubes tossed in curry leaves and yoghurt sauce',
      price: 24000, // ₹240 in paise
      imageKey: `restaurants/${restActiveId}/products/paneer-key-secret.jpg`,
      imageUrl: 'https://cdn.example.com/paneer65.jpg',
      isVegetarian: true,
      isAvailable: true,
      sortOrder: 1
    });

    // Product B: Unavailable in active category
    prodUnavailableActiveCatId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodUnavailableActiveCatId,
      restaurantId: restActiveId,
      categoryId: activeCatId,
      name: 'Mutton Seekh Kebab',
      description: 'Charcoal grilled minced mutton skewers',
      price: 36000, // ₹360 in paise
      imageKey: `restaurants/${restActiveId}/products/kebab-key-secret.jpg`,
      imageUrl: 'https://cdn.example.com/kebab.jpg',
      isVegetarian: false,
      isAvailable: false, // UNAVAILABLE - must NOT appear in public menu
      sortOrder: 2
    });

    // Product C: Available in INACTIVE category (Monsoon Specials)
    prodInactiveCatId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodInactiveCatId,
      restaurantId: restActiveId,
      categoryId: inactiveCatId,
      name: 'Hot Pakoda Platter',
      description: 'Crispy monsoon onion and potato fritters',
      price: 18000, // ₹180 in paise
      imageKey: `restaurants/${restActiveId}/products/pakoda-key-secret.jpg`,
      imageUrl: 'https://cdn.example.com/pakoda.jpg',
      isVegetarian: true,
      isAvailable: true, // Item is marked available, BUT parent category is inactive!
      sortOrder: 1
    });

    // Product D: Available Uncategorized Product
    prodUncategorizedId = crypto.randomUUID();
    await db.insert(products).values({
      id: prodUncategorizedId,
      restaurantId: restActiveId,
      categoryId: null, // No category
      name: 'Chef Special Beverage',
      description: 'Fresh seasonal fruit cooler',
      price: 12000, // ₹120 in paise
      imageUrl: 'https://cdn.example.com/cooler.jpg',
      isVegetarian: true,
      isAvailable: true,
      sortOrder: 99
    });
  });

  after(async () => {
    // Cleanup seeded data
    const restIds = [restActiveId, restInactiveId, restEmptyId].filter(Boolean);
    if (restIds.length > 0) {
      await db.delete(products).where(inArray(products.restaurantId, restIds));
      await db.delete(categories).where(inArray(categories.restaurantId, restIds));
      await db.delete(restaurants).where(inArray(restaurants.id, restIds));
    }
  });

  // -------------------------------------------------------------------------
  // 1. Resolution & Status Tests
  // -------------------------------------------------------------------------
  test('Resolves active restaurant menu by public slug without customer authentication', async () => {
    // Note: No Cookie or Authorization header sent
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.restaurant, 'Response must contain restaurant object');
    assert.ok(Array.isArray(res.body.categories), 'Response must contain categories array');
    assert.ok(Array.isArray(res.body.products), 'Response must contain products array');
  });

  test('Returns 404 for non-existent restaurant slug', async () => {
    const res = await request(app).get('/api/restaurants/by-slug/non-existent-random-slug-999');
    assert.equal(res.status, 404);
    assert.ok(
      (res.body.message || res.body.error).includes('not found') ||
      (res.body.message || res.body.error).includes('inactive')
    );
  });

  test('Returns 404 for inactive restaurant', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugInactive}`);
    assert.equal(res.status, 404);
  });

  // -------------------------------------------------------------------------
  // 2. Public-Field Filtering (No secrets / internal IDs leaked)
  // -------------------------------------------------------------------------
  test('Public restaurant object contains only customer-safe fields and omits internal secrets', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);
    assert.equal(res.status, 200);
    const rest = res.body.restaurant;

    // Allowed customer fields
    assert.equal(rest.id, restActiveId);
    assert.equal(rest.name, 'Spice Symphony Bistro');
    assert.equal(rest.slug, slugActive);
    assert.equal(rest.phone, '+91 98765 43210');
    assert.equal(rest.email, 'contact@spicesymphony.com');
    assert.equal(rest.address, '42 Brigade Road, Indiranagar, Bengaluru');
    assert.equal(rest.logoUrl, 'https://cdn.example.com/spicesymphony-logo.png');
    assert.equal(rest.coverImageUrl, 'https://cdn.example.com/spicesymphony-cover.jpg');
    assert.equal(rest.currency, 'INR');
    assert.deepEqual(rest.settings, {
      allowSpecialInstructions: true,
      spiceLevelSelector: true
    });

    // FORBIDDEN fields (must be undefined)
    assert.equal(rest.logoKey, undefined, 'logoKey storage key must NOT be leaked');
    assert.equal(rest.coverImageKey, undefined, 'coverImageKey storage key must NOT be leaked');
    assert.equal(rest.createdAt, undefined, 'Internal timestamp createdAt must not be exposed');
    assert.equal(rest.updatedAt, undefined, 'Internal timestamp updatedAt must not be exposed');
    assert.equal(rest.members, undefined, 'Internal members list must not be exposed');
    assert.equal(rest.qrCodeSecret, undefined, 'QR secrets must not be exposed');
  });

  test('Public categories contain only safe fields and omit tenant internal metadata', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);
    assert.equal(res.status, 200);

    // Only active category returned
    assert.equal(res.body.categories.length, 1);
    const cat = res.body.categories[0];

    // Allowed fields
    assert.equal(cat.id, activeCatId);
    assert.equal(cat.name, 'Starters & Appetizers');
    assert.equal(cat.description, 'Crispy and savory delicacies to begin your meal');
    assert.equal(cat.sortOrder, 1);

    // FORBIDDEN fields
    assert.equal(cat.restaurantId, undefined, 'Category restaurantId should not be exposed to customer');
    assert.equal(cat.isActive, undefined, 'Internal isActive flag is redundant in public payload');
    assert.equal(cat.createdAt, undefined, 'Category createdAt must not be exposed');
    assert.equal(cat.updatedAt, undefined, 'Category updatedAt must not be exposed');
  });

  test('Public products contain only safe fields and omit internal R2 imageKey & restaurantId', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);
    assert.equal(res.status, 200);

    const paneer = res.body.products.find((p: any) => p.id === prodAvailableActiveCatId);
    assert.ok(paneer, 'Available product must be present');

    // Safe fields
    assert.equal(paneer.name, 'Crispy Paneer 65');
    assert.equal(paneer.price, 24000); // Integer paise
    assert.equal(paneer.imageUrl, 'https://cdn.example.com/paneer65.jpg');
    assert.equal(paneer.isVegetarian, true);
    assert.equal(paneer.isAvailable, true);

    // FORBIDDEN fields
    assert.equal(paneer.imageKey, undefined, 'R2 object key imageKey must NOT be exposed to customer');
    assert.equal(paneer.restaurantId, undefined, 'restaurantId must NOT be exposed on products');
    assert.equal(paneer.createdAt, undefined, 'createdAt must NOT be exposed');
    assert.equal(paneer.updatedAt, undefined, 'updatedAt must NOT be exposed');
  });

  // -------------------------------------------------------------------------
  // 3. Visibility & Content Filtering Rules
  // -------------------------------------------------------------------------
  test('Excludes unavailable products (isAvailable = false)', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);
    assert.equal(res.status, 200);

    const kebab = res.body.products.find((p: any) => p.id === prodUnavailableActiveCatId);
    assert.equal(kebab, undefined, 'Unavailable product (isAvailable=false) must not be returned');
  });

  test('Excludes products belonging to inactive categories even if product is marked available', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);
    assert.equal(res.status, 200);

    // Inactive category itself must not be in categories list
    const monsoonCat = res.body.categories.find((c: any) => c.id === inactiveCatId);
    assert.equal(monsoonCat, undefined, 'Inactive category must not be in categories list');

    // Pakoda belongs to inactive category, so it must NOT be in products list
    const pakoda = res.body.products.find((p: any) => p.id === prodInactiveCatId);
    assert.equal(pakoda, undefined, 'Product belonging to inactive category must not leak to public menu');
  });

  test('Includes available uncategorized products', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);
    assert.equal(res.status, 200);

    const uncategorized = res.body.products.find((p: any) => p.id === prodUncategorizedId);
    assert.ok(uncategorized, 'Uncategorized available product should be included');
    assert.equal(uncategorized.categoryId, null);
    assert.equal(uncategorized.price, 12000);
  });

  // -------------------------------------------------------------------------
  // 4. Empty Menu & Edge Cases
  // -------------------------------------------------------------------------
  test('Handles restaurant with empty menu gracefully', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugEmpty}`);
    assert.equal(res.status, 200);

    assert.ok(res.body.restaurant);
    assert.equal(res.body.restaurant.slug, slugEmpty);
    assert.deepEqual(res.body.categories, []);
    assert.deepEqual(res.body.products, []);
  });

  test('Prices are strictly integers in paise without decimal drift', async () => {
    const res = await request(app).get(`/api/restaurants/by-slug/${slugActive}`);
    assert.equal(res.status, 200);

    for (const prod of res.body.products) {
      assert.ok(Number.isInteger(prod.price), `Price ${prod.price} must be an integer (paise)`);
      assert.ok(prod.price >= 0, `Price ${prod.price} must be non-negative`);
    }
  });
});

