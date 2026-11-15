'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import {
  Film,
  Building2,
  Tv,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Upload,
  Loader2,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Coins,
  Globe,
  FileText
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
    businessDetails: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    logoUrl: '',
    logoKey: ''
  });

  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdData, setCreatedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Handle Logo File Upload (Presigned URL or direct payload)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, or WEBP)');
      return;
    }

    try {
      setLogoUploading(true);
      setError(null);

      // Read file as base64 for instant preview or direct data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormData((prev) => ({
          ...prev,
          logoUrl: dataUrl,
          logoKey: `theatre-logo-${Date.now()}`
        }));
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Logo upload failed:', err);
      setError('Failed to process theatre logo');
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!session?.user) {
      router.push('/admin/login?business=cinema&redirect=/cinema/onboarding');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        theatreName: formData.theatreName.trim(),
        chainOrBrand: formData.chainOrBrand.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country.trim() || 'India',
        contactNumber: formData.contactNumber.trim(),
        contactEmail: formData.contactEmail.trim().toLowerCase(),
        businessDetails: formData.businessDetails.trim() || undefined,
        currency: formData.currency || 'INR',
        timezone: formData.timezone || 'Asia/Kolkata',
        logoUrl: formData.logoUrl || undefined,
        logoKey: formData.logoKey || undefined
      };

      const result = await apiRequest('/api/cinema/theatres', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setCreatedData(result);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err?.message || 'Failed to register cinema theatre. Please check input values.');
    } finally {
      setLoading(false);
    }
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
                Configure your theatre identity, city, timezone, and contact details to begin setting up screens, rows, and in-auditorium seat ordering.
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
              <div className="text-center py-10 px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-950">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">
                  Theatre Profile Registered!
                </h2>
                <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                  <strong className="text-white">{createdData?.theatre?.name || formData.theatreName}</strong> has been registered with slug{' '}
                  <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded font-mono font-bold">
                    {createdData?.theatre?.slug}
                  </code>{' '}
                  under <strong className="text-white">tenant_type = cinema</strong>.
                </p>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2.5 mb-8 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">City & State:</span>
                    <span className="text-white font-medium">{formData.city}, {formData.state}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Contact Email:</span>
                    <span className="text-white font-medium">{formData.contactEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Default Timezone:</span>
                    <span className="text-white font-medium">{formData.timezone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Currency:</span>
                    <span className="text-emerald-400 font-bold">INR (₹)</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/80 pt-2">
                    <span className="text-slate-500 font-semibold">Next Stage:</span>
                    <span className="text-indigo-400 font-bold">Add Cinema Screens (Task 03)</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/cinema/admin/dashboard"
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                  >
                    <span>Enter Cinema Dashboard</span>
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
                    Official details for auditorium management, show schedules, and customer food delivery.
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

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
                        placeholder="e.g. Grand Cineplex IMAX / PVR Gold Cinema"
                        value={formData.theatreName}
                        onChange={(e) => setFormData({ ...formData, theatreName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      placeholder="e.g. Bengaluru / Mumbai / Delhi"
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
                      placeholder="e.g. Karnataka / Maharashtra"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="e.g. +91 98765 43210"
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
                        placeholder="e.g. cinema.admin@theatre.com"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Theatre Logo (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      {formData.logoUrl ? (
                        <div className="w-11 h-11 rounded-xl border border-indigo-500 overflow-hidden shrink-0 bg-slate-950 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                      ) : null}
                      <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-indigo-500 text-xs font-medium text-slate-300 transition">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>{logoUploading ? 'Uploading...' : formData.logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={logoUploading}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Optional Details Disclosure */}
                <details className="group rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition-all">
                  <summary className="text-xs font-bold text-slate-400 hover:text-indigo-400 cursor-pointer list-none flex items-center justify-between">
                    <span>+ Additional Details (Address, Brand, GSTIN)</span>
                    <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-3 border-t border-slate-800/80">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Brand / Chain Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cinepolis / PVR INOX / Independent"
                        value={formData.chainOrBrand}
                        onChange={(e) => setFormData({ ...formData, chainOrBrand: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        GSTIN / Tax ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 29AAAAA0000A1Z5"
                        value={formData.businessDetails}
                        onChange={(e) => setFormData({ ...formData, businessDetails: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Mall / Auditorium Street Address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 4th Floor, Nexus Mall, Koramangala"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </details>

                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>India (IST) • <strong>INR (₹)</strong></span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Theatre...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Profile & Continue</span>
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
    </div>
  );
}
