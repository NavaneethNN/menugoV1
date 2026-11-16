'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Film,
  Tv,
  Armchair,
  Clapperboard,
  CalendarDays,
  UtensilsCrossed,
  ShoppingBag,
  ChefHat,
  Truck,
  CreditCard,
  Users,
  BarChart3,
  Settings,
  LayoutDashboard,
  ExternalLink,
  QrCode,
  X
} from 'lucide-react';

interface CinemaSidebarProps {
  theatreName?: string;
  theatreSlug?: string;
  role?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function CinemaSidebar({
  theatreName,
  theatreSlug,
  role,
  isOpen = false,
  onClose
}: CinemaSidebarProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const navigationSections = [
    {
      title: 'MANAGEMENT',
      items: [
        {
          label: 'Overview',
          href: '/cinema/admin/dashboard',
          icon: LayoutDashboard,
          match: (path: string) => path === '/cinema/admin/dashboard'
        },
        {
          label: 'Orders',
          href: '/cinema/admin/orders',
          icon: ShoppingBag,
          match: (path: string) => path.startsWith('/cinema/admin/orders')
        },
        {
          label: 'Screens & Seating',
          href: '/cinema/admin/screens',
          icon: Tv,
          match: (path: string) =>
            path.startsWith('/cinema/admin/screens') || path.startsWith('/cinema/admin/seating')
        },
        {
          label: 'Shows & Movies',
          href: '/cinema/admin/shows',
          icon: CalendarDays,
          match: (path: string) =>
            path.startsWith('/cinema/admin/shows') || path.startsWith('/cinema/admin/movies')
        },
        {
          label: 'Concessions Menu',
          href: '/cinema/admin/menu',
          icon: UtensilsCrossed,
          match: (path: string) => path.startsWith('/cinema/admin/menu')
        },
        {
          label: 'Settings & QR',
          href: '/cinema/admin/settings',
          icon: Settings,
          match: (path: string) =>
            path.startsWith('/cinema/admin/settings') ||
            path.startsWith('/cinema/admin/qr') ||
            path.startsWith('/cinema/admin/payments') ||
            path.startsWith('/cinema/admin/staff')
        }
      ]
    },
    {
      title: 'LIVE STATIONS',
      items: [
        {
          label: 'Kitchen KDS',
          href: '/cinema/kitchen',
          icon: ChefHat,
          match: (path: string) => path.startsWith('/cinema/kitchen')
        },
        {
          label: 'Seat Delivery',
          href: '/cinema/delivery',
          icon: Truck,
          match: (path: string) => path.startsWith('/cinema/delivery')
        }
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <Link
          href="/cinema/admin/dashboard"
          onClick={handleLinkClick}
          className="flex items-center gap-3 group min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white font-black flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform shrink-0">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg text-white tracking-tight leading-tight">MenuGo</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                Cinema
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[130px] sm:max-w-[150px] font-medium mt-0.5">
              {theatreName || 'Theatre Console'}
            </p>
          </div>
        </Link>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {navigationSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.match
                ? item.match(pathname)
                : pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 font-bold border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Customer Seat View / QR Code Link */}
      {theatreSlug && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <Link
            href="/cinema/admin/qr"
            onClick={handleLinkClick}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700/50 group shadow-xs"
          >
            <span className="flex items-center gap-2 min-w-0">
              <QrCode className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate font-medium">Customer QR &amp; Seat View</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile & tablet) */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 sticky top-0 h-screen z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (visible on < lg when open) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Body */}
          <div className="relative flex flex-col w-72 max-w-[85vw] border-r border-slate-800 z-10 shadow-2xl h-full animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
