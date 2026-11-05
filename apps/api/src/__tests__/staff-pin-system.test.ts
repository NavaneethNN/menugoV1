import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../index';
import { db, restaurants, restaurantMembers, user, pool } from '@menugo/database';
import { eq } from 'drizzle-orm';
import { auth } from '../lib/auth';

describe('Staff 4-Digit PIN & Password System', () => {
  const timestamp = Date.now();
  let ownerUser: any;
  let ownerSessionToken: string;
  let restaurant: any;

  after(async () => {
    await pool.end().catch(() => {});
  });

  before(async () => {
    // 1. Create Owner User
    const ownerEmail = `owner_pin_${timestamp}@example.com`;
    const signupRes = await auth.api.signUpEmail({
      body: {
        email: ownerEmail,
        password: 'Password123!',
        name: 'Owner PIN Test'
      },
      asResponse: true
    });
    ownerSessionToken = signupRes.headers.get('set-cookie')?.split(';')[0] || '';
    const signup = await signupRes.json();
    ownerUser = signup.user;

    // 2. Create Restaurant
    const [createdRest] = await db
      .insert(restaurants)
      .values({
        id: crypto.randomUUID(),
        name: 'The Spice Grill',
        slug: `spice-grill-${timestamp}`,
        currency: 'INR',
        isActive: true
      })
      .returning();
    restaurant = createdRest;

    // 3. Link Owner Membership
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restaurant.id,
      userId: ownerUser.id,
      role: 'owner',
      isPasswordSet: true
    });
  });

  let createdStaffMember: any;
  const staffPin = '4829';

  describe('1. Admin Adding Staff with 4-Digit PIN', () => {
    it('Owner successfully creates kitchen staff with 4-digit PIN', async () => {
      const res = await request(app)
        .post(`/api/restaurants/${restaurant.id}/staff-pin`)
        .set('Cookie', ownerSessionToken)
        .send({
          name: 'Chef Ramesh',
          role: 'kitchen',
          pin: staffPin
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.role, 'kitchen');
      assert.strictEqual(res.body.staffName, 'Chef Ramesh');
      assert.strictEqual(res.body.pin, staffPin);
      assert.strictEqual(res.body.isPasswordSet, false);
      assert.ok(res.body.membershipId);

      createdStaffMember = res.body;
    });

    it('Rejects duplicate PIN within the same restaurant with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/restaurants/${restaurant.id}/staff-pin`)
        .set('Cookie', ownerSessionToken)
        .send({
          name: 'Chef Suresh',
          role: 'kitchen',
          pin: staffPin // Same PIN
        });

      assert.strictEqual(res.status, 409);
      assert.ok(res.body.error.includes('already exists'));
    });

    it('Rejects non-4-digit PIN format with 400 Validation Error', async () => {
      const res = await request(app)
        .post(`/api/restaurants/${restaurant.id}/staff-pin`)
        .set('Cookie', ownerSessionToken)
        .send({
          name: 'Invalid Staff',
          role: 'staff',
          pin: '123' // Only 3 digits
        });

      assert.strictEqual(res.status, 400);
    });

    it('Members list includes staffName, pin and isPasswordSet', async () => {
      const res = await request(app)
        .get(`/api/restaurants/${restaurant.id}/members`)
        .set('Cookie', ownerSessionToken);

      assert.strictEqual(res.status, 200);
      const found = res.body.find((m: any) => m.pin === staffPin);
      assert.ok(found);
      assert.strictEqual(found.staffName, 'Chef Ramesh');
      assert.strictEqual(found.isPasswordSet, false);
    });
  });

  describe('2. Staff First-Time Login & 4-Digit Password Setup', () => {
    it('Entering 4-digit PIN for first time prompts to set 4-digit password', async () => {
      const res = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: staffPin
          // No password passed
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.firstTimeLogin, true);
      assert.strictEqual(res.body.staffName, 'Chef Ramesh');
      assert.ok(res.body.message.includes('set your 4-digit password'));
    });

    it('Submitting 4-digit PIN with new 4-digit password sets password and establishes session', async () => {
      const res = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: staffPin,
          password: '7733' // Staff creates their secret 4-digit password
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.firstTimeLogin, false);
      assert.strictEqual(res.body.redirectTo, '/kitchen');
      assert.ok(res.headers['set-cookie']); // Set-Cookie issued

      // Verify in DB that isPasswordSet is now true
      const [m] = await db
        .select()
        .from(restaurantMembers)
        .where(eq(restaurantMembers.id, createdStaffMember.membershipId));
      assert.ok(m);
      assert.strictEqual(m.isPasswordSet, true);
    });
  });

  describe('3. Subsequent Logins with 4-Digit PIN & Password', () => {
    it('Subsequent login without password returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: staffPin
        });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('password'));
    });

    it('Subsequent login with incorrect password returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: staffPin,
          password: '9999' // Wrong password
        });

      assert.strictEqual(res.status, 401);
      assert.ok(res.body.error.includes('Invalid'));
    });

    it('Subsequent login with correct PIN & password succeeds and directs to role workstation', async () => {
      const res = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: staffPin,
          password: '7733' // Correct password
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.name, 'Chef Ramesh');
      assert.strictEqual(res.body.redirectTo, '/kitchen');
      assert.ok(res.headers['set-cookie']);
    });
  });

  describe('4. Admin Password Reset & PIN Update', () => {
    it('Admin can reset staff password so staff is prompted to set new password on next login', async () => {
      const res = await request(app)
        .post(`/api/restaurants/${restaurant.id}/members/${createdStaffMember.membershipId}/reset-password`)
        .set('Cookie', ownerSessionToken);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Now staff login with PIN prompts for password setup again
      const checkRes = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: staffPin
        });

      assert.strictEqual(checkRes.status, 200);
      assert.strictEqual(checkRes.body.firstTimeLogin, true);
    });

    it('Admin can update staff 4-digit PIN', async () => {
      const newPin = '9152';
      const res = await request(app)
        .patch(`/api/restaurants/${restaurant.id}/members/${createdStaffMember.membershipId}/pin`)
        .set('Cookie', ownerSessionToken)
        .send({ pin: newPin });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.pin, newPin);

      // Verify old PIN no longer works
      const oldLoginRes = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: staffPin
        });
      assert.strictEqual(oldLoginRes.status, 401);

      // Verify new PIN works
      const newLoginRes = await request(app)
        .post('/api/auth/staff-login')
        .send({
          restaurantSlug: restaurant.slug,
          pin: newPin
        });
      assert.strictEqual(newLoginRes.status, 200);
      assert.strictEqual(newLoginRes.body.firstTimeLogin, true);
    });
  });
});
