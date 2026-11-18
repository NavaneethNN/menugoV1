import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  restaurants,
  restaurantMembers,
  restaurantInvitations,
  user,
  account
} from '@menugo/database';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import {
  addStaffSchema,
  inviteStaffSchema,
  updateStaffRoleSchema,
  transferOwnershipSchema,
  acceptInvitationSchema,
  createStaffWithPinSchema,
  updateStaffPinSchema,
  updateStaffCashierPermissionSchema,
  RestaurantMemberRole,
  StaffAssignableRole
} from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { auth } from '../lib/auth';
import { hashPassword } from 'better-auth/crypto';
import crypto from 'crypto';

const router = Router();

// ---------------------------------------------------------------------------
// 1. List All Active Members Scoped to Active Restaurant (Owner & Admin)
// ---------------------------------------------------------------------------
router.get(
  ['/:restaurantId/members', '/members'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;

      const membersList = await db
        .select({
          membershipId: restaurantMembers.id,
          role: restaurantMembers.role,
          staffName: restaurantMembers.staffName,
          pin: restaurantMembers.pin,
          isPasswordSet: restaurantMembers.isPasswordSet,
          canCashier: restaurantMembers.canCashier,
          createdAt: restaurantMembers.createdAt,
          updatedAt: restaurantMembers.updatedAt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
          }
        })
        .from(restaurantMembers)
        .innerJoin(user, eq(restaurantMembers.userId, user.id))
        .where(eq(restaurantMembers.restaurantId, restaurantId))
        .orderBy(desc(restaurantMembers.createdAt));

      res.json(membersList);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 2. Add or Invite a Staff Member (Owner & Admin)
// ---------------------------------------------------------------------------
router.post(
  ['/:restaurantId/members', '/members'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const callerRole = req.tenant!.role;
      const callerUserId = req.user!.id;

      const { email, role: requestedRole } = addStaffSchema.parse(req.body);

      // Requirement 3: Prevent role escalation & privilege abuse
      if ((requestedRole as string) === 'owner') {
        throw new AppError(
          'Assigning owner role is not permitted. Ownership must be transferred through the ownership transfer process.',
          403
        );
      }

      // Admin role cannot create or invite other admins — only owner can appoint admins
      if (callerRole === 'admin' && requestedRole === 'admin') {
        throw new AppError('Only the restaurant owner can appoint or invite administrators.', 403);
      }

      // Check if user already exists in the authentication system
      const [existingUser] = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email
        })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (existingUser) {
        // Check if user is already a member of this restaurant
        const [existingMembership] = await db
          .select({ id: restaurantMembers.id })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, restaurantId),
              eq(restaurantMembers.userId, existingUser.id)
            )
          )
          .limit(1);

        if (existingMembership) {
          throw new AppError('User is already a member of this restaurant.', 409);
        }

        // Directly add user to restaurant_members
        const [newMembership] = await db
          .insert(restaurantMembers)
          .values({
            id: crypto.randomUUID(),
            restaurantId,
            userId: existingUser.id,
            role: requestedRole
          })
          .returning();

        if (!newMembership) {
          throw new AppError('Failed to create restaurant membership', 500);
        }

        res.status(201).json({
          message: `Added ${existingUser.name || email} as ${requestedRole}`,
          type: 'direct_add',
          member: {
            membershipId: newMembership.id,
            role: newMembership.role,
            createdAt: newMembership.createdAt,
            user: existingUser
          }
        });
        return;
      }

      // User does not exist yet: create an unguessable invitation
      const unguessableToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Check if an active invitation already exists for this email in this restaurant
      const [existingInvite] = await db
        .select({ id: restaurantInvitations.id })
        .from(restaurantInvitations)
        .where(
          and(
            eq(restaurantInvitations.restaurantId, restaurantId),
            eq(restaurantInvitations.email, email),
            eq(restaurantInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (existingInvite) {
        // Update existing invitation with refreshed token & role
        const [updatedInvite] = await db
          .update(restaurantInvitations)
          .set({
            role: requestedRole,
            token: unguessableToken,
            expiresAt,
            invitedByUserId: callerUserId,
            updatedAt: new Date()
          })
          .where(eq(restaurantInvitations.id, existingInvite.id))
          .returning();

        if (!updatedInvite) {
          throw new AppError('Failed to refresh invitation', 500);
        }

        res.status(201).json({
          message: `Refreshed invitation for ${email} with role ${requestedRole}`,
          type: 'invitation',
          invitation: updatedInvite
        });
        return;
      }

      const [newInvite] = await db
        .insert(restaurantInvitations)
        .values({
          id: crypto.randomUUID(),
          restaurantId,
          email,
          role: requestedRole,
          token: unguessableToken,
          invitedByUserId: callerUserId,
          status: 'pending',
          expiresAt
        })
        .returning();

      res.status(201).json({
        message: `Created invitation for ${email} with role ${requestedRole}`,
        type: 'invitation',
        invitation: newInvite
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 3. Explicitly Create an Invitation (Owner & Admin)
// ---------------------------------------------------------------------------
router.post(
  ['/:restaurantId/members/invitations', '/members/invitations'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const callerRole = req.tenant!.role;
      const callerUserId = req.user!.id;

      const { email, role: requestedRole } = inviteStaffSchema.parse(req.body);

      // Prevent role escalation
      if ((requestedRole as string) === 'owner') {
        throw new AppError('Cannot invite users as owner. Ownership transfer is required.', 403);
      }

      if (callerRole === 'admin' && requestedRole === 'admin') {
        throw new AppError('Only the restaurant owner can appoint or invite administrators.', 403);
      }

      // Check if user is already a member with that email
      const [existingUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (existingUser) {
        const [existingMembership] = await db
          .select({ id: restaurantMembers.id })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, restaurantId),
              eq(restaurantMembers.userId, existingUser.id)
            )
          )
          .limit(1);

        if (existingMembership) {
          throw new AppError('User is already an active member of this restaurant.', 409);
        }
      }

      const unguessableToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const [newInvite] = await db
        .insert(restaurantInvitations)
        .values({
          id: crypto.randomUUID(),
          restaurantId,
          email,
          role: requestedRole,
          token: unguessableToken,
          invitedByUserId: callerUserId,
          status: 'pending',
          expiresAt
        })
        .returning();

      res.status(201).json({
        message: `Invitation created for ${email}`,
        invitation: newInvite
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 4. List Pending Invitations Scoped to Restaurant (Owner & Admin)
// ---------------------------------------------------------------------------
router.get(
  ['/:restaurantId/members/invitations', '/members/invitations'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;

      const invites = await db
        .select({
          id: restaurantInvitations.id,
          email: restaurantInvitations.email,
          role: restaurantInvitations.role,
          token: restaurantInvitations.token,
          status: restaurantInvitations.status,
          expiresAt: restaurantInvitations.expiresAt,
          createdAt: restaurantInvitations.createdAt,
          invitedBy: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        })
        .from(restaurantInvitations)
        .innerJoin(user, eq(restaurantInvitations.invitedByUserId, user.id))
        .where(
          and(
            eq(restaurantInvitations.restaurantId, restaurantId),
            eq(restaurantInvitations.status, 'pending')
          )
        )
        .orderBy(desc(restaurantInvitations.createdAt));

      res.json(invites);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 5. Revoke a Pending Invitation (Owner & Admin)
// ---------------------------------------------------------------------------
router.delete(
  ['/:restaurantId/members/invitations/:invitationId', '/members/invitations/:invitationId'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const invitationId = req.params.invitationId as string;

      const [invite] = await db
        .select()
        .from(restaurantInvitations)
        .where(
          and(
            eq(restaurantInvitations.id, invitationId),
            eq(restaurantInvitations.restaurantId, restaurantId) // Strict tenant isolation
          )
        )
        .limit(1);

      if (!invite) {
        throw new AppError('Invitation not found or does not belong to this restaurant.', 404);
      }

      await db
        .update(restaurantInvitations)
        .set({ status: 'revoked', updatedAt: new Date() })
        .where(eq(restaurantInvitations.id, invitationId));

      res.json({ message: `Invitation for ${invite.email} has been revoked.` });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 6. Update Member Role (Owner & Authorized Admin)
// ---------------------------------------------------------------------------
router.patch(
  ['/:restaurantId/members/:memberId', '/members/:memberId'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const callerRole = req.tenant!.role;
      const targetMemberId = req.params.memberId as string;

      const { role: newRole } = updateStaffRoleSchema.parse(req.body);

      // Requirement 3: Prevent role escalation to owner
      if ((newRole as string) === 'owner') {
        throw new AppError('Cannot assign owner role directly. Ownership must be transferred.', 403);
      }

      // Find target member scoped strictly to this restaurant
      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, targetMemberId),
            eq(restaurantMembers.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Staff member not found or does not belong to this restaurant.', 404);
      }

      // Requirement 4: Prevent demotion of the final owner
      if (targetMember.role === 'owner') {
        const [ownerCountResult] = await db
          .select({ value: count() })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, restaurantId),
              eq(restaurantMembers.role, 'owner')
            )
          );

        const ownerCount = Number(ownerCountResult?.value || 0);
        if (ownerCount <= 1) {
          throw new AppError(
            'Cannot demote the final owner of the restaurant. You must transfer ownership to another member first.',
            400
          );
        }
      }

      // Privilege check: Admin cannot modify an Owner or another Admin
      if (callerRole === 'admin') {
        if (targetMember.role === 'owner' || targetMember.role === 'admin') {
          throw new AppError('Administrators cannot modify roles of other administrators or the owner.', 403);
        }
        if (newRole === 'admin') {
          throw new AppError('Only the restaurant owner can promote a member to administrator.', 403);
        }
      }

      const [updated] = await db
        .update(restaurantMembers)
        .set({
          role: newRole,
          updatedAt: new Date()
        })
        .where(eq(restaurantMembers.id, targetMemberId))
        .returning();

      res.json({
        message: `Member role updated to ${newRole}`,
        member: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 7. Revoke Restaurant Membership (Owner & Authorized Admin)
// ---------------------------------------------------------------------------
router.delete(
  ['/:restaurantId/members/:memberId', '/members/:memberId'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const callerRole = req.tenant!.role;
      const targetMemberId = req.params.memberId as string;

      // Find target member strictly scoped to this restaurant (IDOR protection)
      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, targetMemberId),
            eq(restaurantMembers.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Staff member not found or does not belong to this restaurant.', 404);
      }

      // Requirement 4: Prevent removal of the final owner
      if (targetMember.role === 'owner') {
        const [ownerCountResult] = await db
          .select({ value: count() })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, restaurantId),
              eq(restaurantMembers.role, 'owner')
            )
          );

        const ownerCount = Number(ownerCountResult?.value || 0);
        if (ownerCount <= 1) {
          throw new AppError(
            'Cannot remove the final owner of the restaurant. Ownership must be transferred first.',
            400
          );
        }
      }

      // Privilege check: Admin cannot remove an Owner or another Admin
      if (callerRole === 'admin' && (targetMember.role === 'owner' || targetMember.role === 'admin')) {
        throw new AppError('Administrators cannot revoke membership of other administrators or the owner.', 403);
      }

      // Delete the membership record (Requirement 5 & 6)
      // Because requireTenant checks the database dynamically on every request,
      // the revoked member immediately loses access on their next request!
      await db.delete(restaurantMembers).where(eq(restaurantMembers.id, targetMemberId));

      res.json({
        message: 'Staff member removed from restaurant successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 8. Ownership Transfer Process (Owner Only)
// ---------------------------------------------------------------------------
router.post(
  ['/:restaurantId/members/transfer-ownership', '/members/transfer-ownership'],
  requireAuth,
  requireTenant(['owner']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const currentOwnerUserId = req.user!.id;
      const currentOwnerMembershipId = req.tenant!.membershipId;

      const { targetMemberId, targetUserId } = transferOwnershipSchema.parse(req.body);

      const result = await db.transaction(async (tx) => {
        // Find target member
        const condition = targetMemberId
          ? eq(restaurantMembers.id, targetMemberId)
          : eq(restaurantMembers.userId, targetUserId!);

        const [targetMember] = await tx
          .select()
          .from(restaurantMembers)
          .where(and(eq(restaurantMembers.restaurantId, restaurantId), condition))
          .limit(1);

        if (!targetMember) {
          throw new AppError('Target member not found or does not belong to this restaurant.', 404);
        }

        if (targetMember.role === 'owner') {
          throw new AppError('Target member is already an owner of this restaurant.', 400);
        }

        // 1. Promote target member to owner
        const [promoted] = await tx
          .update(restaurantMembers)
          .set({ role: 'owner', updatedAt: new Date() })
          .where(eq(restaurantMembers.id, targetMember.id))
          .returning();

        // 2. Demote current owner to admin
        const [demoted] = await tx
          .update(restaurantMembers)
          .set({ role: 'admin', updatedAt: new Date() })
          .where(eq(restaurantMembers.id, currentOwnerMembershipId))
          .returning();

        return { newOwner: promoted, previousOwner: demoted };
      });

      res.json({
        message: 'Restaurant ownership transferred successfully.',
        newOwner: result.newOwner,
        previousOwner: result.previousOwner
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 9. Public / Authenticated Invitation Details & Activation
// ---------------------------------------------------------------------------
router.get('/invitations/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken = req.params.token as string;
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    if (!token || token.length < 16) {
      throw new AppError('Invitation token is invalid or missing.', 400);
    }

    const [inviteRecord] = await db
      .select({
        id: restaurantInvitations.id,
        email: restaurantInvitations.email,
        role: restaurantInvitations.role,
        status: restaurantInvitations.status,
        expiresAt: restaurantInvitations.expiresAt,
        restaurant: {
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          logoUrl: restaurants.logoUrl
        }
      })
      .from(restaurantInvitations)
      .innerJoin(restaurants, eq(restaurantInvitations.restaurantId, restaurants.id))
      .where(eq(restaurantInvitations.token, token))
      .limit(1);

    if (!inviteRecord) {
      throw new AppError('Invitation not found or token is invalid.', 404);
    }

    if (inviteRecord.status !== 'pending') {
      throw new AppError(`This invitation has already been ${inviteRecord.status}.`, 400);
    }

    if (new Date(inviteRecord.expiresAt).getTime() < Date.now()) {
      throw new AppError('This invitation has expired.', 400);
    }

    res.json(inviteRecord);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/invitations/:token/accept',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token as string;
      const token = typeof rawToken === 'string' ? rawToken.trim() : '';
      const userId = req.user!.id;

      if (!token || token.length < 16) {
        throw new AppError('Invitation token is invalid.', 400);
      }

      const result = await db.transaction(async (tx) => {
        const [invite] = await tx
          .select()
          .from(restaurantInvitations)
          .where(eq(restaurantInvitations.token, token))
          .limit(1);

        if (!invite) {
          throw new AppError('Invitation not found or token is invalid.', 404);
        }

        if (invite.status !== 'pending') {
          throw new AppError(`This invitation has already been ${invite.status}.`, 400);
        }

        if (new Date(invite.expiresAt).getTime() < Date.now()) {
          await tx
            .update(restaurantInvitations)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(eq(restaurantInvitations.id, invite.id));

          throw new AppError('This invitation has expired. Please request a new invite.', 400);
        }

        // Check if user is already a member of this restaurant
        const [existingMember] = await tx
          .select({ id: restaurantMembers.id })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, invite.restaurantId),
              eq(restaurantMembers.userId, userId)
            )
          )
          .limit(1);

        if (existingMember) {
          // Mark invitation accepted to avoid dangling invite
          await tx
            .update(restaurantInvitations)
            .set({ status: 'accepted', updatedAt: new Date() })
            .where(eq(restaurantInvitations.id, invite.id));

          throw new AppError('You are already an active member of this restaurant.', 409);
        }

        // 1. Insert user into restaurant_members with the assigned role
        const [membership] = await tx
          .insert(restaurantMembers)
          .values({
            id: crypto.randomUUID(),
            restaurantId: invite.restaurantId,
            userId,
            role: invite.role
          })
          .returning();

        // 2. Mark invitation as accepted
        await tx
          .update(restaurantInvitations)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(eq(restaurantInvitations.id, invite.id));

        return { membership, restaurantId: invite.restaurantId, role: invite.role };
      });

      res.json({
        message: 'Invitation accepted! You are now a member of this restaurant.',
        membership: result.membership
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 9. Add Staff Member with 4-Digit PIN (Owner & Admin)
// ---------------------------------------------------------------------------
router.post(
  ['/:restaurantId/staff-pin', '/staff-pin'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const callerRole = req.tenant!.role;

      const { name, role: requestedRole, pin, canCashier } = createStaffWithPinSchema.parse(req.body);

      // Prevent role escalation
      if ((requestedRole as string) === 'owner') {
        throw new AppError(
          'Assigning owner role is not permitted. Ownership must be transferred through the ownership transfer process.',
          403
        );
      }

      if (callerRole === 'admin' && requestedRole === 'admin') {
        throw new AppError('Only the restaurant owner can appoint administrators.', 403);
      }

      // Check if a member with this PIN already exists in this restaurant
      const [existingPinMember] = await db
        .select({ id: restaurantMembers.id, staffName: restaurantMembers.staffName })
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.restaurantId, restaurantId),
            eq(restaurantMembers.pin, pin)
          )
        )
        .limit(1);

      if (existingPinMember) {
        throw new AppError(`A staff member with PIN "${pin}" already exists in this restaurant.`, 409);
      }

      // Generate internal staff email based on restaurant and PIN
      const cleanRestId = restaurantId.replace(/-/g, '').slice(0, 8);
      const staffEmail = `staff_${cleanRestId}_${pin}@menugo.internal`;
      const tempPassword = crypto.randomBytes(16).toString('hex');

      // Check if user already exists
      let [staffUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, staffEmail))
        .limit(1);

      if (staffUser) {
        const [existing] = await db
          .select({ tenantType: user.tenantType })
          .from(user)
          .where(eq(user.id, staffUser.id))
          .limit(1);
        if (existing?.tenantType === 'cinema') {
          throw new AppError('This user account is registered for cinema theatres and cannot be added to a restaurant.', 400);
        }
      } else {
        // Create user through Better Auth
        const signupRes = await auth.api.signUpEmail({
          body: {
            email: staffEmail,
            password: tempPassword,
            name,
            tenantType: 'restaurant'
          } as any
        });
        staffUser = { id: signupRes.user.id };
        await db.update(user).set({ tenantType: 'restaurant' }).where(eq(user.id, staffUser.id));
      }

      // Insert into restaurantMembers
      const [newMembership] = await db
        .insert(restaurantMembers)
        .values({
          id: crypto.randomUUID(),
          restaurantId,
          userId: staffUser.id,
          role: requestedRole,
          staffName: name,
          pin,
          isPasswordSet: false,
          canCashier: Boolean(canCashier)
        })
        .returning();

      if (!newMembership) {
        throw new AppError('Failed to create staff membership', 500);
      }

      res.status(201).json({
        membershipId: newMembership.id,
        role: newMembership.role,
        staffName: newMembership.staffName,
        pin: newMembership.pin,
        isPasswordSet: newMembership.isPasswordSet,
        canCashier: newMembership.canCashier,
        createdAt: newMembership.createdAt,
        user: {
          id: staffUser.id,
          name,
          email: staffEmail
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 10. Reset Staff Password (Owner & Admin)
// ---------------------------------------------------------------------------
router.post(
  ['/:restaurantId/members/:memberId/reset-password', '/members/:memberId/reset-password'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const memberId = req.params.memberId as string;

      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, memberId),
            eq(restaurantMembers.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Member not found in this restaurant', 404);
      }

      // Privilege check: Admin cannot modify an Owner or another Admin
      if (req.tenant!.role === 'admin') {
        if (targetMember.role === 'owner' || targetMember.role === 'admin') {
          throw new AppError('Administrators cannot modify permissions of other administrators or the owner.', 403);
        }
      }

      // Reset password state
      await db
        .update(restaurantMembers)
        .set({ isPasswordSet: false, updatedAt: new Date() })
        .where(eq(restaurantMembers.id, memberId));

      // Invalidate existing credential password by setting a temporary dummy hash
      const dummyPassword = crypto.randomBytes(16).toString('hex');
      const dummyHash = await hashPassword(dummyPassword);
      await db
        .update(account)
        .set({ password: dummyHash, updatedAt: new Date() })
        .where(and(eq(account.userId, targetMember.userId), eq(account.providerId, 'credential')));

      res.json({
        success: true,
        message: 'Password reset successfully. The staff member can now set a new 4-digit password on their next login.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 11. Update Staff 4-Digit PIN (Owner & Admin)
// ---------------------------------------------------------------------------
router.patch(
  ['/:restaurantId/members/:memberId/pin', '/members/:memberId/pin'],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const memberId = req.params.memberId as string;
      const { pin } = updateStaffPinSchema.parse(req.body);

      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, memberId),
            eq(restaurantMembers.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Member not found in this restaurant', 404);
      }

      // Privilege check: Admin cannot modify an Owner or another Admin
      if (req.tenant!.role === 'admin') {
        if (targetMember.role === 'owner' || targetMember.role === 'admin') {
          throw new AppError('Administrators cannot modify permissions of other administrators or the owner.', 403);
        }
      }

      // Check if new PIN already taken by another member in this restaurant
      const [conflictMember] = await db
        .select({ id: restaurantMembers.id })
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.restaurantId, restaurantId),
            eq(restaurantMembers.pin, pin)
          )
        )
        .limit(1);

      if (conflictMember && conflictMember.id !== memberId) {
        throw new AppError(`A staff member with PIN "${pin}" already exists in this restaurant.`, 409);
      }

      const [updated] = await db
        .update(restaurantMembers)
        .set({ pin, updatedAt: new Date() })
        .where(eq(restaurantMembers.id, memberId))
        .returning();

      if (!updated) {
        throw new AppError('Failed to update staff PIN', 500);
      }

      res.json({
        membershipId: updated.id,
        pin: updated.pin,
        staffName: updated.staffName,
        message: '4-digit PIN updated successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 12. Toggle Staff Cashier Permission (Owner & Admin)
// ---------------------------------------------------------------------------
router.patch(
  [
    '/:restaurantId/members/:memberId/cashier-permission',
    '/members/:memberId/cashier-permission',
    '/:memberId/cashier-permission'
  ],
  requireAuth,
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const memberId = req.params.memberId as string;
      const { canCashier } = updateStaffCashierPermissionSchema.parse(req.body);

      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, memberId),
            eq(restaurantMembers.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Member not found in this restaurant', 404);
      }

      // Privilege check: Admin cannot modify an Owner or another Admin
      if (req.tenant!.role === 'admin') {
        if (targetMember.role === 'owner' || targetMember.role === 'admin') {
          throw new AppError('Administrators cannot modify permissions of other administrators or the owner.', 403);
        }
      }

      const [updated] = await db
        .update(restaurantMembers)
        .set({ canCashier, updatedAt: new Date() })
        .where(eq(restaurantMembers.id, memberId))
        .returning();

      if (!updated) {
        throw new AppError('Failed to update cashier permission', 500);
      }

      res.json({
        membershipId: updated.id,
        canCashier: updated.canCashier,
        staffName: updated.staffName,
        message: `Cashier permission ${canCashier ? 'granted to' : 'revoked from'} ${updated.staffName || 'staff member'}.`
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
