'use client';

import React from 'react';
import Link from 'next/link';
import {
  Film,
  Tv,
  Armchair,
  UtensilsCrossed,
  ChefHat,
  Truck,
  QrCode,
  CreditCard,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  ExternalLink
} from 'lucide-react';

export default function CinemaHomePage() {
  const restaurantUrl = process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-red-700 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-700 text-white font-extrabold flex items-center justify-center text-xl shadow-sm">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl text-slate-900 tracking-tight">
                Menu<span className="text-red-700">Go</span>
              </span>
              <span className="ml-2 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Cinema Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={restaurantUrl}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
            >
              <span>Restaurant Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <Link
              href="/login"
              className="text-xs font-semibold text-slate-700 hover:text-red-700 px-3 py-2 rounded-lg transition"
            >
              Staff &amp; Admin Login
            </Link>

            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <span>Register Theatre</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
            <Film className="w-3.5 h-3.5" />
            <span>Dedicated Cinema Module</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Contactless In-Seat Ordering for Modern Movie Theatres
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Patrons scan the QR code on their armrest, order snacks &amp; popcorn, pay online, and get orders delivered straight to their seat.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="px-6 py-3.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition flex items-center gap-2"
            >
              <span>Get Started • Register Theatre</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              <span>Enter Management Console</span>
            </Link>
          </div>
        </div>

        {/* Operational Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center justify-center">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Auditoriums &amp; Seating</h3>
            <p className="text-sm text-slate-600">
              Configure screens, rows, and seats. Generate unique QR codes for each seat armrest and auditorium entrance stand.
            </p>
            <div className="pt-2">
              <Link
                href="/admin/screens"
                className="text-xs font-bold text-red-700 hover:text-red-800 inline-flex items-center gap-1"
              >
                <span>Manage Screens</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center justify-center">
              <ChefHat className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Concessions Kitchen KDS</h3>
            <p className="text-sm text-slate-600">
              Live Kitchen Display System shows incoming orders in real time with prominent screen, row, and seat destination indicators.
            </p>
            <div className="pt-2">
              <Link
                href="/kitchen"
                className="text-xs font-bold text-red-700 hover:text-red-800 inline-flex items-center gap-1"
              >
                <span>Open Kitchen Display</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Seat Delivery Runner</h3>
            <p className="text-sm text-slate-600">
              Mobile-optimized dispatch interface for floor runners to deliver packaged popcorn &amp; drinks directly to moviegoers inside auditoriums.
            </p>
            <div className="pt-2">
              <Link
                href="/delivery"
                className="text-xs font-bold text-red-700 hover:text-red-800 inline-flex items-center gap-1"
              >
                <span>Open Runner Dispatch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">100%</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">Contactless Ordering</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">Direct</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">Merchant Gateways (Razorpay/Paytm)</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">Real-time</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">Live Order Status Tracking</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">Row &amp; Seat</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">Pinpoint Auditorium Delivery</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <p>MenuGo Cinema Module • Multi-Tenant Enterprise Architecture</p>
      </footer>
    </div>
  );
}
