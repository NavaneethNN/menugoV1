import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, user, session, account, verification } from '@menugo/database';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const secret =
  process.env.BETTER_AUTH_SECRET ||
  'default-development-secret-key-32-chars-long-menugo';

if (process.env.NODE_ENV === 'production' && secret.includes('default-development-secret')) {
  console.error('FATAL: BETTER_AUTH_SECRET must be set to a secure 32+ character random secret in production!');
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const apiUrl = process.env.BETTER_AUTH_URL || process.env.API_URL || 'http://localhost:5001';

// Parse additional trusted origins from environment (comma-separated)
const customTrustedOrigins = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const trustedOrigins = Array.from(
  new Set([
    appUrl,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...customTrustedOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5001',
    'http://127.0.0.1:5001'
  ].filter((o): o is string => Boolean(o)))
);

const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite = (process.env.AUTH_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ||
  (isProduction && !process.env.AUTH_COOKIE_DOMAIN ? 'none' : 'lax');

export const auth = betterAuth({
  secret,
  baseURL: apiUrl,
  basePath: '/api/auth',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification
    }
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 4,
    maxPasswordLength: 128
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24 // 1 day
  },
  rateLimit: {
    enabled: false // Handled cleanly & consistently at the Express API gateway by authRateLimiter
  },
  trustedOrigins,
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      sameSite: cookieSameSite,
      secure: isProduction,
      httpOnly: true,
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      path: '/'
    }
  }
});
