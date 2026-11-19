import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db, restaurantDb, cinemaDb, session as sessionTable } from '@menugo/database';
import { eq, and, gte } from 'drizzle-orm';
import {
  SOCKET_EVENTS,
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  RealtimeRestaurantOrderPayload,
  RealtimeCustomerOrderPayload
} from '@menugo/shared';
import { auth, restaurantAuth, cinemaAuth } from './auth';
import {
  RealtimeProvider,
  setRealtimeProvider,
  authorizeRestaurantSubscription,
  authorizeOrderSubscription,
  publishOrderCreated,
  publishOrderUpdated
} from './realtime';

let io: SocketIOServer | null = null;

/**
 * Socket.io implementation of RealtimeProvider.
 * Emits events to room subscribers across the application.
 */
export class SocketIORealtimeProvider implements RealtimeProvider {
  constructor(private server: SocketIOServer) {}

  async publishToRestaurant(
    restaurantId: string,
    event: string,
    payload: RealtimeRestaurantOrderPayload
  ): Promise<void> {
    const room = REALTIME_CHANNELS.restaurant(restaurantId);
    // Emit to both standardized channel room and bare restaurant ID room
    this.server.to(room).to(restaurantId).emit(event, payload);
    this.server.to(room).to(restaurantId).emit('order:created', payload);

    // If order:created, also emit high-priority kitchen alert with full order context
    if (event === REALTIME_EVENTS.ORDER_CREATED || event === 'order:created') {
      this.server.to(room).to(restaurantId).emit(SOCKET_EVENTS.KITCHEN_ALERT, {
        message: `New order #${payload.orderNumber} received!`,
        orderId: payload.orderId,
        tableId: payload.tableId,
        tableNumber: payload.tableNumber,
        order: payload
      });
    }
  }

  async publishToOrder(
    statusToken: string,
    event: string,
    payload: RealtimeCustomerOrderPayload
  ): Promise<void> {
    const room = REALTIME_CHANNELS.customerOrder(statusToken);
    this.server.to(room).emit(event, payload);
  }
}

export function initializeSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: [
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Register provider instance
  const provider = new SocketIORealtimeProvider(io);
  setRealtimeProvider(provider);

  io.on('connection', (socket: Socket) => {
    // -------------------------------------------------------------------------
    // 1. Private Restaurant Channel Subscription (Staff & Kitchen)
    // -------------------------------------------------------------------------
    socket.on(
      SOCKET_EVENTS.JOIN_RESTAURANT,
      async (payload: any, ack?: (res: any) => void) => {
        try {
          const restaurantId = typeof payload === 'string' ? payload : payload?.restaurantId;
          const clientUserId = typeof payload === 'object' ? payload?.userId : undefined;
          const clientToken = typeof payload === 'object' ? payload?.token : undefined;

          if (!restaurantId || typeof restaurantId !== 'string') {
            if (typeof ack === 'function') {
              ack({ success: false, statusCode: 400, error: 'Missing restaurantId' });
            }
            return;
          }

          // 1. Try session extraction from handshake headers across both auth instances
          let session = await restaurantAuth.api
            .getSession({
              headers: socket.handshake.headers as any
            })
            .catch(() => null);

          if (!session?.user) {
            session = await cinemaAuth.api
              .getSession({
                headers: socket.handshake.headers as any
              })
              .catch(() => null);
          }

          // 2. If handshake cookie was missing, verify via session token across both databases
          let resolvedUserId = session?.user?.id;
          const token = clientToken || (socket.handshake.auth as any)?.token;
          if (!resolvedUserId && token) {
            let [dbSession] = await restaurantDb
              .select({ userId: sessionTable.userId, expiresAt: sessionTable.expiresAt })
              .from(sessionTable)
              .where(and(eq(sessionTable.token, token), gte(sessionTable.expiresAt, new Date())))
              .limit(1);

            if (!dbSession) {
              [dbSession] = await cinemaDb
                .select({ userId: sessionTable.userId, expiresAt: sessionTable.expiresAt })
                .from(sessionTable)
                .where(and(eq(sessionTable.token, token), gte(sessionTable.expiresAt, new Date())))
                .limit(1);
            }

            if (dbSession) {
              resolvedUserId = dbSession.userId;
            }
          }

          // 3. Fallback: Check client provided userId if present
          if (!resolvedUserId && clientUserId) {
            resolvedUserId = clientUserId;
          }

          const authResult = await authorizeRestaurantSubscription(
            resolvedUserId,
            restaurantId
          );

          if (!authResult.authorized) {
            if (typeof ack === 'function') {
              ack({
                success: false,
                statusCode: authResult.statusCode,
                error: authResult.error
              });
            }
            socket.emit('subscription:error', {
              channel: REALTIME_CHANNELS.restaurant(restaurantId),
              error: authResult.error
            });
            return;
          }

          const room = REALTIME_CHANNELS.restaurant(restaurantId);
          socket.join(room);
          socket.join(restaurantId);

          if (typeof ack === 'function') {
            ack({ success: true, room, role: authResult.role });
          }
        } catch (err: any) {
          if (typeof ack === 'function') {
            ack({ success: false, error: err.message || 'Subscription failed' });
          }
        }
      }
    );

    socket.on(SOCKET_EVENTS.LEAVE_RESTAURANT, (payload: any) => {
      const restaurantId = typeof payload === 'string' ? payload : payload?.restaurantId;
      if (restaurantId) {
        const room = REALTIME_CHANNELS.restaurant(restaurantId);
        socket.leave(room);
        socket.leave(restaurantId);
      }
    });

    // -------------------------------------------------------------------------
    // 2. Customer Order Tracking Channel Subscription (Public with statusToken)
    // -------------------------------------------------------------------------
    socket.on(
      SOCKET_EVENTS.JOIN_ORDER,
      async (payload: any, ack?: (res: any) => void) => {
        try {
          const statusToken =
            typeof payload === 'string' ? payload : payload?.statusToken;

          const authResult = await authorizeOrderSubscription(statusToken);

          if (!authResult.authorized) {
            if (typeof ack === 'function') {
              ack({
                success: false,
                statusCode: authResult.statusCode,
                error: authResult.error
              });
            }
            socket.emit('subscription:error', {
              channel: statusToken ? REALTIME_CHANNELS.customerOrder(statusToken) : 'order:unknown',
              error: authResult.error
            });
            return;
          }

          const room = REALTIME_CHANNELS.customerOrder(statusToken);
          socket.join(room);

          if (typeof ack === 'function') {
            ack({ success: true, room, orderId: authResult.orderId });
          }
        } catch (err: any) {
          if (typeof ack === 'function') {
            ack({ success: false, error: err.message || 'Order subscription failed' });
          }
        }
      }
    );

    socket.on(SOCKET_EVENTS.LEAVE_ORDER, (payload: any) => {
      const statusToken = typeof payload === 'string' ? payload : payload?.statusToken;
      if (statusToken) {
        const room = REALTIME_CHANNELS.customerOrder(statusToken);
        socket.leave(room);
      }
    });

    socket.on('disconnect', () => {
      // Disconnection cleanup handled automatically by Socket.io room management
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

// Backward-compatible delegates that call the authoritative RealtimeService
export { publishOrderCreated, publishOrderUpdated };
export const notifyOrderCreated = publishOrderCreated;
export const notifyOrderStatusChanged = async (
  restaurantId: string,
  orderId: string,
  newStatus: any,
  order?: any
) => {
  if (order) {
    await publishOrderUpdated(restaurantId, order);
  }
};
