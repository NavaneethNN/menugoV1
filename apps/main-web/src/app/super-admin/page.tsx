'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Film,
  Activity,
  TrendingUp,
  ShoppingBag,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Plus,
  RefreshCw,
  Zap
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function SuperAdminDashboardPage() {
  const restaurantUrl = process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000';
  const cinemaUrl = process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001';

  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest('/api/super-admin/metrics');
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load super admin metrics:', err);
      setError(err?.message || 'Failed to load platform metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);



  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-3" />
        <p className="text-xs font-semibold">Loading platform metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadMetrics}
          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const venues = metrics?.venues || {};
  const orders = metrics?.orders || {};
  const subs = metrics?.subscriptions || {};
  const recent = metrics?.recentVenues || [];

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">Platform Overview</h2>
          <p className="text-xs text-slate-500 mt-1">
            Realtime operating performance across all restaurant and cinema tenants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/super-admin/billing"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Usage &amp; Cost Ledgers</span>
          </Link>

          <button
            onClick={loadMetrics}
            className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs transition"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Restaurants Card */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Restaurants</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900">{venues.totalRestaurants || 0}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{venues.activeRestaurants || 0} Active venues</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/super-admin/restaurants"
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center justify-between"
            >
              <span>Manage Restaurants</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Theatres Card */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cinema Theatres</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900">{venues.totalTheatres || 0}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>{venues.activeTheatres || 0} Active theatres</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/super-admin/theatres"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-between"
            >
              <span>Manage Theatres</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Orders Card */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Orders</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900">{orders.totalOrders?.toLocaleString() || 0}</div>
            <div className="text-xs text-slate-500 mt-1">
              Across table &amp; seat ordering
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Platform Volume</span>
            <span className="text-emerald-700 font-bold">100% Online</span>
          </div>
        </div>

        {/* Platform GMV Card */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Platform GMV</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900">
              ₹{(orders.totalGmvRupees || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Cumulative processed sales
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/super-admin/billing"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-between"
            >
              <span>Metered Infrastructure Ledgers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Venues Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Recently Registered Venues</h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest dining and cinema onboardings across India.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/super-admin/restaurants"
              className="text-xs font-bold text-red-600 hover:underline"
            >
              View All
            </Link>
          </div>
        </div>

        {recent.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No venues registered yet. New restaurants and theatres will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((item: any) => {
              const isCinema = item.tenantType === 'cinema';
              return (
                <div key={item.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCinema ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {isCinema ? <Film className="w-5 h-5" /> : <UtensilsCrossed className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate flex items-center gap-2">
                        <span>{item.name}</span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            isCinema ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {isCinema ? 'Cinema' : 'Restaurant'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                        slug: {item.slug}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        item.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Suspended'}
                    </span>

                    <a
                      href={
                        isCinema
                          ? `${cinemaUrl}/${item.slug}`
                          : `${restaurantUrl}/menu/${item.slug}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Open Live Menu"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
