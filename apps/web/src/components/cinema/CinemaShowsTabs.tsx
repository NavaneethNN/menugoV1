'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clapperboard } from 'lucide-react';

interface CinemaShowsTabsProps {
  className?: string;
}

export function CinemaShowsTabs({ className = '' }: CinemaShowsTabsProps) {
  const pathname = usePathname();
  const isShows = pathname === '/cinema/admin/shows';
  const isMovies = pathname.startsWith('/cinema/admin/movies');

  return (
    <div className={`inline-flex items-center p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-xs shrink-0 ${className}`}>
      <Link
        href="/cinema/admin/shows"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          isShows
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
      >
        <CalendarDays className="w-3.5 h-3.5" />
        <span>Show Schedule</span>
      </Link>

      <Link
        href="/cinema/admin/movies"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          isMovies
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
      >
        <Clapperboard className="w-3.5 h-3.5" />
        <span>Movie Catalogue</span>
      </Link>
    </div>
  );
}
