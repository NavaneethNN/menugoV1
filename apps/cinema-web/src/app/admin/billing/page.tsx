'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Loader2,
  Check,
  CreditCard,
  Tv,
  RefreshCw,
  Film,
  Truck,
  Cpu,
  Database,
  HardDrive,
  Activity,
  Radio,
  Zap,
  Receipt,
  Layers
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { CinemaSettingsTabs } from '@/components/cinema/CinemaSettingsTabs';

export default function CinemaUsageAndBillingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [loading, setLoading] = useState(true);
  const [currentData, setCurrentData] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [usageSummary, setUsageSummary] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payingUsage, setPayingUsage] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Resolve active theatre ID
      let venueId = typeof window !== 'undefined' ? localStorage.getItem('active_theatre_id') : null;
      let currentSubData = null;

      try {
        currentSubData = await apiRequest('/api/subscriptions/current', venueId ? { theatreId: venueId } : {});
        if (currentSubData?.venue?.id) {
          const resolvedId: string = currentSubData.venue.id;
          venueId = resolvedId;
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('active_theatre_id', resolvedId);
            } catch {}
          }
        }
      } catch (subErr) {
        console.warn('Could not load cinema subscription context:', subErr);
      }

      // If still no venueId, fetch user's theatres
      if (!venueId) {
        try {
          const myTheatres = await apiRequest('/api/cinema/theatres/my');
          const first = myTheatres[0];
          const foundId = first?.id || first?.theatre?.id;
          if (foundId) {
            const resolvedId: string = foundId;
            venueId = resolvedId;
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('active_theatre_id', resolvedId);
              } catch {}
            }
          }
        } catch {}
      }

      const reqOpts = venueId ? { theatreId: venueId } : {};

      const [ledgerData, usageData, invoicesData] = await Promise.all([
        apiRequest('/api/cinema/billing/current-ledger', reqOpts),
        apiRequest('/api/cinema/billing/usage', reqOpts).catch(() => []),
        apiRequest('/api/cinema/billing/invoices', reqOpts).catch(() => [])
      ]);

      setCurrentData(currentSubData);
      setLedger(ledgerData);
      setUsageSummary(Array.isArray(usageData) ? usageData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (err: any) {
      console.error('Failed to load cinema usage & billing data:', err);
      setNotice({ type: 'error', message: err.message || 'Failed to load usage & billing data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/cinema/login');
      return;
    }
    loadData();
  }, [session, sessionLoading, router]);

  const handlePayCurrentUsage = async () => {
    try {
      setPayingUsage(true);
      setNotice(null);
      const targetTheatreId = currentData?.venue?.id || (typeof window !== 'undefined' ? localStorage.getItem('active_theatre_id') : undefined);
      await apiRequest('/api/cinema/billing/pay-current-usage', {
        method: 'POST',
        ...(targetTheatreId ? { theatreId: targetTheatreId } : {}),
        body: JSON.stringify({
          paymentMethod: 'monthly_metered_billing',
          billingCycle: 'monthly'
        })
      });

      setNotice({
        type: 'success',
        message: 'Current month metered usage settled successfully!'
      });
      await loadData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to settle monthly metered usage'
      });
    } finally {
      setPayingUsage(false);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    try {
      setPayingInvoiceId(invoiceId);
      setNotice(null);
      const targetTheatreId = currentData?.venue?.id || (typeof window !== 'undefined' ? localStorage.getItem('active_theatre_id') : undefined);
      await apiRequest(`/api/cinema/billing/invoices/${invoiceId}/pay`, {
        method: 'POST',
        ...(targetTheatreId ? { theatreId: targetTheatreId } : {}),
        body: JSON.stringify({
          paymentMethod: 'monthly_metered_billing'
        })
      });

      setNotice({
        type: 'success',
        message: 'Metered usage invoice paid successfully!'
      });
      await loadData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to pay invoice'
      });
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const formatPaise = (paise?: number) => {
    if (paise === undefined || paise === null) return '₹0.00';
    return `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getMetricDisplay = (unit: string, quantity: number) => {
    switch (unit) {
      case 'cpu_ms':
        return { label: 'CPU Compute', value: `${Number(quantity).toLocaleString()} ms`, icon: Cpu, detail: 'Screen & seat ordering' };
      case 'memory_mb_hours':
        return { label: 'Memory Allocated', value: `${Number(quantity).toFixed(1)} MB-hrs`, icon: Activity, detail: 'Auditorium RAM' };
      case 'db_queries':
        return { label: 'Database Queries', value: `${Number(quantity).toLocaleString()} queries`, icon: Database, detail: 'Concessions & orders' };
      case 'storage_gb_hours':
        return { label: 'Media Storage', value: `${Number(quantity).toFixed(2)} GB-hrs`, icon: HardDrive, detail: 'Movie posters & banners' };
      case 'egress_bytes':
        return { label: 'Network Egress', value: `${(Number(quantity) / (1024 * 1024)).toFixed(2)} MB`, icon: Radio, detail: 'Menu & seat delivery' };
      case 'ws_connection_seconds':
        return { label: 'Live WebSockets', value: `${Number(quantity).toLocaleString()} conn-sec`, icon: Zap, detail: 'Live KDS & seat pass' };
      case 'worker_execution_ms':
        return { label: 'Admin Actions & Workers', value: `${Number(quantity).toLocaleString()} ms`, icon: Layers, detail: 'Screens & show schedule' };
      default:
        return { label: unit, value: `${Number(quantity).toLocaleString()} units`, icon: Activity, detail: 'Platform metered' };
    }
  };

  if (loading && !ledger && !currentData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const directCost = ledger?.directTenantCostPaise || 0;
  const sharedCost = ledger?.sharedInfrastructureCostPaise || 0;
  const totalCost = ledger?.tenantTotalCostPaise || (directCost + sharedCost);
  const customerCharge = ledger?.customerChargePaise || 0;
  const grossMargin = ledger?.grossMarginPercent ?? 70.0;
  const grossContribution = ledger?.grossContributionPaise || Math.max(0, customerCharge - totalCost);
  const categories = ledger?.categories || [];

  const defaultCategories = [
    { label: 'Application processing', unitLabel: 'compute', infrastructureCostPaise: 0, unitQuantity: 0 },
    { label: 'Database consumption', unitLabel: 'queries', infrastructureCostPaise: 0, unitQuantity: 0 },
    { label: 'Storage', unitLabel: 'media storage', infrastructureCostPaise: 0, unitQuantity: 0 },
    { label: 'Network usage', unitLabel: 'data transfer', infrastructureCostPaise: 0, unitQuantity: 0 },
    { label: 'Realtime processing', unitLabel: 'realtime sessions', infrastructureCostPaise: 0, unitQuantity: 0 },
    { label: 'Background & worker tasks', unitLabel: 'tasks & updates', infrastructureCostPaise: 0, unitQuantity: 0 }
  ];
  const statementCategories = categories.length > 0 ? categories : defaultCategories;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/cinema/admin/dashboard"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <span>Usage &amp; Billing</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                100% Pay-As-You-Go
              </span>
            </h1>
            <p className="text-xs text-slate-400">Cinema Theatre Administration • Pure Metered Infrastructure Billing</p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Refresh Usage & Billing Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <CinemaSettingsTabs />

        {/* Notice Banner */}
        {notice && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${
              notice.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-800'
                : 'bg-rose-950/80 text-rose-200 border border-rose-800'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div className="flex-1">{notice.message}</div>
            <button onClick={() => setNotice(null)} className="underline opacity-80 hover:opacity-100 text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Allocated Infra Cost</p>
            <p className="text-2xl font-black text-white mt-1">{formatPaise(totalCost)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Direct ({formatPaise(directCost)}) + Shared ({formatPaise(sharedCost)})</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Contribution</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{formatPaise(grossContribution)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{grossMargin}% platform margin enforced</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimated Amount Due</p>
            <p className="text-2xl font-black text-indigo-400 mt-1">{formatPaise(customerCharge)}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Independent {ledger?.grossMarginPercent || 70}% gross margin</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Settlement</p>
              <p className="text-xs text-slate-300 font-medium mt-1">Pay month&apos;s metered usage</p>
            </div>
            <button
              onClick={handlePayCurrentUsage}
              disabled={payingUsage || customerCharge === 0}
              className="mt-3 w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              {payingUsage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pay Month&apos;s Usage</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SECTION 6: Understandable Monthly Usage Statement */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">{currentData?.venue?.name || 'Cinema Workspace'}</h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live estimate
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monthly usage statement • Real-time metered infrastructure allocation
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Billing Cycle</span>
              <p className="text-xs font-semibold text-slate-300">
                {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="pb-3">Usage category</th>
                  <th className="pb-3 text-right">Measured Share</th>
                  <th className="pb-3 text-right">Allocated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {statementCategories.map((cat: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 font-semibold text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500/60"></span>
                      {cat.label}
                    </td>
                    <td className="py-3 text-right text-slate-400 text-[11px] font-mono">
                      {cat.unitQuantity > 0
                        ? `${Number(cat.unitQuantity).toLocaleString()} ${cat.unitLabel}`
                        : 'Active / Metered'}
                    </td>
                    <td className="py-3 text-right font-semibold text-white font-mono">
                      {formatPaise(cat.infrastructureCostPaise)}
                    </td>
                  </tr>
                ))}

                {/* Allocated infrastructure cost */}
                <tr className="border-t-2 border-slate-700 bg-slate-800/60 font-bold">
                  <td className="py-3 text-white">Allocated infrastructure cost</td>
                  <td className="py-3 text-right text-[10px] uppercase text-slate-400">C_t = D_t + Σ A_(t,s)</td>
                  <td className="py-3 text-right font-mono text-sm text-white">
                    {formatPaise(totalCost)}
                  </td>
                </tr>

                {/* Gross contribution */}
                <tr className="bg-emerald-950/40 text-emerald-200 font-bold border-t border-slate-800">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span>Gross contribution</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                        {ledger?.grossMarginPercent || 70}% Platform Margin
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-[11px] text-emerald-400 font-semibold">Independent per-theatre margin</td>
                  <td className="py-3 text-right font-mono text-sm text-emerald-300">
                    {formatPaise(grossContribution)}
                  </td>
                </tr>

                {/* Estimated amount payable before tax */}
                <tr className="border-t-2 border-indigo-500 bg-slate-900 text-white font-black">
                  <td className="py-4 pl-3 rounded-l-xl text-sm">
                    <div>
                      <span>Estimated amount payable before tax</span>
                      <p className="text-[10px] font-normal text-slate-400 mt-0.5">
                        Pricing formula: P_t = C_t / 0.30 (rounded upward to nearest paisa)
                      </p>
                    </div>
                  </td>
                  <td className="py-4 text-right text-xs text-slate-300 font-medium">Month-to-date total</td>
                  <td className="py-4 pr-3 text-right text-lg text-indigo-400 font-mono rounded-r-xl">
                    {formatPaise(customerCharge)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400 italic mt-3">
            Final amount subject to provider-cost reconciliation.
          </p>
        </section>

        {/* Metered Resource Breakdown */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div>
              <h3 className="text-base font-black text-white">Live Metered Usage Activity</h3>
              <p className="text-xs text-slate-400">
                Usage is tracked automatically for every customer order, active concessions menu browsing, and theatre admin updates.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-indigo-300 border border-slate-700">
              Zero Fixed Subscriptions
            </span>
          </div>

          {usageSummary.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-300">No usage recorded yet in current cycle</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                As patrons view screen menus, place in-seat snacks orders, or admins update screen schedules, real-time counters record consumption automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              {usageSummary.map((item, idx) => {
                const display = getMetricDisplay(item.unit, Number(item.totalQuantity));
                const Icon = display.icon;
                return (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{display.label}</p>
                      <p className="text-lg font-black text-white mt-0.5 truncate">{display.value}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Direct: {formatPaise(item.totalDirectCostPaise)} • {display.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Metered Invoices Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-black text-white">Metered Infrastructure Invoices</h4>
              <p className="text-xs text-slate-400">Monthly billing statements based strictly on your verified consumption.</p>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
              {invoices.length} Invoices
            </span>
          </div>

          {invoices.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No metered invoices generated yet. Your monthly statements will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                    <th className="pb-3">Invoice #</th>
                    <th className="pb-3">Billing Window</th>
                    <th className="pb-3">Direct Cost</th>
                    <th className="pb-3">Shared Share</th>
                    <th className="pb-3">Total Charged</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="text-slate-300">
                      <td className="py-3 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="py-3 text-slate-400">
                        {new Date(inv.periodStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} –{' '}
                        {new Date(inv.periodEnd).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3">{formatPaise(inv.directTenantCostPaise)}</td>
                      <td className="py-3">{formatPaise(inv.sharedInfrastructureCostPaise)}</td>
                      <td className="py-3 font-bold text-white">{formatPaise(inv.customerChargePaise)}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inv.status === 'paid'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {inv.status !== 'paid' ? (
                          <button
                            onClick={() => handlePayInvoice(inv.id)}
                            disabled={payingInvoiceId === inv.id}
                            className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition flex items-center gap-1 ml-auto shadow-xs"
                          >
                            {payingInvoiceId === inv.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <span>Pay Now</span>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center justify-end gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Audited Policy Card */}
        <section className="bg-slate-900 border border-indigo-900/40 rounded-xl p-6 shadow-xs">
          <h4 className="text-sm font-black flex items-center gap-2 mb-2 text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Audited Theatre Isolation &amp; Cost Policy (billing.md)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300 pt-2 border-t border-slate-800">
            <div>
              <p className="font-bold text-white mb-1">1. Pure Metered Pay-As-You-Go</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                No monthly subscription plans. Small metered usage is automatically added as patrons place seat orders, browse concessions, and admins manage auditoriums.
              </p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">2. Zero Cross-Tenant Costs</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Cinema A never pays for Cinema B or restaurant usage. Every direct event maps strictly to your theatre UUID.
              </p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">3. Monthly Settle &amp; Pay</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Review verified month-to-date charges anytime and pay monthly with instant settlement.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
