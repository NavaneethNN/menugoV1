import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString && process.env.NODE_ENV === 'production') {
  console.warn('DATABASE_URL environment variable is not set.');
}

// Normalize SSL mode parameter to suppress pg-connection-string v3 compatibility warning
const connectionString = rawConnectionString
  ? rawConnectionString.replace(/([?&])sslmode=(require|prefer|verify-ca)(&|$)/, '$1sslmode=verify-full$3')
  : 'postgresql://postgres:postgres@localhost:5432/menugo';

// Preserve pool instance on globalThis across hot reloads and warm serverless lambdas
const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
};

const isSslRequired =
  Boolean(rawConnectionString?.includes('sslmode=')) ||
  Boolean(rawConnectionString?.includes('neon.tech')) ||
  process.env.NODE_ENV === 'production';

export const pool =
  globalForDb.pool ||
  new Pool({
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
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined
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
