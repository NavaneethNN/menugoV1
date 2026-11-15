import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';

import { auth } from './lib/auth';
import { initializeSocket, getIO } from './lib/socket';
import { pool } from '@menugo/database';
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
    ...customTrustedOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
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
        (process.env.NODE_ENV !== 'production' && requestOrigin.startsWith('http://localhost:')) ||
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
      'x-restaurant-id',
      'x-theatre-id',
      'x-tenant-id',
      'x-table-session-token',
      'X-Table-Session-Token',
      'idempotency-key',
      'Idempotency-Key',
      'x-test-rate-limit'
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

// Better Auth endpoint (Express 5 wildcard routing)
app.all('/api/auth', toNodeHandler(auth));
app.all('/api/auth/*splat', toNodeHandler(auth));

// Request Body Parsers: Enforce safe serverless payload limits (10MB maximum)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Tenant Extraction Middleware (checks x-restaurant-id header / param)
app.use(tenantMiddleware);

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurants', memberRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cashier', cashierRoutes);
app.use('/api/cinema', cinemaRoutes);

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
    console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);

    // Force exit after 10s timeout to prevent zombie processes
    const forceExitTimer = setTimeout(() => {
      console.error('⚠️ Forcing process exit after shutdown timeout.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
      server.close(() => {
        console.log('🔒 HTTP server closed to new requests.');
      });

      const io = getIO();
      if (io) {
        await new Promise<void>((resolve) => io.close(() => resolve()));
        console.log('⚡ WebSocket server connections closed.');
      }

      await pool.end();
      console.log('🐘 Database connection pool ended.');

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
    console.log(`🚀 MenuGo API running on http://localhost:${PORT}`);
    console.log(`⚡ WebSocket server active on port ${PORT}`);
    console.log(`🔐 Better Auth mounted at /api/auth/*`);
    console.log(`================================================`);
  });
}

export { app, server };
export default app;
