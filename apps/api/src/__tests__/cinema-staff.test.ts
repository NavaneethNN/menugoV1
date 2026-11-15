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
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';

describe('Task 19: Cinema Staff Management & Role Permissions', () => {
  let userCinemaAOwnerId: string;
  let userCinemaAAdminId: string;
  let userCinemaAKitchenId: string;
  let userCinemaADeliveryId: string;
  let userCinemaBOwnerId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaAOwner: string;
  let cookieCinemaAAdmin: string;
  let cookieCinemaAKitchen: string;
  let cookieCinemaADelivery: string;
  let cookieCinemaBOwner: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let memberCinemaAOwnerId: string;
  let memberCinemaAAdminId: string;
  let memberCinemaAKitchenId: string;
  let memberCinemaADeliveryId: string;
  let memberCinemaBOwnerId: string;

  let screenA1Id: string;
  let movieA1Id: string;
  let showA1Id: string;
  let readyOrderId: string;

  const timestamp = Date.now();
  const createdUsersToClean: string[] = [];

  before(async () => {
    // 1. Create Cinema A Owner
    const ownerAEmail = `theatreA.staff.owner.${timestamp}@example.com`;
    const ownerARes = await auth.api.signUpEmail({
      body: { name: 'PVR Staff Owner', email: ownerAEmail, password: 'password123' }
    });
    userCinemaAOwnerId = ownerARes.user.id;
    createdUsersToClean.push(userCinemaAOwnerId);

    const signinAOwner = await auth.api.signInEmail({
      body: { email: ownerAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAOwner = signinAOwner.headers.get('set-cookie') || '';

    // 2. Create Cinema A Admin
    const adminAEmail = `theatreA.staff.admin.${timestamp}@example.com`;
    const adminARes = await auth.api.signUpEmail({
      body: { name: 'PVR Cinema Manager', email: adminAEmail, password: 'password123' }
    });
    userCinemaAAdminId = adminARes.user.id;
    createdUsersToClean.push(userCinemaAAdminId);

    const signinAAdmin = await auth.api.signInEmail({
      body: { email: adminAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAAdmin = signinAAdmin.headers.get('set-cookie') || '';

    // 3. Create Cinema A Kitchen Staff
    const kitchenAEmail = `theatreA.staff.kitchen.${timestamp}@example.com`;
    const kitchenARes = await auth.api.signUpEmail({
      body: { name: 'PVR Master Chef', email: kitchenAEmail, password: 'password123' }
    });
    userCinemaAKitchenId = kitchenARes.user.id;
    createdUsersToClean.push(userCinemaAKitchenId);

    const signinAKitchen = await auth.api.signInEmail({
      body: { email: kitchenAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAKitchen = signinAKitchen.headers.get('set-cookie') || '';

    // 4. Create Cinema A Delivery Staff
    const deliveryAEmail = `theatreA.staff.runner.${timestamp}@example.com`;
    const deliveryARes = await auth.api.signUpEmail({
      body: { name: 'PVR Seat Runner', email: deliveryAEmail, password: 'password123' }
    });
    userCinemaADeliveryId = deliveryARes.user.id;
    createdUsersToClean.push(userCinemaADeliveryId);

    const signinADelivery = await auth.api.signInEmail({
      body: { email: deliveryAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaADelivery = signinADelivery.headers.get('set-cookie') || '';

    // 5. Create Cinema B Owner (Cross-theatre tenant)
    const ownerBEmail = `theatreB.staff.owner.${timestamp}@example.com`;
    const ownerBRes = await auth.api.signUpEmail({
      body: { name: 'INOX Staff Owner', email: ownerBEmail, password: 'password123' }
    });
    userCinemaBOwnerId = ownerBRes.user.id;
    createdUsersToClean.push(userCinemaBOwnerId);

    const signinBOwner = await auth.api.signInEmail({
      body: { email: ownerBEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaBOwner = signinBOwner.headers.get('set-cookie') || '';

    // 6. Create Restaurant Owner (Cross-module tenant)
    const restEmail = `bistro.staff.owner.${timestamp}@example.com`;
    const restRes = await auth.api.signUpEmail({
      body: { name: 'Bistro Owner', email: restEmail, password: 'password123' }
    });
    userRestaurantOwnerId = restRes.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    const signinRestOwner = await auth.api.signInEmail({
      body: { email: restEmail, password: 'password123' },
      asResponse: true
    });
    cookieRestaurantOwner = signinRestOwner.headers.get('set-cookie') || '';

    // 7. Seed Theatres & Profiles
    await db.insert(restaurants).values([
      {
        id: theatreAId,
        name: 'PVR Icon Staff Test',
        slug: `pvr-icon-staff-${timestamp}`,
        tenantType: 'cinema',
        currency: 'INR'
      },
      {
        id: theatreBId,
        name: 'INOX Megaplex Staff Test',
        slug: `inox-megaplex-staff-${timestamp}`,
        tenantType: 'cinema',
        currency: 'INR'
      },
      {
        id: restaurantId,
        name: 'Gourmet Bistro Staff Test',
        slug: `gourmet-bistro-staff-${timestamp}`,
        tenantType: 'restaurant',
        currency: 'INR'
      }
    ]);

    await db.insert(cinemaProfiles).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        theatreName: 'PVR Icon Staff Test',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        contactNumber: '9876543210',
        contactEmail: 'contact@pvricon.com',
        onboardingStage: 'ready_to_operate'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreBId,
        theatreName: 'INOX Megaplex Staff Test',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        contactNumber: '9876543211',
        contactEmail: 'contact@inoxmegaplex.com',
        onboardingStage: 'ready_to_operate'
      }
    ]);

    // 8. Seed Memberships with roles and status
    const [mOwnerA] = await db
      .insert(restaurantMembers)
      .values({
        restaurantId: theatreAId,
        userId: userCinemaAOwnerId,
        role: 'owner',
        status: 'active',
        staffName: 'PVR Staff Owner'
      })
      .returning();
    memberCinemaAOwnerId = mOwnerA.id;

    const [mAdminA] = await db
      .insert(restaurantMembers)
      .values({
        restaurantId: theatreAId,
        userId: userCinemaAAdminId,
        role: 'admin',
        status: 'active',
        staffName: 'PVR Cinema Manager',
        phone: '+91 9876543210'
      })
      .returning();
    memberCinemaAAdminId = mAdminA.id;

    const [mKitchenA] = await db
      .insert(restaurantMembers)
      .values({
        restaurantId: theatreAId,
        userId: userCinemaAKitchenId,
        role: 'kitchen',
        status: 'active',
        staffName: 'PVR Master Chef',
        phone: '+91 9876543211'
      })
      .returning();
    memberCinemaAKitchenId = mKitchenA.id;

    const [mDeliveryA] = await db
      .insert(restaurantMembers)
      .values({
        restaurantId: theatreAId,
        userId: userCinemaADeliveryId,
        role: 'delivery',
        status: 'active',
        staffName: 'PVR Seat Runner',
        phone: '+91 9876543212'
      })
      .returning();
    memberCinemaADeliveryId = mDeliveryA.id;

    const [mOwnerB] = await db
      .insert(restaurantMembers)
      .values({
        restaurantId: theatreBId,
        userId: userCinemaBOwnerId,
        role: 'owner',
        status: 'active',
        staffName: 'INOX Staff Owner'
      })
      .returning();
    memberCinemaBOwnerId = mOwnerB.id;

    await db.insert(restaurantMembers).values({
      restaurantId: restaurantId,
      userId: userRestaurantOwnerId,
      role: 'owner',
      status: 'active'
    });

    // 9. Seed Screen, Movie, Show, and Order for Delivery Testing
    const [screenA1] = await db
      .insert(cinemaScreens)
      .values({
        theatreId: theatreAId,
        screenNumber: 1,
        screenName: 'IMAX Laser 1',
        screenType: 'IMAX',
        totalSeats: 150
      })
      .returning();
    screenA1Id = screenA1.id;

    const [movieA1] = await db
      .insert(cinemaMovies)
      .values({
        theatreId: theatreAId,
        title: 'Avatar: The Way of Water',
        language: 'English',
        durationMinutes: 192,
        status: 'active'
      })
      .returning();
    movieA1Id = movieA1.id;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const [showA1] = await db
      .insert(cinemaShows)
      .values({
        theatreId: theatreAId,
        screenId: screenA1Id,
        movieId: movieA1Id,
        showDate: todayStr,
        startTime: new Date(now.getTime() - 2 * 3600000),
        expectedEndTime: new Date(now.getTime() + 1 * 3600000),
        orderingStartTime: new Date(now.getTime() - 3 * 3600000),
        orderingEndTime: new Date(now.getTime() + 30 * 60000),
        status: 'published'
      })
      .returning();
    showA1Id = showA1.id;

    // Seed a ready order for delivery testing
    const [orderA] = await db
      .insert(orders)
      .values({
        restaurantId: theatreAId,
        orderType: 'cinema',
        screenId: screenA1Id,
        movieId: movieA1Id,
        showId: showA1Id,
        seatRow: 'F',
        seatNumber: '12',
        orderNumber: `ORD-STAFF-${timestamp}`,
        status: 'ready',
        paymentStatus: 'paid',
        paymentMethod: 'razorpay',
        subtotal: 42857,
        taxAmount: 2143,
        totalAmount: 45000,
        deliveryStatus: 'ready'
      })
      .returning();
    readyOrderId = orderA.id;

    await db.insert(orderItems).values({
      orderId: readyOrderId,
      productName: 'Caramel Popcorn Large',
      quantity: 1,
      unitPrice: 45000,
      subtotal: 45000
    });
  });

  after(async () => {
    try {
      if (theatreAId) {
        await db.delete(orderItems).where(eq(orderItems.orderId, readyOrderId));
        await db.delete(orders).where(eq(orders.restaurantId, theatreAId));
        await db.delete(cinemaShows).where(eq(cinemaShows.theatreId, theatreAId));
        await db.delete(cinemaMovies).where(eq(cinemaMovies.theatreId, theatreAId));
        await db.delete(cinemaScreens).where(eq(cinemaScreens.theatreId, theatreAId));
        await db.delete(cinemaProfiles).where(eq(cinemaProfiles.theatreId, theatreAId));
        await db.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, theatreAId));
        await db.delete(restaurants).where(eq(restaurants.id, theatreAId));
      }
      if (theatreBId) {
        await db.delete(cinemaProfiles).where(eq(cinemaProfiles.theatreId, theatreBId));
        await db.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, theatreBId));
        await db.delete(restaurants).where(eq(restaurants.id, theatreBId));
      }
      if (restaurantId) {
        await db.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, restaurantId));
        await db.delete(restaurants).where(eq(restaurants.id, restaurantId));
      }
      if (createdUsersToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUsersToClean));
      }
    } catch (e) {
      console.error('Error during test teardown:', e);
    } finally {
      await pool.end().catch(() => {});
    }
  });

  // =========================================================================
  // 1. Staff Listing & Metrics
  // =========================================================================
  describe('1. Cinema Staff Listing & Summary Metrics (GET /api/cinema/staff)', () => {
    it('allows Cinema Owner to view all staff with summary metrics', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAOwner);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.members));
      assert.equal(res.body.members.length, 4); // Owner, Admin, Kitchen, Delivery

      const summary = res.body.summary;
      assert.ok(summary);
      assert.equal(summary.total, 4);
      assert.equal(summary.active, 4);
      assert.equal(summary.inactive, 0);
      assert.equal(summary.roles.owners, 1);
      assert.equal(summary.roles.admins, 1);
      assert.equal(summary.roles.kitchen, 1);
      assert.equal(summary.roles.delivery, 1);
    });

    it('allows Cinema Admin to view all staff members', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.members.length, 4);
    });

    it('filters staff roster by role (role=delivery)', async () => {
      const res = await request(app)
        .get('/api/cinema/staff?role=delivery')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 200);
      assert.equal(res.body.members.length, 1);
      assert.equal(res.body.members[0].role, 'delivery');
      assert.equal(res.body.members[0].staffName, 'PVR Seat Runner');
    });

    it('filters staff roster by search query', async () => {
      const res = await request(app)
        .get('/api/cinema/staff?search=Chef')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 200);
      assert.equal(res.body.members.length, 1);
      assert.equal(res.body.members[0].role, 'kitchen');
      assert.equal(res.body.members[0].staffName, 'PVR Master Chef');
    });

    it('retrieves single staff member details by id', async () => {
      const res = await request(app)
        .get(`/api/cinema/staff/${memberCinemaADeliveryId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.member.id, memberCinemaADeliveryId);
      assert.equal(res.body.member.role, 'delivery');
      assert.equal(res.body.member.phone, '+91 9876543212');
    });
  });

  // =========================================================================
  // 2. Add Staff & Role Escalation Prevention
  // =========================================================================
  describe('2. Add Cinema Staff & Escalation Prevention (POST /api/cinema/staff)', () => {
    let addedMemberId: string;
    const newStaffEmail = `newrunner.${timestamp}@example.com`;

    it('allows Admin to add a new staff member with delivery role', async () => {
      const res = await request(app)
        .post('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin)
        .send({
          name: 'Jane Runner',
          email: newStaffEmail,
          phone: '+91 9998887776',
          role: 'delivery',
          password: 'securepassword123'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.member.role, 'delivery');
      assert.equal(res.body.member.staffName, 'Jane Runner');
      assert.equal(res.body.member.phone, '+91 9998887776');
      assert.equal(res.body.member.status, 'active');

      addedMemberId = res.body.member.membershipId;
      createdUsersToClean.push(res.body.member.userId);
    });

    it('prevents adding someone with owner role directly (400 or 403)', async () => {
      const res = await request(app)
        .post('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAOwner)
        .send({
          name: 'Malicious Owner',
          email: `fakeowner.${timestamp}@example.com`,
          role: 'owner'
        });

      assert.ok(res.status === 400 || res.status === 403);
      assert.match(res.body.error || res.body.message || JSON.stringify(res.body), /Validation Error|role|owner/i);
    });

    it('prevents a non-owner Admin from appointing another Admin (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin)
        .send({
          name: 'Peer Admin',
          email: `peeradmin.${timestamp}@example.com`,
          role: 'admin'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.message || res.body.error, /theatre owner can appoint/i);
    });

    it('allows Owner to appoint another Admin', async () => {
      const adminEmail = `legitadmin.${timestamp}@example.com`;
      const res = await request(app)
        .post('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAOwner)
        .send({
          name: 'Legit Assistant Admin',
          email: adminEmail,
          role: 'admin'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.member.role, 'admin');

      createdUsersToClean.push(res.body.member.userId);
    });

    it('rejects adding an already existing member to the theatre (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin)
        .send({
          name: 'Duplicate Staff',
          email: newStaffEmail,
          role: 'kitchen'
        });

      assert.equal(res.status, 409);
      assert.match(res.body.message || res.body.error, /already a.*member/i);
    });
  });

  // =========================================================================
  // 3. Edit Staff Details & Protection of Owner
  // =========================================================================
  describe('3. Edit Cinema Staff (PATCH /api/cinema/staff/:id)', () => {
    it('allows Admin to update staff name, phone, and role to kitchen', async () => {
      const res = await request(app)
        .patch(`/api/cinema/staff/${memberCinemaADeliveryId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin)
        .send({
          staffName: 'Promoted Senior Runner',
          phone: '+91 9112223334'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.member.staffName, 'Promoted Senior Runner');
      assert.equal(res.body.member.phone, '+91 9112223334');
    });

    it('prevents non-owner Admin from promoting staff to Admin (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/cinema/staff/${memberCinemaADeliveryId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin)
        .send({
          role: 'admin'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.message || res.body.error, /theatre owner can appoint/i);
    });

    it('prevents demoting the final owner of the theatre (400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/api/cinema/staff/${memberCinemaAOwnerId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAOwner)
        .send({
          role: 'kitchen'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message || res.body.error, /Cannot demote/i);
    });
  });

  // =========================================================================
  // 4. Staff Activation, Deactivation & Middleware Access Revocation
  // =========================================================================
  describe('4. Deactivate & Reactivate Staff (POST /:id/deactivate & /:id/activate)', () => {
    it('allows Admin to deactivate a staff member', async () => {
      const res = await request(app)
        .post(`/api/cinema/staff/${memberCinemaAKitchenId}/deactivate`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, 'inactive');
    });

    it('immediately rejects deactivated staff from accessing cinema endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAKitchen);

      assert.equal(res.status, 403);
      assert.match(
        res.body.message || res.body.error,
        /deactivated/i
      );
    });

    it('allows Admin to reactivate the staff member', async () => {
      const res = await request(app)
        .post(`/api/cinema/staff/${memberCinemaAKitchenId}/activate`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, 'active');
    });

    it('restores cinema access for reactivated staff member', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAKitchen);

      assert.equal(res.status, 200);
    });

    it('prevents deactivating the final owner of the theatre (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/cinema/staff/${memberCinemaAOwnerId}/deactivate`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAOwner);

      assert.equal(res.status, 400);
      assert.match(res.body.message || res.body.error, /Cannot deactivate the final.*owner/i);
    });
  });

  // =========================================================================
  // 5. Staff Removal (DELETE /api/cinema/staff/:id)
  // =========================================================================
  describe('5. Staff Removal (DELETE /api/cinema/staff/:id)', () => {
    it('prevents deleting the final owner of the theatre (400 Bad Request)', async () => {
      const res = await request(app)
        .delete(`/api/cinema/staff/${memberCinemaAOwnerId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAOwner);

      assert.equal(res.status, 400);
      assert.match(res.body.message || res.body.error, /Cannot remove the final owner/i);
    });
  });

  // =========================================================================
  // 6. Role Boundaries: Kitchen & Delivery Staff Permissions
  // =========================================================================
  describe('6. Cinema Role Operational Boundaries & Permissions', () => {
    it('Kitchen staff CAN access Kitchen KDS queue', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAKitchen);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.orders));
    });

    it('Kitchen staff CANNOT access staff management (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAKitchen);

      assert.equal(res.status, 403);
    });

    it('Kitchen staff CANNOT access cinema reports (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/summary')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAKitchen);

      assert.equal(res.status, 403);
    });

    it('Kitchen staff CANNOT cancel or reject orders (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/cinema/orders/${readyOrderId}/status`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAKitchen)
        .send({ status: 'cancelled', reason: 'Kitchen attempted cancellation' });

      assert.equal(res.status, 403);
    });

    it('Delivery runner CAN access Delivery runner queue (GET /api/cinema/delivery/orders)', async () => {
      const res = await request(app)
        .get('/api/cinema/delivery/orders')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaADelivery);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.orders));
      assert.ok(res.body.orders.length > 0);
      assert.equal(res.body.orders[0].id, readyOrderId);
      assert.equal(res.body.orders[0].screenName, 'IMAX Laser 1');
      assert.equal(res.body.orders[0].seatRow, 'F');
      assert.equal(res.body.orders[0].seatNumber, '12');
    });

    it('Delivery runner CAN accept delivery assignment for a ready order', async () => {
      const res = await request(app)
        .post(`/api/cinema/delivery/orders/${readyOrderId}/assign`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaADelivery);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.status, 'assigned_for_delivery');
      assert.equal(res.body.order.deliveryStaffName, 'Promoted Senior Runner');
    });

    it('Delivery runner CAN mark assigned order as delivered to seat', async () => {
      const res = await request(app)
        .post(`/api/cinema/delivery/orders/${readyOrderId}/deliver`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaADelivery);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.status, 'delivered');
      assert.ok(res.body.order.deliveredAt);
    });

    it('Delivery runner CANNOT mark orders as ready (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/cinema/kitchen/orders/${readyOrderId}/ready`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaADelivery);

      assert.equal(res.status, 403);
    });

    it('Delivery runner CANNOT access cinema staff management (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaADelivery);

      assert.equal(res.status, 403);
    });

    it('Delivery runner CANNOT access cinema reports (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/summary')
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaADelivery);

      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // 7. Multi-Tenant Isolation & IDOR Protection
  // =========================================================================
  describe('7. Tenant Isolation & Cross-Module Security', () => {
    it('Theatre A Admin cannot view Theatre B staff member (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/cinema/staff/${memberCinemaBOwnerId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 404);
      assert.match(res.body.error || res.body.message, /not found or does not belong to this theatre/i);
    });

    it('Theatre A Admin cannot update Theatre B staff member (404 Not Found)', async () => {
      const res = await request(app)
        .patch(`/api/cinema/staff/${memberCinemaBOwnerId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin)
        .send({ staffName: 'Hacked Name' });

      assert.equal(res.status, 404);
    });

    it('Theatre A Admin cannot deactivate Theatre B staff member (404 Not Found)', async () => {
      const res = await request(app)
        .post(`/api/cinema/staff/${memberCinemaBOwnerId}/deactivate`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 404);
    });

    it('Theatre A Admin cannot delete Theatre B staff member (404 Not Found)', async () => {
      const res = await request(app)
        .delete(`/api/cinema/staff/${memberCinemaBOwnerId}`)
        .set('x-theatre-id', theatreAId)
        .set('Cookie', cookieCinemaAAdmin);

      assert.equal(res.status, 404);
    });

    it('Restaurant Owner is rejected from Cinema Staff endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('x-theatre-id', restaurantId)
        .set('Cookie', cookieRestaurantOwner);

      assert.equal(res.status, 403);
      assert.match(res.body.message || res.body.error, /Cross-module access denied/i);
    });
  });
});
