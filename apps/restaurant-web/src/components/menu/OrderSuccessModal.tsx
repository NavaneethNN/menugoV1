'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Clock, ArrowRight, UtensilsCrossed, PlusCircle } from 'lucide-react';
import { formatPaise } from '@/lib/utils';

interface OrderSuccessModalProps {
  order: any;
  currency: string;
  tableNumber?: string | null;
  autoRedirectSeconds: number | null;
  onOrderMore: () => void;
}

export function OrderSuccessModal({
  order,
  currency,
  tableNumber,
  autoRedirectSeconds,
  onOrderMore
}: OrderSuccessModalProps) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-100 text-center animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
          <Sparkles className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold mb-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span>Order #{order.orderNumber} Sent to Kitchen!</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            Preparing Fresh For You
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Your meal is being prepared for{' '}
            <span className="font-bold text-slate-800">
              {order.table?.tableNumber || tableNumber || 'your table'}
            </span>
            .
          </p>
        </div>

        {/* Order Details Receipt Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-2.5">
          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>Status</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold uppercase text-[10px]">
              {order.status || 'NEW'}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>Table</span>
            <span className="font-bold text-slate-800">
              {order.table?.tableNumber || tableNumber}
            </span>
          </div>
          {order.customerName && (
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Customer</span>
              <span className="font-medium text-slate-800">{order.customerName}</span>
            </div>
          )}

          {order.items && order.items.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Ordered Items
              </span>
              {order.items.map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between text-slate-700 text-xs">
                  <span>{it.quantity}× {it.productName}</span>
                  {it.subtotal !== undefined && (
                    <span className="font-mono text-slate-500 text-[11px]">
                      {formatPaise(it.subtotal, currency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between font-black text-slate-900 text-sm pt-2 border-t border-slate-200">
            <span>Total Amount</span>
            <span className="text-red-600 font-black">
              {formatPaise(order.totalAmount, currency)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {order.statusToken && (
            <Link
              href={`/track/${order.statusToken}`}
              className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs rounded-2xl transition shadow-md shadow-red-600/25 flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>Track Live Preparation</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
            </Link>
          )}

          {autoRedirectSeconds !== null && autoRedirectSeconds > 0 && (
            <p className="text-[11px] text-slate-400">
              Opening live tracker in {autoRedirectSeconds}s...
            </p>
          )}

          <button
            onClick={onOrderMore}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 text-red-600" />
            <span>Order More Dishes / Round 2</span>
          </button>
        </div>
      </div>
    </div>
  );
}
