'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import {
  Film,
  Clapperboard,
  Tv,
  Armchair,
  UtensilsCrossed,
  CreditCard,
  CalendarDays,
  QrCode,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Building2,
  MapPin,
  Phone,
  Mail,
  Loader2,
  Clock,
  Coins,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function CinemaOnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  // Onboarding Form State
  const [formData, setFormData] = useState({
    theatreName: '',
    chainOrBrand: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    contactNumber: '',
    contactEmail: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    initialScreensCount: 3
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  // Setup roadmap steps from Section 4 of theatremodule.md
  const roadmapSteps = [
    { step: 1, title: 'Theatre Profile', desc: 'Basic details, city & currency', status: 'current' },
    { step: 2, title: 'Cinema Screens', desc: 'Auditorium count & screen names', status: 'upcoming' },
    { step: 3, title: 'Seating Layout', desc: 'Rows & seat numbering (A1..Z25)', status: 'upcoming' },
    { step: 4, title: 'Food Menu', desc: 'Popcorn, snacks, combos & beverages', status: 'upcoming' },
    { step: 5, title: 'Payment Gateway', desc: 'Theatre Razorpay or Paytm account', status: 'upcoming' },
    { step: 6, title: 'Movie Schedules', desc: 'Daily showtimes & order windows', status: 'upcoming' },
    { step: 7, title: 'Screen QR Codes', desc: 'General & screen QR deployment', status: 'upcoming' },
    { step: 8, title: 'Go Live', desc: 'Accept in-auditorium seat orders', status: 'upcoming' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Initial setup simulation / persistence placeholder for Task 01 & 02
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-white leading-none">
                Menu<span className="text-indigo-400">Go</span> <span className="text-xs uppercase bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-800/80 ml-1">Cinema</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">
                Seat-Based Ordering SaaS
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Home
            </Link>
            <span className="text-slate-700">|</span>
            <Link
              href="/admin/onboarding"
              className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Switch to Restaurant Setup</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Module Banner */}
        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-800/60 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Option B • Cinema Theatres Module</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Register Your Cinema Theatre
              </h1>
              <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
                Configure your screens, seating rows, daily movie schedules, and direct merchant gateway to start delivering food directly to customers inside the auditorium.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Isolated Cinema Tenant</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: 8-Step Setup Roadmap from Section 4 */}
          <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-3xl p-6">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 mb-1">
              Configuration Pipeline
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              MenuGo Cinema follows an 8-step operational setup workflow:
            </p>

            <div className="space-y-4">
              {roadmapSteps.map((step) => {
                const isCurrent = step.step === 1;
                return (
                  <div
                    key={step.step}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                      isCurrent
                        ? 'bg-indigo-950/70 border-indigo-600/80 text-white shadow-md shadow-indigo-950'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                          {step.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-900/80 px-2 py-0.5 rounded-full">
                            Step 1
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Full setup completed in under 15 minutes.</span>
            </div>
          </div>

          {/* Right: Registration Form */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            {submitted ? (
              <div className="text-center py-12 px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-950">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white mb-3">
                  Theatre Profile Initialized!
                </h2>
                <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                  <strong className="text-white">{formData.theatreName}</strong> has been configured with {formData.initialScreensCount} screens in {formData.city}, {formData.state} (Currency: {formData.currency}, Timezone: {formData.timezone}).
                </p>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2 mb-8 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Tenant Business Type:</span>
                    <span className="text-indigo-400 font-mono font-bold">tenant_type = cinema</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Default Currency:</span>
                    <span className="text-white font-medium">INR (₹)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Next Step:</span>
                    <span className="text-emerald-400 font-semibold">Configure Screens & Seating Layout</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => setSubmitted(false)}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
                  >
                    Edit Details
                  </button>
                  <Link
                    href="/"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all inline-flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30"
                  >
                    <span>Return to Homepage</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    Step 1: Theatre Profile Information
                  </h2>
                  <p className="text-xs text-slate-400">
                    Enter official details for customer invoicing, ordering tokens, and seat delivery.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Theatre Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Theatre / Cinema Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Film className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cinepolis Nexus Mall / PVR Grand Multiplex"
                        value={formData.theatreName}
                        onChange={(e) => setFormData({ ...formData, theatreName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Chain or Brand */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Theatre Chain / Brand (Optional)
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="e.g. Independent / Cinepolis / PVR"
                        value={formData.chainOrBrand}
                        onChange={(e) => setFormData({ ...formData, chainOrBrand: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Initial Screens Count */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Number of Screens <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Tv className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="1"
                        max="30"
                        required
                        value={formData.initialScreensCount}
                        onChange={(e) => setFormData({ ...formData, initialScreensCount: Number(e.target.value) })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Street Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Theatre Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <textarea
                        required
                        rows={2}
                        placeholder="Level 4, Orion Mall, Dr. Rajkumar Road"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bengaluru, Mumbai, Chennai"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      State <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Karnataka, Maharashtra"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Contact Phone (+91) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={formData.contactNumber}
                        onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Contact Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Contact Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="manager@theatre.com"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Indian Market Defaults (Section 4) */}
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Target Market</span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        🇮🇳 India (Initial Market)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Currency</span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        INR (₹ Indian Rupees)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Timezone</span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        Asia/Kolkata (IST)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <Link
                    href="/"
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel and return home
                  </Link>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Theatre Profile...</span>
                      </>
                    ) : (
                      <>
                        <span>Save & Proceed to Screens</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>MenuGo Cinema Module • Multi-Tenant Enterprise Architecture • Razorpay & Paytm Ready</p>
      </footer>
    </div>
  );
}
