import { OrderStatus, RestaurantMemberRole } from '@menugo/shared';

export interface OrderItemSnapshot {
  id: string;
  orderId?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
}

export interface OrderHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  changedByUserId?: string | null;
  changedByRole: string;
  reason?: string | null;
  createdAt: string;
}

export interface RestaurantOrder {
  id: string;
  orderNumber: string;
  restaurantId: string;
  tableId?: string | null;
  status: OrderStatus;
  totalAmount: number;
  specialInstructions?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  statusToken?: string | null;
  createdAt: string;
  updatedAt: string;
  servedAt?: string | null;
  rejectedAt?: string | null;
  table?: {
    id: string;
    tableNumber: string;
    capacity?: number;
  } | null;
  items: OrderItemSnapshot[];
  statusHistory?: OrderHistoryEntry[];
}

export interface OrderPaginationMeta {
  page: number;
  limit: number;
  totalOrders: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedOrdersResponse {
  orders: RestaurantOrder[];
  pagination: OrderPaginationMeta;
}

export interface OrderFilterState {
  view: 'all' | 'open' | 'completed' | 'cancelled';
  status: string;
  date: 'all' | 'today' | 'yesterday' | '7d' | '30d';
  startDate?: string;
  endDate?: string;
  search: string;
  page: number;
  limit: number;
}

/**
 * Formats order completion or rejection timestamp with clear status context.
 */
export function formatCompletionTime(order: {
  status: OrderStatus;
  createdAt: string;
  servedAt?: string | null;
  rejectedAt?: string | null;
}): { label: string; time: string | null } {
  if (order.status === 'served') {
    const timeRef = order.servedAt;
    if (timeRef) {
      const d = new Date(timeRef);
      return {
        label: 'Served',
        time: isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    }
    return { label: 'Served', time: null };
  }

  if (order.status === 'cancelled') {
    const timeRef = order.rejectedAt;
    if (timeRef) {
      const d = new Date(timeRef);
      return {
        label: 'Cancelled',
        time: isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    }
    return { label: 'Cancelled', time: null };
  }

  const createdDate = new Date(order.createdAt);
  return {
    label: 'Placed',
    time: isNaN(createdDate.getTime())
      ? null
      : createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

/**
 * Calculates page numbers array with ellipses for pagination navigation controls.
 */
export function calculatePaginationPages(
  currentPage: number,
  totalPages: number,
  maxVisible = 5
): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const half = Math.floor(maxVisible / 2);

  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis');
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return pages;
}

/**
 * Builds clean query parameters record for paginated orders request.
 */
export function buildOrderQueryParams(filters: Partial<OrderFilterState>): Record<string, string> {
  const params: Record<string, string> = {
    paginate: 'true'
  };

  if (filters.page && filters.page > 0) {
    params.page = String(filters.page);
  }
  if (filters.limit && filters.limit > 0) {
    params.limit = String(filters.limit);
  }
  if (filters.status && filters.status !== 'all') {
    params.status = filters.status;
  } else if (filters.view && filters.view !== 'all') {
    params.view = filters.view;
  }

  if (filters.date && filters.date !== 'all') {
    params.date = filters.date;
  }
  if (filters.startDate) {
    params.startDate = filters.startDate;
  }
  if (filters.endDate) {
    params.endDate = filters.endDate;
  }
  if (filters.search && filters.search.trim()) {
    params.search = filters.search.trim();
  }

  return params;
}

