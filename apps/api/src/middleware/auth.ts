import { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/auth';
import { db, restaurantMembers } from '@menugo/database';
import { and, eq } from 'drizzle-orm';
import { RestaurantMemberRole } from '@menugo/shared';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: any;
      restaurantRole?: RestaurantMemberRole;
      restaurantId?: string;
    }
  }
}

/**
 * Ensures the incoming request carries a valid, non-expired Better Auth session.
 * Rejects unauthenticated requests with a consistent 401 Unauthorized status.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionData = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!sessionData || !sessionData.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Session is missing, invalid or expired.'
      });
      return;
    }

    // Sanitize user: ensure no secret fields leak
    const { password, ...safeUser } = (sessionData.user as any);
    req.user = safeUser as AuthenticatedUser;
    req.session = sessionData.session;

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Session verification error:', error?.message || error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed. Invalid session.'
    });
  }
}

/**
 * Authorizes that the verified user is an active member of the target restaurant
 * and holds one of the permitted roles. Never trusts client-supplied roles.
 */
export function requireRestaurantMember(allowedRoles?: RestaurantMemberRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Must have passed requireAuth or have req.user populated
      if (!req.user || !req.user.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required. Please sign in.'
        });
        return;
      }

      // Determine restaurant ID from trusted route context or standard header
      const restaurantId =
        req.restaurantId ||
        (req.headers['x-restaurant-id'] as string) ||
        req.params.restaurantId ||
        (req.query.restaurantId as string);

      if (!restaurantId || typeof restaurantId !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Restaurant ID context is required for this operation.'
        });
        return;
      }

      req.restaurantId = restaurantId;

      // Query database for user's verified membership & role in this restaurant
      const [member] = await db
        .select({
          id: restaurantMembers.id,
          role: restaurantMembers.role
        })
        .from(restaurantMembers)
        .where(
          and(
            eq(restaurantMembers.restaurantId, restaurantId),
            eq(restaurantMembers.userId, req.user.id)
          )
        )
        .limit(1);

      if (!member) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: You are not an authorized member of this restaurant.'
        });
        return;
      }

      const role = member.role as RestaurantMemberRole;
      req.restaurantRole = role;

      // If specific roles are required, verify against the verified database role
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions. This operation requires one of: ${allowedRoles.join(', ')}.`
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
