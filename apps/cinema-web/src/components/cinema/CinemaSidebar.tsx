'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Film,
  Tv,
  Armchair,
  Clapperboard,
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
      title: 'MANAGE',
      items: [
        {
          label: 'Overview',
          href: '/admin/dashboard',
          icon: LayoutDashboard,
          match: (path: string) => path === '/admin/dashboard' || path === '/cinema/admin/dashboard'
        },
        {
          label: 'Orders',
          href: '/admin/orders',
          icon: ShoppingBag,
          match: (path: string) => path.startsWith('/admin/orders') || path.startsWith('/cinema/admin/orders')
        },
        {
          label: 'Screens & Seating',
          href: '/admin/screens',
          icon: Tv,
          match: (path: string) =>
            path.startsWith('/admin/screens') ||
            path.startsWith('/admin/seating') ||
            path.startsWith('/cinema/admin/screens') ||
            path.startsWith('/cinema/admin/seating')
        },
        {
          label: 'Concessions Menu',
          href: '/admin/menu',
          icon: UtensilsCrossed,
          match: (path: string) => path.startsWith('/admin/menu') || path.startsWith('/cinema/admin/menu')
        },
        {
          label: 'Staff',
          href: '/admin/staff',
          icon: Users,
          match: (path: string) => path.startsWith('/admin/staff') || path.startsWith('/cinema/admin/staff')
        },
        {
          label: 'Reports',
          href: '/admin/reports',
          icon: BarChart3,
          match: (path: string) => path.startsWith('/admin/reports') || path.startsWith('/cinema/admin/reports')
        }
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          label: 'Kitchen KDS',
          href: '/kitchen',
          icon: ChefHat,
          match: (path: string) => path.startsWith('/kitchen') || path.startsWith('/cinema/kitchen')
        },
        {
          label: 'Seat Delivery',
          href: '/delivery',
          icon: Truck,
          match: (path: string) => path.startsWith('/delivery') || path.startsWith('/cinema/delivery')
        }
      ]
    },
    {
      title: 'SETUP',
      items: [
        {
          label: 'Plan & Billing',
          href: '/admin/billing',
          icon: CreditCard,
          match: (path: string) => path.startsWith('/admin/billing') || path.startsWith('/cinema/admin/billing')
        },
        {
          label: 'Payments',
          href: '/admin/payments',
          icon: CreditCard,
          match: (path: string) => path.startsWith('/admin/payments') || path.startsWith('/cinema/admin/payments')
        },
        {
          label: 'QR Codes',
          href: '/admin/qr',
          icon: QrCode,
          match: (path: string) => path.startsWith('/admin/qr') || path.startsWith('/cinema/admin/qr')
        },
        {
          label: 'Settings',
          href: '/admin/settings',
          icon: Settings,
          match: (path: string) => path.startsWith('/admin/settings') || path.startsWith('/cinema/admin/settings')
        }
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-700">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <Link
          href="/cinema/admin/dashboard"
          onClick={handleLinkClick}
          className="flex items-center gap-3 group min-w-0"
        >
          <img src="/qros_logo.png" alt="The QROS" className="w-24 h-10 rounded bg-white object-contain shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg text-slate-900 tracking-tight leading-tight">The QROS</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wider">
                Cinema
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate max-w-[130px] sm:max-w-[150px] font-medium mt-0.5">
              {theatreName || 'Theatre Console'}
            </p>
          </div>
        </Link>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {navigationSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors group border-l-2 ${
                    isActive
                      ? 'bg-red-50 text-red-800 font-semibold border-red-700'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50 border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-red-700' : 'text-slate-500 group-hover:text-slate-800'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Customer Seat View / QR Code Link */}
      {theatreSlug && (
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          <Link
            href="/cinema/admin/qr"
            onClick={handleLinkClick}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 text-xs font-semibold transition border border-slate-200 group"
          >
            <span className="flex items-center gap-2 min-w-0">
              <QrCode className="w-3.5 h-3.5 text-red-700 shrink-0" />
              <span className="truncate font-medium">Customer QR &amp; Seat View</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider shrink-0">
              Open
            </span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile & tablet) */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (visible on < lg when open) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/30 transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Body */}
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-white border-r border-slate-200 z-10 shadow-xl h-full animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
