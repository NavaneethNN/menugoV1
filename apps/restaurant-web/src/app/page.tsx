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
  ShoppingBag,
  Check,
  Store,
  KeyRound,
  Eye,
  UtensilsCrossed,
  Utensils,
  Users,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { HowItWorksSlider } from '@/components/home/HowItWorksSlider';

export default function RestaurantHomePage() {
  const mainPlatformUrl = process.env.NEXT_PUBLIC_MAIN_URL || 'http://localhost:3002';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-red-600 selection:text-white">
      {/* Top Announcement Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">MenuGo Restaurants:</span>
            <span className="hidden sm:inline text-slate-400">
              Smart table QR ordering, real-time Kitchen Display System (KDS), waiter calling, and cashier billing sessions.
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
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-red-600 text-white font-black text-2xl shadow-lg shadow-red-600/20 group-hover:scale-105 transition-transform">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                Menu<span className="text-red-600">Go</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 mt-1 flex items-center gap-1">
                <UtensilsCrossed className="w-2.5 h-2.5" />
                Restaurant Portal
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-red-600 transition">How It Works</a>
            <a href="#features" className="hover:text-red-600 transition">Features</a>
            <a href="#roadmap" className="hover:text-red-600 transition">Setup Steps</a>
            <Link
              href="/menu/hotel"
              className="hover:text-red-600 flex items-center gap-1.5 transition text-red-600 font-bold"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Menu Demo</span>
            </Link>
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

            {/* Staff PIN Login */}
            <Link
              href="/staff/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2.5 rounded-xl transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Staff PIN</span>
            </Link>

            <Link
              href="/admin/login"
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 px-3 py-2.5 rounded-xl transition"
            >
              Sign In
            </Link>

            <Link
              href="/admin/login?mode=signup&business=restaurant"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl shadow-md shadow-red-600/20 transition hover:-translate-y-0.5"
            >
              <span>Get Started</span>
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
                href="#roadmap"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span>Setup Roadmap</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
              <Link
                href="/menu/hotel"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>View Live Demo Cafe</span>
                </div>
                <ChevronRight className="w-4 h-4 text-red-600" />
              </Link>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <a
                href={mainPlatformUrl}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-800"
              >
                <span>Back to MenuGo Platform</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <Link
                href="/staff/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-800"
              >
                <KeyRound className="w-3.5 h-3.5 text-red-600" />
                <span>Staff 4-Digit PIN Terminal</span>
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/admin/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs text-center"
                >
                  Sign In
                </Link>
                <Link
                  href="/admin/login?mode=signup&business=restaurant"
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
        <section className="relative overflow-hidden bg-gradient-to-b from-red-50/40 via-white to-white border-b border-red-100 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-16 items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white border border-red-200 px-3.5 py-1.5 text-xs font-bold text-red-800 shadow-sm mb-6">
                  <UtensilsCrossed className="w-4 h-4 text-red-600" />
                  <span>Dine-In QR Ordering &amp; Operations</span>
                </div>

                <h1 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight leading-[1.05] mb-6">
                  Give every table a seamless <span className="text-red-600">self-ordering</span> experience.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8">
                  Guests scan table QR codes to browse photo-rich menus, customize dishes, and call waitstaff. Real-time tickets route directly to your kitchen KDS and cashier workstation.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <Link
                    href="/admin/login?mode=signup&business=restaurant"
                    className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold px-6 py-3.5 rounded-xl shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5"
                  >
                    <span>Set up your restaurant free</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/menu/hotel"
                    className="inline-flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-slate-800 border border-slate-200 font-bold px-6 py-3.5 rounded-xl transition"
                  >
                    <Eye className="w-4 h-4 text-red-600" />
                    <span>View live guest menu</span>
                  </Link>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600" /> Zero guest app downloads
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600" /> Automatic table binding
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600" /> Staff stays in control
                  </span>
                </div>
              </div>

              {/* Interactive Visual Order Journey */}
              <div className="relative max-w-xl w-full mx-auto">
                <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-red-200/50 to-orange-100/40 blur-xl" />
                <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 sm:p-7">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                        Live Flow Demo
                      </p>
                      <p className="font-extrabold text-slate-900 mt-0.5">Guest Menu &rarr; Kitchen KDS</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Live Order
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-6">
                    {/* Guest Phone View */}
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-xs shadow-xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-3">
                        <Smartphone className="w-3.5 h-3.5 text-red-600" />
                        <span>Table T-04 Menu</span>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-2.5 mb-2">
                        <div className="flex justify-between font-bold text-[11px]">
                          <span>Table T-04</span>
                          <QrCode className="w-3 h-3 text-red-600" />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Session Active</p>
                      </div>
                      <div className="py-1">
                        <p className="font-bold text-slate-900 text-xs">Paneer Tikka</p>
                        <p className="text-[10px] text-slate-500">1 &times; Mint Chutney</p>
                      </div>
                      <div className="mt-2 rounded-lg bg-red-600 text-white text-center text-[10px] font-bold py-1.5">
                        Order Sent &bull; &#8377;320
                      </div>
                    </div>

                    {/* Arrow Connection */}
                    <div className="flex flex-col items-center gap-1 text-red-500">
                      <ArrowRight className="w-5 h-5" />
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                        Real-time
                      </span>
                      <ArrowRight className="w-5 h-5" />
                    </div>

                    {/* Kitchen KDS View */}
                    <div className="rounded-2xl bg-slate-900 text-white border border-slate-800 p-3.5 text-xs shadow-xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 mb-3">
                        <ChefHat className="w-3.5 h-3.5 text-red-400" />
                        <span>Kitchen Display</span>
                      </div>
                      <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-2.5 mb-2">
                        <div className="flex justify-between items-center font-bold text-[11px]">
                          <span>Ticket #104</span>
                          <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full">
                            Prep (2m)
                          </span>
                        </div>
                        <p className="text-[10px] text-red-300 font-semibold mt-1">Table T-04</p>
                      </div>
                      <p className="text-[10px] text-slate-300">1 &times; Paneer Tikka</p>
                      <div className="mt-2 rounded-lg bg-emerald-600 text-white text-center text-[10px] font-bold py-1.5">
                        Mark Ready
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">1. Guest Scans</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">Table QR</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">2. Instant Route</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">Kitchen KDS</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">3. Fast Serve</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">Table Delivered</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-slate-200 bg-slate-200 shadow-sm">
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">Every Table</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">Tamper-Proof QR Codes</p>
              </div>
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">Every Guest</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">Zero App Self-Ordering</p>
              </div>
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">Your Kitchen</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">Live KDS Timers &amp; Chimes</p>
              </div>
              <div className="bg-white p-5 text-center">
                <p className="text-xs text-slate-500 font-semibold">Your Cashier</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">Single-Click Bill &amp; Close</p>
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
                From Table QR to a Plate Served.
              </h2>
              <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
                Guests get time to browse and customize dishes. Your staff receives clear, table-tagged orders and manages service effortlessly.
              </p>
            </div>

            <HowItWorksSlider businessType="restaurant" />
          </div>
        </section>

        {/* Features Grid Section */}
        <section id="features" className="py-20 sm:py-24 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
              <div className="lg:sticky lg:top-28">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>The Restaurant Toolkit</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
                  Built for Speed, Hospitality &amp; Accuracy.
                </h2>
                <p className="text-base text-slate-600 leading-relaxed mt-5">
                  Set up your menu and table layout, then provide front-of-house, kitchen, and cashier stations with synchronized live order views.
                </p>
                <div className="mt-8 space-y-3">
                  <Link
                    href="/admin/login?mode=signup&business=restaurant"
                    className="inline-flex items-center gap-2 font-extrabold text-sm text-red-600 hover:text-red-700"
                  >
                    <span>Start your 14-day free setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <div className="pt-2">
                    <Link
                      href="/staff/login"
                      className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>Log in to Staff 4-Digit PIN Terminal &rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: QrCode,
                    title: 'Table QR Ordering',
                    body: 'Assign unique, tamper-proof QR stickers to each dining table. Guests scan to order without app installs.'
                  },
                  {
                    icon: UtensilsCrossed,
                    title: 'Visual Menu & Modifiers',
                    body: 'Manage categories, item images, spice levels, veg/non-veg tags, customizable modifiers, and out-of-stock toggles.'
                  },
                  {
                    icon: ChefHat,
                    title: 'Real-time Kitchen KDS',
                    body: 'Color-coded ticket cards with prep timers, acoustic order chimes, and instant mark-ready notifications.'
                  },
                  {
                    icon: HeartHandshake,
                    title: 'Waiter Calling Chime',
                    body: 'Diners request water refills, waiter assistance, or cutlery with a single tap. Alerts staff in real-time.'
                  },
                  {
                    icon: ShoppingBag,
                    title: 'Cashier & Table Sessions',
                    body: 'POS cashier workstation to manage table occupancy, view active bills, record cash or card payments, and close tabs.'
                  },
                  {
                    icon: Users,
                    title: '4-Digit Staff PINs',
                    body: 'Equip servers and line cooks with simple 4-digit PIN access for rapid workstation handoffs.'
                  },
                  {
                    icon: Store,
                    title: 'Multi-Room Floor Layout',
                    body: 'Group tables by sections (Patio, AC Dining, Rooftop, Bar) and batch-download printable PDF QR stickers.'
                  },
                  {
                    icon: BarChart3,
                    title: 'Sales & Item Analytics',
                    body: 'Track gross turnover, top-selling dishes, peak dining hours, and average table turn times in one dashboard.'
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
        <section id="roadmap" className="py-20 sm:py-24 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl text-center mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider mb-3">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fast Onboarding</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
                Go Live in Under 10 Minutes.
              </h2>
              <p className="text-base text-slate-600 mt-4 leading-relaxed">
                Step-by-step setup guides you through adding dishes, generating table QRs, and inviting your floor staff.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
              {[
                'Restaurant Profile',
                'Menu Categories',
                'Dishes & Pricing',
                'Table Seating Layout',
                'Generate Table QRs',
                'Staff 4-Digit PINs',
                'Kitchen Display Setup',
                'Open for Service'
              ].map((step, idx) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <span className="w-7 h-7 shrink-0 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-black">
                    {idx + 1}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">{step}</span>
                </div>
              ))}
            </div>

            {/* CTA Banner */}
            <div className="mt-12 max-w-5xl mx-auto rounded-3xl bg-slate-950 text-white p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-red-400 mb-2">
                  Ready for Faster Service?
                </p>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Start Taking Table Orders Today.
                </h3>
                <p className="text-sm text-slate-300 mt-2 max-w-xl">
                  Register your restaurant and transform the dining experience for your patrons and team.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                <Link
                  href="/admin/login?mode=signup&business=restaurant"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold px-6 py-3.5 shadow-md shadow-red-600/30 transition text-xs"
                >
                  <span>Register Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/menu/hotel"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-3.5 transition text-xs"
                >
                  <Eye className="w-4 h-4 text-red-400" />
                  <span>View Demo</span>
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
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-sm">
              M
            </div>
            <span className="font-extrabold text-slate-900">MenuGo for Restaurants</span>
            <span>&bull; Contactless Table Dining POS &amp; KDS</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-semibold">
            <a href={mainPlatformUrl} className="hover:text-red-600 transition">MenuGo Platform Home</a>
            <Link href="/staff/login" className="hover:text-red-600 transition">Staff PIN Login</Link>
            <Link href="/admin/login" className="hover:text-red-600 transition">Admin Login</Link>
            <Link href="/menu/hotel" className="hover:text-red-600 transition">Live Demo</Link>
            <span className="text-slate-400 font-normal">&copy; {new Date().getFullYear()} MenuGo Technologies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
