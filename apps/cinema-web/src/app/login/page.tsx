'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn, signOut, useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import {
  Film,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Building2,
  Eye,
  EyeOff,
  RotateCcw,
  MapPin,
  Laptop,
  Check,
  ShieldCheck,
  ChefHat,
  Truck
} from 'lucide-react';

const TERMINAL_THEATRE_STORAGE_KEY = 'menugo_cinema_terminal_theatre';

interface BoundTheatre {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  address?: string | null;
}

function CinemaLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theatreParam = searchParams.get('theatre') || searchParams.get('theatreId');
  const redirectParam = searchParams.get('redirect');

  const { data: session, isPending: sessionLoading } = useSession();

  // Terminal state
  const [boundTheatre, setBoundTheatre] = useState<BoundTheatre | null>(null);
  const [initialChecking, setInitialChecking] = useState(true);

  // Theatre selection (for first-time setup when no theatre is bound)
  const [availableTheatres, setAvailableTheatres] = useState<BoundTheatre[]>([]);
  const [theatresLoading, setTheatresLoading] = useState(false);
  const [theatreSearchQuery, setTheatreSearchQuery] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load available theatres for setup
  const loadAvailableTheatres = useCallback(async () => {
    try {
      setTheatresLoading(true);
      const data = await apiRequest<BoundTheatre[]>('/api/auth/staff-theatres');
      setAvailableTheatres(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load theatres:', err);
    } finally {
      setTheatresLoading(false);
    }
  }, []);

  // Initialize terminal on mount
  useEffect(() => {
    async function initTerminal() {
      try {
        // 1. If URL has ?theatre=slugOrId, fetch and bind that theatre
        if (theatreParam) {
          try {
            const theatreData = await apiRequest<BoundTheatre>(`/api/auth/theatre-info/${encodeURIComponent(theatreParam)}`);
            if (theatreData && theatreData.id) {
              setBoundTheatre(theatreData);
              localStorage.setItem(TERMINAL_THEATRE_STORAGE_KEY, JSON.stringify(theatreData));
              setInitialChecking(false);
              return;
            }
          } catch (e) {
            console.warn('Could not resolve theatre from query param:', e);
          }
        }

        // 2. Check localStorage for existing bound theatre
        const cached = localStorage.getItem(TERMINAL_THEATRE_STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.id || parsed.slug)) {
              setBoundTheatre(parsed);
              setInitialChecking(false);
              return;
            }
          } catch (e) {
            console.warn('Invalid cached terminal theatre:', e);
            localStorage.removeItem(TERMINAL_THEATRE_STORAGE_KEY);
          }
        }

        // 3. No theatre bound yet -> Fetch list of theatres for first-time setup
        await loadAvailableTheatres();
      } finally {
        setInitialChecking(false);
      }
    }

    initTerminal();
  }, [theatreParam, loadAvailableTheatres]);

  // Handle theatre selection for first-time setup
  const handleSelectTheatre = (theatre: BoundTheatre) => {
    setBoundTheatre(theatre);
    try {
      localStorage.setItem(TERMINAL_THEATRE_STORAGE_KEY, JSON.stringify(theatre));
    } catch (e) {
      console.warn('Failed to save theatre to localStorage:', e);
    }
    setError(null);
  };

  // Handle resetting/switching theatre
  const handleResetTheatre = () => {
    if (
      window.confirm(
        'Reset this terminal configuration? You will need to select a theatre again to set up this POS device.'
      )
    ) {
      try {
        localStorage.removeItem(TERMINAL_THEATRE_STORAGE_KEY);
      } catch (e) {
        console.warn('Failed to clear storage:', e);
      }
      setBoundTheatre(null);
      setError(null);
      loadAvailableTheatres();
    }
  };

  // Route staff user based on membership role
  const handleRoleRouting = async (targetTheatre: BoundTheatre) => {
    try {
      setStatusMessage('Verifying theatre permissions...');

      // Verify account domain: Restaurant accounts cannot access theatre terminals
      const accountInfo = await apiRequest('/api/auth/account-type').catch(() => null);
      if (accountInfo?.tenantType === 'restaurant') {
        await signOut();
        setError('This account is registered for restaurants. Cinema terminal login is strictly for theatre accounts.');
        setStatusMessage(null);
        return;
      }

      const myTenants = await apiRequest('/api/restaurants/my?tenantType=cinema');

      const membership = (myTenants || []).find(
        (m: any) =>
          m.restaurant?.id === targetTheatre.id ||
          m.restaurant?.slug === targetTheatre.slug
      );

      if (!membership) {
        // Staff does not belong to this theatre
        await signOut();
        setError(
          `Access Denied: Your account is not registered as staff for ${targetTheatre.name}. Please contact your theatre manager.`
        );
        setStatusMessage(null);
        return;
      }

      // If user specified a redirect query param, honor it
      if (redirectParam) {
        router.push(redirectParam);
        return;
      }

      // Route based on role in this theatre
      const role = membership.role;
      if (role === 'kitchen') {
        router.push('/cinema/kitchen');
      } else if (role === 'delivery') {
        router.push('/cinema/delivery');
      } else if (role === 'admin' || role === 'owner') {
        router.push('/cinema/admin/dashboard');
      } else {
        router.push('/cinema/kitchen');
      }
    } catch (err: any) {
      console.error('Membership verification error:', err);
      setError(err?.message || 'Could not verify theatre access. Please try again.');
      setStatusMessage(null);
    }
  };

  // Handle staff login submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boundTheatre) return;

    try {
      setAuthLoading(true);
      setError(null);
      setStatusMessage('Authenticating...');

      const res = await signIn.email({
        email: email.trim().toLowerCase(),
        password
      });

      if (res.error) {
        setError(res.error.message || 'Invalid email or password');
        setAuthLoading(false);
        setStatusMessage(null);
        return;
      }

      // Validate theatre membership and route
      await handleRoleRouting(boundTheatre);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check network connection.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const callbackURL = `${window.location.origin}/cinema/login${boundTheatre?.slug ? `?theatre=${boundTheatre.slug}` : ''}`;
      await signIn.social({
        provider: 'google',
        callbackURL
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate Google authentication.');
      setGoogleLoading(false);
    }
  };

  // Filtered theatres for setup screen
  const filteredTheatres = availableTheatres.filter((t) => {
    if (!theatreSearchQuery.trim()) return true;
    const q = theatreSearchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.address && t.address.toLowerCase().includes(q))
    );
  });

  // Initial loader
  if (initialChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm text-slate-400 font-medium">Configuring POS Terminal...</p>
      </div>
    );
  }

  // =========================================================================
  // Screen 1: Initial POS Setup - Select Theatre
  // (Only appears once if no theatre is bound in localStorage or URL)
  // =========================================================================
  if (!boundTheatre) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 sm:p-6">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
              <Laptop className="w-3.5 h-3.5" />
              <span>Initial POS Terminal Setup</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Select Cinema Theatre</h1>
            <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
              Choose the theatre for this device. Once selected, this terminal will be permanently locked to this theatre for direct staff login.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={theatreSearchQuery}
              onChange={(e) => setTheatreSearchQuery(e.target.value)}
              placeholder="Search theatre by name or city..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
            />
          </div>

          {/* Theatre Cards */}
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {theatresLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                <span className="text-xs">Loading cinema locations...</span>
              </div>
            ) : filteredTheatres.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No active cinema theatres found. Please verify your theatre setup in admin console.
              </div>
            ) : (
              filteredTheatres.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTheatre(t)}
                  className="w-full text-left p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden">
                      {t.logoUrl ? (
                        <Image
                          src={t.logoUrl}
                          alt={t.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <Film className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                        {t.name}
                      </div>
                      {t.address ? (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-slate-500" />
                          <span>{t.address}</span>
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">cinema • {t.slug}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <span>Select</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>Need theatre owner access?</span>
            <Link
              href="/admin/login?business=cinema"
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition"
            >
              Cinema Admin Login &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Screen 2: Bound Terminal Staff Login
  // (No theatre selection dropdown; terminal is locked to boundTheatre)
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 sm:p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Theatre Branding Header */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 p-6 sm:p-7 text-center relative">
          {/* Active Terminal Indicator */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Terminal Bound</span>
          </div>

          {/* Theatre Logo or Icon */}
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shadow-inner">
              {boundTheatre.logoUrl ? (
                <Image
                  src={boundTheatre.logoUrl}
                  alt={boundTheatre.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <Film className="w-8 h-8 text-indigo-400" />
              )}
            </div>
          </div>

          {/* Theatre Title & Subtitle */}
          <h1 className="text-xl font-bold tracking-tight text-white truncate px-2">
            {boundTheatre.name}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Staff POS Terminal Login
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7">
          {/* Notifications */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {statusMessage && !error && (
            <div className="mb-5 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Already Signed-In Banner */}
          {session?.user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <p className="text-xs text-slate-400">Currently logged in as</p>
                <p className="text-sm font-semibold text-white mt-0.5">{session.user.name}</p>
                <p className="text-xs text-slate-500">{session.user.email}</p>
              </div>

              <button
                type="button"
                onClick={() => handleRoleRouting(boundTheatre)}
                disabled={authLoading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Access...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Staff Station</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setError(null);
                  setStatusMessage(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              >
                Sign in with different account
              </button>
            </div>
          ) : (
            /* Staff Sign-in Form */
            <div>
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={authLoading || googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/80 text-white font-semibold text-sm shadow-xs transition hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60 disabled:cursor-not-allowed mb-4 cursor-pointer"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
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
                <span>Sign in with Google</span>
              </button>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500 font-medium tracking-wider">
                    Or use staff email &amp; password
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Staff Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@theatre.com"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

          {/* Quick Info on Roles */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <ChefHat className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Kitchen KDS</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <Truck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">Seat Delivery</span>
              </div>
            </div>
          </div>

          {/* Footer - Switch Theatre Option */}
          <div className="mt-5 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={handleResetTheatre}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-300 transition font-medium cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Switch Theatre</span>
            </button>

            <Link
              href="/admin/login?business=cinema"
              className="text-slate-400 hover:text-white transition"
            >
              Cinema Admin Console &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CinemaLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-xs text-slate-400">Loading Cinema Terminal...</p>
        </div>
      }
    >
      <CinemaLoginContent />
    </Suspense>
  );
}
