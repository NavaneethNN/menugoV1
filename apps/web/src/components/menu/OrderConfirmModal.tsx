'use client';

import React from 'react';
import { X, UtensilsCrossed, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { formatPaise } from '@/lib/utils';
import { CartItem } from '@/lib/cart';

interface OrderConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  verifiedTable: { id: string; tableNumber: string };
  restaurantName: string;
  currency: string;
  cart: CartItem[];
  totalCount: number;
  indicativeSubtotalPaise: number;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  orderInstructions: string;
  isSubmittingOrder: boolean;
  orderSubmissionError: string | null;
  onPlaceOrder: () => void;
}

export function OrderConfirmModal({
  isOpen,
  onClose,
  verifiedTable,
  restaurantName,
  currency,
  cart,
  totalCount,
  indicativeSubtotalPaise,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  orderInstructions,
  isSubmittingOrder,
  orderSubmissionError,
  onPlaceOrder
}: OrderConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 text-left animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Confirm Dine-In Order
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Table {verifiedTable.tableNumber} • {restaurantName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {orderSubmissionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{orderSubmissionError}</span>
          </div>
        )}

        {/* Contact Inputs */}
        <div className="space-y-2 pt-1">
          <span className="block text-xs font-bold text-slate-700">
            Guest Details (Optional)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Your Name"
              maxLength={100}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white"
            />
            <input
              type="tel"
              placeholder="Phone Number (Optional)"
              maxLength={20}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Order Items Summary */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
          <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
            Order Items ({totalCount})
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-200/50">
            {cart.map((item) => (
              <div key={item.productId} className="flex justify-between items-center text-slate-700 text-xs pt-1.5 first:pt-0">
                <div className="flex-1 pr-2">
                  <span className="line-clamp-1 font-semibold">
                    {item.quantity}× {item.product.name}
                  </span>
                  {item.notes && (
                    <span className="text-[10px] text-slate-500 italic block">
                      &quot;{item.notes}&quot;
                    </span>
                  )}
                </div>
                <span className="font-bold text-slate-900 shrink-0">
                  {formatPaise(item.product.price * item.quantity, currency)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-black text-slate-900 text-sm pt-2.5 border-t border-slate-200">
            <span>Indicative Total</span>
            <span className="text-red-600 font-black">
              {formatPaise(indicativeSubtotalPaise, currency)}
            </span>
          </div>
        </div>

        {orderInstructions && (
          <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800">
            <span className="font-bold">Table Instructions: </span>
            <span className="italic">{orderInstructions}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmittingOrder}
            className="flex-1 py-3 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Back to Cart
          </button>
          <button
            type="button"
            onClick={onPlaceOrder}
            disabled={isSubmittingOrder}
            className="flex-2 py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-red-600/20 disabled:opacity-70"
          >
            {isSubmittingOrder ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending to Kitchen...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Send Order to Kitchen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
