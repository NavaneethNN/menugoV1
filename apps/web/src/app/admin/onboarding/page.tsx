'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { RestaurantOnboardingForm } from '@/components/RestaurantOnboardingForm';
import { Store, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function RestaurantOnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/admin/login');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center px-4">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white font-extrabold flex items-center justify-center text-xl shadow-md">
            M
          </div>
          <span className="font-black text-2xl text-slate-900">
            Menu<span className="text-orange-600">Go</span>
          </span>
        </Link>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          Register Your Restaurant
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Set up your digital presence, unique customer QR slug, and contact profile to start serving contactless orders.
        </p>
      </div>

      {/* Main Form Container */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200">
          <RestaurantOnboardingForm
            onSuccess={() => {
              router.push('/admin/dashboard');
            }}
            onCancel={() => {
              router.push('/admin/dashboard');
            }}
          />
        </div>
      </div>
    </div>
  );
}

