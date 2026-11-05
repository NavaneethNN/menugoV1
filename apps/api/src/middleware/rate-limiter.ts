import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Standard response handler for rate limit violations.
 */
function rateLimitHandler(message: string) {
  return (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message,
      statusCode: 429
    });
  };
}

/**
 * 1. Public Order Creation Rate Limiter
 * Restricts spamming public order submissions from the same IP address.
 * 30 orders per 15 minutes per IP (100 in dev).
 */
export const orderCreationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    if (req.headers['x-test-rate-limit']) return 3;
    if (process.env.NODE_ENV !== 'production') return 100;
    return 30;
  },
  standardHeaders: true, // Return standard `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req: Request) => isTest && !req.headers['x-test-rate-limit'],
  handler: rateLimitHandler('Too many orders created from this IP address. Please wait 15 minutes before placing another order.')
});

/**
 * 2. Public Order Tracking Rate Limiter
 * Prevents automated brute-force attacks against customer status tracking tokens.
 * 60 status checks per minute per IP (150 in dev).
 */
export const orderTrackingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => {
    if (req.headers['x-test-rate-limit']) return 3;
    if (process.env.NODE_ENV !== 'production') return 150;
    return 60;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => isTest && !req.headers['x-test-rate-limit'],
  handler: rateLimitHandler('Too many tracking requests from this IP. Please wait a moment before refreshing.')
});

/**
 * 3. Public Table QR Verification Rate Limiter
 * Prevents scanning brute-force enumeration of table tokens.
 * 60 scans per minute per IP (150 in dev).
 */
export const tableVerificationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => {
    if (req.headers['x-test-rate-limit']) return 3;
    if (process.env.NODE_ENV !== 'production') return 150;
    return 60;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => isTest && !req.headers['x-test-rate-limit'],
  handler: rateLimitHandler('Too many table verification requests. Please wait a moment.')
});

/**
 * 4. Image Upload Presigned URL / Direct Upload Limiter
 * Mitigates storage exhaustion and R2 presigned URL flooding.
 * 40 upload requests per 5 minutes per IP (100 in dev).
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: (req: Request) => {
    if (req.headers['x-test-rate-limit']) return 3;
    if (process.env.NODE_ENV !== 'production') return 100;
    return 40;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => isTest && !req.headers['x-test-rate-limit'],
  handler: rateLimitHandler('Upload rate limit reached. Please wait a few minutes before uploading more images.')
});

/**
 * 5. Authentication Abuse Limiter
 * Protects login and signup endpoints from credential stuffing and automated abuse.
 * Never throttles safe GET/OPTIONS read requests (session checks, user info, CORS preflights).
 * 60 login/signup attempts per 5 minutes per IP in production (200 in development).
 */
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes rolling window
  max: (req: Request) => {
    if (req.headers['x-test-rate-limit']) return 5;
    if (process.env.NODE_ENV !== 'production') return 200;
    return 60; // 60 attempts per 5 minutes per IP
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // 1. Skip during automated test suites unless explicitly testing rate limiter
    if (isTest && !req.headers['x-test-rate-limit']) return true;

    // 2. Never rate limit safe read-only or preflight requests (session checks, restaurant lists, user info, CORS)
    if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
      return true;
    }

    return false;
  },
  handler: rateLimitHandler('Too many authentication attempts from this IP. Please wait a few moments before trying again.')
});

