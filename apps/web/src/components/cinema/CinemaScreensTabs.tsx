'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tv, Armchair } from 'lucide-react';

export function CinemaScreensTabs() {
  const pathname = usePathname();
  const isScreens = pathname === '/cinema/admin/screens';
  const isSeating = pathname.startsWith('/cinema/admin/seating');

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner max-w-fit mb-6">
      <Link
        href="/cinema/admin/screens"
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
          isScreens
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <Tv className="w-3.5 h-3.5" />
        <span>Auditoriums & Screens</span>
      </Link>

      <Link
        href="/cinema/admin/seating"
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
          isSeating
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <Armchair className="w-3.5 h-3.5" />
        <span>Seating Layout & Rows</span>
      </Link>
    </div>
  );
}
