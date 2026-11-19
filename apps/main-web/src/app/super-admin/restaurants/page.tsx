'use client';

import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Activity,
  ShieldAlert,
  ShieldCheck,
  User,
  ShoppingBag,
  X,
  Building2,
  Zap
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function SuperAdminRestaurantsPage() {
  const restaurantUrl = process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000';

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const tenantsData = await apiRequest('/api/super-admin/tenants?tenantType=restaurant');
      setRestaurants(Array.isArray(tenantsData) ? tenantsData : []);
    } catch (err: any) {
      console.error('Failed to load restaurant data:', err);
      setNotice(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toggle restaurant active / suspended
  const handleToggleStatus = async (venue: any) => {
    try {
      setActionLoadingId(venue.id);
      const newStatus = !venue.isActive;
      await apiRequest(`/api/super-admin/tenants/${venue.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus })
      });
      setRestaurants((prev) =>
        prev.map((r) => (r.id === venue.id ? { ...r, isActive: newStatus } : r))
      );
      setNotice(`${venue.name} is now ${newStatus ? 'Activated' : 'Suspended'}.`);
    } catch (err: any) {
      setNotice(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = restaurants.filter((r) => {
    if (statusFilter === 'active' && !r.isActive) return false;
    if (statusFilter === 'suspended' && r.isActive) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.ownerEmail && r.ownerEmail.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">Restaurant Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Monitor registered dining venues, metered infrastructure usage, and toggle venue operational status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${restaurantUrl}/admin/login?mode=signup`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition"
          >
            <span>Register New Restaurant</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-between shadow-md">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by restaurant name, slug, or owner..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({restaurants.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active ({restaurants.filter((r) => r.isActive).length})
          </button>
          <button
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'suspended' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suspended ({restaurants.filter((r) => !r.isActive).length})
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
            <span className="text-xs">Loading registered restaurants...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No restaurants match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Restaurant</th>
                  <th className="py-3 px-4">Owner Contact</th>
                  <th className="py-3 px-4">Capacity &amp; Orders</th>
                  <th className="py-3 px-4">Billing Model</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const isActionLoading = actionLoadingId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition">
                      {/* Name & Slug */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-slate-900">{r.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">slug: {r.slug}</div>
                      </td>

                      {/* Owner */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">{r.ownerName || 'Unassigned'}</div>
                        <div className="text-slate-500 text-[11px]">{r.ownerEmail || r.email || '—'}</div>
                      </td>

                      {/* Metrics */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">
                          {r.capacityCount} {r.capacityCount === 1 ? 'Table' : 'Tables'}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {r.ordersCount} orders (₹{r.gmvRupees?.toLocaleString('en-IN')})
                        </div>
                      </td>

                      {/* Billing Model */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                          <Zap className="w-3 h-3 text-emerald-600" />
                          <span>100% Pay-As-You-Go</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          Metered • 70% Target Margin
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            r.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${r.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{r.isActive ? 'Active' : 'Suspended'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(r)}
                            disabled={isActionLoading}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                              r.isActive
                                ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : r.isActive ? (
                              'Suspend'
                            ) : (
                              'Activate'
                            )}
                          </button>

                          <a
                            href={`${restaurantUrl}/menu/${r.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                            title="Open Customer Menu"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
