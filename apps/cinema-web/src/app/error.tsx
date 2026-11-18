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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box'
      }}
      className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 selection:bg-red-500 selection:text-white"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}
        className="w-full max-w-md text-center space-y-6"
      >
        {/* Error Icon */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            backgroundColor: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f43f5e',
            margin: '0 auto'
          }}
          className="w-18 h-18 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-xl shadow-rose-950/40"
        >
          <AlertTriangle style={{ width: 36, height: 36 }} className="w-9 h-9" />
        </div>

        {/* Status Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            color: '#fb7185',
            fontSize: '12px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider"
        >
          Application Error
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="space-y-2">
          <h1
            style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: 0 }}
            className="text-2xl sm:text-3xl font-black tracking-tight text-white"
          >
            Something Went Wrong
          </h1>
          <p
            style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}
            className="text-slate-400 text-sm leading-relaxed"
          >
            An unexpected error occurred while processing your request. Your table and order data remain safely preserved.
          </p>
        </div>

        {/* Action Buttons */}
        <div
          style={{ display: 'flex', flexDirection: 'row', gap: '12px', width: '100%', paddingTop: '8px' }}
          className="flex flex-col sm:flex-row gap-3 pt-2 w-full"
        >
          <button
            onClick={() => reset()}
            style={{
              flex: 1,
              padding: '12px 18px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 16px rgba(220, 38, 38, 0.35)'
            }}
            className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
          >
            <RefreshCw style={{ width: 16, height: 16 }} className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            style={{
              padding: '12px 18px',
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius: '12px',
              textDecoration: 'none',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
          >
            <Home style={{ width: 16, height: 16 }} className="w-4 h-4" />
            <span>Home</span>
          </Link>
        </div>

        {/* Staff Help */}
        <div
          style={{
            paddingTop: '16px',
            borderTop: '1px solid #1e293b',
            fontSize: '12px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            width: '100%'
          }}
          className="pt-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-center gap-4 w-full"
        >
          <Link
            href="/staff/login"
            style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            className="hover:text-slate-300 transition flex items-center gap-1"
          >
            <KeyRound style={{ width: 14, height: 14 }} className="w-3.5 h-3.5 text-red-400" />
            <span>Staff Terminal</span>
          </Link>
          <span>•</span>
          <Link href="/admin/login" style={{ color: '#94a3b8', textDecoration: 'none' }} className="hover:text-slate-300 transition">
            Admin Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
