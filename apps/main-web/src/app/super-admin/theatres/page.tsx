'use client';

import React, { useState, useEffect } from 'react';
import {
  Film,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Coins,
  Tv,
  MapPin,
  X,
  Laptop
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function SuperAdminTheatresPage() {
  const cinemaUrl = process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001';

  const [theatres, setTheatres] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Change Plan Modal State
  const [planModalVenue, setPlanModalVenue] = useState<any | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [submittingPlan, setSubmittingPlan] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tenantsData, plansData] = await Promise.all([
        apiRequest('/api/super-admin/tenants?tenantType=cinema'),
        apiRequest('/api/super-admin/subscriptions')
      ]);
      setTheatres(Array.isArray(tenantsData) ? tenantsData : []);
      setPlans(Array.isArray(plansData) ? plansData.filter((p) => p.tenantType === 'cinema' || p.tenantType === 'all') : []);
    } catch (err: any) {
      console.error('Failed to load theatre data:', err);
      setNotice(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (venue: any) => {
    try {
      setActionLoadingId(venue.id);
      const newStatus = !venue.isActive;
      await apiRequest(`/api/super-admin/tenants/${venue.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus })
      });
      setTheatres((prev) =>
        prev.map((t) => (t.id === venue.id ? { ...t, isActive: newStatus } : t))
      );
      setNotice(`${venue.name} is now ${newStatus ? 'Activated' : 'Suspended'}.`);
    } catch (err: any) {
      setNotice(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenPlanModal = (venue: any) => {
    setPlanModalVenue(venue);
    setSelectedPlanId(venue.subscription?.planId || (plans[0]?.id || ''));
    setSelectedBillingCycle(venue.subscription?.billingCycle || 'monthly');
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planModalVenue || !selectedPlanId) return;

    try {
      setSubmittingPlan(true);
      const res = await apiRequest(`/api/super-admin/tenants/${planModalVenue.id}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({
          planId: selectedPlanId,
          billingCycle: selectedBillingCycle
        })
      });

      setNotice(res.message || 'Subscription plan assigned successfully.');
      setPlanModalVenue(null);
      loadData();
    } catch (err: any) {
      setNotice(`Plan update failed: ${err.message}`);
    } finally {
      setSubmittingPlan(false);
    }
  };

  const filtered = theatres.filter((t) => {
    if (statusFilter === 'active' && !t.isActive) return false;
    if (statusFilter === 'suspended' && t.isActive) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.cinemaProfile?.city && t.cinemaProfile.city.toLowerCase().includes(q)) ||
      (t.cinemaProfile?.chainOrBrand && t.cinemaProfile.chainOrBrand.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">Cinema &amp; Theatre Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Monitor multiplexes, manage subscription tiers, and oversee screen operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${cinemaUrl}/signup`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition"
          >
            <span>Register New Theatre</span>
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
            placeholder="Search by theatre, chain, city, or slug..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({theatres.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active ({theatres.filter((t) => t.isActive).length})
          </button>
          <button
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'suspended' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suspended ({theatres.filter((t) => !t.isActive).length})
          </button>
        </div>
      </div>

      {/* Theatres Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <span className="text-xs">Loading cinema locations...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No cinema theatres match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Theatre Location</th>
                  <th className="py-3 px-4">Chain &amp; City</th>
                  <th className="py-3 px-4">Screens &amp; Volume</th>
                  <th className="py-3 px-4">Subscription Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const isActionLoading = actionLoadingId === t.id;
                  const currentPlan = t.subscription?.planName || 'Cinema Single Screen';
                  const city = t.cinemaProfile?.city || 'India';
                  const chain = t.cinemaProfile?.chainOrBrand || 'Independent';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      {/* Name & Slug */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-slate-900">{t.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">slug: {t.slug}</div>
                      </td>

                      {/* Chain & City */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">{chain}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{city}</span>
                        </div>
                      </td>

                      {/* Screens & Orders */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          <Tv className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{t.capacityCount} Screen{t.capacityCount > 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {t.ordersCount} orders (₹{t.gmvRupees?.toLocaleString('en-IN')})
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleOpenPlanModal(t)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-[11px] transition"
                        >
                          <Coins className="w-3 h-3 text-indigo-600" />
                          <span>{currentPlan}</span>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            t.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{t.isActive ? 'Active' : 'Suspended'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(t)}
                            disabled={isActionLoading}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                              t.isActive
                                ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : t.isActive ? (
                              'Suspend'
                            ) : (
                              'Activate'
                            )}
                          </button>

                          <a
                            href={`${cinemaUrl}/${t.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                            title="Open Cinema Ordering"
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

      {/* Plan Assignment Modal */}
      {planModalVenue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-7 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Change Cinema Plan</h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign plan for {planModalVenue.name}</p>
              </div>
              <button
                onClick={() => setPlanModalVenue(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignPlan} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Subscription Plan
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {plans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    const priceRupees = Math.round(
                      (selectedBillingCycle === 'annual' ? p.priceAnnualPaise : p.priceMonthlyPaise) / 100
                    );

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {p.maxScreens ? `Up to ${p.maxScreens} screens` : 'Unlimited screens'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900">₹{priceRupees.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-slate-400 block">/ {selectedBillingCycle}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Billing Cycle
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBillingCycle('monthly')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      selectedBillingCycle === 'monthly'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBillingCycle('annual')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      selectedBillingCycle === 'annual'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Annual
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPlanModalVenue(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPlan || !selectedPlanId}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submittingPlan ? 'Saving...' : 'Confirm Plan Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
