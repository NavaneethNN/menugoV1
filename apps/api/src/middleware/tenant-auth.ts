import { Request, Response, NextFunction } from 'express';
import { db, restaurantDb, cinemaDb, restaurants, restaurantMembers } from '@menugo/database';
import { eq, and } from 'drizzle-orm';
import { RestaurantMemberRole, TenantType } from '@menugo/shared';
import { requireAuth, AuthenticatedUser } from './auth';
import { trackAdminActionUsage } from '../lib/usage-tracking-service';

export interface TenantPermissions {
  canManageRestaurant: boolean;
  canManageStaff: boolean;
  canManageMenu: boolean;
  canManageTables: boolean;
  canManageOrders: boolean;
  canUpdateOrderStatus: boolean;
  canCancelOrders: boolean;
  canCashier: boolean;
}

export interface TenantContext {
  restaurantId: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    isActive: boolean;
    tenantType: TenantType;
  };
  membershipId: string;
  role: RestaurantMemberRole | 'delivery' | string;
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
export function getPermissionsForRole(role: RestaurantMemberRole | 'delivery' | string, canCashier = false): TenantPermissions {
  switch (role) {
    case 'owner':
      return {
        canManageRestaurant: true,
        canManageStaff: true,
        canManageMenu: true,
        canManageTables: true,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: true,
        canCashier: true
      };
    case 'admin':
      return {
        canManageRestaurant: false, // only owner can edit core restaurant identity/ownership
        canManageStaff: true,
        canManageMenu: true,
        canManageTables: true,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: true,
        canCashier: true
      };
    case 'kitchen':
      return {
        canManageRestaurant: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageTables: false,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: false,
        canCashier: Boolean(canCashier)
      };
    case 'delivery':
      return {
        canManageRestaurant: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageTables: false,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: false,
        canCashier: false
      };
    case 'staff':
      return {
        canManageRestaurant: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageTables: false,
        canManageOrders: true,
        canUpdateOrderStatus: true,
        canCancelOrders: false,
        canCashier: Boolean(canCashier)
      };
    default:
      return {
        canManageRestaurant: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageTables: false,
        canManageOrders: false,
        canUpdateOrderStatus: false,
        canCancelOrders: false,
        canCashier: false
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
export function requireTenant(
  allowedRoles?: (RestaurantMemberRole | 'delivery' | string)[],
  allowedTenantTypes?: TenantType | readonly TenantType[]
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Ensure user is authenticated first
    if (!req.user) {
      await new Promise<void>((resolve) => {
        requireAuth(req, res, () => resolve());
      });
      if (res.headersSent) return;
    }

    try {
      // 2. Resolve target restaurant/cinema identifier from explicit context
      let targetRestaurantId =
        (req.headers['x-theatre-id'] as string) ||
        (req.headers['x-tenant-id'] as string) ||
        (req.headers['x-restaurant-id'] as string) ||
        req.params.restaurantId ||
        req.params.theatreId ||
        req.params.tenantId ||
        (req.query.restaurantId as string) ||
        (req.query.theatreId as string) ||
        (req.query.tenantId as string);

      const isCinemaTarget =
        allowedTenantTypes === 'cinema' ||
        (Array.isArray(allowedTenantTypes) && allowedTenantTypes.includes('cinema') && !allowedTenantTypes.includes('restaurant')) ||
        Boolean(req.headers['x-theatre-id']) ||
        Boolean(req.params.theatreId);

      const targetDb = isCinemaTarget ? cinemaDb : restaurantDb;
      const fallbackDb = isCinemaTarget ? restaurantDb : cinemaDb;

      // If tenant ID is not explicitly provided in headers/query/params, automatically resolve
      // the user's primary active membership from their account
      if (!targetRestaurantId || typeof targetRestaurantId !== 'string') {
        const [primaryMembership] = await targetDb
          .select({ restaurantId: restaurantMembers.restaurantId })
          .from(restaurantMembers)
          .where(eq(restaurantMembers.userId, req.user!.id))
          .limit(1)
          .catch(() => []);

        if (primaryMembership?.restaurantId) {
          targetRestaurantId = primaryMembership.restaurantId;
        } else {
          const [fallbackMem] = await fallbackDb
            .select({ restaurantId: restaurantMembers.restaurantId })
            .from(restaurantMembers)
            .where(eq(restaurantMembers.userId, req.user!.id))
            .limit(1)
            .catch(() => []);
          if (fallbackMem?.restaurantId) {
            targetRestaurantId = fallbackMem.restaurantId;
          }
        }
      }

      if (!targetRestaurantId || typeof targetRestaurantId !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing tenant context: specify x-restaurant-id, x-theatre-id, or restaurantId parameter.'
        });
        return;
      }

      // 3. Query database to verify that the user is an authorized member of THIS tenant

      let [membership] = await targetDb
        .select({
          membershipId: restaurantMembers.id,
          role: restaurantMembers.role,
          status: restaurantMembers.status,
          canCashier: restaurantMembers.canCashier,
          restaurant: {
            id: restaurants.id,
            name: restaurants.name,
            slug: restaurants.slug,
            currency: restaurants.currency,
            isActive: restaurants.isActive,
            tenantType: restaurants.tenantType
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
        const [fallbackMembership] = await fallbackDb
          .select({
            membershipId: restaurantMembers.id,
            role: restaurantMembers.role,
            status: restaurantMembers.status,
            canCashier: restaurantMembers.canCashier,
            restaurant: {
              id: restaurants.id,
              name: restaurants.name,
              slug: restaurants.slug,
              currency: restaurants.currency,
              isActive: restaurants.isActive,
              tenantType: restaurants.tenantType
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
        membership = fallbackMembership;
      }

      if (!membership) {
        // IDOR protection: User has NO membership in the requested tenant
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: You are not an authorized member of this tenant.'
        });
        return;
      }

      // Check member active account status (Task 19 Requirement 1 & 4)
      if (membership.status === 'inactive') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Your staff account has been deactivated by an administrator.'
        });
        return;
      }

      if (!membership.restaurant.isActive) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Tenant account is currently inactive.'
        });
        return;
      }

      const tenantType = (membership.restaurant.tenantType || 'restaurant') as TenantType;

      // 4. Validate tenant business type if restricted (prevent cross-module access)
      if (allowedTenantTypes) {
        const allowedTypesList = Array.isArray(allowedTenantTypes)
          ? allowedTenantTypes
          : [allowedTenantTypes];
        if (!allowedTypesList.includes(tenantType)) {
          res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: `Cross-module access denied: Target tenant is a "${tenantType}", but this endpoint requires "${allowedTypesList.join(' or ')}".`
          });
          return;
        }
      }

      const role = membership.role as RestaurantMemberRole | 'delivery';

      // 5. Verify role authorization if required
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}.`
        });
        return;
      }

      // 6. Attach resolved tenant context
      req.tenant = {
        restaurantId: membership.restaurant.id,
        restaurant: {
          ...membership.restaurant,
          tenantType
        },
        membershipId: membership.membershipId,
        role,
        permissions: getPermissionsForRole(role, membership.canCashier)
      };

      req.restaurantId = membership.restaurant.id;
      req.restaurantRole = role as RestaurantMemberRole;

      // Track metered infrastructure usage for any admin mutation (POST, PUT, PATCH, DELETE)
      const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (
        mutatingMethods.includes(req.method) &&
        !req.path.includes('/billing/pay')
      ) {
        res.on('finish', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            trackAdminActionUsage({
              restaurantId: membership.restaurant.id,
              tenantType,
              method: req.method,
              path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
              userEmail: (req.user as any)?.email
            }).catch(() => {});
          }
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Dedicated cinema tenant authorization middleware.
 * Enforces both role checks and tenant_type = 'cinema'.
 */
export function requireCinemaTenant(allowedRoles?: (RestaurantMemberRole | 'delivery' | string)[]) {
  return requireTenant(allowedRoles, 'cinema');
}

/**
 * Dedicated restaurant tenant authorization middleware.
 * Enforces both role checks and tenant_type = 'restaurant'.
 */
export function requireRestaurantTenant(allowedRoles?: RestaurantMemberRole[]) {
  return requireTenant(allowedRoles, 'restaurant');
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

