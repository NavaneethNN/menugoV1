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
  Zap,
  TrendingUp,
  Percent,
  Clock,
  Printer,
  HeartHandshake,
  Smartphone,
  Truck,
  Popcorn,
  CreditCard,
  BarChart3,
  Users,
  Store,
  Layers,
  HelpCircle,
  ChevronDown
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

  const [activeTab, setActiveTab] = useState<'restaurant' | 'cinema'>('restaurant');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [planFilter, setPlanFilter] = useState<'all' | 'restaurant' | 'cinema'>('all');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const faqs = [
    {
      q: 'Do patrons need to download an iOS or Android app to place orders?',
      a: 'No. MenuGo operates 100% inside mobile web browsers (Safari, Chrome, etc.). Patrons scan the table or armrest QR code with their smartphone camera and immediately open the verified digital menu in under 2 seconds.'
    },
    {
      q: 'How do payments work for dining restaurants vs movie theatres?',
      a: 'In restaurants, guests can either pay directly via online UPI/cards or request the bill for traditional cash/card settlement through the cashier workstation. In theatres, orders are pre-paid online via Razorpay or Paytm so delivery runners can deliver silently in the dark auditorium without handling cash or cards.'
    },
    {
      q: 'Does MenuGo charge a percentage commission on food sales?',
      a: 'No. Unlike traditional food delivery aggregators that take 15% to 30% of gross sales, MenuGo operates on a flat, transparent SaaS subscription tier. You retain 100% of your food, beverage, and concession revenue.'
    },
    {
      q: 'Can we use our existing tablets or kitchen screens?',
      a: 'Yes. MenuGo is cloud-based and hardware-agnostic. Kitchen Display Systems (KDS), cashier terminals, and delivery runner consoles run in any standard web browser on iPads, Android tablets, touch monitors, or laptops.'
    },
    {
      q: 'How does MenuGo for Theatres handle screen and seat allocation?',
      a: 'Setup is remarkably simple: you configure your auditorium screens (Screen 1, Screen 2, Audi 3), configure row letters (A..Z) and seat numbers (1..25), and print armrest QR codes. Patrons order directly to their exact seat without needing complex movie schedules or poster configurations.'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-red-600 selection:text-white">
      {/* Platform Top Notification Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">MenuGo Hospitality Platform:</span>
            <span className="hidden sm:inline text-slate-400">
              Zero-commission contactless QR ordering, real-time KDS, and direct merchant settlements across India.
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
            <a href="#deep-dive" className="hover:text-red-600 transition">How It Works</a>
            <a href="#roi" className="hover:text-red-600 transition">Why MenuGo</a>
            <a href="#pricing" className="hover:text-red-600 transition">Pricing Plans</a>
            <a href="#faq" className="hover:text-red-600 transition">FAQ</a>
          </nav>

          {/* App Switcher Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <a
              href={restaurantUrl}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-red-600 bg-slate-100 hover:bg-slate-200 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl transition shrink-0"
              title="MenuGo for Restaurants (Port 3000)"
            >
              <UtensilsCrossed className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-red-600" />
              <span><span className="hidden sm:inline">MenuGo for </span>Restaurants</span>
              <ExternalLink className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-400" />
            </a>

            <a
              href={cinemaUrl}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-red-600 bg-slate-100 hover:bg-slate-200 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl transition shrink-0"
              title="MenuGo for Theatres (Port 3001)"
            >
              <Film className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-red-600" />
              <span><span className="hidden sm:inline">MenuGo for </span>Theatres</span>
              <ExternalLink className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-400" />
            </a>

            <Link
              href="/super-admin"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl transition shadow-sm shrink-0"
            >
              <Laptop className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-red-400" />
              <span className="hidden xs:inline">Super Admin</span>
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
            One powerful multi-tenant cloud platform engineered for two distinct industries: smart table QR ordering for dining venues, and precision in-seat armrest delivery for cinema multiplexes. Zero customer app downloads, instant direct payouts, and real-time KDS workflows.
          </p>

          {/* Social Proof Metric Counters */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">+35%</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Average Order Value</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">0 App</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Downloads Required</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">18 Min</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Faster Table Turnover</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">100%</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Direct Merchant Payout</p>
            </div>
          </div>

          {/* Dual Business Portals Showcase Cards */}
          <div id="solutions" className="mt-14 grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto text-left">
            {/* Restaurant Portal Card */}
            <div className="rounded-3xl border-2 border-red-100 hover:border-red-500 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                  <UtensilsCrossed className="w-7 h-7" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>Dining &amp; Hospitality &bull; Port 3000</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  MenuGo for Restaurants
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Transform every table into an automated digital ordering hub. Guests scan table QR stickers to explore dishes with photos and modifiers, order instantly, and call waitstaff with sound alerts.
                </p>

                <ul className="mt-6 space-y-3 text-xs text-slate-700 font-semibold">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Table QR ordering with categories, images &amp; cooking notes</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Live Kitchen Display System (KDS) prep line with audible chimes</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Waiter calling chime for water, cutlery &amp; check requests</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Cashier table sessions: occupancy tracking, bills &amp; closeouts</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>4-digit staff PIN access for high-speed workstation handoffs</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                <a
                  href={restaurantUrl}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md shadow-red-600/20 transition hover:-translate-y-0.5"
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
            <div className="rounded-3xl border-2 border-slate-200 hover:border-slate-900 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                  <Film className="w-7 h-7 text-red-500" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>Multiplex &amp; Theatres &bull; Port 3001</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  MenuGo for Theatres
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Bring concessions straight to moviegoer armrests. Guests scan screen QR codes, select their exact row and seat, pay online via Razorpay or Paytm, and receive food delivered silently during the film.
                </p>

                <ul className="mt-6 space-y-3 text-xs text-slate-700 font-semibold">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Armrest QR seat selection with screen, row &amp; seat targeting</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Concession combo menu: popcorn sizing, cold drinks &amp; snacks</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Kitchen KDS with prominent Screen, Row and Seat destination badges</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Auditorium delivery runner dashboard with printable tickets</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Direct-to-theatre payouts with automated Razorpay &amp; Paytm settle</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                <a
                  href={cinemaUrl}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md shadow-slate-900/20 transition hover:-translate-y-0.5"
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

      {/* Deep Dive: How It Works Comparison (Tabbed Interactive Section) */}
      <section id="deep-dive" className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Step-by-Step Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
              Built Specifically for Your Operation
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Explore how MenuGo streamlines hospitality for dining venues vs high-volume cinema multiplexes.
            </p>

            {/* Interactive Switcher */}
            <div className="mt-8 inline-flex items-center p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('restaurant')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'restaurant'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>Restaurant Workflow (Port 3000)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cinema')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'cinema'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Film className="w-4 h-4 text-red-400" />
                <span>Cinema Workflow (Port 3001)</span>
              </button>
            </div>
          </div>

          {activeTab === 'restaurant' ? (
            /* Restaurant Deep Dive */
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto animate-in fade-in duration-300">
              <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <QrCode className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Step 01 &bull; Guests</span>
                <h3 className="text-xl font-black text-slate-900">Table QR Self-Ordering</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Diners scan physical QR stands on their table. The menu loads instantly with high-res photos, spice levels, allergens, and custom modifier notes (extra cheese, no onion).
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
                  &bull; No app install &bull; Auto table binding
                </div>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <ChefHat className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Step 02 &bull; Kitchen</span>
                <h3 className="text-xl font-black text-slate-900">Real-Time Kitchen KDS</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Chefs receive incoming orders in real-time with acoustic chimes, elapsed prep timers, and table IDs. One tap transitions orders from Received &rarr; Preparing &rarr; Ready.
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
                  &bull; Eliminates lost paper tickets &bull; Prep timers
                </div>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <Store className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Step 03 &bull; Cashier</span>
                <h3 className="text-xl font-black text-slate-900">Table Billing &amp; Closeout</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Cashiers track table occupancy on a visual map, merge or split tabs, accept cash or card payments, and close sessions with instant thermal receipt printing.
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
                  &bull; Fast session close &bull; ESC/POS printing
                </div>
              </div>
            </div>
          ) : (
            /* Cinema Deep Dive */
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto animate-in fade-in duration-300">
              <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-red-500 flex items-center justify-center font-bold">
                  <Armchair className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Step 01 &bull; Moviegoers</span>
                <h3 className="text-xl font-black text-slate-900">Armrest QR In-Seat Order</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Moviegoers scan the QR code affixed to their seat armrest. They select Screen, Row, and Seat number, pick popcorn combos, and pay online without missing a scene.
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
                  &bull; Dark-mode menu &bull; Zero interval queues
                </div>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-red-500 flex items-center justify-center font-bold">
                  <Popcorn className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Step 02 &bull; Kitchen</span>
                <h3 className="text-xl font-black text-slate-900">Concession Kitchen KDS</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Concession cooks prepare hot popcorn, nachos, and fountain beverages with clear packaging tickets showing auditorium Screen, Row, and Seat destination.
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
                  &bull; Instant order printouts &bull; Prep timers
                </div>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-red-500 flex items-center justify-center font-bold">
                  <Truck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Step 03 &bull; Runners</span>
                <h3 className="text-xl font-black text-slate-900">Stealth Seat Delivery</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Floor runners grab packed trays with seat slips and silently deliver piping hot snacks to row F, seat 12 inside the dark auditorium without disrupting other viewers.
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
                  &bull; In-auditorium dispatch &bull; 100% pre-paid
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Bar under Deep Dive */}
          <div className="mt-12 text-center">
            {activeTab === 'restaurant' ? (
              <a
                href={restaurantUrl}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-lg shadow-red-600/20 transition hover:-translate-y-0.5"
              >
                <span>Explore Full Restaurant Module (Port 3000)</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <a
                href={cinemaUrl}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
              >
                <span>Explore Full Cinema Module (Port 3001)</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Why MenuGo / Value Proposition Section */}
      <section id="roi" className="py-20 sm:py-28 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Proven Venue ROI</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
              Why Leading Venues Choose MenuGo
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Stop losing revenue to aggregator fees, long ordering lines, and walkouts.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="p-7 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Percent className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">0% Commission Model</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Save 15% to 30% that aggregators take from every meal. Keep 100% of your earnings with predictable, transparent SaaS subscription pricing.
              </p>
            </div>

            <div className="p-7 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Direct Merchant Gateways</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Money never passes through third-party escrow. Funds settle directly into your own bank account via your connected Razorpay or Paytm account.
              </p>
            </div>

            <div className="p-7 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Hardware Independence</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Works on iPads, Android tablets, touch monitors, POS terminals, and any ESC/POS network thermal printer (80mm/58mm) without expensive proprietary hardware.
              </p>
            </div>

            <div className="p-7 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Dual Database Isolation</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Enterprise cloud architecture separates dining restaurant records and multiplex theatre records into independent Neon Serverless database clusters for absolute data sovereignty.
              </p>
            </div>

            <div className="p-7 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Instant 2-Minute Setup</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Register your business, upload your menu categories and items, configure tables or screens, and download high-resolution QR stickers in minutes.
              </p>
            </div>

            <div className="p-7 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">99.9% Cloud Uptime</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Cloud-native architecture handles rush-hour restaurant rushes and interval cinema surges effortlessly without server throttling or order dropping.
              </p>
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
                        ? 'bg-slate-950 text-white shadow-2xl ring-2 ring-red-500 scale-[1.02]'
                        : 'bg-white text-slate-900 border border-slate-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Badge Row */}
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                            isCinema
                              ? 'bg-slate-800 text-red-400 border border-slate-700'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {isCinema ? 'Multiplex & Theatres' : 'Dining & Restaurants'}
                        </span>

                        {plan.isPopular && (
                          <span className="text-[10px] uppercase font-black bg-red-600 text-white px-2.5 py-0.5 rounded-full shadow-sm">
                            Most Popular
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl font-black tracking-tight">{plan.name}</h3>
                      <p className={`mt-2 text-xs leading-relaxed ${plan.isPopular ? 'text-slate-400' : 'text-slate-600'}`}>
                        {plan.description}
                      </p>

                      {/* Price Display */}
                      <div className="mt-6 pb-6 border-b border-slate-200/20 flex items-baseline gap-1.5">
                        <span className="text-4xl font-black">&#8377;{priceRupees.toLocaleString('en-IN')}</span>
                        <span className={`text-xs font-semibold ${plan.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                          / {isAnnual ? 'year' : 'month'}
                        </span>
                      </div>

                      {/* Capacity Limits */}
                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
                        {plan.maxTables && (
                          <span className={`px-2 py-0.5 rounded-md ${plan.isPopular ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                            Up to {plan.maxTables} Tables
                          </span>
                        )}
                        {plan.maxScreens && (
                          <span className={`px-2 py-0.5 rounded-md ${plan.isPopular ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                            Up to {plan.maxScreens} Screen{plan.maxScreens > 1 ? 's' : ''}
                          </span>
                        )}
                        {plan.maxStaff && (
                          <span className={`px-2 py-0.5 rounded-md ${plan.isPopular ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                            {plan.maxStaff} Staff PINs
                          </span>
                        )}
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
                        className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
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

      {/* Frequently Asked Questions */}
      <section id="faq" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider mb-3">
              <HelpCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Got Questions?</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between font-bold text-slate-900 text-sm sm:text-base gap-4"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-red-600' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 bg-white">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
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
            <span>&bull; Contactless operations for restaurants and cinemas</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-semibold">
            <a href={restaurantUrl} className="hover:text-red-600 transition">Restaurant App (Port 3000)</a>
            <a href={cinemaUrl} className="hover:text-red-600 transition">Cinema App (Port 3001)</a>
            <Link href="/super-admin" className="hover:text-red-600 transition font-semibold text-slate-800">Super Admin</Link>
            <span className="text-slate-400 font-normal">&copy; {new Date().getFullYear()} MenuGo Technologies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
