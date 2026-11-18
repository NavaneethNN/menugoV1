'use client';

import React from 'react';
import { X, UtensilsCrossed, ChevronRight } from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
  count: number;
}

interface CategoryMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryMenuModal({
  isOpen,
  onClose,
  categories,
  selectedCategory,
  onSelectCategory
}: CategoryMenuModalProps) {
  if (!isOpen) return null;

  const totalDishes = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Menu Directory</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {categories.length} sections • {totalDishes} dishes
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

        <div className="p-2 overflow-y-auto divide-y divide-slate-100">
          <button
            onClick={() => {
              onSelectCategory('all');
              onClose();
            }}
            className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all ${
              selectedCategory === 'all'
                ? 'bg-red-50 text-red-700 font-bold'
                : 'hover:bg-slate-50 text-slate-700 font-medium'
            }`}
          >
            <span className="text-xs">All Dishes</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                {totalDishes}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.id);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-red-50 text-red-700 font-bold'
                    : 'hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <span className="text-xs truncate text-left">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      isSelected
                        ? 'bg-red-200/70 text-red-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
