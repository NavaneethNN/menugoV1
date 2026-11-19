import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function normalizeConnectionString(rawUrl?: string, fallback = 'postgresql://postgres:postgres@localhost:5432/menugo'): string {
  if (!rawUrl) return fallback;
  return rawUrl.replace(/([?&])sslmode=(require|prefer|verify-ca)(&|$)/, '$1sslmode=verify-full$3');
}

const rawRestaurantUrl = process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL;
const rawCinemaUrl = process.env.CINEMA_DATABASE_URL || process.env.DATABASE_URL;

const restaurantConnectionString = normalizeConnectionString(rawRestaurantUrl);
const cinemaConnectionString = normalizeConnectionString(rawCinemaUrl);

const isRestaurantSsl =
  Boolean(rawRestaurantUrl?.includes('sslmode=')) ||
  Boolean(rawRestaurantUrl?.includes('neon.tech')) ||
  process.env.NODE_ENV === 'production';

const isCinemaSsl =
  Boolean(rawCinemaUrl?.includes('sslmode=')) ||
  Boolean(rawCinemaUrl?.includes('neon.tech')) ||
  process.env.NODE_ENV === 'production';

function createPool(connectionString: string, sslRequired: boolean, label: string): Pool {
  const p = new Pool({
    connectionString,
    max: process.env.DB_POOL_MAX
      ? parseInt(process.env.DB_POOL_MAX, 10)
      : process.env.NODE_ENV === 'production'
      ? 10
      : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT
      ? parseInt(process.env.DB_CONNECTION_TIMEOUT, 10)
      : 15000,
    ssl: sslRequired ? { rejectUnauthorized: false } : undefined
  });

  p.on('error', (err) => {
    console.error(`[Neon ${label} Database Pool Error]:`, err?.message || err);
  });

  return p;
}

// Preserve pool and db instances on globalThis across hot reloads and warm serverless lambdas
const globalForDb = globalThis as unknown as {
  restaurantPool?: Pool;
  cinemaPool?: Pool;
  restaurantDb?: NodePgDatabase<typeof schema>;
  cinemaDb?: NodePgDatabase<typeof schema>;
};

export const restaurantPool =
  globalForDb.restaurantPool ||
  createPool(restaurantConnectionString, isRestaurantSsl, 'Restaurant');

export const cinemaPool =
  globalForDb.cinemaPool ||
  createPool(cinemaConnectionString, isCinemaSsl, 'Cinema');

export const restaurantDb = globalForDb.restaurantDb || drizzle(restaurantPool, { schema });
export const cinemaDb = globalForDb.cinemaDb || drizzle(cinemaPool, { schema });

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
  globalForDb.restaurantPool = restaurantPool;
  globalForDb.cinemaPool = cinemaPool;
  globalForDb.restaurantDb = restaurantDb;
  globalForDb.cinemaDb = cinemaDb;
}

// Backward-compatible primary defaults (defaulting to Restaurant DB)
export const pool = restaurantPool;
export const db = restaurantDb;

/**
 * Access database instance dynamically based on tenant type.
 */
export function getDb(type?: 'restaurant' | 'cinema' | string): NodePgDatabase<typeof schema> {
  if (type === 'cinema') {
    return cinemaDb;
  }
  return restaurantDb;
}

/**
 * Access connection pool dynamically based on tenant type.
 */
export function getPool(type?: 'restaurant' | 'cinema' | string): Pool {
  if (type === 'cinema') {
    return cinemaPool;
  }
  return restaurantPool;
}

/**
 * Graceful pool shutdown for both databases.
 */
export async function closePools(): Promise<void> {
  await Promise.allSettled([restaurantPool.end(), cinemaPool.end()]);
}

export type Database = typeof restaurantDb;
export * from './schema';
