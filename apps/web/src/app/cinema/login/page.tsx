'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CinemaLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/login?business=cinema');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
      <p className="text-xs text-slate-400">Redirecting to Cinema Console Login...</p>
    </div>
  );
}
