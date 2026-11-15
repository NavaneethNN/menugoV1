import { z } from 'zod';
import { ORDER_STATUSES, OrderStatus } from './constants';

export const REALTIME_EVENTS = {
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:status_changed',
  TABLE_SESSION_STARTED: 'table:session_started',
  TABLE_SESSION_CLOSED: 'table:session_closed',
  TABLE_UPDATED: 'table:updated',
  KITCHEN_ALERT: 'kitchen:alert'
} as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/**
 * Standardized channel name constructors.
 * - Restaurant channels are private and require session + membership authorization.
 * - Customer channels are scoped exclusively to the unguessable status token.
 */
export const REALTIME_CHANNELS = {
  restaurant: (restaurantId: string) => `restaurant:${restaurantId}`,
  customerOrder: (statusToken: string) => `order:token:${statusToken}`
} as const;

/**
 * Zod schema for private restaurant order event payloads (Staff & Kitchen).
 */
export const realtimeRestaurantOrderPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum(['order:created', 'order:updated', 'order:status_changed']),
  timestamp: z.string().datetime(),
  version: z.number().int().nonnegative(),
  restaurantId: z.string().uuid(),
  orderId: z.string().uuid(),
  orderNumber: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
  tableId: z.string().uuid().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  orderType: z.enum(['restaurant', 'cinema']).optional(),
  screenId: z.string().uuid().nullable().optional(),
  screenName: z.string().nullable().optional(),
  showId: z.string().uuid().nullable().optional(),
  movieId: z.string().uuid().nullable().optional(),
  movieTitle: z.string().nullable().optional(),
  showDate: z.string().nullable().optional(),
  showtime: z.string().nullable().optional(),
  seatRow: z.string().nullable().optional(),
  seatNumber: z.string().nullable().optional(),
  paymentStatus: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  totalAmount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  specialInstructions: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z
    .array(
      z.object({
        id: z.string(),
        productId: z.string().nullable().optional(),
        productName: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().nonnegative().optional(),
        notes: z.string().nullable().optional()
      })
    )
    .optional()
});

export type RealtimeRestaurantOrderPayload = z.infer<typeof realtimeRestaurantOrderPayloadSchema>;

/**
 * Zod schema for customer order event payloads (Public customer tracking).
 * Strictly omits private customer data, staff IDs, internal tokens, and secrets.
 */
export const realtimeCustomerOrderPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum(['order:updated', 'order:status_changed']),
  timestamp: z.string().datetime(),
  version: z.number().int().nonnegative(),
  statusToken: z.string().min(16),
  orderNumber: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
  restaurantName: z.string().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  itemCount: z.number().int().nonnegative().optional(),
  updatedAt: z.string().datetime()
});

export type RealtimeCustomerOrderPayload = z.infer<typeof realtimeCustomerOrderPayloadSchema>;

