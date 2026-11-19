'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, Clock, Loader2, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatPaise } from '@/lib/utils';

type SessionOrder = {
  orderNumber: string;
  status: string;
  totalAmount: number;
  statusToken: string;
  createdAt: string;
  items: Array<{ productName: string; quantity: number; subtotal: number }>;
};

type SessionData = {
  session: {
    status: 'active' | 'closed';
    openedAt: string;
    closedAt: string | null;
    tableNumber: string | null;
    restaurant: { name: string | null; slug: string | null; currency: string };
  };
  orders: SessionOrder[];
};

const statusClass = (status: string) => {
  if (['served', 'delivered', 'completed'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (['ready', 'preparing', 'accepted'].includes(status)) return 'bg-red-50 text-red-800 border-red-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

export default function RestaurantSessionTrackingPage() {
  const params = useParams();
  const token = String(params.token || '');
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async (manual = false) => {
    if (!token) return;
    if (manual) setRefreshing(true);
    try {
      const result = await apiRequest<SessionData>(`/api/orders/session/${token}`);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'This visit session could not be found.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => {
    if (data?.session.status !== 'active') return;
    const interval = window.setInterval(() => loadSession(), 20000);
    return () => window.clearInterval(interval);
  }, [data?.session.status, loadSession]);

  if (loading) return <CenteredState><Loader2 className="h-7 w-7 animate-spin text-red-700" /><p className="text-sm text-slate-600">Loading your visit history…</p></CenteredState>;
  if (!data || error) return <CenteredState><AlertCircle className="h-8 w-8 text-red-700" /><h1 className="text-lg font-semibold text-slate-900">Visit not found</h1><p className="max-w-sm text-sm text-slate-600">{error || 'This visit link is invalid.'}</p><Link href="/" className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white">Go to homepage</Link></CenteredState>;

  const { session, orders } = data;
  const isClosed = session.status !== 'active';

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700"><UtensilsCrossed className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{session.restaurant.name || 'Restaurant'}</p><p className="text-xs text-slate-500">{session.tableNumber ? `Table ${session.tableNumber}` : 'Your visit'}</p></div></div>
          <button onClick={() => loadSession(true)} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">Visit order history</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Orders from this visit</h1><p className="mt-1 text-sm text-slate-600">Opened {new Date(session.openedAt).toLocaleString()}</p></div>
          <span className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${isClosed ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${isClosed ? 'bg-slate-400' : 'bg-emerald-600'}`} />{isClosed ? 'Session closed' : 'Session active'}</span>
        </div>
        {isClosed && <div className="mb-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">This dining session has been closed by the cashier. Order history for this visit is no longer available.</div>}
        {!isClosed && orders.length === 0 && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center"><Clock className="mx-auto h-7 w-7 text-red-700" /><h2 className="mt-3 text-base font-semibold">No orders yet</h2><p className="mt-1 text-sm text-slate-600">Orders placed during this visit will appear here.</p></div>}
        {!isClosed && <div className="space-y-3">{orders.map((order) => (
          <article key={order.statusToken} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div><p className="text-sm font-semibold">Order #{order.orderNumber}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}</p></div>
              <div className="flex items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass(order.status)}`}>{order.status}</span><span className="text-sm font-semibold">{formatPaise(order.totalAmount, session.restaurant.currency)}</span></div>
            </div>
            <div className="px-4 py-3"><ul className="space-y-1.5">{order.items.map((item, index) => <li key={`${item.productName}-${index}`} className="flex justify-between gap-4 text-xs text-slate-600"><span>{item.quantity} × {item.productName}</span><span>{formatPaise(item.subtotal, session.restaurant.currency)}</span></li>)}</ul><Link href={`/track/${order.statusToken}`} className="mt-3 inline-flex text-xs font-semibold text-red-700 hover:text-red-800">Track this order</Link></div>
          </article>
        ))}</div>}
        <p className="mt-5 text-center text-xs text-slate-500">This page updates automatically while the cashier session remains open.</p>
      </main>
    </div>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-5 text-center">{children}</main>;
}
