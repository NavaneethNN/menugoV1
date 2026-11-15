import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  restaurants,
  restaurantMembers,
  user,
  account
} from '@menugo/database';
import { eq, and, sql, desc, count, ilike, or } from 'drizzle-orm';
import {
  addCinemaStaffSchema,
  updateCinemaStaffSchema,
  CinemaMemberRole,
  CinemaStaffAssignableRole
} from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireCinemaTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { hashPassword } from 'better-auth/crypto';
import crypto from 'node:crypto';

const router = Router();

// =========================================================================
// 1. List Cinema Staff Members (Requirement 1, 5, 6)
// =========================================================================
router.get(
  '/',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const roleFilter = req.query.role as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const searchQuery = (req.query.search as string | undefined)?.trim();

      const conditions = [eq(restaurantMembers.restaurantId, theatreId)];

      if (roleFilter && roleFilter !== 'all') {
        conditions.push(eq(restaurantMembers.role, roleFilter));
      }

      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(restaurantMembers.status, statusFilter));
      }

      if (searchQuery) {
        const queryTerm = `%${searchQuery}%`;
        conditions.push(
          or(
            ilike(restaurantMembers.staffName, queryTerm),
            ilike(restaurantMembers.phone, queryTerm),
            ilike(user.name, queryTerm),
            ilike(user.email, queryTerm)
          )!
        );
      }

      const staffList = await db
        .select({
          membershipId: restaurantMembers.id,
          theatreId: restaurantMembers.restaurantId,
          userId: restaurantMembers.userId,
          staffName: restaurantMembers.staffName,
          phone: restaurantMembers.phone,
          role: restaurantMembers.role,
          status: restaurantMembers.status,
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
        .where(and(...conditions))
        .orderBy(desc(restaurantMembers.createdAt));

      // Calculate summary metrics for cinema staff dashboard
      let totalStaff = 0;
      let activeStaff = 0;
      let inactiveStaff = 0;
      let ownerCount = 0;
      let adminCount = 0;
      let kitchenCount = 0;
      let deliveryCount = 0;
      let floorStaffCount = 0;

      for (const m of staffList) {
        totalStaff++;
        if (m.status === 'active') activeStaff++;
        else inactiveStaff++;

        if (m.role === 'owner') ownerCount++;
        else if (m.role === 'admin') adminCount++;
        else if (m.role === 'kitchen') kitchenCount++;
        else if (m.role === 'delivery') deliveryCount++;
        else if (m.role === 'staff') floorStaffCount++;
      }

      res.json({
        success: true,
        theatreId,
        metrics: {
          totalStaff,
          activeStaff,
          inactiveStaff,
          ownerCount,
          adminCount,
          kitchenCount,
          deliveryCount,
          floorStaffCount
        },
        summary: {
          total: totalStaff,
          active: activeStaff,
          inactive: inactiveStaff,
          roles: {
            owners: ownerCount,
            admins: adminCount,
            kitchen: kitchenCount,
            delivery: deliveryCount,
            generalStaff: floorStaffCount
          }
        },
        staff: staffList,
        members: staffList
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 2. Get Single Staff Member Details (Requirement 1, 5)
// =========================================================================
router.get(
  '/:id',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const membershipId = req.params.id as string;

      const [member] = await db
        .select({
          id: restaurantMembers.id,
          membershipId: restaurantMembers.id,
          theatreId: restaurantMembers.restaurantId,
          userId: restaurantMembers.userId,
          staffName: restaurantMembers.staffName,
          phone: restaurantMembers.phone,
          role: restaurantMembers.role,
          status: restaurantMembers.status,
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
        .where(
          and(
            eq(restaurantMembers.id, membershipId),
            eq(restaurantMembers.restaurantId, theatreId)
          )
        )
        .limit(1);

      if (!member) {
        throw new AppError('Cinema staff member not found or does not belong to this theatre', 404);
      }

      res.json({
        success: true,
        theatreId,
        member
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 3. Add Cinema Staff Member (Requirement 1, 2, 7)
// =========================================================================
router.post(
  '/',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const callerRole = req.tenant!.role;

      const validated = addCinemaStaffSchema.parse(req.body);
      const { name, email, role, phone, password } = validated;

      // Privilege escalation guards (Requirement 3 & 4)
      if ((role as string) === 'owner') {
        throw new AppError('Assigning owner role is not permitted. Ownership must be transferred through the ownership transfer process.', 403);
      }

      if (callerRole === 'admin' && role === 'admin') {
        throw new AppError('Only the cinema theatre owner can appoint administrators.', 403);
      }

      // Check if user already exists in auth database
      const [existingUser] = await db
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      let targetUserId: string;

      if (existingUser) {
        targetUserId = existingUser.id;

        // Verify user is not already a member of this theatre
        const [existingMembership] = await db
          .select({ id: restaurantMembers.id })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, theatreId),
              eq(restaurantMembers.userId, targetUserId)
            )
          )
          .limit(1);

        if (existingMembership) {
          throw new AppError('User is already a staff member of this cinema theatre.', 409);
        }
      } else {
        // Create new user in user table
        targetUserId = crypto.randomUUID();
        const rawPassword = password || `Cin@${crypto.randomBytes(4).toString('hex')}#`;
        const hashedPassword = await hashPassword(rawPassword);

        await db.insert(user).values({
          id: targetUserId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Insert credential account for email/password login
        await db.insert(account).values({
          id: crypto.randomUUID(),
          userId: targetUserId,
          accountId: targetUserId,
          providerId: 'credential',
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Create membership in cinema theatre
      const membershipId = crypto.randomUUID();
      const [newMember] = await db
        .insert(restaurantMembers)
        .values({
          id: membershipId,
          restaurantId: theatreId,
          userId: targetUserId,
          role,
          staffName: name.trim(),
          phone: phone?.trim() || null,
          status: 'active',
          canCashier: role === 'admin',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      if (!newMember) {
        throw new AppError('Failed to create cinema staff membership', 500);
      }

      res.status(201).json({
        success: true,
        message: 'Cinema staff member added successfully.',
        member: {
          membershipId: newMember.id,
          theatreId: newMember.restaurantId,
          userId: newMember.userId,
          staffName: newMember.staffName,
          phone: newMember.phone,
          role: newMember.role,
          status: newMember.status,
          user: {
            id: targetUserId,
            name: name.trim(),
            email: email.trim().toLowerCase()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 4. Edit Cinema Staff Member (Requirement 1, 3, 4, 5)
// =========================================================================
router.patch(
  '/:id',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const callerRole = req.tenant!.role;
      const membershipId = req.params.id as string;

      const validated = updateCinemaStaffSchema.parse(req.body);

      // Verify target membership exists and belongs to this theatre (IDOR protection)
      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, membershipId),
            eq(restaurantMembers.restaurantId, theatreId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Cinema staff member not found or does not belong to this theatre', 404);
      }

      // Privilege escalation & role modification guards
      if (validated.role) {
        if ((validated.role as string) === 'owner') {
          throw new AppError('Assigning owner role is not permitted. Ownership must be transferred through the ownership transfer process.', 403);
        }

        if (callerRole === 'admin' && validated.role === 'admin' && targetMember.role !== 'admin') {
          throw new AppError('Only the cinema theatre owner can appoint administrators.', 403);
        }

        // If target is currently an owner, prevent demotion
        if (targetMember.role === 'owner') {
          const [ownerCountResult] = await db
            .select({ count: count() })
            .from(restaurantMembers)
            .where(
              and(
                eq(restaurantMembers.restaurantId, theatreId),
                eq(restaurantMembers.role, 'owner')
              )
            );

          if (Number(ownerCountResult?.count || 0) <= 1) {
            throw new AppError('Cannot demote or change the role of the final owner of the theatre.', 400);
          }
        }
      }

      // If status is being set to inactive, ensure not deactivating the final owner
      if (validated.status === 'inactive' && targetMember.role === 'owner') {
        const [ownerCountResult] = await db
          .select({ count: count() })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, theatreId),
              eq(restaurantMembers.role, 'owner'),
              eq(restaurantMembers.status, 'active')
            )
          );

        if (Number(ownerCountResult?.count || 0) <= 1) {
          throw new AppError('Cannot deactivate the final active owner of the theatre.', 400);
        }
      }

      const updateData: Partial<typeof restaurantMembers.$inferInsert> = {
        updatedAt: new Date()
      };

      if (validated.staffName !== undefined) updateData.staffName = validated.staffName.trim();
      if (validated.phone !== undefined) updateData.phone = validated.phone?.trim() || null;
      if (validated.role !== undefined) updateData.role = validated.role;
      if (validated.status !== undefined) updateData.status = validated.status;

      const [updated] = await db
        .update(restaurantMembers)
        .set(updateData)
        .where(eq(restaurantMembers.id, membershipId))
        .returning();

      if (!updated) {
        throw new AppError('Failed to update cinema staff membership', 500);
      }

      // Retrieve user details
      const [userInfo] = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email
        })
        .from(user)
        .where(eq(user.id, updated.userId))
        .limit(1);

      res.json({
        success: true,
        message: 'Cinema staff member updated successfully.',
        member: {
          membershipId: updated.id,
          theatreId: updated.restaurantId,
          userId: updated.userId,
          staffName: updated.staffName,
          phone: updated.phone,
          role: updated.role,
          status: updated.status,
          updatedAt: updated.updatedAt,
          user: userInfo
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 5. Deactivate Staff Member (Requirement 1, 4)
// =========================================================================
router.post(
  '/:id/deactivate',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const membershipId = req.params.id as string;

      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, membershipId),
            eq(restaurantMembers.restaurantId, theatreId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Cinema staff member not found or does not belong to this theatre', 404);
      }

      if (targetMember.role === 'owner') {
        const [ownerCountResult] = await db
          .select({ count: count() })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, theatreId),
              eq(restaurantMembers.role, 'owner'),
              eq(restaurantMembers.status, 'active')
            )
          );

        if (Number(ownerCountResult?.count || 0) <= 1) {
          throw new AppError('Cannot deactivate the final active owner of the theatre.', 400);
        }
      }

      const [updated] = await db
        .update(restaurantMembers)
        .set({
          status: 'inactive',
          updatedAt: new Date()
        })
        .where(eq(restaurantMembers.id, membershipId))
        .returning();

      if (!updated) {
        throw new AppError('Failed to deactivate cinema staff membership', 500);
      }

      res.json({
        success: true,
        message: 'Staff member deactivated successfully.',
        memberId: updated.id,
        status: updated.status
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 6. Activate Staff Member (Requirement 1, 4)
// =========================================================================
router.post(
  '/:id/activate',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const membershipId = req.params.id as string;

      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, membershipId),
            eq(restaurantMembers.restaurantId, theatreId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Cinema staff member not found or does not belong to this theatre', 404);
      }

      const [updated] = await db
        .update(restaurantMembers)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(restaurantMembers.id, membershipId))
        .returning();

      if (!updated) {
        throw new AppError('Failed to activate cinema staff membership', 500);
      }

      res.json({
        success: true,
        message: 'Staff member activated successfully.',
        memberId: updated.id,
        status: updated.status
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 7. Remove Cinema Staff Member (Requirement 1, 5)
// =========================================================================
router.delete(
  '/:id',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const membershipId = req.params.id as string;

      const [targetMember] = await db
        .select()
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.id, membershipId),
            eq(restaurantMembers.restaurantId, theatreId)
          )
        )
        .limit(1);

      if (!targetMember) {
        throw new AppError('Cinema staff member not found or does not belong to this theatre', 404);
      }

      // Check if target is the final owner
      if (targetMember.role === 'owner') {
        const [ownerCountResult] = await db
          .select({ count: count() })
          .from(restaurantMembers)
          .where(
            and(
              eq(restaurantMembers.restaurantId, theatreId),
              eq(restaurantMembers.role, 'owner')
            )
          );

        if (Number(ownerCountResult?.count || 0) <= 1) {
          throw new AppError('Cannot remove the final owner of the theatre. Ownership must be transferred first.', 400);
        }
      }

      await db
        .delete(restaurantMembers)
        .where(eq(restaurantMembers.id, membershipId));

      res.json({
        success: true,
        message: 'Cinema staff member removed successfully.',
        memberId: membershipId
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
