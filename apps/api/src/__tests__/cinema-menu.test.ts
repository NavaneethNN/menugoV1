import { test, describe, before, after } from 'node:test';
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
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  categories,
  products,
  orders
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 07: Cinema Food Menu & Concessions', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaA: string;
  let cookieCinemaB: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let popcornCategoryId: string;
  let comboCategoryId: string;
  let beverageCategoryId: string;

  let popcornProductId: string;
  let comboProductId: string;

  const createdTheatresToClean = [theatreAId, theatreBId, restaurantId];
  const createdUsersToClean: string[] = [];

  before(async () => {
    const timestamp = Date.now();

    // 1. Cinema Owner A
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner A',
        email: `menu-a-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonA = await resA.json();
    userCinemaAId = jsonA.user.id;
    createdUsersToClean.push(userCinemaAId);

    // 2. Cinema Owner B (for cross-tenant tests)
    const resB = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Owner B',
        email: `menu-b-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userCinemaBId = jsonB.user.id;
    createdUsersToClean.push(userCinemaBId);

    // 3. Restaurant Owner (for cross-module tests)
    const resRest = await auth.api.signUpEmail({
      body: {
        name: 'Restaurant Owner',
        email: `menu-rest-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieRestaurantOwner = resRest.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonRest = await resRest.json();
    userRestaurantOwnerId = jsonRest.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    // Seed Theatre A (cinema)
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'PVR Grand Concessions',
      slug: `pvr-grand-menu-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      theatreName: 'PVR Grand Concessions',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'concessions@pvr.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      onboardingStage: 'seating_configured',
      onboardingCompleted: false,
      onboardingStagesCompleted: ['profile_completed', 'screens_added', 'seating_configured']
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'owner'
    });

    // Seed a screen and seat for Theatre A so stages 1, 2, 3 are completed
    const screenAId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screenAId,
      theatreId: theatreAId,
      screenName: 'Screen 1',
      screenType: 'standard',
      status: 'active'
    });
    const rowAId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowAId,
      theatreId: theatreAId,
      screenId: screenAId,
      rowIdentifier: 'A',
      startSeatNumber: 1,
      endSeatNumber: 5,
      totalSeats: 5,
      seatCategory: 'regular',
      status: 'active'
    });
    await db.insert(cinemaSeats).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      screenId: screenAId,
      rowId: rowAId,
      rowIdentifier: 'A',
      seatNumber: 1,
      seatIdentifier: 'A1',
      seatCategory: 'regular',
      status: 'active'
    });

    // Seed Theatre B (cinema)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'INOX Concessions B',
      slug: `inox-concessions-b-${timestamp}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true
    });
    await db.insert(cinemaProfiles).values({
      id: crypto.randomUUID(),
      theatreId: theatreBId,
      theatreName: 'INOX Concessions B',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      contactNumber: '9123456789',
      contactEmail: 'inox-b@inox.com',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: theatreBId,
      userId: userCinemaBId,
      role: 'owner'
    });

    // Seed Restaurant (restaurant tenant)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Spice Garden Bistro',
      slug: `spice-garden-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restaurantId,
      userId: userRestaurantOwnerId,
      role: 'owner'
    });
  });

  after(async () => {
    await db.delete(orders).where(inArray(orders.restaurantId, createdTheatresToClean));
    await db.delete(products).where(inArray(products.restaurantId, createdTheatresToClean));
    await db.delete(categories).where(inArray(categories.restaurantId, createdTheatresToClean));
    await db.delete(cinemaSeats).where(inArray(cinemaSeats.theatreId, createdTheatresToClean));
    await db.delete(cinemaRows).where(inArray(cinemaRows.theatreId, createdTheatresToClean));
    await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, createdTheatresToClean));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatresToClean));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatresToClean));
    await db.delete(restaurants).where(inArray(restaurants.id, createdTheatresToClean));
    if (createdUsersToClean.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }
    await pool.end().catch(() => {});
  });

  test('Check onboarding status before adding menu products - stage 4 menu_configured is false', async () => {
    const res = await request(app)
      .get('/api/cinema/onboarding/status')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    const menuStage = res.body.stages.find((s: any) => s.key === 'menu_configured');
    assert.ok(menuStage, 'menu_configured stage should exist');
    assert.equal(menuStage.isCompleted, false, 'menu_configured should not be completed yet');
    assert.equal(menuStage.isLocked, false, 'menu_configured should be unlocked since seating is done');
  });

  test('POST /api/categories - Cinema Owner A creates Popcorn, Combos, and Beverages categories', async () => {
    // 1. Popcorn Category
    const res1 = await request(app)
      .post('/api/categories')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        name: 'Popcorn',
        description: 'Hot fresh popped corn with gourmet seasonings',
        sortOrder: 1,
        isActive: true
      });

    assert.equal(res1.status, 201);
    assert.equal(res1.body.name, 'Popcorn');
    assert.equal(res1.body.restaurantId, theatreAId);
    popcornCategoryId = res1.body.id;

    // 2. Combos Category
    const res2 = await request(app)
      .post('/api/categories')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        name: 'Combos',
        description: 'Value movie snack & beverage combos',
        sortOrder: 2,
        isActive: true
      });

    assert.equal(res2.status, 201);
    assert.equal(res2.body.name, 'Combos');
    comboCategoryId = res2.body.id;

    // 3. Beverages Category
    const res3 = await request(app)
      .post('/api/categories')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        name: 'Beverages',
        description: 'Chilled soft drinks and warm beverages',
        sortOrder: 3,
        isActive: true
      });

    assert.equal(res3.status, 201);
    beverageCategoryId = res3.body.id;
  });

  test('GET /api/categories - Lists categories for Cinema Owner A', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 3);
    const names = res.body.map((c: any) => c.name);
    assert.ok(names.includes('Popcorn'));
    assert.ok(names.includes('Combos'));
    assert.ok(names.includes('Beverages'));
  });

  test('POST /api/products - Creates a standard cinema food item (Large Butter Popcorn)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        name: 'Large Butter Popcorn',
        categoryId: popcornCategoryId,
        description: 'Tub of fresh warm popcorn layered with melted butter',
        price: 24000, // ₹240.00 stored in integer paise
        isVegetarian: true,
        isAvailable: true
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Large Butter Popcorn');
    assert.equal(res.body.price, 24000);
    assert.equal(res.body.categoryId, popcornCategoryId);
    assert.equal(res.body.restaurantId, theatreAId);
    assert.equal(res.body.isVegetarian, true);
    assert.equal(res.body.isAvailable, true);
    popcornProductId = res.body.id;
  });

  test('POST /api/products - Creates a combo product (Popcorn + Coke Combo)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        name: 'Large Popcorn + Coke Combo',
        categoryId: comboCategoryId,
        description: '1x Large Salted Butter Popcorn + 1x 500ml Chilled Coca-Cola',
        price: 36000, // ₹360.00
        isVegetarian: true,
        isAvailable: true
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Large Popcorn + Coke Combo');
    assert.equal(res.body.price, 36000);
    assert.equal(res.body.categoryId, comboCategoryId);
    comboProductId = res.body.id;
  });

  test('GET /api/products - Lists products with category info for Cinema Owner A', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);
    const popcorn = res.body.find((p: any) => p.id === popcornProductId);
    assert.ok(popcorn);
    assert.equal(popcorn.categoryName, 'Popcorn');
    assert.equal(popcorn.price, 24000);
  });

  test('PATCH /api/products/:id/availability - Toggles product availability (In Stock / Sold Out)', async () => {
    // 1. Mark as unavailable (Sold Out)
    const res1 = await request(app)
      .patch(`/api/products/${popcornProductId}/availability`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({ isAvailable: false });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.isAvailable, false);

    // 2. Mark back as available (In Stock)
    const res2 = await request(app)
      .patch(`/api/products/${popcornProductId}/availability`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({ isAvailable: true });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.isAvailable, true);
  });

  test('PATCH /api/products/:id - Updates product details and price', async () => {
    const res = await request(app)
      .patch(`/api/products/${popcornProductId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        name: 'Jumbo Butter Popcorn',
        price: 27000 // ₹270.00
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Jumbo Butter Popcorn');
    assert.equal(res.body.price, 27000);
  });

  test('Tenant Isolation - Cinema Owner B cannot access or modify Cinema Owner A products', async () => {
    // Cinema Owner B tries to update Owner A's product
    const res = await request(app)
      .patch(`/api/products/${popcornProductId}`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId)
      .send({ name: 'Hacked Popcorn' });

    assert.equal(res.status, 404);

    // Cinema Owner B checks products - should be empty for Theatre B
    const listRes = await request(app)
      .get('/api/products')
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 0);
  });

  test('Cross-Module Isolation - Cinema products and Restaurant dishes are strictly segregated', async () => {
    // 1. Restaurant owner creates a restaurant category and dish
    const catRes = await request(app)
      .post('/api/categories')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId)
      .send({
        name: 'Main Course',
        sortOrder: 1,
        isActive: true
      });
    assert.equal(catRes.status, 201);

    const prodRes = await request(app)
      .post('/api/products')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId)
      .send({
        name: 'Butter Chicken Masala',
        categoryId: catRes.body.id,
        price: 38000,
        isVegetarian: false,
        isAvailable: true
      });
    assert.equal(prodRes.status, 201);

    // 2. Cinema Owner A queries products - only sees cinema items, never the restaurant's butter chicken
    const cinemaMenuRes = await request(app)
      .get('/api/products')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(cinemaMenuRes.status, 200);
    const itemNames = cinemaMenuRes.body.map((p: any) => p.name);
    assert.ok(itemNames.includes('Jumbo Butter Popcorn'));
    assert.ok(itemNames.includes('Large Popcorn + Coke Combo'));
    assert.ok(!itemNames.includes('Butter Chicken Masala'));

    // 3. Restaurant Owner queries products - only sees restaurant dishes, never cinema popcorn
    const restaurantMenuRes = await request(app)
      .get('/api/products')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId);

    assert.equal(restaurantMenuRes.status, 200);
    const restNames = restaurantMenuRes.body.map((p: any) => p.name);
    assert.ok(restNames.includes('Butter Chicken Masala'));
    assert.ok(!restNames.includes('Jumbo Butter Popcorn'));
    assert.ok(!restNames.includes('Large Popcorn + Coke Combo'));
  });

  test('Check onboarding status after adding menu products - stage 4 menu_configured is now true', async () => {
    const res = await request(app)
      .get('/api/cinema/onboarding/status')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    const menuStage = res.body.stages.find((s: any) => s.key === 'menu_configured');
    assert.ok(menuStage);
    assert.equal(menuStage.isCompleted, true, 'menu_configured must be true now that products exist');

    // Next stages should now be accessible
    const paymentStage = res.body.stages.find((s: any) => s.key === 'payment_configured');
    assert.ok(paymentStage);
    assert.equal(paymentStage.isLocked, false, 'payment_configured is unlocked after menu');
  });
});
