'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CustomerMenuTableRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantSlug = params.restaurantSlug as string;

  useEffect(() => {
    if (restaurantSlug) {
      const qs = searchParams.toString();
      router.replace(`/menu/${restaurantSlug}${qs ? `?${qs}` : ''}`);
    }
  }, [restaurantSlug, searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
      <p className="text-xs font-semibold text-slate-500">Loading digital menu...</p>
    </div>
  );
}
