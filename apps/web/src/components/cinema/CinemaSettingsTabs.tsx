'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, QrCode, CreditCard, Users } from 'lucide-react';

export function CinemaSettingsTabs() {
  const pathname = usePathname();
  const isProfile = pathname === '/cinema/admin/settings';
  const isQr = pathname.startsWith('/cinema/admin/qr');
  const isPayments = pathname.startsWith('/cinema/admin/payments');
  const isStaff = pathname.startsWith('/cinema/admin/staff');

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner max-w-fit mb-6 overflow-x-auto no-scrollbar">
      <Link
        href="/cinema/admin/settings"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
          isProfile
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <Settings className="w-3.5 h-3.5" />
        <span>Theatre Profile</span>
      </Link>

      <Link
        href="/cinema/admin/qr"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
          isQr
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <QrCode className="w-3.5 h-3.5" />
        <span>Screen QR Codes</span>
      </Link>

      <Link
        href="/cinema/admin/payments"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
          isPayments
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <CreditCard className="w-3.5 h-3.5" />
        <span>Payment Gateway</span>
      </Link>

      <Link
        href="/cinema/admin/staff"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
          isStaff
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <Users className="w-3.5 h-3.5" />
        <span>Staff & Access</span>
      </Link>
    </div>
  );
}
