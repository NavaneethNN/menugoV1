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
    <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl max-w-fit mb-6 shadow-xs">
      <Link
        href="/cinema/admin/screens"
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
          isScreens
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
      >
        <Tv className="w-3.5 h-3.5" />
        <span>Auditoriums</span>
      </Link>

      <Link
        href="/cinema/admin/seating"
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
          isSeating
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
      >
        <Armchair className="w-3.5 h-3.5" />
        <span>Seating Layout</span>
      </Link>
    </div>
  );
}
