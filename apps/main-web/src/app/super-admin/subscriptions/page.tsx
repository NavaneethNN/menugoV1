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
  Building2
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function SuperAdminSubscriptionsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'restaurant' | 'cinema'>('all');
  const [notice, setNotice] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields
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

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/super-admin/subscriptions');
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load plans:', err);
      setNotice(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openCreateModal = () => {
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
    setIsModalOpen(true);
  };

  const openEditModal = (plan: any) => {
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
    setIsModalOpen(true);
  };

  const handleAddFeature = () => {
    setFeaturesList([...featuresList, '']);
  };

  const handleRemoveFeature = (index: number) => {
    setFeaturesList(featuresList.filter((_, i) => i !== index));
  };

  const handleFeatureChange = (index: number, val: string) => {
    const updated = [...featuresList];
    updated[index] = val;
    setFeaturesList(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
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
        setNotice(`Plan "${name}" updated successfully.`);
      } else {
        await apiRequest('/api/super-admin/subscriptions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setNotice(`New plan "${name}" created successfully.`);
      }

      setIsModalOpen(false);
      loadPlans();
    } catch (err: any) {
      setNotice(`Failed to save plan: ${err.message}`);
    } finally {
      setFormSubmitting(false);
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
      setNotice(`Plan "${plan.name}" is now ${newStatus ? 'Active' : 'Archived'}.`);
    } catch (err: any) {
      setNotice(`Failed: ${err.message}`);
    }
  };

  const filtered = plans.filter((p) => {
    if (filterType === 'all') return true;
    return p.tenantType === filterType || p.tenantType === 'all';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">Subscription Plans &amp; Pricing</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure platform subscription tiers, INR pricing rates, capacity limits and featured capabilities.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Plan</span>
        </button>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-between shadow-md">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl w-fit">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            filterType === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Plans ({plans.length})
        </button>
        <button
          onClick={() => setFilterType('restaurant')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            filterType === 'restaurant' ? 'bg-red-600 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>Restaurant Plans</span>
        </button>
        <button
          onClick={() => setFilterType('cinema')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            filterType === 'cinema' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Cinema Plans</span>
        </button>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
          <span className="text-xs">Loading plans...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
          No subscription plans configured for this category. Click &quot;Create New Plan&quot; to add one.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((plan) => {
            const isCinema = plan.tenantType === 'cinema';
            const monthlyRupees = Math.round(plan.priceMonthlyPaise / 100);
            const annualRupees = Math.round(plan.priceAnnualPaise / 100);

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-6 bg-white border flex flex-col justify-between transition-all ${
                  plan.isActive ? 'border-slate-200 shadow-sm' : 'border-dashed border-slate-300 opacity-60 bg-slate-50'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        isCinema ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {isCinema ? 'Cinema' : 'Restaurant'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {plan.isPopular && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          Popular
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {plan.isActive ? 'Live' : 'Archived'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-950">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{plan.description || 'No description'}</p>

                  {/* Pricing Box */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Monthly</span>
                      <span className="text-base font-black text-slate-900">₹{monthlyRupees.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Annual</span>
                      <span className="text-base font-black text-slate-900">₹{annualRupees.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="mt-4 py-2 border-y border-slate-100 text-[11px] text-slate-600 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Capacity</span>
                      <span className="font-bold text-slate-800">
                        {plan.maxTables ? `${plan.maxTables} Tables` : plan.maxScreens ? `${plan.maxScreens} Screens` : 'Unlimited'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Staff Accounts</span>
                      <span className="font-bold text-slate-800">
                        {plan.maxStaff ? `${plan.maxStaff} Staff` : 'Unlimited'}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mt-4 space-y-1.5">
                    {(plan.features || []).slice(0, 5).map((f: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                    {(plan.features || []).length > 5 && (
                      <div className="text-[10px] text-slate-400 font-semibold pl-5">
                        +{(plan.features || []).length - 5} more features
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Controls */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleTogglePlanActive(plan)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                  >
                    {plan.isActive ? 'Archive Plan' : 'Restore Plan'}
                  </button>

                  <button
                    onClick={() => openEditModal(plan)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Tier</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">
                {editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingPlan) {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }
                    }}
                    placeholder="e.g. Restaurant Growth"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Slug ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. restaurant-growth"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tenant Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTenantType('restaurant')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      tenantType === 'restaurant'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Restaurant
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenantType('cinema')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      tenantType === 'cinema'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Cinema
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenantType('all')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      tenantType === 'all'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    All Venues
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of this plan for operators..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Monthly Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={monthlyRupees}
                    onChange={(e) => setMonthlyRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Annual Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={annualRupees}
                    onChange={(e) => setAnnualRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Max Tables
                  </label>
                  <input
                    type="number"
                    value={maxTables}
                    onChange={(e) => setMaxTables(e.target.value)}
                    placeholder="Leave empty for ∞"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Max Screens
                  </label>
                  <input
                    type="number"
                    value={maxScreens}
                    onChange={(e) => setMaxScreens(e.target.value)}
                    placeholder="Leave empty for ∞"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Max Staff
                  </label>
                  <input
                    type="number"
                    value={maxStaff}
                    onChange={(e) => setMaxStaff(e.target.value)}
                    placeholder="Leave empty for ∞"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Features List */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Plan Features List
                  </label>
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {featuresList.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={f}
                        onChange={(e) => handleFeatureChange(i, e.target.value)}
                        placeholder={`Feature ${i + 1}...`}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                      {featuresList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(i)}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Popular Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="isPopular" className="text-xs font-bold text-slate-800">
                  Mark as &quot;Most Popular Choice&quot; highlight on public pricing page
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
