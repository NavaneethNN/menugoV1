'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
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
  ChevronRight
} from 'lucide-react';

export default function CinemaAdminDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch cinema memberships to get active theatre ID
      const myTenants = await apiRequest('/api/restaurants/my?tenantType=cinema');
      const activeTheatre = myTenants.find((m: any) => m.restaurant?.tenantType === 'cinema');

      if (!activeTheatre) {
        setLoading(false);
        return;
      }

      const activeTheatreId = activeTheatre.restaurant.id;

      // Parallel fetch summary stats and onboarding status
      const [summaryData, onboardingData] = await Promise.all([
        apiRequest('/api/cinema/dashboard/summary', {
          theatreId: activeTheatreId
        }),
        apiRequest('/api/cinema/onboarding/status', {
          theatreId: activeTheatreId
        }).catch((err) => {
          console.warn('Could not load onboarding status:', err);
          return null;
        })
      ]);

      setSummary(summaryData);
      setOnboarding(onboardingData);
    } catch (err: any) {
      console.error('Failed to load cinema dashboard data:', err);
      setError(err?.message || 'Failed to fetch cinema summary');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading auditorium & show stats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-950/30 border border-red-800/50 rounded-2xl text-red-300 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const theatre = summary?.theatre;
  const stats = summary?.stats || {
    todayOrders: 0,
    todaySales: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    activeScreens: 0,
    todayShows: 0
  };

  const stages = onboarding?.stages || [
    { key: 'profile_completed', step: 1, title: 'Theatre Profile', description: 'Name, address, contact, currency & timezone', isCompleted: true, isLocked: false },
    { key: 'screens_added', step: 2, title: 'Cinema Screens', description: 'Auditorium count, screen names & projection specs', isCompleted: false, isLocked: false },
    { key: 'seating_configured', step: 3, title: 'Seating Layout', description: 'Seat rows (A-Z) and seat numbers per screen', isCompleted: false, isLocked: true },
    { key: 'menu_configured', step: 4, title: 'Food & Beverage Menu', description: 'Popcorn, snacks, combos & beverages', isCompleted: false, isLocked: true },
    { key: 'payment_configured', step: 5, title: 'Payment Gateway', description: 'Direct theatre payout credentials', isCompleted: false, isLocked: true },
    { key: 'shows_scheduled', step: 6, title: 'Movie Schedules', description: 'Daily showtimes & ordering windows', isCompleted: false, isLocked: true },
    { key: 'qr_generated', step: 7, title: 'Auditorium QR Codes', description: 'Seat-level & screen entrance QR deployment', isCompleted: false, isLocked: true },
    { key: 'ordering_activated', step: 8, title: 'Activate Ordering', description: 'Enable in-seat concession ordering for cinema patrons', isCompleted: false, isLocked: true }
  ];

  const completedCount = onboarding?.completedCount ?? 1;
  const totalCount = onboarding?.totalCount ?? 8;
  const percentage = onboarding?.percentage ?? Math.round((completedCount / totalCount) * 100);

  const stageIcons: Record<string, any> = {
    profile_completed: Settings,
    screens_added: Tv,
    seating_configured: Film,
    menu_configured: UtensilsCrossed,
    payment_configured: CreditCard,
    shows_scheduled: CalendarDays,
    qr_generated: QrCode,
    ordering_activated: Zap
  };

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

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-3xl p-8 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Cinema Theatre Console</span>
            </span>
            <span className="text-slate-400 text-xs">• Business Type: Cinema</span>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight">
            {theatre?.name || 'Welcome to Your Cinema'}
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Manage your screens, row-by-row seat layouts, daily movie show schedules, food orders, and seat deliveries.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/cinema/admin/settings"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Theatre Settings (Task 02)</span>
            </Link>

            <Link
              href="/cinema/admin/screens"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition"
            >
              <Tv className="w-3.5 h-3.5 text-indigo-400" />
              <span>Configure Screens (Task 03)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Onboarding Progress Wizard (Task 02 Section 4 & 5 Requirement) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Setup Progress
              </span>
              <span className="text-xs text-slate-400">
                {completedCount} of {totalCount} stages completed
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-1.5">Cinema Onboarding Wizard</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Follow these sequential milestones to launch contactless auditorium seat ordering.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xl font-black text-indigo-400">{percentage}%</span>
              <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Completed</span>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(percentage, 5)}%` }}
          />
        </div>

        {/* 8-Stage Onboarding Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {stages.map((st: any) => {
            const Icon = stageIcons[st.key] || Film;
            const route = stageRoutes[st.key] || '/cinema/admin/dashboard';
            const isClickable = !st.isLocked;

            return (
              <div
                key={st.key}
                className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                  st.isCompleted
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                    : !st.isLocked
                    ? 'bg-indigo-950/20 border-indigo-800/40 text-indigo-200 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-400 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                        st.isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : !st.isLocked
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {st.isCompleted ? <CheckCircle2 className="w-4 h-4" /> : st.step}
                    </div>

                    {st.isCompleted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Completed
                      </span>
                    ) : !st.isLocked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse">
                        Next Up (Task 03)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700/50 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>{st.title}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {st.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  {st.isCompleted ? (
                    <Link
                      href={route}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition"
                    >
                      <span>Review Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  ) : !st.isLocked ? (
                    <Link
                      href={route}
                      className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition"
                    >
                      <span>Configure Now</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>Pending previous step</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Today&apos;s Orders</span>
            <ShoppingBag className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{stats.todayOrders}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Live seat orders</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Active Screens</span>
            <Tv className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{stats.activeScreens}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Configured auditoriums</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Today&apos;s Shows</span>
            <CalendarDays className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{stats.todayShows}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Scheduled movie showtimes</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Ready for Delivery</span>
            <Truck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">{stats.readyOrders}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting runner delivery</span>
        </div>
      </div>

      {/* Quick Setup Roadmap */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <span>Cinema Operations Setup Guide</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/cinema/admin/screens"
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs mb-3">
                1
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-indigo-400 transition">
                Cinema Screens & Auditoriums
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Add Screen 1, IMAX, Audi 2 with screen specifications and seat categories.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-indigo-400 gap-1">
              <span>Manage Screens</span>
              <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/cinema/admin/movies"
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold text-xs mb-3">
                2
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-violet-400 transition">
                Movie Catalogue
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Add film posters, durations, certifications, and languages.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-violet-400 gap-1">
              <span>Manage Movies</span>
              <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/cinema/admin/shows"
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs mb-3">
                3
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition">
                Daily Show Schedules
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Schedule morning, matinee, evening, and night showtimes per screen.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-amber-400 gap-1">
              <span>Manage Shows</span>
              <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
