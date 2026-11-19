'use client';

import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Sparkles,
  UtensilsCrossed,
  Film,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  RefreshCw,
  Search,
  ArrowUpRight,
  Filter,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

type ActiveTab = 'plans' | 'tenant-subscriptions' | 'transactions';

export default function SuperAdminSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('plans');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ----------------------------------------------------
  // TAB 1: SUBSCRIPTION PLANS STATE
  // ----------------------------------------------------
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planFilterType, setPlanFilterType] = useState<'all' | 'restaurant' | 'cinema'>('all');

  // Plan Edit/Create Modal
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // Plan Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [tenantType, setTenantType] = useState<'restaurant' | 'cinema' | 'all'>('restaurant');
  const [monthlyRupees, setMonthlyRupees] = useState<number>(999);
  const [annualRupees, setAnnualRupees] = useState<number>(9990);
  const [maxTables, setMaxTables] = useState<string>('');
  const [maxScreens, setMaxScreens] = useState<string>('');
  const [maxStaff, setMaxStaff] = useState<string>('');
  const [isPopular, setIsPopular] = useState(false);
  const [featuresList, setFeaturesList] = useState<string[]>(['']);

  // ----------------------------------------------------
  // TAB 2: TENANT SUBSCRIPTIONS (DURATION & EXPIRATION)
  // ----------------------------------------------------
  const [tenantSubs, setTenantSubs] = useState<any[]>([]);
  const [tenantSubsLoading, setTenantSubsLoading] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantTypeFilter, setTenantTypeFilter] = useState<'all' | 'restaurant' | 'cinema'>('all');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<string>('all');
  const [syncingExpirations, setSyncingExpirations] = useState(false);

  // Custom Duration Modal
  const [durationModalSub, setDurationModalSub] = useState<any | null>(null);
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [customDaysToAdd, setCustomDaysToAdd] = useState<number>(30);
  const [savingDuration, setSavingDuration] = useState(false);

  // ----------------------------------------------------
  // TAB 3: RAZORPAY TRANSACTIONS & REVENUE
  // ----------------------------------------------------
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');

  // ----------------------------------------------------
  // INITIAL DATA FETCH
  // ----------------------------------------------------
  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (activeTab === 'tenant-subscriptions' && tenantSubs.length === 0) {
      loadTenantSubscriptions();
    } else if (activeTab === 'transactions' && payments.length === 0) {
      loadPayments();
    }
  }, [activeTab]);

  // Load plans
  const loadPlans = async () => {
    try {
      setPlansLoading(true);
      const data = await apiRequest('/api/super-admin/subscriptions');
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load plans:', err);
      setNotice({ type: 'error', message: err.message || 'Failed to load plans' });
    } finally {
      setPlansLoading(false);
    }
  };

  // Load tenant subscriptions
  const loadTenantSubscriptions = async () => {
    try {
      setTenantSubsLoading(true);
      const data = await apiRequest('/api/super-admin/tenant-subscriptions');
      setTenantSubs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load tenant subscriptions:', err);
      setNotice({ type: 'error', message: err.message || 'Failed to load tenant subscriptions' });
    } finally {
      setTenantSubsLoading(false);
    }
  };

  // Load payments
  const loadPayments = async () => {
    try {
      setPaymentsLoading(true);
      const data = await apiRequest('/api/super-admin/subscription-payments');
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load subscription payments:', err);
      setNotice({ type: 'error', message: err.message || 'Failed to load payments' });
    } finally {
      setPaymentsLoading(false);
    }
  };

  // ----------------------------------------------------
  // TAB 1 ACTIONS: PLAN MANAGEMENT
  // ----------------------------------------------------
  const openCreatePlanModal = () => {
    setEditingPlan(null);
    setName('');
    setSlug('');
    setDescription('');
    setTenantType('restaurant');
    setMonthlyRupees(999);
    setAnnualRupees(9990);
    setMaxTables('15');
    setMaxScreens('');
    setMaxStaff('5');
    setIsPopular(false);
    setFeaturesList(['Smart QR Ordering', 'Kitchen Display System (KDS)', 'Daily Sales Analytics']);
    setIsPlanModalOpen(true);
  };

  const openEditPlanModal = (plan: any) => {
    setEditingPlan(plan);
    setName(plan.name);
    setSlug(plan.slug);
    setDescription(plan.description || '');
    setTenantType(plan.tenantType);
    setMonthlyRupees(Math.round(plan.priceMonthlyPaise / 100));
    setAnnualRupees(Math.round(plan.priceAnnualPaise / 100));
    setMaxTables(plan.maxTables ? String(plan.maxTables) : '');
    setMaxScreens(plan.maxScreens ? String(plan.maxScreens) : '');
    setMaxStaff(plan.maxStaff ? String(plan.maxStaff) : '');
    setIsPopular(plan.isPopular || false);
    setFeaturesList(Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : ['']);
    setIsPlanModalOpen(true);
  };

  const handleAddFeature = () => setFeaturesList([...featuresList, '']);
  const handleRemoveFeature = (idx: number) => setFeaturesList(featuresList.filter((_, i) => i !== idx));
  const handleFeatureChange = (idx: number, val: string) => {
    const updated = [...featuresList];
    updated[idx] = val;
    setFeaturesList(updated);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPlanSubmitting(true);
      const cleanFeatures = featuresList.map((f) => f.trim()).filter(Boolean);

      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || undefined,
        tenantType,
        priceMonthlyPaise: Math.round(monthlyRupees * 100),
        priceAnnualPaise: Math.round(annualRupees * 100),
        maxTables: maxTables ? parseInt(maxTables, 10) : null,
        maxScreens: maxScreens ? parseInt(maxScreens, 10) : null,
        maxStaff: maxStaff ? parseInt(maxStaff, 10) : null,
        features: cleanFeatures,
        isPopular,
        isActive: true
      };

      if (editingPlan) {
        await apiRequest(`/api/super-admin/subscriptions/${editingPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        setNotice({ type: 'success', message: `Plan "${name}" updated successfully.` });
      } else {
        await apiRequest('/api/super-admin/subscriptions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setNotice({ type: 'success', message: `Plan "${name}" created successfully.` });
      }

      setIsPlanModalOpen(false);
      loadPlans();
    } catch (err: any) {
      setNotice({ type: 'error', message: `Failed to save plan: ${err.message}` });
    } finally {
      setPlanSubmitting(false);
    }
  };

  const handleTogglePlanActive = async (plan: any) => {
    try {
      const newStatus = !plan.isActive;
      await apiRequest(`/api/super-admin/subscriptions/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus })
      });
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, isActive: newStatus } : p))
      );
      setNotice({
        type: 'success',
        message: `Plan "${plan.name}" is now ${newStatus ? 'Active' : 'Archived'}.`
      });
    } catch (err: any) {
      setNotice({ type: 'error', message: `Failed to update status: ${err.message}` });
    }
  };

  // ----------------------------------------------------
  // TAB 2 ACTIONS: DURATION & EXPIRATION CONTROLS
  // ----------------------------------------------------
  const handleQuickAddDays = async (sub: any, daysToAdd: number) => {
    try {
      const res = await apiRequest(`/api/super-admin/tenant-subscriptions/${sub.id}/duration`, {
        method: 'PATCH',
        body: JSON.stringify({ daysToAdd })
      });
      setNotice({
        type: 'success',
        message: `Added +${daysToAdd} days to ${sub.restaurantName}. New end date: ${new Date(res.subscription.currentPeriodEnd).toLocaleDateString()}`
      });
      loadTenantSubscriptions();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to update duration' });
    }
  };

  const handleToggleSubStatus = async (sub: any, targetStatus: 'active' | 'expired') => {
    try {
      await apiRequest(`/api/super-admin/tenant-subscriptions/${sub.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus })
      });
      setNotice({
        type: 'success',
        message: `Subscription for ${sub.restaurantName} set to "${targetStatus}".`
      });
      loadTenantSubscriptions();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to update subscription status' });
    }
  };

  const handleSaveCustomDuration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!durationModalSub) return;
    try {
      setSavingDuration(true);
      const payload: any = {};
      if (customEndDate) {
        payload.currentPeriodEnd = new Date(customEndDate).toISOString();
      } else if (customDaysToAdd) {
        payload.daysToAdd = Number(customDaysToAdd);
      }

      const res = await apiRequest(`/api/super-admin/tenant-subscriptions/${durationModalSub.id}/duration`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      setNotice({
        type: 'success',
        message: `Duration updated for ${durationModalSub.restaurantName}. Ends on ${new Date(res.subscription.currentPeriodEnd).toLocaleDateString()}`
      });
      setDurationModalSub(null);
      loadTenantSubscriptions();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to update duration' });
    } finally {
      setSavingDuration(false);
    }
  };

  const handleManualSyncExpirations = async () => {
    try {
      setSyncingExpirations(true);
      const res = await apiRequest('/api/super-admin/check-expirations', { method: 'POST' });
      setNotice({
        type: 'success',
        message: `Sync complete! ${res.totalExpired} subscription(s) transitioned to expired status.`
      });
      loadTenantSubscriptions();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to sync expirations' });
    } finally {
      setSyncingExpirations(false);
    }
  };

  // ----------------------------------------------------
  // FILTERED DATA
  // ----------------------------------------------------
  const filteredPlans = plans.filter((p) => {
    if (planFilterType === 'all') return true;
    return p.tenantType === planFilterType || p.tenantType === 'all';
  });

  const filteredTenantSubs = tenantSubs.filter((s) => {
    const matchesSearch =
      tenantSearch === '' ||
      s.restaurantName?.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      s.restaurantSlug?.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      s.ownerName?.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      s.ownerEmail?.toLowerCase().includes(tenantSearch.toLowerCase());

    const matchesType =
      tenantTypeFilter === 'all' ||
      s.tenantType === tenantTypeFilter;

    const matchesStatus =
      tenantStatusFilter === 'all' ||
      (tenantStatusFilter === 'expired' && (s.isExpired || s.status === 'expired')) ||
      (tenantStatusFilter === 'active' && s.status === 'active' && !s.isExpired) ||
      s.status === tenantStatusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const filteredPayments = payments.filter((p) => {
    if (!paymentSearch) return true;
    const term = paymentSearch.toLowerCase();
    return (
      p.restaurantName?.toLowerCase().includes(term) ||
      p.planName?.toLowerCase().includes(term) ||
      p.razorpayPaymentId?.toLowerCase().includes(term) ||
      p.razorpayOrderId?.toLowerCase().includes(term) ||
      p.status?.toLowerCase().includes(term)
    );
  });

  const totalRevenuePaise = payments.reduce((acc, curr) => acc + (curr.amountPaise || 0), 0);
  const totalRevenueRupees = Math.round(totalRevenuePaise / 100);

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight flex items-center gap-2.5">
            <Coins className="w-6 h-6 text-red-600" />
            Platform Subscriptions &amp; Billing
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage subscription plans, monitor tenant durations, enforce expiry, and review Razorpay revenue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'plans' && (
            <button
              onClick={openCreatePlanModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Plan</span>
            </button>
          )}

          {activeTab === 'tenant-subscriptions' && (
            <button
              onClick={handleManualSyncExpirations}
              disabled={syncingExpirations}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingExpirations ? 'animate-spin text-red-400' : ''}`} />
              <span>Sync Expirations</span>
            </button>
          )}

          {activeTab === 'transactions' && (
            <button
              onClick={loadPayments}
              disabled={paymentsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${paymentsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts / Notice */}
      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{notice.message}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'plans'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Subscription Plans ({plans.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tenant-subscriptions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'tenant-subscriptions'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-500" />
          <span>Tenant Subscriptions ({tenantSubs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'transactions'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Receipt className="w-4 h-4 text-emerald-600" />
          <span>Razorpay Revenue ({payments.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUBSCRIPTION PLANS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {/* Subfilter */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl w-fit">
            <button
              onClick={() => setPlanFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                planFilterType === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Plans ({plans.length})
            </button>
            <button
              onClick={() => setPlanFilterType('restaurant')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                planFilterType === 'restaurant' ? 'bg-red-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Restaurant Plans</span>
            </button>
            <button
              onClick={() => setPlanFilterType('cinema')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                planFilterType === 'cinema' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Cinema Plans</span>
            </button>
          </div>

          {/* Grid */}
          {plansLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
              <span className="text-xs">Loading plans...</span>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
              No subscription plans configured for this category. Click &quot;Create New Plan&quot; to add one.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => {
                const isCinema = plan.tenantType === 'cinema';
                const mPrice = Math.round(plan.priceMonthlyPaise / 100);
                const aPrice = Math.round(plan.priceAnnualPaise / 100);

                return (
                  <div
                    key={plan.id}
                    className={`bg-white rounded-2xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                      plan.isActive
                        ? plan.isPopular
                          ? 'border-red-500 ring-2 ring-red-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                        : 'border-slate-200 bg-slate-50/60 opacity-75'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base text-slate-900">{plan.name}</h3>
                            {plan.isPopular && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-100 text-red-700 tracking-wider">
                                Popular
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">/{plan.slug}</span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCinema
                              ? 'bg-indigo-100 text-indigo-700'
                              : plan.tenantType === 'restaurant'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isCinema ? <Film className="w-3 h-3" /> : <UtensilsCrossed className="w-3 h-3" />}
                          {plan.tenantType}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                        {plan.description || 'No description provided.'}
                      </p>

                      {/* Pricing */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4 space-y-1">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-slate-500">Monthly:</span>
                          <span className="font-extrabold text-slate-900 font-mono">
                            ₹{mPrice.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-slate-500">Annual:</span>
                          <span className="font-extrabold text-slate-900 font-mono">
                            ₹{aPrice.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">/yr</span>
                          </span>
                        </div>
                      </div>

                      {/* Capacity Limits */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div className="p-2 rounded-lg bg-slate-50 text-[11px]">
                          <span className="block text-slate-400 text-[10px]">Tables</span>
                          <strong className="text-slate-800">{plan.maxTables ?? '∞'}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 text-[11px]">
                          <span className="block text-slate-400 text-[10px]">Screens</span>
                          <strong className="text-slate-800">{plan.maxScreens ?? '∞'}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 text-[11px]">
                          <span className="block text-slate-400 text-[10px]">Staff</span>
                          <strong className="text-slate-800">{plan.maxStaff ?? '∞'}</strong>
                        </div>
                      </div>

                      {/* Features Bullet list */}
                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <div className="space-y-1.5 border-t border-slate-100 pt-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Included Capabilities
                          </span>
                          {plan.features.slice(0, 4).map((f: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{f}</span>
                            </div>
                          ))}
                          {plan.features.length > 4 && (
                            <span className="text-[10px] text-slate-400 pl-5 block">
                              +{plan.features.length - 4} more features
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleTogglePlanActive(plan)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                          plan.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {plan.isActive ? 'Active Plan' : 'Archived'}
                      </button>

                      <button
                        onClick={() => openEditPlanModal(plan)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TENANT SUBSCRIPTIONS (DURATION, EXPIRY & EXTENSION)                */}
      {/* ========================================================================= */}
      {activeTab === 'tenant-subscriptions' && (
        <div className="space-y-6">
          {/* Subscriptions Filter / Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search venue or owner..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={tenantTypeFilter}
                onChange={(e: any) => setTenantTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Venue Types</option>
                <option value="restaurant">Restaurants Only</option>
                <option value="cinema">Theatres Only</option>
              </select>

              <select
                value={tenantStatusFilter}
                onChange={(e: any) => setTenantStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired Only</option>
                <option value="past_due">Past Due Only</option>
              </select>
            </div>
          </div>

          {/* Subscriptions Table */}
          {tenantSubsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
              <span className="text-xs">Loading tenant subscriptions...</span>
            </div>
          ) : filteredTenantSubs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
              No tenant subscriptions match your search filter.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">Venue &amp; Owner</th>
                      <th className="py-3.5 px-4">Plan &amp; Cycle</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Duration &amp; Expiry</th>
                      <th className="py-3.5 px-4 text-right">Duration Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredTenantSubs.map((sub) => {
                      const isCinema = sub.tenantType === 'cinema';
                      const isExpired = sub.isExpired || sub.status === 'expired';

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isCinema
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'bg-orange-50 text-orange-600'
                                }`}
                              >
                                {isCinema ? <Film className="w-4 h-4" /> : <UtensilsCrossed className="w-4 h-4" />}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{sub.restaurantName}</span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {sub.ownerName} {sub.ownerEmail ? `(${sub.ownerEmail})` : ''}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{sub.planName || 'Custom Plan'}</span>
                            <span className="text-[11px] text-slate-400 capitalize">
                              {sub.billingCycle || 'monthly'} cycle
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isExpired
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : sub.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isExpired ? 'bg-rose-600' : 'bg-emerald-600 animate-pulse'
                                }`}
                              />
                              {isExpired ? 'EXPIRED' : sub.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {isExpired ? (
                                  <span className="text-rose-600 font-bold">Expired</span>
                                ) : (
                                  <span>{sub.daysRemaining ?? 0} days remaining</span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block">
                                Ends:{' '}
                                {sub.currentPeriodEnd
                                  ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : 'No date set'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleQuickAddDays(sub, 30)}
                                title="Add 30 Days to subscription"
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition"
                              >
                                +30d
                              </button>

                              <button
                                onClick={() => handleQuickAddDays(sub, 365)}
                                title="Add 1 Year to subscription"
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition"
                              >
                                +1y
                              </button>

                              <button
                                onClick={() => {
                                  setDurationModalSub(sub);
                                  setCustomDaysToAdd(30);
                                  setCustomEndDate(
                                    sub.currentPeriodEnd
                                      ? new Date(sub.currentPeriodEnd).toISOString().split('T')[0]!
                                      : ''
                                  );
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition"
                              >
                                Custom Date
                              </button>

                              {isExpired ? (
                                <button
                                  onClick={() => handleToggleSubStatus(sub, 'active')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition"
                                >
                                  Activate
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleSubStatus(sub, 'expired')}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold transition"
                                >
                                  Expire
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
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RAZORPAY TRANSACTIONS & REVENUE                                    */}
      {/* ========================================================================= */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Revenue Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-400 text-xs font-bold block">Gross Platform Revenue</span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-mono">
                ₹{totalRevenueRupees.toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Live Razorpay Collections
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-400 text-xs font-bold block">Total Transactions</span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-mono">
                {payments.length}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">Paid subscriber checkouts</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-400 text-xs font-bold block">Platform Gateway</span>
              <p className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                Razorpay Platform API
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">Direct INR settlement</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search transaction, venue, or Razorpay ID..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Table */}
          {paymentsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
              <span className="text-xs">Loading transaction history...</span>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
              No subscription payment transactions found.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">Invoice / ID</th>
                      <th className="py-3.5 px-4">Venue &amp; Type</th>
                      <th className="py-3.5 px-4">Plan &amp; Cycle</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Razorpay Reference</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {p.id.slice(0, 8)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{p.restaurantName || 'Venue'}</span>
                          <span className="text-[11px] text-slate-400 capitalize">{p.tenantType || 'Venue'}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 block">{p.planName || 'Plan'}</span>
                          <span className="text-[11px] text-slate-400 capitalize">{p.billingCycle}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                          ₹{p.amountRupees.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          <div>
                            <span>Pay: {p.razorpayPaymentId || '—'}</span>
                          </div>
                          <div>
                            <span>Ord: {p.razorpayOrderId || '—'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              p.status === 'captured' || p.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT SUBSCRIPTION PLAN                                    */}
      {/* ========================================================================= */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-lg text-slate-950">
                {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Subscription Plan'}
              </h3>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingPlan) {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                      }
                    }}
                    placeholder="e.g. Pro Cinema"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">URL Identifier Slug *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="e.g. cinema-pro"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Tenant Domain *</label>
                <select
                  value={tenantType}
                  onChange={(e: any) => setTenantType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                >
                  <option value="restaurant">Restaurant Owners</option>
                  <option value="cinema">Cinema Theatre Owners</option>
                  <option value="all">Both (Universal)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary of target venue scale and capabilities..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Price (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={monthlyRupees}
                    onChange={(e) => setMonthlyRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Annual Price (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={annualRupees}
                    onChange={(e) => setAnnualRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Tables</label>
                  <input
                    type="number"
                    min={1}
                    value={maxTables}
                    onChange={(e) => setMaxTables(e.target.value)}
                    placeholder="Blank = ∞"
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Screens</label>
                  <input
                    type="number"
                    min={1}
                    value={maxScreens}
                    onChange={(e) => setMaxScreens(e.target.value)}
                    placeholder="Blank = ∞"
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Staff</label>
                  <input
                    type="number"
                    min={1}
                    value={maxStaff}
                    onChange={(e) => setMaxStaff(e.target.value)}
                    placeholder="Blank = ∞"
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Popular Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="isPopular" className="text-xs font-bold text-slate-700">
                  Highlight as &quot;Most Popular&quot; card
                </label>
              </div>

              {/* Feature list */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Feature Bullet Points</label>
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700"
                  >
                    + Add Bullet
                  </button>
                </div>
                <div className="space-y-1.5">
                  {featuresList.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => handleFeatureChange(idx, e.target.value)}
                        placeholder="e.g. Real-time Kitchen Display (KDS)"
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                      {featuresList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition flex items-center gap-1.5"
                >
                  {planSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{editingPlan ? 'Save Changes' : 'Create Plan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOM DURATION & END DATE                                         */}
      {/* ========================================================================= */}
      {durationModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-black text-lg text-slate-950">Adjust Duration</h3>
                <p className="text-xs text-slate-400">{durationModalSub.restaurantName}</p>
              </div>
              <button
                onClick={() => setDurationModalSub(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomDuration} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Period End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Select exact date on which the subscription will end.
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-2">Or Quick Add Days</span>
                <div className="grid grid-cols-3 gap-2">
                  {[15, 30, 90, 180, 365].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        const base = durationModalSub.currentPeriodEnd
                          ? new Date(durationModalSub.currentPeriodEnd)
                          : new Date();
                        const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
                        setCustomEndDate(target.toISOString().split('T')[0]!);
                      }}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-800 transition"
                    >
                      +{days} days
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDurationModalSub(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDuration}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition flex items-center gap-1.5"
                >
                  {savingDuration ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Duration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
