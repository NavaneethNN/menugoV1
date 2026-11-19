import { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/auth';
import { AuthenticatedUser } from './auth';

/**
 * Super Admin authorization middleware.
 * Verifies that the requester has administrative platform rights via:
 * 1. An emergency/service master admin key in headers (X-Super-Admin-Key), OR
 * 2. An authenticated user session with role === 'super_admin', OR
 * 3. An authenticated user whose email is listed in SUPER_ADMIN_EMAILS env variable.
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const configuredKey = process.env.SUPER_ADMIN_KEY || 'menugo-superadmin-secret-2026';
    const providedKey = req.headers['x-super-admin-key'] as string;

    // Check 1: Master Admin Key bypass
    if (providedKey && providedKey === configuredKey) {
      req.user = {
        id: 'super-admin-master',
        name: 'Master Platform Admin',
        email: 'superadmin@menugo.in',
        role: 'super_admin',
        tenantType: 'platform',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return next();
    }

    // Check 2: Better Auth Session
    const sessionData = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!sessionData || !sessionData.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Super admin authentication required. Please sign in.'
      });
      return;
    }

    const user = sessionData.user as any;
    const userRole = (user.role || '').toLowerCase();
    const userEmail = (user.email || '').toLowerCase();

    // Check 3: Role is 'super_admin' or 'superadmin'
    if (userRole === 'super_admin' || userRole === 'superadmin') {
      req.user = user as AuthenticatedUser;
      req.session = sessionData.session;
      return next();
    }

    // Check 4: Email is listed in SUPER_ADMIN_EMAILS
    const adminEmails = (process.env.SUPER_ADMIN_EMAILS || 'admin@menugo.in,navaneeth@menugo.in')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.includes(userEmail)) {
      req.user = user as AuthenticatedUser;
      req.session = sessionData.session;
      return next();
    }

    res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied. Super administrator privileges required.'
    });
  } catch (error: any) {
    console.error('[Super Admin Auth] Verification failed:', error?.message || error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify administrative authorization.'
    });
  }
}
