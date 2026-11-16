'use client';

import React, { useState, useEffect } from 'react';
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
  FileText,
  UserCheck,
  UtensilsCrossed,
  CreditCard,
  CalendarDays,
  QrCode,
  Zap,
  Lock,
  ChevronRight
} from 'lucide-react';

export default function CinemaOnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [checkingExisting, setCheckingExisting] = useState(true);

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
    { step: 1, title: 'Theatre Profile', desc: 'Basic details, city & currency', status: submitted ? 'completed' : 'current', href: '/cinema/onboarding', icon: Building2 },
    { step: 2, title: 'Cinema Screens', desc: 'Auditorium count & screen names', status: submitted ? 'current' : 'upcoming', href: '/cinema/admin/screens', icon: Tv },
    { step: 3, title: 'Seating Layout', desc: 'Rows & seat numbering (A1..Z25)', status: 'upcoming', href: '/cinema/admin/seating', icon: Film },
    { step: 4, title: 'Food Menu', desc: 'Popcorn, snacks, combos & beverages', status: 'upcoming', href: '/cinema/admin/menu', icon: UtensilsCrossed },
    { step: 5, title: 'Payment Gateway', desc: 'Theatre Razorpay or Paytm account', status: 'upcoming', href: '/cinema/admin/payments', icon: CreditCard },
    { step: 6, title: 'Movie Schedules', desc: 'Daily showtimes & order windows', status: 'upcoming', href: '/cinema/admin/shows', icon: CalendarDays },
    { step: 7, title: 'Screen QR Codes', desc: 'General & screen QR deployment', status: 'upcoming', href: '/cinema/admin/qr', icon: QrCode },
    { step: 8, title: 'Go Live', desc: 'Accept in-auditorium seat orders', status: 'upcoming', href: '/cinema/admin/dashboard', icon: Zap }
  ];

  // Auth Guard: Before onboarding, user MUST have created an account & signed in!
  useEffect(() => {
    if (sessionLoading) return;

    if (!session?.user) {
      // Redirect to sign up page first
      router.push('/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding');
      return;
    }

    // Check if user already has an active cinema theatre
    apiRequest('/api/restaurants/my?tenantType=cinema')
      .then((tenants) => {
        const cinemaTenant = Array.isArray(tenants) && tenants.find((m: any) => m.restaurant?.tenantType === 'cinema');
        if (cinemaTenant?.restaurant?.id) {
          // If already registered, check if onboarding is in progress or completed
          apiRequest('/api/cinema/onboarding/status', { theatreId: cinemaTenant.restaurant.id })
            .then((status) => {
              if (status?.isComplete) {
                router.push('/cinema/admin/dashboard');
              } else {
                setCreatedData({ theatre: cinemaTenant.restaurant });
                setSubmitted(true);
                setCheckingExisting(false);
              }
            })
            .catch(() => {
              router.push('/cinema/admin/dashboard');
            });
        } else {
          setCheckingExisting(false);
          // Pre-fill email from logged in user account
          if (session.user.email) {
            setFormData((prev) => ({
              ...prev,
              contactEmail: prev.contactEmail || session.user.email
            }));
          }
        }
      })
      .catch((err) => {
        console.warn('Could not check existing cinema theatres:', err);
        setCheckingExisting(false);
      });
  }, [session, sessionLoading, router]);

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
      router.push('/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding');
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

  // Loading Screen while verifying authentication & existing theatre
  if (sessionLoading || checkingExisting || !session?.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-slate-400 font-medium">
          Verifying cinema administrator account...
        </p>
      </div>
    );
  }

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
            {/* Authenticated user pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-medium truncate max-w-[150px]">{session.user.name || session.user.email}</span>
            </div>

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
                Step 2 of 2: Configure your theatre identity, city, timezone, and contact details to begin setting up screens, rows, and in-auditorium seat ordering.
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

        {/* Step 1 Account Confirmation Notification */}
        <div className="mb-6 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white">Step 1 Complete: </span>
              <span className="text-slate-300">
                Administrator account verified for <strong className="text-white">{session.user.name}</strong> ({session.user.email}).
              </span>
            </div>
          </div>
          <span className="text-indigo-400 font-bold bg-indigo-900/50 px-2.5 py-1 rounded-lg border border-indigo-800/80 shrink-0">
            Now Complete Step 2: Theatre Details ↓
          </span>
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
                const isCurrent = step.status === 'current';
                const isCompleted = step.status === 'completed';
                return (
                  <div
                    key={step.step}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                      isCurrent
                        ? 'bg-indigo-950/70 border-indigo-600/80 text-white shadow-md shadow-indigo-950'
                        : isCompleted
                        ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : isCompleted
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${isCurrent ? 'text-white' : isCompleted ? 'text-emerald-200' : 'text-slate-300'}`}>
                          {step.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-900/80 px-2 py-0.5 rounded-full">
                            Step {step.step}
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                            Done
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
              <div className="py-6 px-2 sm:px-4 max-w-2xl mx-auto space-y-8">
                {/* Header Confirmation */}
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-950/60">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Step 1 of 8 Complete • Profile Registered</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {createdData?.theatre?.name || formData.theatreName}
                  </h2>
                  <p className="text-slate-300 text-sm leading-relaxed max-w-lg mx-auto">
                    Theatre identity registered under slug{' '}
                    <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded font-mono font-bold">
                      {createdData?.theatre?.slug}
                    </code>{' '}
                    with dedicated <strong className="text-white">cinema</strong> tenant isolation.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="p-6 rounded-2xl bg-indigo-950/40 border border-indigo-700/60 shadow-xl space-y-4 text-center">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-400">
                      Recommended Next Step
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      Step 2: Add Your Cinema Screens &amp; Auditoriums
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto">
                      Add your auditoriums (e.g. Screen 1, Screen 2, IMAX) to establish the physical layout for seat ordering.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Link
                      href="/cinema/admin/screens"
                      className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                    >
                      <span>Continue to Step 2: Add Screens</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/cinema/admin/dashboard"
                      className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-bold transition flex items-center justify-center gap-2"
                    >
                      <span>Go to Dashboard</span>
                    </Link>
                  </div>
                </div>

                {/* Summary Metadata Card */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2.5 text-slate-300">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                    Registered Profile Specifications
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">City &amp; State:</span>
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
                    <span className="text-slate-500 font-semibold">Base Currency:</span>
                    <span className="text-emerald-400 font-bold">INR (₹)</span>
                  </div>
                </div>

                {/* Full 8-Step Interactive Setup Journey */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Full Onboarding Pipeline</h3>
                      <p className="text-xs text-slate-400">Complete these sequential stages to launch seat ordering</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded-full border border-indigo-800">
                      1 of 8 Complete
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    {roadmapSteps.map((s) => {
                      const Icon = s.icon || Film;
                      const isStep1 = s.step === 1;
                      const isStep2 = s.step === 2;

                      return (
                        <div
                          key={s.step}
                          className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                            isStep1
                              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                              : isStep2
                              ? 'bg-indigo-950/40 border-indigo-600/80 text-white ring-1 ring-indigo-500/50'
                              : 'bg-slate-950/40 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black uppercase text-slate-400">
                                Step {s.step}
                              </span>
                              {isStep1 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Completed</span>
                                </span>
                              ) : isStep2 ? (
                                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-900 px-2 py-0.5 rounded-full border border-indigo-700">
                                  Next Action
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500">
                                  Upcoming
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mb-1.5">
                              <Icon className={`w-4 h-4 ${isStep1 ? 'text-emerald-400' : isStep2 ? 'text-indigo-400' : 'text-slate-500'}`} />
                              <h4 className={`text-sm font-bold ${isStep1 ? 'text-emerald-200' : isStep2 ? 'text-white' : 'text-slate-300'}`}>
                                {s.title}
                              </h4>
                            </div>

                            <p className="text-xs text-slate-400 leading-relaxed mb-3">
                              {s.desc}
                            </p>
                          </div>

                          {isStep2 ? (
                            <Link
                              href="/cinema/admin/screens"
                              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>Configure Screens Now</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          ) : (
                            <Link
                              href={s.href}
                              className={`text-xs font-semibold flex items-center gap-1 ${
                                isStep1 ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              <span>{isStep1 ? 'View Settings' : 'Go to Page'}</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    Step 2: Theatre Profile Information
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
                        placeholder="e.g. Cinepolis Nexus Grand / PVR INOX Forum"
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
                        placeholder="e.g. Cinepolis / PVR / Independent"
                        value={formData.chainOrBrand}
                        onChange={(e) => setFormData({ ...formData, chainOrBrand: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Official Contact Phone (+91) <span className="text-rose-500">*</span>
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

                  {/* Street Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Auditorium / Theatre Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <textarea
                        required
                        rows={2}
                        placeholder="Level 4, Nexus Mall, Koramangala"
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
                      placeholder="e.g. Bengaluru, Mumbai, Hyderabad"
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

                  {/* Contact Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Official Contact Email <span className="text-rose-500">*</span>
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

                  {/* Business Details / Registration */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      GSTIN / Business Reg (Optional)
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="e.g. 29AAAAA0000A1Z5"
                        value={formData.businessDetails}
                        onChange={(e) => setFormData({ ...formData, businessDetails: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Indian Market Defaults (Section 4) */}
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Target Market</span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-400" />
                        India (Initial Market)
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
                        <span>Save &amp; Complete Theatre Setup</span>
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
        <p>MenuGo Cinema Module • Multi-Tenant Enterprise Architecture • Razorpay &amp; Paytm Ready</p>
      </footer>
    </div>
  );
}
