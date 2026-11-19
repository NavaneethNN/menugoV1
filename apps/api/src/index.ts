import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';

import { auth, restaurantAuth, cinemaAuth } from './lib/auth';
import { initializeSocket, getIO } from './lib/socket';
import { pool, closePools } from '@menugo/database';
import { errorHandler } from './middleware/error-handler';
import { tenantMiddleware } from './middleware/tenant';
import { authRateLimiter } from './middleware/rate-limiter';

import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import restaurantRoutes from './routes/restaurant.routes';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import tableRoutes from './routes/table.routes';
import orderRoutes from './routes/order.routes';
import uploadRoutes from './routes/upload.routes';
import memberRoutes from './routes/member.routes';
import cashierRoutes from './routes/cashier.routes';
import cinemaRoutes from './routes/cinema.routes';
import { superAdminRouter, getPublicSubscriptionPlans } from './routes/super-admin.routes';
import { subscriptionRouter } from './routes/subscription.routes';
import { restaurantInternalRouter } from './routes/internal/restaurant-internal.routes';
import { cinemaInternalRouter } from './routes/internal/cinema-internal.routes';
import { qrosInternalRouter } from './routes/internal/qros-internal.routes';
import { ensureSuperAdminExists } from './lib/super-admin-seed';
import { syncSubscriptionExpirations } from './lib/subscription-service';
import { syncQrosDatabase } from './lib/qros-sync-service';

import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const server = http.createServer(app);

// In long-running Node.js processes, initialize Socket.io.
// In serverless environments (e.g. Vercel), Socket.io is omitted to preserve statelessness.
if (!process.env.VERCEL) {
  initializeSocket(server);
}

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Delegated to web app edge reverse proxy
  })
);

// Production-ready CORS Configuration
const customTrustedOrigins = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const allowedOriginsList = Array.from(
  new Set([
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.CINEMA_APP_URL,
    process.env.NEXT_PUBLIC_CINEMA_URL,
    process.env.MAIN_APP_URL,
    process.env.NEXT_PUBLIC_MAIN_URL,
    ...customTrustedOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002'
  ].filter((o): o is string => Boolean(o)))
);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, server-to-server health probes)
      if (!requestOrigin) {
        return callback(null, true);
      }

      if (
        allowedOriginsList.includes(requestOrigin) ||
        (process.env.NODE_ENV !== 'production' &&
          (requestOrigin.startsWith('http://localhost:') ||
           requestOrigin.startsWith('http://127.0.0.1:') ||
           /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(requestOrigin))) ||
        (Boolean(process.env.VERCEL) && requestOrigin.endsWith('.vercel.app'))
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin not allowed: ${requestOrigin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-super-admin-key',
      'X-Super-Admin-Key',
      'x-restaurant-id',
      'X-Restaurant-Id',
      'x-theatre-id',
      'X-Theatre-Id',
      'x-tenant-id',
      'X-Tenant-Id',
      'x-tenant-type',
      'X-Tenant-Type',
      'x-table-session-token',
      'X-Table-Session-Token',
      'x-cinema-cart-token',
      'X-Cinema-Cart-Token',
      'x-status-token',
      'X-Status-Token',
      'idempotency-key',
      'Idempotency-Key',
      'x-test-rate-limit',
      'X-Test-Rate-Limit',
      'x-paytm-event-id',
      'x-paytm-signature',
      'x-provider-event-id',
      'x-provider-signature'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After'
    ],
    maxAge: 86400 // Cache preflight requests for 24 hours
  })
);

// Logging Hygiene: Never log sensitive request bodies, headers or tokens in production
if (process.env.NODE_ENV === 'production') {
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      skip: (req) => req.url.startsWith('/api/health') // Avoid cluttering production logs with liveness checks
    })
  );
} else if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Authentication Rate Limiting (applied once across /api/auth mutations)
app.use('/api/auth', authRateLimiter);

// Custom Auth extension routes (e.g. /api/auth/me, /api/auth/staff-login)
app.use('/api/auth', authRoutes);

// Dual Better Auth handlers for Restaurant and Cinema databases
const restaurantAuthHandler = toNodeHandler(restaurantAuth);
const cinemaAuthHandler = toNodeHandler(cinemaAuth);

function resolveAuthHandler(req: express.Request) {
  const isCinema =
    Boolean(req.headers['x-theatre-id']) ||
    req.headers['x-tenant-type'] === 'cinema' ||
    req.headers['origin']?.includes('3001') ||
    req.headers['referer']?.includes('3001') ||
    req.url.startsWith('/api/cinema/auth');

  return isCinema ? cinemaAuthHandler : restaurantAuthHandler;
}

// Dedicated Cinema Auth endpoint
app.all('/api/cinema/auth', (req, res) => cinemaAuthHandler(req, res));
app.all('/api/cinema/auth/*splat', (req, res) => cinemaAuthHandler(req, res));

// Dynamic Better Auth endpoint (Express 5 wildcard routing with tenant origin routing)
app.all('/api/auth', (req, res) => resolveAuthHandler(req)(req, res));
app.all('/api/auth/*splat', (req, res) => resolveAuthHandler(req)(req, res));

// Request Body Parsers: Enforce safe serverless payload limits (10MB maximum)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Tenant Extraction Middleware (checks x-restaurant-id header / param)
app.use(tenantMiddleware);

// Public endpoints
app.get('/api/public/subscription-plans', getPublicSubscriptionPlans);

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurants', memberRoutes);
app.use('/api/members', memberRoutes);
app.use(['/api/categories', '/api/cinema/categories'], categoryRoutes);
app.use(['/api/products', '/api/cinema/products'], productRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cashier', cashierRoutes);
app.use('/api/cinema', cinemaRoutes);
app.use('/api/subscriptions', subscriptionRouter);
app.use('/api/super-admin', superAdminRouter);

// Internal Service-to-Service APIs (Enforcing Application & Database Isolation)
app.use('/api/internal/restaurant', restaurantInternalRouter);
app.use('/api/internal/cinema', cinemaInternalRouter);
app.use('/api/internal/qros', qrosInternalRouter);

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.includes('--test') ||
  process.argv.some((arg) => arg.includes('.test.ts'));

// Graceful shutdown handling for container orchestrators (Kubernetes, ECS, Railway, Render)
function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`\n[SHUTDOWN] Received ${signal}. Initiating graceful shutdown...`);

    // Force exit after 10s timeout to prevent zombie processes
    const forceExitTimer = setTimeout(() => {
      console.error('[SHUTDOWN] Forcing process exit after shutdown timeout.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
      server.close(() => {
        console.log('[SHUTDOWN] HTTP server closed to new requests.');
      });

      const io = getIO();
      if (io) {
        await new Promise<void>((resolve) => io.close(() => resolve()));
        console.log('[WEBSOCKET] WebSocket server connections closed.');
      }

      await closePools();
      console.log('[DATABASE] All database connection pools ended.');

      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Only bind server port in standalone process mode (not inside Vercel serverless functions or tests)
if (!isTestEnv && !process.env.VERCEL) {
  setupGracefulShutdown();

  server.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`[STARTUP] MenuGo API running on http://localhost:${PORT}`);
    console.log(`[WEBSOCKET] WebSocket server active on port ${PORT}`);
    console.log(`[AUTH] Better Auth mounted at /api/auth/*`);
    console.log(`================================================`);

    // Auto-provision initial Super Admin if not already existing
    ensureSuperAdminExists().catch((err) => {
      console.warn('[SUPER ADMIN] Auto-provisioning notice:', err.message || err);
    });

    // Tri-database harmonization & sync (QROS Master DB + Restaurant DB + Cinema DB)
    syncQrosDatabase().catch((err) => {
      console.warn('[QROS DB] Tri-database sync notice:', err.message || err);
    });

    // Initial check of subscription expirations across tenants
    syncSubscriptionExpirations().catch((err) => {
      console.warn('[SUBSCRIPTIONS] Expiration sync notice:', err.message || err);
    });

    // Periodic subscription duration and expiration check (runs every 15 minutes)
    const expiryInterval = setInterval(() => {
      syncSubscriptionExpirations().catch(() => {});
    }, 15 * 60 * 1000);
    expiryInterval.unref(); // Allows process to terminate cleanly without holding event loop
  });
}

export { app, server };
export default app;
