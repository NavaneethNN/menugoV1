import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  orders,
  orderItems,
  restaurantMembers,
  cinemaScreens,
  cinemaMovies,
  cinemaShows,
  orderStatusHistory
} from '@menugo/database';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireCinemaTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { publishOrderUpdated } from '../lib/realtime';
import { validateStatusTransition, OrderStatus } from '@menugo/shared';
import crypto from 'node:crypto';

const router = Router();

// =========================================================================
// 1. List Ready & In-Transit Orders for Delivery Staff (Requirement 3)
// =========================================================================
router.get(
  '/orders',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'delivery', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;

      // Delivery queue includes orders that are ready or currently assigned for delivery
      const readyOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          totalAmount: orders.totalAmount,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          screenId: orders.screenId,
          movieId: orders.movieId,
          showId: orders.showId,
          seatRow: orders.seatRow,
          seatNumber: orders.seatNumber,
          notes: orders.specialInstructions,
          statusToken: orders.statusToken,
          deliveryStatus: orders.deliveryStatus,
          deliveryStaffId: orders.deliveryStaffId,
          deliveryStaffName: orders.deliveryStaffName,
          assignedAt: orders.assignedAt,
          deliveredAt: orders.deliveredAt,
          createdAt: orders.createdAt,
          screenName: cinemaScreens.screenName,
          screenType: cinemaScreens.screenType,
          movieTitle: cinemaMovies.title,
          showDate: cinemaShows.showDate,
          startTime: cinemaShows.startTime
        })
        .from(orders)
        .leftJoin(cinemaScreens, eq(orders.screenId, cinemaScreens.id))
        .leftJoin(cinemaMovies, eq(orders.movieId, cinemaMovies.id))
        .leftJoin(cinemaShows, eq(orders.showId, cinemaShows.id))
        .where(
          and(
            eq(orders.restaurantId, theatreId),
            eq(orders.orderType, 'cinema'),
            eq(orders.paymentStatus, 'paid'),
            inArray(orders.status, ['ready', 'assigned_for_delivery'])
          )
        )
        .orderBy(desc(orders.createdAt));

      const orderIds = readyOrders.map((o) => o.id);
      const items =
        orderIds.length > 0
          ? await db
              .select({
                id: orderItems.id,
                orderId: orderItems.orderId,
                productName: orderItems.productName,
                quantity: orderItems.quantity,
                unitPrice: orderItems.unitPrice,
                subtotal: orderItems.subtotal
              })
              .from(orderItems)
              .where(inArray(orderItems.orderId, orderIds))
          : [];

      const itemsByOrderId = new Map<string, typeof items>();
      for (const it of items) {
        const arr = itemsByOrderId.get(it.orderId) || [];
        arr.push(it);
        itemsByOrderId.set(it.orderId, arr);
      }

      const formatted = readyOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        notes: o.notes,
        statusToken: o.statusToken,
        screenId: o.screenId,
        screenName: o.screenName,
        screenType: o.screenType,
        seatRow: o.seatRow,
        seatNumber: o.seatNumber,
        movieId: o.movieId,
        movieTitle: o.movieTitle,
        showId: o.showId,
        showDate: o.showDate,
        startTime: o.startTime,
        deliveryStatus: o.deliveryStatus,
        deliveryStaffId: o.deliveryStaffId,
        deliveryStaffName: o.deliveryStaffName,
        screen: {
          id: o.screenId,
          name: o.screenName || 'Standard Screen',
          type: o.screenType || 'standard'
        },
        seat: {
          row: o.seatRow || '-',
          number: o.seatNumber || '-'
        },
        movie: {
          id: o.movieId,
          title: o.movieTitle || 'Movie'
        },
        show: {
          id: o.showId,
          showDate: o.showDate,
          startTime: o.startTime
        },
        delivery: {
          status: o.deliveryStatus || 'unassigned',
          staffId: o.deliveryStaffId,
          staffName: o.deliveryStaffName,
          assignedAt: o.assignedAt,
          deliveredAt: o.deliveredAt
        },
        items: itemsByOrderId.get(o.id) || [],
        createdAt: o.createdAt
      }));

      res.json({
        success: true,
        theatreId,
        orders: formatted
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 2. Accept Delivery Assignment (Requirement 3)
// =========================================================================
router.post(
  '/orders/:orderId/assign',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'delivery', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.orderId as string;
      const userRole = req.tenant!.role;
      const userId = req.user!.id;

      // Look up staff member display name
      const [runnerMember] = await db
        .select({ staffName: restaurantMembers.staffName })
        .from(restaurantMembers)
        .where(eq(restaurantMembers.id, req.tenant!.membershipId))
        .limit(1);

      const staffName =
        (req.body?.staffName as string) ||
        runnerMember?.staffName ||
        req.user?.name ||
        'Screen Runner';

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, theatreId),
              eq(orders.orderType, 'cinema')
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        if (order.status !== 'ready' && order.status !== 'assigned_for_delivery') {
          throw new AppError(`Cannot accept delivery: order is in "${order.status}" status (must be ready)`, 400);
        }

        const transition = validateStatusTransition(order.status as OrderStatus, 'assigned_for_delivery', userRole);
        if (!transition.valid && order.status !== 'assigned_for_delivery') {
          throw new AppError(transition.error || 'Invalid transition to assigned_for_delivery', 403);
        }

        const now = new Date();
        const [saved] = await tx
          .update(orders)
          .set({
            status: 'assigned_for_delivery',
            deliveryStatus: 'assigned',
            deliveryStaffId: userId,
            deliveryStaffName: staffName,
            assignedAt: now,
            updatedAt: now
          })
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'assigned_for_delivery',
          changedByUserId: userId,
          changedByRole: userRole,
          reason: `Delivery assignment accepted by ${staffName}`
        });

        return saved;
      });

      // Emit realtime update to theatre and customer
      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema'
        },
        [],
        'Delivery Runner'
      ).catch((err) => console.warn('Realtime publish error in delivery accept:', err));

      res.json({
        success: true,
        message: 'Order assigned for seat delivery successfully',
        order: updatedOrder
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 3. Mark Assigned Order as Delivered to Seat (Requirement 3)
// =========================================================================
router.post(
  '/orders/:orderId/deliver',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'delivery', 'staff', 'kitchen']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.orderId as string;
      const userRole = req.tenant!.role;
      const userId = req.user!.id;
      const notes = (req.body?.notes as string) || 'Food delivered to customer at seat';

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, theatreId),
              eq(orders.orderType, 'cinema')
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        if (
          order.status !== 'assigned_for_delivery' &&
          order.status !== 'ready' &&
          order.status !== 'accepted' &&
          order.status !== 'preparing'
        ) {
          throw new AppError('Order must be ready, accepted, or assigned for delivery before being marked as delivered', 400);
        }

        if (userRole === 'delivery' && order.deliveryStaffId && order.deliveryStaffId !== userId) {
          throw new AppError('Only the assigned delivery runner or theatre administrator can mark this order as delivered', 403);
        }

        const transition = validateStatusTransition(order.status as OrderStatus, 'delivered', userRole);
        if (!transition.valid) {
          throw new AppError(transition.error || 'Invalid transition to delivered', 403);
        }

        const now = new Date();
        const [saved] = await tx
          .update(orders)
          .set({
            status: 'delivered',
            deliveryStatus: 'delivered',
            deliveredAt: now,
            updatedAt: now
          })
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'delivered',
          changedByUserId: userId,
          changedByRole: userRole,
          reason: notes
        });

        return saved;
      });

      // Emit realtime update
      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema'
        },
        [],
        'Delivery Runner'
      ).catch((err) => console.warn('Realtime publish error in delivery complete:', err));

      res.json({
        success: true,
        message: 'Order marked as delivered successfully',
        order: updatedOrder
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
