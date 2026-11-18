import { OrderStatus, RestaurantMemberRole, validateStatusTransition } from '@menugo/shared';

export type UrgencyLevel = 'normal' | 'warning' | 'urgent';

export interface OrderItemSnapshot {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  restaurantId: string;
  tableId: string | null;
  status: OrderStatus;
  totalAmount: number;
  specialInstructions: string | null;
  customerName: string | null;
  customerPhone: string | null;
  statusToken: string | null;
  createdAt: string;
  updatedAt: string;
  table?: {
    id: string;
    tableNumber: string;
    capacity?: number;
  } | null;
  items: OrderItemSnapshot[];
}

export interface KDSGroupedOrders {
  newOrders: KitchenOrder[];
  preparingOrders: KitchenOrder[];
  readyOrders: KitchenOrder[];
  allActiveOrders: KitchenOrder[];
}

/**
 * Calculates the elapsed minutes since an order was created.
 * Safe against negative drift or clock skew.
 */
export function calculateElapsedMinutes(createdAt: string | Date, now: Date = new Date()): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const createdTime = created.getTime();
  if (isNaN(createdTime)) return 0;

  const diffMs = now.getTime() - createdTime;
  if (diffMs <= 0) return 0;

  return Math.floor(diffMs / 60000);
}

/**
 * Formats elapsed time into a concise, readable kitchen duration label.
 */
export function formatElapsedTime(elapsedMinutes: number): string {
  if (elapsedMinutes < 1) return '< 1m';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const hours = Math.floor(elapsedMinutes / 60);
  const remainingMins = elapsedMinutes % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Determines urgency level based on order wait time:
 * - normal: < 10 minutes
 * - warning: 10 - 20 minutes
 * - urgent: > 20 minutes (overdue)
 */
export function getUrgencyLevel(elapsedMinutes: number): UrgencyLevel {
  if (elapsedMinutes >= 20) return 'urgent';
  if (elapsedMinutes >= 10) return 'warning';
  return 'normal';
}

/**
 * Returns visual styles (colors, border, badge) matching urgency level.
 */
export function getUrgencyBadgeStyles(urgency: UrgencyLevel): {
  badge: string;
  border: string;
  text: string;
} {
  switch (urgency) {
    case 'urgent':
      return {
        badge: 'bg-rose-950/80 text-rose-300 border-rose-700/80 animate-pulse',
        border: 'border-rose-500/70 shadow-rose-950/30',
        text: 'text-rose-400'
      };
    case 'warning':
      return {
        badge: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
        border: 'border-amber-500/60 shadow-amber-950/20',
        text: 'text-amber-400'
      };
    case 'normal':
    default:
      return {
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        border: 'border-slate-800',
        text: 'text-slate-400'
      };
  }
}

/**
 * Groups active kitchen orders into Kanban columns:
 * 1. New & Pending: Awaiting kitchen acknowledgment
 * 2. In Prep: Accepted & currently cooking
 * 3. Ready: Prepared, waiting for floor delivery / collection
 */
export function groupOrdersForKDS(orders: KitchenOrder[]): KDSGroupedOrders {
  const newOrders: KitchenOrder[] = [];
  const preparingOrders: KitchenOrder[] = [];
  const readyOrders: KitchenOrder[] = [];
  const allActiveOrders: KitchenOrder[] = [];

  for (const order of orders) {
    // Only group open (non-terminal) orders
    if (order.status === 'served' || order.status === 'cancelled') {
      continue;
    }

    allActiveOrders.push(order);

    if (order.status === 'new' || order.status === 'pending') {
      newOrders.push(order);
    } else if (order.status === 'accepted' || order.status === 'preparing') {
      preparingOrders.push(order);
    } else if (order.status === 'ready') {
      readyOrders.push(order);
    }
  }

  // Sort orders within columns: oldest wait time first (most urgent)
  const sortByAgeDesc = (a: KitchenOrder, b: KitchenOrder) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  newOrders.sort(sortByAgeDesc);
  preparingOrders.sort(sortByAgeDesc);
  readyOrders.sort(sortByAgeDesc);
  allActiveOrders.sort(sortByAgeDesc);

  return {
    newOrders,
    preparingOrders,
    readyOrders,
    allActiveOrders
  };
}

/**
 * Sound notification deduplication:
 * Verifies whether an incoming order should trigger a kitchen alert chime.
 * - Only orders in 'new' or 'pending' qualify.
 * - If order ID has already chimed (present in playedSet), return false.
 */
export function shouldPlayAlert(
  orderId: string,
  playedOrderIds: Set<string>,
  status: OrderStatus
): boolean {
  if (!orderId) return false;
  if (status !== 'new' && status !== 'pending') return false;
  if (playedOrderIds.has(orderId)) return false;
  return true;
}

/**
 * Builds the payload for PATCH /api/orders/:id/status including concurrency protection
 * and verifies state-machine validity before sending.
 */
export function buildKitchenStatusPayload(
  orderId: string,
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  role: RestaurantMemberRole
): { valid: true; payload: { status: OrderStatus; expectedCurrentStatus: OrderStatus } } | { valid: false; error: string } {
  const check = validateStatusTransition(currentStatus, targetStatus, role);
  if (!check.valid) {
    return {
      valid: false,
      error: check.error || `Transition from ${currentStatus} to ${targetStatus} is not permitted.`
    };
  }

  return {
    valid: true,
    payload: {
      status: targetStatus,
      expectedCurrentStatus: currentStatus
    }
  };
}

/**
 * WebAudio synthesizer chime for incoming orders:
 * Plays a distinct two-tone restaurant bell chime (D5 -> A5) without requiring audio asset downloads.
 */
export function playKitchenChime(audioContext: AudioContext | null): boolean {
  if (!audioContext) return false;
  try {
    if (audioContext.state === 'suspended') {
      return false; // Browser autoplay restriction is currently blocking
    }

    const now = audioContext.currentTime;

    // First tone: D5 (587.33 Hz)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone: A5 (880 Hz)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.45, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);

    return true;
  } catch (err) {
    console.warn('Could not synthesize kitchen chime:', err);
    return false;
  }
}

