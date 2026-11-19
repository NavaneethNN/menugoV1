'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Film,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Laptop,
  Check,
  Sparkles,
  QrCode,
  ChefHat,
  Armchair,
  Tv,
  Coins,
  ChevronRight,
  Loader2,
  Building2,
  Zap
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tenantType: 'restaurant' | 'cinema' | 'all';
  priceMonthlyPaise: number;
  priceAnnualPaise: number;
  maxTables: number | null;
  maxScreens: number | null;
  maxStaff: number | null;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

export default function MainPlatformHomePage() {
  const restaurantUrl = process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000';
  const cinemaUrl = process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001';

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [planFilter, setPlanFilter] = useState<'all' | 'restaurant' | 'cinema'>('all');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Load live subscription plans from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        setLoadingPlans(true);
        const data = await apiRequest('/api/public/subscription-plans');
        if (Array.isArray(data)) {
          setPlans(data);
        }
      } catch (err) {
        console.warn('Failed to fetch live plans, using default presentation:', err);
      } finally {
        setLoadingPlans(false);
      }
    }
    fetchPlans();
  }, []);

  const filteredPlans = plans.filter((p) => {
    if (!p.isActive) return false;
    if (planFilter === 'all') return true;
    return p.tenantType === planFilter || p.tenantType === 'all';
  });

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-red-600 selection:text-white">
      {/* Platform Top Notification Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">MenuGo Cloud Platform:</span>
            <span className="hidden sm:inline text-slate-400">
              Powering restaurants and cinema theatres across India with contactless QR self-ordering.
            </span>
          </div>
          <Link
            href="/super-admin/login"
            className="text-[11px] font-semibold text-slate-300 hover:text-white transition flex items-center gap-1 shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
            <span>Super Admin</span>
          </Link>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-red-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:scale-105 transition-transform">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                Menu<span className="text-red-600">Go</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">
                Unified Hospitality Platform
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#solutions" className="hover:text-red-600 transition">Solutions</a>
            <a href="#how-it-works" className="hover:text-red-600 transition">How It Works</a>
            <a href="#pricing" className="hover:text-red-600 transition">Pricing Plans</a>
            <a href="#architecture" className="hover:text-red-600 transition">Platform Architecture</a>
          </nav>

          {/* App Switcher Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={restaurantUrl}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Restaurants</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href={cinemaUrl}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
            >
              <Film className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Theatres</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <Link
              href="/super-admin"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-2 rounded-xl transition shadow-sm"
            >
              <Laptop className="w-3.5 h-3.5 text-red-400" />
              <span>Super Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-slate-50 via-white to-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Contactless Operations</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-[1.05] max-w-5xl mx-auto">
            The Contactless Operating System for <span className="text-red-600">Restaurants</span> &amp; <span className="text-red-600">Theatres</span>.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            One multi-tenant cloud platform powering smart table ordering for dining venues, and precision in-seat delivery for cinema multiplexes. Zero customer apps, instant merchant settlements, and built-in KDS workflows.
          </p>

          {/* Dual Business Portals Showcase Cards */}
          <div id="solutions" className="mt-14 grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto text-left">
            {/* Restaurant Portal Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5 hover:border-red-300 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>Dining &amp; Hospitality</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  MenuGo for Restaurants
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Turn every table into a seamless self-ordering station. Diners scan table QR stickers to browse dishes, place orders, and ping waiters without waiting for physical menus.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Table QR ordering with categories and modifier notes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Realtime Kitchen Display System (KDS) &amp; prep timers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Waiter calling &amp; water refill requests with audible alert</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Staff 4-digit PIN access for POS cashiers &amp; managers</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                <a
                  href={restaurantUrl}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md shadow-red-600/20 transition hover:-translate-y-0.5"
                >
                  <span>Launch Restaurant Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href={`${restaurantUrl}/admin/login?mode=signup`}
                  className="text-xs font-bold text-slate-600 hover:text-red-700 transition"
                >
                  Register Restaurant &rarr;
                </a>
              </div>
            </div>

            {/* Cinema Portal Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5 hover:border-red-300 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                  <Film className="w-6 h-6 text-red-400" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>Multiplex &amp; Theatres</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  MenuGo for Theatres
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Bring concessions straight to moviegoer armrests. Guests scan screen QR codes, select their exact row &amp; seat, pay online, and receive hot popcorn delivered to their seat.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Armrest QR seat selection with row &amp; seat targeting</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Auditorium delivery runner dashboard with printable tickets</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Direct theatre merchant settlements via Razorpay &amp; Paytm</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Terminal-locked staff login for POS &amp; concession counters</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                <a
                  href={cinemaUrl}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md shadow-slate-900/20 transition hover:-translate-y-0.5"
                >
                  <span>Launch Cinema Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href={`${cinemaUrl}/signup`}
                  className="text-xs font-bold text-slate-600 hover:text-red-700 transition"
                >
                  Register Theatre &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Plans & Pricing Section */}
      <section id="pricing" className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Coins className="w-3.5 h-3.5" />
              <span>Transparent SaaS Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
              Subscription Plans for Every Scale
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Predictable pricing designed for independent cafes, full-service fine dining, single screens, and multiplex theatre chains.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="mt-8 inline-flex items-center p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <span>Annual Billing</span>
                <span className="text-[10px] uppercase font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
                  Save ~17%
                </span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPlanFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  planFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Plans
              </button>
              <button
                type="button"
                onClick={() => setPlanFilter('restaurant')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  planFilter === 'restaurant' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <UtensilsCrossed className="w-3 h-3" />
                <span>Restaurant Plans</span>
              </button>
              <button
                type="button"
                onClick={() => setPlanFilter('cinema')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  planFilter === 'cinema' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Film className="w-3 h-3" />
                <span>Cinema Plans</span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          {loadingPlans ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-3" />
              <p className="text-xs font-medium">Loading subscription tiers...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {filteredPlans.map((plan) => {
                const isAnnual = billingCycle === 'annual';
                const pricePaise = isAnnual ? plan.priceAnnualPaise : plan.priceMonthlyPaise;
                const priceRupees = Math.round(pricePaise / 100);
                const isCinema = plan.tenantType === 'cinema';

                return (
                  <div
                    key={plan.id}
                    className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all ${
                      plan.isPopular
                        ? 'bg-slate-900 text-white ring-2 ring-red-500 shadow-2xl relative'
                        : 'bg-white text-slate-900 border border-slate-200 shadow-lg shadow-slate-900/5'
                    }`}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                        Most Popular Choice
                      </div>
                    )}

                    <div>
                      {/* Plan Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isCinema
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {isCinema ? 'Cinema & Theatre' : 'Restaurant & Dining'}
                        </span>

                        {plan.maxTables && (
                          <span className={`text-xs font-bold ${plan.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                            Up to {plan.maxTables} Tables
                          </span>
                        )}
                        {plan.maxScreens && (
                          <span className={`text-xs font-bold ${plan.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                            {plan.maxScreens} Screen{plan.maxScreens > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl font-black tracking-tight">{plan.name}</h3>
                      <p className={`mt-2 text-xs leading-relaxed ${plan.isPopular ? 'text-slate-400' : 'text-slate-600'}`}>
                        {plan.description}
                      </p>

                      {/* Price Display */}
                      <div className="mt-6 pb-6 border-b border-slate-200/20 flex items-baseline gap-1.5">
                        <span className="text-4xl font-black">₹{priceRupees.toLocaleString('en-IN')}</span>
                        <span className={`text-xs font-semibold ${plan.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                          / {isAnnual ? 'year' : 'month'}
                        </span>
                      </div>

                      {/* Features List */}
                      <div className="mt-6 space-y-3">
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${plan.isPopular ? 'text-slate-300' : 'text-slate-800'}`}>
                          Included with this plan:
                        </p>
                        <ul className="space-y-2.5 text-xs">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span className={plan.isPopular ? 'text-slate-200' : 'text-slate-700'}>
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="mt-8 pt-4">
                      <a
                        href={
                          isCinema
                            ? `${cinemaUrl}/signup`
                            : `${restaurantUrl}/admin/login?mode=signup`
                        }
                        className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          plan.isPopular
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                        }`}
                      >
                        <span>Select Plan &amp; Register</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Super Admin Teaser Section */}
      <section id="architecture" className="py-16 sm:py-20 bg-slate-950 text-white border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/80 p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>MenuGo Platform Operations</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                MenuGo Super Administrator Console
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                Platform management for MenuGo operators. Monitor registered dining restaurants and movie multiplexes, view aggregated platform GMV and order throughput, toggle venue statuses, and manage tier pricing.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/super-admin/login"
                className="px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition"
              >
                <span>Enter Super Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-sm">
              M
            </div>
            <span className="font-extrabold text-slate-900">MenuGo Platform</span>
            <span>• Contactless operations for restaurants and cinemas</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href={restaurantUrl} className="hover:text-red-600 transition">Restaurant App</a>
            <a href={cinemaUrl} className="hover:text-red-600 transition">Cinema App</a>
            <Link href="/super-admin" className="hover:text-red-600 transition font-semibold text-slate-800">Super Admin</Link>
            <span className="text-slate-400">&copy; {new Date().getFullYear()} MenuGo Technologies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
