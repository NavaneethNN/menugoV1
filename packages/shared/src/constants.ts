export const ORDER_STATUSES = [
  'new',
  'pending',
  'accepted',
  'preparing',
  'ready',
  'served',
  'cancelled'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const RESTAURANT_MEMBER_ROLES = [
  'owner',
  'admin',
  'staff',
  'kitchen'
] as const;

export type RestaurantMemberRole = (typeof RESTAURANT_MEMBER_ROLES)[number];

export const SOCKET_EVENTS = {
  // Room joining/leaving
  JOIN_RESTAURANT: 'restaurant:join',
  LEAVE_RESTAURANT: 'restaurant:leave',
  JOIN_ORDER: 'order:join',
  LEAVE_ORDER: 'order:leave',

  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:status_changed',

  // System/Notification events
  KITCHEN_ALERT: 'kitchen:alert'
} as const;

export const DEFAULT_CURRENCY = 'INR';

