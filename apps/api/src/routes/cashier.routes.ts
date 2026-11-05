import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  restaurantTables,
  restaurants,
  tableSessions,
  orders,
  orderItems,
  user
} from '@menugo/database';
import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import {
  SOCKET_EVENTS,
  formatPaise,
  closeTableSessionSchema,
  openTableSessionSchema
} from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant, requireTenantPermission } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { publishTableEvent } from '../lib/realtime';
import crypto from 'crypto';

const router = Router();

// Centralized Cashier Authorization:
// Caller must be an authenticated member of this restaurant with canCashier permission.
router.use(requireAuth);
router.use(requireTenant());
router.use(requireTenantPermission('canCashier'));

// ===========================================================================
// 1. Get Cashier Overview: All Tables with Live Session Status & Orders
// ===========================================================================
router.get('/tables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurantId = req.tenant!.restaurantId;
    const currency = req.tenant!.restaurant.currency || 'INR';

    // 1. Fetch all restaurant tables
    const tables = await db
      .select({
        id: restaurantTables.id,
        tableNumber: restaurantTables.tableNumber,
        capacity: restaurantTables.capacity,
        isActive: restaurantTables.isActive,
        qrCodeUrl: restaurantTables.qrCodeUrl,
        createdAt: restaurantTables.createdAt
      })
      .from(restaurantTables)
      .where(eq(restaurantTables.restaurantId, restaurantId))
      .orderBy(asc(restaurantTables.tableNumber));

    if (tables.length === 0) {
      res.json({
        tables: [],
        summary: {
          totalTables: 0,
          occupiedCount: 0,
          availableCount: 0,
          totalActiveRevenuePaise: 0,
          totalActiveRevenueFormatted: formatPaise(0, currency),
          activeOrdersCount: 0
        }
      });
      return;
    }

    // 2. Fetch all currently active sessions in this restaurant
    const activeSessions = await db
      .select()
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.restaurantId, restaurantId),
          eq(tableSessions.status, 'active')
        )
      )
      .orderBy(desc(tableSessions.openedAt));

    // Map active session by tableId (most recent active session wins)
    const sessionByTableId = new Map<string, typeof tableSessions.$inferSelect>();
    activeSessions.forEach((s) => {
      if (!sessionByTableId.has(s.tableId)) {
        sessionByTableId.set(s.tableId, s);
      }
    });

    // 3. Fetch active orders for these active sessions
    const activeSessionIds = Array.from(sessionByTableId.values()).map((s) => s.id);
    let sessionOrders: (typeof orders.$inferSelect)[] = [];

    if (activeSessionIds.length > 0) {
      sessionOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            inArray(orders.tableSessionId, activeSessionIds)
          )
        )
        .orderBy(desc(orders.createdAt));
    }

    // Group orders by tableSessionId
    const ordersBySessionId = new Map<string, (typeof orders.$inferSelect)[]>();
    sessionOrders.forEach((o) => {
      if (o.tableSessionId) {
        const list = ordersBySessionId.get(o.tableSessionId) || [];
        list.push(o);
        ordersBySessionId.set(o.tableSessionId, list);
      }
    });

    // 4. Build enriched tables list
    let grandRevenuePaise = 0;
    let totalActiveOrders = 0;
    let occupiedTablesCount = 0;

    const enrichedTables = tables.map((t) => {
      const session = sessionByTableId.get(t.id);

      if (!session) {
        return {
          id: t.id,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          isActive: t.isActive,
          status: 'available' as const,
          qrCodeUrl: t.qrCodeUrl,
          activeSession: null
        };
      }

      occupiedTablesCount++;
      const tableOrders = ordersBySessionId.get(session.id) || [];
      totalActiveOrders += tableOrders.length;

      // Calculate total billed amount for active non-cancelled orders
      const sessionTotalPaise = tableOrders
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      grandRevenuePaise += sessionTotalPaise;

      // Count order states
      const unservedCount = tableOrders.filter(
        (o) => o.status !== 'served' && o.status !== 'cancelled'
      ).length;

      const durationMinutes = Math.max(
        0,
        Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 60000)
      );

      return {
        id: t.id,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        isActive: t.isActive,
        status: 'occupied' as const,
        qrCodeUrl: t.qrCodeUrl,
        activeSession: {
          id: session.id,
          sessionToken: session.sessionToken,
          status: session.status,
          customerName: session.customerName,
          customerPhone: session.customerPhone,
          openedAt: session.openedAt,
          durationMinutes,
          orderCount: tableOrders.length,
          unservedCount,
          totalPaise: sessionTotalPaise,
          totalFormatted: formatPaise(sessionTotalPaise, currency),
          orders: tableOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            totalAmount: o.totalAmount,
            totalFormatted: formatPaise(o.totalAmount, currency),
            createdAt: o.createdAt
          }))
        }
      };
    });

    res.json({
      tables: enrichedTables,
      summary: {
        totalTables: tables.length,
        occupiedCount: occupiedTablesCount,
        availableCount: tables.length - occupiedTablesCount,
        totalActiveRevenuePaise: grandRevenuePaise,
        totalActiveRevenueFormatted: formatPaise(grandRevenuePaise, currency),
        activeOrdersCount: totalActiveOrders
      }
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================================================
// 2. Close Table Session & Release Table (Cashier Permission Required)
// ===========================================================================
router.post(
  '/tables/:tableId/close-session',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const tableId = req.params.tableId as string;
      const { reason } = closeTableSessionSchema.parse(req.body || {});

      // 1. Verify table exists in this restaurant (IDOR check)
      const [table] = await db
        .select({
          id: restaurantTables.id,
          tableNumber: restaurantTables.tableNumber,
          restaurantId: restaurantTables.restaurantId
        })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.id, tableId),
            eq(restaurantTables.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!table) {
        throw new AppError('Table not found or does not belong to this restaurant', 404);
      }

      // 2. Locate active session for this table
      const [activeSession] = await db
        .select()
        .from(tableSessions)
        .where(
          and(
            eq(tableSessions.tableId, tableId),
            eq(tableSessions.status, 'active')
          )
        )
        .orderBy(desc(tableSessions.openedAt))
        .limit(1);

      if (!activeSession) {
        throw new AppError(`Table ${table.tableNumber} does not have an active dining session.`, 400);
      }

      // 3. Close the session atomically
      const now = new Date();
      const [closedSession] = await db
        .update(tableSessions)
        .set({
          status: 'closed',
          closedAt: now,
          closedByUserId: req.user!.id,
          updatedAt: now
        })
        .where(eq(tableSessions.id, activeSession.id))
        .returning();

      if (!closedSession) {
        throw new AppError('Failed to close table session', 500);
      }

      // 4. Real-time broadcast to Restaurant & Cashier
      publishTableEvent(restaurantId, SOCKET_EVENTS.TABLE_SESSION_CLOSED, {
        tableId: table.id,
        tableNumber: table.tableNumber,
        sessionId: closedSession.id,
        closedAt: now
      }).catch(() => {});

      publishTableEvent(restaurantId, SOCKET_EVENTS.TABLE_UPDATED, {
        tableId: table.id,
        tableNumber: table.tableNumber,
        status: 'available'
      }).catch(() => {});

      res.json({
        success: true,
        message: `Dining session for Table ${table.tableNumber} closed successfully. Table is now available for new guests.`,
        session: closedSession
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// 3. Manually Open Table Session (Walk-in Seating)
// ===========================================================================
router.post(
  '/tables/:tableId/open-session',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const tableId = req.params.tableId as string;
      const { customerName, customerPhone } = openTableSessionSchema.parse(req.body || {});

      // 1. Verify table exists in this restaurant
      const [table] = await db
        .select({
          id: restaurantTables.id,
          tableNumber: restaurantTables.tableNumber,
          restaurantId: restaurantTables.restaurantId,
          isActive: restaurantTables.isActive
        })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.id, tableId),
            eq(restaurantTables.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!table) {
        throw new AppError('Table not found or does not belong to this restaurant', 404);
      }

      if (!table.isActive) {
        throw new AppError('Cannot open session: Table is currently inactive or disabled', 400);
      }

      // 2. Check if active session already exists
      const [existingActive] = await db
        .select()
        .from(tableSessions)
        .where(
          and(
            eq(tableSessions.tableId, tableId),
            eq(tableSessions.status, 'active')
          )
        )
        .limit(1);

      if (existingActive) {
        res.status(200).json({
          message: `Table ${table.tableNumber} already has an active session`,
          session: existingActive
        });
        return;
      }

      // 3. Create fresh active session
      const newSessionToken = crypto.randomBytes(32).toString('hex');
      const [newSession] = await db
        .insert(tableSessions)
        .values({
          id: crypto.randomUUID(),
          restaurantId,
          tableId,
          sessionToken: newSessionToken,
          status: 'active',
          customerName: customerName || null,
          customerPhone: customerPhone || null
        })
        .returning();

      if (!newSession) {
        throw new AppError('Failed to open table session', 500);
      }

      // 4. Real-time broadcast
      publishTableEvent(restaurantId, SOCKET_EVENTS.TABLE_SESSION_STARTED, {
        tableId: table.id,
        tableNumber: table.tableNumber,
        sessionId: newSession.id,
        openedAt: newSession.openedAt
      }).catch(() => {});

      publishTableEvent(restaurantId, SOCKET_EVENTS.TABLE_UPDATED, {
        tableId: table.id,
        tableNumber: table.tableNumber,
        status: 'occupied'
      }).catch(() => {});

      res.status(201).json({
        success: true,
        message: `Dining session opened for Table ${table.tableNumber}.`,
        session: newSession
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// 4. Detailed Bill Statement for Active Table Session
// ===========================================================================
router.get(
  '/tables/:tableId/bill',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const tableId = req.params.tableId as string;
      const currency = req.tenant!.restaurant.currency || 'INR';

      // 1. Verify table
      const [table] = await db
        .select({
          id: restaurantTables.id,
          tableNumber: restaurantTables.tableNumber,
          capacity: restaurantTables.capacity
        })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.id, tableId),
            eq(restaurantTables.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!table) {
        throw new AppError('Table not found or does not belong to this restaurant', 404);
      }

      // 2. Fetch active session
      const [activeSession] = await db
        .select()
        .from(tableSessions)
        .where(
          and(
            eq(tableSessions.tableId, tableId),
            eq(tableSessions.status, 'active')
          )
        )
        .orderBy(desc(tableSessions.openedAt))
        .limit(1);

      if (!activeSession) {
        throw new AppError(`No active dining session found for Table ${table.tableNumber}.`, 404);
      }

      // 3. Fetch all orders for this session
      const sessionOrdersList = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            eq(orders.tableSessionId, activeSession.id)
          )
        )
        .orderBy(asc(orders.createdAt));

      // 4. Fetch all line items for these orders
      const orderIds = sessionOrdersList.map((o) => o.id);
      let itemsList: (typeof orderItems.$inferSelect)[] = [];

      if (orderIds.length > 0) {
        itemsList = await db
          .select()
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
          .orderBy(asc(orderItems.createdAt));
      }

      const totalPaise = sessionOrdersList
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const durationMinutes = Math.max(
        0,
        Math.floor((Date.now() - new Date(activeSession.openedAt).getTime()) / 60000)
      );

      res.json({
        restaurant: {
          id: req.tenant!.restaurant.id,
          name: req.tenant!.restaurant.name,
          currency
        },
        table: {
          id: table.id,
          tableNumber: table.tableNumber,
          capacity: table.capacity
        },
        session: {
          id: activeSession.id,
          openedAt: activeSession.openedAt,
          durationMinutes,
          customerName: activeSession.customerName,
          customerPhone: activeSession.customerPhone
        },
        orders: sessionOrdersList.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          totalPaise: o.totalAmount,
          totalFormatted: formatPaise(o.totalAmount, currency),
          createdAt: o.createdAt,
          items: itemsList
            .filter((item) => item.orderId === o.id)
            .map((item) => ({
              id: item.id,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitPriceFormatted: formatPaise(item.unitPrice, currency),
              subtotal: item.subtotal,
              subtotalFormatted: formatPaise(item.subtotal, currency),
              notes: item.notes
            }))
        })),
        grandTotalPaise: totalPaise,
        grandTotalFormatted: formatPaise(totalPaise, currency)
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
