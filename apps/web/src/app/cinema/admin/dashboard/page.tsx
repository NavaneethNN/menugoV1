'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { formatPaise } from '@/lib/utils';
import {
  Film,
  Tv,
  CalendarDays,
  ShoppingBag,
  ChefHat,
  Truck,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Clapperboard,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  UtensilsCrossed,
  CreditCard,
  QrCode,
  Zap,
  Settings,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  ExternalLink,
  MapPin,
  Eye,
  Armchair
} from 'lucide-react';

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customerName?: string | null;
  seatRow?: string | null;
  seatNumber?: string | null;
  screen?: {
    screenName: string;
  } | null;
  items?: Array<{
    productName: string;
    quantity: number;
  }>;
  createdAt: string;
}

interface TodayShow {
  id: string;
  screenName?: string;
  movieTitle?: string;
  startTime: string;
  expectedEndTime: string;
  orderingStartTime: string;
  orderingEndTime: string;
  status: string;
}

export default function CinemaAdminDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [todayShows, setTodayShows] = useState<TodayShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wizardCollapsed, setWizardCollapsed] = useState<boolean>(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // Fetch cinema memberships to get active theatre ID
      const myTenants = await apiRequest('/api/restaurants/my?tenantType=cinema');
      const activeTheatre = myTenants.find((m: any) => m.restaurant?.tenantType === 'cinema');

      if (!activeTheatre) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const activeTheatreId = activeTheatre.restaurant.id;
      const todayStr = new Date().toISOString().split('T')[0]!;

      // Parallel fetch summary, onboarding status, recent orders & today's shows
      const [summaryData, onboardingData, ordersData, showsData] = await Promise.all([
        apiRequest('/api/cinema/dashboard/summary', {
          theatreId: activeTheatreId
        }).catch((err) => {
          console.warn('Could not load summary:', err);
          return null;
        }),
        apiRequest('/api/cinema/onboarding/status', {
          theatreId: activeTheatreId
        }).catch((err) => {
          console.warn('Could not load onboarding status:', err);
          return null;
        }),
        apiRequest('/api/cinema/orders', {
          theatreId: activeTheatreId,
          params: { date: 'today', limit: 5 }
        }).catch((err) => {
          console.warn('Could not load recent orders:', err);
          return { orders: [] };
        }),
        apiRequest('/api/cinema/shows', {
          theatreId: activeTheatreId,
          params: { date: todayStr }
        }).catch((err) => {
          console.warn('Could not load today shows:', err);
          return { shows: [] };
        })
      ]);

      setSummary(summaryData);
      setOnboarding(onboardingData);
      setRecentOrders(ordersData?.orders || []);
      setTodayShows(showsData?.shows || []);

      if (onboardingData?.isComplete || (onboardingData?.percentage ?? 0) === 100) {
        setWizardCollapsed(true);
      }
    } catch (err: any) {
      console.error('Failed to load cinema dashboard data:', err);
      setError(err?.message || 'Failed to fetch cinema summary');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Connecting to Theatre Operations Console...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-950/30 border border-red-800/50 rounded-2xl text-red-300 flex items-center justify-between gap-3 max-w-4xl mx-auto mt-8">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => loadDashboardData()}
          className="px-3.5 py-1.5 rounded-xl bg-red-900/60 hover:bg-red-800 text-xs font-bold text-white transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const theatre = summary?.theatre;
  const currency = theatre?.currency || 'INR';

  // Live stats
  const stats = summary?.stats || {
    todayOrders: recentOrders.length,
    todaySales: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    activeScreens: 0,
    todayShows: todayShows.length
  };

  // Real calculation from loaded orders if stats.todayOrders is 0
  const activePreparingCount = recentOrders.filter(
    (o) => o.status === 'preparing' || o.status === 'accepted' || o.status === 'new'
  ).length;
  const activeReadyCount = recentOrders.filter((o) => o.status === 'ready').length;

  const stages = onboarding?.stages || [
    { key: 'profile_completed', step: 1, title: 'Theatre Profile', description: 'Name, city, contact & currency', isCompleted: true, isLocked: false, phase: 1 },
    { key: 'screens_added', step: 2, title: 'Auditoriums & Screens', description: 'Screen names & projection types', isCompleted: false, isLocked: false, phase: 1 },
    { key: 'seating_configured', step: 3, title: 'Seating Layout', description: 'Rows (A-Z) and seat numbers', isCompleted: false, isLocked: true, phase: 1 },
    { key: 'menu_configured', step: 4, title: 'Concessions Menu', description: 'Popcorn, snacks & beverages', isCompleted: false, isLocked: true, phase: 2 },
    { key: 'payment_configured', step: 5, title: 'Payment Gateway', description: 'Razorpay or Paytm merchant account', isCompleted: false, isLocked: true, phase: 2 },
    { key: 'shows_scheduled', step: 6, title: 'Movie Schedules', description: 'Daily showtimes & ordering windows', isCompleted: false, isLocked: true, phase: 3 },
    { key: 'qr_generated', step: 7, title: 'Screen QR Codes', description: 'Seat-level & screen entrance QR stands', isCompleted: false, isLocked: true, phase: 3 },
    { key: 'ordering_activated', step: 8, title: 'In-Seat Ordering', description: 'Accept contactless patron orders', isCompleted: false, isLocked: true, phase: 3 }
  ];

  const completedCount = onboarding?.completedCount ?? stages.filter((s: any) => s.isCompleted).length;
  const totalCount = onboarding?.totalCount ?? 8;
  const percentage = onboarding?.percentage ?? Math.round((completedCount / totalCount) * 100);
  const isSetupComplete = percentage === 100 || Boolean(onboarding?.isComplete);

  // Identify next unfinished step for primary setup CTA
  const nextStage = stages.find((s: any) => !s.isCompleted);

  const stageRoutes: Record<string, string> = {
    profile_completed: '/cinema/admin/settings',
    screens_added: '/cinema/admin/screens',
    seating_configured: '/cinema/admin/seating',
    menu_configured: '/cinema/admin/menu',
    payment_configured: '/cinema/admin/payments',
    shows_scheduled: '/cinema/admin/shows',
    qr_generated: '/cinema/admin/qr',
    ordering_activated: '/cinema/admin/dashboard'
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse">
            New
          </span>
        );
      case 'preparing':
      case 'accepted':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Kitchen Prep
          </span>
        );
      case 'ready':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
            Ready to Deliver
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            Delivered
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  const isOrderingOpenNow = (show: TodayShow) => {
    const now = new Date();
    const start = new Date(show.orderingStartTime);
    const end = new Date(show.orderingEndTime);
    return now >= start && now <= end;
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* Overview header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Film className="w-3 h-3 text-red-700" />
                <span>Overview</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                <span>Ordering active</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {theatre?.name || 'Cinema Theatre Operations'}
            </h1>

            <p className="text-slate-600 text-xs sm:text-sm max-w-2xl leading-relaxed flex items-center gap-2">
              {theatre?.city && (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{theatre.city}, {theatre.state}</span>
                  <span className="text-slate-600">•</span>
                </span>
              )}
              <span>Auditorium in-seat delivery &amp; daily concessions management console</span>
            </p>
          </div>

          {/* Quick Station Jump Links */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => loadDashboardData(true)}
              disabled={refreshing}
              title="Refresh live metrics"
              className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-red-700' : ''}`} />
            </button>

            <Link
              href="/cinema/kitchen"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition"
            >
              <ChefHat className="w-4 h-4 text-slate-500" />
              <span>Kitchen KDS</span>
              {activePreparingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {activePreparingCount}
                </span>
              )}
            </Link>

            <Link
              href="/cinema/delivery"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition"
            >
              <Truck className="w-4 h-4 text-slate-500" />
              <span>Seat Delivery</span>
              {activeReadyCount > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {activeReadyCount}
                </span>
              )}
            </Link>

            <Link
              href="/cinema/admin/qr"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Screen QR Codes</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Live Operational Metrics Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's In-Seat Orders */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Today&apos;s Orders</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white mt-2">
            {stats.todayOrders > 0 ? stats.todayOrders : recentOrders.length}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Contactless in-seat requests</span>
        </div>

        {/* Today's Concession Sales */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Today&apos;s Sales</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2 font-mono">
            {formatPaise(stats.todaySales || 0, currency)}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Gross food &amp; drinks revenue</span>
        </div>

        {/* Kitchen Orders */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>In Kitchen Prep</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white mt-2">
            {activePreparingCount}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Live orders on KDS screen</span>
        </div>

        {/* Ready for Delivery */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Ready for Seat Delivery</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl sm:text-3xl font-black mt-2 ${activeReadyCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-white'}`}>
            {activeReadyCount}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Awaiting runner delivery</span>
        </div>
      </div>

      {/* Structured Setup Assistant (Phase-Based, Non-Scattered) */}
      {!isSetupComplete ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Setup Assistant
                </span>
                <span className="text-xs text-slate-400">
                  {completedCount} of {totalCount} configuration milestones complete ({percentage}%)
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">Cinema Operational Setup Roadmap</h2>
              <p className="text-xs text-slate-400">
                Complete the 3 configuration phases to launch in-seat dining for your screens.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {nextStage && (
                <Link
                  href={stageRoutes[nextStage.key] || '/cinema/onboarding'}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                >
                  <span>Continue: {nextStage.title}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              <Link
                href="/cinema/onboarding"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition"
              >
                Guided Wizard
              </Link>

              <button
                type="button"
                onClick={() => setWizardCollapsed(!wizardCollapsed)}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
                title={wizardCollapsed ? 'Expand setup breakdown' : 'Collapse setup breakdown'}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${wizardCollapsed ? '-rotate-90' : ''}`} />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(percentage, 5)}%` }}
            />
          </div>

          {/* 3 Structured Phases */}
          {!wizardCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Phase 1: Infrastructure */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400">
                    Phase 1: Facility &amp; Seating
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">2 Milestones</span>
                </div>
                <div className="space-y-2">
                  <Link
                    href="/cinema/admin/screens"
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <Tv className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-semibold text-slate-200 group-hover:text-white">Auditorium Screens</span>
                    </div>
                    {stages[1]?.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-indigo-400 font-bold">Configure →</span>
                    )}
                  </Link>

                  <Link
                    href="/cinema/admin/seating"
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <Armchair className="w-3.5 h-3.5 text-violet-400" />
                      <span className="font-semibold text-slate-200 group-hover:text-white">Seat Rows (A-Z)</span>
                    </div>
                    {stages[2]?.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold">Pending →</span>
                    )}
                  </Link>
                </div>
              </div>

              {/* Phase 2: Menu & Commerce */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                    Phase 2: Concessions &amp; Payments
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">2 Milestones</span>
                </div>
                <div className="space-y-2">
                  <Link
                    href="/cinema/admin/menu"
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold text-slate-200 group-hover:text-white">Food Menu &amp; Combos</span>
                    </div>
                    {stages[3]?.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">Configure →</span>
                    )}
                  </Link>

                  <Link
                    href="/cinema/admin/payments"
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold text-slate-200 group-hover:text-white">Payment Gateway</span>
                    </div>
                    {stages[4]?.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold">Pending →</span>
                    )}
                  </Link>
                </div>
              </div>

              {/* Phase 3: Shows & QR */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                    Phase 3: Shows &amp; QR Stand
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">3 Milestones</span>
                </div>
                <div className="space-y-2">
                  <Link
                    href="/cinema/admin/shows"
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-semibold text-slate-200 group-hover:text-white">Daily Showtimes</span>
                    </div>
                    {stages[5]?.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold">Pending →</span>
                    )}
                  </Link>

                  <Link
                    href="/cinema/admin/qr"
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold text-slate-200 group-hover:text-white">Auditorium QR Codes</span>
                    </div>
                    {stages[6]?.isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold">Pending →</span>
                    )}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Setup Finished State: Ultra Clean Compact Chip */
        <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">Full Setup Complete:</span>
            <span className="text-slate-300">All 8 cinema operational milestones configured and ready.</span>
          </div>
          <Link
            href="/cinema/onboarding"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            Review Setup Summary →
          </Link>
        </div>
      )}

      {/* Main Operations Split: Live Orders vs Today's Shows */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recent Live Orders (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Live In-Seat Orders Queue</h2>
            </div>
            <Link
              href="/cinema/admin/orders"
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Ready to Accept In-Seat Orders</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Auditorium QR stands are active. When movie patrons scan from their seats, orders will appear here in real time.
              </p>
              <div className="pt-1">
                <Link
                  href="/cinema/admin/qr"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition"
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Preview Screen QR Code</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentOrders.slice(0, 5).map((ord) => (
                <div
                  key={ord.id}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-bold text-white">#{ord.orderNumber}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {ord.screen?.screenName || 'Screen'} • Row {ord.seatRow || '-'} Seat {ord.seatNumber || '-'}
                      </span>
                      {getOrderStatusBadge(ord.status)}
                    </div>

                    <div className="text-[11px] text-slate-400 truncate">
                      {ord.items && ord.items.length > 0
                        ? ord.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')
                        : 'Concession Order'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-emerald-400 block">
                      {formatPaise(ord.totalAmount, currency)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Today's Shows & Quick Access (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Today's Schedule Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-bold text-white">Today&apos;s Showtimes</h2>
              </div>
              <Link
                href="/cinema/admin/shows"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
              >
                <span>Full Schedule</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {todayShows.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CalendarDays className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No movie showtimes scheduled for today yet.</p>
                <Link
                  href="/cinema/admin/shows"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Schedule Today&apos;s Shows</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todayShows.slice(0, 4).map((sh) => {
                  const isOpen = isOrderingOpenNow(sh);
                  return (
                    <div
                      key={sh.id}
                      className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-white truncate">{sh.movieTitle || 'Movie Show'}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{sh.screenName || 'Screen'}</span>
                          <span>•</span>
                          <span>
                            {new Date(sh.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          isOpen
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isOpen ? 'Ordering Open' : 'Closed'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Management Center */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Management Control Hub
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/cinema/admin/screens"
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 transition group flex flex-col justify-between"
              >
                <Tv className="w-4 h-4 text-indigo-400 mb-2" />
                <span className="font-bold text-slate-200 group-hover:text-white">Screens &amp; Seating</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Audi layouts</span>
              </Link>

              <Link
                href="/cinema/admin/menu"
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 transition group flex flex-col justify-between"
              >
                <UtensilsCrossed className="w-4 h-4 text-amber-400 mb-2" />
                <span className="font-bold text-slate-200 group-hover:text-white">Concessions Menu</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Food items &amp; combos</span>
              </Link>

              <Link
                href="/cinema/admin/shows"
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-violet-500/50 transition group flex flex-col justify-between"
              >
                <CalendarDays className="w-4 h-4 text-violet-400 mb-2" />
                <span className="font-bold text-slate-200 group-hover:text-white">Showtimes &amp; Films</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Daily scheduling</span>
              </Link>

              <Link
                href="/cinema/admin/settings"
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 transition group flex flex-col justify-between"
              >
                <Settings className="w-4 h-4 text-emerald-400 mb-2" />
                <span className="font-bold text-slate-200 group-hover:text-white">Theatre Settings</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Gateway &amp; staff</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
