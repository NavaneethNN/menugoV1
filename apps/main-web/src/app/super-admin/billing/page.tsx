'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  Zap,
  Building2,
  TrendingUp,
  Server,
  DollarSign,
  ShieldCheck,
  X,
  Edit2,
  Calculator,
  Sliders,
  Sparkles,
  HelpCircle,
  Database,
  HardDrive,
  Wifi,
  Cpu,
  Radio,
  Clock
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

type ActiveTab = 'catalogue' | 'simulator' | 'cost-pools' | 'invoices';

export default function SuperAdminBillingPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalogue');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // 1. Usage Pricing Catalogue & Platform Config State
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [billingConfig, setBillingConfig] = useState<any>({
    minimumGrossMarginPercent: 70.0,
    currency: 'INR',
    taxRatePercent: 18.0
  });
  const [editingMargin, setEditingMargin] = useState<number>(70);
  const [savingMargin, setSavingMargin] = useState(false);

  // Metric Edit Modal State
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editRateRupees, setEditRateRupees] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editUnit, setEditUnit] = useState<string>('');
  const [editMultiplier, setEditMultiplier] = useState<number>(1000);
  const [savingMetric, setSavingMetric] = useState(false);

  // 2. Interactive Calculator / Simulator State
  const [simInputs, setSimInputs] = useState({
    apiRequests: 100000,
    dbOperations: 50000,
    storageGb: 2,
    bandwidthGb: 5,
    realtimeMessages: 10000,
    backgroundTasks: 5000
  });
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  // 3. Shared Cost Pools (Ledger B)
  const [costPools, setCostPools] = useState<any[]>([]);
  const [allocatingPoolId, setAllocatingPoolId] = useState<string | null>(null);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [poolForm, setPoolForm] = useState({
    poolName: '',
    provider: 'AWS',
    metricType: 'api_cpu_time_ms',
    totalCostPaise: '',
    providerInvoiceRef: '',
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0]
  });

  // 4. Invoices State
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    restaurantId: '',
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0]
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [catData, poolsData, invData, tenantsData] = await Promise.all([
        apiRequest('/api/super-admin/billing/catalogue').catch(() => null),
        apiRequest('/api/super-admin/billing/cost-pools').catch(() => []),
        apiRequest('/api/super-admin/billing/invoices').catch(() => []),
        apiRequest('/api/super-admin/tenants').catch(() => [])
      ]);

      if (catData) {
        setCatalogue(Array.isArray(catData.catalogue) ? catData.catalogue : []);
        if (catData.config) {
          setBillingConfig(catData.config);
          setEditingMargin(catData.config.minimumGrossMarginPercent || 70);
        }
      }

      setCostPools(Array.isArray(poolsData) ? poolsData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);

      if (tenantsData && tenantsData.length > 0 && !invoiceForm.restaurantId) {
        setInvoiceForm((prev) => ({ ...prev, restaurantId: tenantsData[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load billing data:', err);
      setNotice(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run simulation whenever simulator inputs or margin change
  const runSimulation = async () => {
    try {
      setSimulating(true);
      const res = await apiRequest('/api/super-admin/billing/simulate', {
        method: 'POST',
        body: JSON.stringify(simInputs)
      });
      setSimResult(res);
    } catch (err: any) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'simulator' && !simResult) {
      runSimulation();
    }
  }, [activeTab]);

  // Update Global Minimum Gross Margin %
  const handleSaveMargin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingMargin(true);
      const res = await apiRequest('/api/super-admin/billing/config', {
        method: 'PATCH',
        body: JSON.stringify({ minimumGrossMarginPercent: Number(editingMargin) })
      });
      setBillingConfig(res.config);
      setNotice(`Minimum Gross Margin successfully updated to ${res.config.minimumGrossMarginPercent}%. Customer rates updated.`);
      loadData();
      if (simResult) runSimulation();
    } catch (err: any) {
      setNotice(`Failed to update margin: ${err.message}`);
    } finally {
      setSavingMargin(false);
    }
  };

  // Open Metric Edit Modal
  const handleOpenEditMetric = (item: any) => {
    setEditingItem(item);
    setEditRateRupees(String(item.rateRupees));
    setEditIsActive(item.isActive);
    setEditUnit(item.unit);
    setEditMultiplier(item.unitMultiplier || 1000);
  };

  // Save Metric Rate
  const handleSaveMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      setSavingMetric(true);
      const ratePaise = Math.round(Number(editRateRupees) * 100);
      await apiRequest(`/api/super-admin/billing/catalogue/${editingItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ratePaise,
          isActive: editIsActive,
          unit: editUnit,
          unitMultiplier: editMultiplier
        })
      });
      setNotice(`Metric "${editingItem.displayName}" updated successfully.`);
      setEditingItem(null);
      loadData();
      if (simResult) runSimulation();
    } catch (err: any) {
      setNotice(`Failed to update metric: ${err.message}`);
    } finally {
      setSavingMetric(false);
    }
  };

  const handleCreateCostPool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/super-admin/billing/cost-pools', {
        method: 'POST',
        body: JSON.stringify({
          poolName: poolForm.poolName,
          provider: poolForm.provider,
          metricType: poolForm.metricType,
          totalCostPaise: Math.round(Number(poolForm.totalCostPaise) * 100),
          providerInvoiceRef: poolForm.providerInvoiceRef || null,
          periodStart: new Date(poolForm.periodStart || Date.now()).toISOString(),
          periodEnd: new Date(poolForm.periodEnd || Date.now()).toISOString()
        })
      });
      setNotice(`Provider cost pool "${poolForm.poolName}" registered successfully.`);
      setIsPoolModalOpen(false);
      setPoolForm({
        poolName: '',
        provider: 'AWS',
        metricType: 'api_cpu_time_ms',
        totalCostPaise: '',
        providerInvoiceRef: '',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (err: any) {
      setNotice(`Failed to create cost pool: ${err.message}`);
    }
  };

  const handleAllocatePool = async (id: string, name: string) => {
    try {
      setAllocatingPoolId(id);
      await apiRequest(`/api/super-admin/billing/cost-pools/${id}/allocate`, {
        method: 'POST'
      });
      setNotice(`Cost pool "${name}" allocated proportionally across active tenants.`);
      loadData();
    } catch (err: any) {
      setNotice(`Failed to allocate pool: ${err.message}`);
    } finally {
      setAllocatingPoolId(null);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGeneratingInvoice(true);
      await apiRequest('/api/super-admin/billing/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId: invoiceForm.restaurantId,
          invoiceNumber: invoiceForm.invoiceNumber,
          periodStart: new Date(invoiceForm.periodStart || Date.now()).toISOString(),
          periodEnd: new Date(invoiceForm.periodEnd || Date.now()).toISOString()
        })
      });
      setNotice(`Invoice ${invoiceForm.invoiceNumber} generated with ${billingConfig.minimumGrossMarginPercent}% gross contribution enforced.`);
      setIsInvoiceModalOpen(false);
      loadData();
    } catch (err: any) {
      setNotice(`Invoice generation failed: ${err.message}`);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const getMetricIcon = (key: string) => {
    switch (key) {
      case 'api_requests':
        return <Cpu className="w-4 h-4 text-sky-600" />;
      case 'database_operations':
        return <Database className="w-4 h-4 text-emerald-600" />;
      case 'storage':
        return <HardDrive className="w-4 h-4 text-amber-600" />;
      case 'bandwidth':
        return <Wifi className="w-4 h-4 text-indigo-600" />;
      case 'realtime_messages':
        return <Radio className="w-4 h-4 text-purple-600" />;
      case 'background_tasks':
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const currentMargin = billingConfig.minimumGrossMarginPercent || 70;
  const currentDivisor = Math.max(0.01, 1 - currentMargin / 100).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-950 tracking-tight">Usage &amp; Metered Billing Engine</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 tracking-wider">
              Pay-As-You-Go Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Super Admin Usage Pricing Catalogue, custom gross margin controller, and telemetry reconciliation engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPoolModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>Add Provider Cost Pool</span>
          </button>
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Generate Tenant Invoice</span>
          </button>
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

      {/* Global Minimum Gross Margin Configuration Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Platform Gross Margin Guarantee
              </span>
            </div>
            <h3 className="text-lg font-black text-white">
              Minimum Target Gross Margin: <span className="text-emerald-400">{currentMargin}%</span>
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Customer price is automatically calculated from the base infrastructure cost \(C_t\) using{' '}
              <code className="text-emerald-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono text-[11px]">
                P_t = ceil(C_t / (1 - {currentMargin / 100})) = ceil(C_t / {currentDivisor})
              </code>
              . You have full authority to modify this profit margin at any time.
            </p>
          </div>

          <form onSubmit={handleSaveMargin} className="flex items-center gap-2 bg-slate-800/90 p-2 rounded-2xl border border-slate-700 shrink-0">
            <div className="flex items-center gap-1 px-3">
              <span className="text-xs font-bold text-slate-300">Set Margin:</span>
              <input
                type="number"
                min="1"
                max="99"
                step="0.5"
                required
                value={editingMargin}
                onChange={(e) => setEditingMargin(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-extrabold text-sm text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-sm font-black text-slate-300">%</span>
            </div>

            <button
              type="submit"
              disabled={savingMargin || editingMargin === currentMargin}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black text-xs transition"
            >
              {savingMargin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply Margin'}
            </button>
          </form>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('catalogue')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'catalogue' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Usage Pricing Catalogue</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'simulator' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Live Customer Price Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab('cost-pools')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'cost-pools' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Shared Cost Pools (Ledger B) ({costPools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'invoices' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Tenant Invoices ({invoices.length})</span>
        </button>
      </div>

      {/* TAB 1: USAGE PRICING CATALOGUE */}
      {activeTab === 'catalogue' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-extrabold">Illustrative catalogue, decided by Super Admin:</strong>
              <span className="ml-1 text-amber-800">
                You configure the base unit rate for each service. The customer price shown to restaurants and cinemas is automatically computed with your specified {currentMargin}% profit margin.
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Usage Metric</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Base Infra Rate</th>
                    <th className="py-3 px-4">Customer Rate ({currentMargin}% Margin)</th>
                    <th className="py-3 px-4">Gross Contribution</th>
                    <th className="py-3 px-4">Effective Margin</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalogue.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/60 transition">
                      {/* Metric Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-100 shrink-0">
                            {getMetricIcon(cat.metricKey)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">{cat.displayName}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{cat.description}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            cat.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cat.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{cat.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* Base Rate */}
                      <td className="py-4 px-4">
                        <div className="font-black text-slate-900">
                          ₹{cat.rateRupees?.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">/ {cat.unit}</div>
                      </td>

                      {/* Customer Rate */}
                      <td className="py-4 px-4">
                        <div className="font-black text-emerald-700">
                          ₹{cat.customerPriceRupees?.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">/ {cat.unit}</div>
                      </td>

                      {/* Gross Contribution */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">
                          ₹{cat.grossContributionRupees?.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">profit per unit</div>
                      </td>

                      {/* Effective Margin */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {cat.effectiveGrossMarginPercent}%
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditMetric(cat)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                        >
                          <Edit2 className="w-3 h-3 text-slate-600" />
                          <span>Edit Rate</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulator Inputs */}
          <div className="lg:col-span-1 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-sm text-slate-900">Telemetry Inputs</h3>
                <p className="text-[11px] text-slate-500">Test hypothetical tenant usage</p>
              </div>
              <button
                onClick={runSimulation}
                disabled={simulating}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Calculate'}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  API Requests (count)
                </label>
                <input
                  type="number"
                  step="1000"
                  value={simInputs.apiRequests}
                  onChange={(e) => setSimInputs({ ...simInputs, apiRequests: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Database Operations (ops)
                </label>
                <input
                  type="number"
                  step="1000"
                  value={simInputs.dbOperations}
                  onChange={(e) => setSimInputs({ ...simInputs, dbOperations: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Storage (GB-month)
                </label>
                <input
                  type="number"
                  step="1"
                  value={simInputs.storageGb}
                  onChange={(e) => setSimInputs({ ...simInputs, storageGb: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bandwidth (GB)
                </label>
                <input
                  type="number"
                  step="1"
                  value={simInputs.bandwidthGb}
                  onChange={(e) => setSimInputs({ ...simInputs, bandwidthGb: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Realtime WebSocket Messages
                </label>
                <input
                  type="number"
                  step="1000"
                  value={simInputs.realtimeMessages}
                  onChange={(e) => setSimInputs({ ...simInputs, realtimeMessages: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Background Tasks
                </label>
                <input
                  type="number"
                  step="1000"
                  value={simInputs.backgroundTasks}
                  onChange={(e) => setSimInputs({ ...simInputs, backgroundTasks: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Simulator Results */}
          <div className="lg:col-span-2 space-y-4">
            {simResult && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Base Infrastructure Cost (C_t)
                    </span>
                    <div className="mt-1 text-2xl font-black text-slate-900">
                      ₹{simResult.totalInfraCostRupees?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Direct + Shared provider cost</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                      Customer Price (P_t)
                    </span>
                    <div className="mt-1 text-2xl font-black text-emerald-950">
                      ₹{simResult.totalCustomerChargeRupees?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-0.5">With {currentMargin}% profit margin</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Gross Profit Contribution
                    </span>
                    <div className="mt-1 text-2xl font-black text-indigo-950">
                      ₹{simResult.totalGrossProfitRupees?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-indigo-700 mt-0.5 font-bold">
                      {simResult.actualMarginPercent}% Actual Margin
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Consumption</th>
                        <th className="py-3 px-4">Base Rate</th>
                        <th className="py-3 px-4">Infra Cost</th>
                        <th className="py-3 px-4">Customer Charge</th>
                        <th className="py-3 px-4">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {simResult.items?.map((item: any) => (
                        <tr key={item.metricKey} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-bold text-slate-900">{item.displayName}</td>
                          <td className="py-3 px-4 font-mono">{item.quantity.toLocaleString()} {item.unit}</td>
                          <td className="py-3 px-4">₹{item.rateRupees?.toFixed(2)}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">₹{item.infraCostRupees?.toFixed(2)}</td>
                          <td className="py-3 px-4 font-black text-emerald-700">₹{item.customerChargeRupees?.toFixed(2)}</td>
                          <td className="py-3 px-4 font-bold text-slate-700">₹{item.grossProfitRupees?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SHARED COST POOLS */}
      {activeTab === 'cost-pools' && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          {costPools.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No shared provider cost pools recorded yet. Click &quot;Add Provider Cost Pool&quot; to register AWS, Neon, or Railway bills.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Pool &amp; Provider</th>
                    <th className="py-3 px-4">Metric</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Total Cost</th>
                    <th className="py-3 px-4">Allocated</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costPools.map((p) => {
                    const isAllocating = allocatingPoolId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-slate-900">{p.poolName}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {p.provider} • Ref: {p.providerInvoiceRef || 'N/A'}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono text-[11px] text-slate-600">{p.metricType}</td>
                        <td className="py-4 px-4 text-slate-500 text-[11px]">
                          {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4 font-extrabold text-slate-900">
                          ₹{(p.totalCostPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-indigo-700 font-bold">
                          ₹{((p.allocatedCostPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              p.status === 'allocated'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <span>{p.status}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleAllocatePool(p.id, p.poolName)}
                            disabled={isAllocating}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 transition"
                          >
                            {isAllocating ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                            <span>{p.status === 'allocated' ? 'Re-allocate' : 'Allocate'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TENANT INVOICES */}
      {activeTab === 'invoices' && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          {invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No tenant invoices generated yet. Click &quot;Generate Tenant Invoice&quot; to calculate customer charges based on measured usage with {currentMargin}% gross margin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Infra Cost (C_t)</th>
                    <th className="py-3 px-4">Customer Charge (P_t)</th>
                    <th className="py-3 px-4">Gross Margin</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="py-4 px-4 font-extrabold text-slate-900">{inv.restaurantName || inv.restaurantId}</td>
                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        ₹{(inv.tenantTotalCostPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 font-black text-emerald-700">
                        ₹{(inv.customerChargePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          {inv.grossMarginPercent}%
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-700">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Metric Rate Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Edit Usage Metric Rate</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingItem.displayName}</p>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMetric} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Base Infrastructure Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editRateRupees}
                  onChange={(e) => setEditRateRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Unit Label
                </label>
                <input
                  type="text"
                  required
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  placeholder="e.g. 1,000 requests"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Unit Divisor / Multiplier
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editMultiplier}
                  onChange={(e) => setEditMultiplier(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  placeholder="e.g. 1000 for per thousand, 1 for per GB"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="isActiveToggle" className="font-bold text-slate-800">
                  Active (Charged to tenants)
                </label>
              </div>

              {/* Dynamic Live Customer Preview */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] space-y-1">
                <div className="font-bold text-emerald-950 flex items-center justify-between">
                  <span>Customer Price Preview ({currentMargin}% margin):</span>
                  <span className="text-emerald-700 text-xs">
                    ₹{(Math.ceil(Math.round(Number(editRateRupees || 0) * 100) / Number(currentDivisor)) / 100).toFixed(2)} / {editUnit}
                  </span>
                </div>
                <div className="text-emerald-800">
                  Profit: ₹{((Math.ceil(Math.round(Number(editRateRupees || 0) * 100) / Number(currentDivisor)) - Math.round(Number(editRateRupees || 0) * 100)) / 100).toFixed(2)} per unit
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMetric}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-50"
                >
                  {savingMetric ? 'Saving...' : 'Update Metric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Cost Pool Modal */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Add Shared Provider Cost Pool</h3>
                <p className="text-xs text-slate-500 mt-0.5">Record Ledger B actual infrastructure expenses</p>
              </div>
              <button onClick={() => setIsPoolModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCostPool} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Pool Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS App Runner - May 2026"
                  value={poolForm.poolName}
                  onChange={(e) => setPoolForm({ ...poolForm, poolName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Provider</label>
                  <select
                    value={poolForm.provider}
                    onChange={(e) => setPoolForm({ ...poolForm, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="AWS">AWS</option>
                    <option value="Neon">Neon DB</option>
                    <option value="Railway">Railway</option>
                    <option value="Cloudflare">Cloudflare</option>
                    <option value="Pusher">Pusher Realtime</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Metric Type</label>
                  <select
                    value={poolForm.metricType}
                    onChange={(e) => setPoolForm({ ...poolForm, metricType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-mono text-[11px]"
                  >
                    <option value="api_cpu_time_ms">api_cpu_time_ms</option>
                    <option value="db_workload_cu">db_workload_cu</option>
                    <option value="storage_mb">storage_mb</option>
                    <option value="bandwidth_mb">bandwidth_mb</option>
                    <option value="realtime_messages">realtime_messages</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Total Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1500.00"
                  value={poolForm.totalCostPaise}
                  onChange={(e) => setPoolForm({ ...poolForm, totalCostPaise: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Period Start</label>
                  <input
                    type="date"
                    required
                    value={poolForm.periodStart}
                    onChange={(e) => setPoolForm({ ...poolForm, periodStart: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Period End</label>
                  <input
                    type="date"
                    required
                    value={poolForm.periodEnd}
                    onChange={(e) => setPoolForm({ ...poolForm, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Record Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Generate Tenant Invoice</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enforces {currentMargin}% gross contribution margin</p>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateInvoice} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Select Tenant</label>
                <select
                  required
                  value={invoiceForm.restaurantId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, restaurantId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug}) • {t.tenantType}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Invoice Number</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Period Start</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.periodStart}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, periodStart: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Period End</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.periodEnd}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-900 border border-emerald-100 text-[11px] leading-relaxed">
                <strong>Pricing Formula Enforced:</strong> Total allocated cost \(C_t\) is divided by {currentDivisor} to guarantee a {currentMargin}% gross contribution margin.
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingInvoice}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  {generatingInvoice ? 'Calculating...' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
