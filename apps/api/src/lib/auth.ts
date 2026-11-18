import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, user, session, account, verification } from '@menugo/database';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const secret =
  process.env.BETTER_AUTH_SECRET ||
  'default-development-secret-key-32-chars-long-menugo';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.BETTER_AUTH_SECRET || secret.includes('default-development-secret'))) {
  throw new Error('FATAL: BETTER_AUTH_SECRET must be set to a secure 32+ character random secret in production!');
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
    process.env.CINEMA_APP_URL,
    process.env.NEXT_PUBLIC_CINEMA_URL,
    ...customTrustedOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5001',
    'http://127.0.0.1:5001'
  ].filter((o): o is string => Boolean(o)))
);

const cookieSameSite = (process.env.AUTH_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ||
  (isProduction && !process.env.AUTH_COOKIE_DOMAIN ? 'none' : 'lax');
const useSecureCookies = isProduction || cookieSameSite === 'none';

export const auth = betterAuth({
  secret,
  baseURL: apiUrl,
  basePath: '/api/auth',
  user: {
    additionalFields: {
      tenantType: {
        type: 'string',
        defaultValue: 'restaurant',
        input: true
      }
    }
  },
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
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || '',
      enabled: Boolean(
        (process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID) &&
        (process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET)
      )
    }
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
    useSecureCookies,
    defaultCookieAttributes: {
      sameSite: cookieSameSite,
      secure: useSecureCookies,
      httpOnly: true,
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      path: '/'
    }
  }
});
