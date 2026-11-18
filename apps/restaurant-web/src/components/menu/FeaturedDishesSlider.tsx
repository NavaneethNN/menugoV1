'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Star,
  Plus,
  Minus,
  UtensilsCrossed
} from 'lucide-react';
import { formatPaise } from '@/lib/utils';

export interface ProductItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isVegetarian: boolean;
  categoryId?: string | null;
  isAvailable?: boolean;
  sortOrder?: number;
}

interface FeaturedDishesSliderProps<T extends ProductItem = any> {
  products: T[];
  currency?: string;
  imageErrors: Record<string, boolean>;
  onImageError: (id: string) => void;
  onSelectProduct: (product: T) => void;
  onAddToCart: (product: T) => void;
  onUpdateQty: (productId: string, delta: number) => void;
  getItemQuantity: (productId: string) => number;
  VegBadge: React.ComponentType;
  NonVegBadge: React.ComponentType;
}

export function FeaturedDishesSlider<T extends ProductItem = any>({
  products,
  currency = 'INR',
  imageErrors,
  onImageError,
  onSelectProduct,
  onAddToCart,
  onUpdateQty,
  getItemQuantity,
  VegBadge,
  NonVegBadge
}: FeaturedDishesSliderProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [products]);

  const scrollBy = (offset: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (!products || products.length === 0) return null;

  return (
    <div className="mb-7 pb-6 border-b border-slate-100 relative">
      {/* Header with Title & Modern Navigation Buttons */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold shadow-xs">
            <Flame className="w-4 h-4 fill-current text-red-600" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Chef&apos;s Signature Recommendations
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Spotlight specials curated for your dining experience
            </p>
          </div>
        </div>

        {/* Modern Carousel Nav Controls */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollBy(-240)}
            disabled={!canScrollLeft}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:pointer-events-none text-slate-700 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(240)}
            disabled={!canScrollRight}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:pointer-events-none text-slate-700 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modern Slider Container with Gradient Edge Masks */}
      <div className="relative group">
        {/* Left Gradient Edge Mask */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        )}

        {/* Right Gradient Edge Mask */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        )}

        {/* Horizontal Snap Track */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3.5 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth"
        >
          {products.map((prod) => {
            const qty = getItemQuantity(prod.id);
            const hasImage = Boolean(prod.imageUrl && !imageErrors[prod.id]);

            return (
              <div
                key={prod.id}
                className="w-44 sm:w-48 shrink-0 snap-start rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-red-200/80 transition-all duration-300 overflow-hidden flex flex-col justify-between group/card cursor-pointer"
                onClick={() => onSelectProduct(prod)}
              >
                {/* Image & Badges */}
                <div className="h-32 sm:h-36 w-full bg-slate-100 relative overflow-hidden">
                  {hasImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={prod.imageUrl!}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                      onError={() => onImageError(prod.id)}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-400">
                      <UtensilsCrossed className="w-10 h-10" />
                    </div>
                  )}

                  {/* Dietary badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {prod.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                  </div>

                  {/* Must Try Star pill */}
                  <div className="absolute top-2.5 right-2.5 bg-slate-950/75 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-black text-amber-300 flex items-center gap-1 shadow-sm">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    <span>Must Try</span>
                  </div>
                </div>

                {/* Details & Cart Action */}
                <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug line-clamp-1 group-hover/card:text-red-700 transition-colors">
                      {prod.name}
                    </h3>
                    <p className="text-xs font-black text-red-600 mt-1">
                      {formatPaise(prod.price, currency)}
                    </p>
                  </div>

                  {/* Add Button with Stop Propagation */}
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddToCart(prod)}
                        className="w-full py-2 px-3 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200/90 font-black text-xs rounded-xl shadow-xs transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>ADD</span>
                      </button>
                    ) : (
                      <div className="w-full py-1.5 px-2 bg-red-600 text-white font-black text-xs rounded-xl shadow-sm flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(prod.id, -1)}
                          className="p-1 hover:bg-red-700 rounded-lg transition cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3 stroke-[3]" />
                        </button>
                        <span className="text-xs font-black">{qty}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(prod.id, 1)}
                          className="p-1 hover:bg-red-700 rounded-lg transition cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modern Slide Progress Pill Indicator */}
        <div className="mt-2 flex items-center justify-center">
          <div className="w-24 h-1 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-red-600 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${Math.max(15, scrollProgress)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
