import { Router, Request, Response } from 'express';
import { db } from '@menugo/database';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Liveness probe: Confirms that the API server process is alive and accepting HTTP traffic.
 * Does not depend on external services to avoid cascading restart loops.
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'live',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '1.0.0'
  });
});

/**
 * Readiness probe: Verifies that downstream dependencies (e.g. Neon PostgreSQL database)
 * are healthy and ready to serve traffic.
 * Returns 200 if ready, 503 if downstream dependencies are unreachable.
 * NEVER leaks connection strings, hostnames, passwords, or raw driver errors.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (err: any) {
    // Log the error internally for operators, but never expose driver internals to callers
    console.error('[Health Check Failure] Database ping failed:', err?.message || err);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

/**
 * General health endpoint: Backward-compatible summary for monitoring and dashboard checks.
 */
router.get('/', async (_req: Request, res: Response) => {
  let isDatabaseConnected = false;

  try {
    await db.execute(sql`SELECT 1`);
    isDatabaseConnected = true;
  } catch (err: any) {
    console.error('[Health Check] Database connectivity check failed:', err?.message || err);
  }

  const statusCode = isDatabaseConnected ? 200 : 503;

  res.status(statusCode).json({
    status: isDatabaseConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: isDatabaseConnected ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

export default router;
