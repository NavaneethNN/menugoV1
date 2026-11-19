'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  ClipboardList,
  ConciergeBell,
  LayoutDashboard,
  Package,
  PanelsTopLeft,
  QrCode,
  Users,
  Utensils,
  WalletCards
} from 'lucide-react';

const navigation = [
  { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Orders', href: '/admin/orders', icon: ClipboardList },
  { label: 'Menu products', href: '/admin/products', icon: Package },
  { label: 'Categories', href: '/admin/categories', icon: PanelsTopLeft },
  { label: 'Tables & QR codes', href: '/admin/tables', icon: QrCode },
  { label: 'Service', href: '/admin/service', icon: ConciergeBell },
  { label: 'Cashier', href: '/admin/cashier', icon: WalletCards },
  { label: 'Staff', href: '/admin/staff', icon: Users },
  { label: 'Billing', href: '/admin/billing', icon: CreditCard }
];

function isActive(pathname: string, href: string) {
  return href === '/admin/dashboard'
    ? pathname === href || pathname === '/admin/onboarding'
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function RestaurantAdminNavigation() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-slate-200 bg-white lg:flex">
        <Link href="/admin/dashboard" className="flex h-[72px] items-center border-b border-slate-100 px-6">
          <img src="/qros_logo.png" alt="The QROS" className="h-10 w-32 object-contain object-left" />
        </Link>
        <div className="px-4 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</div>
        <nav aria-label="Restaurant admin" className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-red-50 text-red-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <Icon className={`h-[17px] w-[17px] shrink-0 ${active ? 'text-red-700' : 'text-slate-400'}`} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Utensils className="h-3.5 w-3.5 text-red-700" /> Restaurant workspace</div>
        </div>
      </aside>

      <div className="border-b border-slate-200 bg-white lg:hidden">
        <nav aria-label="Restaurant admin" className="no-scrollbar flex h-11 items-center gap-1 overflow-x-auto px-3">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-medium ${
                  active ? 'bg-red-50 text-red-800' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
