import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import { db, pool, user, restaurants, restaurantMembers, cinemaProfiles } from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 02: Cinema Onboarding & Theatre Profile Management', () => {
  let userCinemaAdminId: string;
  let userRestaurantOwnerId: string;
  let cookieCinemaAdmin: string;
  let cookieRestaurantOwner: string;

  let createdTheatreId: string;
  const createdTheatreIdsToClean: string[] = [];
  const createdUserIdsToClean: string[] = [];

  const restaurantId = crypto.randomUUID();

  before(async () => {
    const timestamp = Date.now();

    // 1. Create Cinema Admin User
    const cinemaRes = await auth.api.signUpEmail({
      body: {
        name: 'Cinema Admin',
        email: `cinema-admin-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieCinemaAdmin = cinemaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const cinemaJson = await cinemaRes.json();
    userCinemaAdminId = cinemaJson.user.id;
    createdUserIdsToClean.push(userCinemaAdminId);

    // 2. Create Restaurant Owner User (for isolation testing)
    const restRes = await auth.api.signUpEmail({
      body: {
        name: 'Restaurant Owner',
        email: `rest-reg-${timestamp}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieRestaurantOwner = restRes.headers.get('set-cookie')?.split(';')[0] || '';
    const restJson = await restRes.json();
    userRestaurantOwnerId = restJson.user.id;
    createdUserIdsToClean.push(userRestaurantOwnerId);

    // 3. Insert a pure restaurant tenant
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Spice Garden',
      slug: `spice-garden-${timestamp}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });
    createdTheatreIdsToClean.push(restaurantId);

    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId,
      userId: userRestaurantOwnerId,
      role: 'owner'
    });
  });

  after(async () => {
    try {
      if (createdTheatreIdsToClean.length > 0) {
        await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatreIdsToClean));
        await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatreIdsToClean));
        await db.delete(restaurants).where(inArray(restaurants.id, createdTheatreIdsToClean));
      }
      if (createdUserIdsToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUserIdsToClean));
      }
      await pool.end().catch(() => {});
    } catch (err) {
      console.warn('Test cleanup warning:', err);
    }
  });

  // 1. Validation Tests on Registration
  test('POST /api/cinema/theatres - Rejects registration when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/cinema/theatres')
      .set('Cookie', cookieCinemaAdmin)
      .send({
        // Missing theatreName, city, state, contactNumber, contactEmail
        currency: 'INR'
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error || res.body.details);
  });

  test('POST /api/cinema/theatres - Rejects registration with invalid email format', async () => {
    const res = await request(app)
      .post('/api/cinema/theatres')
      .set('Cookie', cookieCinemaAdmin)
      .send({
        theatreName: 'Inox Lido Mall',
        city: 'Bangalore',
        state: 'Karnataka',
        contactNumber: '9876543210',
        contactEmail: 'not-an-email',
        currency: 'INR'
      });

    assert.equal(res.status, 400);
  });

  // 2. Successful Theatre Registration
  test('POST /api/cinema/theatres - Successfully registers a new cinema theatre and profile', async () => {
    const uniqueName = `PVR Superplex ${Date.now()}`;
    const res = await request(app)
      .post('/api/cinema/theatres')
      .set('Cookie', cookieCinemaAdmin)
      .send({
        theatreName: uniqueName,
        chainOrBrand: 'PVR INOX',
        address: '4th Floor, Vega City Mall, Bannerghatta Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        contactNumber: '9876543210',
        contactEmail: 'vegacity@pvrtheatres.com',
        businessDetails: 'GSTIN: 29ABCDE1234F1Z5',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        logoUrl: 'https://example.com/logo.png',
        logoKey: 'logos/theatre-123.png'
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.theatre?.id);
    assert.ok(res.body.profile?.id);
    assert.equal(res.body.theatre.name, uniqueName);
    assert.equal(res.body.theatre.tenantType, 'cinema');
    assert.equal(res.body.profile.city, 'Bengaluru');
    assert.equal(res.body.profile.currency, 'INR');
    assert.equal(res.body.profile.timezone, 'Asia/Kolkata');
    assert.equal(res.body.profile.onboardingStage, 'profile_completed');

    createdTheatreId = res.body.theatre.id;
    createdTheatreIdsToClean.push(createdTheatreId);

    // Verify database directly
    const [dbProfile] = await db
      .select()
      .from(cinemaProfiles)
      .where(eq(cinemaProfiles.theatreId, createdTheatreId));

    assert.ok(dbProfile);
    assert.equal(dbProfile.theatreName, uniqueName);
    assert.equal(dbProfile.contactNumber, '9876543210');
    assert.equal(dbProfile.contactEmail, 'vegacity@pvrtheatres.com');
  });

  // 3. Profile Viewing
  test('GET /api/cinema/profile - Cinema owner can view theatre profile', async () => {
    const res = await request(app)
      .get('/api/cinema/profile')
      .set('Cookie', cookieCinemaAdmin)
      .set('x-theatre-id', createdTheatreId);

    assert.equal(res.status, 200);
    assert.equal(res.body.theatreId, createdTheatreId);
    assert.equal(res.body.city, 'Bengaluru');
    assert.equal(res.body.state, 'Karnataka');
    assert.equal(res.body.country, 'India');
    assert.equal(res.body.currency, 'INR');
    assert.equal(res.body.timezone, 'Asia/Kolkata');
    assert.ok(res.body.theatreSlug);
  });

  // 4. Profile Editing & Synchronization with restaurants table
  test('PATCH /api/cinema/profile - Cinema owner can update profile and it syncs to restaurants table', async () => {
    const updatedName = `PVR Superplex IMAX ${Date.now()}`;
    const res = await request(app)
      .patch('/api/cinema/profile')
      .set('Cookie', cookieCinemaAdmin)
      .set('x-theatre-id', createdTheatreId)
      .send({
        theatreName: updatedName,
        contactNumber: '9123456780',
        city: 'Mysuru',
        state: 'Karnataka',
        businessDetails: 'GSTIN: 29UPDATED999Z',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.profile.theatreName, updatedName);
    assert.equal(res.body.profile.contactNumber, '9123456780');
    assert.equal(res.body.profile.city, 'Mysuru');

    // Verify synchronization into restaurants table
    const [dbTenant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, createdTheatreId));

    assert.equal(dbTenant.name, updatedName);
    assert.equal(dbTenant.phone, '9123456780');
  });

  // 5. Authoritative Onboarding Progress
  test('GET /api/cinema/onboarding/status - Tracks 8 sequential stages accurately', async () => {
    const res = await request(app)
      .get('/api/cinema/onboarding/status')
      .set('Cookie', cookieCinemaAdmin)
      .set('x-theatre-id', createdTheatreId);

    assert.equal(res.status, 200);
    assert.equal(res.body.totalCount, 8);
    assert.equal(res.body.completedCount, 1); // Only stage 1 is complete
    assert.equal(res.body.isComplete, false);
    assert.equal(Array.isArray(res.body.stages), true);
    assert.equal(res.body.stages.length, 8);

    // Stage 1 (Profile) is completed
    const stage1 = res.body.stages.find((s: any) => s.key === 'profile_completed');
    assert.ok(stage1);
    assert.equal(stage1.isCompleted, true);

    // Stage 2 (Screens) is pending next step (not locked)
    const stage2 = res.body.stages.find((s: any) => s.key === 'screens_added');
    assert.ok(stage2);
    assert.equal(stage2.isCompleted, false);
    assert.equal(stage2.isLocked, false);

    // Stages 3-8 are pending & locked (no fake completion states)
    const stage3 = res.body.stages.find((s: any) => s.key === 'seating_configured');
    assert.ok(stage3);
    assert.equal(stage3.isCompleted, false);
    assert.equal(stage3.isLocked, true);
  });

  // 6. Milestone Stage Progression
  test('PATCH /api/cinema/onboarding/stage - Updates completed stages milestone', async () => {
    const res = await request(app)
      .patch('/api/cinema/onboarding/stage')
      .set('Cookie', cookieCinemaAdmin)
      .set('x-theatre-id', createdTheatreId)
      .send({
        stage: 'screens_added',
        completed: true
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.profile?.onboardingStagesCompleted?.includes('screens_added'));
  });

  // 7. Cross-Module and Cross-Tenant Security Isolation
  test('Security: Restaurant user CANNOT access cinema profile', async () => {
    const res = await request(app)
      .get('/api/cinema/profile')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId);

    // Should be rejected by requireCinemaTenant middleware
    assert.equal(res.status, 403);
  });

  test('Security: Unauthenticated request is rejected', async () => {
    const res = await request(app)
      .get('/api/cinema/profile')
      .set('x-theatre-id', createdTheatreId);

    assert.equal(res.status, 401);
  });

  test('Security: Unauthorized cinema owner cannot access another cinema profile', async () => {
    // Another cinema user
    const otherCinemaRes = await auth.api.signUpEmail({
      body: {
        name: 'Other Cinema Admin',
        email: `other-cinema-${Date.now()}@test.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    const cookieOther = otherCinemaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const otherJson = await otherCinemaRes.json();
    createdUserIdsToClean.push(otherJson.user.id);

    // Attempt to access createdTheatreId without membership
    const res = await request(app)
      .get('/api/cinema/profile')
      .set('Cookie', cookieOther)
      .set('x-theatre-id', createdTheatreId);

    assert.equal(res.status, 403);
  });
});
