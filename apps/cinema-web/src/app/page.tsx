'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Film,
  Tv,
  Armchair,
  ChefHat,
  Truck,
  QrCode,
  CreditCard,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  ExternalLink,
  Sparkles,
  Popcorn,
  Clock,
  Check,
  Smartphone,
  ChevronRight,
  Menu,
  X,
  Layers,
  KeyRound
} from 'lucide-react';
import { HowItWorksSlider } from '@/components/home/HowItWorksSlider';

export default function CinemaHomePage() {
  const mainPlatformUrl = process.env.NEXT_PUBLIC_MAIN_URL || 'http://localhost:3002';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-red-600 selection:text-white">
      {/* Top Announcement Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">MenuGo Theatres:</span>
            <span className="hidden sm:inline text-slate-400">
              In-seat armrest QR ordering, concession kitchen KDS, and stealth runner delivery for movie multiplexes.
            </span>
          </div>
          <a
            href={mainPlatformUrl}
            className="text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px] font-semibold"
          >
            <span>Back to MenuGo Platform</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 text-white font-black text-2xl shadow-lg shadow-slate-900/20 group-hover:scale-105 transition-transform">
              <Film className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                Menu<span className="text-red-600">Go</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 mt-1 flex items-center gap-1">
                <Film className="w-2.5 h-2.5" />
                Theatre Portal
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-red-600 transition">How It Works</a>
            <a href="#features" className="hover:text-red-600 transition">Features</a>
            <a href="#workstations" className="hover:text-red-600 transition">Workstations</a>
            <a href="#roadmap" className="hover:text-red-600 transition">Setup Steps</a>
          </nav>

          {/* Actions & Logins */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href={mainPlatformUrl}
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 rounded-xl transition"
            >
              <span>Platform Home</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <Link
              href="/login"
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 px-3 py-2.5 rounded-xl transition"
            >
              Staff &amp; Admin Login
            </Link>

            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl shadow-md shadow-red-600/20 transition hover:-translate-y-0.5"
            >
              <span>Register Theatre</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-700 hover:text-slate-950 bg-slate-100 rounded-xl transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-5 space-y-4 shadow-xl animate-in slide-in-from-top-2">
            <div className="space-y-1">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span>How It Works</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span>Features</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
              <a
                href="#workstations"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span>Live Workstations</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
              <a
                href="#roadmap"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span>Setup Roadmap</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <a
                href={mainPlatformUrl}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-800"
              >
                <span>Back to MenuGo Platform</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs text-center"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs text-center shadow-md"
                >
                  Register Free
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-100 via-white to-white border-b border-slate-200 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-16 items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm mb-6">
                  <Film className="w-4 h-4 text-red-400" />
                  <span>Multiplex In-Seat Concession Ordering</span>
                </div>

                <h1 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight leading-[1.05] mb-6">
                  Keep the movie going. Deliver snacks <span className="text-red-600">straight to their seat</span>.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8">
                  Guests scan the QR code on their armrest, pick signature popcorn &amp; drinks, and pay online. Kitchen receives live tickets on KDS, and runners deliver directly to their screen, row, and seat.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold px-6 py-3.5 rounded-xl shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5"
                  >
                    <span>Register Theatre Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold px-6 py-3.5 rounded-xl transition"
                  >
                    <span>Enter Management Console</span>
                  </Link>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600" /> Zero moviegoer app downloads
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600" /> Direct merchant settlements
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600" /> Precision seat targeting
                  </span>
                </div>
              </div>

              {/* Interactive Visual Concession Journey */}
              <div className="relative max-w-xl w-full mx-auto">
                <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-slate-300/50 to-red-100/40 blur-xl" />
                <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 sm:p-7">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                        Live Flow Demo
                      </p>
                      <p className="font-extrabold text-slate-900 mt-0.5">Armrest QR &rarr; Runner Delivery</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Paid via UPI
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-6">
                    {/* Guest Phone View */}
                    <div className="rounded-2xl bg-slate-900 text-white border border-slate-800 p-3.5 text-xs shadow-xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 mb-3">
                        <Smartphone className="w-3.5 h-3.5 text-red-400" />
                        <span>Armrest QR Menu</span>
                      </div>
                      <div className="rounded-xl bg-slate-800/90 border border-slate-700 p-2.5 mb-2">
                        <div className="flex justify-between font-bold text-[11px]">
                          <span>Screen 2 &bull; Row F</span>
                          <QrCode className="w-3 h-3 text-red-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Seat 12 Verified</p>
                      </div>
                      <div className="py-1">
                        <p className="font-bold text-white text-xs">Caramel Popcorn Tub</p>
                        <p className="text-[10px] text-slate-400">1 &times; Cold Drink</p>
                      </div>
                      <div className="mt-2 rounded-lg bg-red-600 text-white text-center text-[10px] font-bold py-1.5">
                        Paid &#8377;390
                      </div>
                    </div>

                    {/* Arrow Connection */}
                    <div className="flex flex-col items-center gap-1 text-red-500">
                      <ArrowRight className="w-5 h-5" />
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                        Dispatched
                      </span>
                      <ArrowRight className="w-5 h-5" />
                    </div>

                    {/* Runner Delivery Pass View */}
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-xs shadow-xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-3">
                        <Truck className="w-3.5 h-3.5 text-red-600" />
                        <span>Runner Ticket</span>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-2.5 mb-2">
                        <div className="flex justify-between items-center font-bold text-[11px]">
                          <span>Order #C-1048</span>
                          <span className="text-[9px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                            Ready
                          </span>
                        </div>
                        <p className="text-[10px] text-red-700 font-extrabold mt-1">
                          Auditorium Screen 2 &bull; F12
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-600">Popcorn Tub + Cold Drink</p>
                      <div className="mt-2 rounded-lg bg-emerald-600 text-white text-center text-[10px] font-bold py-1.5">
                        Deliver to Seat
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">1. Armrest Scan</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">Screen &amp; Seat</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">2. Kitchen Prep</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">KDS Ticket</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">3. Stealth Delivery</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">In-Seat Run</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-slate-200 bg-slate-200 shadow-sm">
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">In-Seat Concessions</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">100% Contactless QR</p>
              </div>
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">Auditorium Targeting</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">Exact Screen, Row &amp; Seat</p>
              </div>
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">Direct Payouts</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">Razorpay &amp; Paytm Gateways</p>
              </div>
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">Zero Interval Queue</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">Doubles Concession Revenue</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 sm:py-24 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold uppercase tracking-wider mb-3">
                <Clock className="w-3.5 h-3.5" />
                <span>Operating Flow</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950">
                From Armrest QR to In-Seat Delivery.
              </h2>
              <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
                Moviegoers order and pay without leaving their seat. Kitchen staff prepares snacks with clear screen &amp; seat tickets, and runners deliver without disrupting the movie.
              </p>
            </div>

            <HowItWorksSlider businessType="cinema" />
          </div>
        </section>

        {/* Operational Modules & Workstations Grid */}
        <section id="workstations" className="py-20 sm:py-24 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider mb-3">
                <Tv className="w-3.5 h-3.5" />
                <span>Operational Workstations</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
                Built Specifically for Cinema Teams.
              </h2>
              <p className="text-base text-slate-600 mt-4 leading-relaxed">
                Purpose-built terminals for screen layout administrators, kitchen concession cooks, and auditorium floor runners.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Screen Management Card */}
              <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center">
                  <Tv className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Auditoriums &amp; Screens</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Configure multi-screen auditoriums (Screen 1, Screen 2, Audi 3). Define rows (A..Z) and seat numbers, and batch-print armrest QR stickers.
                </p>
                <div className="pt-2">
                  <Link
                    href="/admin/screens"
                    className="text-xs font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1.5"
                  >
                    <span>Manage Screens &amp; Seats</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Kitchen KDS Card */}
              <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Concession Kitchen KDS</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Live Kitchen Display System with prep timers, acoustic order alerts, and prominent Screen, Row, and Seat destination badges for packing.
                </p>
                <div className="pt-2">
                  <Link
                    href="/kitchen"
                    className="text-xs font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1.5"
                  >
                    <span>Open Kitchen Display</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Runner Dispatch Card */}
              <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Seat Delivery Runner</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Mobile-optimized runner dispatch interface for floor runners to deliver packaged popcorn &amp; drinks directly to moviegoers inside auditoriums.
                </p>
                <div className="pt-2">
                  <Link
                    href="/delivery"
                    className="text-xs font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1.5"
                  >
                    <span>Open Runner Dispatch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid Section */}
        <section id="features" className="py-20 sm:py-24 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
              <div className="lg:sticky lg:top-28">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-red-600" />
                  <span>Multiplex Capabilities</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
                  High-Volume Concessions, Zero Chaos.
                </h2>
                <p className="text-base text-slate-600 leading-relaxed mt-5">
                  Designed for the fast-paced rush of cinema intervals and continuous screenings. Keeps cashiers, cooks, and runners in continuous sync.
                </p>
                <div className="mt-8 space-y-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 font-extrabold text-sm text-red-600 hover:text-red-700"
                  >
                    <span>Register your theatre</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Armchair,
                    title: 'Armrest QR In-Seat Ordering',
                    body: 'Seat-level QR stickers let moviegoers browse and purchase snacks without leaving their recliner.'
                  },
                  {
                    icon: Popcorn,
                    title: 'Concession Combos & Sizing',
                    body: 'Configure popcorn tubs, soda cups, nachos, dips, and combo deals with clear pricing.'
                  },
                  {
                    icon: CreditCard,
                    title: 'Direct Merchant Gateways',
                    body: 'Connect your theatre Razorpay or Paytm account for direct, automated settlements to your bank.'
                  },
                  {
                    icon: Tv,
                    title: 'Screen & Row Layouts',
                    body: 'Flexible seating setup supporting regular seats, VIP recliners, and balcony sections.'
                  },
                  {
                    icon: Truck,
                    title: 'Stealth Runner Delivery',
                    body: 'Auditorium runners get clear seat navigation slips for silent, prompt food delivery.'
                  },
                  {
                    icon: ChefHat,
                    title: 'Concession Kitchen KDS',
                    body: 'High-visibility kitchen display screen showing prep tickets, timer countdowns, and sound chimes.'
                  },
                  {
                    icon: Users,
                    title: 'Staff Workstation Access',
                    body: 'Role-based access for kitchen staff, floor delivery runners, and theatre general managers.'
                  },
                  {
                    icon: BarChart3,
                    title: 'Auditorium & Sales Reports',
                    body: 'Review gross concession revenue, per-screen ordering performance, and best-selling snack combos.'
                  }
                ].map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <article
                      key={feature.title}
                      className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-red-200 transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base mb-2">{feature.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{feature.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Setup Roadmap Section */}
        <section id="roadmap" className="py-20 sm:py-24 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl text-center mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider mb-3">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Streamlined Onboarding</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
                Simple Setup. No Complex Scheduling.
              </h2>
              <p className="text-base text-slate-600 mt-4 leading-relaxed">
                Add your screens, configure rows and seats, upload your concession menu, connect your payment gateway, and print armrest QR codes.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {[
                { step: 1, title: 'Theatre Profile', desc: 'Name, address & branding' },
                { step: 2, title: 'Add Screens', desc: 'Screen 1, Screen 2, Audi 3' },
                { step: 3, title: 'Auditorium Seating', desc: 'Rows & seat numbers (A1..Z25)' },
                { step: 4, title: 'Concession Menu', desc: 'Popcorn, drinks & combos' },
                { step: 5, title: 'Payment Gateway', desc: 'Razorpay / Paytm integration' },
                { step: 6, title: 'Armrest QR Codes', desc: 'Download print-ready stickers' }
              ].map((item) => (
                <div key={item.step} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-black">
                      {item.step}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 pl-10">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA Banner */}
            <div className="mt-12 max-w-5xl mx-auto rounded-3xl bg-slate-950 text-white p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-red-400 mb-2">
                  Transform Your Theatre Concessions
                </p>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Launch In-Seat Ordering in Your Auditoriums.
                </h3>
                <p className="text-sm text-slate-300 mt-2 max-w-xl">
                  Eliminate interval queues and bring food directly to moviegoer seats.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold px-6 py-3.5 shadow-md shadow-red-600/30 transition text-xs"
                >
                  <span>Register Theatre</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-3.5 transition text-xs"
                >
                  <span>Staff Login</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-950 text-white font-black flex items-center justify-center text-sm">
              <Film className="w-3.5 h-3.5 text-red-500" />
            </div>
            <span className="font-extrabold text-slate-900">MenuGo for Theatres</span>
            <span>&bull; Multiplex In-Seat Ordering &amp; Concessions</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-semibold">
            <a href={mainPlatformUrl} className="hover:text-red-600 transition">MenuGo Platform Home</a>
            <Link href="/login" className="hover:text-red-600 transition">Console Login</Link>
            <Link href="/kitchen" className="hover:text-red-600 transition">Kitchen KDS</Link>
            <Link href="/delivery" className="hover:text-red-600 transition">Runner Dispatch</Link>
            <span className="text-slate-400 font-normal">&copy; {new Date().getFullYear()} MenuGo Technologies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
