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
  X
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

type ActiveTab = 'cost-pools' | 'invoices' | 'unattributed';

export default function SuperAdminBillingPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cost-pools');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Cost Pools State (Ledger B)
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

  // Tenant Invoices State
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

  // Unattributed Costs State
  const [unattributed, setUnattributed] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [poolsData, invData, unattrData, tenantsData] = await Promise.all([
        apiRequest('/api/super-admin/billing/cost-pools').catch(() => []),
        apiRequest('/api/super-admin/billing/invoices').catch(() => []),
        apiRequest('/api/super-admin/billing/unattributed-costs').catch(() => []),
        apiRequest('/api/super-admin/tenants').catch(() => [])
      ]);

      setCostPools(Array.isArray(poolsData) ? poolsData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setUnattributed(Array.isArray(unattrData) ? unattrData : []);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);

      if (tenantsData && tenantsData.length > 0 && !invoiceForm.restaurantId) {
        setInvoiceForm((prev) => ({ ...prev, restaurantId: tenantsData[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load billing ledgers:', err);
      setNotice(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      setNotice(`Invoice ${invoiceForm.invoiceNumber} generated with 70% gross contribution enforced.`);
      setIsInvoiceModalOpen(false);
      loadData();
    } catch (err: any) {
      setNotice(`Invoice generation failed: ${err.message}`);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const totalPoolCostPaise = costPools.reduce((acc, p) => acc + (p.totalCostPaise || 0), 0);
  const totalAllocatedPaise = costPools.reduce((acc, p) => acc + (p.allocatedCostPaise || 0), 0);
  const totalInvoicedPaise = invoices.reduce((acc, i) => acc + (i.customerChargePaise || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">Metered Billing &amp; Cost Ledgers</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ledger A (Tenant Usage) &amp; Ledger B (Provider Costs) allocation engine with strict 70% gross margin target.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPoolModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Provider Costs (Ledger B)</span>
            <Server className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-950">
            ₹{(totalPoolCostPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Actual provider expenses recorded</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Allocated to Tenants</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-950">
            ₹{(totalAllocatedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Distributed by measured usage share</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Invoiced Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-950">
            ₹{(totalInvoicedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold">P_t = ceil(C_t / 0.30) enforced</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Target Gross Margin</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-950">70.0%</div>
          <div className="mt-1 text-[11px] text-slate-500">Pure metered pay-as-you-go</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('cost-pools')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'cost-pools' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Shared Cost Pools (Ledger B) ({costPools.length})
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'invoices' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tenant Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('unattributed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'unattributed' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Unattributed Telemetry ({unattributed.length})
        </button>
      </div>

      {/* Tab 1: Cost Pools */}
      {activeTab === 'cost-pools' && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-2" />
              <span className="text-xs">Loading shared cost pools...</span>
            </div>
          ) : costPools.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No shared provider cost pools recorded yet. Click &quot;Add Provider Cost Pool&quot; to register AWS, Neon, or Railway bills.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Pool &amp; Provider</th>
                    <th className="py-3 px-4">Allocation Metric</th>
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
                        <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                          {p.metricType}
                        </td>
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
                            disabled={isAllocating || p.status === 'allocated'}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 transition"
                          >
                            {isAllocating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                            ) : null}
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

      {/* Tab 2: Invoices */}
      {activeTab === 'invoices' && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-2" />
              <span className="text-xs">Loading tenant invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No tenant invoices generated yet. Click &quot;Generate Tenant Invoice&quot; to calculate customer charges based on Ledger A + Ledger B.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Direct Infra Cost</th>
                    <th className="py-3 px-4">Shared Infra Cost</th>
                    <th className="py-3 px-4">Total Infra (C_t)</th>
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
                      <td className="py-4 px-4 text-slate-600">
                        ₹{(inv.directTenantCostPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-slate-600">
                        ₹{(inv.sharedInfrastructureCostPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

      {/* Tab 3: Unattributed Costs */}
      {activeTab === 'unattributed' && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-2" />
              <span className="text-xs">Loading unattributed telemetry...</span>
            </div>
          ) : unattributed.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              All infrastructure consumption is 100% attributed to registered tenants. No orphan usage detected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Detected At</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unattributed.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">{u.providerService}</td>
                      <td className="py-4 px-4 font-bold text-rose-600">
                        ₹{(u.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-slate-500 text-[11px]">{new Date(u.detectedAt).toLocaleString()}</td>
                      <td className="py-4 px-4 text-slate-600 text-[11px]">{u.investigationNotes || '—'}</td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                          {u.status}
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

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Invoice Reference</label>
                <input
                  type="text"
                  placeholder="e.g. AWS-INV-99381"
                  value={poolForm.providerInvoiceRef}
                  onChange={(e) => setPoolForm({ ...poolForm, providerInvoiceRef: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
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
                <p className="text-xs text-slate-500 mt-0.5">Calculates Pt = ceil(Ct / 0.30) (70% gross contribution)</p>
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
                <strong>Pricing Formula Enforced:</strong> Total allocated cost \(C_t\) is divided by 0.30 to guarantee a 70% gross contribution margin before tax.
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
