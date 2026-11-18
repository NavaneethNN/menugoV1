'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChefHat, ExternalLink, ArrowRight } from 'lucide-react';

export default function CinemaAdminKitchenPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/cinema/kitchen');
  }, [router]);

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/30">
        <ChefHat className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Cinema Kitchen Display System (KDS)</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        Opening dedicated full-screen kitchen preparation console...
      </p>
      <Link
        href="/cinema/kitchen"
        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-colors"
      >
        <span>Open Kitchen KDS</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
