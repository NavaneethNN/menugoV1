import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight tenant context extractor.
 * Reads the explicit x-restaurant-id header if supplied by the client
 * and assigns it to req.restaurantId for downstream middleware.
 * Verification of ownership and membership is handled strictly by requireTenant.
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const headerId = req.headers['x-restaurant-id'];
  if (typeof headerId === 'string' && headerId.trim()) {
    req.restaurantId = headerId.trim();
  }
  next();
}

