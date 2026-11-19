'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Film,
  Activity,
  Settings,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Loader2,
  Menu,
  X,
  Building2,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { signOut, useSession } from '@/lib/auth-client';

export default function SuperAdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const restaurantUrl = process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000';
  const cinemaUrl = process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001';

  // If on login page, render children directly without admin layout
  const isLoginPage = pathname === '/super-admin/login';

  const [checkingAuth, setCheckingAuth] = useState(!isLoginPage);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoginPage) return;

    let mounted = true;
    async function verifyAdmin() {
      try {
        const data = await apiRequest('/api/super-admin/me');
        if (mounted && data?.isSuperAdmin) {
          setAdminUser(data.user);
          setCheckingAuth(false);
        } else {
          router.replace('/super-admin/login');
        }
      } catch (err) {
        if (mounted) {
          router.replace('/super-admin/login');
        }
      }
    }

    verifyAdmin();
    return () => {
      mounted = false;
    };
  }, [isLoginPage, router]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
        <p className="text-xs text-slate-400 font-medium">Verifying Super Admin Authorization...</p>
      </div>
    );
  }

  const navLinks = [
    { label: 'Overview', href: '/super-admin', icon: LayoutDashboard },
    { label: 'Restaurants', href: '/super-admin/restaurants', icon: UtensilsCrossed },
    { label: 'Theatres & Cinemas', href: '/super-admin/theatres', icon: Film },
    { label: 'Metered Billing & Ledgers', href: '/super-admin/billing', icon: Activity },
    { label: 'Platform Settings', href: '/super-admin/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('menugo_super_admin_key');
      await signOut();
      router.push('/super-admin/login');
    } catch {
      router.push('/super-admin/login');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 z-40 bg-slate-950 text-white border-r border-slate-800">
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <Link href="/super-admin" className="flex items-center gap-2.5">
            <img src="/qros_logo.png" alt="The QROS" className="w-28 h-10 rounded bg-white object-contain" />
            <div>
              <span className="font-black text-base tracking-tight text-white">The QROS</span>
              <span className="ml-2 text-[9px] font-black uppercase tracking-wider bg-red-600 text-white px-1.5 py-0.5 rounded">
                Super Admin
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 mb-2">
            Platform Management
          </div>
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-6">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 mb-2">
              Cross-App Portals
            </div>
            <a
              href={restaurantUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition"
            >
              <div className="flex items-center gap-3">
                <UtensilsCrossed className="w-4 h-4 text-red-500" />
                <span>Restaurant App</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <a
              href={cinemaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition mt-1"
            >
              <div className="flex items-center gap-3">
                <Film className="w-4 h-4 text-indigo-400" />
                <span>Cinema App</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-bold text-white truncate">
                {adminUser?.name || 'Administrator'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {adminUser?.email || 'superadmin@menugo.in'}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-slate-900 capitalize">
              {navLinks.find((l) => l.href === pathname)?.label || 'Super Admin Console'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Platform Online</span>
            </div>

            <Link
              href="/"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
            >
              Public Home
            </Link>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-slate-950 text-white flex flex-col p-6 z-10">
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <span className="font-black text-lg">The QROS Super Admin</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-6 space-y-1.5 flex-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <button
                onClick={handleSignOut}
                className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 text-rose-400 text-xs font-bold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
