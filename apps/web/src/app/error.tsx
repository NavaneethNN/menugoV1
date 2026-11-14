'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, KeyRound } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error details in client console for diagnostics
    console.error('[MenuGo Client Error Boundary]:', error?.message || error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 selection:bg-orange-500 selection:text-white">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Error Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-xl shadow-rose-950/40">
          <AlertTriangle className="w-10 h-10" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider">
          Application Error
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Something Went Wrong
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            An unexpected error occurred while processing your request. Your table and order data remain safely preserved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
        </div>

        {/* Staff Help */}
        <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-center gap-4">
          <Link href="/staff/login" className="hover:text-slate-300 transition flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-orange-400" />
            <span>Staff Terminal</span>
          </Link>
          <span>&bull;</span>
          <Link href="/admin/login" className="hover:text-slate-300 transition">
            Admin Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
