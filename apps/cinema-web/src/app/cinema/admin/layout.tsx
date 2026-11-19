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
  Sparkles,
  User
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

  // Exclude unauthenticated auth routes from the dashboard layout guard
  const isExcludedRoute =
    pathname === '/cinema/login' ||
    pathname.startsWith('/cinema/login') ||
    pathname === '/cinema/admin/login' ||
    pathname.startsWith('/cinema/admin/login') ||
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login');

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Sync active theatre ID to localStorage for tenant-scoped API requests
  useEffect(() => {
    if (selectedMembership?.restaurant?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem('active_theatre_id', selectedMembership.restaurant.id);
      } catch {}
    }
  }, [selectedMembership]);

  useEffect(() => {
    if (isExcludedRoute) return;
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
  }, [userId, sessionLoading, router, isExcludedRoute]);

  if (isExcludedRoute) {
    return <>{children}</>;
  }

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-red-700 mb-4" />
        <p className="text-sm text-slate-500 font-medium">Loading cinema workspace...</p>
      </div>
    );
  }

  // Cross-Module / Unauthorized State: User has ONLY Restaurant accounts, no Cinema accounts
  if (!loading && theatres.length === 0 && restaurantMemberships.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-900 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Restaurant account detected</h2>
          <p className="text-slate-600 text-sm mt-3 leading-relaxed">
            Your current account is registered as a <span className="text-slate-900 font-semibold">restaurant</span> ({restaurantMemberships[0]?.restaurant?.name}).
            Cinema dashboards manage auditoriums, seat layouts, and daily movie shows.
          </p>

          <div className="mt-8 space-y-3">
            <Link
              href="/admin/dashboard"
              className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-5 rounded-lg transition text-sm"
            >
              <Store className="w-4 h-4" />
              <span>Go to Restaurant Dashboard</span>
            </Link>
            <Link
              href="/cinema/onboarding"
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-semibold py-3 px-5 rounded-lg transition text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Register a Cinema Theatre</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No accounts at all: Prompt Onboarding
  if (!loading && theatres.length === 0 && restaurantMemberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-900 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center justify-center mx-auto mb-5">
            <Film className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Welcome to The QROS for Theatres</h2>
          <p className="text-slate-600 text-sm mt-3 leading-relaxed">
            You haven&apos;t registered any cinema theatres yet. Complete theatre setup to configure screens, rows, seats and daily movie show schedules.
          </p>
          <div className="mt-8">
            <Link
              href="/cinema/onboarding"
              className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-5 rounded-lg transition text-sm"
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
    <div className="cinema-admin-theme min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
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
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile brand badge if small screen */}
            <div className="lg:hidden flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-red-700 text-white flex items-center justify-center font-bold text-xs">
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
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-red-200 truncate cursor-pointer shadow-xs"
                >
                  {theatres.map((item) => (
                    <option key={item.restaurant.id} value={item.restaurant.id}>
                      {item.restaurant.name} ({item.role})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : selectedTheatre ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate max-w-[140px] sm:max-w-xs">
                  {selectedTheatre.name}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0 uppercase tracking-wider">
                  {selectedMembership?.role || 'Admin'}
                </span>
              </div>
            ) : null}

            {/* Live indicator pill */}
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
              Workspace
            </span>

            {restaurantMemberships.length > 0 && (
              <Link
                href="/admin/dashboard"
                className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium transition px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 shrink-0"
              >
                <Store className="w-3.5 h-3.5 text-slate-500" />
                <span>Switch to Restaurant Admin</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {restaurantMemberships.length > 0 && (
              <Link
                href="/admin/dashboard"
                className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition rounded-lg bg-white border border-slate-200 shrink-0"
                title="Switch to Restaurant Admin"
              >
                <Store className="w-4 h-4" />
              </Link>
            )}

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 font-medium max-w-[170px] truncate">
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{session?.user?.name || session?.user?.email}</span>
            </div>

            <button
              onClick={async () => {
                await signOut();
                router.push('/admin/login?business=cinema');
              }}
              className="p-2 text-slate-500 hover:text-red-700 transition-colors rounded-lg hover:bg-slate-100 shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Child Page Rendering with Theatre Context */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
