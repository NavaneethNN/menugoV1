'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Lock,
  Tv,
  Film,
  UtensilsCrossed,
  CreditCard,
  CalendarDays,
  QrCode,
  Zap,
  Settings,
  X
} from 'lucide-react';

interface Stage {
  key: string;
  step: number;
  title: string;
  description: string;
  isCompleted: boolean;
  isLocked: boolean;
}

interface OnboardingStatus {
  theatreId: string;
  theatreName: string;
  currentStage: string;
  isComplete: boolean;
  completedCount: number;
  totalCount: number;
  percentage: number;
  stages: Stage[];
}

const STAGE_ROUTES: Record<string, string> = {
  profile_completed: '/cinema/admin/settings',
  screens_added: '/cinema/admin/screens',
  seating_configured: '/cinema/admin/seating',
  menu_configured: '/cinema/admin/menu',
  payment_configured: '/cinema/admin/payments',
  shows_scheduled: '/cinema/admin/shows',
  qr_generated: '/cinema/admin/qr',
  ordering_activated: '/cinema/admin/dashboard'
};

const STAGE_ICONS: Record<string, any> = {
  profile_completed: Settings,
  screens_added: Tv,
  seating_configured: Film,
  menu_configured: UtensilsCrossed,
  payment_configured: CreditCard,
  shows_scheduled: CalendarDays,
  qr_generated: QrCode,
  ordering_activated: Zap
};

export function CinemaOnboardingBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [pathname]);

  const loadStatus = async () => {
    try {
      // Find active theatre
      const myTenants = await apiRequest('/api/restaurants/my?tenantType=cinema').catch(() => []);
      const active = myTenants.find((m: any) => m.restaurant?.tenantType === 'cinema');
      if (!active?.restaurant?.id) {
        setLoading(false);
        return;
      }

      const res = await apiRequest('/api/cinema/onboarding/status', {
        theatreId: active.restaurant.id
      });
      setStatus(res);
    } catch {
      // Silent fail if not accessible
    } finally {
      setLoading(false);
    }
  };

  // If completed or dismissed or loading, don't show
  if (loading || !status || status.isComplete || dismissed) {
    return null;
  }

  // Determine the next incomplete, unlocked stage
  const nextStage = status.stages.find((s) => !s.isCompleted && !s.isLocked) || status.stages.find((s) => !s.isCompleted) || status.stages[1];
  const nextRoute = nextStage ? STAGE_ROUTES[nextStage.key] || '/cinema/admin/screens' : '/cinema/admin/screens';

  return (
    <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border-b border-indigo-800/60 text-white px-4 sm:px-6 py-3 shadow-md relative z-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Progress Summary */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold uppercase tracking-wider text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/80 text-[10px]">
                Setup Wizard
              </span>
              <span className="font-bold text-white">
                Stage {status.completedCount} of {status.totalCount} Complete
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-400 font-bold">{status.percentage}%</span>
            </div>

            {/* Micro progress bar */}
            <div className="w-48 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden border border-slate-700/60">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(status.percentage, 5)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end md:self-auto">
          {/* Toggle all steps view */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 font-semibold transition flex items-center gap-1.5"
          >
            <span>{expanded ? 'Hide Steps' : 'View 8 Steps'}</span>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {/* Primary Next Action Button */}
          {nextStage && (
            <Link
              href={nextRoute}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/30"
            >
              <span>Next: Step {nextStage.step} ({nextStage.title})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}

          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            title="Dismiss banner"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible 8-Step Pipeline Checklist */}
      {expanded && (
        <div className="max-w-7xl mx-auto pt-4 mt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {status.stages.map((stage) => {
            const Icon = STAGE_ICONS[stage.key] || Film;
            const route = STAGE_ROUTES[stage.key] || '/cinema/admin/dashboard';
            const isCurrentPage = pathname === route;

            return (
              <Link
                key={stage.key}
                href={stage.isLocked ? '#' : route}
                onClick={(e) => {
                  if (stage.isLocked) {
                    e.preventDefault();
                  } else {
                    setExpanded(false);
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  stage.isCompleted
                    ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200 hover:bg-emerald-950/50'
                    : isCurrentPage
                    ? 'bg-indigo-900/60 border-indigo-500 text-white ring-1 ring-indigo-500'
                    : !stage.isLocked
                    ? 'bg-indigo-950/30 border-indigo-800/60 text-slate-200 hover:bg-indigo-900/40'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    Step {stage.step}
                  </span>
                  {stage.isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : stage.isLocked ? (
                    <Lock className="w-3 h-3 text-slate-600 shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  )}
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                  <span className="font-bold text-[11px] truncate">
                    {stage.title}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
