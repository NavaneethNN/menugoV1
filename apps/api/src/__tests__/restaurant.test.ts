import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, user, restaurants, restaurantMembers } from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Restaurant Onboarding, Profile & Tenant Isolation', () => {
  let userAId: string;
  let userBId: string;
  let cookieA: string;
  let cookieB: string;

  let createdRestAId: string;
  let createdRestBId: string;
  let inactiveRestId: string;

  const now = Date.now();
  const slugA = `onboard-alpha-${now}`;
  const slugB = `onboard-beta-${now}`;
  const slugInactive = `onboard-inactive-${now}`;

  before(async () => {
    // 1. Create two test owner users via Better Auth
    const resA = await auth.api.signUpEmail({
      body: {
        name: 'Owner Alice',
        email: `alice-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonA = await resA.json();
    userAId = jsonA.user.id;

    const resB = await auth.api.signUpEmail({
      body: {
        name: 'Owner Bob',
        email: `bob-${now}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieB = resB.headers.get('set-cookie')?.split(';')[0] || '';
    const jsonB = await resB.json();
    userBId = jsonB.user.id;

    // Seed one inactive restaurant to test public customer hiding
    inactiveRestId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: inactiveRestId,
      name: 'Inactive Restaurant',
      slug: slugInactive,
      isActive: false
    });
  });

  after(async () => {
    // Cleanup in order
    const restIds = [createdRestAId, createdRestBId, inactiveRestId].filter(Boolean);
    if (restIds.length > 0) {
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, restIds));
      await db.delete(restaurants).where(inArray(restaurants.id, restIds));
    }
    const userIds = [userAId, userBId].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(user).where(inArray(user.id, userIds));
    }
  });

  // -------------------------------------------------------------------------
  // Onboarding & Transactional Creation Tests
  // -------------------------------------------------------------------------
  test('Owner successfully creates restaurant with contact details and address transactionally', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set('Cookie', [cookieA])
      .send({
        name: 'Alice Feast House',
        slug: slugA,
        phone: '+91 98765 11111',
        email: 'alice@feasthouse.com',
        address: '100 Baker Street, Bengaluru, Karnataka',
        currency: 'INR',
        logoUrl: 'https://images.example.com/alice-logo.png'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Restaurant created successfully');
    assert.equal(res.body.restaurant.name, 'Alice Feast House');
    assert.equal(res.body.restaurant.slug, slugA);
    assert.equal(res.body.restaurant.currency, 'INR');

    createdRestAId = res.body.restaurant.id;

    // Verify database record
    const [dbRest] = await db.select().from(restaurants).where(eq(restaurants.id, createdRestAId));
    assert.ok(dbRest);
    assert.equal(dbRest.name, 'Alice Feast House');
    assert.equal(dbRest.phone, '+91 98765 11111');
    assert.equal(dbRest.address, '100 Baker Street, Bengaluru, Karnataka');

    // Verify membership record created transactionally with role 'owner' for userA
    const [membership] = await db
      .select()
      .from(restaurantMembers)
      .where(eq(restaurantMembers.restaurantId, createdRestAId));

    assert.ok(membership);
    assert.equal(membership.userId, userAId);
    assert.equal(membership.role, 'owner');
  });

  test('Owner B creates their own restaurant', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set('Cookie', [cookieB])
      .send({
        name: 'Bob Burger Shack',
        slug: slugB,
        phone: '+91 98765 22222',
        email: 'bob@shack.com',
        currency: 'INR'
      });

    assert.equal(res.status, 201);
    createdRestBId = res.body.restaurant.id;
  });

  test('User cannot create restaurant on behalf of another user (owner identity is strictly session-bound)', async () => {
    const spoofSlug = `spoof-attempt-${now}`;
    const res = await request(app)
      .post('/api/restaurants')
      .set('Cookie', [cookieA]) // Alice is logged in
      .send({
        name: 'Spoof Test',
        slug: spoofSlug,
        userId: userBId, // Attempt to assign Bob as owner
        ownerId: userBId
      });

    assert.equal(res.status, 201);
    const spoofRestId = res.body.restaurant.id;

    // Check membership: must be Alice, NOT Bob
    const [membership] = await db
      .select()
      .from(restaurantMembers)
      .where(eq(restaurantMembers.restaurantId, spoofRestId));

    assert.ok(membership);
    assert.equal(membership!.userId, userAId, 'Creating user must be Alice from session');

    // Cleanup spoof test
    await db.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, spoofRestId));
    await db.delete(restaurants).where(eq(restaurants.id, spoofRestId));
  });

  // -------------------------------------------------------------------------
  // Slug Validation & Conflict Tests
  // -------------------------------------------------------------------------
  test('Duplicate slug creation returns 409 Conflict with clear message', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set('Cookie', [cookieB])
      .send({
        name: 'Duplicate Slug Test',
        slug: slugA // Already registered by Alice
      });

    assert.equal(res.status, 409);
    assert.ok(JSON.stringify(res.body).includes('already exists'));
  });

  test('Invalid slug formats are rejected with 400 Bad Request by Zod', async () => {
    const invalidSlugs = [
      'Bad Slug With Spaces',
      'bad--consecutive--hyphens',
      '-leading-hyphen',
      'trailing-hyphen-',
      'UPPERCASE',
      'a' // too short
    ];

    for (const badSlug of invalidSlugs) {
      const res = await request(app)
        .post('/api/restaurants')
        .set('Cookie', [cookieA])
        .send({
          name: 'Invalid Slug Test',
          slug: badSlug
        });

      assert.equal(res.status, 400, `Slug "${badSlug}" should have been rejected with 400`);
      assert.equal(res.body.error, 'Validation Error');
    }
  });

  // -------------------------------------------------------------------------
  // Profile Reading, Updating & Tenant Isolation Tests
  // -------------------------------------------------------------------------
  test('Authorized owner reads restaurant profile via GET /:restaurantId', async () => {
    const res = await request(app)
      .get(`/api/restaurants/${createdRestAId}`)
      .set('Cookie', [cookieA]);

    assert.equal(res.status, 200);
    assert.equal(res.body.restaurant.id, createdRestAId);
    assert.equal(res.body.restaurant.name, 'Alice Feast House');
    assert.equal(res.body.userRole, 'owner');
    assert.ok(res.body.permissions.canManageRestaurant);
  });

  test('Owner updates restaurant profile contact and address via PATCH /:restaurantId', async () => {
    const res = await request(app)
      .patch(`/api/restaurants/${createdRestAId}`)
      .set('Cookie', [cookieA])
      .send({
        phone: '+91 99999 88888',
        address: 'Updated 200 MG Road, Bengaluru'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.restaurant.phone, '+91 99999 88888');
    assert.equal(res.body.restaurant.address, 'Updated 200 MG Road, Bengaluru');

    // Verify DB
    const [updated] = await db.select().from(restaurants).where(eq(restaurants.id, createdRestAId));
    assert.ok(updated);
    assert.equal(updated!.phone, '+91 99999 88888');
  });

  test('Updating slug to another existing restaurant slug returns 409 Conflict', async () => {
    const res = await request(app)
      .patch(`/api/restaurants/${createdRestAId}`)
      .set('Cookie', [cookieA])
      .send({
        slug: slugB // Belongs to Bob's restaurant
      });

    assert.equal(res.status, 409);
    assert.ok(JSON.stringify(res.body).includes('already taken'));
  });

  test('Tenant Isolation: Bob attempting to read or update Alice restaurant returns 403 Forbidden', async () => {
    // Read attempt
    const readRes = await request(app)
      .get(`/api/restaurants/${createdRestAId}`)
      .set('Cookie', [cookieB]);

    assert.equal(readRes.status, 403);
    assert.ok(JSON.stringify(readRes.body).includes('not an authorized member'));

    // Update attempt
    const updateRes = await request(app)
      .patch(`/api/restaurants/${createdRestAId}`)
      .set('Cookie', [cookieB])
      .send({ name: 'Hacked by Bob' });

    assert.equal(updateRes.status, 403);
    assert.ok(JSON.stringify(updateRes.body).includes('not an authorized member'));
  });

  // -------------------------------------------------------------------------
  // Public Customer Profile Tests
  // -------------------------------------------------------------------------
  test('Customer public profile GET /public/:slug exposes only customer-safe fields', async () => {
    const res = await request(app).get(`/api/restaurants/public/${slugA}`);

    assert.equal(res.status, 200);
    const pub = res.body.restaurant;

    // Fields that SHOULD be exposed
    assert.equal(pub.name, 'Alice Feast House');
    assert.equal(pub.slug, slugA);
    assert.equal(pub.phone, '+91 99999 88888');
    assert.equal(pub.address, 'Updated 200 MG Road, Bengaluru');
    assert.equal(pub.currency, 'INR');

    // Fields that MUST NOT be exposed
    assert.equal(pub.members, undefined);
    assert.equal(pub.restaurantMembers, undefined);
    assert.equal(pub.stripeSecretKey, undefined);
    assert.equal(pub.apiKey, undefined);
  });

  test('Public customer endpoint returns 404 for non-existent or inactive restaurant', async () => {
    const notFoundRes = await request(app).get('/api/restaurants/public/non-existent-slug-xyz');
    assert.equal(notFoundRes.status, 404);

    const inactiveRes = await request(app).get(`/api/restaurants/public/${slugInactive}`);
    assert.equal(inactiveRes.status, 404);
  });
});
