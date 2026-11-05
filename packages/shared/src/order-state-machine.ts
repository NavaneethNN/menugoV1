import { OrderStatus, RestaurantMemberRole } from './constants';

export type TransitionErrorCode =
  | 'SAME_STATUS'
  | 'TERMINAL_STATE'
  | 'INVALID_TRANSITION'
  | 'FORBIDDEN_ROLE';

export interface StatusTransitionResult {
  valid: boolean;
  error?: string;
  errorCode?: TransitionErrorCode;
}

/**
 * Canonical forward transitions allowed in the restaurant order lifecycle.
 */
export const ALLOWED_FORWARD_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['accepted', 'preparing'],
  pending: ['accepted', 'preparing'],
  accepted: ['preparing'],
  preparing: ['ready'],
  ready: ['served'],
  served: [],
  cancelled: []
};

/**
 * Roles authorized to trigger specific target status transitions.
 */
export const ROLE_PERMISSIONS_FOR_TARGET_STATUS: Record<OrderStatus, readonly RestaurantMemberRole[]> = {
  new: [],
  pending: [],
  accepted: ['owner', 'admin', 'kitchen', 'staff'],
  preparing: ['owner', 'admin', 'kitchen', 'staff'],
  ready: ['owner', 'admin', 'kitchen'], // Kitchen or management signals dishes are cooked
  served: ['owner', 'admin', 'staff', 'kitchen'], // Floor staff or management delivers to table
  cancelled: ['owner', 'admin'] // Only owner or admin can cancel orders
};

/**
 * Single authoritative domain function & state machine for order status transitions.
 * Enforces:
 * 1. Prohibition of no-op (same status) transitions.
 * 2. Immutability of terminal states (served and cancelled).
 * 3. Strict linear lifecycle preventing arbitrary or backward jumps.
 * 4. Role-based authorization for forward and cancellation transitions.
 */
export function validateStatusTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  role: RestaurantMemberRole
): StatusTransitionResult {
  // 1. Same status is a no-op / invalid transition
  if (currentStatus === targetStatus) {
    return {
      valid: false,
      errorCode: 'SAME_STATUS',
      error: `Order is already in status "${currentStatus}"`
    };
  }

  // 2. Terminal states cannot be changed under any circumstance
  if (currentStatus === 'served') {
    return {
      valid: false,
      errorCode: 'TERMINAL_STATE',
      error: 'Cannot update order: order has already been served and completed'
    };
  }
  if (currentStatus === 'cancelled') {
    return {
      valid: false,
      errorCode: 'TERMINAL_STATE',
      error: 'Cannot update order: order has already been cancelled'
    };
  }

  // 3. Cancellation transition
  if (targetStatus === 'cancelled') {
    if (role !== 'owner' && role !== 'admin') {
      return {
        valid: false,
        errorCode: 'FORBIDDEN_ROLE',
        error: `Role "${role}" is not permitted to cancel orders. Only owner or admin can cancel.`
      };
    }
    // Cancellation is allowed from any non-terminal state by owner or admin
    return { valid: true };
  }

  // 4. Validate forward progression (strictly linear, no arbitrary skips or backward jumps)
  const allowedNext = ALLOWED_FORWARD_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      valid: false,
      errorCode: 'INVALID_TRANSITION',
      error: `Invalid transition from "${currentStatus}" to "${targetStatus}". Arbitrary or backward status jumps are strictly rejected.`
    };
  }

  // 5. Validate role authorization for target status
  const permittedRoles = ROLE_PERMISSIONS_FOR_TARGET_STATUS[targetStatus] || [];
  if (!permittedRoles.includes(role)) {
    return {
      valid: false,
      errorCode: 'FORBIDDEN_ROLE',
      error: `Role "${role}" does not have permission to transition order to "${targetStatus}"`
    };
  }

  return { valid: true };
}

/**
 * Returns the list of next allowed statuses for a given current status and staff role.
 * Used by UI to render only valid action buttons.
 */
export function getAllowedNextStatuses(
  currentStatus: OrderStatus,
  role: RestaurantMemberRole
): OrderStatus[] {
  if (isTerminalOrderStatus(currentStatus)) {
    return [];
  }

  const potentialNext: OrderStatus[] = [...(ALLOWED_FORWARD_TRANSITIONS[currentStatus] || [])];
  if (role === 'owner' || role === 'admin') {
    potentialNext.push('cancelled');
  }

  return potentialNext.filter((target) => validateStatusTransition(currentStatus, target, role).valid);
}

/**
 * Checks whether an order is open / active (non-terminal).
 */
export function isOpenOrderStatus(status: OrderStatus): boolean {
  return status !== 'served' && status !== 'cancelled';
}

/**
 * Checks whether an order status is terminal (cannot transition further).
 */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === 'served' || status === 'cancelled';
}

/**
 * Visual styling and metadata helper for order statuses.
 */
export function getStatusDisplayInfo(status: OrderStatus) {
  switch (status) {
    case 'new':
      return {
        label: 'New Order',
        description: 'Placed by customer, awaiting kitchen acceptance',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        dotClass: 'bg-blue-500'
      };
    case 'pending':
      return {
        label: 'Pending',
        description: 'Awaiting acknowledgment',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500'
      };
    case 'accepted':
      return {
        label: 'Accepted',
        description: 'Acknowledged by kitchen / staff',
        badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        dotClass: 'bg-cyan-500'
      };
    case 'preparing':
      return {
        label: 'Preparing',
        description: 'Currently being cooked in kitchen',
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
        dotClass: 'bg-orange-500 animate-pulse'
      };
    case 'ready':
      return {
        label: 'Ready to Serve',
        description: 'Cooking complete, ready for table delivery',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        dotClass: 'bg-purple-500'
      };
    case 'served':
      return {
        label: 'Served',
        description: 'Delivered to table (Completed)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-500'
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        description: 'Order cancelled / voided',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        dotClass: 'bg-rose-500'
      };
    default:
      return {
        label: status,
        description: 'Unknown status',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
        dotClass: 'bg-slate-400'
      };
  }
}

