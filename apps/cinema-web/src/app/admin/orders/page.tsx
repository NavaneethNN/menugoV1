'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  ShoppingBag,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Tv,
  Armchair,
  Film,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Truck,
  ChefHat,
  ChevronRight,
  Eye,
  X,
  CreditCard,
  User,
  Phone,
  Calendar,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Loader2,
  FileText,
  DollarSign,
  ArrowUpRight,
  Check,
  RotateCcw,
  ArrowLeft
} from 'lucide-react';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
}

interface OrderHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId: string | null;
  changedByRole: string | null;
  reason: string | null;
  createdAt: string;
}

interface CinemaPaymentRecord {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  amount: number;
  currency: string;
  status: string;
  refundStatus: string | null;
  refundAmount: number;
  createdAt: string;
}

interface CinemaRefundRecord {
  id: string;
  providerRefundId: string | null;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

interface CinemaOrder {
  id: string;
  orderNumber: string;
  theatreId: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  specialInstructions: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  updatedAt: string;
  elapsedMinutes: number;
  screenId: string | null;
  screen?: {
    id: string;
    name: string;
    screenName: string;
    screenType: string;
  } | null;
  movieId: string | null;
  movie?: {
    id: string;
    title: string;
    language?: string;
    posterUrl?: string | null;
    durationMinutes?: number;
  } | null;
  showId: string | null;
  show?: {
    id: string;
    showDate: string;
    startTime: string;
    expectedEndTime?: string;
    status: string;
  } | null;
  showDate?: string | null;
  showtime?: string | null;
  seatRow: string | null;
  seatNumber: string | null;
  deliveryStatus?: string;
  deliveryStaffName?: string | null;
  assignedAt?: string | null;
  deliveredAt?: string | null;
  items: OrderItem[];
  statusHistory?: OrderHistoryEntry[];
  paymentTransaction?: CinemaPaymentRecord | null;
  refunds?: CinemaRefundRecord[];
}

interface OrderCounters {
  total: number;
  todaySales: number;
  newOrders: number;
  preparingOrders: number;
  readyOrders: number;
  assignedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

interface CinemaScreenOption {
  id: string;
  screenName: string;
}

export default function CinemaAdminOrdersPage() {
  const [orders, setOrders] = useState<CinemaOrder[]>([]);
  const [screens, setScreens] = useState<CinemaScreenOption[]>([]);
  const [summary, setSummary] = useState<OrderCounters>({
    total: 0,
    todaySales: 0,
    newOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    assignedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tenant State
  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreName, setTheatreName] = useState<string>('');

  // Filter States
  const [dateRange, setDateRange] = useState<string>('today');
  const [screenFilter, setScreenFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  // Realtime Polling Toggle
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Modal / Drawer States
  const [selectedOrder, setSelectedOrder] = useState<CinemaOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);

  // Status Action Modal State
  const [actionOrder, setActionOrder] = useState<CinemaOrder | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [actionTargetStatus, setActionTargetStatus] = useState<string>('');
  const [actionReason, setActionReason] = useState<string>('');
  const [actionDeliveryStaff, setActionDeliveryStaff] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cancel Modal State
  const [cancelOrderTarget, setCancelOrderTarget] = useState<CinemaOrder | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Initialize Theatre Context
  useEffect(() => {
    loadTheatreContext();
  }, []);

  const loadTheatreContext = async () => {
    try {
      setLoading(true);
      setError(null);

      const myTenants = await apiRequest('/api/restaurants/my?tenantType=cinema');
      const activeTheatre = myTenants.find((m: any) => m.restaurant?.tenantType === 'cinema');

      if (!activeTheatre) {
        setError('No cinema theatre account found. Please register a theatre first.');
        setLoading(false);
        return;
      }

      const activeId = activeTheatre.restaurant.id;
      setTheatreId(activeId);
      setTheatreName(activeTheatre.restaurant.name);

      // Load screens for filter dropdown
      try {
        const screensRes = await apiRequest('/api/cinema/screens', { theatreId: activeId });
        setScreens(screensRes.screens || []);
      } catch (screenErr) {
        console.warn('Failed to fetch screens list:', screenErr);
      }
    } catch (err: any) {
      console.error('Failed to load cinema context:', err);
      setError(err?.message || 'Failed to initialize theatre account');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Orders
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!theatreId) return;

    if (!isSilent) setRefreshing(true);
    setError(null);

    try {
      const params: Record<string, string | number> = {
        dateRange,
        screenId: screenFilter,
        status: statusFilter,
        paymentStatus: paymentStatusFilter,
        deliveryStatus: deliveryStatusFilter,
        page,
        limit: 25
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await apiRequest('/api/cinema/orders', {
        theatreId,
        params
      });

      setOrders(res.orders || []);
      if (res.summary) setSummary(res.summary);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalOrders(res.pagination.total || 0);
      }
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      if (!isSilent) {
        setError(err?.message || 'Failed to fetch cinema orders');
      }
    } finally {
      if (!isSilent) setRefreshing(false);
    }
  }, [
    theatreId,
    dateRange,
    screenFilter,
    statusFilter,
    paymentStatusFilter,
    deliveryStatusFilter,
    searchQuery,
    page
  ]);

  // Trigger fetch whenever filters change
  useEffect(() => {
    if (theatreId) {
      fetchOrders(false);
    }
  }, [theatreId, fetchOrders]);

  // Auto-refresh interval (every 15 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh || !theatreId) return;
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, theatreId, fetchOrders]);

  // Open Detailed Order View
  const handleViewOrder = async (order: CinemaOrder) => {
    setSelectedOrder(order);
    setIsDetailDrawerOpen(true);
    setDetailLoading(true);

    try {
      const detailRes = await apiRequest(`/api/cinema/orders/${order.id}`, {
        theatreId: theatreId || undefined
      });
      if (detailRes.order) {
        setSelectedOrder(detailRes.order);
      }
    } catch (err: any) {
      console.error('Failed to load order full details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Status Progression Modal
  const handleOpenStatusModal = (order: CinemaOrder, targetStatus?: string) => {
    setActionOrder(order);
    setActionTargetStatus(targetStatus || getDefaultNextStatus(order.status));
    setActionReason('');
    setActionDeliveryStaff(order.deliveryStaffName || '');
    setActionError(null);
    setIsStatusModalOpen(true);
  };

  // Submit Status Change
  const handleSubmitStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionOrder || !theatreId) return;

    setActionSubmitting(true);
    setActionError(null);

    try {
      const payload: Record<string, string> = {
        toStatus: actionTargetStatus,
        reason: actionReason || `Admin transitioned to ${actionTargetStatus}`
      };

      if (actionTargetStatus === 'assigned_for_delivery' && actionDeliveryStaff.trim()) {
        payload.deliveryStaffName = actionDeliveryStaff.trim();
      }

      await apiRequest(`/api/cinema/orders/${actionOrder.id}/status`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify(payload)
      });

      setSuccessMessage(`Order #${actionOrder.orderNumber} transitioned to ${actionTargetStatus}`);
      setIsStatusModalOpen(false);

      // If drawer was open for this order, refresh details
      if (selectedOrder && selectedOrder.id === actionOrder.id) {
        handleViewOrder(actionOrder);
      }

      fetchOrders(false);
    } catch (err: any) {
      console.error('Failed to transition order status:', err);
      setActionError(err?.message || 'Failed to update order status');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (order: CinemaOrder) => {
    setCancelOrderTarget(order);
    setCancelReason('');
    setCancelError(null);
    setIsCancelModalOpen(true);
  };

  // Submit Cancel
  const handleSubmitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrderTarget || !theatreId) return;

    if (!cancelReason.trim()) {
      setCancelError('Please provide a mandatory reason for cancelling this order.');
      return;
    }

    setCancelSubmitting(true);
    setCancelError(null);

    try {
      await apiRequest(`/api/cinema/orders/${cancelOrderTarget.id}/cancel`, {
        method: 'POST',
        theatreId,
        body: JSON.stringify({ reason: cancelReason.trim() })
      });

      setSuccessMessage(`Order #${cancelOrderTarget.orderNumber} has been cancelled.`);
      setIsCancelModalOpen(false);

      if (selectedOrder && selectedOrder.id === cancelOrderTarget.id) {
        handleViewOrder(cancelOrderTarget);
      }

      fetchOrders(false);
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      setCancelError(err?.message || 'Failed to cancel order');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Helper to get logical next status
  const getDefaultNextStatus = (currentStatus: string): string => {
    switch (currentStatus) {
      case 'new':
      case 'confirmed':
        return 'accepted';
      case 'accepted':
      case 'preparing':
        return 'ready';
      case 'ready':
        return 'assigned_for_delivery';
      case 'assigned_for_delivery':
        return 'delivered';
      default:
        return 'delivered';
    }
  };

  // Format INR Currency
  const formatCurrency = (paiseOrRupees: number) => {
    const rupees = paiseOrRupees > 1000 ? paiseOrRupees / 100 : paiseOrRupees;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(rupees);
  };

  // Order Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            New
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Accepted
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Preparing
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Check className="w-3 h-3 text-emerald-400" />
            Ready
          </span>
        );
      case 'assigned_for_delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Truck className="w-3 h-3 text-purple-400" />
            Seat Delivery
          </span>
        );
      case 'delivered':
      case 'served':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Delivered
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3 text-rose-400" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  // Payment Status Badge Component
  const renderPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Check className="w-3 h-3" /> Paid
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <RotateCcw className="w-3 h-3" /> Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setDateRange('today');
    setScreenFilter('all');
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setDeliveryStatusFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const isFiltered =
    dateRange !== 'today' ||
    screenFilter !== 'all' ||
    statusFilter !== 'all' ||
    paymentStatusFilter !== 'all' ||
    deliveryStatusFilter !== 'all' ||
    searchQuery.trim() !== '';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/cinema/admin/dashboard"
              className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Orders
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-medium">{theatreName || 'Cinema Admin'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-indigo-400" />
            Cinema Order Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor incoming seat orders, track preparation progress, and audit deliveries in real time.
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {autoRefresh ? 'Auto Refresh On (15s)' : 'Auto Refresh Paused'}
          </button>

          <button
            onClick={() => fetchOrders(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>

          <Link
            href="/cinema/kitchen"
            target="_blank"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
          >
            <ChefHat className="w-3.5 h-3.5" />
            Kitchen KDS
            <ArrowUpRight className="w-3 h-3 opacity-70" />
          </Link>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              Today&apos;s Sales
            </span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-xl font-black text-white tracking-tight">
            {formatCurrency(summary.todaySales)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Captured revenue</div>
        </div>

        {/* New / Incoming */}
        <div
          onClick={() => setStatusFilter('new')}
          className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
              New
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <div className="mt-2 text-xl font-black text-white group-hover:text-blue-400 transition-colors">
            {summary.newOrders}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Needs acceptance</div>
        </div>

        {/* Preparing */}
        <div
          onClick={() => setStatusFilter('preparing')}
          className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Preparing
            </span>
            <ChefHat className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-black text-white group-hover:text-amber-400 transition-colors">
            {summary.preparingOrders}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">In kitchen</div>
        </div>

        {/* Ready */}
        <div
          onClick={() => setStatusFilter('ready')}
          className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Ready
            </span>
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-black text-white group-hover:text-emerald-400 transition-colors">
            {summary.readyOrders}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Waiting runner</div>
        </div>

        {/* Seat Delivery Assigned */}
        <div
          onClick={() => setStatusFilter('assigned_for_delivery')}
          className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
              Runner
            </span>
            <Truck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-xl font-black text-white group-hover:text-purple-400 transition-colors">
            {summary.assignedOrders}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Out to seat</div>
        </div>

        {/* Delivered */}
        <div
          onClick={() => setStatusFilter('delivered')}
          className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Delivered
            </span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-black text-white group-hover:text-slate-200 transition-colors">
            {summary.deliveredOrders}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Completed</div>
        </div>

        {/* Cancelled */}
        <div
          onClick={() => setStatusFilter('cancelled')}
          className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              Cancelled
            </span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-xl font-black text-white group-hover:text-rose-400 transition-colors">
            {summary.cancelledOrders}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Voided / Rejected</div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Query */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Seat (Row/No), Customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Date Range Selector */}
          <div className="lg:col-span-2">
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Dates</option>
            </select>
          </div>

          {/* Screen Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={screenFilter}
              onChange={(e) => {
                setScreenFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Screens</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.screenName}
                </option>
              ))}
            </select>
          </div>

          {/* Order Status Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="open">Active / In-Flight</option>
              <option value="new">New (Incoming)</option>
              <option value="accepted">Accepted</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="assigned_for_delivery">Seat Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid (Confirmed)</option>
              <option value="pending">Pending Payment</option>
              <option value="failed">Failed Payment</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Filter status row */}
        {isFiltered && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Filters active • Showing {orders.length} of {totalOrders} orders</span>
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Orders Table Container */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
            <p className="text-sm text-slate-300 font-medium">Loading cinema orders...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving live seat and payment context</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-4">
              <ShoppingBag className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-white">No cinema orders found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {isFiltered
                ? 'Try adjusting your search criteria or resetting filters to see more results.'
                : 'Confirmed customer food orders placed from seat QR codes will appear here automatically.'}
            </p>
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Order #</th>
                  <th className="py-3.5 px-4">Screen & Seat</th>
                  <th className="py-3.5 px-4">Movie & Showtime</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {orders.map((order) => {
                  const screenLabel = order.screen?.name || order.screen?.screenName || 'Screen';
                  const seatLabel =
                    order.seatRow && order.seatNumber
                      ? `Row ${order.seatRow} • Seat ${order.seatNumber}`
                      : 'Seat pending';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      onClick={() => handleViewOrder(order)}
                    >
                      {/* Order Number & Time */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-white tracking-tight flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors">
                            #{order.orderNumber}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {order.elapsedMinutes === 0
                              ? 'Just now'
                              : `${order.elapsedMinutes}m ago`}
                          </span>
                        </div>
                      </td>

                      {/* Screen & Seat */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                            <Tv className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{screenLabel}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-xs mt-0.5">
                            <Armchair className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{seatLabel}</span>
                          </div>
                        </div>
                      </td>

                      {/* Movie & Showtime */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-medium text-slate-200 truncate text-xs flex items-center gap-1">
                            <Film className="w-3 h-3 text-violet-400 shrink-0" />
                            {order.movie?.title || 'Current Show'}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            {order.showtime ? `Showtime: ${order.showtime}` : 'Show Active'}
                          </span>
                        </div>
                      </td>

                      {/* Items Preview */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col max-w-[220px]">
                          <span className="font-medium text-slate-200 text-xs truncate">
                            {order.items?.length > 0
                              ? order.items
                                  .map((i) => `${i.quantity}x ${i.productName}`)
                                  .join(', ')
                              : 'No items'}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            {order.items?.length || 0} product(s)
                          </span>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-4 font-bold text-white">
                        {formatCurrency(order.totalAmount)}
                      </td>

                      {/* Payment Status */}
                      <td className="py-4 px-4">
                        {renderPaymentBadge(order.paymentStatus)}
                      </td>

                      {/* Order Status */}
                      <td className="py-4 px-4">
                        {renderStatusBadge(order.status)}
                      </td>

                      {/* Action Buttons */}
                      <td
                        className="py-4 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="View Full Details"
                            onClick={() => handleViewOrder(order)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quick Progress Button */}
                          {order.status !== 'delivered' &&
                            order.status !== 'served' &&
                            order.status !== 'cancelled' &&
                            order.status !== 'rejected' && (
                              <button
                                title={`Advance status from ${order.status}`}
                                onClick={() => handleOpenStatusModal(order)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all"
                              >
                                {order.status === 'new'
                                  ? 'Accept'
                                  : order.status === 'accepted' || order.status === 'preparing'
                                  ? 'Mark Ready'
                                  : order.status === 'ready'
                                  ? 'Assign Runner'
                                  : 'Deliver'}
                              </button>
                            )}

                          {/* Quick Cancel Button */}
                          {order.status !== 'delivered' &&
                            order.status !== 'served' &&
                            order.status !== 'cancelled' &&
                            order.status !== 'rejected' && (
                              <button
                                title="Administrative Cancel"
                                onClick={() => handleOpenCancelModal(order)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} • Total {totalOrders} orders
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          ORDER DETAILS DRAWER / MODAL
         ========================================================================= */}
      {isDetailDrawerOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white tracking-tight">
                      Order #{selectedOrder.orderNumber}
                    </h2>
                    {renderStatusBadge(selectedOrder.status)}
                    {renderPaymentBadge(selectedOrder.paymentStatus)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Placed at {new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(selectedOrder.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {detailLoading && (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-indigo-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading full transaction details...</span>
                </div>
              )}

              {/* Theatre & Seat Context Card */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-3">
                <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Armchair className="w-4 h-4 text-indigo-400" />
                  Auditorium & Seat Location
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Screen</span>
                    <span className="text-sm font-bold text-white">
                      {selectedOrder.screen?.name || selectedOrder.screen?.screenName || 'Screen'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Row</span>
                    <span className="text-sm font-bold text-indigo-300">
                      Row {selectedOrder.seatRow || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Seat Number</span>
                    <span className="text-sm font-bold text-indigo-300">
                      Seat {selectedOrder.seatNumber || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Screen Type</span>
                    <span className="text-sm font-bold text-slate-200 capitalize">
                      {selectedOrder.screen?.screenType || 'Standard'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Movie & Showtime */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-violet-400" />
                  Movie & Show Information
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {selectedOrder.movie?.title || 'Cinema Screening'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedOrder.movie?.language ? `Language: ${selectedOrder.movie.language}` : ''}
                      {selectedOrder.movie?.durationMinutes ? ` • ${selectedOrder.movie.durationMinutes} mins` : ''}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 self-start">
                    Showtime: {selectedOrder.showtime || 'In Progress'}
                  </div>
                </div>
              </div>

              {/* Customer & Delivery Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Customer Details
                  </span>
                  <div className="text-xs space-y-1 pt-1">
                    <div className="font-semibold text-white">
                      {selectedOrder.customerName || 'Anonymous Cinema Guest'}
                    </div>
                    {selectedOrder.customerPhone && (
                      <div className="text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {selectedOrder.customerPhone}
                      </div>
                    )}
                    {selectedOrder.specialInstructions && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] mt-2">
                        <strong>Note:</strong> {selectedOrder.specialInstructions}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-purple-400" />
                    Seat Delivery Staff
                  </span>
                  <div className="text-xs space-y-1.5 pt-1">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Runner / Staff</span>
                      <span className="font-semibold text-white">
                        {selectedOrder.deliveryStaffName || 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Delivery Status</span>
                      <span className="font-semibold text-purple-300 capitalize">
                        {selectedOrder.deliveryStatus || 'unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Order Bill */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Itemized Order Breakdown
                </div>
                <div className="divide-y divide-slate-800/80">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">
                          {item.quantity}x {item.productName}
                        </span>
                        {item.notes && (
                          <span className="block text-[11px] text-slate-400 italic">
                            ({item.notes})
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-white">
                          {formatCurrency(item.totalPrice)}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {formatCurrency(item.unitPrice)} each
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bill Totals */}
                <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Taxes & GST</span>
                    <span>{formatCurrency(selectedOrder.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-slate-800">
                    <span>Total Amount</span>
                    <span className="text-indigo-400">{formatCurrency(selectedOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Payment & Transaction Details
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Payment Method</span>
                    <span className="font-semibold text-white uppercase">
                      {selectedOrder.paymentMethod || 'Online Gateway'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Payment Status</span>
                    <span className="font-semibold text-emerald-400 uppercase">
                      {selectedOrder.paymentStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Transaction Reference</span>
                    <span className="font-mono text-slate-300 text-[11px] break-all">
                      {selectedOrder.paymentReference || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Provider Transaction ID</span>
                    <span className="font-mono text-slate-300 text-[11px] break-all">
                      {selectedOrder.paymentTransaction?.providerPaymentId || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Refund Record if any */}
                {selectedOrder.refunds && selectedOrder.refunds.length > 0 && (
                  <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs mt-2 space-y-1">
                    <div className="font-bold text-violet-300 flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Refund Record
                    </div>
                    {selectedOrder.refunds.map((ref) => (
                      <div key={ref.id} className="flex justify-between text-slate-300 text-[11px]">
                        <span>Amount: {formatCurrency(ref.amount)} ({ref.status})</span>
                        <span className="text-slate-400">{ref.reason || 'Admin Authorized'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Status History / Audit Trail */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Chronological Lifecycle History
                </div>
                {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {selectedOrder.statusHistory.map((h) => (
                      <div key={h.id} className="relative text-xs">
                        <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white capitalize">{h.toStatus}</span>
                          <span className="text-[10px] text-slate-500">
                            (from {h.fromStatus})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {h.reason || 'Status update recorded'}
                        </p>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>By: {h.changedByRole || 'System'}</span>
                          <span>•</span>
                          <span>{new Date(h.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No historical transitions recorded.</p>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Close View
              </button>

              <div className="flex items-center gap-2">
                {selectedOrder.status !== 'delivered' &&
                  selectedOrder.status !== 'served' &&
                  selectedOrder.status !== 'cancelled' &&
                  selectedOrder.status !== 'rejected' && (
                    <>
                      <button
                        onClick={() => handleOpenCancelModal(selectedOrder)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all"
                      >
                        Cancel Order
                      </button>
                      <button
                        onClick={() => handleOpenStatusModal(selectedOrder)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                      >
                        Update Status
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADMIN STATUS TRANSITION MODAL
         ========================================================================= */}
      {isStatusModalOpen && actionOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base">
                  Update Order #{actionOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStatusChange} className="p-5 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Status
                </label>
                <select
                  value={actionTargetStatus}
                  onChange={(e) => setActionTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="accepted">Accepted (Acknowledge)</option>
                  <option value="preparing">Preparing (Cooking/Packaging)</option>
                  <option value="ready">Ready (Ready for Seat Runner)</option>
                  <option value="assigned_for_delivery">Seat Delivery (Out with Runner)</option>
                  <option value="delivered">Delivered (Handed to Customer at Seat)</option>
                </select>
              </div>

              {actionTargetStatus === 'assigned_for_delivery' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Delivery Staff Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul - Staff 4"
                    value={actionDeliveryStaff}
                    onChange={(e) => setActionDeliveryStaff(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Audit Notes / Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dispatched to screen runner"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Transition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADMIN CANCELLATION MODAL
         ========================================================================= */}
      {isCancelModalOpen && cancelOrderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-rose-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base">
                  Cancel Order #{cancelOrderTarget.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCancel} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                <strong>Administrative Warning:</strong> Cancelling this order voids preparation
                and marks the order as cancelled. An audit entry will be recorded.
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {cancelError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cancellation Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Customer requested cancellation due to seat relocation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {cancelSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
