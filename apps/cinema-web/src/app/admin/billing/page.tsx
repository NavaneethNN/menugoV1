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
  Sparkles,
  CreditCard,
  Tv,
  Users,
  RefreshCw,
  ExternalLink,
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
import { loadRazorpaySdk } from '@/lib/razorpay';
import { useSession } from '@/lib/auth-client';
import { CinemaSettingsTabs } from '@/components/cinema/CinemaSettingsTabs';

export default function CinemaUsageAndBillingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentData, setCurrentData] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [usageSummary, setUsageSummary] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payingUsage, setPayingUsage] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'usage' | 'plans' | 'invoices'>('usage');

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansData, currentSubData, ledgerData, usageData, invoicesData] = await Promise.all([
        apiRequest('/api/subscriptions/plans?tenantType=cinema').catch(() => []),
        apiRequest('/api/subscriptions/current').catch(() => null),
        apiRequest('/api/cinema/billing/current-ledger').catch(() => null),
        apiRequest('/api/cinema/billing/usage').catch(() => []),
        apiRequest('/api/cinema/billing/invoices').catch(() => [])
      ]);

      setPlans(Array.isArray(plansData) ? plansData : []);
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

  const handleSubscribe = async (plan: any) => {
    try {
      setPayingPlanId(plan.id);
      setNotice(null);

      // 1. Create checkout order on MenuGo API
      const order = await apiRequest('/api/subscriptions/create-checkout-order', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.id,
          billingCycle
        })
      });

      // 2. Load Razorpay Checkout SDK
      const isSdkLoaded = await loadRazorpaySdk();

      if (isSdkLoaded && typeof (window as any).Razorpay === 'function') {
        const options = {
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency || 'INR',
          name: 'MenuGo Cinema Platform',
          description: `${plan.name} (${billingCycle.toUpperCase()}) Monthly Subscription`,
          order_id: order.orderId,
          prefill: {
            name: session?.user?.name || '',
            email: session?.user?.email || ''
          },
          theme: {
            color: '#6366f1' // Indigo
          },
          handler: async (response: any) => {
            try {
              setLoading(true);
              const verifyRes = await apiRequest('/api/subscriptions/verify-payment', {
                method: 'POST',
                body: JSON.stringify({
                  planId: plan.id,
                  billingCycle,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature
                })
              });

              setNotice({
                type: 'success',
                message: verifyRes.message || 'Monthly payment verified! Your theatre subscription is now active.'
              });
              loadData();
            } catch (verifyErr: any) {
              setNotice({
                type: 'error',
                message: verifyErr.message || 'Payment verification failed'
              });
            } finally {
              setPayingPlanId(null);
              setLoading(false);
            }
          },
          modal: {
            ondismiss: () => {
              setPayingPlanId(null);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setNotice({
            type: 'error',
            message: resp.error?.description || 'Payment failed or was cancelled.'
          });
          setPayingPlanId(null);
        });
        rzp.open();
      } else {
        throw new Error('Razorpay payment gateway SDK could not be loaded in browser.');
      }
    } catch (err: any) {
      console.error('Subscription checkout error:', err);
      setNotice({
        type: 'error',
        message: err.message || 'Failed to initiate Razorpay checkout'
      });
      setPayingPlanId(null);
    }
  };

  const handlePayCurrentUsage = async () => {
    try {
      setPayingUsage(true);
      setNotice(null);
      await apiRequest('/api/cinema/billing/pay-current-usage', {
        method: 'POST',
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
      await apiRequest(`/api/cinema/billing/invoices/${invoiceId}/pay`, {
        method: 'POST',
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

  const currentPlan = currentData?.plan;
  const currentSub = currentData?.subscription;
  const daysRemaining = currentData?.daysRemaining ?? null;
  const isExpired = currentData?.isExpired ?? false;
  const payments = currentData?.payments || [];

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
        return { label: 'CPU Compute', value: `${Number(quantity).toLocaleString()} ms`, icon: Cpu };
      case 'memory_mb_hours':
        return { label: 'Memory Allocated', value: `${Number(quantity).toFixed(1)} MB-hrs`, icon: Activity };
      case 'db_queries':
        return { label: 'Database Queries', value: `${Number(quantity).toLocaleString()} queries`, icon: Database };
      case 'storage_gb_hours':
        return { label: 'Media Storage', value: `${Number(quantity).toFixed(2)} GB-hrs`, icon: HardDrive };
      case 'egress_bytes':
        return { label: 'Network Egress', value: `${(Number(quantity) / (1024 * 1024)).toFixed(2)} MB`, icon: Radio };
      case 'ws_connection_seconds':
        return { label: 'Live WebSockets', value: `${Number(quantity).toLocaleString()} conn-sec`, icon: Zap };
      case 'worker_execution_ms':
        return { label: 'Worker Execution', value: `${Number(quantity).toLocaleString()} ms`, icon: Layers };
      default:
        return { label: unit, value: `${Number(quantity).toLocaleString()} units`, icon: Activity };
    }
  };

  if (loading && !currentData && !ledger) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const directCost = ledger?.directTenantCostPaise || 0;
  const sharedCost = ledger?.sharedInfrastructureCostPaise || 0;
  const totalCost = ledger?.tenantTotalCostPaise || 0;
  const customerCharge = ledger?.customerChargePaise || 0;
  const grossMargin = ledger?.grossMarginPercent ?? 70.0;

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
                Metered Isolation &amp; Monthly
              </span>
            </h1>
            <p className="text-xs text-slate-400">Cinema Theatre Administration</p>
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

        {/* Tab Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'usage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Metered Usage &amp; Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'plans'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Monthly Subscription Plans</span>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'invoices'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Invoices &amp; Receipts ({invoices.length + payments.length})</span>
          </button>
        </div>

        {/* TAB 1: METERED USAGE & LEDGER */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            {/* Top Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Direct Consumption</p>
                <p className="text-2xl font-black text-white mt-1">{formatPaise(directCost)}</p>
                <p className="text-[11px] text-slate-400 mt-1">Auditorium &amp; seat isolated resources</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shared Infra Share</p>
                <p className="text-2xl font-black text-white mt-1">{formatPaise(sharedCost)}</p>
                <p className="text-[11px] text-slate-400 mt-1">Proportional cluster allocation</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Period Total</p>
                <p className="text-2xl font-black text-indigo-400 mt-1">{formatPaise(customerCharge)}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{grossMargin}% margin enforced</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Metered Settlement</p>
                  <p className="text-xs text-slate-300 font-medium mt-1">Pay month-to-date metered usage</p>
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
                      <span>Pay Month's Usage</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Metered Resource Breakdown */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
                <div>
                  <h3 className="text-base font-black text-white">Current Month Metered Usage Counters</h3>
                  <p className="text-xs text-slate-400">
                    Tracked automatically across seat ordering, screen QR scans, KDS live pass, and delivery sockets.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                  Strict Theatre Cost Isolation
                </span>
              </div>

              {usageSummary.length === 0 ? (
                <div className="py-10 text-center">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-300">No usage recorded yet in current cycle</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                    As your theatre delivers snacks to seats, scans screen tickets, and broadcasts live orders, metered counters update automatically.
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
                            Direct: {formatPaise(item.totalDirectCostPaise)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Formula & Policy Audit Card */}
            <section className="bg-slate-900 border border-indigo-900/40 rounded-xl p-6 shadow-xs">
              <h4 className="text-sm font-black flex items-center gap-2 mb-2 text-indigo-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Audited Theatre Isolation &amp; Cost Invariants (billing.md)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300 pt-2 border-t border-slate-800">
                <div>
                  <p className="font-bold text-white mb-1">1. Zero Cross-Tenant Leakage</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Cinema A never pays for Cinema B or restaurant usage. Every direct event maps to your unique theatre UUID.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-white mb-1">2. Proportional Shared Costs</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Provider infrastructure (Neon DB, Railway clusters, Cloudflare) is allocated strictly by measured usage ratio.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-white mb-1">3. Transparent Monthly Pricing</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Customer charge is calculated as <code className="text-indigo-300">TOTAL_COST / 0.30</code> guaranteeing a minimum 70% gross margin floor.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: MONTHLY PLANS & SUBSCRIPTION */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            {/* Current Subscription Status Card */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Current Plan Status
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                        currentSub?.status === 'active' && !isExpired
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : isExpired || currentSub?.status === 'expired'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {currentSub?.status === 'active' && !isExpired
                        ? 'Active'
                        : isExpired || currentSub?.status === 'expired'
                        ? 'Expired'
                        : currentSub?.status || 'Trial'}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {currentPlan?.name || 'Complimentary Theatre Trial'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    {currentPlan?.description ||
                      'Manage your cinema tier, live screens limit, seat delivery features, and monthly billing cycles.'}
                  </p>
                </div>

                {/* Expiry Widget */}
                <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 p-4 rounded-xl shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {isExpired ? 'Status' : 'Duration Remaining'}
                    </div>
                    <div className="text-lg font-black text-white">
                      {isExpired ? (
                        <span className="text-rose-400 font-extrabold">Subscription Expired</span>
                      ) : daysRemaining !== null ? (
                        `${daysRemaining} Days Left`
                      ) : (
                        '30 Days Trial'
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {currentSub?.currentPeriodEnd
                        ? `Ends on ${new Date(currentSub.currentPeriodEnd).toLocaleDateString()}`
                        : 'Select a plan below to pay monthly'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Limits & Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Screen Limit</p>
                    <p className="text-base font-black text-white">
                      {currentPlan?.maxScreens ? `${currentPlan.maxScreens} Screens` : 'Unlimited Screens'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seat Delivery</p>
                    <p className="text-base font-black text-white">
                      {currentPlan?.features?.includes('Seat Delivery') || currentPlan?.features?.includes('In-seat delivery')
                        ? 'Enabled'
                        : 'Standard Pickup'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Billing Interval</p>
                    <p className="text-base font-black text-white capitalize">
                      {currentSub?.billingCycle || 'Monthly'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Plans Selection Section */}
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-white">Cinema Subscription Tiers</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Pay monthly or choose annual billing to save 17%. All payments are processed in INR via Razorpay.
                  </p>
                </div>

                {/* Monthly / Annual Toggle */}
                <div className="inline-flex p-1 bg-slate-900 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                      billingCycle === 'monthly'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pay Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      billingCycle === 'annual'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Annual Billing</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold uppercase">
                      Save 17%
                    </span>
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const isCurrent = currentSub?.planId === plan.id && currentSub?.status === 'active' && !isExpired;
                  const isPopular = plan.isPopular;
                  const pricePaise = billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
                  const priceRupees = Math.round(pricePaise / 100);

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-xl bg-slate-900 border p-6 flex flex-col justify-between transition-all ${
                        isPopular
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                          : 'border-slate-800 hover:border-slate-700 shadow-xs'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                          <Sparkles className="w-3 h-3" />
                          <span>Recommended Tier</span>
                        </div>
                      )}

                      <div>
                        <h4 className="text-xl font-black text-white">{plan.name}</h4>
                        <p className="text-xs text-slate-400 mt-1 min-h-[32px] line-clamp-2">
                          {plan.description || 'Full auditorium QR ordering, live KDS pass, and staff seat delivery.'}
                        </p>

                        <div className="my-5 pb-5 border-b border-slate-800">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">₹{priceRupees.toLocaleString('en-IN')}</span>
                            <span className="text-xs font-bold text-slate-400">
                              /{billingCycle === 'annual' ? 'year' : 'month'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {billingCycle === 'annual'
                              ? `Billed annually (approx ₹${Math.round(priceRupees / 12)}/mo)`
                              : 'Billed monthly. Renews automatically.'}
                          </p>
                        </div>

                        <div className="space-y-2.5 mb-6">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Plan Highlights</p>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{plan.maxScreens ? `Up to ${plan.maxScreens} Screens` : 'Unlimited Screens'}</span>
                          </div>
                          {(plan.features || []).map((f: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={isCurrent || payingPlanId === plan.id}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs ${
                          isCurrent
                            ? 'bg-slate-800 text-slate-500 cursor-default'
                            : isPopular
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                        }`}
                      >
                        {payingPlanId === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCurrent ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Current Active Plan</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>Pay Monthly with Razorpay</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: INVOICES & RECEIPTS */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {/* Metered Usage Invoices */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-black text-white">Metered Infrastructure Invoices</h4>
                <span className="text-xs text-slate-400">{invoices.length} Invoices</span>
              </div>

              {invoices.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No metered infrastructure invoices issued yet.
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
                        <th className="pb-3">Customer Charge</th>
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

            {/* Monthly Subscription Payment Receipts */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-black text-white">Subscription Receipts &amp; Transactions</h4>
                <span className="text-xs text-slate-400">{payments.length} Payments</span>
              </div>

              {payments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No subscription payment transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Cycle</th>
                        <th className="pb-3">Payment ID</th>
                        <th className="pb-3">Gateway</th>
                        <th className="pb-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {payments.map((p: any) => (
                        <tr key={p.id} className="text-slate-300">
                          <td className="py-3 font-medium">
                            {new Date(p.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3 font-bold text-white">{formatPaise(p.amountPaise)}</td>
                          <td className="py-3 capitalize text-slate-400">{p.billingCycle}</td>
                          <td className="py-3 font-mono text-[11px] text-slate-400">{p.razorpayPaymentId || '—'}</td>
                          <td className="py-3 font-semibold uppercase text-[10px] text-slate-400">{p.provider}</td>
                          <td className="py-3 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                p.status === 'success'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
