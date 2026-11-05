import crypto from 'crypto';
import { db, orders, restaurantMembers } from '@menugo/database';
import { eq, and } from 'drizzle-orm';
import {
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  realtimeRestaurantOrderPayloadSchema,
  realtimeCustomerOrderPayloadSchema,
  RealtimeRestaurantOrderPayload,
  RealtimeCustomerOrderPayload,
  RestaurantMemberRole,
  OrderStatus
} from '@menugo/shared';

export interface RealtimeProvider {
  publishToRestaurant(restaurantId: string, event: string, payload: RealtimeRestaurantOrderPayload): Promise<void>;
  publishToOrder(statusToken: string, event: string, payload: RealtimeCustomerOrderPayload): Promise<void>;
}

export interface ChannelAuthResult {
  authorized: boolean;
  statusCode?: number;
  error?: string;
  role?: RestaurantMemberRole;
  orderId?: string;
}

// -----------------------------------------------------------------------------
// 1. Subscription Authorizers (Strict Tenant & Customer Isolation)
// -----------------------------------------------------------------------------

/**
 * Authorizes a user to subscribe to a private restaurant realtime channel.
 * Rejects unauthenticated requests and cross-tenant access attempts.
 */
export async function authorizeRestaurantSubscription(
  userId: string | null | undefined,
  restaurantId: string
): Promise<ChannelAuthResult> {
  if (!restaurantId || typeof restaurantId !== 'string') {
    return {
      authorized: false,
      statusCode: 400,
      error: 'Bad Request: Missing or invalid restaurantId'
    };
  }

  if (!userId) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Valid authenticated session required to access private restaurant realtime channel'
    };
  }

  const [membership] = await db
    .select({
      id: restaurantMembers.id,
      role: restaurantMembers.role
    })
    .from(restaurantMembers)
    .where(
      and(
        eq(restaurantMembers.restaurantId, restaurantId),
        eq(restaurantMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    return {
      authorized: false,
      statusCode: 403,
      error: 'Forbidden: You are not an authorized member of this restaurant'
    };
  }

  return {
    authorized: true,
    role: membership.role as RestaurantMemberRole
  };
}

/**
 * Authorizes a customer to subscribe to an order status channel.
 * Requires an unguessable, limited-purpose status token.
 */
export async function authorizeOrderSubscription(
  statusToken: string | null | undefined
): Promise<ChannelAuthResult> {
  if (!statusToken || typeof statusToken !== 'string' || statusToken.trim().length < 16) {
    return {
      authorized: false,
      statusCode: 400,
      error: 'Bad Request: Valid statusToken required to track order status'
    };
  }

  const [order] = await db
    .select({
      id: orders.id
    })
    .from(orders)
    .where(eq(orders.statusToken, statusToken.trim()))
    .limit(1);

  if (!order) {
    return {
      authorized: false,
      statusCode: 404,
      error: 'Not Found: No order matches the provided status token'
    };
  }

  return {
    authorized: true,
    orderId: order.id
  };
}

// -----------------------------------------------------------------------------
// 2. Event Payload Sanitizers (Never leak secrets or unnecessary internal data)
// -----------------------------------------------------------------------------

export function sanitizeRestaurantOrderPayload(
  order: any,
  items: any[] = [],
  eventType: 'order:created' | 'order:updated' | 'order:status_changed' = 'order:created'
): RealtimeRestaurantOrderPayload {
  const updatedAtDate = order.updatedAt ? new Date(order.updatedAt) : new Date();
  const createdAtDate = order.createdAt ? new Date(order.createdAt) : new Date();

  const rawPayload = {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    version: updatedAtDate.getTime() || Date.now(),
    restaurantId: order.restaurantId,
    orderId: order.id,
    orderNumber: String(order.orderNumber),
    status: order.status as OrderStatus,
    tableId: order.tableId || null,
    tableNumber: order.table?.tableNumber || (order.tableNumber ? String(order.tableNumber) : null),
    totalAmount: Number(order.totalAmount || 0),
    itemCount: Array.isArray(items)
      ? items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0)
      : Number(order.itemCount || 1),
    specialInstructions: order.specialInstructions || null,
    createdAt: createdAtDate.toISOString(),
    updatedAt: updatedAtDate.toISOString(),
    items: Array.isArray(items)
      ? items.map((it) => ({
          id: String(it.id || crypto.randomUUID()),
          productId: it.productId ? String(it.productId) : null,
          productName: String(it.productName || 'Item'),
          quantity: Number(it.quantity || 1),
          unitPrice: it.unitPrice !== undefined ? Number(it.unitPrice) : undefined,
          notes: it.notes || null
        }))
      : []
  };

  return realtimeRestaurantOrderPayloadSchema.parse(rawPayload);
}

export function sanitizeCustomerOrderPayload(
  order: any,
  restaurantName?: string | null,
  eventType: 'order:updated' | 'order:status_changed' = 'order:status_changed'
): RealtimeCustomerOrderPayload {
  const updatedAtDate = order.updatedAt ? new Date(order.updatedAt) : new Date();

  const rawPayload = {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    version: updatedAtDate.getTime() || Date.now(),
    statusToken: String(order.statusToken),
    orderNumber: String(order.orderNumber),
    status: order.status as OrderStatus,
    restaurantName: restaurantName || order.restaurant?.name || null,
    tableNumber: order.table?.tableNumber || (order.tableNumber ? String(order.tableNumber) : null),
    itemCount: Array.isArray(order.items)
      ? order.items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0)
      : undefined,
    updatedAt: updatedAtDate.toISOString()
  };

  return realtimeCustomerOrderPayloadSchema.parse(rawPayload);
}

// -----------------------------------------------------------------------------
// 3. Provider Boundary & Serverless-Resilient Dispatcher
// -----------------------------------------------------------------------------

let activeProvider: RealtimeProvider | null = null;

export function setRealtimeProvider(provider: RealtimeProvider | null) {
  activeProvider = provider;
}

export function getRealtimeProvider(): RealtimeProvider | null {
  return activeProvider;
}

/**
 * Publishes an order-created event to the private restaurant channel.
 * MUST be invoked only after the database transaction has successfully committed.
 */
export async function publishOrderCreated(
  restaurantId: string,
  order: any,
  items: any[] = []
): Promise<void> {
  const provider = getRealtimeProvider();
  if (!provider) return;

  const restaurantPayload = sanitizeRestaurantOrderPayload(order, items, 'order:created');
  await provider.publishToRestaurant(restaurantId, REALTIME_EVENTS.ORDER_CREATED, restaurantPayload);
}

/**
 * Publishes an order-updated event to both the private restaurant channel
 * and the scoped customer status tracking channel.
 * MUST be invoked only after the database transaction has successfully committed.
 */
export async function publishOrderUpdated(
  restaurantId: string,
  order: any,
  items?: any[],
  restaurantName?: string | null
): Promise<void> {
  const provider = getRealtimeProvider();
  if (!provider) return;

  // 1. Publish to private restaurant staff/kitchen channel
  const restaurantPayload = sanitizeRestaurantOrderPayload(order, items || [], 'order:updated');
  await provider.publishToRestaurant(restaurantId, REALTIME_EVENTS.ORDER_UPDATED, restaurantPayload);

  // 2. Publish to customer tracking channel if statusToken is present
  if (order.statusToken) {
    const customerPayload = sanitizeCustomerOrderPayload(order, restaurantName, 'order:status_changed');
    await provider.publishToOrder(order.statusToken, REALTIME_EVENTS.ORDER_STATUS_CHANGED, customerPayload);
  }
}

/**
 * Publishes a table session event (e.g. table:session_started, table:session_closed)
 * to the private restaurant channel for Cashier and Floor Service.
 */
export async function publishTableEvent(
  restaurantId: string,
  event: string,
  payload: any
): Promise<void> {
  const provider = getRealtimeProvider();
  if (!provider) return;
  await provider.publishToRestaurant(restaurantId, event, payload);
}


