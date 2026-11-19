'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Film,
  CalendarDays,
  Armchair,
  ChefHat,
  CheckCircle2,
  Laptop,
  ExternalLink,
  Building2
} from 'lucide-react';

function CinemaAdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const redirectParam = searchParams.get('redirect');
  const restaurantUrl = process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000';

  const { data: session, isPending: sessionLoading } = useSession();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated or returning from Google OAuth, verify and route
  useEffect(() => {
    if (sessionLoading || !session?.user) return;

    const oauthReturn = searchParams.get('oauth_return');
    const syncOauth = oauthReturn === '1'
      ? apiRequest('/api/auth/set-oauth-tenant-type', {
          method: 'POST',
          body: JSON.stringify({ tenantType: 'cinema' })
        }).catch(() => null)
      : Promise.resolve();

    syncOauth
      .then(() => apiRequest('/api/auth/account-type'))
      .then(async (accountInfo) => {
        const userTenantType = accountInfo?.tenantType;

        if (userTenantType === 'restaurant') {
          await signOut();
          setError('This account is registered for restaurants. Cinema portal is strictly for theatre accounts.');
          return;
        }

        // Check if user has an existing theatre
        try {
          const cinemaTenants = await apiRequest('/api/restaurants/my?tenantType=cinema');
          const hasCinema = Array.isArray(cinemaTenants) && cinemaTenants.length > 0;
          router.push(redirectParam || (hasCinema ? '/admin/dashboard' : '/onboarding'));
        } catch {
          router.push(redirectParam || '/admin/dashboard');
        }
      })
      .catch(() => {
        router.push(redirectParam || '/admin/dashboard');
      });
  }, [session, sessionLoading, redirectParam, router, searchParams]);

  const handleGoogleAuth = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const callbackURL = `${window.location.origin}/admin/login?oauth_return=1${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ''}`;
      await signIn.social({
        provider: 'google',
        callbackURL
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate Google authentication.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const res = await signUp.email({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          tenantType: 'cinema'
        } as any);

        if (res.error) {
          setError(res.error.message || 'Failed to sign up');
          setLoading(false);
          return;
        }

        // New cinema signups proceed straight to theatre onboarding
        router.push('/onboarding');
      } else {
        const res = await signIn.email({
          email: email.trim().toLowerCase(),
          password
        });

        if (res.error) {
          setError(res.error.message || 'Invalid email or password');
          setLoading(false);
          return;
        }

        // Check account type to prevent cross-module access
        const accountInfo = await apiRequest('/api/auth/account-type').catch(() => null);
        const userTenantType = accountInfo?.tenantType;

        if (userTenantType === 'restaurant') {
          await signOut();
          setError('This account is registered for restaurants. Cinema portal is restricted to theatre accounts only.');
          setLoading(false);
          return;
        }

        // Check theatre existence
        try {
          const tenants = await apiRequest('/api/restaurants/my?tenantType=cinema');
          const hasCinema = Array.isArray(tenants) && tenants.some((m: any) => m.restaurant?.tenantType === 'cinema');
          if (hasCinema) {
            router.push(redirectParam || '/admin/dashboard');
          } else {
            router.push('/onboarding');
          }
        } catch {
          router.push(redirectParam || '/admin/dashboard');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: CalendarDays, title: 'Auditoriums & Screens', detail: 'Manage screens, seating grids and independent rows.' },
    { icon: Armchair, title: 'In-Seat Delivery', detail: 'Route paid food and drink orders to the exact row and seat.' },
    { icon: ChefHat, title: 'Kitchen KDS Workflow', detail: 'Keep concession counters and runners in complete sync.' },
  ];

  return (
    <main className="min-h-[100svh] bg-white lg:grid lg:grid-cols-2">
      {/* Left Column: Theatre Hero Branding */}
      <section className="relative isolate overflow-hidden bg-red-700 text-white px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[100svh] lg:px-10 xl:px-14 2xl:px-20 lg:py-7 xl:py-8 flex flex-col justify-between">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-red-600/70 blur-3xl" />
          <div className="absolute -bottom-48 -left-32 h-[32rem] w-[32rem] rounded-full bg-red-800/70 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
        </div>

        <div>
          <Link href="/" className="inline-flex items-center gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/70">
            <img src="/qros_logo.png" alt="The QROS" className="w-36 h-12 rounded-lg bg-white object-contain shadow-lg" />
            <span className="sr-only">The QROS Cinema Portal</span>
          </Link>

          <div className="mt-8 sm:mt-10 lg:mt-7 xl:mt-9 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold text-white/95 backdrop-blur-sm">
              <Film className="w-4 h-4" />
              <span>The QROS for Theatres</span>
            </div>
            <p className="mt-6 xl:mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-red-100">
              {mode === 'signup' ? 'Modern Concession Operations' : 'Theatre Management Workspace'}
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl xl:text-5xl 2xl:text-6xl font-black leading-[1.04] tracking-tight">
              {mode === 'signup' ? 'Make every seat a place to order.' : 'Welcome back to your theatre.'}
            </h1>
            <p className="mt-4 text-sm sm:text-base xl:text-lg leading-relaxed text-red-50/90 max-w-lg">
              {mode === 'signup'
                ? 'Bring your screens, seating rows, concession kitchen and seat delivery runners into one unified platform.'
                : 'Pick up where your team left off. Monitor screen orders, manage concession stock and coordinate runners.'}
            </p>
          </div>
        </div>

        <div className="mt-8 lg:mt-7 xl:mt-9 max-w-xl">
          <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.18em] text-red-100 mb-3">
            {mode === 'signup' ? 'Built for cinema operations' : 'Operating rhythm'}
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                <div className="flex items-start gap-1.5 font-bold text-xs leading-snug">
                  <Icon className="w-4 h-4 text-white shrink-0" />
                  {title}
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-red-50/80">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-red-100/90">
            <CheckCircle2 className="w-4 h-4" /> Zero app install for moviegoers. Quick browser ordering via armrest QR.
          </div>
        </div>
      </section>

      {/* Right Column: Authentication Form */}
      <section className="flex items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:min-h-[100svh] lg:px-8 xl:px-12 2xl:px-16 lg:py-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-5 lg:mb-4">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Cinema Home
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>POS Terminal Staff Login</span>
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 lg:p-6 xl:p-7 shadow-xl shadow-slate-900/5">
            <div className="mb-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700">
                {mode === 'signup' ? 'Create Theatre Workspace' : 'Administrator Access'}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {mode === 'signup' ? 'Register Theatre' : 'Theatre Sign In'}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {mode === 'signup'
                  ? 'Create your theatre administrator account. Next, you will add screens and seating.'
                  : 'Sign in to access your theatre dashboard, screens, kitchen display and orders.'}
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 mt-1.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {/* Google Social Sign In */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>{mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <span className="bg-white px-3">or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Theatre Manager"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-medium transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@cinema.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-medium transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-medium transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3 px-4 rounded-xl bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-extrabold text-sm transition-all shadow-md shadow-red-700/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'signup' ? 'Create Theatre Account' : 'Sign In to Console'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {mode === 'signup' ? 'Already have a theatre account?' : "Don't have a theatre account?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                }}
                className="font-bold text-red-700 hover:text-red-800 transition"
              >
                {mode === 'signup' ? 'Sign In' : 'Register Free'}
              </button>
            </div>
          </div>

          {/* Cross portal link */}
          <div className="mt-5 text-center">
            <a
              href={restaurantUrl}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
            >
              <span>Looking for the Restaurant Portal?</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CinemaAdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-8 h-8 animate-spin text-red-700" />
        </div>
      }
    >
      <CinemaAdminLoginForm />
    </Suspense>
  );
}
