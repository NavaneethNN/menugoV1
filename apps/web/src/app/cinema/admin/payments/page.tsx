'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
  PowerOff,
  Trash2,
  Building2,
  ExternalLink,
  ArrowLeft,
  Key,
  Eye,
  EyeOff,
  History,
  AlertTriangle,
  Zap,
  Check,
  X
} from 'lucide-react';

interface PaymentAccount {
  id: string;
  theatreId: string;
  provider: 'razorpay' | 'paytm';
  environment: 'test' | 'live';
  keyId: string;
  maskedKeySecret: string;
  hasWebhookSecret: boolean;
  status: 'connected' | 'disconnected' | 'verification_failed' | 'disabled';
  isVerified: boolean;
  verifiedAt: string | null;
  lastVerificationError: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface PaymentTransaction {
  id: string;
  theatreId: string;
  orderId: string | null;
  orderNumber?: string | null;
  provider: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  amount: number;
  currency: string;
  status: string;
  refundStatus: string | null;
  refundAmount: number;
  createdAt: string;
}

export default function CinemaPaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [theatreName, setTheatreName] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal / Form state
  const [modalProvider, setModalProvider] = useState<'razorpay' | 'paytm' | null>(null);
  const [formEnv, setFormEnv] = useState<'test' | 'live'>('test');
  const [formKeyId, setFormKeyId] = useState('');
  const [formKeySecret, setFormKeySecret] = useState('');
  const [formWebhookSecret, setFormWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Verifying state per provider
  const [verifyingProvider, setVerifyingProvider] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Current active theatre ID
  const [theatreId, setTheatreId] = useState<string | null>(null);

  // Transactions list
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    initPayments();
  }, []);

  const initPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Resolve active theatre ID from my memberships
      let tId = theatreId;
      if (!tId) {
        const myTenants = await apiRequest('/api/restaurants/my?tenantType=cinema');
        const activeTheatre = myTenants.find((m: any) => m.restaurant?.tenantType === 'cinema');
        if (activeTheatre) {
          tId = activeTheatre.restaurant.id;
          setTheatreId(tId);
        }
      }

      await Promise.all([
        loadPaymentSettings(tId || undefined),
        loadTransactions(tId || undefined)
      ]);
    } catch (err: any) {
      console.error('Failed to initialize payment settings:', err);
      setError(err?.message || 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentSettings = async (tId?: string) => {
    try {
      const activeId = tId || theatreId || undefined;
      const res = await apiRequest('/api/cinema/payments/settings', { theatreId: activeId });
      setAccounts(res.accounts || []);
      setTheatreName(res.theatreName || '');
      setCurrency(res.currency || 'INR');
    } catch (err: any) {
      console.error('Failed to load payment settings:', err);
      setError(err?.message || 'Failed to load payment settings');
    }
  };

  const loadTransactions = async (tId?: string) => {
    try {
      setLoadingTransactions(true);
      const activeId = tId || theatreId || undefined;
      const res = await apiRequest('/api/cinema/payments/transactions?limit=10', { theatreId: activeId });
      setTransactions(res.transactions || []);
    } catch (err: any) {
      console.warn('Could not load payment transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const openConfigModal = (provider: 'razorpay' | 'paytm') => {
    const existing = accounts.find((a) => a.provider === provider);
    setModalProvider(provider);
    setFormEnv(existing?.environment || 'test');
    setFormKeyId(existing?.keyId || '');
    setFormKeySecret('');
    setFormWebhookSecret('');
    setShowSecret(false);
    setError(null);
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProvider) return;

    if (!formKeyId.trim()) {
      setError(`${modalProvider === 'razorpay' ? 'Key ID' : 'MID'} is required`);
      return;
    }
    if (!formKeySecret.trim()) {
      setError('Merchant Secret / Key is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await apiRequest('/api/cinema/payments/configure', {
        method: 'POST',
        theatreId: theatreId || undefined,
        body: JSON.stringify({
          provider: modalProvider,
          environment: formEnv,
          keyId: formKeyId.trim(),
          keySecret: formKeySecret.trim(),
          webhookSecret: formWebhookSecret.trim() || undefined
        })
      });

      if (res.success) {
        setSuccessMessage(
          `${modalProvider.toUpperCase()} merchant gateway successfully configured and verified!`
        );
        setModalProvider(null);
        await loadPaymentSettings();
      } else {
        setError(res.verification?.message || 'Connection verification failed');
      }
    } catch (err: any) {
      console.error('Failed to configure payment gateway:', err);
      setError(err?.message || 'Failed to configure payment gateway');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (provider: 'razorpay' | 'paytm') => {
    try {
      setVerifyingProvider(provider);
      setError(null);
      setSuccessMessage(null);

      const res = await apiRequest(`/api/cinema/payments/verify/${provider}`, {
        method: 'POST',
        theatreId: theatreId || undefined
      });

      if (res.success) {
        setSuccessMessage(
          `${provider.toUpperCase()} credentials verified successfully with gateway!`
        );
      } else {
        setError(res.verification?.message || 'Verification check failed');
      }
      await loadPaymentSettings();
    } catch (err: any) {
      console.error('Verification failed:', err);
      setError(err?.message || 'Gateway verification failed');
    } finally {
      setVerifyingProvider(null);
    }
  };

  const handleToggleStatus = async (provider: 'razorpay' | 'paytm', currentStatus: string) => {
    const isCurrentlyDisabled = currentStatus === 'disabled';
    const endpoint = isCurrentlyDisabled ? 'enable' : 'disable';

    try {
      setActionLoading(`${endpoint}-${provider}`);
      setError(null);
      await apiRequest(`/api/cinema/payments/${endpoint}/${provider}`, {
        method: 'POST',
        theatreId: theatreId || undefined
      });
      setSuccessMessage(
        `${provider.toUpperCase()} gateway ${isCurrentlyDisabled ? 'enabled' : 'disabled'}`
      );
      await loadPaymentSettings();
    } catch (err: any) {
      setError(err?.message || `Failed to ${endpoint} gateway`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (provider: 'razorpay' | 'paytm') => {
    if (
      !confirm(
        `Are you sure you want to disconnect ${provider.toUpperCase()}? This will remove all stored merchant credentials.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(`disconnect-${provider}`);
      setError(null);
      await apiRequest(`/api/cinema/payments/disconnect/${provider}`, {
        method: 'DELETE',
        theatreId: theatreId || undefined
      });
      setSuccessMessage(`${provider.toUpperCase()} disconnected successfully`);
      await loadPaymentSettings();
    } catch (err: any) {
      setError(err?.message || 'Failed to disconnect gateway');
    } finally {
      setActionLoading(null);
    }
  };

  const getProviderAccount = (provider: 'razorpay' | 'paytm') => {
    return accounts.find((a) => a.provider === provider);
  };

  const renderStatusBadge = (account?: PaymentAccount) => {
    if (!account || account.status === 'disconnected') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
          Not Connected
        </span>
      );
    }
    if (account.status === 'connected') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Connected & Verified
        </span>
      );
    }
    if (account.status === 'disabled') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          Disabled
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Verification Failed
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading payment gateway architecture...</p>
      </div>
    );
  }

  const razorpayAccount = getProviderAccount('razorpay');
  const paytmAccount = getProviderAccount('paytm');

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/cinema/admin/dashboard"
              className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Payment Gateway Architecture</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Task 11
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Connect your theatre&apos;s eligible merchant accounts to collect customer payments directly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="truncate max-w-[150px]">{theatreName || 'Theatre'}</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
            Currency: <span className="text-white font-bold">{currency}</span>
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-rose-300 flex items-center gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-emerald-300 flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Financial Isolation Banner */}
      <div className="p-5 bg-gradient-to-r from-indigo-950/40 to-slate-900/60 border border-indigo-800/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Direct Merchant Settlement Architecture</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AES-256-GCM Encrypted
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Customer payments settle directly into your cinema theatre&apos;s registered merchant account. MenuGo never acts as an intermediary or custodian of theatre customer funds.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Gateway Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Razorpay Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xl">
                  R
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Razorpay</h3>
                  <p className="text-xs text-slate-400">Cards, UPI, NetBanking, Wallets</p>
                </div>
              </div>
              {renderStatusBadge(razorpayAccount)}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Accept seamless in-auditorium seat payments via Razorpay Standard Checkout. Settles directly to your bank according to your merchant agreement.
            </p>

            {razorpayAccount ? (
              <div className="space-y-2 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs mb-4">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Environment:</span>
                  <span className="font-semibold text-white uppercase text-[10px] px-2 py-0.5 rounded bg-slate-800">
                    {razorpayAccount.environment}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Key ID:</span>
                  <span className="font-mono text-indigo-300">{razorpayAccount.keyId}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Secret Key:</span>
                  <span className="font-mono text-slate-400">{razorpayAccount.maskedKeySecret}</span>
                </div>
                {razorpayAccount.lastVerificationError && (
                  <div className="text-rose-400 text-[11px] pt-1 border-t border-slate-800">
                    Error: {razorpayAccount.lastVerificationError}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500 mb-4">
                No Razorpay credentials configured yet.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
            <button
              onClick={() => openConfigModal('razorpay')}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20"
            >
              {razorpayAccount ? 'Update Credentials' : 'Connect Account'}
            </button>

            {razorpayAccount && (
              <>
                <button
                  onClick={() => handleVerify('razorpay')}
                  disabled={verifyingProvider === 'razorpay'}
                  title="Test Connection"
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  {verifyingProvider === 'razorpay' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Test</span>
                </button>

                <button
                  onClick={() => handleToggleStatus('razorpay', razorpayAccount.status)}
                  disabled={actionLoading === `disable-razorpay` || actionLoading === `enable-razorpay`}
                  title={razorpayAccount.status === 'disabled' ? 'Enable' : 'Disable'}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDisconnect('razorpay')}
                  disabled={actionLoading === `disconnect-razorpay`}
                  title="Disconnect Gateway"
                  className="py-2 px-2.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Paytm Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-black text-xl">
                  P
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Paytm Payment Gateway</h3>
                  <p className="text-xs text-slate-400">Paytm UPI, Wallet, NetBanking & Cards</p>
                </div>
              </div>
              {renderStatusBadge(paytmAccount)}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Connect your Paytm All-in-One merchant account using your Merchant ID (MID) and Merchant Key for quick UPI and digital wallet checkout.
            </p>

            {paytmAccount ? (
              <div className="space-y-2 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs mb-4">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Environment:</span>
                  <span className="font-semibold text-white uppercase text-[10px] px-2 py-0.5 rounded bg-slate-800">
                    {paytmAccount.environment}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Merchant ID (MID):</span>
                  <span className="font-mono text-sky-300">{paytmAccount.keyId}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Merchant Key:</span>
                  <span className="font-mono text-slate-400">{paytmAccount.maskedKeySecret}</span>
                </div>
                {paytmAccount.lastVerificationError && (
                  <div className="text-rose-400 text-[11px] pt-1 border-t border-slate-800">
                    Error: {paytmAccount.lastVerificationError}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500 mb-4">
                No Paytm credentials configured yet.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
            <button
              onClick={() => openConfigModal('paytm')}
              className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/20"
            >
              {paytmAccount ? 'Update Credentials' : 'Connect Account'}
            </button>

            {paytmAccount && (
              <>
                <button
                  onClick={() => handleVerify('paytm')}
                  disabled={verifyingProvider === 'paytm'}
                  title="Test Connection"
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  {verifyingProvider === 'paytm' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Test</span>
                </button>

                <button
                  onClick={() => handleToggleStatus('paytm', paytmAccount.status)}
                  disabled={actionLoading === `disable-paytm` || actionLoading === `enable-paytm`}
                  title={paytmAccount.status === 'disabled' ? 'Enable' : 'Disable'}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDisconnect('paytm')}
                  disabled={actionLoading === `disconnect-paytm`}
                  title="Disconnect Gateway"
                  className="py-2 px-2.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Transactions Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Payment Transaction Ledger</h3>
          </div>
          <button
            onClick={() => loadTransactions()}
            disabled={loadingTransactions}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTransactions ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Gateway</th>
                  <th className="py-3 px-4">Provider Ref</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {tx.orderNumber || tx.orderId?.slice(0, 8) || '-'}
                    </td>
                    <td className="py-3 px-4 uppercase font-semibold text-[11px]">
                      {tx.provider}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {tx.providerPaymentId || tx.providerOrderId || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      ₹{(tx.amount / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-500 text-xs">
            No customer payment transactions recorded yet. Live payment transactions will appear here.
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {modalProvider && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Configure {modalProvider.toUpperCase()} Credentials
                  </h3>
                  <p className="text-xs text-slate-400">Direct cinema merchant account credentials</p>
                </div>
              </div>
              <button
                onClick={() => setModalProvider(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfiguration} className="space-y-4">
              {/* Environment Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Gateway Environment
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setFormEnv('test')}
                    className={`py-1.5 rounded-lg font-bold transition ${
                      formEnv === 'test'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Test / Sandbox Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormEnv('live')}
                    className={`py-1.5 rounded-lg font-bold transition ${
                      formEnv === 'live'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Production Mode
                  </button>
                </div>
              </div>

              {/* Key ID / MID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {modalProvider === 'razorpay' ? 'Razorpay Key ID' : 'Paytm Merchant ID (MID)'}
                </label>
                <input
                  type="text"
                  value={formKeyId}
                  onChange={(e) => setFormKeyId(e.target.value)}
                  placeholder={
                    modalProvider === 'razorpay'
                      ? formEnv === 'test'
                        ? 'rzp_test_xxxxxxxxxxxx'
                        : 'rzp_live_xxxxxxxxxxxx'
                      : 'e.g. CINEMA01928374'
                  }
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Secret Key */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {modalProvider === 'razorpay' ? 'Razorpay Key Secret' : 'Paytm Merchant Key'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSecret ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={formKeySecret}
                  onChange={(e) => setFormKeySecret(e.target.value)}
                  placeholder="Enter merchant key/secret"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Webhook Secret Disclosure */}
              <details className="group rounded-xl border border-slate-800 bg-slate-950/40 p-3 transition-all text-xs">
                <summary className="font-semibold text-slate-400 hover:text-indigo-400 cursor-pointer list-none flex items-center justify-between">
                  <span>+ Webhook Secret (Optional)</span>
                  <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-2.5 mt-2 border-t border-slate-800/80">
                  <input
                    type="text"
                    value={formWebhookSecret}
                    onChange={(e) => setFormWebhookSecret(e.target.value)}
                    placeholder="Secret for server-to-server webhook callbacks"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </details>

              {/* Security Footnote */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Credentials are encrypted server-side with AES-256-GCM. Unencrypted secrets are never exposed in API responses or logs.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalProvider(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Saving...</span>
                    </>
                  ) : (
                    <span>Save & Verify</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
