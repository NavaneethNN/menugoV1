import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client';
import path from 'path';

/**
 * Safe, idempotent migration runner for Neon PostgreSQL.
 * Reads SQL migration files from drizzle/migrations and applies any pending migrations.
 *
 * NOTE: As per MenuGo production guidelines, this should be executed during maintenance
 * windows or CI/CD deployment pipelines, NEVER arbitrarily against production databases.
 */
export async function applyMigrations(): Promise<void> {
  console.log('================================================');
  console.log('[MIGRATION] MenuGo Safe Database Migration Runner');
  console.log('================================================');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required.');
  }

  const migrationsFolder = path.resolve(__dirname, '../drizzle/migrations');
  console.log(`[DIR] Loading migrations from: ${migrationsFolder}`);

  try {
    // 1. Verify connection
    const client = await pool.connect();
    console.log('[DB] Connection to Neon PostgreSQL established successfully.');
    client.release();

    // 2. Execute pending migrations within transaction
    console.log('[MIGRATE] Applying pending schema migrations...');
    await migrate(db, { migrationsFolder });
    console.log('[SUCCESS] All migrations applied successfully!');
  } catch (error: any) {
    console.error('[ERROR] Migration failed:', error?.message || error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  applyMigrations();
}

