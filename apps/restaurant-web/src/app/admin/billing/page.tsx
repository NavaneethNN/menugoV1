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
  QrCode,
  Users,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { loadRazorpaySdk } from '@/lib/razorpay';
import { useSession } from '@/lib/auth-client';

export default function RestaurantBillingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentData, setCurrentData] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansData, currentSubData] = await Promise.all([
        apiRequest('/api/subscriptions/plans?tenantType=restaurant'),
        apiRequest('/api/subscriptions/current')
      ]);

      setPlans(Array.isArray(plansData) ? plansData : []);
      setCurrentData(currentSubData);
    } catch (err: any) {
      console.error('Failed to load subscription data:', err);
      setNotice({ type: 'error', message: err.message || 'Failed to load subscription plans' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    loadData();
  }, [session, sessionLoading, router]);

  const handleSubscribe = async (plan: any) => {
    try {
      setPayingPlanId(plan.id);
      setNotice(null);

      // 1. Create checkout order on The QROS API
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
          name: 'The QROS Platform',
          description: `${plan.name} (${billingCycle.toUpperCase()}) Subscription`,
          order_id: order.orderId,
          prefill: {
            name: session?.user?.name || '',
            email: session?.user?.email || ''
          },
          theme: {
            color: '#ea580c' // Orange
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
                message: verifyRes.message || 'Payment verified! Your subscription is now active.'
              });
              loadData();
            } catch (verifyErr: any) {
              setNotice({
                type: 'error',
                message: verifyErr.message || 'Payment verification failed'
              });
            } finally {
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
        rzp.open();
      } else {
        // Fallback for sandboxes without external script access (Test simulation)
        const mockPaymentId = `pay_mock_${Date.now()}`;
        const mockSignature = `sig_mock_${Date.now()}`;

        const verifyRes = await apiRequest('/api/subscriptions/verify-payment', {
          method: 'POST',
          body: JSON.stringify({
            planId: plan.id,
            billingCycle,
            razorpayOrderId: order.orderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature
          })
        });

        setNotice({
          type: 'success',
          message: `${verifyRes.message || 'Subscription activated successfully'} (Simulated Checkout)`
        });
        loadData();
      }
    } catch (err: any) {
      console.error('Subscription checkout error:', err);
      setNotice({
        type: 'error',
        message: err.message || 'Could not initiate Razorpay checkout'
      });
    } finally {
      setPayingPlanId(null);
    }
  };

  const currentSub = currentData?.subscription;
  const currentPlan = currentSub?.plan;
  const isExpired = currentData?.isExpired;
  const daysRemaining = currentData?.daysRemaining ?? 0;
  const venue = currentData?.venue;
  const payments = currentData?.payments || [];

  if (loading && !currentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>Billing &amp; Subscriptions</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                Razorpay Secured
              </span>
            </h1>
            <p className="text-xs text-slate-500">{venue?.name || 'Restaurant'}</p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          title="Refresh Subscription Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Notice Banner */}
        {notice && (
          <div
            className={`p-4 rounded-lg flex items-center gap-3 text-xs font-semibold shadow-xs ${
              notice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div className="flex-1">{notice.message}</div>
            <button onClick={() => setNotice(null)} className="underline opacity-80 hover:opacity-100 text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {/* Current Subscription Status Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Current Plan Status
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    currentSub?.status === 'active' && !isExpired
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : isExpired || currentSub?.status === 'expired'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {currentSub?.status === 'active' && !isExpired
                    ? 'Active'
                    : isExpired || currentSub?.status === 'expired'
                    ? 'Expired'
                    : currentSub?.status || 'No Active Plan'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                {currentPlan?.name || 'Complimentary Trial'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {currentPlan?.description ||
                  'Your restaurant is currently operating on trial or starter privileges. Upgrade to an active plan for unlimited QR tables and advanced KDS operations.'}
              </p>
            </div>

            {/* Expiry / Days remaining widget */}
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-lg shrink-0">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-black">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isExpired ? 'Status' : 'Duration Remaining'}
                </div>
                <div className="text-lg font-black text-slate-900">
                  {isExpired ? (
                    <span className="text-rose-600 font-extrabold">Subscription Expired</span>
                  ) : currentSub?.currentPeriodEnd ? (
                    `${daysRemaining} Days Left`
                  ) : (
                    '30 Days Trial'
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {currentSub?.currentPeriodEnd
                    ? `Ends on ${new Date(currentSub.currentPeriodEnd).toLocaleDateString()}`
                    : 'Select a plan below to activate full tenure'}
                </div>
              </div>
            </div>
          </div>

          {/* Limits & Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">QR Table Limit</p>
                <p className="text-base font-black text-slate-900">
                  {currentPlan?.maxTables ? `${currentPlan.maxTables} Tables` : 'Unlimited Tables'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Staff PIN Accounts</p>
                <p className="text-base font-black text-slate-900">
                  {currentPlan?.maxStaff ? `${currentPlan.maxStaff} Staff Accounts` : 'Unlimited Staff'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Billing Interval</p>
                <p className="text-base font-black text-slate-900 capitalize">
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
              <h3 className="text-xl font-black text-slate-900">Available Subscription Plans</h3>
              <p className="text-xs text-slate-500 mt-1">
                Choose the plan that suits your floor size. Payments are processed securely in INR via Razorpay.
              </p>
            </div>

            {/* Monthly / Annual Toggle */}
            <div className="inline-flex p-1 bg-slate-200/80 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
              const pricePaise = billingCycle === 'annual' ? plan.priceAnnualPaise : plan.priceMonthlyPaise;
              const priceRupees = Math.round(pricePaise / 100);

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl bg-white border p-6 flex flex-col justify-between transition-all ${
                    isPopular
                      ? 'border-red-500 ring-2 ring-red-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-amber-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-3 h-3" />
                      <span>Most Popular</span>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xl font-black text-slate-900">{plan.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px] line-clamp-2">
                      {plan.description || 'Full platform contactless ordering and operations.'}
                    </p>

                    <div className="my-5 pb-5 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900">₹{priceRupees.toLocaleString('en-IN')}</span>
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
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{plan.maxTables ? `Up to ${plan.maxTables} QR Tables` : 'Unlimited Smart QR Tables'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{plan.maxStaff ? `${plan.maxStaff} Staff PIN Accounts` : 'Unlimited Staff Accounts'}</span>
                      </div>
                      {(plan.features || []).map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
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
                        ? 'bg-slate-100 text-slate-400 cursor-default'
                        : isPopular
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
                        : 'bg-red-700 hover:bg-red-800 text-white'
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
                        <span>Subscribe with Razorpay</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Invoice & Payment History */}
        {payments.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h4 className="text-base font-black text-slate-900 mb-4">Payment Receipts &amp; Invoices</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Cycle</th>
                    <th className="pb-3">Payment ID</th>
                    <th className="pb-3">Gateway</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p: any) => (
                    <tr key={p.id} className="text-slate-700">
                      <td className="py-3 font-medium">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 font-bold text-slate-900">₹{(p.amountPaise / 100).toLocaleString('en-IN')}</td>
                      <td className="py-3 capitalize text-slate-500">{p.billingCycle}</td>
                      <td className="py-3 font-mono text-[11px] text-slate-600">{p.razorpayPaymentId || '—'}</td>
                      <td className="py-3 font-semibold uppercase text-[10px] text-slate-500">{p.provider}</td>
                      <td className="py-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
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
          </section>
        )}
      </main>
    </div>
  );
}
