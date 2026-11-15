'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Film,
  Armchair,
  ShoppingBag,
  ShieldCheck,
  ChevronRight,
  Info,
  X,
  CreditCard,
  AlertCircle,
  Loader2,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { formatPaise } from '@menugo/shared';
import { apiRequest } from '@/lib/api';

interface PreparedOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  statusToken?: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  theatre: {
    id: string;
    name: string;
    currency: string;
  };
  screen: {
    id: string;
    screenName: string;
    screenType: string;
  };
  movie: {
    id: string;
    title: string;
    posterUrl?: string | null;
  };
  show: {
    id: string;
    showDate: string;
    startTime: string;
    expectedEndTime: string;
  };
  seat: {
    row: string;
    seat: string;
  };
  summary: {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    taxes: Array<{ name: string; amount: number }>;
    totalAmount: number;
    itemCount: number;
  };
  items: Array<{
    id?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string | null;
  }>;
}

interface CinemaOrderPreparedModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PreparedOrder | null;
}

type CheckoutPhase = 'idle' | 'initiating' | 'gateway_modal' | 'verifying' | 'success' | 'failed';

export function CinemaOrderPreparedModal({
  isOpen,
  onClose,
  order
}: CinemaOrderPreparedModalProps) {
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [selectedProvider, setSelectedProvider] = useState<'paytm' | 'razorpay'>('paytm');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<{
    transactionId: string;
    providerOrderId: string;
    providerPayload: any;
  } | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const currency = order.theatre?.currency || 'INR';

  // 1. Initiate Payment Order with Theatre Gateway Account
  const handleInitiatePayment = async () => {
    try {
      setPhase('initiating');
      setErrorMessage(null);

      const statusToken = order.statusToken || '';

      const res = await apiRequest('/api/cinema/payments/order', {
        method: 'POST',
        theatreId: order.theatre.id,
        body: JSON.stringify({
          orderId: order.id,
          statusToken,
          provider: selectedProvider
        })
      });

      if (res.success) {
        setTransactionData({
          transactionId: res.transactionId,
          providerOrderId: res.providerOrderId,
          providerPayload: res.providerPayload
        });
        setPhase('gateway_modal');
      } else {
        throw new Error(res.message || 'Failed to initiate payment gateway transaction');
      }
    } catch (err: any) {
      console.error('Payment initiation error:', err);
      setErrorMessage(err?.message || 'Payment initiation failed. Please check payment gateway configuration.');
      setPhase('failed');
    }
  };

  // 2. Complete Server-Side Verification
  const handleCompletePayment = async (simulateFailure = false) => {
    if (!transactionData) return;

    try {
      setPhase('verifying');
      setErrorMessage(null);

      const statusToken = order.statusToken || '';
      const isPaytm = selectedProvider === 'paytm';
      const mockPaymentId = simulateFailure
        ? (isPaytm ? `paytm_txn_fail_${Date.now()}` : `pay_fail_${Date.now()}`)
        : (isPaytm ? `paytm_txn_${Date.now()}` : `pay_${Date.now()}`);
      const mockSignature = simulateFailure
        ? 'test_sig_invalid'
        : 'test_sig_captured';

      const responsePayload = isPaytm
        ? {
            MID: transactionData.providerPayload?.mid || 'MOCK_MID',
            ORDERID: transactionData.providerOrderId,
            TXNAMOUNT: (order.totalAmount / 100).toFixed(2),
            STATUS: simulateFailure ? 'TXN_FAILURE' : 'TXN_SUCCESS'
          }
        : {
            razorpay_payment_id: mockPaymentId,
            razorpay_order_id: transactionData.providerOrderId,
            razorpay_signature: mockSignature
          };

      const verifyRes = await apiRequest('/api/cinema/payments/verify', {
        method: 'POST',
        theatreId: order.theatre.id,
        body: JSON.stringify({
          orderId: order.id,
          statusToken,
          transactionId: transactionData.transactionId,
          provider: selectedProvider,
          providerPaymentId: mockPaymentId,
          providerOrderId: transactionData.providerOrderId,
          providerSignature: mockSignature,
          responsePayload
        })
      });

      if (verifyRes.verified && verifyRes.status === 'CAPTURED') {
        setConfirmedOrderId(order.orderNumber);
        setPhase('success');
      } else {
        throw new Error(verifyRes.message || `Payment could not be verified by ${isPaytm ? 'Paytm' : 'Razorpay'} gateway`);
      }
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setErrorMessage(err?.message || 'Payment verification failed');
      setPhase('failed');
    }
  };

  const handleCancelGateway = () => {
    setPhase('idle');
    setErrorMessage('Payment was cancelled. You can retry anytime before showtime.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 border ${
                phase === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : phase === 'failed'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
            >
              {phase === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : phase === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <Clock className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {phase === 'success'
                    ? 'Payment Confirmed'
                    : phase === 'gateway_modal'
                    ? (selectedProvider === 'paytm' ? 'Paytm Payment Gateway' : 'Razorpay Checkout')
                    : 'Cinema Concessions Order'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                    phase === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : phase === 'failed'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {phase === 'success' ? 'CONFIRMED' : 'PENDING'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Order #{confirmedOrderId || order.orderNumber} • {order.theatre.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Phase: SUCCESS */}
          {phase === 'success' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-emerald-200">
                  <strong className="font-bold text-emerald-300 block mb-0.5">
                    Payment Verified & Order Sent to Kitchen!
                  </strong>
                  Your payment was captured directly on the theatre&apos;s merchant account. Kitchen staff have received your order and will prepare it for in-seat delivery.
                </div>
              </div>

              {/* Delivery Receipt Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block border-b border-slate-800 pb-2">
                  Delivery Destination
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Screen</span>
                    <span className="font-bold text-white">{order.screen.screenName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Row & Seat</span>
                    <span className="font-bold text-emerald-400">Row {order.seat.row} • Seat {order.seat.seat}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Movie</span>
                    <span className="font-bold text-white truncate block">{order.movie.title}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Amount Paid</span>
                    <span className="font-bold text-white font-mono">{formatPaise(order.totalAmount, currency)}</span>
                  </div>
                </div>
              </div>

              {/* Real-time Order Tracking Link */}
              {order.statusToken && (
                <div className="pt-2">
                  <Link
                    href={`/track/${order.statusToken}`}
                    className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Track Preparation &amp; Delivery Live</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Phase: GATEWAY MODAL (Paytm / Razorpay Checkout Simulation / Interaction) */}
          {phase === 'gateway_modal' && transactionData && (
            <div className="space-y-4 animate-in zoom-in-95">
              <div
                className={`p-4 rounded-2xl border space-y-2 ${
                  selectedProvider === 'paytm'
                    ? 'bg-blue-950/30 border-blue-500/30'
                    : 'bg-indigo-950/30 border-indigo-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider text-white ${
                        selectedProvider === 'paytm' ? 'bg-blue-600' : 'bg-indigo-600'
                      }`}
                    >
                      {selectedProvider === 'paytm' ? 'PAYTM' : 'RAZORPAY'}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        selectedProvider === 'paytm' ? 'text-blue-300' : 'text-indigo-300'
                      }`}
                    >
                      Merchant Payment Gateway
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatPaise(order.totalAmount, currency)}
                  </span>
                </div>
                <p
                  className={`text-[11px] ${
                    selectedProvider === 'paytm' ? 'text-blue-200/80' : 'text-indigo-200/80'
                  }`}
                >
                  {selectedProvider === 'paytm'
                    ? `Payment transaction generated on theatre's Paytm account (MID: ${transactionData.providerPayload?.mid || 'CINEMA_MID'}). Funds settle directly to the cinema theatre.`
                    : `Payment order generated on theatre's Razorpay account (Order ID: ${transactionData.providerOrderId}). Funds settle directly to the cinema theatre.`}
                </p>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 truncate">
                  {selectedProvider === 'paytm'
                    ? `TxnToken: ${transactionData.providerPayload?.txnToken || transactionData.providerOrderId}`
                    : `Razorpay Order: ${transactionData.providerOrderId}`}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white block">Complete Checkout</span>
                <p className="text-xs text-slate-400">
                  {selectedProvider === 'paytm'
                    ? 'Click below to confirm your Paytm payment. Server-to-server checksum verification will authorize the order.'
                    : 'Click below to confirm your Razorpay payment. Server-to-server signature verification will authorize the order.'}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCompletePayment(false)}
                    className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Pay {formatPaise(order.totalAmount, currency)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCompletePayment(true)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <span>Simulate Failure</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCancelGateway}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition font-medium"
                >
                  Cancel and change payment method
                </button>
              </div>
            </div>
          )}

          {/* Phase: VERIFYING / INITIATING */}
          {(phase === 'initiating' || phase === 'verifying') && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  {phase === 'initiating'
                    ? 'Connecting to Theatre Gateway...'
                    : 'Verifying Gateway Signature...'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs">
                  {phase === 'initiating'
                    ? "Generating secure transaction on theatre's merchant account"
                    : 'Authoritative server-side verification in progress. Please do not close.'}
                </p>
              </div>
            </div>
          )}

          {/* Phase: IDLE or FAILED */}
          {(phase === 'idle' || phase === 'failed') && (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Transaction Issue</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Delivery Context Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                    Cinema Order Context
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {order.theatre.name}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Screen</span>
                    <span className="font-bold text-white">{order.screen.screenName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">In-Seat Destination</span>
                    <span className="font-bold text-indigo-400">Row {order.seat.row} • Seat {order.seat.seat}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Movie</span>
                    <span className="font-bold text-white truncate block">{order.movie.title}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Showtime</span>
                    <span className="font-bold text-white">{order.show.startTime} ({order.show.showDate})</span>
                  </div>
                </div>
              </div>

              {/* Concessions Items */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block mb-1">
                  Ordered Concessions ({order.summary?.itemCount || order.items.length} items)
                </span>

                <div className="divide-y divide-slate-800/60 max-h-36 overflow-y-auto">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-2 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white">{item.productName}</span>
                        <span className="text-slate-400 ml-1.5 font-semibold">× {item.quantity}</span>
                        {item.notes && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">Note: {item.notes}</p>
                        )}
                      </div>
                      <span className="font-mono text-slate-300">
                        {formatPaise(item.subtotal, currency)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatPaise(order.subtotal || order.summary?.subtotal || 0, currency)}</span>
                  </div>
                  {order.summary?.taxes?.map((tax, tIdx) => (
                    <div key={tIdx} className="flex justify-between text-slate-400">
                      <span>{tax.name}</span>
                      <span>{formatPaise(tax.amount, currency)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                    <span>Total Amount</span>
                    <span className="text-indigo-400 font-mono">
                      {formatPaise(order.totalAmount, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Gateway Provider Selector */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
                  Select Theatre Payment Method
                </span>

                <div className="space-y-2">
                  <label
                    onClick={() => setSelectedProvider('paytm')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                      selectedProvider === 'paytm'
                        ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                        PT
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">Paytm Payment Gateway</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Active
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">UPI, Cards, NetBanking, Paytm Wallet</p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="provider"
                      checked={selectedProvider === 'paytm'}
                      onChange={() => setSelectedProvider('paytm')}
                      className="accent-blue-500 w-4 h-4"
                    />
                  </label>

                  <label
                    onClick={() => setSelectedProvider('razorpay')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                      selectedProvider === 'razorpay'
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                        RZ
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">Razorpay</span>
                        </div>
                        <p className="text-[11px] text-slate-400">UPI, Credit/Debit Cards, NetBanking</p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="provider"
                      checked={selectedProvider === 'razorpay'}
                      onChange={() => setSelectedProvider('razorpay')}
                      className="accent-indigo-500 w-4 h-4"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/90">
          {phase === 'success' ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Done (Enjoy the Show)</span>
            </button>
          ) : phase === 'gateway_modal' || phase === 'initiating' || phase === 'verifying' ? null : (
            <button
              type="button"
              onClick={handleInitiatePayment}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                Pay {formatPaise(order.totalAmount, currency)} with {selectedProvider === 'paytm' ? 'Paytm' : 'Razorpay'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
