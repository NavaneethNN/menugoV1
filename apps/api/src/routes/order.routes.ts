import { Router, Request, Response } from 'express';
import { db, orders, orderItems, products, restaurantTables, restaurants, orderStatusHistory, tableSessions } from '@menugo/database';
import { eq, and, or, desc, inArray, gte, lte, count, ilike } from 'drizzle-orm';
import { createOrderSchema, updateOrderStatusSchema, OrderStatus, validateStatusTransition } from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { orderCreationRateLimiter, orderTrackingRateLimiter } from '../middleware/rate-limiter';
import { publishOrderCreated, publishOrderUpdated } from '../lib/realtime';
import crypto from 'crypto';

const router = Router();

// Helper to generate a unique human-friendly order number within restaurant scope
async function generateUniqueOrderNumber(tx: any, restaurantId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${Math.floor(1000 + Math.random() * 9000)}`;
    const [existing] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          eq(orders.orderNumber, candidate)
        )
      )
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }
  return `${Math.floor(10000 + Math.random() * 90000)}`;
}

// ---------------------------------------------------------------------------
// 1. Place New Order (Customer public endpoint - no account required)
// ---------------------------------------------------------------------------
router.post('/', orderCreationRateLimiter, async (req: Request, res: Response, next) => {
  try {
    const validatedData = createOrderSchema.parse(req.body);

    // 1. Resolve restaurant from slug (recommended public API) or ID
    let restaurant: { id: string; name: string; slug: string; isActive: boolean } | undefined;
    if (validatedData.restaurantSlug) {
      const [found] = await db
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          isActive: restaurants.isActive
        })
        .from(restaurants)
        .where(eq(restaurants.slug, validatedData.restaurantSlug))
        .limit(1);
      restaurant = found;
    } else if (validatedData.restaurantId) {
      const [found] = await db
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          isActive: restaurants.isActive
        })
        .from(restaurants)
        .where(eq(restaurants.id, validatedData.restaurantId))
        .limit(1);
      restaurant = found;
    } else {
      throw new AppError('restaurantSlug or restaurantId must be provided', 400);
    }

    if (!restaurant || !restaurant.isActive) {
      throw new AppError('Restaurant is inactive or not found', 404);
    }

    // 2. Resolve table from cryptographic tableToken or valid table UUID
    // SECURITY: Never allow raw sequential or guessed table numbers (e.g. "1", "T-01") to place orders.
    let table: { id: string; tableNumber: string; isActive: boolean } | undefined;
    if (validatedData.tableToken) {
      const [foundTable] = await db
        .select({
          id: restaurantTables.id,
          tableNumber: restaurantTables.tableNumber,
          isActive: restaurantTables.isActive
        })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.restaurantId, restaurant.id),
            eq(restaurantTables.tableToken, validatedData.tableToken.trim())
          )
        )
        .limit(1);
      table = foundTable;
    } else if (validatedData.tableId) {
      const trimmedId = validatedData.tableId.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
      if (isUuid) {
        const [foundTable] = await db
          .select({
            id: restaurantTables.id,
            tableNumber: restaurantTables.tableNumber,
            isActive: restaurantTables.isActive
          })
          .from(restaurantTables)
          .where(
            and(
              eq(restaurantTables.restaurantId, restaurant.id),
              eq(restaurantTables.id, trimmedId)
            )
          )
          .limit(1);
        table = foundTable;
      }
    } else {
      throw new AppError('tableToken or tableId must be provided', 400);
    }

    if (!table) {
      throw new AppError('Table not found or does not belong to this restaurant', 404);
    }

    if (!table.isActive) {
      throw new AppError('This table is currently disabled or inactive', 400);
    }

    // 2b. Table Session Security Verification
    const clientSessionToken =
      validatedData.tableSessionToken ||
      (req.headers['x-table-session-token'] as string | undefined);

    let [activeSession] = await db
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
      if (clientSessionToken && clientSessionToken !== activeSession.sessionToken) {
        throw new AppError(
          'Cannot place order: This table has an active session from another party. Please contact your waiter or cashier.',
          403
        );
      }
    } else {
      // Auto-create active session for the table if not already created
      const newSessionToken = clientSessionToken || crypto.randomBytes(32).toString('hex');
      try {
        const [createdSession] = await db
          .insert(tableSessions)
          .values({
            id: crypto.randomUUID(),
            restaurantId: restaurant.id,
            tableId: table.id,
            sessionToken: newSessionToken,
            status: 'active',
            customerName: validatedData.customerName || null,
            customerPhone: validatedData.customerPhone || null
          })
          .returning();
        activeSession = createdSession;
      } catch {
        // Concurrency catch: if another request created the active session concurrently
        const [raceSession] = await db
          .select()
          .from(tableSessions)
          .where(
            and(
              eq(tableSessions.tableId, table.id),
              eq(tableSessions.status, 'active')
            )
          )
          .limit(1);

        if (raceSession) {
          if (!clientSessionToken || clientSessionToken !== raceSession.sessionToken) {
            throw new AppError(
              'Cannot place order: This table has an active session from another party. Please contact your waiter or cashier.',
              403
            );
          }
          activeSession = raceSession;
        }
      }
    }

    // 3. Idempotency Check: prevent duplicate submissions on retry
    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined)?.trim() ||
      validatedData.idempotencyKey?.trim() ||
      null;

    if (idempotencyKey) {
      const [existingOrder] = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          restaurantId: orders.restaurantId,
          tableId: orders.tableId,
          status: orders.status,
          totalAmount: orders.totalAmount,
          specialInstructions: orders.specialInstructions,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          statusToken: orders.statusToken,
          createdAt: orders.createdAt
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurant.id),
            eq(orders.idempotencyKey, idempotencyKey)
          )
        )
        .limit(1);

      if (existingOrder) {
        const existingItems = await db
          .select({
            id: orderItems.id,
            productId: orderItems.productId,
            productName: orderItems.productName,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            subtotal: orderItems.subtotal,
            notes: orderItems.notes
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, existingOrder.id));

        return res.status(200).json({
          message: 'Order already created (idempotent replay)',
          idempotent: true,
          order: {
            ...existingOrder,
            table: {
              id: table.id,
              tableNumber: table.tableNumber
            },
            items: existingItems
          }
        });
      }
    }

    // 4. Product Verification & Authoritative Price Recalculation
    // Fetch product details strictly scoped to restaurant.id to verify ownership & availability
    const productIds = Array.from(new Set(validatedData.items.map((i) => i.productId)));
    const dbProducts = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        restaurantId: products.restaurantId,
        isAvailable: products.isAvailable
      })
      .from(products)
      .where(
        and(
          eq(products.restaurantId, restaurant.id),
          inArray(products.id, productIds)
        )
      );

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Validate that every product belongs to this restaurant and is available
    for (const item of validatedData.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new AppError(
          `Product ID "${item.productId}" is invalid or does not belong to this restaurant`,
          400
        );
      }
      if (!prod.isAvailable) {
        throw new AppError(`Item "${prod.name}" is currently sold out`, 400);
      }
    }

    // Calculate totals strictly in integer paise; ignore any client-supplied prices
    let totalAmount = 0;
    const itemsToInsert = validatedData.items.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice = prod.price; // authoritative integer paise from DB
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      return {
        id: crypto.randomUUID(),
        productId: prod.id,
        productName: prod.name,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        notes: item.notes || null
      };
    });

    const orderId = crypto.randomUUID();
    const statusToken = crypto.randomBytes(16).toString('hex');

    // 5. Atomic transaction: create order and snapshots
    let transactionResult: {
      order: typeof orders.$inferSelect;
      items: (typeof orderItems.$inferSelect)[];
    };

    try {
      transactionResult = await db.transaction(async (tx) => {
        const orderNumber = await generateUniqueOrderNumber(tx, restaurant!.id);

        const [newOrder] = await tx
          .insert(orders)
          .values({
            id: orderId,
            orderNumber,
            restaurantId: restaurant!.id,
            tableId: table!.id,
            tableSessionId: activeSession?.id || null,
            status: 'new', // Initial status set to 'new' on the server
            totalAmount,
            specialInstructions: validatedData.specialInstructions || null,
            customerName: validatedData.customerName || null,
            customerPhone: validatedData.customerPhone || null,
            idempotencyKey,
            statusToken
          })
          .returning();

        if (!newOrder) {
          throw new AppError('Failed to create order', 500);
        }

        const insertedItems = await tx
          .insert(orderItems)
          .values(
            itemsToInsert.map((item) => ({
              ...item,
              orderId
            }))
          )
          .returning();

        return {
          order: newOrder,
          items: insertedItems
        };
      });
    } catch (txError: any) {
      // Handle unique constraint collision for idempotency race conditions
      if (
        idempotencyKey &&
        (txError.code === '23505' || txError.message?.includes('orders_idempotency_idx'))
      ) {
        const [existingOrder] = await db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            restaurantId: orders.restaurantId,
            tableId: orders.tableId,
            status: orders.status,
            totalAmount: orders.totalAmount,
            specialInstructions: orders.specialInstructions,
            customerName: orders.customerName,
            customerPhone: orders.customerPhone,
            statusToken: orders.statusToken,
            createdAt: orders.createdAt
          })
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, restaurant.id),
              eq(orders.idempotencyKey, idempotencyKey)
            )
          )
          .limit(1);

        if (existingOrder) {
          const existingItems = await db
            .select({
              id: orderItems.id,
              productId: orderItems.productId,
              productName: orderItems.productName,
              quantity: orderItems.quantity,
              unitPrice: orderItems.unitPrice,
              subtotal: orderItems.subtotal,
              notes: orderItems.notes
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, existingOrder.id));

          return res.status(200).json({
            message: 'Order already created (idempotent replay)',
            idempotent: true,
            order: {
              ...existingOrder,
              table: {
                id: table.id,
                tableNumber: table.tableNumber
              },
              items: existingItems
            }
          });
        }
      }
      throw txError;
    }

    const customerSafeOrder = {
      id: transactionResult.order.id,
      orderNumber: transactionResult.order.orderNumber,
      status: transactionResult.order.status,
      totalAmount: transactionResult.order.totalAmount,
      statusToken: transactionResult.order.statusToken,
      customerName: transactionResult.order.customerName,
      customerPhone: transactionResult.order.customerPhone,
      specialInstructions: transactionResult.order.specialInstructions,
      createdAt: transactionResult.order.createdAt,
      table: {
        id: table.id,
        tableNumber: table.tableNumber
      },
      items: transactionResult.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes
      }))
    };

    // Realtime notification to restaurant / kitchen after transaction successfully commits
    await publishOrderCreated(restaurant.id, {
      ...transactionResult.order,
      table: {
        id: table.id,
        tableNumber: table.tableNumber
      }
    }, transactionResult.items).catch((err) => {
      console.warn('Realtime publish order-created error:', err);
    });

    res.status(201).json({
      message: 'Order placed successfully',
      order: customerSafeOrder
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// 2. Customer Order Tracking by Status Token (Public endpoint - no auth required)
// ---------------------------------------------------------------------------
router.get('/status/:token', orderTrackingRateLimiter, async (req: Request, res: Response, next) => {
  try {
    const rawToken = req.params.token as string;
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    // Requirement 6: Generic 404 for invalid/malformed tokens without revealing existence
    if (!token || token.length < 16) {
      throw new AppError('Order not found or tracking token is invalid', 404);
    }

    const [orderRecord] = await db
      .select({
        order: orders,
        table: {
          tableNumber: restaurantTables.tableNumber
        },
        restaurant: {
          name: restaurants.name,
          slug: restaurants.slug,
          currency: restaurants.currency
        }
      })
      .from(orders)
      .leftJoin(restaurantTables, eq(orders.tableId, restaurantTables.id))
      .leftJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .where(eq(orders.statusToken, token))
      .limit(1);

    if (!orderRecord) {
      throw new AppError('Order not found or tracking token is invalid', 404);
    }

    const items = await db
      .select({
        productName: orderItems.productName,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        subtotal: orderItems.subtotal,
        notes: orderItems.notes
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderRecord.order.id));

    // Requirements 3 & 7: Return strictly customer-visible fields.
    // Never expose internal UUIDs, staff names, internal notes, or member information.
    res.json({
      orderNumber: orderRecord.order.orderNumber,
      status: orderRecord.order.status,
      totalAmount: orderRecord.order.totalAmount,
      statusToken: orderRecord.order.statusToken,
      customerName: orderRecord.order.customerName || null,
      specialInstructions: orderRecord.order.specialInstructions || null,
      createdAt: orderRecord.order.createdAt,
      updatedAt: orderRecord.order.updatedAt,
      restaurant: orderRecord.restaurant || null,
      table: orderRecord.table || null,
      items: items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// 3. List Orders Scoped to Authorized Restaurant (Staff & Admin)
// ---------------------------------------------------------------------------
router.get(
  '/',
  requireAuth,
  requireTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next) => {
    try {
      const restaurantId = req.tenant!.restaurantId;
      const statusFilter = req.query.status as OrderStatus | undefined;
      const viewFilter = req.query.view as 'open' | 'completed' | 'cancelled' | 'all' | undefined;
      const tableIdFilter = req.query.tableId as string | undefined;
      const dateFilter = req.query.date as string | undefined; // 'today' | 'yesterday' | '7d' | '30d' | 'YYYY-MM-DD'
      const startDateQuery = req.query.startDate as string | undefined;
      const endDateQuery = req.query.endDate as string | undefined;
      const searchQuery = (req.query.search as string | undefined)?.trim();

      const conditions = [eq(orders.restaurantId, restaurantId)];

      // 1. Status Filter takes precedence over general View filter
      if (statusFilter) {
        conditions.push(eq(orders.status, statusFilter));
      } else if (viewFilter === 'open') {
        conditions.push(inArray(orders.status, ['new', 'pending', 'accepted', 'preparing', 'ready']));
      } else if (viewFilter === 'completed') {
        conditions.push(eq(orders.status, 'served'));
      } else if (viewFilter === 'cancelled') {
        conditions.push(eq(orders.status, 'cancelled'));
      }

      // 2. Table Filter
      if (tableIdFilter) {
        conditions.push(eq(orders.tableId, tableIdFilter));
      }

      // 3. Date Boundaries & Predefined Periods (Requirement 3)
      if (dateFilter) {
        if (dateFilter === 'today') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          conditions.push(and(gte(orders.createdAt, startOfToday), lte(orders.createdAt, endOfToday))!);
        } else if (dateFilter === 'yesterday') {
          const startOfYesterday = new Date();
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          startOfYesterday.setHours(0, 0, 0, 0);
          const endOfYesterday = new Date();
          endOfYesterday.setDate(endOfYesterday.getDate() - 1);
          endOfYesterday.setHours(23, 59, 59, 999);
          conditions.push(and(gte(orders.createdAt, startOfYesterday), lte(orders.createdAt, endOfYesterday))!);
        } else if (dateFilter === '7d') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          conditions.push(gte(orders.createdAt, sevenDaysAgo));
        } else if (dateFilter === '30d') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          thirtyDaysAgo.setHours(0, 0, 0, 0);
          conditions.push(gte(orders.createdAt, thirtyDaysAgo));
        } else {
          // Specific date (YYYY-MM-DD)
          const parsed = new Date(dateFilter);
          if (!isNaN(parsed.getTime())) {
            const startOfDay = new Date(parsed);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(parsed);
            endOfDay.setHours(23, 59, 59, 999);
            conditions.push(and(gte(orders.createdAt, startOfDay), lte(orders.createdAt, endOfDay))!);
          }
        }
      }

      // Explicit startDate and endDate filters
      if (startDateQuery) {
        const parsedStart = new Date(startDateQuery);
        if (!isNaN(parsedStart.getTime())) {
          conditions.push(gte(orders.createdAt, parsedStart));
        }
      }
      if (endDateQuery) {
        const parsedEnd = new Date(endDateQuery);
        if (!isNaN(parsedEnd.getTime())) {
          if (endDateQuery.length <= 10) {
            parsedEnd.setHours(23, 59, 59, 999);
          }
          conditions.push(lte(orders.createdAt, parsedEnd));
        }
      }

      // 4. Search Filter in SQL (Order Number, Customer Name, Customer Phone, Table Number)
      if (searchQuery) {
        const searchPattern = `%${searchQuery}%`;
        conditions.push(
          or(
            ilike(orders.orderNumber, searchPattern),
            ilike(orders.customerName, searchPattern),
            ilike(orders.customerPhone, searchPattern),
            ilike(restaurantTables.tableNumber, searchPattern)
          )!
        );
      }

      // 5. Total Count for Pagination (Requirement 1 & 4)
      const [countResult] = await db
        .select({ value: count() })
        .from(orders)
        .leftJoin(restaurantTables, eq(orders.tableId, restaurantTables.id))
        .where(and(...conditions));
      const totalOrders = Number(countResult?.value || 0);

      // Pagination Configuration
      const isPaginated = Boolean(
        req.query.page || req.query.limit || req.query.paginate === 'true'
      );
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const offset = (page - 1) * limit;

      // 6. Query with Stable Sort (desc(createdAt), desc(id) tiebreaker)
      let ordersQuery = db
        .select({
          order: orders,
          table: {
            id: restaurantTables.id,
            tableNumber: restaurantTables.tableNumber
          }
        })
        .from(orders)
        .leftJoin(restaurantTables, eq(orders.tableId, restaurantTables.id))
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt), desc(orders.id));

      if (isPaginated) {
        ordersQuery = ordersQuery.limit(limit).offset(offset) as any;
      }

      const orderList = await ordersQuery;

      // 7. Batch fetch order items and status history audit trail for sliced orders
      const orderIds = orderList.map((o) => o.order.id);
      let itemsByOrder: Record<string, any[]> = {};
      let historyByOrder: Record<string, any[]> = {};

      if (orderIds.length > 0) {
        const [allItems, allHistory] = await Promise.all([
          db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
          db
            .select()
            .from(orderStatusHistory)
            .where(inArray(orderStatusHistory.orderId, orderIds))
            .orderBy(desc(orderStatusHistory.createdAt))
        ]);

        for (const item of allItems) {
          const list = itemsByOrder[item.orderId] ?? (itemsByOrder[item.orderId] = []);
          list.push(item);
        }

        for (const hist of allHistory) {
          const list = historyByOrder[hist.orderId] ?? (historyByOrder[hist.orderId] = []);
          list.push(hist);
        }
      }

      // 8. Enrich with servedAt and rejectedAt timestamps (Requirement 2)
      const formatted = orderList.map(({ order, table }) => {
        const history = historyByOrder[order.id] || [];
        const servedEntry = history.find((h) => h.toStatus === 'served');
        const rejectedEntry = history.find((h) => h.toStatus === 'cancelled');

        return {
          ...order,
          table,
          items: itemsByOrder[order.id] || [],
          statusHistory: history,
          servedAt: servedEntry ? servedEntry.createdAt : (order.status === 'served' ? order.updatedAt : null),
          rejectedAt: rejectedEntry ? rejectedEntry.createdAt : (order.status === 'cancelled' ? order.updatedAt : null)
        };
      });

      // 9. Deliver Paginated or Standard Array Response
      if (isPaginated) {
        const totalPages = Math.ceil(totalOrders / limit) || 1;
        res.json({
          orders: formatted,
          pagination: {
            page,
            limit,
            totalOrders,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        });
      } else {
        res.setHeader('X-Total-Count', totalOrders.toString());
        res.json(formatted);
      }
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 4. Order Detail View Scoped to Authorized Restaurant
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  requireAuth,
  requireTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next) => {
    try {
      const orderId = req.params.id as string;
      const restaurantId = req.tenant!.restaurantId;

      const [orderRecord] = await db
        .select({
          order: orders,
          table: {
            id: restaurantTables.id,
            tableNumber: restaurantTables.tableNumber,
            capacity: restaurantTables.capacity
          }
        })
        .from(orders)
        .leftJoin(restaurantTables, eq(orders.tableId, restaurantTables.id))
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.restaurantId, restaurantId) // Strict tenant isolation (IDOR protection)
          )
        )
        .limit(1);

      if (!orderRecord) {
        throw new AppError('Order not found or does not belong to this restaurant', 404);
      }

      const [items, statusHistory] = await Promise.all([
        db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
        db
          .select()
          .from(orderStatusHistory)
          .where(eq(orderStatusHistory.orderId, orderId))
          .orderBy(desc(orderStatusHistory.createdAt))
      ]);

      const servedEntry = statusHistory.find((h) => h.toStatus === 'served');
      const rejectedEntry = statusHistory.find((h) => h.toStatus === 'cancelled');

      res.json({
        ...orderRecord.order,
        table: orderRecord.table,
        items,
        statusHistory,
        servedAt: servedEntry ? servedEntry.createdAt : (orderRecord.order.status === 'served' ? orderRecord.order.updatedAt : null),
        rejectedAt: rejectedEntry ? rejectedEntry.createdAt : (orderRecord.order.status === 'cancelled' ? orderRecord.order.updatedAt : null)
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 5. Update Order Status with State Machine, Concurrency & Audit Trail
// ---------------------------------------------------------------------------
router.patch(
  '/:id/status',
  requireAuth,
  requireTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next) => {
    try {
      const orderId = req.params.id as string;
      const restaurantId = req.tenant!.restaurantId;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;

      const { status: targetStatus, expectedCurrentStatus, reason } =
        updateOrderStatusSchema.parse(req.body);

      // Perform update atomically with row locking & state-machine validation
      const result = await db.transaction(async (tx) => {
        // 1. Fetch current order with row locking FOR UPDATE
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, restaurantId) // Strict IDOR check
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Order not found or does not belong to this restaurant', 404);
        }

        const currentStatus = order.status as OrderStatus;

        // 2. Concurrency Protection (Requirement 9): Avoid stale status overwrites
        if (expectedCurrentStatus && currentStatus !== expectedCurrentStatus) {
          throw new AppError(
            `Order status conflict: the order is currently in status "${currentStatus}" (expected "${expectedCurrentStatus}"). Please refresh to see latest changes.`,
            409
          );
        }

        // 3. State Machine Domain Validation (Requirement 5 & 6)
        const transitionCheck = validateStatusTransition(currentStatus, targetStatus, userRole);
        if (!transitionCheck.valid) {
          const statusCode = transitionCheck.errorCode === 'FORBIDDEN_ROLE' ? 403 : 400;
          throw new AppError(transitionCheck.error || 'Invalid status transition', statusCode);
        }

        // 4. Update order status
        const [updatedOrder] = await tx
          .update(orders)
          .set({
            status: targetStatus,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, restaurantId)
            )
          )
          .returning();

        // 5. Record status change history audit record (Requirement 7)
        const [historyEntry] = await tx
          .insert(orderStatusHistory)
          .values({
            id: crypto.randomUUID(),
            orderId: order.id,
            fromStatus: currentStatus,
            toStatus: targetStatus,
            changedByUserId: userId,
            changedByRole: userRole,
            reason: reason || null
          })
          .returning();

        // Fetch table info so realtime broadcast & API response include clear table context
        let tableRecord: { id: string; tableNumber: string } | null = null;
        if (order.tableId) {
          const [foundTable] = await tx
            .select({
              id: restaurantTables.id,
              tableNumber: restaurantTables.tableNumber
            })
            .from(restaurantTables)
            .where(eq(restaurantTables.id, order.tableId))
            .limit(1);
          tableRecord = foundTable || null;
        }

        return {
          order: {
            ...updatedOrder!,
            table: tableRecord
          },
          history: historyEntry!
        };
      });

      // Realtime broadcast of status update after transaction successfully commits
      await publishOrderUpdated(restaurantId, result.order).catch((err) => {
        console.warn('Realtime publish order-updated error:', err);
      });

      res.json({
        message: `Order #${result.order.orderNumber} status changed to ${targetStatus}`,
        order: result.order,
        history: result.history
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

