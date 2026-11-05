import { Request, Response, NextFunction } from 'express';
import { db, restaurants, restaurantMembers } from '@menugo/database';
import { eq, and } from 'drizzle-orm';
import { RestaurantMemberRole } from '@menugo/shared';
import { requireAuth, AuthenticatedUser } from './auth';

export interface TenantPermissions {
  canManageRestaurant: boolean;
  canManageStaff: boolean;
  canManageMenu: boolean;
  canManageTables: boolean;
  canManageOrders: boolean;
  canUpdateOrderStatus: boolean;
  canCancelOrders: boolean;
}

export interface TenantContext {
  restaurantId: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    isActive: boolean;
  };
  membershipId: string;
  role: RestaurantMemberRole;
  permissions: TenantPermissions;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Returns strongly typed server-side permissions for a member's role.
 * No client-supplied roles are ever used.
 */
export function getPermissionsForRole(role: RestaurantMemberRole): TenantPermissions {
  switch (role) {
    case 'owner':
      return {
        canManageRestaurant: true,
        canManageStaff: true,
        canManageMenu: true,
        canManageTables: true,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: true
      };
    case 'admin':
      return {
        canManageRestaurant: false, // only owner can edit core restaurant identity/ownership
        canManageStaff: true,
        canManageMenu: true,
        canManageTables: true,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: true
      };
    case 'kitchen':
      return {
        canManageRestaurant: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageTables: false,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: false
      };
    case 'staff':
      return {
        canManageRestaurant: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageTables: false,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: false
      };
    default:
      return {
        canManageRestaurant: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageTables: false,
        canManageOrders: false,
        canUpdateOrderStatus: false,
        canCancelOrders: false
      };
  }
}

/**
 * Centralized Multi-Tenant Authorization Middleware.
 * 1. Ensures user is authenticated.
 * 2. Extracts explicit target restaurant identifier (header, param, query).
 * 3. Never trusts client input as ownership proof.
 * 4. Queries database to verify user's active membership and role in that restaurant.
 * 5. Attaches strongly-typed req.tenant context.
 * 6. Enforces role restrictions if allowedRoles is provided.
 */
export function requireTenant(allowedRoles?: RestaurantMemberRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Ensure user is authenticated first
    if (!req.user) {
      await new Promise<void>((resolve) => {
        requireAuth(req, res, () => resolve());
      });
      if (res.headersSent) return;
    }

    try {
      // 2. Resolve target restaurant identifier from explicit context
      const targetRestaurantId =
        (req.headers['x-restaurant-id'] as string) ||
        req.params.restaurantId ||
        (req.query.restaurantId as string);

      if (!targetRestaurantId || typeof targetRestaurantId !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing restaurant context: specify x-restaurant-id header or restaurantId parameter.'
        });
        return;
      }

      // 3. Query database to verify that the user is an authorized member of THIS restaurant
      const [membership] = await db
        .select({
          membershipId: restaurantMembers.id,
          role: restaurantMembers.role,
          restaurant: {
            id: restaurants.id,
            name: restaurants.name,
            slug: restaurants.slug,
            currency: restaurants.currency,
            isActive: restaurants.isActive
          }
        })
        .from(restaurantMembers)
        .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
        .where(
          and(
            eq(restaurantMembers.restaurantId, targetRestaurantId),
            eq(restaurantMembers.userId, req.user!.id)
          )
        )
        .limit(1);

      if (!membership) {
        // IDOR protection: User has NO membership in the requested restaurant
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: You are not an authorized member of this restaurant.'
        });
        return;
      }

      if (!membership.restaurant.isActive) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Restaurant account is currently inactive.'
        });
        return;
      }

      const role = membership.role as RestaurantMemberRole;

      // 4. Verify role authorization if required
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}.`
        });
        return;
      }

      // 5. Attach resolved tenant context
      req.tenant = {
        restaurantId: membership.restaurant.id,
        restaurant: membership.restaurant,
        membershipId: membership.membershipId,
        role,
        permissions: getPermissionsForRole(role)
      };

      req.restaurantId = membership.restaurant.id;
      req.restaurantRole = role;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware ensuring the authenticated tenant member holds a specific permission.
 */
export function requireTenantPermission(permission: keyof TenantPermissions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'requireTenantPermission must be executed after requireTenant middleware.'
      });
      return;
    }

    if (!req.tenant.permissions[permission]) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied: ${permission} is not granted for your role (${req.tenant.role}).`
      });
      return;
    }

    next();
  };
}

