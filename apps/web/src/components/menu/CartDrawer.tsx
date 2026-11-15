'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  QrCode,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { formatPaise } from '@/lib/utils';
import { CartItem, MAX_ITEM_NOTES_LENGTH } from '@/lib/cart';
import { VegBadge, NonVegBadge } from './VegBadge';

export interface UpsellProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  isVegetarian: boolean;
  isAvailable: boolean;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  currency: string;
  verifiedTable: { id: string; tableNumber: string } | null;
  totalCount: number;
  indicativeSubtotalPaise: number;
  hasUnavailableItems: boolean;
  onRemoveUnavailable: () => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onUpdateNotes: (productId: string, notes: string) => void;
  onAddToCart: (product: any) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  orderInstructions: string;
  setOrderInstructions: (instructions: string) => void;
  isReadyToSubmit: boolean;
  onProceedToOrder: () => void;
  upsellProducts?: UpsellProduct[];
}

const ORDER_INSTRUCTION_PRESETS = [
  'Serve beverages first',
  'Bring everything piping hot',
  'Extra plates & napkins',
  'Less salt / light seasoning'
];

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  currency,
  verifiedTable,
  totalCount,
  indicativeSubtotalPaise,
  hasUnavailableItems,
  onRemoveUnavailable,
  onUpdateQty,
  onRemoveItem,
  onUpdateNotes,
  onAddToCart,
  customerName,
  setCustomerName,
  orderInstructions,
  setOrderInstructions,
  isReadyToSubmit,
  onProceedToOrder,
  upsellProducts = []
}: CartDrawerProps) {
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetInstruction = (preset: string) => {
    const cleanPreset = preset.replace(/^[^\w\s]+/, '').trim();
    if (orderInstructions.includes(cleanPreset)) {
      const updated = orderInstructions
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== cleanPreset)
        .join(', ');
      setOrderInstructions(updated);
    } else {
      const updated = orderInstructions
        ? `${orderInstructions}, ${cleanPreset}`
        : cleanPreset;
      setOrderInstructions(updated);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Your Dine-In Order
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {verifiedTable ? (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Table {verifiedTable.tableNumber}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-slate-500" />
                    Browsing Mode
                  </span>
                )}
                <span className="text-[11px] text-slate-400">• {totalCount} {totalCount === 1 ? 'item' : 'items'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
            aria-label="Close order drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Out of Stock Alert */}
        {hasUnavailableItems && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 px-4 flex items-center justify-between text-xs text-rose-900 font-semibold gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Some items in your cart have sold out.</span>
            </div>
            <button
              onClick={onRemoveUnavailable}
              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition text-[11px] shrink-0"
            >
              Remove Sold Out
            </button>
          </div>
        )}

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {cart.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Your order is empty</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Explore our tempting dishes and tap &quot;ADD&quot; to build your feast.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl shadow-xs transition"
              >
                Explore Menu
              </button>
            </div>
          ) : (
            <>
              {/* Item List */}
              <div className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const isAvailable = item.product.isAvailable;
                  const itemSubtotal = item.product.price * item.quantity;
                  const isEditingNotes = editingNotesId === item.productId;

                  return (
                    <div key={item.productId} className="py-3 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {item.product.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {item.product.name}
                            </h4>
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-xs">
                            <span
                              className={`font-black ${
                                isAvailable ? 'text-slate-900' : 'text-slate-400 line-through'
                              }`}
                            >
                              {formatPaise(itemSubtotal, currency)}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              ({formatPaise(item.product.price, currency)} each)
                            </span>
                            {!isAvailable && (
                              <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                Sold Out
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stepper + Delete */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="py-1 px-1.5 bg-slate-100 rounded-xl flex items-center gap-1 border border-slate-200">
                            <button
                              onClick={() => onUpdateQty(item.productId, -1)}
                              className="p-1 hover:bg-white active:bg-slate-200 rounded-lg text-slate-700 transition"
                              aria-label={`Decrease quantity of ${item.product.name}`}
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <span className="w-5 text-center text-xs font-black text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQty(item.productId, 1)}
                              disabled={!isAvailable}
                              className="p-1 hover:bg-white active:bg-slate-200 disabled:opacity-40 rounded-lg text-slate-700 transition"
                              aria-label={`Increase quantity of ${item.product.name}`}
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>

                          <button
                            onClick={() => onRemoveItem(item.productId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                            title="Remove item"
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Item-level Cooking Notes */}
                      <div className="text-xs">
                        {isEditingNotes ? (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                            <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-red-600" />
                                <span>Note for chef</span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {(item.notes?.length || 0)}/{MAX_ITEM_NOTES_LENGTH}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={item.notes || ''}
                              maxLength={MAX_ITEM_NOTES_LENGTH}
                              onChange={(e) => onUpdateNotes(item.productId, e.target.value)}
                              placeholder="e.g. Less spicy, dressing on side..."
                              className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="px-3 py-1 bg-slate-900 text-white font-bold text-[11px] rounded-lg"
                              >
                                Save Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {item.notes ? (
                              <div
                                onClick={() => setEditingNotesId(item.productId)}
                                className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer transition"
                              >
                                <MessageSquare className="w-3 h-3 text-red-600" />
                                <span className="italic line-clamp-1">&quot;{item.notes}&quot;</span>
                                <span className="text-[10px] text-red-600 font-bold ml-1">Edit</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingNotesId(item.productId)}
                                className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 py-0.5"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add cooking instructions</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Upsell / Complete Your Feast Engine */}
              {upsellProducts.length > 0 && (
                <div className="p-3.5 bg-gradient-to-br from-red-50/70 via-rose-50/40 to-red-50/30 rounded-2xl border border-red-200/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-black text-slate-900">
                        Complete Your Feast
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full">
                      Pairs Great
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {upsellProducts.slice(0, 4).map((up) => (
                      <div
                        key={up.id}
                        className="p-2.5 bg-white rounded-xl border border-red-200/60 shadow-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            {up.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {up.name}
                            </span>
                          </div>
                          <span className="text-[11px] font-extrabold text-red-600 mt-0.5 block">
                            {formatPaise(up.price, currency)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onAddToCart(up)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-bold text-xs rounded-lg transition flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                          <span>ADD</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guest Details & Table Instructions */}
              <div className="pt-2 space-y-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guest Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul, Table Host"
                    maxLength={100}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Special Table Instructions (Optional)
                  </label>
                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {ORDER_INSTRUCTION_PRESETS.map((preset) => {
                      const cleanPreset = preset.replace(/^[^\w\s]+/, '').trim();
                      const isSelected = orderInstructions.includes(cleanPreset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handlePresetInstruction(preset)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition ${
                            isSelected
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={orderInstructions}
                    onChange={(e) => setOrderInstructions(e.target.value)}
                    placeholder="e.g. Bring extra plates, serve drinks first..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Bill Details Summary Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  Bill Summary
                </h4>
                <div className="flex justify-between text-slate-600">
                  <span>Item Subtotal ({totalCount} items)</span>
                  <span className="font-black text-slate-900">
                    {formatPaise(indicativeSubtotalPaise, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px] border-t border-slate-200/60 pt-2">
                  <span>Taxes &amp; Restaurant Charges</span>
                  <span>Included / At checkout</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer Bottom Action Footer */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-white space-y-2">
            {!verifiedTable && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <QrCode className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-tight text-[11px]">
                  <span className="font-bold">Table QR Required: </span>
                  Please scan your table QR stand with your phone camera to place your dine-in order.
                </div>
              </div>
            )}

            <button
              onClick={onProceedToOrder}
              disabled={!isReadyToSubmit}
              className={`w-full py-3.5 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-between shadow-md ${
                isReadyToSubmit
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/25 active:scale-[0.99]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <div className="text-left">
                <span className="block text-[10px] font-bold opacity-80 uppercase tracking-wider">
                  {verifiedTable ? `Table ${verifiedTable.tableNumber}` : 'Dine-In Order'}
                </span>
                <span className="text-sm font-black">
                  {formatPaise(indicativeSubtotalPaise, currency)}
                </span>
              </div>

              <div className="flex items-center gap-1 font-black">
                <span>{isReadyToSubmit ? 'Proceed to Order' : 'Order Not Ready'}</span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
