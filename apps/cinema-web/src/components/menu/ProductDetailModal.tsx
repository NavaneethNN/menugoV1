'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Minus,
  Sparkles,
  Flame,
  Clock,
  Users,
  MessageSquare,
  Check,
  UtensilsCrossed
} from 'lucide-react';
import { formatPaise } from '@/lib/utils';
import { VegBadge, NonVegBadge } from './VegBadge';
import { MAX_ITEM_NOTES_LENGTH } from '@/lib/cart';

export interface ProductDetailItem {
  id: string;
  name: string;
  description?: string | null;
  price: number; // integer paise
  imageUrl?: string | null;
  isVegetarian: boolean;
  isAvailable: boolean;
  categoryId?: string | null;
  sortOrder?: number;
}

interface ProductDetailModalProps {
  product: ProductDetailItem | null;
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  quantityInCart: number;
  currentNotes?: string;
  onAddToCart: (product: ProductDetailItem, notes?: string) => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onUpdateNotes: (productId: string, notes: string) => void;
  suggestedPairings?: ProductDetailItem[];
}

const PRESET_NOTE_CHIPS = [
  'Less Spicy',
  'Extra Spicy',
  'No Onion / Garlic',
  'Extra Crispy',
  'Extra Lemon',
  'Less Oil'
];

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  currency,
  quantityInCart,
  currentNotes = '',
  onAddToCart,
  onUpdateQty,
  onUpdateNotes,
  suggestedPairings = []
}: ProductDetailModalProps) {
  const [notes, setNotes] = useState(currentNotes);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setNotes(currentNotes);
    setImageError(false);
  }, [product, currentNotes]);

  if (!isOpen || !product) return null;

  const handleChipClick = (chip: string) => {
    const cleanChip = chip.replace(/^[^\w\s]+/, '').trim();
    if (notes.includes(cleanChip)) {
      const updated = notes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== cleanChip)
        .join(', ');
      setNotes(updated);
      if (quantityInCart > 0) {
        onUpdateNotes(product.id, updated);
      }
    } else {
      const updated = notes ? `${notes}, ${cleanChip}` : cleanChip;
      if (updated.length <= MAX_ITEM_NOTES_LENGTH) {
        setNotes(updated);
        if (quantityInCart > 0) {
          onUpdateNotes(product.id, updated);
        }
      }
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (quantityInCart > 0) {
      onUpdateNotes(product.id, val);
    }
  };

  const handlePrimaryAction = () => {
    if (quantityInCart === 0) {
      onAddToCart(product, notes.trim() || undefined);
    } else {
      onUpdateNotes(product.id, notes.trim());
      onClose();
    }
  };

  const hasImage = Boolean(product.imageUrl && !imageError);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Modal Media Section */}
        <div className="relative">
          {hasImage ? (
            <div className="h-52 sm:h-64 w-full bg-slate-100 overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl!}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
            </div>
          ) : (
            <div className="h-32 sm:h-36 w-full bg-gradient-to-br from-slate-950 via-red-950 to-slate-900 flex items-center justify-center text-white/30 relative">
              <UtensilsCrossed className="w-16 h-16" />
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition z-10"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge Overlays on Image */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              {product.isVegetarian ? <VegBadge /> : <NonVegBadge />}
              <span
                className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md ${
                  product.isVegetarian
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                }`}
              >
                {product.isVegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
              </span>
            </div>

            <div className="bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black tracking-wide border border-white/20">
              {formatPaise(product.price, currency)}
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Title & Pricing */}
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {product.name}
            </h2>
            <p className="text-base font-black text-red-600 mt-1">
              {formatPaise(product.price, currency)}
            </p>

            {product.description && (
              <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* Culinary Highlights & Portion tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Serves 1-2</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Freshly Made (~15 mins)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              <span>House Specialty</span>
            </div>
          </div>

          {/* Cooking Preferences & Note Chips */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                <span>Special Instructions for Chef</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {notes.length}/{MAX_ITEM_NOTES_LENGTH}
              </span>
            </div>

            {/* Quick 1-Tap Chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_NOTE_CHIPS.map((chip) => {
                const cleanChip = chip.replace(/^[^\w\s]+/, '').trim();
                const isSelected = notes.includes(cleanChip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{chip}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={notes}
              maxLength={MAX_ITEM_NOTES_LENGTH}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="e.g. Less spicy, dressing on side..."
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 transition"
            />
          </div>

          {/* Cross-Sell: Frequently Paired Together */}
          {suggestedPairings.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-600" />
                  <span>Pairs Great With</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Recommended Pairing
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {suggestedPairings.slice(0, 2).map((pair) => (
                  <div
                    key={pair.id}
                    className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {pair.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {pair.name}
                        </p>
                      </div>
                      <p className="text-[11px] font-extrabold text-red-600 mt-0.5">
                        {formatPaise(pair.price, currency)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddToCart(pair)}
                      className="p-1.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs shadow-xs transition shrink-0"
                      title={`Add ${pair.name}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Bottom Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center gap-3">
          {quantityInCart > 0 ? (
            <>
              {/* Stepper if already in cart */}
              <div className="py-2 px-3 bg-slate-100 rounded-2xl flex items-center gap-3 border border-slate-200">
                <button
                  type="button"
                  onClick={() => onUpdateQty(product.id, -1)}
                  className="p-1 rounded-lg hover:bg-white active:bg-slate-200 text-slate-800 transition"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4 stroke-[3]" />
                </button>
                <span className="w-6 text-center text-sm font-black text-slate-900">
                  {quantityInCart}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQty(product.id, 1)}
                  className="p-1 rounded-lg hover:bg-white active:bg-slate-200 text-slate-800 transition"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrimaryAction}
                className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-red-600/20 transition flex items-center justify-between"
              >
                <span>Update Item</span>
                <span>{formatPaise(product.price * quantityInCart, currency)}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full py-3.5 px-5 bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-red-600/25 transition flex items-center justify-between"
            >
              <span>Add to Order</span>
              <span>{formatPaise(product.price, currency)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
