'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket-client';
import { formatPaise } from '@/lib/utils';
import {
  OrderStatus,
  RestaurantMemberRole,
  getAllowedNextStatuses,
  getStatusDisplayInfo,
  isOpenOrderStatus,
  isTerminalOrderStatus,
  SOCKET_EVENTS
} from '@menugo/shared';
import {
  RestaurantOrder,
  OrderItemSnapshot,
  OrderHistoryEntry,
  OrderPaginationMeta,
  PaginatedOrdersResponse,
  formatCompletionTime,
  calculatePaginationPages,
  buildOrderQueryParams
} from '@/lib/order-history';
import {
  ShoppingBag,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Calendar,
  User,
  Phone,
  ArrowRight,
  History,
  RefreshCw,
  FileText,
  Ban,
  ChefHat,
  MessageSquare,
  UtensilsCrossed,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import Link from 'next/link';

export default function AdminOrdersPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);
  const initialOrdersLoadedRef = useRef(false);

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [ordersList, setOrdersList] = useState<RestaurantOrder[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<OrderPaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [viewFilter, setViewFilter] = useState<'open' | 'completed' | 'cancelled' | 'all'>('open');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7d' | '30d'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Order Detail Drawer & Status Action Modals
  const [selectedOrder, setSelectedOrder] = useState<RestaurantOrder | null>(null);
  const [transitioningStatus, setTransitioningStatus] = useState<OrderStatus | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);

  // 1. Session & Restaurant Loading
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadRestaurants();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionLoading, router]);

  const loadRestaurants = async (isSilent = false) => {
    try {
      if (!isSilent && restaurants.length === 0) {
        setLoading(true);
      }
      const data = await apiRequest('/api/restaurants/my');
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedMembership((prev: any) => {
          if (!prev) return data[0];
          const match = data.find((r: any) => (r.restaurant?.id || r.restaurantId) === (prev.restaurant?.id || prev.restaurantId));
          return match || data[0];
        });
      } else {
        setSelectedMembership(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load restaurant profile.');
    } finally {
      setLoading(false);
    }
  };

  const selectedRestaurant = selectedMembership?.restaurant;
  const currentRole = (selectedMembership?.role || 'staff') as RestaurantMemberRole;

  // 2. Fetch Orders for Selected Restaurant with Pagination & Filters
  const loadOrders = useCallback(async (isSilent = false) => {
    if (!selectedRestaurant?.id) return;
    try {
      if (!isSilent && !initialOrdersLoadedRef.current) {
        setLoading(true);
      } else if (!isSilent) {
        setRefreshing(true);
      }
      setError(null);

      const params = buildOrderQueryParams({
        page: currentPage,
        limit: pageSize,
        view: viewFilter,
        status: statusFilter,
        date: dateFilter,
        search: appliedSearch
      });

      const res = await apiRequest<PaginatedOrdersResponse | RestaurantOrder[]>('/api/orders', {
        restaurantId: selectedRestaurant.id,
        params
      });

      initialOrdersLoadedRef.current = true;

      if (res && typeof res === 'object' && 'orders' in res && 'pagination' in res) {
        setOrdersList(res.orders);
        setPaginationMeta(res.pagination);

        setSelectedOrder((prev) => {
          if (!prev) return null;
          return res.orders.find((o) => o.id === prev.id) || prev;
        });
      } else if (Array.isArray(res)) {
        setOrdersList(res);
        setPaginationMeta({
          page: currentPage,
          limit: pageSize,
          totalOrders: res.length,
          totalPages: Math.max(1, Math.ceil(res.length / pageSize)),
          hasNextPage: false,
          hasPrevPage: false
        });

        setSelectedOrder((prev) => {
          if (!prev) return null;
          return res.find((o) => o.id === prev.id) || prev;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch restaurant orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRestaurant?.id, currentPage, pageSize, statusFilter, viewFilter, dateFilter, appliedSearch]);

  useEffect(() => {
    if (selectedRestaurant?.id) {
      loadOrders();
    }
  }, [selectedRestaurant?.id, loadOrders]);

  // Reset pagination to page 1 when primary filters change
  const handleViewChange = (newView: 'open' | 'completed' | 'cancelled' | 'all') => {
    setViewFilter(newView);
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  const handleDateChange = (newDate: 'all' | 'today' | 'yesterday' | '7d' | '30d') => {
    setDateFilter(newDate);
    setCurrentPage(1);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedSearch(searchQuery.trim());
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setViewFilter('open');
    setStatusFilter('all');
    setDateFilter('all');
    setSearchQuery('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  // Realtime Socket Subscription with Instant In-Memory Updates
  useEffect(() => {
    if (!selectedRestaurant?.id) return;

    const socket = getSocket();
    const restaurantId = selectedRestaurant.id;

    const onConnect = () => {
      socket.emit(SOCKET_EVENTS.JOIN_RESTAURANT, restaurantId);
      // Silent background fetch on reconnect
      loadOrders(true);
    };

    // Instant Realtime: new order arrives
    const onOrderCreated = (data: any) => {
      if (!data) return;
      const orderId = data.orderId || data.id;
      if (!orderId) return;

      const newOrder: RestaurantOrder = {
        id: orderId,
        orderNumber: String(data.orderNumber),
        restaurantId: data.restaurantId || restaurantId,
        tableId: data.tableId || null,
        status: data.status || 'new',
        totalAmount: Number(data.totalAmount || 0),
        specialInstructions: data.specialInstructions || null,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        table: data.table || (data.tableNumber ? { id: data.tableId || '', tableNumber: String(data.tableNumber) } : null),
        items: Array.isArray(data.items)
          ? data.items.map((it: any) => ({
              id: it.id || crypto.randomUUID(),
              orderId,
              productName: it.productName || 'Item',
              quantity: Number(it.quantity || 1),
              unitPrice: Number(it.unitPrice || 0),
              subtotal: Number(it.subtotal || (it.unitPrice || 0) * (it.quantity || 1)),
              notes: it.notes || null
            }))
          : []
      };

      // Instantly prepend without page reload
      setOrdersList((prev) => {
        if (prev.some((o) => o.id === orderId)) return prev;
        return [newOrder, ...prev];
      });

      setPaginationMeta((prev) =>
        prev ? { ...prev, totalOrders: prev.totalOrders + 1 } : null
      );
    };

    // Instant Realtime: status changes
    const onOrderStatusChanged = (data: any) => {
      if (!data) return;
      const orderId = data.orderId || data.id;
      if (!orderId) return;

      setOrdersList((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: data.status,
                updatedAt: data.updatedAt || new Date().toISOString(),
                ...(data.tableNumber ? { table: { id: data.tableId || '', tableNumber: String(data.tableNumber) } } : {})
              }
            : o
        )
      );

      setSelectedOrder((prev) =>
        prev && prev.id === orderId
          ? { ...prev, status: data.status, updatedAt: data.updatedAt || new Date().toISOString() }
          : prev
      );
    };

    socket.on('connect', onConnect);
    socket.on(SOCKET_EVENTS.ORDER_CREATED, onOrderCreated);
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, onOrderStatusChanged);
    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGED, onOrderStatusChanged);

    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_RESTAURANT, restaurantId);
      socket.off('connect', onConnect);
      socket.off(SOCKET_EVENTS.ORDER_CREATED, onOrderCreated);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, onOrderStatusChanged);
      socket.off(SOCKET_EVENTS.ORDER_STATUS_CHANGED, onOrderStatusChanged);
    };
  }, [selectedRestaurant?.id, loadOrders]);

  // Window Visibility Recovery (silent background sync only if socket disconnected while tab was in background)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const socket = getSocket();
        if (!socket.connected) {
          socket.connect();
          loadOrders(true);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadOrders]);

  // 3. Status Transition Handler (with Concurrency Protection)
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus, reason?: string) => {
    if (!selectedRestaurant?.id) return;

    try {
      setIsUpdatingStatus(true);
      setStatusActionError(null);

      const currentOrder = ordersList.find((o) => o.id === orderId);

      const payload = {
        status: nextStatus,
        expectedCurrentStatus: currentOrder?.status,
        reason: reason?.trim() || undefined
      };

      const res = await apiRequest<{ message: string; order: RestaurantOrder; history: OrderHistoryEntry }>(
        `/api/orders/${orderId}/status`,
        {
          method: 'PATCH',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify(payload)
        }
      );

      setOrdersList((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: res.order.status,
              updatedAt: res.order.updatedAt,
              statusHistory: [res.history, ...(o.statusHistory || [])]
            };
          }
          return o;
        })
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: res.order.status,
                updatedAt: res.order.updatedAt,
                statusHistory: [res.history, ...(prev.statusHistory || [])]
              }
            : null
        );
      }

      setTransitioningStatus(null);
      setCancellationReason('');
    } catch (err: any) {
      setStatusActionError(err.message || 'Failed to update order status.');
      loadOrders();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const hasActiveFilters = Boolean(
    appliedSearch ||
      dateFilter !== 'all' ||
      statusFilter !== 'all' ||
      viewFilter !== 'open'
  );

  // 4. Counts by Category for Badges
  const counts = useMemo(() => {
    let openCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    ordersList.forEach((o) => {
      if (isOpenOrderStatus(o.status)) openCount++;
      else if (o.status === 'served') completedCount++;
      else if (o.status === 'cancelled') cancelledCount++;
    });

    return { openCount, completedCount, cancelledCount, total: ordersList.length };
  }, [ordersList]);

  if ((sessionLoading || loading) && !initialOrdersLoadedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-600" />
                  <span>Order Management</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider">
                  {currentRole}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium line-clamp-1">
                {selectedRestaurant?.name || 'Restaurant Orders'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Restaurant Selector */}
            {restaurants.length > 1 && (
              <select
                value={selectedMembership?.restaurant.id}
                onChange={(e) => {
                  const m = restaurants.find((r) => r.restaurant.id === e.target.value);
                  if (m) setSelectedMembership(m);
                }}
                className="text-xs font-semibold bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {restaurants.map((m) => (
                  <option key={m.restaurant.id} value={m.restaurant.id}>
                    {m.restaurant.name} ({m.role})
                  </option>
                ))}
              </select>
            )}

            <Link
              href="/admin/service"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition shadow-xs"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Floor Pass</span>
            </Link>

            <button
              onClick={() => loadOrders()}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Banner with Recoverable Retry */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-900 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadOrders()}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition"
              >
                Retry
              </button>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* View Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl text-xs font-bold shrink-0">
              <button
                onClick={() => handleViewChange('open')}
                className={`px-3 py-1.5 rounded-xl transition ${
                  viewFilter === 'open' && statusFilter === 'all'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Open Orders
              </button>
              <button
                onClick={() => handleViewChange('completed')}
                className={`px-3 py-1.5 rounded-xl transition ${
                  viewFilter === 'completed' && statusFilter === 'all'
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => handleViewChange('cancelled')}
                className={`px-3 py-1.5 rounded-xl transition ${
                  viewFilter === 'cancelled' && statusFilter === 'all'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelled
              </button>
              <button
                onClick={() => handleViewChange('all')}
                className={`px-3 py-1.5 rounded-xl transition ${
                  viewFilter === 'all' && statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Orders
              </button>
            </div>

            {/* Quick Status Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="accepted">Accepted</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready to Serve</option>
                <option value="served">Served</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Search & Date Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Order #, Customer Name, Table... (Press Enter)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-14 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setAppliedSearch('');
                      setCurrentPage(1);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded-lg transition"
                >
                  Find
                </button>
              </div>
            </form>

            {/* Date Quick Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={dateFilter}
                onChange={(e) => handleDateChange(e.target.value as any)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold transition"
                title="Reset Filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Order Cards List Grid */}
        {ordersList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No Orders Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'There are no orders matching your current view, filters, or search query.'
                  : 'No orders have been recorded for this restaurant yet.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ordersList.map((order) => {
              const displayInfo = getStatusDisplayInfo(order.status);
              const allowedNext = getAllowedNextStatuses(order.status, currentRole);
              const timeInfo = formatCompletionTime(order);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        {order.table && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
                            {order.table.tableNumber}
                          </span>
                        )}
                      </div>

                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${displayInfo.badgeClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${displayInfo.dotClass}`} />
                        <span>{displayInfo.label}</span>
                      </div>
                    </div>

                    {/* Customer & Timestamp Meta */}
                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        {order.customerName ? (
                          <>
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{order.customerName}</span>
                          </>
                        ) : (
                          <span>Walk-in Guest</span>
                        )}
                      </span>
                      <div className="text-right text-[11px]">
                        <span className="text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {timeInfo.time && order.status !== 'new' && (
                          <span
                            className={`ml-1.5 font-semibold ${
                              order.status === 'served'
                                ? 'text-emerald-600'
                                : order.status === 'cancelled'
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }`}
                          >
                            • {timeInfo.label} {timeInfo.time}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Body: Items Preview */}
                  <div className="p-5 py-3 space-y-2 flex-1">
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between text-xs text-slate-700"
                        >
                          <div className="flex-1 pr-2">
                            <span className="font-bold text-slate-900 mr-1.5">{item.quantity}x</span>
                            <span>{item.productName}</span>
                            {item.notes && (
                              <p className="text-[10px] text-orange-600 italic line-clamp-1">
                                &quot;{item.notes}&quot;
                              </p>
                            )}
                          </div>
                          <span className="font-semibold shrink-0 text-slate-500">
                            {formatPaise(item.subtotal, selectedRestaurant?.currency)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.specialInstructions && (
                      <div className="p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 flex items-start gap-1.5">
                        <MessageSquare className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <span className="italic line-clamp-1">{order.specialInstructions}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Total & Quick Action Buttons */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Total
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {formatPaise(order.totalAmount, selectedRestaurant?.currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Primary Next Action Button */}
                      {allowedNext.length > 0 && !isTerminalOrderStatus(order.status) && (
                        <button
                          onClick={() => {
                            const nextTarget = allowedNext[0];
                            if (!nextTarget) return;
                            if (nextTarget === 'cancelled') {
                              setSelectedOrder(order);
                              setTransitioningStatus('cancelled');
                            } else {
                              handleUpdateStatus(order.id, nextTarget);
                            }
                          }}
                          disabled={isUpdatingStatus}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50"
                        >
                          {allowedNext[0] === 'accepted' && 'Accept'}
                          {allowedNext[0] === 'preparing' && 'Cook'}
                          {allowedNext[0] === 'ready' && 'Ready'}
                          {allowedNext[0] === 'served' && 'Serve'}
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stable Pagination Controls Bar */}
        {paginationMeta && paginationMeta.totalOrders > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-slate-500 font-medium">
              Showing{' '}
              <span className="font-bold text-slate-900">
                {(paginationMeta.page - 1) * paginationMeta.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-bold text-slate-900">
                {Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.totalOrders)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{paginationMeta.totalOrders}</span> orders
            </div>

            <div className="flex items-center gap-2">
              {/* Previous Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!paginationMeta.hasPrevPage || currentPage <= 1 || refreshing}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                {calculatePaginationPages(paginationMeta.page, paginationMeta.totalPages).map((p, idx) => {
                  if (p === 'ellipsis') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 font-medium">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === paginationMeta.page;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      disabled={refreshing}
                      className={`min-w-[32px] h-8 px-2 rounded-xl font-bold transition ${
                        isCurrent
                          ? 'bg-orange-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* Next Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(paginationMeta.totalPages, p + 1))}
                disabled={!paginationMeta.hasNextPage || currentPage >= paginationMeta.totalPages || refreshing}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Page Size:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value={12}>12 / page</option>
                <option value={24}>24 / page</option>
                <option value={48}>48 / page</option>
              </select>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          Order Detail View Modal / Drawer (Requirement 4 & 7)
      ===================================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">
                    Order #{selectedOrder.orderNumber}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      getStatusDisplayInfo(selectedOrder.status).badgeClass
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        getStatusDisplayInfo(selectedOrder.status).dotClass
                      }`}
                    />
                    <span>{getStatusDisplayInfo(selectedOrder.status).label}</span>
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  <p>Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                  {selectedOrder.status === 'served' && selectedOrder.servedAt && (
                    <p className="text-emerald-700 font-semibold">
                      Served on {new Date(selectedOrder.servedAt).toLocaleString()}
                    </p>
                  )}
                  {selectedOrder.status === 'cancelled' && selectedOrder.rejectedAt && (
                    <p className="text-rose-700 font-semibold">
                      Cancelled on {new Date(selectedOrder.rejectedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setStatusActionError(null);
                  setTransitioningStatus(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="py-4 space-y-5 overflow-y-auto flex-1 pr-1">
              {/* Conflict Error Notice */}
              {statusActionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{statusActionError}</span>
                </div>
              )}

              {/* Table & Guest Meta */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    Dine-in Table
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedOrder.table ? selectedOrder.table.tableNumber : 'Unassigned'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    Guest Name / Phone
                  </span>
                  <span className="font-semibold text-slate-900 text-xs">
                    {selectedOrder.customerName || 'Walk-in'}
                    {selectedOrder.customerPhone && ` • ${selectedOrder.customerPhone}`}
                  </span>
                </div>
              </div>

              {/* Items Breakdown with Snapshots */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Ordered Items ({selectedOrder.items.length})
                </h4>
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="p-3 flex items-start justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {item.quantity}x {item.productName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatPaise(item.unitPrice, selectedRestaurant?.currency)} each
                        </div>
                        {item.notes && (
                          <div className="mt-1 text-[11px] text-orange-600 italic">
                            &quot;{item.notes}&quot;
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatPaise(item.subtotal, selectedRestaurant?.currency)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtotal / Total */}
                <div className="flex justify-between items-center px-3 pt-3 text-sm font-black text-slate-900">
                  <span>Authoritative Total</span>
                  <span className="text-emerald-700">
                    {formatPaise(selectedOrder.totalAmount, selectedRestaurant?.currency)}
                  </span>
                </div>
              </div>

              {/* Special Instructions */}
              {selectedOrder.specialInstructions && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                  <span className="font-bold">Order Instructions: </span>
                  <span className="italic">{selectedOrder.specialInstructions}</span>
                </div>
              )}

              {/* Audit History Timeline (Requirement 7) */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Status History Timeline</span>
                </h4>

                {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                  <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2 text-xs">
                    {selectedOrder.statusHistory.map((h) => (
                      <div key={h.id} className="flex items-start justify-between border-b border-slate-100 last:border-none pb-2 last:pb-0">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="capitalize">{h.fromStatus}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="capitalize font-black text-orange-600">{h.toStatus}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            By {h.changedByRole}
                            {h.reason && ` • "${h.reason}"`}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(h.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Initial status created on submission.</p>
                )}
              </div>
            </div>

            {/* Footer: Allowed Status Transitions */}
            <div className="pt-4 border-t border-slate-100 shrink-0">
              {transitioningStatus === 'cancelled' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Reason for Cancellation (Required for Audit Trail)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Customer cancelled, out of ingredients, table left..."
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    maxLength={255}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTransitioningStatus(null)}
                      disabled={isUpdatingStatus}
                      className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                    >
                      Back
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateStatus(selectedOrder.id, 'cancelled', cancellationReason)
                      }
                      disabled={isUpdatingStatus || !cancellationReason.trim()}
                      className="flex-2 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                    >
                      {isUpdatingStatus ? 'Cancelling...' : 'Confirm Cancellation'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 font-medium">
                    Allowed Transitions for <strong className="text-slate-700">{currentRole}</strong>:
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {getAllowedNextStatuses(selectedOrder.status, currentRole).map((target) => (
                      <button
                        key={target}
                        onClick={() => {
                          if (target === 'cancelled') {
                            setTransitioningStatus('cancelled');
                          } else {
                            handleUpdateStatus(selectedOrder.id, target);
                          }
                        }}
                        disabled={isUpdatingStatus}
                        className={`px-3 py-2 text-xs font-bold rounded-xl transition ${
                          target === 'cancelled'
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs'
                        }`}
                      >
                        {target === 'accepted' && 'Accept Order'}
                        {target === 'preparing' && 'Start Cooking'}
                        {target === 'ready' && 'Mark Ready'}
                        {target === 'served' && 'Mark Served'}
                        {target === 'cancelled' && 'Cancel Order'}
                      </button>
                    ))}

                    {getAllowedNextStatuses(selectedOrder.status, currentRole).length === 0 && (
                      <span className="text-xs text-slate-400 italic">
                        {isTerminalOrderStatus(selectedOrder.status)
                          ? 'Terminal order status (Completed)'
                          : 'No permitted actions for this role'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
