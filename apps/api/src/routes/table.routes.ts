import { Router, Request, Response } from 'express';
import { db, restaurantTables, restaurants, tableSessions } from '@menugo/database';
import { eq, and, asc, ne, desc } from 'drizzle-orm';
import {
  createTableSchema,
  updateTableSchema,
  generateTableToken,
  buildCustomerTableUrl,
  isValidTableTokenFormat,
  SOCKET_EVENTS
} from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { tableVerificationRateLimiter } from '../middleware/rate-limiter';
import { publishTableEvent } from '../lib/realtime';
import QRCode from 'qrcode';
import crypto from 'crypto';

const router = Router();

// ===========================================================================
// Public Customer Endpoints (No Authentication Required)
// ===========================================================================

/**
 * Public endpoint: Verify a table QR token
 * Resolves the restaurant and active table from the scanned QR token.
 * Validates active status and prevents cross-tenant mismatch.
 */
router.get('/verify/:token', tableVerificationRateLimiter, async (req: Request, res: Response, next) => {
  try {
    const token = req.params.token as string;

    if (!token || !isValidTableTokenFormat(token)) {
      throw new AppError('Invalid table QR token format', 400);
    }

    // Lookup table by cryptographic token
    const [table] = await db
      .select({
        id: restaurantTables.id,
        restaurantId: restaurantTables.restaurantId,
        tableNumber: restaurantTables.tableNumber,
        capacity: restaurantTables.capacity,
        isActive: restaurantTables.isActive
      })
      .from(restaurantTables)
      .where(eq(restaurantTables.tableToken, token))
      .limit(1);

    if (!table) {
      throw new AppError('Invalid or expired table QR token', 404);
    }

    // Lookup restaurant
    const [restaurant] = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        currency: restaurants.currency,
        isActive: restaurants.isActive
      })
      .from(restaurants)
      .where(eq(restaurants.id, table.restaurantId))
      .limit(1);

    if (!restaurant || !restaurant.isActive) {
      throw new AppError('Restaurant not found or is currently inactive', 404);
    }

    // Cross-tenant verification: Ensure table belongs to the requested restaurant slug
    const requestedSlug = (req.query.restaurantSlug || req.query.slug) as string | undefined;
    if (requestedSlug && requestedSlug.trim().toLowerCase() !== restaurant.slug.toLowerCase()) {
      throw new AppError('Table QR token does not belong to this restaurant', 403);
    }

    // Ensure table is active
    if (!table.isActive) {
      throw new AppError('This table is currently disabled or inactive', 400);
    }

    // Session Security: Single active dining party per table
    const clientSessionToken =
      (req.query.sessionToken as string) ||
      (req.headers['x-table-session-token'] as string);

    // Check if table currently has an active session
    const [activeSession] = await db
      .select()
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.tableId, table.id),
          eq(tableSessions.status, 'active')
        )
      )
      .orderBy(desc(tableSessions.openedAt))
      .limit(1);

    if (activeSession) {
      // If the visiting client provides the exact active session token, allow them to view the menu
      if (clientSessionToken && clientSessionToken === activeSession.sessionToken) {
        res.json({
          valid: true,
          isOccupied: true,
          sessionActive: true,
          sessionMatches: true,
          session: {
            id: activeSession.id,
            sessionToken: activeSession.sessionToken,
            status: activeSession.status,
            openedAt: activeSession.openedAt
          },
          table: {
            id: table.id,
            tableNumber: table.tableNumber,
            capacity: table.capacity,
            isActive: table.isActive
          },
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            currency: restaurant.currency
          }
        });
        return;
      }

      // If another device / party attempts to scan the same QR while an active session exists
      res.json({
        valid: true,
        isOccupied: true,
        sessionActive: true,
        sessionMatches: false,
        error: 'TABLE_OCCUPIED',
        message:
          'This table currently has an active dining session. The menu is locked. If you are seated at this table, please ask your waiter or cashier to release the table or open a new session.',
        table: {
          id: table.id,
          tableNumber: table.tableNumber,
          capacity: table.capacity,
          isActive: table.isActive
        },
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          currency: restaurant.currency
        }
      });
      return;
    }

    // No active session exists -> create a fresh session for the table
    const newSessionToken = crypto.randomBytes(32).toString('hex');
    const [newSession] = await db
      .insert(tableSessions)
      .values({
        id: crypto.randomUUID(),
        restaurantId: restaurant.id,
        tableId: table.id,
        sessionToken: newSessionToken,
        status: 'active',
        deviceFingerprint: (req.headers['user-agent'] as string) || null
      })
      .returning();

    if (!newSession) {
      throw new AppError('Failed to initialize table session', 500);
    }

    // Real-time broadcast: table session started
    publishTableEvent(restaurant.id, SOCKET_EVENTS.TABLE_SESSION_STARTED, {
      tableId: table.id,
      tableNumber: table.tableNumber,
      sessionId: newSession.id,
      openedAt: newSession.openedAt
    }).catch(() => {});

    res.json({
      valid: true,
      isOccupied: false,
      sessionActive: true,
      sessionMatches: true,
      session: {
        id: newSession.id,
        sessionToken: newSession.sessionToken,
        status: newSession.status,
        openedAt: newSession.openedAt
      },
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        isActive: table.isActive
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        currency: restaurant.currency
      }
    });
  } catch (error) {
    next(error);
  }
});

// Alias for public verification
router.get('/public/verify/:token', (req, res, next) => {
  res.redirect(307, `/api/tables/verify/${req.params.token}`);
});

// ===========================================================================
// Authenticated Table Management (Tenant-Scoped)
// ===========================================================================
router.use(requireAuth);
router.use(requireTenant(['owner', 'admin', 'staff', 'kitchen']));

// List all tables for the active restaurant
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const restaurantId = req.tenant!.restaurantId;

    const tables = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.restaurantId, restaurantId))
      .orderBy(asc(restaurantTables.tableNumber));

    res.json(tables);
  } catch (error) {
    next(error);
  }
});

// Create new table with cryptographic unguessable QR token (owner or admin only)
router.post('/', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageTables) {
      throw new AppError('Forbidden: Only owner or admin can manage tables', 403);
    }

    const validatedData = createTableSchema.parse({
      ...req.body,
      restaurantId: req.tenant!.restaurantId
    });

    // Check for duplicate table number within the same restaurant
    const [existing] = await db
      .select({ id: restaurantTables.id })
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.restaurantId, req.tenant!.restaurantId),
          eq(restaurantTables.tableNumber, validatedData.tableNumber)
        )
      )
      .limit(1);

    if (existing) {
      throw new AppError('Table with this number/name already exists in this restaurant', 409);
    }

    const restaurant = req.tenant!.restaurant;
    const tableId = crypto.randomUUID();
    // 24 cryptographically secure random bytes (192 bits of entropy)
    const tableToken = generateTableToken(24);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetUrl = buildCustomerTableUrl(appUrl, restaurant.slug, tableToken);

    // High-resolution QR code data URL (PNG Base64)
    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    const [table] = await db
      .insert(restaurantTables)
      .values({
        id: tableId,
        restaurantId: req.tenant!.restaurantId,
        tableNumber: validatedData.tableNumber,
        tableToken,
        capacity: validatedData.capacity,
        isActive: validatedData.isActive,
        qrCodeUrl: targetUrl,
        qrCodeData: qrCodeDataUrl
      })
      .returning();

    res.status(201).json(table);
  } catch (error: any) {
    if (error?.code === '23505') {
      next(new AppError('Table with this number/name already exists in this restaurant', 409));
      return;
    }
    next(error);
  }
});

// Rotate / revoke QR token for a table (owner or admin only, strictly scoped by restaurantId)
router.post('/:id/rotate-token', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageTables) {
      throw new AppError('Forbidden: Only owner or admin can manage tables', 403);
    }

    const tableId = req.params.id as string;

    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .limit(1);

    if (!table) {
      throw new AppError('Table not found or does not belong to this restaurant', 404);
    }

    const restaurant = req.tenant!.restaurant;
    const newTableToken = generateTableToken(24);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetUrl = buildCustomerTableUrl(appUrl, restaurant.slug, newTableToken);

    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    const [updated] = await db
      .update(restaurantTables)
      .set({
        tableToken: newTableToken,
        qrCodeUrl: targetUrl,
        qrCodeData: qrCodeDataUrl,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.restaurantId, req.tenant!.restaurantId)
        )
      )
      .returning();

    res.json({
      message:
        'QR code token rotated successfully. Previously printed QR codes for this table have been revoked and will no longer work.',
      table: updated
    });
  } catch (error) {
    next(error);
  }
});

// Alias for rotate-token
router.post('/:id/regenerate-qr', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageTables) {
      throw new AppError('Forbidden: Only owner or admin can manage tables', 403);
    }

    const tableId = req.params.id as string;

    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.restaurantId, req.tenant!.restaurantId)
        )
      )
      .limit(1);

    if (!table) {
      throw new AppError('Table not found or does not belong to this restaurant', 404);
    }

    const restaurant = req.tenant!.restaurant;
    const newTableToken = generateTableToken(24);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetUrl = buildCustomerTableUrl(appUrl, restaurant.slug, newTableToken);

    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512
    });

    const [updated] = await db
      .update(restaurantTables)
      .set({
        tableToken: newTableToken,
        qrCodeUrl: targetUrl,
        qrCodeData: qrCodeDataUrl,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.restaurantId, req.tenant!.restaurantId)
        )
      )
      .returning();

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Update table details (rename, adjust capacity, toggle active status)
router.patch('/:id', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageTables) {
      throw new AppError('Forbidden: Only owner or admin can manage tables', 403);
    }

    const tableId = req.params.id as string;
    const validatedData = updateTableSchema.parse(req.body);

    // If tableNumber is changing, verify no collision within this restaurant
    if (validatedData.tableNumber) {
      const [duplicate] = await db
        .select({ id: restaurantTables.id })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.restaurantId, req.tenant!.restaurantId),
            eq(restaurantTables.tableNumber, validatedData.tableNumber),
            ne(restaurantTables.id, tableId)
          )
        )
        .limit(1);

      if (duplicate) {
        throw new AppError('Table with this number/name already exists in this restaurant', 409);
      }
    }

    const [table] = await db
      .update(restaurantTables)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .returning();

    if (!table) {
      throw new AppError('Table not found or does not belong to this restaurant', 404);
    }

    res.json(table);
  } catch (error: any) {
    if (error?.code === '23505') {
      next(new AppError('Table with this number/name already exists in this restaurant', 409));
      return;
    }
    next(error);
  }
});

// Delete table (owner or admin only, strictly scoped by restaurantId)
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageTables) {
      throw new AppError('Forbidden: Only owner or admin can manage tables', 403);
    }

    const tableId = req.params.id as string;

    const [deleted] = await db
      .delete(restaurantTables)
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .returning();

    if (!deleted) {
      throw new AppError('Table not found or does not belong to this restaurant', 404);
    }

    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
