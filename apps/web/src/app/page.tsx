'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  QrCode,
  ChefHat,
  ArrowRight,
  Smartphone,
  Sparkles,
  Clock,
  CheckCircle2,
  HeartHandshake,
  Compass,
  ShoppingBag,
  Flame,
  Check,
  Store,
  KeyRound,
  Eye,
  ShieldCheck,
  Film,
  Clapperboard,
  Tv,
  Armchair,
  Popcorn,
  CreditCard,
  CalendarDays,
  Ticket,
  Building2,
  UtensilsCrossed,
  Utensils,
  Coffee,
  Layers,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function HomePage() {
  // Active business view: 'restaurant' (Option A) | 'cinema' (Option B)
  const [activeBusiness, setActiveBusiness] = useState<'restaurant' | 'cinema'>('restaurant');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-orange-500 selection:text-white">
      {/* =========================================================================
          PLATFORM BUSINESS ANNOUNCEMENT BANNER
          ========================================================================= */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">MenuGo Multi-Business Platform:</span>
            <span className="text-slate-400">Supporting Table QR Dining &amp; In-Auditorium Cinema Seat Ordering</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold">
            <button
              onClick={() => setActiveBusiness('restaurant')}
              className={`transition-colors flex items-center gap-1 ${
                activeBusiness === 'restaurant' ? 'text-orange-400 underline underline-offset-4' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UtensilsCrossed className="w-3 h-3" />
              <span>Option A: Restaurants</span>
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setActiveBusiness('cinema')}
              className={`transition-colors flex items-center gap-1 ${
                activeBusiness === 'cinema' ? 'text-indigo-400 underline underline-offset-4' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>Option B: Cinema Theatres</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          NAVIGATION HEADER
          ========================================================================= */}
      <header className="border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg transition-all group-hover:scale-105 ${
              activeBusiness === 'cinema'
                ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-indigo-500/25'
                : 'bg-gradient-to-tr from-orange-600 to-amber-500 shadow-orange-500/25'
            }`}>
              {activeBusiness === 'cinema' ? <Film className="w-5 h-5 text-white" /> : 'M'}
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                Menu<span className={activeBusiness === 'cinema' ? 'text-indigo-600' : 'text-orange-600'}>Go</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">
                {activeBusiness === 'cinema' ? 'Cinema Seat Ordering' : 'Smart Table Dining'}
              </span>
            </div>
          </Link>

          {/* Business Model Pill Switcher in Header (Desktop) */}
          <div className="hidden lg:flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveBusiness('restaurant')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeBusiness === 'restaurant'
                  ? 'bg-white text-orange-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-orange-600" />
              <span>Restaurants</span>
            </button>
            <button
              onClick={() => setActiveBusiness('cinema')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeBusiness === 'cinema'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Cinema Theatres</span>
              <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider font-extrabold">
                New
              </span>
            </button>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a
              href="#business-selection"
              className="hover:text-orange-600 transition-colors"
            >
              Business Models
            </a>
            <a
              href="#how-it-works"
              className="hover:text-orange-600 transition-colors"
            >
              How It Works
            </a>
            <a
              href="#features"
              className="hover:text-orange-600 transition-colors"
            >
              Features
            </a>
            <Link
              href="/menu/demo-cafe"
              className="hover:text-orange-600 flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-4 h-4 text-orange-500" />
              <span>Live Demo</span>
            </Link>
          </nav>

          {/* Actions & Login */}
          <div className="flex items-center gap-2 sm:gap-3">
            {activeBusiness === 'restaurant' ? (
              <Link
                href="/staff/login"
                className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-orange-600 bg-slate-50 hover:bg-orange-50/80 border border-slate-200/80 px-3 py-2 rounded-xl transition-all"
                title="Fast 4-digit PIN workstation login"
              >
                <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                <span>Staff PIN</span>
              </Link>
            ) : (
              <Link
                href="/cinema/onboarding"
                className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-3 py-2 rounded-xl transition-all"
              >
                <Film className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cinema Setup</span>
              </Link>
            )}

            <Link
              href={
                activeBusiness === 'cinema'
                  ? '/admin/login?business=cinema&redirect=/cinema/onboarding'
                  : '/admin/login'
              }
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 px-2.5 sm:px-3.5 py-2 transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>

            <Link
              href={
                activeBusiness === 'cinema'
                  ? '/cinema/onboarding'
                  : '/admin/login?mode=signup&business=restaurant'
              }
              className={`text-xs sm:text-sm font-bold text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-md hover:-translate-y-0.5 whitespace-nowrap ${
                activeBusiness === 'cinema'
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-indigo-600/20'
                  : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 shadow-orange-600/20'
              }`}
            >
              {activeBusiness === 'cinema' ? 'Register Cinema' : 'Get Started'}
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-xl px-4 py-5 space-y-4 shadow-xl animate-in slide-in-from-top-2 duration-150">
            {/* Business Toggle for Mobile */}
            <div className="p-1 bg-slate-100 rounded-2xl border border-slate-200 grid grid-cols-2 gap-1">
              <button
                onClick={() => {
                  setActiveBusiness('restaurant');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeBusiness === 'restaurant'
                    ? 'bg-white text-orange-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-orange-600" />
                <span>Restaurants</span>
              </button>
              <button
                onClick={() => {
                  setActiveBusiness('cinema');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeBusiness === 'cinema'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Cinema</span>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1 pt-1">
              <a
                href="#business-selection"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Business Models
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                How It Works
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Platform Features
              </a>
              <Link
                href="/menu/demo-cafe"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-orange-600 hover:bg-orange-50 transition"
              >
                <Eye className="w-4 h-4" />
                <span>View Live Demo</span>
              </Link>
            </div>

            {/* Quick Setup Link for Mobile */}
            <div className="pt-2 border-t border-slate-100">
              {activeBusiness === 'restaurant' ? (
                <Link
                  href="/staff/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                >
                  <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                  <span>Staff Workstation PIN Login</span>
                </Link>
              ) : (
                <Link
                  href="/cinema/onboarding"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700"
                >
                  <Film className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Register Cinema Theatre</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* =========================================================================
            SECTION 3 COMPLIANCE: BUSINESS SELECTION CARDS (Option A vs Option B)
            ========================================================================= */}
        <section
          id="business-selection"
          className="pt-10 pb-8 bg-slate-50 border-b border-slate-200/80"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/80 text-slate-800 text-xs font-black uppercase tracking-wider mb-3">
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                <span>MenuGo Operating Platforms</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
                Choose Your Business Model
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">
                One multi-tenant cloud SaaS foundation with dedicated operational workflows for Restaurants and Cinema Theatres.
              </p>
            </div>

            {/* Side-by-Side Dual Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Option A: Restaurants Card */}
              <div
                className={`relative rounded-3xl p-6 sm:p-8 transition-all border-2 flex flex-col justify-between ${
                  activeBusiness === 'restaurant'
                    ? 'bg-white border-orange-500 shadow-xl shadow-orange-500/10 ring-2 ring-orange-500/20'
                    : 'bg-white/80 border-slate-200 hover:border-orange-300 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-800 text-xs font-black uppercase tracking-wider border border-orange-200">
                      Option A • Restaurants
                    </span>
                    {activeBusiness === 'restaurant' && (
                      <span className="text-[11px] font-bold text-orange-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active View
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-2xl shadow-sm">
                      <UtensilsCrossed className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">
                        Restaurants &amp; Dining
                      </h3>
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mt-0.5">
                        Table-Based QR Ordering
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Designed for dine-in restaurants, cafés, and food courts. Customers scan table QR stickers to browse the visual menu, customize orders, and dine at their own pace without waiting for staff.
                  </p>

                  <ul className="space-y-2.5 text-xs text-slate-700 font-medium mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Table-specific QR codes with zero app downloads</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Instant Kitchen Display System (KDS) order stream</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Fast 4-digit staff PIN terminal &amp; service passes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Preserves human hospitality and elevates table turnover</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <Link
                      href="/admin/login?mode=signup&business=restaurant"
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs text-center transition-all shadow-md shadow-orange-600/20"
                    >
                      Get Started with Restaurant
                    </Link>
                    <Link
                      href="/menu/demo-cafe"
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-orange-600" />
                      <span>Live Demo</span>
                    </Link>
                  </div>
                  <button
                    onClick={() => setActiveBusiness('restaurant')}
                    className="w-full text-center py-2 text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center justify-center gap-1"
                  >
                    <span>View Restaurant Showcase Below</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Option B: Cinema Theatres Card */}
              <div
                className={`relative rounded-3xl p-6 sm:p-8 transition-all border-2 flex flex-col justify-between ${
                  activeBusiness === 'cinema'
                    ? 'bg-slate-900 border-indigo-500 shadow-xl shadow-indigo-950 ring-2 ring-indigo-500/20 text-white'
                    : 'bg-slate-900/95 border-slate-800 text-white hover:border-indigo-400/80 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 text-xs font-black uppercase tracking-wider border border-indigo-800">
                      Option B • Cinema Theatres
                    </span>
                    {activeBusiness === 'cinema' ? (
                      <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active View
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-indigo-900/70 px-2.5 py-0.5 rounded-full">
                        New Module
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center font-bold text-2xl shadow-sm">
                      <Film className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">
                        Cinema Theatres
                      </h3>
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-0.5">
                        In-Auditorium Seat Ordering
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    Designed for movie theatres and multiplexes. Customers scan screen QR codes, select their screen, showtime, row and seat, pay online via Razorpay or Paytm, and receive food delivered right to their cinema seat.
                  </p>

                  <ul className="space-y-2.5 text-xs text-slate-300 font-medium mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Multi-screen layout with row &amp; seat configuration (A1..Z25)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Daily movie show schedules with food ordering windows</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Direct payment processing to theatre Razorpay or Paytm accounts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Auditorium delivery runner dashboard with screen &amp; seat tickets</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <Link
                      href="/cinema/onboarding"
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs text-center transition-all shadow-md shadow-indigo-600/30"
                    >
                      Register Cinema Theatre
                    </Link>
                    <Link
                      href="/admin/login?business=cinema&redirect=/cinema/onboarding"
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <Film className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Cinema Sign In</span>
                    </Link>
                  </div>
                  <button
                    onClick={() => setActiveBusiness('cinema')}
                    className="w-full text-center py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1"
                  >
                    <span>View Cinema Showcase Below</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            DYNAMIC SHOWCASE: RESTAURANT (OPTION A) VS CINEMA THEATRE (OPTION B)
            ========================================================================= */}
        {activeBusiness === 'restaurant' ? (
          /* =========================================================================
              RESTAURANT VIEW (OPTION A)
              ========================================================================= */
          <div id="restaurant-view">
            {/* HERO SECTION: RESTAURANT */}
            <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-orange-50/40 via-white to-slate-50/50 border-b border-slate-100">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-4xl mx-auto">
                  {/* Product Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100/70 border border-orange-200 text-orange-800 text-xs sm:text-sm font-bold mb-6 shadow-xs">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <span>Option A • MenuGo Restaurant Dining</span>
                  </div>

                  {/* Tagline & Main Heading */}
                  <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-orange-600 mb-3">
                    Your Table. Your Time. Your Order.
                  </p>
                  <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-[1.1] mb-6">
                    A better way to dine.{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
                      A smarter way to serve.
                    </span>
                  </h1>

                  {/* Lead Description */}
                  <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
                    Give your customers the freedom to explore your menu, take their time and order whenever they&apos;re ready. Give your restaurant a simpler way to receive and manage table orders.
                  </p>

                  {/* Zero-Friction Pill Tagline */}
                  <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-2 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-2xl mx-auto mb-10 text-xs sm:text-sm font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-xl">
                      <Check className="w-4 h-4 text-emerald-600" />
                      No app downloads
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-xl">
                      <Check className="w-4 h-4 text-emerald-600" />
                      No customer registration
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-900 rounded-xl font-bold">
                      <Sparkles className="w-4 h-4 text-orange-600" />
                      Just scan, explore and order
                    </span>
                  </div>

                  {/* Primary Call-to-Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href="/admin/login?mode=signup&business=restaurant"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-orange-600/25 transition-all hover:-translate-y-0.5"
                    >
                      <span>Get Started with Restaurant</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <a
                      href="#how-it-works"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-base font-bold px-8 py-4 rounded-xl shadow-xs transition-all hover:border-slate-400"
                    >
                      <span>See How It Works</span>
                    </a>
                  </div>
                </div>

                {/* Interactive Visual Graphic: From Diner Phone to Kitchen Screen */}
                <div className="mt-16 sm:mt-20 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Left: Customer Mobile View */}
                  <div className="md:col-span-5 bg-gradient-to-b from-slate-900 to-slate-950 p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-800 text-white">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-semibold text-slate-300">Table T-04 • Diner View</span>
                      </div>
                      <span className="text-[11px] font-bold text-orange-400 bg-orange-950/80 px-2.5 py-0.5 rounded-full border border-orange-800/60">
                        No App Needed
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* Dish Mockup 1 */}
                      <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center text-lg shadow">
                            <UtensilsCrossed className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-xs border border-emerald-500 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              </span>
                              <span className="font-bold text-sm text-slate-100">Butter Chicken Masala</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">₹340 • Rich cashew gravy</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-orange-600 text-white px-2.5 py-1.5 rounded-lg shadow-xs">
                          1 Added
                        </span>
                      </div>

                      {/* Dish Mockup 2 */}
                      <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-lg shadow">
                            <Utensils className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-xs border border-emerald-500 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              </span>
                              <span className="font-bold text-sm text-slate-100">Garlic Butter Naan</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">₹65 • Clay oven baked</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-orange-600 text-white px-2.5 py-1.5 rounded-lg shadow-xs">
                          2 Added
                        </span>
                      </div>

                      {/* Floating Cart Bar */}
                      <div className="p-3 bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl flex items-center justify-between text-xs font-bold shadow-lg shadow-orange-600/30">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4" />
                          <span>3 Items • ₹470</span>
                        </div>
                        <span className="bg-white text-orange-600 px-3 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Order Placed</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Zero Latency Bridge Arrow */}
                  <div className="md:col-span-2 flex flex-col items-center justify-center text-center py-2">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-md mb-2">
                      <Flame className="w-6 h-6 animate-bounce" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Instant 0ms
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">WebSockets</span>
                  </div>

                  {/* Right: Kitchen Workstation View */}
                  <div className="md:col-span-5 bg-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-200">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-orange-600" />
                        <span className="font-extrabold text-slate-900">Kitchen Display (KDS)</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Live Stream
                      </span>
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-900">#104</span>
                          <span className="text-xs font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                            Table T-04
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Just now
                        </span>
                      </div>

                      <ul className="text-xs text-slate-700 space-y-1 font-medium mb-3">
                        <li>• 1x Butter Chicken Masala</li>
                        <li>• 2x Garlic Butter Naan <span className="text-orange-700 font-semibold">(Crispy)</span></li>
                      </ul>

                      <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                        <span className="text-xs font-bold text-white bg-slate-900 px-3 py-1.5 rounded-lg flex-1 text-center">
                          Preparing
                        </span>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg flex-1 text-center">
                          Mark Ready →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION: DINING SHOULD HAPPEN AT YOUR PACE */}
            <section id="dining-experience" className="py-20 sm:py-28 bg-white border-b border-slate-100">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto text-center mb-16">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 px-3.5 py-1.5 rounded-full border border-orange-200/80">
                    The Diner&apos;s Perspective
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-6">
                    Dining should happen at your pace.
                  </h2>
                  <p className="text-lg sm:text-xl font-medium text-slate-800 mb-6 italic">
                    &ldquo;Ever felt rushed while deciding what to eat because a waiter was waiting beside your table?&rdquo;
                  </p>
                  <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6">
                    With MenuGo, those days are optional. Scan the QR code, browse the complete menu, explore dishes, compare prices and decide at your own pace.
                  </p>
                  <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8">
                    No pressure. No unnecessary waiting. Just a better dining experience.
                  </p>
                  <div className="inline-block px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-sm sm:text-base tracking-wide shadow-md">
                    Your table. Your time. Your choice.
                  </div>
                </div>

                {/* 3 Experience Highlight Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                  <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-lg hover:border-orange-200 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xl mb-6 shadow-xs">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Browse Without Pressure</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Take all the time you need to study dish ingredients, spice levels, and dietary tags without anyone hovering over your conversation.
                    </p>
                  </div>

                  <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-lg hover:border-orange-200 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xl mb-6 shadow-xs">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Full Visual Clarity</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      View clear dish photos, authoritative pricing in rupees, and customize instructions directly from the convenience of your smartphone.
                    </p>
                  </div>

                  <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-lg hover:border-orange-200 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl mb-6 shadow-xs">
                      <HeartHandshake className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Human Touch Preserved</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Order when you&apos;re ready, or easily ask your server for personal recommendations whenever you desire warm hospitality.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION: 5-STEP TABLE ORDERING FLOW */}
            <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto text-center mb-16">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-orange-100/70 px-3.5 py-1.5 rounded-full border border-orange-200">
                    The 5-Step Ordering Flow
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-4">
                    From your table to the kitchen. Seamlessly.
                  </h2>
                  <p className="text-base sm:text-lg text-slate-600">
                    Every table becomes an effortless, self-sufficient ordering station in seconds.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                        1
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <QrCode className="w-5 h-5 text-orange-600" />
                        <h3 className="text-xl font-black text-slate-900">Scan.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Scan the table&apos;s QR code to instantly open the restaurant menu.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      No App Install
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                        2
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Compass className="w-5 h-5 text-orange-600" />
                        <h3 className="text-xl font-black text-slate-900">Explore.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Browse categories, discover dishes, view prices and add your favourites.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Rich Photos &amp; Tags
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                        3
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag className="w-5 h-5 text-orange-600" />
                        <h3 className="text-xl font-black text-slate-900">Order.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Place your order whenever you&apos;re ready. No app installation or account required.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      1-Click Checkout
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                        4
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <ChefHat className="w-5 h-5 text-orange-600" />
                        <h3 className="text-xl font-black text-slate-900">Prepare.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Your order reaches the restaurant&apos;s kitchen display system in real time.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Real-time KDS Ticket
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                        5
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-orange-600" />
                        <h3 className="text-xl font-black text-slate-900">Enjoy.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Relax while your food is prepared and served directly to your table.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Live Status Tracking
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION: BUILT FOR RESTAURANTS */}
            <section id="features" className="py-20 sm:py-28 bg-white border-b border-slate-100">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto text-center mb-16">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 px-3.5 py-1.5 rounded-full border border-orange-200">
                    Mutual Value
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-4">
                    Built for restaurants. Designed for people.
                  </h2>
                  <p className="text-base sm:text-lg text-slate-600">
                    A purpose-built platform that delights diners while boosting kitchen throughput and order accuracy.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                  <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-black uppercase tracking-wider mb-6">
                        Customer Experience
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">
                        For your customers
                      </h3>
                      <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-700 font-medium">
                            Browse without feeling rushed.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-700 font-medium">
                            Discover dishes with clear descriptions and images.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-700 font-medium">
                            Order at their convenience.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-700 font-medium">
                            Get assistance whenever they need it.
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-200/80 text-xs font-semibold text-slate-500">
                      Zero learning curve for guests of any age.
                    </div>
                  </div>

                  <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/30 border border-orange-500/40 text-orange-400 text-xs font-black uppercase tracking-wider mb-6">
                        Restaurant Operator
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white mb-6">
                        For your restaurant
                      </h3>
                      <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-200 font-medium">
                            Receive clear digital table orders.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-200 font-medium">
                            Reduce verbal ordering mistakes.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-200 font-medium">
                            Manage incoming orders and kitchen preparation.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-200 font-medium">
                            Keep track of order progress.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-base text-slate-200 font-medium">
                            Maintain the personal service your customers value.
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-800 text-xs font-semibold text-slate-400">
                      Operate with full kitchen pass or floor service pass.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* =========================================================================
              CINEMA THEATRE VIEW (OPTION B)
              ========================================================================= */
          <div id="cinema-view">
            {/* HERO SECTION: CINEMA THEATRES */}
            <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-900 text-white border-b border-indigo-900/50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-4xl mx-auto">
                  {/* Product Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-900/70 border border-indigo-700/80 text-indigo-300 text-xs sm:text-sm font-bold mb-6 shadow-xs">
                    <Film className="w-4 h-4 text-indigo-400" />
                    <span>Option B • MenuGo Cinema Theatre Ordering</span>
                  </div>

                  {/* Tagline & Main Heading */}
                  <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-indigo-400 mb-3">
                    Screen • Showtime • Seat Delivery
                  </p>
                  <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1] mb-6">
                    In-auditorium seat ordering.{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-300">
                      Delivered to your row &amp; seat.
                    </span>
                  </h1>

                  {/* Lead Description */}
                  <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
                    Allow moviegoers to order popcorn, drinks, and snacks straight to their seat. Powered by screen-level QR codes, daily movie show schedules, and theatre-owned Razorpay &amp; Paytm accounts.
                  </p>

                  {/* Zero-Friction Pill Tagline */}
                  <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-2 bg-slate-900/80 rounded-2xl border border-indigo-900/80 shadow-xs max-w-2xl mx-auto mb-10 text-xs sm:text-sm font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-xl">
                      <Check className="w-4 h-4 text-emerald-400" />
                      No app download required
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-xl">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Direct theatre gateway
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-950 text-indigo-200 rounded-xl font-bold border border-indigo-800">
                      <Armchair className="w-4 h-4 text-indigo-400" />
                      Row &amp; Seat Level Delivery
                    </span>
                  </div>

                  {/* Primary Call-to-Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href="/cinema/onboarding"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5"
                    >
                      <span>Register Your Cinema Theatre</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <a
                      href="#cinema-ordering-flow"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-base font-bold px-8 py-4 rounded-xl shadow-xs transition-all"
                    >
                      <span>View Cinema Flow</span>
                    </a>
                  </div>
                </div>

                {/* Interactive Visual Graphic: Cinema Seat Ordering to Delivery Runner */}
                <div className="mt-16 sm:mt-20 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Left: Customer Seat Ordering Mobile View */}
                  <div className="md:col-span-5 bg-gradient-to-b from-slate-900 to-black p-4 sm:p-5 rounded-3xl shadow-2xl border border-indigo-900/60 text-white">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-semibold text-slate-200">Screen 2 • Row F • Seat 12</span>
                      </div>
                      <span className="text-[11px] font-bold text-indigo-300 bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-800">
                        Movie: Interstellar
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* Movie Show Context */}
                      <div className="p-2.5 rounded-xl bg-indigo-950/50 border border-indigo-900/60 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Showtime: <strong className="text-white">6:30 PM Show</strong></span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Ordering Open</span>
                        </span>
                      </div>

                      {/* Item 1: Popcorn */}
                      <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-xl shadow">
                            <Popcorn className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-100">Caramel Popcorn (L)</span>
                            <p className="text-xs text-slate-400 mt-0.5">₹290 • Fresh hot butter</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg shadow-xs">
                          1 Added
                        </span>
                      </div>

                      {/* Item 2: Beverages */}
                      <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-rose-800 flex items-center justify-center text-xl shadow">
                            <Coffee className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-100">Cold Beverage Duo</span>
                            <p className="text-xs text-slate-400 mt-0.5">₹180 • 2x Chilled Coke</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg shadow-xs">
                          2 Added
                        </span>
                      </div>

                      {/* Floating Payment Confirmed Bar */}
                      <div className="p-3 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-between text-xs font-bold shadow-lg shadow-indigo-600/30">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          <span>Razorpay/Paytm Paid: ₹470</span>
                        </div>
                        <span className="bg-white text-indigo-900 px-3 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3 h-3 text-indigo-600" />
                          <span>Paid &amp; Sent</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Cinema Seat Dispatch */}
                  <div className="md:col-span-2 flex flex-col items-center justify-center text-center py-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center shadow-md mb-2">
                      <Armchair className="w-6 h-6 animate-pulse" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                      Seat Dispatch
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">Row F • Seat 12</span>
                  </div>

                  {/* Right: Kitchen & Delivery Runner View */}
                  <div className="md:col-span-5 bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-800 text-white">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-indigo-400" />
                        <span className="font-extrabold text-white">Auditorium Delivery Ticket</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800">
                        Paid Order #1042
                      </span>
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-indigo-900/60">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white">Screen 2</span>
                          <span className="text-xs font-bold bg-indigo-900 text-indigo-200 px-2 py-0.5 rounded-md">
                            Row F • Seat 12
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          6:30 PM Show
                        </span>
                      </div>

                      <ul className="text-xs text-slate-300 space-y-1 font-medium mb-3">
                        <li>• 1x Caramel Popcorn (L)</li>
                        <li>• 2x Cold Beverage Duo</li>
                      </ul>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <span className="text-xs font-bold text-white bg-indigo-950 border border-indigo-800 px-3 py-1.5 rounded-lg flex-1 text-center">
                          Ready for Delivery
                        </span>
                        <span className="text-xs font-bold text-emerald-300 bg-emerald-950 border border-emerald-800 px-3 py-1.5 rounded-lg flex-1 text-center flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Mark Delivered</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION: 5-STEP CINEMA ORDERING FLOW (Section 8 of theatremodule.md) */}
            <section id="cinema-ordering-flow" className="py-20 sm:py-28 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto text-center mb-16">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3.5 py-1.5 rounded-full border border-indigo-200">
                    Section 8 • Customer Journey
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-4">
                    The 5-Step In-Auditorium Ordering Experience
                  </h2>
                  <p className="text-base sm:text-lg text-slate-600">
                    No individual seat stickers required. Customers scan a general or screen QR code and select their exact seat.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
                  {/* Step 1 */}
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-indigo-600/20">
                        1
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <QrCode className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-xl font-black text-slate-900">Scan QR.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Customer scans screen or auditorium QR code to open the cinema portal.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      General or Screen QR
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-indigo-600/20">
                        2
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tv className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-xl font-black text-slate-900">Select Screen.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Pick active screen (Screen 1, 2, 3...) or auto-detected from screen QR token.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Multi-Screen Support
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-indigo-600/20">
                        3
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-xl font-black text-slate-900">Showtime.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Fetches published movie shows for today with active food ordering windows.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Live Backend Validation
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-indigo-600/20">
                        4
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Armchair className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-xl font-black text-slate-900">Row &amp; Seat.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Select row and seat number (e.g. Row F, Seat 12) from the configured screen grid.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Exact Seat Verification
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-indigo-600/20">
                        5
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-xl font-black text-slate-900">Pay &amp; Deliver.</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mt-2">
                        Pay online via Razorpay or Paytm. Kitchen prepares and runner delivers to seat.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Direct Merchant Settlement
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION: BUILT FOR CINEMA THEATRES */}
            <section className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto text-center mb-16">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-100 px-3.5 py-1.5 rounded-full border border-indigo-200">
                    Cinema Operator Suite
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-4">
                    Purpose-built for cinemas &amp; multiplexes.
                  </h2>
                  <p className="text-base sm:text-lg text-slate-600">
                    Everything you need to maximize concession sales inside the auditorium without disruption.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                  <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-lg transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl mb-6 shadow-xs">
                      <Tv className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Screen &amp; Seating Layouts</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Configure individual screens, custom row counts, and seat categories (Regular, Premium, Recliner) with zero seat duplication.
                    </p>
                  </div>

                  <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-lg transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xl mb-6 shadow-xs">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Daily Movie Schedules</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Publish daily show schedules with backend overlap prevention, turnaround buffers, and customizable food ordering cutoff windows.
                    </p>
                  </div>

                  <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-lg transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl mb-6 shadow-xs">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Razorpay &amp; Paytm Gateways</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Connect your theatre&apos;s own merchant gateway account. Customer payments settle straight into your cinema bank account.
                    </p>
                  </div>
                </div>

                {/* Cinema CTA Box */}
                <div className="mt-16 max-w-4xl mx-auto p-8 rounded-3xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white text-center shadow-xl border border-indigo-800">
                  <h3 className="text-2xl sm:text-3xl font-black mb-3">
                    Ready to elevate food sales in your theatre?
                  </h3>
                  <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-6">
                    Join forward-thinking cinema operators delivering hot snacks and beverages directly to customer seats.
                  </p>
                  <Link
                    href="/cinema/onboarding"
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-slate-100 text-indigo-900 font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5"
                  >
                    <span>Launch Cinema Setup</span>
                    <ArrowRight className="w-4 h-4 text-indigo-700" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            SECTION: PHILOSOPHY & WORKSTATION SHORTCUTS
            ========================================================================= */}
        <section className="py-20 sm:py-28 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-white relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs sm:text-sm font-bold mb-8">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Multi-Tenant Architecture • High-Throughput WebSockets</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight mb-8">
              Technology should improve operations,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                not complicate them.
              </span>
            </h2>

            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10 font-medium">
              MenuGo gives restaurant tables and cinema auditoriums the power of contactless self-ordering with zero customer app friction.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/admin/login?mode=signup&business=restaurant"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm sm:text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-orange-600/30 transition-all hover:-translate-y-0.5"
              >
                <span>Register Restaurant</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/cinema/onboarding"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm sm:text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5"
              >
                <span>Register Cinema Theatre</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Quick Workstation Access */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-semibold">
              <Link href="/staff/login" className="hover:text-white flex items-center gap-1.5 transition-colors">
                <KeyRound className="w-4 h-4 text-orange-400" />
                <span>Restaurant Staff PIN</span>
              </Link>
              <span>•</span>
              <Link href="/kitchen" className="hover:text-white flex items-center gap-1.5 transition-colors">
                <ChefHat className="w-4 h-4 text-orange-400" />
                <span>Kitchen Display System</span>
              </Link>
              <span>•</span>
              <Link href="/menu/demo-cafe" className="hover:text-white flex items-center gap-1.5 transition-colors">
                <Eye className="w-4 h-4 text-orange-400" />
                <span>Customer Menu Preview</span>
              </Link>
              <span>•</span>
              <Link href="/cinema/onboarding" className="hover:text-white flex items-center gap-1.5 transition-colors">
                <Film className="w-4 h-4 text-indigo-400" />
                <span>Cinema Theatre Onboarding</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="border-t border-slate-200 bg-white text-slate-600 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-100 text-xs">
            {/* Brand Logo & Mission */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-orange-500/20">
                  M
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Menu<span className="text-orange-600">Go</span>
                </span>
              </div>
              <p className="text-slate-500 font-medium leading-relaxed">
                One multi-tenant cloud ordering SaaS platform powering restaurants and cinema theatres across India.
              </p>
            </div>

            {/* Restaurant Links */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-3">
                Option A: Restaurants
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/admin/login?mode=signup&business=restaurant" className="hover:text-orange-600 transition-colors">
                    Register Restaurant
                  </Link>
                </li>
                <li>
                  <Link href="/admin/login" className="hover:text-orange-600 transition-colors">
                    Restaurant Admin Console
                  </Link>
                </li>
                <li>
                  <Link href="/staff/login" className="hover:text-orange-600 transition-colors">
                    Staff PIN Workstation
                  </Link>
                </li>
                <li>
                  <Link href="/menu/demo-cafe" className="hover:text-orange-600 transition-colors">
                    Live Demo Menu
                  </Link>
                </li>
              </ul>
            </div>

            {/* Cinema Links */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-3">
                Option B: Cinema Theatres
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/cinema/onboarding" className="hover:text-indigo-600 transition-colors">
                    Register Cinema Theatre
                  </Link>
                </li>
                <li>
                  <Link href="/admin/login?business=cinema&redirect=/cinema/onboarding" className="hover:text-indigo-600 transition-colors">
                    Cinema Admin Console
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveBusiness('cinema');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-indigo-600 transition-colors text-left"
                  >
                    Cinema In-Seat Ordering Flow
                  </button>
                </li>
                <li>
                  <span className="text-slate-400">Razorpay &amp; Paytm Merchant Gateways</span>
                </li>
              </ul>
            </div>

            {/* Architecture & Compliance */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-3">
                Architecture &amp; Security
              </h4>
              <ul className="space-y-2 text-slate-500">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Strict Tenant Isolation</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Direct Merchant Settlement</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Zod Schema Validation</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Cryptographic QR Tokens</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
            <p>&copy; {new Date().getFullYear()} MenuGo Technologies. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tenant Cloud QR Architecture • Instant WebSockets</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
