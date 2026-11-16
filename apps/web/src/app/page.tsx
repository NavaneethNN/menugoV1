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
  Users,
  BarChart3,
  Layers,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function HomePage() {
  // Active business view: restaurant or cinema
  const [activeBusiness, setActiveBusiness] = useState<'restaurant' | 'cinema'>('restaurant');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-red-500 selection:text-white">
      {/* =========================================================================
          PLATFORM BUSINESS ANNOUNCEMENT BANNER
          ========================================================================= */}
      <div className="bg-red-700 text-red-50 text-xs py-2 px-4 border-b border-red-800">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="font-semibold text-white">MenuGo</span>
            <span className="text-red-100">Ordering and service tools for restaurants and theatres</span>
        </div>
      </div>

      {/* =========================================================================
          NAVIGATION HEADER
          ========================================================================= */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[76px] flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0 min-w-0">
            <div
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center bg-red-600 text-white font-black text-xl sm:text-2xl shadow-lg shadow-red-600/20 transition-all duration-300 group-hover:scale-105 group-hover:rotate-1"
            >
              M
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
                Menu<span className="text-red-600">Go</span>
              </span>
              <span className="hidden sm:flex text-[9px] uppercase font-bold tracking-[0.14em] text-slate-400 mt-1 items-center gap-1 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {activeBusiness === 'cinema' ? 'Cinema Seat Ordering' : 'Smart Table Dining'}
              </span>
            </div>
          </Link>

          {/* Business Model Pill Switcher in Header (Desktop / Tablet) */}
          <div className="hidden xl:flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-xs shrink-0">
            <button
              onClick={() => setActiveBusiness('restaurant')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                activeBusiness === 'restaurant'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-red-600" />
              <span>MenuGo for Restaurants</span>
            </button>
            <button
              onClick={() => setActiveBusiness('cinema')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                activeBusiness === 'cinema'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>MenuGo for Theatres</span>
            </button>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-0.5 text-[13px] font-semibold text-slate-600 whitespace-nowrap">
            <a
              href="#business-selection"
              className="px-2 py-2 rounded-lg hover:text-slate-950 hover:bg-slate-100/80 transition-colors"
            >
              Business Models
            </a>
            <a
              href="#how-it-works"
              className="px-2 py-2 rounded-lg hover:text-slate-950 hover:bg-slate-100/80 transition-colors"
            >
              How It Works
            </a>
            <a
              href="#features"
              className="px-2 py-2 rounded-lg hover:text-slate-950 hover:bg-slate-100/80 transition-colors"
            >
              Features
            </a>
            <Link
              href="/menu/hotel"
              className="px-2 py-2 rounded-lg hover:text-red-600 hover:bg-red-50/60 flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-red-500" />
              <span>Live Demo</span>
            </Link>
          </nav>

          {/* Actions & Login */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href={
                activeBusiness === 'cinema'
                  ? '/admin/login?business=cinema'
                  : '/admin/login'
              }
              className="hidden sm:inline-flex text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100/80 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>

            <Link
              href={
                activeBusiness === 'cinema'
                  ? '/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding'
                  : '/admin/login?mode=signup&business=restaurant'
              }
              className={`hidden sm:flex text-xs sm:text-sm font-bold text-white px-3.5 sm:px-4 py-2.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap items-center gap-1.5 ${
                activeBusiness === 'cinema'
                  ? 'bg-gradient-to-r from-red-600 to-red-600 hover:from-red-500 hover:to-red-500 shadow-red-600/25'
                  : 'bg-gradient-to-r from-red-600 to-red-600 hover:from-red-500 hover:to-red-500 shadow-red-600/25'
              }`}
            >
              <span>{activeBusiness === 'cinema' ? 'Register Cinema' : 'Get Started'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2.5 text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-700" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu & Backdrop */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-16 sm:top-[76px] bg-slate-950/40 backdrop-blur-sm z-40 xl:hidden animate-in fade-in duration-200"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="xl:hidden border-t border-slate-200 bg-white px-4 sm:px-6 py-5 space-y-5 shadow-xl relative z-50 animate-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain">
              {/* Business Toggle for Mobile */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Select Operating Platform
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setActiveBusiness('restaurant');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      activeBusiness === 'restaurant'
                        ? 'bg-red-50/80 border-red-300 text-red-950 shadow-sm ring-1 ring-red-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeBusiness === 'restaurant' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                      </div>
                      {activeBusiness === 'restaurant' && (
                        <span className="w-2 h-2 rounded-full bg-red-600" />
                      )}
                    </div>
                    <div className="font-bold text-xs">MenuGo for Restaurants</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Table QR &amp; KDS</div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveBusiness('cinema');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      activeBusiness === 'cinema'
                        ? 'bg-red-50/80 border-red-300 text-red-950 shadow-sm ring-1 ring-red-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeBusiness === 'cinema' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        <Film className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-bold text-xs">MenuGo for Theatres</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">In-Seat Delivery</div>
                  </button>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                  Explore MenuGo
                </p>
                <a
                  href="#business-selection"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span>Business Models</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>How It Works</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-slate-500" />
                    <span>Platform Features</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <Link
                  href="/menu/hotel"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50/60 hover:bg-red-100/80 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-red-600" />
                    <span>View Live Demo Cafe</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-600" />
                </Link>
              </div>

              {/* Quick Setup Link & Actions for Mobile */}
              <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Access Console &amp; Workstations
                </p>
                {activeBusiness === 'restaurant' ? (
                  <Link
                    href="/staff/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-800 transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-red-600" />
                    <span>Staff 4-Digit PIN Login</span>
                  </Link>
                ) : (
                  <Link
                    href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 transition"
                  >
                    <Film className="w-3.5 h-3.5 text-red-600" />
                    <span>Register Cinema Theatre</span>
                  </Link>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={
                      activeBusiness === 'cinema'
                        ? '/admin/login?business=cinema'
                        : '/admin/login'
                    }
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs text-center hover:bg-slate-200 transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    href={
                      activeBusiness === 'cinema'
                        ? '/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding'
                        : '/admin/login?mode=signup&business=restaurant'
                    }
                    onClick={() => setMobileMenuOpen(false)}
                    className={`py-2.5 rounded-xl font-bold text-xs text-white text-center shadow-md transition ${
                      activeBusiness === 'cinema'
                        ? 'bg-gradient-to-r from-red-600 to-red-600 hover:from-red-500 hover:to-red-500'
                        : 'bg-gradient-to-r from-red-600 to-red-600 hover:from-red-500 hover:to-red-500'
                    }`}
                  >
                    {activeBusiness === 'cinema' ? 'Get Started' : 'Register Free'}
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-white border-b border-slate-200">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-40 left-1/3 w-[38rem] h-[38rem] rounded-full bg-slate-100 blur-3xl" />
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-red-50 blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs sm:text-sm font-extrabold uppercase tracking-wider mb-6">
              <Layers className="w-4 h-4 text-red-600" />
              <span>One platform. Better service.</span>
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-[1.05] mb-6">
              Meet <span className="text-red-600">MenuGo</span>
            </h1>
            <p className="text-lg sm:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
              A simpler way to connect guests, orders and your team — whether you run a restaurant or a theatre.
            </p>
            <p className="text-sm sm:text-base text-slate-500 mt-4 max-w-2xl mx-auto">
              Guests order from their phones. Your staff receives clear, table or seat-aware orders and manages service from one purpose-built platform.
            </p>
          </div>
        </section>
        {/* =========================================================================
            BUSINESS MODEL SELECTION
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
                Choose the MenuGo experience designed around the way your business serves guests.
              </p>
            </div>

            {/* Side-by-Side Dual Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Restaurant card */}
              <div
                className={`relative rounded-3xl p-6 sm:p-8 transition-all border-2 flex flex-col justify-between ${
                  activeBusiness === 'restaurant'
                    ? 'bg-white border-red-500 shadow-xl shadow-red-500/10 ring-2 ring-red-500/20'
                    : 'bg-white/80 border-slate-200 hover:border-red-300 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-2xl shadow-sm">
                      <UtensilsCrossed className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">
                        MenuGo for Restaurants
                      </h3>
                      <p className="text-xs font-bold text-red-600 uppercase tracking-widest mt-0.5">
                        Table-Based QR Ordering
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Designed for dine-in restaurants, cafés, and food courts. Customers scan table QR stickers to browse the visual menu, customize orders, and dine at their own pace without waiting for staff.
                  </p>

                  <ul className="space-y-2.5 text-xs text-slate-700 font-medium mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Table-specific QR codes with zero app downloads</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Instant Kitchen Display System (KDS) order stream</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Fast 4-digit staff PIN terminal &amp; service passes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Preserves human hospitality and elevates table turnover</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <Link
                      href="/admin/login?mode=signup&business=restaurant"
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs text-center transition-all shadow-md shadow-red-600/20"
                    >
                      Get Started with Restaurant
                    </Link>
                    <Link
                      href="/menu/hotel"
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-red-600" />
                      <span>Live Demo</span>
                    </Link>
                  </div>
                  <button
                    onClick={() => setActiveBusiness('restaurant')}
                    className="w-full text-center py-2 text-xs font-bold text-red-600 hover:text-red-700 flex items-center justify-center gap-1"
                  >
                    <span>View Restaurant Showcase Below</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Theatre card */}
              <div
                className={`relative rounded-3xl p-6 sm:p-8 transition-all border-2 flex flex-col justify-between ${
                  activeBusiness === 'cinema'
                    ? 'bg-white border-red-500 shadow-xl shadow-red-900/10 ring-2 ring-red-500/15 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-red-300 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center font-bold text-2xl shadow-sm">
                      <Film className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">
                        MenuGo for Theatres
                      </h3>
                      <p className="text-xs font-bold text-red-600 uppercase tracking-widest mt-0.5">
                        In-Auditorium Seat Ordering
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Designed for movie theatres and multiplexes. Customers scan screen QR codes, select their screen, showtime, row and seat, pay online via Razorpay or Paytm, and receive food delivered right to their cinema seat.
                  </p>

                  <ul className="space-y-2.5 text-xs text-slate-700 font-medium mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Multi-screen layout with row &amp; seat configuration (A1..Z25)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Daily movie show schedules with food ordering windows</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Direct payment processing to theatre Razorpay or Paytm accounts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Auditorium delivery runner dashboard with screen &amp; seat tickets</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <Link
                      href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding"
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-xs text-center transition-all shadow-md shadow-red-600/30"
                    >
                      Register Cinema Theatre
                    </Link>
                    <Link
                      href="/admin/login?business=cinema"
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <Film className="w-3.5 h-3.5 text-red-600" />
                      <span>Cinema Sign In</span>
                    </Link>
                  </div>
                  <button
                    onClick={() => setActiveBusiness('cinema')}
                    className="w-full text-center py-2 text-xs font-bold text-red-700 hover:text-red-800 flex items-center justify-center gap-1"
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
            SELECTED BUSINESS SHOWCASE
            ========================================================================= */}
        {activeBusiness === 'restaurant' ? (
          /* =========================================================================
              RESTAURANT VIEW (OPTION A)
              ========================================================================= */
          <div id="restaurant-view">
            <section className="relative overflow-hidden bg-[#ffffff] border-b border-red-100">
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div className="absolute -top-36 right-[-8rem] w-[34rem] h-[34rem] rounded-full bg-red-200/50 blur-3xl" />
                <div className="absolute bottom-0 left-[-10rem] w-[28rem] h-[28rem] rounded-full bg-red-100/80 blur-3xl" />
              </div>
              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-24 sm:pb-24">
                <div className="grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-16 items-center">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white border border-red-200 px-3.5 py-2 text-xs font-bold text-red-800 shadow-sm mb-7">
                      <UtensilsCrossed className="w-4 h-4 text-red-600" />
                      <span>QR ordering designed for restaurants</span>
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.18em] text-red-700 mb-4">A smoother service, from the first scan to the last plate.</p>
                    <h1 className="text-4xl sm:text-6xl lg:text-[4.25rem] font-black text-slate-950 tracking-tight leading-[1.04] mb-6">
                      Give every table a better way to order.
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                      Let guests explore your menu and order when they are ready. MenuGo sends each table order to your team with the details needed to prepare and serve it.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mb-8">
                      <Link href="/admin/login?mode=signup&business=restaurant" className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5">
                        Set up your restaurant <ArrowRight className="w-4 h-4" />
                      </Link>
                      <Link href="/menu/hotel" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-slate-800 border border-red-200 font-bold px-6 py-3.5 rounded-xl transition-colors">
                        <Eye className="w-4 h-4 text-red-600" /> View live menu
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-600">
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-600" /> No guest app required</span>
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-600" /> Orders tagged to tables</span>
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-600" /> Your staff stays in control</span>
                    </div>
                  </div>

                  <div className="relative max-w-xl w-full mx-auto">
                    <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-red-200/60 to-red-100/40 blur-xl" />
                    <div className="relative bg-white rounded-[1.75rem] border border-red-100 shadow-2xl shadow-red-950/10 p-4 sm:p-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div><p className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-slate-400">A table order, in motion</p><p className="font-extrabold text-slate-900 mt-1">From guest menu to kitchen</p></div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-2.5 py-1 text-[11px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> New order</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 items-center py-5">
                        <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 p-3 sm:p-4 min-h-[190px] shadow-sm">
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-4"><Smartphone className="w-4 h-4 text-red-600" /> Guest menu</div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-2"><div className="flex justify-between text-xs font-bold"><span>Table T-04</span><QrCode className="w-3.5 h-3.5 text-red-600" /></div><p className="text-[10px] text-slate-500 mt-1">Your menu, ready to browse</p></div>
                          <div className="flex items-center gap-2 py-2"><span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><Utensils className="w-4 h-4 text-red-600" /></span><div className="text-[11px]"><p className="font-bold">Butter chicken</p><p className="text-slate-400">₹340 · Qty 1</p></div></div>
                          <div className="mt-2 rounded-lg bg-red-600 text-center text-[11px] font-bold py-2">Add to order · ₹470</div>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-red-500"><ArrowRight className="w-5 h-5" /><span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Sent to team</span><ArrowRight className="w-5 h-5" /></div>
                        <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 p-3 sm:p-4 min-h-[190px] shadow-sm">
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-4"><ChefHat className="w-4 h-4 text-red-600" /> Kitchen display</div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="flex justify-between items-center"><span className="text-xs font-black">Order #104</span><span className="text-[9px] bg-red-50 text-red-700 px-2 py-1 rounded-full font-bold">Preparing</span></div><p className="text-[10px] text-slate-500 mt-3">1 × Butter chicken</p><p className="text-[10px] text-slate-500 mt-1">2 × Garlic naan · Crispy</p><div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-[10px] font-bold"><Store className="w-4 h-4 text-red-600" /> Table T-04</div></div>
                          <div className="mt-2 flex gap-1.5"><span className="flex-1 text-center rounded-lg bg-slate-100 text-slate-700 text-[9px] font-bold py-2">Kitchen pass</span><span className="flex-1 text-center rounded-lg bg-red-600 text-white text-[9px] font-bold py-2">Mark ready</span></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                        <div><p className="text-[10px] text-slate-400 font-semibold">Guest scans</p><p className="text-xs font-extrabold text-slate-800 mt-1">Table QR</p></div><div><p className="text-[10px] text-slate-400 font-semibold">Order arrives</p><p className="text-xs font-extrabold text-slate-800 mt-1">With table ID</p></div><div><p className="text-[10px] text-slate-400 font-semibold">Team prepares</p><p className="text-xs font-extrabold text-slate-800 mt-1">In real time</p></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-red-100 bg-red-100 shadow-sm">
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For each table</p><p className="font-extrabold text-slate-900 mt-1">A unique QR menu</p></div>
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For every guest</p><p className="font-extrabold text-slate-900 mt-1">Easy self ordering</p></div>
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For your kitchen</p><p className="font-extrabold text-slate-900 mt-1">Clear live tickets</p></div>
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For your floor</p><p className="font-extrabold text-slate-900 mt-1">Service stays personal</p></div>
                </div>
              </div>
            </section>

            <section id="how-it-works" className="py-20 sm:py-24 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mb-12"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700 mb-3">A better flow for the whole team</p><h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950">From table QR to a meal served.</h2><p className="text-base sm:text-lg text-slate-600 mt-4">Guests get time to browse. Your team gets accurate orders and a clear view of what needs attention.</p></div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { icon: QrCode, title: 'Scan', body: 'Guests scan the QR code at their table and open your menu in a browser.' },
                    { icon: Compass, title: 'Explore', body: 'They browse categories, photos, descriptions, prices and available options.' },
                    { icon: ShoppingBag, title: 'Order', body: 'They choose items, quantities and special instructions, then place the order.' },
                    { icon: ChefHat, title: 'Prepare', body: 'Orders appear on your kitchen display with the table and item details.' },
                    { icon: Sparkles, title: 'Serve', body: 'Your team updates order progress and brings the meal to the right table.' },
                  ].map((step, index) => {
                    const Icon = step.icon;
                    return <div key={step.title} className="rounded-2xl border border-slate-200 bg-[#ffffff] p-5 sm:p-6"><div className="flex items-center justify-between mb-5"><span className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center text-sm font-black">0{index + 1}</span><Icon className="w-5 h-5 text-red-600" /></div><h3 className="font-extrabold text-slate-900 text-lg mb-2">{step.title}</h3><p className="text-sm text-slate-600 leading-relaxed">{step.body}</p></div>;
                  })}
                </div>
              </div>
            </section>

            <section id="features" className="py-20 sm:py-24 bg-slate-50 border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
                  <div className="lg:sticky lg:top-28"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700 mb-3">The restaurant toolkit</p><h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">More clarity from menu to service.</h2><p className="text-base text-slate-600 leading-relaxed mt-5">Set up your menu and tables, then give front-of-house and kitchen staff a shared view of each order.</p><Link href="/admin/login?mode=signup&business=restaurant" className="mt-7 inline-flex items-center gap-2 font-bold text-red-700 hover:text-red-900">Get your restaurant started <ArrowRight className="w-4 h-4" /></Link></div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { icon: QrCode, title: 'Table QR ordering', body: 'Give each table a direct link to your digital menu and ordering flow.' },
                      { icon: UtensilsCrossed, title: 'Menu management', body: 'Organise categories, products, images, descriptions, prices and availability.' },
                      { icon: ChefHat, title: 'Kitchen display', body: 'Receive orders on a focused screen and move them through preparation.' },
                      { icon: ShoppingBag, title: 'Order management', body: 'Review incoming orders, item details, table numbers and current status.' },
                      { icon: HeartHandshake, title: 'Service requests', body: 'Let guests request assistance while keeping staff available for hospitality.' },
                      { icon: Users, title: 'Staff access', body: 'Give the right team members access to kitchen and floor workflows.' },
                      { icon: Store, title: 'Table management', body: 'Keep table setup and QR access organised for your dining space.' },
                      { icon: BarChart3, title: 'Sales visibility', body: 'Review order activity and sales reports to understand daily operations.' },
                    ].map((feature) => {
                      const Icon = feature.icon;
                      return <article key={feature.title} className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 hover:shadow-md hover:border-red-200 transition-all"><div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center mb-4"><Icon className="w-5 h-5" /></div><h3 className="font-extrabold text-slate-900 mb-2">{feature.title}</h3><p className="text-sm text-slate-600 leading-relaxed">{feature.body}</p></article>;
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="py-20 sm:py-24 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl text-center mx-auto mb-12"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700 mb-3">A guided start</p><h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">Get your restaurant ready to serve.</h2><p className="text-base text-slate-600 mt-4">Set up your business, add your menu and tables, then invite your team to get started.</p></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">{['Restaurant profile', 'Add menu categories', 'Add products & prices', 'Set up your tables', 'Generate table QR codes', 'Invite your team', 'Configure service flow', 'Start taking orders'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl bg-[#ffffff] border border-red-100 p-4"><span className="w-7 h-7 shrink-0 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-xs font-black">{index + 1}</span><span className="text-xs sm:text-sm font-bold text-slate-800">{item}</span></div>)}</div>
                <div className="mt-12 max-w-5xl mx-auto rounded-3xl bg-white border border-red-100 shadow-lg shadow-red-950/5 p-7 sm:p-10 text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-7"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-600 mb-2">Ready for service?</p><h3 className="text-2xl sm:text-3xl font-black">Give every table a simpler way to order.</h3><p className="text-sm sm:text-base text-slate-600 mt-2 max-w-xl">Set up your restaurant on MenuGo and bring menu, orders and kitchen workflow together.</p></div><div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto"><Link href="/admin/login?mode=signup&business=restaurant" className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold px-5 py-3.5 transition-colors">Get started <ArrowRight className="w-4 h-4" /></Link><Link href="/menu/hotel" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-5 py-3.5 transition-colors"><Eye className="w-4 h-4" /> View demo</Link></div></div>
              </div>
            </section>
          </div>
        ) : (
          /* =========================================================================
              CINEMA THEATRE VIEW (OPTION B)
              ========================================================================= */
          <div id="cinema-view">
            {/* Cinema landing page: owner value proposition and operating workflow */}
            <section className="relative overflow-hidden bg-[#ffffff] border-b border-slate-200">
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div className="absolute -top-40 right-[-8rem] w-[34rem] h-[34rem] rounded-full bg-red-100/70 blur-3xl" />
                <div className="absolute bottom-0 left-[-10rem] w-[28rem] h-[28rem] rounded-full bg-red-100/60 blur-3xl" />
              </div>
              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-24 sm:pb-24">
                <div className="grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-16 items-center">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white border border-red-100 px-3.5 py-2 text-xs font-bold text-red-800 shadow-sm mb-7">
                      <Film className="w-4 h-4 text-red-600" />
                      <span>Food ordering, built for cinema operations</span>
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.18em] text-red-700 mb-4">More convenience for guests. More control for your team.</p>
                    <h1 className="text-4xl sm:text-6xl lg:text-[4.25rem] font-black text-slate-950 tracking-tight leading-[1.04] mb-6">
                      Keep the movie going. <span className="text-red-700">Bring the snacks to their seat.</span>
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                      MenuGo connects the whole concession journey: guests order from their phone, your kitchen receives a clear ticket, and your delivery team knows exactly where to go.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mb-8">
                      <Link href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding" className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5">
                        Set up your theatre <ArrowRight className="w-4 h-4" />
                      </Link>
                      <a href="#cinema-ordering-flow" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold px-6 py-3.5 rounded-xl transition-colors">
                        See how it works <ChevronRight className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-600">
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-600" /> No app for guests</span>
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-600" /> Theatre-owned payments</span>
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-600" /> Screen-to-seat delivery</span>
                    </div>
                  </div>

                  {/* A compact product illustration that makes the operating flow tangible */}
                  <div className="relative max-w-xl w-full mx-auto">
                    <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-red-200/60 to-red-100/30 blur-xl" />
                    <div className="relative bg-white rounded-[1.75rem] border border-slate-200 shadow-2xl shadow-red-950/10 p-4 sm:p-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div><p className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-slate-400">Live order journey</p><p className="font-extrabold text-slate-900 mt-1">A simpler concession run</p></div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-2.5 py-1 text-[11px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Order paid</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 items-center py-5">
                        <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 p-3 sm:p-4 min-h-[190px] shadow-sm">
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-4"><Smartphone className="w-4 h-4 text-red-600" /> Guest menu</div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-2"><div className="flex justify-between text-xs font-bold"><span>Screen 2 · 6:30 PM</span><Check className="w-3.5 h-3.5 text-red-600" /></div><p className="text-[10px] text-slate-500 mt-1">Row F · Seat 12</p></div>
                          <div className="flex items-center gap-2 py-2"><span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><Popcorn className="w-4 h-4 text-red-600" /></span><div className="text-[11px]"><p className="font-bold">Classic popcorn</p><p className="text-slate-400">₹220 · Qty 1</p></div></div>
                          <div className="mt-2 rounded-lg bg-red-600 text-center text-[11px] font-bold py-2">Pay ₹220</div>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-red-500"><ArrowRight className="w-5 h-5" /><span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Paid order</span><ArrowRight className="w-5 h-5" /></div>
                        <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 p-3 sm:p-4 min-h-[190px] shadow-sm">
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-4"><ChefHat className="w-4 h-4 text-red-600" /> Team dashboard</div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="flex justify-between items-center"><span className="text-xs font-black">Order #1042</span><span className="text-[9px] bg-red-50 text-red-700 px-2 py-1 rounded-full font-bold">Preparing</span></div><p className="text-[10px] text-slate-500 mt-3">1 × Classic popcorn</p><div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-[10px] font-bold"><Armchair className="w-4 h-4 text-red-600" /> Screen 2 · F12</div></div>
                          <div className="mt-2 flex gap-1.5"><span className="flex-1 text-center rounded-lg bg-slate-100 text-slate-700 text-[9px] font-bold py-2">Kitchen</span><span className="flex-1 text-center rounded-lg bg-red-600 text-white text-[9px] font-bold py-2">Dispatch</span></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                        <div><p className="text-[10px] text-slate-400 font-semibold">Guest scans</p><p className="text-xs font-extrabold text-slate-800 mt-1">QR code</p></div><div><p className="text-[10px] text-slate-400 font-semibold">Order reaches</p><p className="text-xs font-extrabold text-slate-800 mt-1">Your kitchen</p></div><div><p className="text-[10px] text-slate-400 font-semibold">Runner delivers</p><p className="text-xs font-extrabold text-slate-800 mt-1">To the seat</p></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-slate-200 bg-slate-200 shadow-sm">
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For every auditorium</p><p className="font-extrabold text-slate-900 mt-1">Multi-screen ready</p></div>
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For every show</p><p className="font-extrabold text-slate-900 mt-1">Daily scheduling</p></div>
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For every order</p><p className="font-extrabold text-slate-900 mt-1">Kitchen to delivery</p></div>
                  <div className="bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 font-semibold">For your revenue</p><p className="font-extrabold text-slate-900 mt-1">Your gateway account</p></div>
                </div>
              </div>
            </section>

            <section id="cinema-ordering-flow" className="py-20 sm:py-24 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mb-12">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700 mb-3">One connected guest experience</p>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950">From a quick scan to the right seat.</h2>
                  <p className="text-base sm:text-lg text-slate-600 mt-4">Guests order in the browser they already have. Your team gets the show and seat context needed to fulfil each order.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { icon: QrCode, title: 'Scan', body: 'A general or screen QR opens your branded theatre menu. No download or account required.' },
                    { icon: CalendarDays, title: 'Choose a show', body: 'Guests see published shows that are currently accepting food orders.' },
                    { icon: Armchair, title: 'Select a seat', body: 'Pick their screen row and seat from the layout you have configured.' },
                    { icon: ShoppingBag, title: 'Order & pay', body: 'Browse categories, add items and pay securely before the order is confirmed.' },
                    { icon: ChefHat, title: 'Prepare & deliver', body: 'Kitchen staff prepare the ticket; runners deliver it to the listed seat.' },
                  ].map((step, index) => {
                    const Icon = step.icon;
                    return <div key={step.title} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                      <div className="flex items-center justify-between mb-5"><span className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center text-sm font-black">0{index + 1}</span><Icon className="w-5 h-5 text-red-600" /></div>
                      <h3 className="font-extrabold text-slate-900 text-lg mb-2">{step.title}</h3><p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
                    </div>;
                  })}
                </div>
              </div>
            </section>

            <section id="features" className="py-20 sm:py-24 bg-slate-50 border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
                  <div className="lg:sticky lg:top-28">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700 mb-3">The theatre operator toolkit</p>
                    <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">Run concessions with the details in one place.</h2>
                    <p className="text-base text-slate-600 leading-relaxed mt-5">Configure your venue once, then manage the daily rhythm of screens, shows, menu, payments and orders from purpose-built cinema tools.</p>
                    <Link href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding" className="mt-7 inline-flex items-center gap-2 font-bold text-red-700 hover:text-red-900">Start theatre setup <ArrowRight className="w-4 h-4" /></Link>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { icon: Tv, title: 'Screens & seating', body: 'Manage multiple screens, independent rows, different seat counts and optional seat categories.' },
                      { icon: CalendarDays, title: 'Movie scheduling', body: 'Build daily schedules, set food ordering windows, publish shows and avoid screen overlaps.' },
                      { icon: UtensilsCrossed, title: 'Menu & availability', body: 'Organise categories, product images, descriptions, prices, combos and availability.' },
                      { icon: CreditCard, title: 'Theatre-owned payments', body: 'Connect Razorpay or Paytm so customers pay through your theatre merchant account.' },
                      { icon: ChefHat, title: 'Kitchen workflow', body: 'Receive paid orders with clear items and show details; update preparation status for the team.' },
                      { icon: Armchair, title: 'Seat delivery', body: 'Give delivery staff a focused view of screen, row and seat so orders reach the right guest.' },
                      { icon: QrCode, title: 'QR code management', body: 'Generate general or screen-level QR codes. Individual seat stickers are not needed.' },
                      { icon: Building2, title: 'Theatre oversight', body: 'Monitor orders and daily sales, with theatre profile and staff settings in your admin workspace.' },
                    ].map((feature) => {
                      const Icon = feature.icon;
                      return <article key={feature.title} className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 hover:shadow-md hover:border-red-200 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center mb-4"><Icon className="w-5 h-5" /></div>
                        <h3 className="font-extrabold text-slate-900 mb-2">{feature.title}</h3><p className="text-sm text-slate-600 leading-relaxed">{feature.body}</p>
                      </article>;
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="py-20 sm:py-24 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl text-center mx-auto mb-12"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700 mb-3">A guided start</p><h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">Set up your theatre, step by step.</h2><p className="text-base text-slate-600 mt-4">Get your operation ready for orders with a clear path from venue details to launch.</p></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
                  {['Theatre profile', 'Add screens', 'Configure seating', 'Build food menu', 'Connect payments', 'Schedule movies', 'Print QR codes', 'Activate ordering'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4"><span className="w-7 h-7 shrink-0 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-black">{index + 1}</span><span className="text-xs sm:text-sm font-bold text-slate-800">{item}</span></div>)}
                </div>
                <div className="mt-12 max-w-5xl mx-auto rounded-3xl bg-white border border-red-100 shadow-lg shadow-red-950/5 p-7 sm:p-10 text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-7">
                  <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-600 mb-2">Ready for your next show?</p><h3 className="text-2xl sm:text-3xl font-black">Make every seat an ordering point.</h3><p className="text-sm sm:text-base text-slate-600 mt-2 max-w-xl">Set up MenuGo for your theatre and give guests an easy way to order without leaving the movie.</p></div>
                  <Link href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding" className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white hover:bg-red-700 font-extrabold px-5 py-3.5 transition-colors">Register your theatre <ArrowRight className="w-4 h-4" /></Link>
                </div>
              </div>
            </section>
          </div>
        )}
        {/* =========================================================================
            SECTION: PHILOSOPHY & WORKSTATION SHORTCUTS
            ========================================================================= */}
        <section className="py-20 sm:py-28 bg-white text-slate-900 relative overflow-hidden border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-100 text-red-800 text-xs sm:text-sm font-bold mb-8">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>Multi-Tenant Architecture • High-Throughput WebSockets</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight max-w-4xl mx-auto leading-tight mb-8">
              Technology should improve operations,{' '}
              <span className="text-red-600">
                not complicate them.
              </span>
            </h2>

            <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10 font-medium">
              MenuGo gives restaurant tables and cinema auditoriums the power of contactless self-ordering with zero customer app friction.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/admin/login?mode=signup&business=restaurant"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5"
              >
                <span>Register Restaurant</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5"
              >
                <span>Register Cinema Theatre</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Quick Workstation Access */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-semibold">
              <Link href="/staff/login" className="hover:text-red-700 flex items-center gap-1.5 transition-colors">
                <KeyRound className="w-4 h-4 text-red-600" />
                <span>Restaurant Staff PIN</span>
              </Link>
              <span>•</span>
              <Link href="/kitchen" className="hover:text-red-700 flex items-center gap-1.5 transition-colors">
                <ChefHat className="w-4 h-4 text-red-600" />
                <span>Kitchen Display System</span>
              </Link>
              <span>•</span>
              <Link href="/menu/hotel" className="hover:text-red-700 flex items-center gap-1.5 transition-colors">
                <Eye className="w-4 h-4 text-red-600" />
                <span>Customer Menu Preview</span>
              </Link>
              <span>•</span>
              <Link href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding" className="hover:text-red-700 flex items-center gap-1.5 transition-colors">
                <Film className="w-4 h-4 text-red-600" />
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
                <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-red-500/20">
                  M
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Menu<span className="text-red-600">Go</span>
                </span>
              </div>
              <p className="text-slate-500 font-medium leading-relaxed">
                One multi-tenant cloud ordering SaaS platform powering restaurants and cinema theatres across India.
              </p>
            </div>

            {/* Restaurant Links */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-3">
                MenuGo for Restaurants
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/admin/login?mode=signup&business=restaurant" className="hover:text-red-600 transition-colors">
                    Register Restaurant
                  </Link>
                </li>
                <li>
                  <Link href="/admin/login" className="hover:text-red-600 transition-colors">
                    Restaurant Admin Console
                  </Link>
                </li>
                <li>
                  <Link href="/staff/login" className="hover:text-red-600 transition-colors">
                    Staff PIN Workstation
                  </Link>
                </li>
                <li>
                  <Link href="/menu/hotel" className="hover:text-red-600 transition-colors">
                    Live Demo Menu
                  </Link>
                </li>
              </ul>
            </div>

            {/* Cinema Links */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-3">
                MenuGo for Theatres
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding" className="hover:text-red-600 transition-colors">
                    Register Cinema Theatre
                  </Link>
                </li>
                <li>
                  <Link href="/admin/login?business=cinema" className="hover:text-red-600 transition-colors">
                    Cinema Admin Console
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveBusiness('cinema');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-red-600 transition-colors text-left"
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
                  <ShieldCheck className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Strict Tenant Isolation</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Direct Merchant Settlement</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Zod Schema Validation</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Cryptographic QR Tokens</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
            <p>&copy; {new Date().getFullYear()} MenuGo Technologies. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>Multi-Tenant Cloud QR Architecture • Instant WebSockets</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
