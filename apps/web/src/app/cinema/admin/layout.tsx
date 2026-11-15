'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { CinemaSidebar } from '@/components/cinema/CinemaSidebar';
import {
  Film,
  LogOut,
  Plus,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Store,
  ChevronDown,
  Menu,
  Sparkles
} from 'lucide-react';

export default function CinemaAdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;

  const [theatres, setTheatres] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [restaurantMemberships, setRestaurantMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initialLoadedRef = useRef(false);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login?business=cinema&redirect=/cinema/admin/dashboard');
      return;
    }
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadCinemaTheatres();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionLoading, router]);

  const loadCinemaTheatres = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all memberships for the logged in user
      const allMemberships = await apiRequest('/api/restaurants/my');

      const cinemaList = allMemberships.filter(
        (m: any) => m.restaurant?.tenantType === 'cinema'
      );
      const restList = allMemberships.filter(
        (m: any) => (m.restaurant?.tenantType || 'restaurant') === 'restaurant'
      );

      setTheatres(cinemaList);
      setRestaurantMemberships(restList);

      if (cinemaList.length > 0) {
        setSelectedMembership(cinemaList[0]);
      }
    } catch (err: any) {
      console.error('Failed to load cinema theatres:', err);
      setError(err?.message || 'Failed to load cinema profile');
    } finally {
      setLoading(false);
    }
  };

  const selectedTheatre = selectedMembership?.restaurant;

  // Loading State
  if (sessionLoading || (loading && !selectedTheatre && restaurantMemberships.length === 0 && !error)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-slate-400 font-medium">Loading Cinema Management Console...</p>
      </div>
    );
  }

  // Cross-Module / Unauthorized State: User has ONLY Restaurant accounts, no Cinema accounts
  if (!loading && theatres.length === 0 && restaurantMemberships.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white">Restaurant Account Detected</h2>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            Your current account is registered as a <span className="text-white font-bold">Restaurant Tenant</span> ({restaurantMemberships[0]?.restaurant?.name}).
            Cinema dashboards manage auditoriums, seat layouts, and daily movie shows.
          </p>

          <div className="mt-8 space-y-3">
            <Link
              href="/admin/dashboard"
              className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-lg shadow-orange-600/25 text-sm"
            >
              <Store className="w-4 h-4" />
              <span>Go to Restaurant Dashboard</span>
            </Link>

            <Link
              href="/cinema/onboarding"
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-6 rounded-xl transition text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register a New Cinema Theatre</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No accounts at all: Prompt Onboarding
  if (!loading && theatres.length === 0 && restaurantMemberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-5">
            <Film className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white">Welcome to Cinema Module</h2>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            You haven&apos;t registered any cinema theatres yet. Complete theatre setup to configure screens, rows, seats and daily movie show schedules.
          </p>
          <div className="mt-8">
            <Link
              href="/cinema/onboarding"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-lg shadow-indigo-600/30 text-sm"
            >
              <span>Start Cinema Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Responsive Cinema Sidebar & Mobile Drawer */}
      <CinemaSidebar
        theatreName={selectedTheatre?.name}
        theatreSlug={selectedTheatre?.slug}
        role={selectedMembership?.role}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Theatre Console Header */}
        <header className="h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition shrink-0"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile brand badge if small screen */}
            <div className="lg:hidden flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                <Film className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Theatre Selector */}
            {theatres.length > 1 ? (
              <div className="relative max-w-[150px] sm:max-w-[220px] md:max-w-xs min-w-0">
                <select
                  value={selectedTheatre?.id || ''}
                  onChange={(e) => {
                    const match = theatres.find((t) => t.restaurant.id === e.target.value);
                    if (match) setSelectedMembership(match);
                  }}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                >
                  {theatres.map((item) => (
                    <option key={item.restaurant.id} value={item.restaurant.id}>
                      {item.restaurant.name} ({item.role})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : selectedTheatre ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-xs">
                  {selectedTheatre.name}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0 uppercase">
                  {selectedMembership?.role || 'Admin'}
                </span>
              </div>
            ) : null}

            {restaurantMemberships.length > 0 && (
              <Link
                href="/admin/dashboard"
                className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-orange-400 font-medium transition px-3 py-1.5 rounded-xl hover:bg-slate-800/80 shrink-0"
              >
                <Store className="w-3.5 h-3.5 text-orange-400" />
                <span>Switch to Restaurant Admin</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {restaurantMemberships.length > 0 && (
              <Link
                href="/admin/dashboard"
                className="md:hidden p-2 text-slate-400 hover:text-orange-400 transition rounded-xl hover:bg-slate-800 shrink-0"
                title="Switch to Restaurant Admin"
              >
                <Store className="w-4 h-4 text-orange-400" />
              </Link>
            )}

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 font-medium max-w-[160px] truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{session?.user?.name || session?.user?.email}</span>
            </div>

            <button
              onClick={async () => {
                await signOut();
                router.push('/admin/login?business=cinema');
              }}
              className="p-2 text-slate-400 hover:text-rose-400 transition rounded-xl hover:bg-slate-800 shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Child Page Rendering with Theatre Context */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
