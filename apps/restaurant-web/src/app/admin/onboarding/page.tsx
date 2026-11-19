'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { RestaurantOnboardingForm } from '@/components/RestaurantOnboardingForm';
import { apiRequest } from '@/lib/api';
import { Loader2, ArrowLeft, ArrowUpRight, BadgeCheck, BarChart3, ClipboardCheck, QrCode, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function RestaurantOnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/admin/login');
      return;
    }

    if (session?.user) {
      apiRequest('/api/auth/account-type')
        .then((accountInfo) => {
          if (accountInfo?.tenantType === 'cinema') {
            router.replace('/cinema/admin/dashboard');
          }
        })
        .catch(() => {});
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-red-700" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f7f7f8] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="The QROS home" className="flex items-center gap-3">
            <img src="/qros_logo.png" alt="The QROS" className="h-10 w-28 object-contain" />
            <span className="hidden h-8 border-l border-slate-200 sm:block" />
            <span className="hidden text-sm font-semibold tracking-wide text-slate-600 sm:block">FOR RESTAURANTS</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-red-700">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to homepage</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-red-700">
            <span className="h-px w-7 bg-red-700" /> Restaurant partner setup
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Bring your restaurant online.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Create your business profile to start building a smoother, more connected guest experience with QROS.</p>
        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-[0.78fr_1.42fr] lg:gap-8">
          <aside className="relative overflow-hidden rounded-lg bg-[#a81023] p-7 text-white shadow-sm sm:p-9">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-10 -top-14 h-52 w-52 rounded-full border border-white/10" />
            <div className="relative">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10"><QrCode className="h-5 w-5" /></div>
              <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-red-100">One simple setup</p>
              <h2 className="mt-2 max-w-sm text-2xl font-semibold leading-tight sm:text-[28px]">A stronger foundation for every service.</h2>
              <p className="mt-4 text-sm leading-6 text-red-100">Your profile gives your team a home for digital menus, table ordering and day-to-day operations.</p>
              <div className="mt-8 space-y-5 border-t border-white/20 pt-7">
                <div className="flex gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><ClipboardCheck className="h-4 w-4" /></div><div><p className="text-sm font-semibold">A professional guest presence</p><p className="mt-1 text-xs leading-5 text-red-100">Set your restaurant name and customer menu address.</p></div></div>
                <div className="flex gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><BarChart3 className="h-4 w-4" /></div><div><p className="text-sm font-semibold">Tools built for service</p><p className="mt-1 text-xs leading-5 text-red-100">Manage ordering and operations from one workspace.</p></div></div>
              </div>
              <div className="mt-9 flex items-center gap-2 text-xs font-medium text-red-100"><ShieldCheck className="h-4 w-4" /> Your business details stay protected</div>
            </div>
          </aside>

          <section className="rounded-lg border border-slate-200 bg-white shadow-[0_12px_40px_-30px_rgba(15,23,42,0.3)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-red-700"><BadgeCheck className="h-4 w-4" /> Business profile</div>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Restaurant details</h2>
                <p className="mt-1 text-sm text-slate-500">Complete the information below to create your workspace.</p>
              </div>
              <span className="hidden items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Step 1 of 1</span>
            </div>
            <div className="p-6 sm:p-8">
              <RestaurantOnboardingForm
                onSuccess={() => { router.push('/admin/dashboard'); }}
                onCancel={() => { router.push('/admin/dashboard'); }}
              />
            </div>
          </section>
        </div>
        <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} The QROS. Restaurant operations, made simpler.</span>
          <Link href="/" className="inline-flex items-center gap-1 font-semibold text-slate-600 transition hover:text-red-700">Learn about QROS <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </footer>
      </main>
    </div>
  );
}

