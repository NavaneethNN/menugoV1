'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { RestaurantOnboardingForm } from '@/components/RestaurantOnboardingForm';
import { apiRequest } from '@/lib/api';
import { Store, Loader2, ArrowLeft } from 'lucide-react';
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-red-700" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-red-700 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Homepage</span>
            </Link>
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-red-700 text-white font-extrabold flex items-center justify-center text-lg">
                M
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">
                Menu<span className="text-red-700">Go</span>
              </span>
            </Link>
          </div>
          <div className="sm:text-right">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Register Your Restaurant
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-lg">
              Set up your restaurant profile and customer ordering link.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 flex-1">
        <div className="bg-white p-5 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
          <RestaurantOnboardingForm
            onSuccess={() => {
              router.push('/admin/dashboard');
            }}
            onCancel={() => {
              router.push('/admin/dashboard');
            }}
          />
        </div>
      </main>
    </div>
  );
}

