'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, signUp } from '@/lib/auth-client';
import { Lock, Mail, User, ArrowRight, Loader2, Sparkles, KeyRound, Film } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const business = searchParams.get('business') || searchParams.get('type') || 'restaurant';
  const isCinema = business === 'cinema';
  const redirectParam = searchParams.get('redirect');
  const targetUrl = redirectParam || (isCinema ? '/cinema/onboarding' : '/admin/dashboard');

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const res = await signUp.email({
          email,
          password,
          name
        });

        if (res.error) {
          setError(res.error.message || 'Failed to sign up');
          setLoading(false);
          return;
        }

        router.push(targetUrl);
      } else {
        const res = await signIn.email({
          email,
          password
        });

        if (res.error) {
          setError(res.error.message || 'Invalid email or password');
          setLoading(false);
          return;
        }

        router.push(targetUrl);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 p-8 text-white text-center relative">
        <div
          className={`w-12 h-12 ${
            isCinema ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-orange-600 shadow-orange-500/20'
          } rounded-2xl flex items-center justify-center font-black text-2xl mx-auto mb-3 shadow-lg`}
        >
          {isCinema ? <Film className="w-6 h-6 text-white" /> : 'M'}
        </div>
        <h2 className="text-2xl font-bold">
          {isCinema ? 'MenuGo Cinema Console' : 'MenuGo Staff & Admin'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {mode === 'signup'
            ? (isCinema ? 'Create cinema theatre manager account' : 'Create restaurant manager account')
            : (isCinema ? 'Sign in to access your cinema theatre dashboard' : 'Sign in to access your restaurant dashboard')}
        </p>
      </div>

      {/* Form */}
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Chef Gordon"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@restaurant.com"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 ${
              isCinema
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                : 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
            } text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher */}
        <div className="mt-6 text-center text-sm text-slate-600 border-t pt-6">
          {mode === 'signup' ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`font-bold ${isCinema ? 'text-indigo-600' : 'text-orange-600'} hover:underline`}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don&apos;t have an account yet?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`font-bold ${isCinema ? 'text-indigo-600' : 'text-orange-600'} hover:underline`}
              >
                {isCinema ? 'Register Cinema Theatre' : 'Register Restaurant'}
              </button>
            </p>
          )}
        </div>

        {/* Business Switcher */}
        <div className="mt-4 text-center text-xs text-slate-500">
          {isCinema ? (
            <Link
              href={`/admin/login${mode === 'signup' ? '?mode=signup&business=restaurant' : '?business=restaurant'}`}
              className="text-orange-600 hover:underline font-semibold"
            >
              ← Switch to Restaurant Management
            </Link>
          ) : (
            <Link
              href={`/admin/login${mode === 'signup' ? '?mode=signup&business=cinema&redirect=/cinema/onboarding' : '?business=cinema&redirect=/cinema/onboarding'}`}
              className="text-indigo-600 hover:underline font-semibold flex items-center justify-center gap-1.5"
            >
              <Film className="w-4 h-4 text-indigo-500" />
              <span>Switch to Cinema Theatre Console &rarr;</span>
            </Link>
          )}
        </div>

        {/* Quick Staff PIN Terminal Switcher */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <Link
            href="/staff/login"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold transition border border-orange-200 shadow-2xs group"
          >
            <KeyRound className="w-4 h-4 text-orange-600 transition group-hover:rotate-12" />
            <span>Kitchen &amp; Floor Staff: Quick PIN Login</span>
            <ArrowRight className="w-3.5 h-3.5 text-orange-500 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-orange-600" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

