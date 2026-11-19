import { Request, Response, NextFunction } from 'express';
import { timingSafeMatch } from '../lib/encryption';

/**
 * Middleware ensuring that internal cross-domain communications
 * are authorized with a shared service key or Super Admin credentials.
 * 
 * Headers accepted:
 * - x-internal-service-key
 * - x-super-admin-key
 * - Authorization: Bearer <super-admin-key>
 */
export function requireInternalService(req: Request, res: Response, next: NextFunction): void {
  const serviceKeyHeader =
    (req.headers['x-internal-service-key'] as string) ||
    (req.headers['x-super-admin-key'] as string) ||
    (req.headers['X-Internal-Service-Key'] as string) ||
    (req.headers['X-Super-Admin-Key'] as string);

  const bearerHeader = req.headers.authorization;
  const bearerToken = bearerHeader?.startsWith('Bearer ')
    ? bearerHeader.substring(7).trim()
    : null;

  const providedKey = (serviceKeyHeader || bearerToken || '').trim();

  const isProduction = process.env.NODE_ENV === 'production';
  const validKeys = [
    process.env.INTERNAL_SERVICE_KEY,
    process.env.SUPER_ADMIN_KEY,
    process.env.SUPER_ADMIN_MASTER_KEY,
    !isProduction ? 'qros-internal-service-secret-2026' : null,
    !isProduction ? 'menugo-superadmin-secret-2026' : null
  ].filter((k): k is string => Boolean(k?.trim()));

  if (providedKey) {
    for (const validKey of validKeys) {
      if (timingSafeMatch(providedKey, validKey)) {
        return next();
      }
    }
  }

  // Also allow authenticated super admin sessions
  if ((req as any).user?.role === 'super_admin' || (req as any).user?.role === 'superadmin') {
    return next();
  }

  res.status(403).json({
    error: 'Forbidden',
    message: 'Access Denied: Invalid or missing internal service authorization key.'
  });
}
