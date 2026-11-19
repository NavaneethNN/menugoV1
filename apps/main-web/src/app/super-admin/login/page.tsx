'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Laptop
} from 'lucide-react';
import { signIn } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';

export default function SuperAdminLoginPage() {
  const router = useRouter();

  const [loginMethod, setLoginMethod] = useState<'auth' | 'master_key'>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn.email({
        email: email.trim().toLowerCase(),
        password
      });

      if (res.error) {
        setError(res.error.message || 'Invalid administrator credentials');
        setLoading(false);
        return;
      }

      // Verify super admin authorization
      const check = await apiRequest('/api/super-admin/me').catch(() => null);
      if (check?.isSuperAdmin) {
        router.push('/super-admin');
      } else {
        setError('Access Denied: This account is not authorized as a MenuGo Super Administrator.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
      setLoading(false);
    }
  };

  const handleMasterKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!masterKey.trim()) {
        setError('Please enter the platform master key');
        setLoading(false);
        return;
      }

      // Test master key with API
      const res = await apiRequest('/api/super-admin/me', {
        superAdminKey: masterKey.trim()
      });

      if (res?.isSuperAdmin) {
        localStorage.setItem('menugo_super_admin_key', masterKey.trim());
        router.push('/super-admin');
      } else {
        setError('Invalid master administration key');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid master administration key.');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const callbackURL = `${window.location.origin}/super-admin`;
      await signIn.social({
        provider: 'google',
        callbackURL
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate Google authentication.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to MenuGo Public Portal</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-7 sm:p-9">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Internal Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Super Admin Console
            </h1>
            <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
              Restricted management console for MenuGo platform operators and engineers.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Toggle Login Method */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoginMethod('auth');
              }}
              className={`py-2 rounded-lg transition ${
                loginMethod === 'auth' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin Account
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoginMethod('master_key');
              }}
              className={`py-2 rounded-lg transition ${
                loginMethod === 'master_key' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Master Key
            </button>
          </div>

          {loginMethod === 'auth' ? (
            <>
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full py-3 px-4 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>Continue with Google Workspace</span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  <span className="bg-slate-900 px-3">or email credentials</span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Admin Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@menugo.in"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-xs transition shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Authenticate as Super Admin</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Master Key Bypass Form */
            <form onSubmit={handleMasterKeyLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Platform Master Key
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    placeholder="Enter platform secret key..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Emergency operator key for initial platform setup and infrastructure recovery.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Verify Master Key</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
