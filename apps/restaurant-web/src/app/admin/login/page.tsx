'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { Lock, Mail, User, ArrowRight, ArrowLeft, Loader2, Sparkles, KeyRound, Film, UtensilsCrossed, CheckCircle2, QrCode, ChefHat, Armchair, CalendarDays } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const business = searchParams.get('business') || searchParams.get('type') || 'restaurant';
  const isCinema = business === 'cinema';
  const redirectParam = searchParams.get('redirect');

  const { data: session, isPending: sessionLoading } = useSession();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated or returning from Google OAuth, redirect appropriately
  useEffect(() => {
    const cinemaUrl = process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001';

    if (isCinema) {
      window.location.href = mode === 'signup' ? `${cinemaUrl}/signup` : `${cinemaUrl}/admin/login`;
      return;
    }

    if (sessionLoading || !session?.user) return;

    const oauthReturn = searchParams.get('oauth_return');
    const syncOauth = oauthReturn === '1'
      ? apiRequest('/api/auth/set-oauth-tenant-type', {
          method: 'POST',
          body: JSON.stringify({ tenantType: 'restaurant' })
        }).catch(() => null)
      : Promise.resolve();

    syncOauth
      .then(() => apiRequest('/api/auth/account-type'))
      .then(async (accountInfo) => {
        const userTenantType = accountInfo?.tenantType;

        if (userTenantType === 'cinema') {
          // Theatre account: STRICTLY route to cinema app
          window.location.href = `${cinemaUrl}/admin/dashboard`;
        } else {
          router.push(redirectParam || '/admin/dashboard');
        }
      })
      .catch(() => {
        router.push('/admin/dashboard');
      });
  }, [session, sessionLoading, isCinema, mode, redirectParam, router, searchParams]);

  const handleGoogleAuth = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const callbackURL = `${window.location.origin}/admin/login?oauth_return=1&business=${isCinema ? 'cinema' : 'restaurant'}${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ''}`;
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
          tenantType: isCinema ? 'cinema' : 'restaurant'
        } as any);

        if (res.error) {
          setError(res.error.message || 'Failed to sign up');
          setLoading(false);
          return;
        }

        // Newly created account for Cinema always proceeds to Cinema Onboarding
        if (isCinema) {
          router.push('/cinema/onboarding');
        } else {
          router.push(redirectParam || '/admin/onboarding');
        }
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

        if (userTenantType === 'cinema') {
          // Theatre account: STRICTLY route to cinema app
          const cinemaUrl = process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001';
          window.location.href = `${cinemaUrl}/admin/dashboard`;
          return;
        }

        // Restaurant account
        if (isCinema) {
          await signOut();
          setError('This account is registered for restaurants. Cinema portal is restricted to theatre accounts only.');
          setLoading(false);
          return;
        }

        if (redirectParam) {
          router.push(redirectParam);
          return;
        }

        router.push('/admin/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check backend server.');
    } finally {
      setLoading(false);
    }
  };

  const productName = isCinema ? 'MenuGo for Theatres' : 'MenuGo for Restaurants';
  const benefits = isCinema
    ? [
        { icon: CalendarDays, title: 'Plan every show', detail: 'Manage screens, seating and daily schedules together.' },
        { icon: Armchair, title: 'Serve every seat', detail: 'Route paid food orders to the right row and seat.' },
        { icon: ChefHat, title: 'Keep teams in sync', detail: 'Give kitchen and delivery staff clear order details.' },
      ]
    : [
        { icon: QrCode, title: 'Make every table easy to order from', detail: 'Give guests a quick menu without an app download.' },
        { icon: ChefHat, title: 'Keep orders moving', detail: 'Send clear table orders straight to your kitchen.' },
        { icon: Sparkles, title: 'Spend more time welcoming guests', detail: 'Let your team focus on great service.' },
      ];

  return (
    <main className="min-h-[100svh] bg-white lg:grid lg:grid-cols-2">
      <section className="relative isolate overflow-hidden bg-red-700 text-white px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[100svh] lg:px-10 xl:px-14 2xl:px-20 lg:py-7 xl:py-8 flex flex-col justify-between">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-red-600/70 blur-3xl" />
          <div className="absolute -bottom-48 -left-32 h-[32rem] w-[32rem] rounded-full bg-red-800/70 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
        </div>

        <div>
          <Link href="/" className="inline-flex items-center gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/70">
            <span className="w-11 h-11 rounded-2xl bg-white text-red-700 flex items-center justify-center font-black text-2xl shadow-lg">M</span>
            <span className="text-2xl font-black tracking-tight">MenuGo</span>
          </Link>
          <div className="mt-8 sm:mt-10 lg:mt-7 xl:mt-9 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold text-white/95 backdrop-blur-sm">
              {isCinema ? <Film className="w-4 h-4" /> : <UtensilsCrossed className="w-4 h-4" />}
              {productName}
            </div>
            <p className="mt-6 xl:mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-red-100">
              {mode === 'signup' ? 'A better service experience starts here' : 'Your operations, all in one place'}
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl xl:text-5xl 2xl:text-6xl font-black leading-[1.04] tracking-tight">
              {isCinema
                ? mode === 'signup' ? 'Make every seat a place to order.' : 'Welcome back to your theatre.'
                : mode === 'signup' ? 'Make every table easier to serve.' : 'Welcome back to your restaurant.'}
            </h1>
            <p className="mt-4 text-sm sm:text-base xl:text-lg leading-relaxed text-red-50/90 max-w-lg">
              {isCinema
                ? mode === 'signup'
                  ? 'Bring your screens, shows, food orders and seat delivery into one simple workflow. Set up your theatre once and give guests an easier way to order during the movie.'
                  : 'Pick up where your team left off. Manage your theatre profile, show schedule, kitchen orders and auditorium delivery from one workspace.'
                : mode === 'signup'
                  ? 'Turn table QR codes into a smoother ordering experience. Guests browse at their own pace while your team receives clear orders and keeps service personal.'
                  : 'Your menu, table orders and kitchen workflow are ready when you are. Sign in to continue serving guests with MenuGo.'}
            </p>
          </div>
        </div>

        <div className="mt-8 lg:mt-7 xl:mt-9 max-w-xl">
          <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.18em] text-red-100 mb-3">
            {mode === 'signup' ? 'Everything you need to get started' : 'Built around your daily service'}
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                <div className="flex items-start gap-1.5 font-bold text-xs leading-snug"><Icon className="w-4 h-4 text-white shrink-0" />{title}</div>
                <p className="mt-1.5 text-[10px] leading-snug text-red-50/80">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-red-100/90">
            <CheckCircle2 className="w-4 h-4" /> No customer app required. Your guests can order from their browser.
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:min-h-[100svh] lg:px-8 xl:px-12 2xl:px-16 lg:py-4">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-700 transition-colors mb-5 lg:mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to MenuGo
          </Link>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 lg:p-6 xl:p-7 shadow-xl shadow-slate-900/5">
            <div className="mb-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700">
                {mode === 'signup' ? 'Create your workspace' : 'Owner & team access'}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {mode === 'signup' ? 'Get started' : 'Sign in'}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {mode === 'signup'
                  ? isCinema
                    ? 'Create your administrator account. Next, you’ll add your theatre details and configure your screens.'
                    : 'Create your administrator account and start setting up your restaurant.'
                  : isCinema
                    ? 'Access your cinema screens, show schedules, kitchen and delivery orders.'
                    : 'Access your restaurant dashboard and service tools.'}
              </p>
            </div>

            {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-xs transition hover:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-60 disabled:cursor-not-allowed mb-4 cursor-pointer"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium tracking-wider">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="account-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input id="account-name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="account-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="account-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isCinema ? 'you@yourtheatre.com' : 'you@yourrestaurant.com'} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" />
                </div>
              </div>
              <div>
                <label htmlFor="account-password" className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="account-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" />
                </div>
                {mode === 'signup' && <p className="mt-1.5 text-xs text-slate-500">Use at least 8 characters.</p>}
              </div>
              <button type="submit" disabled={loading} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>{mode === 'signup' ? 'Create account & continue' : 'Sign in to MenuGo'}</span><ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>

            <div className="mt-4 border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
              {mode === 'signup' ? (
                <p>Already have an account? <button type="button" onClick={() => setMode('signin')} className="font-bold text-red-700 hover:text-red-800">Sign in</button></p>
              ) : (
                <p>New to MenuGo? <button type="button" onClick={() => setMode('signup')} className="font-bold text-red-700 hover:text-red-800">Create your account</button></p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-center text-xs">
              <Link href={`/admin/login${mode === 'signup' ? '?mode=signup&business=' + (isCinema ? 'restaurant' : 'cinema') + (isCinema ? '' : '&redirect=/cinema/onboarding') : '?business=' + (isCinema ? 'restaurant' : 'cinema')}`} className="inline-flex items-center justify-center gap-1.5 font-semibold text-slate-600 hover:text-red-700">
                {isCinema ? <UtensilsCrossed className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                {isCinema ? 'MenuGo for Restaurants' : 'MenuGo for Theatres'}
              </Link>
              {!isCinema && <Link href="/staff/login" className="inline-flex items-center justify-center gap-1.5 font-semibold text-slate-500 hover:text-red-700"><KeyRound className="h-3.5 w-3.5" />Staff PIN sign in</Link>}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">Secure access for your business and team.</p>
        </div>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-red-600" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
