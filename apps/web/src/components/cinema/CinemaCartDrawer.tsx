'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  AlertCircle,
  Armchair,
  Film,
  Sparkles,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { formatPaise } from '@menugo/shared';
import {
  CinemaCartItem,
  CinemaOrderContext,
  MAX_CINEMA_ITEM_NOTES_LENGTH
} from '@/lib/cinema-cart';

interface CinemaCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CinemaCartItem[];
  currency: string;
  context: CinemaOrderContext | null;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  totalCount: number;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
}

export function CinemaCartDrawer({
  isOpen,
  onClose,
  cart,
  currency,
  context,
  subtotalPaise,
  taxPaise,
  totalPaise,
  totalCount,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout
}: CinemaCartDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                Cinema Concessions Cart
              </h2>
              {context && (
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                  <span className="font-semibold text-indigo-400">
                    {context.screenName} • Seat {context.seatNumber}
                  </span>
                  <span>• {totalCount} {totalCount === 1 ? 'item' : 'items'}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            aria-label="Close cart drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seat Delivery Context Banner */}
        {context && (
          <div className="bg-indigo-950/40 border-b border-indigo-500/20 px-4 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Armchair className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-slate-300">
                Delivering to: <strong className="text-white">Row {context.seatRow}, Seat {context.seatNumber}</strong>
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
              In-Seat Service
            </span>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-800/60">
          {cart.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-300">Your cart is empty</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Explore the menu to add delicious popcorn, chilled beverages, and snacks to your order.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemTotal = item.product.price * item.quantity;
              return (
                <div key={item.productId} className="pt-3 first:pt-0 flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 relative">
                    {item.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <span
                      className={`absolute bottom-1 left-1 px-1 py-0.2 rounded text-[8px] font-bold ${
                        item.product.isVegetarian
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {item.product.isVegetarian ? 'Veg' : 'Non'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">
                        {item.product.name}
                      </h4>
                      <button
                        onClick={() => onRemoveItem(item.productId)}
                        className="text-slate-500 hover:text-rose-400 transition p-0.5"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatPaise(item.product.price, currency)} each
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.productId, -1)}
                          className="w-5 h-5 rounded text-slate-300 hover:text-white flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-white px-1">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.productId, 1)}
                          className="w-5 h-5 rounded text-slate-300 hover:text-white flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-black text-indigo-300">
                        {formatPaise(itemTotal, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pricing Summary & Action Footer */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({totalCount} items)</span>
                <span>{formatPaise(subtotalPaise, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Applicable Taxes (GST 5%)</span>
                <span>{formatPaise(taxPaise, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                <span>Estimated Total</span>
                <span className="text-indigo-400">{formatPaise(totalPaise, currency)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClearCart}
                className="py-3 px-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
                title="Clear Cart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>

              <button
                type="button"
                onClick={onProceedToCheckout}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <span>Review Order & Checkout</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
