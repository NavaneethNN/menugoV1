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
  Truck
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { loadRazorpaySdk } from '@/lib/razorpay';
import { useSession } from '@/lib/auth-client';
import { CinemaSettingsTabs } from '@/components/cinema/CinemaSettingsTabs';

export default function CinemaBillingPage() {
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
        apiRequest('/api/subscriptions/plans?tenantType=cinema'),
        apiRequest('/api/subscriptions/current')
      ]);

      setPlans(Array.isArray(plansData) ? plansData : []);
      setCurrentData(currentSubData);
    } catch (err: any) {
      console.error('Failed to load cinema subscription data:', err);
      setNotice({ type: 'error', message: err.message || 'Failed to load subscription plans' });
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
          description: `${plan.name} (${billingCycle.toUpperCase()}) Subscription`,
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
                message: verifyRes.message || 'Payment verified! Your theatre subscription is now active.'
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

  const currentPlan = currentData?.plan;
  const currentSub = currentData?.subscription;
  const daysRemaining = currentData?.daysRemaining ?? null;
  const isExpired = currentData?.isExpired ?? false;
  const payments = currentData?.recentPayments || [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Film className="w-6 h-6 text-indigo-400" />
              Theatre Plan &amp; Billing
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage your cinema tier, live screens limit, seat delivery features, and billing cycles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Settings Tab Bar */}
        <CinemaSettingsTabs />

        {/* Notices */}
        {notice && (
          <div
            className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-3 ${
              notice.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="flex-1">{notice.message}</span>
            <button
              onClick={() => setNotice(null)}
              className="text-slate-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* Current Active Plan Status Card */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                  Current Theatre Plan
                </span>
                {currentSub?.status && (
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                      isExpired || currentSub.status === 'expired'
                        ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                        : currentSub.status === 'active'
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                        : 'bg-amber-950/60 text-amber-400 border-amber-800'
                    }`}
                  >
                    {isExpired ? 'EXPIRED' : currentSub.status}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-3xl font-black text-white">
                  {currentPlan?.name || 'No Active Plan'}
                </h2>
                <p className="text-xs text-slate-400 max-w-xl mt-1">
                  {currentPlan?.description || 'Select a theatre subscription plan below to unlock all cinema screens, in-seat delivery, and concession kitchen displays.'}
                </p>
              </div>

              {currentSub && (
                <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      {isExpired ? (
                        <span className="text-rose-400 font-bold">Subscription Expired</span>
                      ) : (
                        <>
                          <strong className="text-white font-bold">{daysRemaining ?? 0} days</strong> remaining
                        </>
                      )}
                    </span>
                  </div>

                  {currentSub.currentPeriodEnd && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>Expires on:</span>
                      <strong className="text-slate-200">
                        {new Date(currentSub.currentPeriodEnd).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </strong>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Tv className="w-4 h-4 text-indigo-400" />
                    <span>
                      Screen Limit: <strong className="text-white">{currentPlan?.maxScreens || 'Unlimited'}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              <a
                href="#choose-plan"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition text-center"
              >
                {currentPlan ? 'Upgrade / Renew Plan' : 'Select a Plan'}
              </a>
              <span className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Razorpay Verified Platform
              </span>
            </div>
          </div>
        </div>

        {/* Plan Selection Section */}
        <div id="choose-plan" className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Available Cinema Plans
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Switch billing cycle or upgrade to scale additional auditorium screens and in-seat delivery.
              </p>
            </div>

            {/* Monthly / Annual Toggle */}
            <div className="inline-flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  billingCycle === 'monthly'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">
                  Save ~15%
                </span>
              </button>
            </div>
          </div>

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const pricePaise = billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
              const priceRupees = Math.round((pricePaise || 0) / 100);
              const isCurrent = currentPlan?.id === plan.id;
              const isPaying = payingPlanId === plan.id;
              const isPopular = plan.slug?.includes('pro') || plan.slug?.includes('growth');

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 transition flex flex-col justify-between relative bg-slate-800/80 border ${
                    isPopular
                      ? 'border-indigo-500 shadow-xl shadow-indigo-500/10'
                      : isCurrent
                      ? 'border-emerald-500/70'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow">
                      Most Popular For Multiplexes
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-black text-white">{plan.name}</h3>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 min-h-[36px] mb-4">
                      {plan.description}
                    </p>

                    <div className="mb-6 pb-6 border-b border-slate-700/60">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">
                          ₹{priceRupees.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-slate-400">
                          /{billingCycle === 'annual' ? 'year' : 'month'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        + applicable taxes • billed {billingCycle}
                      </span>
                    </div>

                    {/* Features List */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>
                          <strong>{plan.maxScreens || 'Unlimited'}</strong> Screen{plan.maxScreens === 1 ? '' : 's'} included
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Truck className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Seat QR ordering &amp; In-seat delivery</span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Auditorium row &amp; seat layout editor</span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Coins className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Direct Razorpay Concessions settlement</span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Kitchen Display (KDS) &amp; Runner dispatch</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isPaying || loading}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                        : isPopular
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        {isCurrent ? 'Renew Plan via Razorpay' : 'Subscribe via Razorpay'}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment History / Receipts */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              Payment Invoices &amp; Transaction History
            </h2>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-700 rounded-xl">
              No subscription payment records found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-3 font-semibold">Invoice #</th>
                    <th className="pb-3 font-semibold">Billing Cycle</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Payment ID</th>
                    <th className="pb-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-slate-300">
                  {payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-700/30">
                      <td className="py-3 font-mono text-[11px] text-white">
                        {p.invoiceNumber || p.id.slice(0, 8)}
                      </td>
                      <td className="py-3 capitalize">{p.billingCycle}</td>
                      <td className="py-3 font-bold text-white">
                        ₹{(p.amountPaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === 'captured' || p.status === 'success'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-400">
                        {p.razorpayPaymentId || '—'}
                      </td>
                      <td className="py-3 text-slate-400">
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
