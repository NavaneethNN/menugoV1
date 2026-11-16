'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clapperboard } from 'lucide-react';

export function CinemaShowsTabs() {
  const pathname = usePathname();
  const isShows = pathname === '/cinema/admin/shows';
  const isMovies = pathname.startsWith('/cinema/admin/movies');

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner max-w-fit mb-6">
      <Link
        href="/cinema/admin/shows"
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
          isShows
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <CalendarDays className="w-3.5 h-3.5" />
        <span>Daily Show Schedules</span>
      </Link>

      <Link
        href="/cinema/admin/movies"
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
          isMovies
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <Clapperboard className="w-3.5 h-3.5" />
        <span>Movie Catalogue</span>
      </Link>
    </div>
  );
}
