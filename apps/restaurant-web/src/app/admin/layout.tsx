'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { Loader2, Film } from 'lucide-react';
import { RestaurantAdminNavigation } from '@/components/admin/RestaurantAdminNavigation';

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [checkingAccount, setCheckingAccount] = useState(true);
  const [isCinemaAccount, setIsCinemaAccount] = useState(false);

  // Exclude login and invitation acceptance from tenant guard
  const isExcludedRoute =
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login/') ||
    pathname.startsWith('/admin/invitations');

  useEffect(() => {
    if (isExcludedRoute) {
      setCheckingAccount(false);
      return;
    }

    if (sessionLoading) return;

    if (!session?.user) {
      setCheckingAccount(false);
      return;
    }

    // Verify account domain: theatre accounts cannot access restaurant dashboard or onboarding
    apiRequest('/api/auth/account-type')
      .then((accountInfo) => {
        if (accountInfo?.tenantType === 'cinema') {
          setIsCinemaAccount(true);
          router.replace('/cinema/admin/dashboard');
        } else {
          setCheckingAccount(false);
        }
      })
      .catch((err) => {
        console.warn('Could not verify account type in admin layout:', err);
        setCheckingAccount(false);
      });
  }, [session, sessionLoading, pathname, isExcludedRoute, router]);

  // If on login or public invitation, render children directly
  if (isExcludedRoute) {
    return <>{children}</>;
  }

  // Redirecting cinema account away from restaurant dashboard/onboarding
  if (isCinemaAccount) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
          <Film className="w-7 h-7" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-3" />
        <h2 className="text-lg font-bold text-white mb-1">Theatre Account Detected</h2>
        <p className="text-xs text-slate-400 text-center max-w-sm">
          This account is configured for cinema theatres. Redirecting to Cinema Management Console...
        </p>
      </div>
    );
  }

  // Initial verification state
  if (checkingAccount && session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f9] lg:pl-[248px]">
      <RestaurantAdminNavigation />
      {children}
    </div>
  );
}
