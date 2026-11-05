import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  user,
  session,
  restaurants,
  restaurantMembers,
  restaurantInvitations,
  orders
} from '@menugo/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 18 — Staff Membership Administration', () => {
  // Restaurants
  let restAlphaId: string;
  let restBetaId: string;

  // Users for Alpha
  let userAlphaOwnerId: string;
  let userAlphaAdminId: string;
  let userAlphaStaffId: string;
  let userAlphaKitchenId: string;

  // User for Beta
  let userBetaOwnerId: string;

  // External / Free User (not initially in Alpha)
  let userFionaId: string;

  // Session Cookies
  let cookieAlphaOwner: string;
  let cookieAlphaAdmin: string;
  let cookieAlphaStaff: string;
  let cookieAlphaKitchen: string;
  let cookieBetaOwner: string;
  let cookieFiona: string;

  // Memberships
  let memberAlphaOwnerId: string;
  let memberAlphaAdminId: string;
  let memberAlphaStaffId: string;
  let memberBetaOwnerId: string;

  const now = Date.now();
  const restAlphaSlug = `staff-alpha-${now}`;
  const restBetaSlug = `staff-beta-${now}`;

  before(async () => {
    // 1. Create Restaurants
    restAlphaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restAlphaId,
      name: 'Alpha Brasserie',
      slug: restAlphaSlug,
      currency: 'INR',
      isActive: true
    });

    restBetaId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restBetaId,
      name: 'Beta Cantina',
      slug: restBetaSlug,
      currency: 'INR',
      isActive: true
    });

    // 2. Create Users & Memberships for Alpha
    // Owner
    const ownerRes = await auth.api.signUpEmail({
      body: {
        name: 'Alice Owner',
        email: `alice-owner-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaOwner = ownerRes.headers.get('set-cookie')?.split(';')[0] || '';
    const ownerJson = await ownerRes.json();
    userAlphaOwnerId = ownerJson.user.id;
    memberAlphaOwnerId = crypto.randomUUID();
    await db.insert(restaurantMembers).values({
      id: memberAlphaOwnerId,
      restaurantId: restAlphaId,
      userId: userAlphaOwnerId,
      role: 'owner'
    });

    // Admin
    const adminRes = await auth.api.signUpEmail({
      body: {
        name: 'Aaron Admin',
        email: `aaron-admin-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaAdmin = adminRes.headers.get('set-cookie')?.split(';')[0] || '';
    const adminJson = await adminRes.json();
    userAlphaAdminId = adminJson.user.id;
    memberAlphaAdminId = crypto.randomUUID();
    await db.insert(restaurantMembers).values({
      id: memberAlphaAdminId,
      restaurantId: restAlphaId,
      userId: userAlphaAdminId,
      role: 'admin'
    });

    // Staff
    const staffRes = await auth.api.signUpEmail({
      body: {
        name: 'Sam Staff',
        email: `sam-staff-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaStaff = staffRes.headers.get('set-cookie')?.split(';')[0] || '';
    const staffJson = await staffRes.json();
    userAlphaStaffId = staffJson.user.id;
    memberAlphaStaffId = crypto.randomUUID();
    await db.insert(restaurantMembers).values({
      id: memberAlphaStaffId,
      restaurantId: restAlphaId,
      userId: userAlphaStaffId,
      role: 'staff'
    });

    // Kitchen
    const kitchenRes = await auth.api.signUpEmail({
      body: {
        name: 'Ken Kitchen',
        email: `ken-kitchen-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieAlphaKitchen = kitchenRes.headers.get('set-cookie')?.split(';')[0] || '';
    const kitchenJson = await kitchenRes.json();
    userAlphaKitchenId = kitchenJson.user.id;
    await db.insert(restaurantMembers).values({
      id: crypto.randomUUID(),
      restaurantId: restAlphaId,
      userId: userAlphaKitchenId,
      role: 'kitchen'
    });

    // 3. User for Beta
    const betaRes = await auth.api.signUpEmail({
      body: {
        name: 'Bob Beta Owner',
        email: `bob-beta-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieBetaOwner = betaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const betaJson = await betaRes.json();
    userBetaOwnerId = betaJson.user.id;
    memberBetaOwnerId = crypto.randomUUID();
    await db.insert(restaurantMembers).values({
      id: memberBetaOwnerId,
      restaurantId: restBetaId,
      userId: userBetaOwnerId,
      role: 'owner'
    });

    // 4. Free User (Fiona)
    const fionaRes = await auth.api.signUpEmail({
      body: {
        name: 'Fiona Free',
        email: `fiona-${now}@example.com`,
        password: 'Password123!'
      },
      asResponse: true
    });
    cookieFiona = fionaRes.headers.get('set-cookie')?.split(';')[0] || '';
    const fionaJson = await fionaRes.json();
    userFionaId = fionaJson.user.id;
  });

  after(async () => {
    // Cleanup
    await db.delete(restaurantInvitations);
    await db.delete(restaurantMembers);
    await db.delete(restaurants);
    await db.delete(session);
    await db.delete(user);
  });

  // ---------------------------------------------------------------------------
  // 1. List Members Scoped to Active Restaurant (Requirements 1 & 7)
  // ---------------------------------------------------------------------------
  test('Requirements 1 & 7: Owner can list active restaurant members with profile details', async () => {
    const res = await request(app)
      .get(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 4, 'Should list owner, admin, staff, kitchen');

    // Verify fields returned
    for (const member of res.body) {
      assert.ok(member.membershipId);
      assert.ok(member.role);
      assert.ok(member.user);
      assert.ok(member.user.email);
      assert.equal(member.user.password, undefined, 'Never leak password hash');
    }
  });

  test('Requirement 1 & 7: Admin can also list restaurant members', async () => {
    const res = await request(app)
      .get(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaAdmin)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  test('Requirement 1: Staff or Kitchen role cannot access member list', async () => {
    const resStaff = await request(app)
      .get(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaStaff)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(resStaff.status, 403);

    const resKitchen = await request(app)
      .get(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaKitchen)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(resKitchen.status, 403);
  });

  // ---------------------------------------------------------------------------
  // 2. Role Escalation Prevention (Requirements 2 & 3)
  // ---------------------------------------------------------------------------
  test('Requirement 3: Attempting to add or invite someone as OWNER is strictly rejected', async () => {
    const res = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        email: `intruder-${now}@example.com`,
        role: 'owner' // Prohibited!
      });

    assert.equal(res.status, 400); // Schema rejects 'owner' from STAFF_ASSIGNABLE_ROLES
  });

  test('Requirement 3: Admin cannot invite or appoint another ADMIN (only Owner can)', async () => {
    const res = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaAdmin)
      .set('x-restaurant-id', restAlphaId)
      .send({
        email: `newadmin-${now}@example.com`,
        role: 'admin'
      });

    assert.equal(res.status, 403);
    assert.ok(JSON.stringify(res.body).includes('Only the restaurant owner can appoint or invite administrators'));
  });

  test('Requirement 3: Admin cannot update a staff member to ADMIN or OWNER', async () => {
    const res = await request(app)
      .patch(`/api/restaurants/${restAlphaId}/members/${memberAlphaStaffId}`)
      .set('Cookie', cookieAlphaAdmin)
      .set('x-restaurant-id', restAlphaId)
      .send({
        role: 'admin'
      });

    assert.equal(res.status, 403);
    assert.ok(JSON.stringify(res.body).includes('Only the restaurant owner can promote a member to administrator'));
  });

  test('Requirement 2: Reject non-V1 arbitrary roles', async () => {
    const res = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        email: `waiter-${now}@example.com`,
        role: 'super_admin' // Invalid role
      });

    assert.equal(res.status, 400);
  });

  // ---------------------------------------------------------------------------
  // 3. Final Owner Protection (Requirement 4)
  // ---------------------------------------------------------------------------
  test('Requirement 4: Reject demotion of the final owner of the restaurant', async () => {
    const res = await request(app)
      .patch(`/api/restaurants/${restAlphaId}/members/${memberAlphaOwnerId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        role: 'staff' // Demoting final owner!
      });

    assert.equal(res.status, 400);
    assert.ok(JSON.stringify(res.body).includes('Cannot demote the final owner'));

    // Verify role remains owner
    const [dbOwner] = await db.select().from(restaurantMembers).where(eq(restaurantMembers.id, memberAlphaOwnerId));
    assert.equal(dbOwner?.role, 'owner');
  });

  test('Requirement 4: Reject deletion / revoking of the final owner of the restaurant', async () => {
    const res = await request(app)
      .delete(`/api/restaurants/${restAlphaId}/members/${memberAlphaOwnerId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(res.status, 400);
    assert.ok(JSON.stringify(res.body).includes('Cannot remove the final owner'));

    const [dbOwner] = await db.select().from(restaurantMembers).where(eq(restaurantMembers.id, memberAlphaOwnerId));
    assert.ok(dbOwner, 'Owner must not be deleted');
  });

  // ---------------------------------------------------------------------------
  // 4. Ownership Transfer Process (Requirement 4)
  // ---------------------------------------------------------------------------
  test('Requirement 4: Owner can transfer restaurant ownership to an active member', async () => {
    // Alice transfers ownership to Aaron Admin
    const res = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members/transfer-ownership`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        targetMemberId: memberAlphaAdminId
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.newOwner.role, 'owner');
    assert.equal(res.body.previousOwner.role, 'admin');

    // Verify in database
    const [dbNewOwner] = await db.select().from(restaurantMembers).where(eq(restaurantMembers.id, memberAlphaAdminId));
    assert.equal(dbNewOwner?.role, 'owner');

    const [dbPrevOwner] = await db.select().from(restaurantMembers).where(eq(restaurantMembers.id, memberAlphaOwnerId));
    assert.equal(dbPrevOwner?.role, 'admin');

    // Transfer back from Aaron to Alice so Alice remains owner for remaining tests
    const restoreRes = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members/transfer-ownership`)
      .set('Cookie', cookieAlphaAdmin) // Aaron is now owner!
      .set('x-restaurant-id', restAlphaId)
      .send({
        targetMemberId: memberAlphaOwnerId
      });

    assert.equal(restoreRes.status, 200);
  });

  // ---------------------------------------------------------------------------
  // 5. Direct Add & Revoke Membership (Requirements 1, 5, 6)
  // ---------------------------------------------------------------------------
  let fionaMembershipId: string;

  test('Requirement 1: Owner adds an existing user directly to the restaurant', async () => {
    const res = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        email: `fiona-${now}@example.com`,
        role: 'kitchen'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.type, 'direct_add');
    assert.equal(res.body.member.role, 'kitchen');
    fionaMembershipId = res.body.member.membershipId;

    // Verify in database
    const [dbFiona] = await db.select().from(restaurantMembers).where(eq(restaurantMembers.id, fionaMembershipId));
    assert.ok(dbFiona);
    assert.equal(dbFiona.role, 'kitchen');
  });

  test('Requirement 1: Adding already existing restaurant member returns 409 Conflict', async () => {
    const res = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        email: `fiona-${now}@example.com`,
        role: 'staff'
      });

    assert.equal(res.status, 409);
    assert.ok(JSON.stringify(res.body).includes('already a member'));
  });

  test('Requirement 5 & 6: Owner revokes membership and user immediately loses access on next request', async () => {
    // 1. Fiona can access restaurant endpoint before revoking
    const beforeRes = await request(app)
      .get('/api/orders')
      .set('Cookie', cookieFiona)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(beforeRes.status, 200, 'Fiona should have access as active kitchen member');

    // 2. Owner revokes Fiona's membership
    const revokeRes = await request(app)
      .delete(`/api/restaurants/${restAlphaId}/members/${fionaMembershipId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(revokeRes.status, 200);

    // 3. Fiona's immediate next request is rejected with 403 Forbidden!
    const afterRes = await request(app)
      .get('/api/orders')
      .set('Cookie', cookieFiona)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(afterRes.status, 403, 'Revoked member must immediately receive 403 Forbidden on next authorization check');
    assert.ok(JSON.stringify(afterRes.body).includes('not an authorized member'));
  });

  // ---------------------------------------------------------------------------
  // 6. Invitation & Activation Flow (Requirements 1, 8, 9)
  // ---------------------------------------------------------------------------
  let inviteToken: string;
  let inviteId: string;
  const inviteEmail = `invitee-${now}@example.com`;

  test('Requirement 1 & 8: Owner invites a staff member generating an unguessable token', async () => {
    const res = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members/invitations`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        email: inviteEmail,
        role: 'staff'
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.invitation);
    assert.ok(res.body.invitation.token);
    assert.ok(res.body.invitation.token.length >= 32, 'Token must be cryptographically unguessable');
    assert.equal(res.body.invitation.role, 'staff');
    assert.equal(res.body.invitation.status, 'pending');

    inviteToken = res.body.invitation.token;
    inviteId = res.body.invitation.id;
  });

  test('Requirement 8: Inspect invitation details via token', async () => {
    const res = await request(app).get(`/api/restaurants/invitations/${inviteToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.email, inviteEmail);
    assert.equal(res.body.role, 'staff');
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.restaurant.id, restAlphaId);
  });

  test('Requirement 8 & 9: User activates invitation and joins restaurant as staff', async () => {
    // Sign up the invited user
    const userRes = await auth.api.signUpEmail({
      body: {
        name: 'Ivy Invitee',
        email: inviteEmail,
        password: 'Password123!'
      },
      asResponse: true
    });
    const userCookie = userRes.headers.get('set-cookie')?.split(';')[0] || '';

    // Accept invitation
    const acceptRes = await request(app)
      .post(`/api/restaurants/invitations/${inviteToken}/accept`)
      .set('Cookie', userCookie);

    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.membership.role, 'staff');
    assert.equal(acceptRes.body.membership.restaurantId, restAlphaId);

    // Verify invitation is marked accepted
    const [dbInvite] = await db.select().from(restaurantInvitations).where(eq(restaurantInvitations.id, inviteId));
    assert.equal(dbInvite?.status, 'accepted');

    // Attempting to accept again returns 400
    const reAcceptRes = await request(app)
      .post(`/api/restaurants/invitations/${inviteToken}/accept`)
      .set('Cookie', userCookie);

    assert.equal(reAcceptRes.status, 400);
  });

  // ---------------------------------------------------------------------------
  // 7. Revoke Invitation (Requirements 5 & 8)
  // ---------------------------------------------------------------------------
  test('Requirement 5: Owner can revoke a pending invitation', async () => {
    // Create new invite
    const createRes = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members/invitations`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        email: `revokeme-${now}@example.com`,
        role: 'kitchen'
      });

    assert.equal(createRes.status, 201);
    const tempInviteId = createRes.body.invitation.id;
    const tempToken = createRes.body.invitation.token;

    // Revoke
    const deleteRes = await request(app)
      .delete(`/api/restaurants/${restAlphaId}/members/invitations/${tempInviteId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(deleteRes.status, 200);

    // Look up via token returns 400 (already revoked)
    const lookupRes = await request(app).get(`/api/restaurants/invitations/${tempToken}`);
    assert.equal(lookupRes.status, 400);
    assert.ok(JSON.stringify(lookupRes.body).includes('revoked'));
  });

  // ---------------------------------------------------------------------------
  // 8. Strict Tenant Isolation / IDOR Protection (Requirements 7 & 9)
  // ---------------------------------------------------------------------------
  test('Requirements 7 & 9: Owner of Alpha cannot access, modify or revoke Beta members (404 IDOR)', async () => {
    // Alpha owner tries to update Beta owner
    const patchRes = await request(app)
      .patch(`/api/restaurants/${restAlphaId}/members/${memberBetaOwnerId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        role: 'staff'
      });

    assert.equal(patchRes.status, 404);

    // Alpha owner tries to delete Beta owner
    const deleteRes = await request(app)
      .delete(`/api/restaurants/${restAlphaId}/members/${memberBetaOwnerId}`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId);

    assert.equal(deleteRes.status, 404);

    // Alpha owner tries to transfer ownership using Beta member
    const transferRes = await request(app)
      .post(`/api/restaurants/${restAlphaId}/members/transfer-ownership`)
      .set('Cookie', cookieAlphaOwner)
      .set('x-restaurant-id', restAlphaId)
      .send({
        targetMemberId: memberBetaOwnerId
      });

    assert.equal(transferRes.status, 404);
  });
});

