'use client';

import React, { useState } from 'react';
import { X, Bell, Droplets, Utensils, Receipt, CheckCircle2, UserCheck } from 'lucide-react';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber?: string | null;
  restaurantName: string;
}

const SERVICE_OPTIONS = [
  {
    id: 'water',
    title: 'Drinking Water',
    description: 'Fresh chilled or regular water',
    icon: Droplets,
    badge: 'Fast'
  },
  {
    id: 'waiter',
    title: 'Call Server to Table',
    description: 'Assistance with menu or questions',
    icon: UserCheck,
    badge: 'Popular'
  },
  {
    id: 'cutlery',
    title: 'Extra Cutlery & Plates',
    description: 'Forks, spoons, napkins, extra plates',
    icon: Utensils,
    badge: 'Essential'
  },
  {
    id: 'bill',
    title: 'Request Bill / Check',
    description: 'Ready to settle payment',
    icon: Receipt,
    badge: 'Cashier'
  }
];

export function ServiceRequestModal({
  isOpen,
  onClose,
  tableNumber,
  restaurantName
}: ServiceRequestModalProps) {
  const [selectedOption, setSelectedOption] = useState<string>('water');
  const [additionalNote, setAdditionalNote] = useState('');
  const [isSent, setIsSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      onClose();
    }, 2400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-100 text-left animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Table Assistance
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {tableNumber ? `Table ${tableNumber}` : 'Dine-In Guest'} • {restaurantName}
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

        {isSent ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mx-auto border border-red-200 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-black text-slate-900">Staff Notified!</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Your server has received the request for{' '}
              <span className="font-bold text-slate-800">
                {tableNumber ? `Table ${tableNumber}` : 'your table'}
              </span>
              . Someone will be right with you.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                What can we bring you?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SERVICE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOption(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-red-600 bg-red-50/70 shadow-xs ring-1 ring-red-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {opt.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Specific request or note (Optional)
              </label>
              <input
                type="text"
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                placeholder="e.g. 2 extra napkins, warm water please"
                maxLength={80}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-2 py-3 px-4 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Bell className="w-4 h-4" />
                <span>Call Staff</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
