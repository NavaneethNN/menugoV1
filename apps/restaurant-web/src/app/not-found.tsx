import Link from 'next/link';
import { ArrowLeft, Home, KeyRound, QrCode, Compass, Sparkles, Building2 } from 'lucide-react';

export default function NotFound() {
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
          maxWidth: '520px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}
        className="w-full max-w-lg text-center space-y-5"
      >
        {/* Brand Icon */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 20px 30px rgba(220, 38, 38, 0.3)',
            margin: '0 auto'
          }}
          className="w-18 h-18 mx-auto rounded-2xl bg-gradient-to-tr from-red-600 to-red-700 flex items-center justify-center text-white shadow-xl shadow-red-950/50"
        >
          <QrCode style={{ width: 36, height: 36 }} className="w-9 h-9" />
        </div>

        {/* Status Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(220, 38, 38, 0.15)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: '#f87171',
            fontSize: '12px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider"
        >
          <span>404</span>
          <span>•</span>
          <span>Page Not Found</span>
        </div>

        {/* Title and message */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              margin: 0
            }}
            className="text-2xl sm:text-3xl font-black tracking-tight text-white"
          >
            Page or Menu Not Found
          </h1>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '14px',
              lineHeight: 1.6,
              margin: 0
            }}
            className="text-slate-400 text-sm leading-relaxed"
          >
            The link you followed doesn&apos;t exist, was moved, or has an outdated URL anchor.
          </p>
        </div>

        {/* Customer Guidance Card */}
        <div
          style={{
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(51, 65, 85, 0.7)',
            textAlign: 'left',
            width: '100%',
            boxSizing: 'border-box'
          }}
          className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-left space-y-1.5 text-xs text-slate-300"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#dc2626'
              }}
            />
            <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '13px' }}>
              Dining in at a restaurant or cinema?
            </span>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
            Please scan the physical QR code on your dining table or theatre seat with your phone camera to open your live menu.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            width: '100%',
            paddingTop: '8px'
          }}
          className="flex flex-col sm:flex-row gap-3 pt-1 w-full"
        >
          <Link
            href="/"
            style={{
              flex: 1,
              padding: '12px 18px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 16px rgba(220, 38, 38, 0.35)',
              transition: 'background-color 0.2s ease'
            }}
            className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/30"
          >
            <Home style={{ width: 16, height: 16 }} className="w-4 h-4" />
            <span>Go to Homepage</span>
          </Link>

          <Link
            href="/#how-it-works"
            style={{
              padding: '12px 18px',
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: '1px solid #334155',
              transition: 'background-color 0.2s ease'
            }}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
          >
            <Compass style={{ width: 16, height: 16 }} className="w-4 h-4 text-red-400" />
            <span>How It Works</span>
          </Link>
        </div>

        {/* Staff & Admin Direct Access */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #1e293b',
            fontSize: '12px',
            color: '#64748b',
            width: '100%'
          }}
          className="pt-3 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-center gap-4 w-full"
        >
          <Link
            href="/staff/login"
            style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            className="hover:text-slate-300 transition flex items-center gap-1"
          >
            <KeyRound style={{ width: 14, height: 14 }} className="w-3.5 h-3.5 text-red-400" />
            <span>Staff PIN Login</span>
          </Link>
          <span>•</span>
          <Link
            href="/admin/login"
            style={{ color: '#94a3b8', textDecoration: 'none' }}
            className="hover:text-slate-300 transition"
          >
            Admin Sign In
          </Link>
          <span>•</span>
          <Link
            href="/cinema/onboarding"
            style={{ color: '#94a3b8', textDecoration: 'none' }}
            className="hover:text-slate-300 transition"
          >
            Theatre Setup
          </Link>
        </div>
      </div>
    </div>
  );
}
