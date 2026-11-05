import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === 'production') {
  console.warn('DATABASE_URL environment variable is not set.');
}

// Preserve pool instance on globalThis across hot reloads and warm serverless lambdas
const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
};

export const pool =
  globalForDb.pool ||
  new Pool({
    connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/menugo',
    max: process.env.DB_POOL_MAX
      ? parseInt(process.env.DB_POOL_MAX, 10)
      : process.env.NODE_ENV === 'production'
      ? 10
      : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT
      ? parseInt(process.env.DB_CONNECTION_TIMEOUT, 10)
      : 15000,
    ssl:
      connectionString?.includes('sslmode=') || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined
  });

pool.on('error', (err) => {
  // Prevent unhandled rejection crashes from background pool disconnects
  console.error('[Neon Database Pool Error]:', err?.message || err);
});

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
  globalForDb.pool = pool;
}

export const db = globalForDb.db || drizzle(pool, { schema });

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
  globalForDb.db = db;
}

export type Database = typeof db;
export * from './schema';
