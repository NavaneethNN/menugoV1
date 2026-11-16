'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  Tv,
  Film,
  ShoppingBag,
  CreditCard,
  Truck,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  RotateCcw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronRight,
  PieChart,
  Armchair,
  Layers,
  ChefHat,
  XCircle,
  Download,
  ArrowLeft
} from 'lucide-react';

interface ReportSummary {
  totalOrders: number;
  paidOrders: number;
  grossSales: number;
  totalRefunds: number;
  netSales: number;
  avgOrderValue: number;
  deliveredOrders: number;
  cancelledOrders: number;
  deliveryRate: number;
  cancellationRate: number;
  paymentSummary: {
    captured: { count: number; amount: number };
    pending: { count: number; amount: number };
    failed: { count: number; amount: number };
    refunded: { count: number; amount: number };
  };
  fulfilmentSummary: {
    new: number;
    accepted: number;
    preparing: number;
    ready: number;
    assigned: number;
    delivered: number;
    cancelled: number;
  };
}

interface DailySalesRecord {
  date: string;
  totalOrders: number;
  paidOrders: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  deliveredOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
}

interface ScreenReportRecord {
  screenId: string;
  screenName: string;
  screenType: string;
  totalOrders: number;
  paidOrders: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  salesContribution: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

interface ShowReportRecord {
  showId: string;
  movieId: string | null;
  movieTitle: string;
  screenId: string | null;
  screenName: string;
  showDate: string;
  showtime: string;
  totalOrders: number;
  paidOrders: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

interface ProductReportRecord {
  productId: string;
  productName: string;
  categoryName: string;
  quantitySold: number;
  totalRevenue: number;
  salesContribution: number;
  avgPrice: number;
  orderCount: number;
}

interface PaymentProviderRecord {
  provider: string;
  totalCount: number;
  capturedCount: number;
  capturedAmount: number;
  failedCount: number;
  failedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  refundCount: number;
  refundAmount: number;
  netSettlement: number;
}

interface CinemaScreenOption {
  id: string;
  screenName: string;
}

export default function CinemaAdminReportsPage() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<
    'daily' | 'screens' | 'shows' | 'products' | 'payments' | 'fulfilment'
  >('daily');

  // Filter States
  const [dateRange, setDateRange] = useState<string>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [screenFilter, setScreenFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Tenant State
  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreName, setTheatreName] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [currency, setCurrency] = useState<string>('INR');
  const [screensList, setScreensList] = useState<CinemaScreenOption[]>([]);

  // Report Data States
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailySales, setDailySales] = useState<DailySalesRecord[]>([]);
  const [screenReports, setScreenReports] = useState<ScreenReportRecord[]>([]);
  const [showReports, setShowReports] = useState<ShowReportRecord[]>([]);
  const [productReports, setProductReports] = useState<ProductReportRecord[]>([]);
  const [paymentProviders, setPaymentProviders] = useState<PaymentProviderRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load Cinema Tenant Context
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

      // Fetch Screens for Filter
      try {
        const screensRes = await apiRequest('/api/cinema/screens', { theatreId: activeId });
        setScreensList(screensRes.screens || []);
      } catch (err) {
        console.warn('Failed to load screens for filter dropdown:', err);
      }
    } catch (err: any) {
      console.error('Failed to load cinema context:', err);
      setError(err?.message || 'Failed to initialize cinema context');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Reports Data
  const fetchReportData = useCallback(async () => {
    if (!theatreId) return;

    setRefreshing(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        dateRange,
        screenId: screenFilter,
        provider: providerFilter,
        status: statusFilter
      };

      if (dateRange === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await apiRequest('/api/cinema/reports', {
        theatreId,
        params
      });

      if (res.summary) setSummary(res.summary);
      if (res.dailySales) setDailySales(res.dailySales);
      if (res.screenReports) setScreenReports(res.screenReports);
      if (res.showReports) setShowReports(res.showReports);
      if (res.productReports) setProductReports(res.productReports);
      if (res.paymentReports?.providers) setPaymentProviders(res.paymentReports.providers);
      if (res.timezone) setTimezone(res.timezone);
      if (res.currency) setCurrency(res.currency);
    } catch (err: any) {
      console.error('Failed to fetch cinema reports:', err);
      setError(err?.message || 'Failed to load report analytics');
    } finally {
      setRefreshing(false);
    }
  }, [theatreId, dateRange, startDate, endDate, screenFilter, providerFilter, statusFilter]);

  // Trigger report fetch when filters change
  useEffect(() => {
    if (theatreId) {
      fetchReportData();
    }
  }, [theatreId, fetchReportData]);

  // Currency Formatter
  const formatCurrency = (paise: number) => {
    const rupees = paise / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0
    }).format(rupees);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setDateRange('30d');
    setStartDate('');
    setEndDate('');
    setScreenFilter('all');
    setProviderFilter('all');
    setStatusFilter('all');
  };

  const isFiltered =
    dateRange !== '30d' ||
    screenFilter !== 'all' ||
    providerFilter !== 'all' ||
    statusFilter !== 'all';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Task 18 • Reports &amp; Analytics
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-medium">{theatreName || 'Multiplex Console'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-indigo-400" />
            Cinema Reports &amp; Sales Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time financial reconciliation, screen performance, and food sales metrics calculated using operating timezone ({timezone}).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchReportData()}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh Data
          </button>

          <Link
            href="/cinema/admin/orders"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
            View Orders
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Date Range Selector */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Date Preset
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Bounds */}
          {dateRange === 'custom' && (
            <>
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {/* Screen Filter */}
          <div className={dateRange === 'custom' ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Auditorium / Screen
            </label>
            <select
              value={screenFilter}
              onChange={(e) => setScreenFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Screens</option>
              {screensList.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.screenName}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Provider Filter */}
          <div className={dateRange === 'custom' ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Payment Gateway
            </label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Gateways</option>
              <option value="razorpay">Razorpay</option>
              <option value="paytm">Paytm</option>
            </select>
          </div>

          {/* Order Status Filter */}
          <div className={dateRange === 'custom' ? 'lg:col-span-1' : 'lg:col-span-3'}>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered Only</option>
              <option value="open">In-Flight / Open</option>
              <option value="cancelled">Cancelled Only</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        {isFiltered && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Active Filters: Range ({dateRange}) • Screen ({screenFilter === 'all' ? 'All' : 'Selected'})
            </span>
            <button
              onClick={handleResetFilters}
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards (Requirement 1 & 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Gross Sales */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/50 to-slate-900 border border-indigo-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              Gross Captured
            </span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {formatCurrency(summary?.grossSales || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {summary?.paidOrders || 0} paid order(s)
          </div>
        </div>

        {/* Net Sales */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Net Sales
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {formatCurrency(summary?.netSales || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            After refunds deduction
          </div>
        </div>

        {/* Total Refunds */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">
              Total Refunds
            </span>
            <RotateCcw className="w-4 h-4 text-violet-400" />
          </div>
          <div className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {formatCurrency(summary?.totalRefunds || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Authorized by admin</div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
              Average Order Value
            </span>
            <PieChart className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {formatCurrency(summary?.avgOrderValue || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Per paid cinema basket</div>
        </div>

        {/* Delivery Completion Rate */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Delivered To Seat
            </span>
            <Truck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {summary?.deliveredOrders || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {summary?.deliveryRate || 0}% completion rate
          </div>
        </div>

        {/* Cancellation Rate */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              Cancelled / Void
            </span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {summary?.cancelledOrders || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {summary?.cancellationRate || 0}% of all orders
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Daily Sales
        </button>

        <button
          onClick={() => setActiveTab('screens')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'screens'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Tv className="w-4 h-4" />
          Screen-Wise Sales
        </button>

        <button
          onClick={() => setActiveTab('shows')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'shows'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Film className="w-4 h-4" />
          Show-Wise Sales
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'products'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Product Sales
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Gateways
        </button>

        <button
          onClick={() => setActiveTab('fulfilment')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'fulfilment'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Order Fulfilment
        </button>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="p-16 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
          <p className="text-sm text-slate-300 font-medium">Calculating cinema reports...</p>
          <p className="text-xs text-slate-500 mt-1">Aggregating actual database records across screens and shows</p>
        </div>
      )}

      {/* =========================================================================
          TAB 1: DAILY SALES REPORT (Requirement 2)
         ========================================================================= */}
      {!loading && activeTab === 'daily' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div>
              <h3 className="font-bold text-white text-base">Daily Sales Breakdown</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Food and beverage sales grouped by operating date in {timezone}.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {dailySales.length} operating date(s)
            </span>
          </div>

          {dailySales.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              No sales records found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Operating Date</th>
                    <th className="py-3 px-4">Total Orders</th>
                    <th className="py-3 px-4">Paid Orders</th>
                    <th className="py-3 px-4">Gross Sales</th>
                    <th className="py-3 px-4">Refunds</th>
                    <th className="py-3 px-4 font-bold text-emerald-400">Net Sales</th>
                    <th className="py-3 px-4">AOV</th>
                    <th className="py-3 px-4">Delivered</th>
                    <th className="py-3 px-4">Cancelled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {dailySales.map((d) => (
                    <tr key={d.date} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-white">
                        {d.date}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{d.totalOrders}</td>
                      <td className="py-3.5 px-4 text-slate-300">{d.paidOrders}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {formatCurrency(d.grossSales)}
                      </td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">
                        {d.refunds > 0 ? `-${formatCurrency(d.refunds)}` : '₹0'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {formatCurrency(d.netSales)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {formatCurrency(d.avgOrderValue)}
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">
                        {d.deliveredOrders}
                      </td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">
                        {d.cancelledOrders}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: SCREEN-WISE REPORT (Requirement 3)
         ========================================================================= */}
      {!loading && activeTab === 'screens' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="font-bold text-white text-base">Screen-Wise Sales Comparison</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compare food revenue, order volume, and revenue contribution across auditoriums.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {screenReports.length} screen(s) configured
              </span>
            </div>

            {screenReports.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                No screen sales records found for the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Screen Name</th>
                      <th className="py-3 px-4">Screen Type</th>
                      <th className="py-3 px-4">Orders</th>
                      <th className="py-3 px-4">Gross Revenue</th>
                      <th className="py-3 px-4">Refunds</th>
                      <th className="py-3 px-4 font-bold text-emerald-400">Net Sales</th>
                      <th className="py-3 px-4">Revenue Contribution</th>
                      <th className="py-3 px-4">Fulfilled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {screenReports.map((sc) => (
                      <tr key={sc.screenId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-white flex items-center gap-2">
                          <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>{sc.screenName}</span>
                        </td>
                        <td className="py-3.5 px-4 capitalize text-slate-400 text-xs font-medium">
                          {sc.screenType}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{sc.totalOrders}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                          {formatCurrency(sc.grossSales)}
                        </td>
                        <td className="py-3.5 px-4 text-rose-400 text-xs font-medium">
                          {sc.refunds > 0 ? `-${formatCurrency(sc.refunds)}` : '₹0'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">
                          {formatCurrency(sc.netSales)}
                        </td>
                        <td className="py-3.5 px-4 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, sc.salesContribution)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-indigo-300">
                              {sc.salesContribution}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-emerald-400 text-xs font-semibold">
                          {sc.deliveredOrders} delivered
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SHOW-WISE REPORT (Requirement 4)
         ========================================================================= */}
      {!loading && activeTab === 'shows' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div>
              <h3 className="font-bold text-white text-base">Show-Wise Performance</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Food sales and order counts broken down by movie title and screening schedule.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {showReports.length} show(s) with activity
            </span>
          </div>

          {showReports.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              No show screening records found for the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Movie Title</th>
                    <th className="py-3 px-4">Screen</th>
                    <th className="py-3 px-4">Show Date</th>
                    <th className="py-3 px-4">Showtime</th>
                    <th className="py-3 px-4">Orders</th>
                    <th className="py-3 px-4">Gross Sales</th>
                    <th className="py-3 px-4 font-bold text-emerald-400">Net Sales</th>
                    <th className="py-3 px-4">Delivered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {showReports.map((sh) => (
                    <tr key={sh.showId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-white flex items-center gap-2">
                        <Film className="w-4 h-4 text-violet-400 shrink-0" />
                        <span>{sh.movieTitle}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs font-semibold">
                        {sh.screenName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs">{sh.showDate}</td>
                      <td className="py-3.5 px-4 text-indigo-300 font-mono text-xs">
                        {sh.showtime || 'In Progress'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{sh.totalOrders}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {formatCurrency(sh.grossSales)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {formatCurrency(sh.netSales)}
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 text-xs font-semibold">
                        {sh.deliveredOrders}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: PRODUCT-WISE REPORT (Requirement 5)
         ========================================================================= */}
      {!loading && activeTab === 'products' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div>
              <h3 className="font-bold text-white text-base">Product Sales &amp; Menu Contribution</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Quantities sold, total revenue, and contribution percentage for cinema food products.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {productReports.length} product(s) sold
            </span>
          </div>

          {productReports.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              No product sales records found for the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Qty Sold</th>
                    <th className="py-3 px-4 font-bold text-white">Total Revenue</th>
                    <th className="py-3 px-4">Contribution</th>
                    <th className="py-3 px-4">Avg Selling Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {productReports.map((p) => (
                    <tr key={p.productId || p.productName} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>{p.productName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {p.categoryName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-semibold">{p.quantitySold}</td>
                      <td className="py-3.5 px-4 font-bold text-indigo-300">
                        {formatCurrency(p.totalRevenue)}
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(100, p.salesContribution)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-indigo-300">
                            {p.salesContribution}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {formatCurrency(p.avgPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: PAYMENT GATEWAY REPORT (Requirement 6)
         ========================================================================= */}
      {!loading && activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentProviders.map((prov) => {
              const isRazorpay = prov.provider.toLowerCase() === 'razorpay';
              return (
                <div
                  key={prov.provider}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-white text-base capitalize">
                          {prov.provider} Gateway
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          {prov.totalCount} total transaction(s)
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Net: {formatCurrency(prov.netSettlement)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block text-[11px]">Captured Volume</span>
                      <span className="font-bold text-emerald-400 text-sm mt-0.5 block">
                        {formatCurrency(prov.capturedAmount)}
                      </span>
                      <span className="text-[10px] text-slate-500">{prov.capturedCount} captured</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block text-[11px]">Refunds Deducted</span>
                      <span className="font-bold text-rose-400 text-sm mt-0.5 block">
                        -{formatCurrency(prov.refundAmount)}
                      </span>
                      <span className="text-[10px] text-slate-500">{prov.refundCount} refund(s)</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block text-[11px]">Pending / In-Flight</span>
                      <span className="font-bold text-amber-400 text-sm mt-0.5 block">
                        {formatCurrency(prov.pendingAmount)}
                      </span>
                      <span className="text-[10px] text-slate-500">{prov.pendingCount} pending</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 block text-[11px]">Failed Attempts</span>
                      <span className="font-bold text-slate-400 text-sm mt-0.5 block">
                        {formatCurrency(prov.failedAmount)}
                      </span>
                      <span className="text-[10px] text-slate-500">{prov.failedCount} failed</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: ORDER FULFILMENT REPORT (Requirement 7)
         ========================================================================= */}
      {!loading && activeTab === 'fulfilment' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
          <div>
            <h3 className="font-bold text-white text-base">Cinema Order Fulfilment Pipeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Lifecycle status breakdown from customer seat order confirmation to delivery handoff.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                New
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                {summary?.fulfilmentSummary.new || 0}
              </span>
              <span className="text-[10px] text-slate-500">Incoming</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                Accepted
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                {summary?.fulfilmentSummary.accepted || 0}
              </span>
              <span className="text-[10px] text-slate-500">Acknowledged</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Preparing
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                {summary?.fulfilmentSummary.preparing || 0}
              </span>
              <span className="text-[10px] text-slate-500">In Kitchen</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Ready
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                {summary?.fulfilmentSummary.ready || 0}
              </span>
              <span className="text-[10px] text-slate-500">Packed</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                Runner Out
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                {summary?.fulfilmentSummary.assigned || 0}
              </span>
              <span className="text-[10px] text-slate-500">To Seat</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Delivered
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                {summary?.fulfilmentSummary.delivered || 0}
              </span>
              <span className="text-[10px] text-slate-500">Completed</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                Cancelled
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                {summary?.fulfilmentSummary.cancelled || 0}
              </span>
              <span className="text-[10px] text-slate-500">Voided</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <span className="font-bold text-white block">Fulfilment Success Benchmark</span>
              <span className="text-slate-400">
                {summary?.deliveredOrders || 0} out of {summary?.totalOrders || 0} orders successfully handed to customers.
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Fulfilment Rate</span>
                <span className="text-base font-black text-emerald-400">{summary?.deliveryRate || 0}%</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Cancellation Rate</span>
                <span className="text-base font-black text-rose-400">{summary?.cancellationRate || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
