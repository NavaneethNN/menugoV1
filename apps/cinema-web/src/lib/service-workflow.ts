import { OrderStatus, RestaurantMemberRole, validateStatusTransition } from '@menugo/shared';

export interface ServiceOrderItem {
  id: string;
  orderId?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
  notes?: string | null;
}

export interface ServiceOrder {
  id: string;
  orderNumber: string;
  restaurantId: string;
  tableId: string | null;
  status: OrderStatus;
  totalAmount: number;
  specialInstructions?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  statusToken?: string | null;
  createdAt: string;
  updatedAt: string;
  table?: {
    id: string;
    tableNumber: string;
    capacity?: number;
  } | null;
  items: ServiceOrderItem[];
}

export type PassUrgency = 'normal' | 'warning' | 'urgent';

/**
 * Calculates the elapsed minutes since an order was marked READY on the kitchen pass.
 * If updatedAt is missing or invalid, falls back to createdAt.
 */
export function calculatePassWaitMinutes(
  timeRef: string | Date,
  now: Date = new Date()
): number {
  const date = typeof timeRef === 'string' ? new Date(timeRef) : timeRef;
  const time = date.getTime();
  if (isNaN(time)) return 0;

  const diffMs = now.getTime() - time;
  if (diffMs <= 0) return 0;

  return Math.floor(diffMs / 60000);
}

/**
 * Formats pass waiting minutes into human-readable label.
 */
export function formatPassWaitTime(minutes: number): string {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Pass urgency threshold:
 * Food on the pass needs to be delivered quickly while hot:
 * - normal: < 3 minutes
 * - warning: 3 to 5 minutes
 * - urgent: > 5 minutes (hot food getting cold, risk of customer dissatisfaction)
 */
export function getPassUrgency(minutes: number): PassUrgency {
  if (minutes >= 5) return 'urgent';
  if (minutes >= 3) return 'warning';
  return 'normal';
}

/**
 * Returns visual badge & card styles based on urgency level.
 */
export function getPassUrgencyStyles(urgency: PassUrgency) {
  switch (urgency) {
    case 'urgent':
      return {
        badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse',
        cardBorder: 'border-rose-400 ring-2 ring-rose-300/50',
        timerText: 'text-rose-700 font-extrabold',
        tagText: 'Urgent Delivery'
      };
    case 'warning':
      return {
        badge: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
        cardBorder: 'border-amber-300 ring-1 ring-amber-200',
        timerText: 'text-amber-700 font-bold',
        tagText: 'Waiting on Pass'
      };
    case 'normal':
    default:
      return {
        badge: 'bg-purple-100 text-purple-800 border-purple-200 font-medium',
        cardBorder: 'border-slate-200',
        timerText: 'text-purple-700 font-semibold',
        tagText: 'Ready'
      };
  }
}

/**
 * Filters orders exclusively for READY orders on the pass.
 * Sorted by wait time ascending (oldest on pass first).
 */
export function filterReadyOrders(ordersList: ServiceOrder[]): ServiceOrder[] {
  return ordersList
    .filter((order) => order.status === 'ready')
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeA - timeB; // Oldest ready order first
    });
}

/**
 * Filters orders for recently SERVED orders today.
 * Sorted descending (most recently served first).
 */
export function filterRecentlyServedOrders(ordersList: ServiceOrder[]): ServiceOrder[] {
  return ordersList
    .filter((order) => order.status === 'served')
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA; // Most recently served first
    });
}

/**
 * Formats table number with high contrast and clarity.
 */
export function formatTableDisplay(table?: { tableNumber?: string | null } | null): {
  badgeText: string;
  isTakeaway: boolean;
} {
  if (!table || !table.tableNumber || !table.tableNumber.trim()) {
    return {
      badgeText: 'TAKEAWAY',
      isTakeaway: true
    };
  }

  const raw = table.tableNumber.trim();
  // If it already says Table, keep it clean
  const formatted = raw.toLowerCase().startsWith('table')
    ? raw.toUpperCase()
    : `TABLE ${raw.toUpperCase()}`;

  return {
    badgeText: formatted,
    isTakeaway: false
  };
}

/**
 * Prepares the payload for marking an order SERVED with optimistic concurrency protection.
 * Requires role authorization and state-machine validation before issuing network request.
 */
export function buildServedStatusPayload(
  orderId: string,
  currentStatus: OrderStatus,
  role: RestaurantMemberRole
): { valid: true; payload: { status: 'served'; expectedCurrentStatus: 'ready' } } | { valid: false; error: string } {
  const check = validateStatusTransition(currentStatus, 'served', role);
  if (!check.valid) {
    return {
      valid: false,
      error: check.error || `Cannot mark order as served from status "${currentStatus}"`
    };
  }

  return {
    valid: true,
    payload: {
      status: 'served',
      expectedCurrentStatus: 'ready' // Optimistic concurrency lock: prevents duplicate served actions
    }
  };
}

/**
 * Checks whether an incoming realtime event should trigger a chime for floor staff.
 * Only triggers when an order becomes READY and hasn't yet chimed.
 */
export function shouldPlayServiceAlert(
  orderId: string,
  playedOrderIds: Set<string>,
  status: OrderStatus
): boolean {
  if (!orderId) return false;
  if (status !== 'ready') return false;
  if (playedOrderIds.has(orderId)) return false;
  return true;
}

/**
 * Plays a pleasant synthesizer chime (C5 -> G5) to alert floor staff that food is ready at the pass.
 * Uses Web Audio API without needing external asset downloads.
 */
export function playServicePassChime(audioContext: AudioContext | null): boolean {
  if (!audioContext) return false;
  try {
    if (audioContext.state === 'suspended') {
      return false; // Browser autoplay restriction
    }

    const now = audioContext.currentTime;

    // Tone 1: C5 (523.25 Hz)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Tone 2: G5 (783.99 Hz)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);

    return true;
  } catch (err) {
    console.warn('Could not synthesize service chime:', err);
    return false;
  }
}

