'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { formatPaise } from '@/lib/utils';
import { useRealtimeSubscription, isStaleEvent } from '@/lib/realtime-client';
import { OrderStatus, getStatusDisplayInfo } from '@menugo/shared';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  UtensilsCrossed,
  Flame,
  Check,
  ChefHat,
  ShoppingBag,
  ArrowLeft,
  Wifi,
  WifiOff,
  Film,
  Armchair,
  ClipboardList
} from 'lucide-react';

interface TrackedOrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
}

interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  statusToken: string;
  customerName?: string | null;
  specialInstructions?: string | null;
  createdAt: string;
  updatedAt?: string;
  restaurant?: {
    name: string;
    slug: string;
    currency?: string;
  } | null;
  table?: {
    tableNumber: string | null;
  } | null;
  cinema?: {
    seatRow?: string | null;
    seatNumber?: string | null;
    showDate?: string | null;
    showtime?: string | null;
    theatreToken?: string | null;
  } | null;
  items: TrackedOrderItem[];
}

const LIFECYCLE_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'new', label: 'Order Received', description: 'Your order was sent to the kitchen' },
  { status: 'accepted', label: 'Accepted', description: 'Kitchen acknowledged your order' },
  { status: 'preparing', label: 'Preparing', description: 'Chef is cooking your dishes' },
  { status: 'ready', label: 'Ready to Serve', description: 'Food is prepared, on its way to table' },
  { status: 'served', label: 'Served', description: 'Delivered to your table. Enjoy!' }
];

export default function OrderTrackingPage() {
  const params = useParams();
  const token = params.token as string;
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    setSessionToken(new URLSearchParams(window.location.search).get('session'));
  }, []);

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authoritative API fetch (System of Record)
  const loadAuthoritativeOrder = useCallback(
    async (isManualRefresh = false) => {
      if (!token) return;
      if (isManualRefresh) setRefreshing(true);
      setError(null);

      try {
        const data = await apiRequest<TrackedOrder>(`/api/orders/status/${token}`);
        setOrder(data);
      } catch (err: any) {
        setError(err.message || 'Unable to find order for this tracking token.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  // Initial fetch on mount
  useEffect(() => {
    loadAuthoritativeOrder();
  }, [loadAuthoritativeOrder]);

  // Realtime subscription via unguessable status token (Requirements 3, 5, 6, 7)
  const { isConnected, isReconnecting, isStale, refetch } = useRealtimeSubscription(
    {
      channelType: 'order',
      channelId: token,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      staleThresholdMs: 40000
    },
    (eventType, payload) => {
      // Handle incoming notification
      setOrder((prev) => {
        if (!prev) return prev;

        // Drop out-of-order event if older than current state
        if (payload?.updatedAt && prev.updatedAt && isStaleEvent(payload.updatedAt, prev.updatedAt)) {
          return prev;
        }

        const newStatus = (payload?.status as OrderStatus) || prev.status;
        return {
          ...prev,
          status: newStatus,
          updatedAt: payload?.updatedAt || new Date().toISOString()
        };
      });
    },
    () => loadAuthoritativeOrder(false)
  );

  const isCinema = Boolean(order?.cinema);
  const steps = useMemo(() => {
    if (isCinema) {
      return [
        { status: 'new' as OrderStatus, label: 'Order Received', description: 'Your order was sent to the concessions kitchen' },
        { status: 'accepted' as OrderStatus, label: 'Preparing', description: 'Concessions team is preparing your snacks & drinks' },
        { status: 'ready' as OrderStatus, label: 'Ready for Delivery', description: 'Food is boxed, on the way to your auditorium seat' },
        { status: 'delivered' as OrderStatus, label: 'Delivered to Seat', description: 'Delivered to your auditorium seat. Enjoy the movie!' }
      ];
    }
    return [
      { status: 'new' as OrderStatus, label: 'Order Received', description: 'Your order was sent to the kitchen' },
      { status: 'accepted' as OrderStatus, label: 'Accepted', description: 'Kitchen acknowledged your order' },
      { status: 'preparing' as OrderStatus, label: 'Preparing', description: 'Chef is cooking your dishes' },
      { status: 'ready' as OrderStatus, label: 'Ready to Serve', description: 'Food is prepared, on its way to table' },
      { status: 'served' as OrderStatus, label: 'Served', description: 'Delivered to your table. Enjoy your meal!' }
    ];
  }, [isCinema]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-red-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">Loading Order Tracker...</h2>
        <p className="text-xs text-slate-500 mt-1">Connecting to live restaurant kitchen feed</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Order Not Found</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-1">{error || 'This order link is invalid or expired.'}</p>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => loadAuthoritativeOrder(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 transition"
          >
            Retry
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to Homepage</span>
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusDisplayInfo(order.status);
  const normalizedStatus: OrderStatus =
    order.status === 'pending'
      ? 'new'
      : isCinema && order.status === 'preparing'
      ? 'accepted'
      : isCinema && order.status === 'served'
      ? 'delivered'
      : !isCinema && order.status === 'delivered'
      ? 'served'
      : order.status;
  const currentStepIdx = steps.findIndex((s) => s.status === normalizedStatus);
  const isCancelled = order.status === 'cancelled';
  const isServed = order.status === 'served' || order.status === 'delivered';

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-900 flex flex-col font-sans selection:bg-red-500 selection:text-white pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white  border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-700 text-white">
            {order.cinema ? <Film className="w-4 h-4" /> : <UtensilsCrossed className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-slate-900 leading-tight truncate">
              {order.restaurant?.name || (order.cinema ? 'Cinema Order Tracker' : 'Restaurant Order Tracker')}
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {order.cinema?.seatNumber
                ? `Seat ${order.cinema.seatNumber}${order.cinema.seatRow ? ` (Row ${order.cinema.seatRow})` : ''}`
                : order.table?.tableNumber
                ? `Table ${order.table.tableNumber}`
                : 'Takeaway'}{' '}
              • Order #{order.orderNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Live Status Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-700" />
                <span>Syncing</span>
              </>
            )}
          </span>

          {/* Refresh Button */}
          <button
            onClick={() => loadAuthoritativeOrder(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition disabled:opacity-50"
            title="Refresh Order Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-600' : ''}`} />
          </button>
        </div>
      </header>

      {/* Stale Warning Banner */}
      {isStale && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center justify-between">
          <span>Updates delayed. Tap refresh for latest status.</span>
          <button
            onClick={() => loadAuthoritativeOrder(true)}
            className="font-bold underline ml-2 hover:text-red-700"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Main Tracker Container */}
      <main className="max-w-lg mx-auto w-full p-4 space-y-6">
        {/* Status Highlight Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none"></div>

          {isCancelled ? (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-red-700">Order Cancelled</h2>
              <p className="text-xs text-slate-500">
                This order was cancelled or could not be prepared. Please speak with floor staff for assistance.
              </p>
            </div>
          ) : isServed ? (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto shadow-sm shadow-emerald-950/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200">
                Order Completed & Delivered
              </span>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Order #{order.orderNumber}</h2>
              <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                {isCinema
                  ? 'Your snacks and drinks have been delivered to your seat. Enjoy the movie!'
                  : 'Your dishes have been served to your table. Enjoy your meal!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <span
                className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${statusInfo.badgeClass}`}
              >
                {statusInfo.label}
              </span>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Order #{order.orderNumber}</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">{statusInfo.description}</p>
            </div>
          )}
        </div>

        {/* Lifecycle Stepper */}
        {!isCancelled && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-6">
              Preparation Progress
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {steps.map((step, idx) => {
                const isPassed = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;

                return (
                  <div key={step.status} className="relative flex items-start gap-3">
                    {/* Step Dot */}
                    <div
                      className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${
                        isCurrent
                          ? 'bg-red-700 text-white border-red-700'
                          : isPassed
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-[#f7f7f8] text-slate-600 border-slate-200'
                      }`}
                    >
                      {isPassed && !isCurrent ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                    </div>

                    <div className="flex-1">
                      <p
                        className={`text-sm font-bold leading-tight ${
                          isCurrent ? 'text-red-700' : isPassed ? 'text-slate-700' : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Items Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Order Summary</h3>
            <span className="text-xs text-slate-500">
              {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {order.items?.map((item, idx) => (
              <div key={idx} className="py-2.5 first:pt-0 flex justify-between items-start gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="font-bold text-red-700 text-sm shrink-0">{item.quantity}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 truncate">{item.productName}</p>
                    {item.notes && <p className="text-xs text-amber-700 italic mt-0.5 break-words">Note: {item.notes}</p>}
                  </div>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-600 shrink-0">
                  {formatPaise(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {order.specialInstructions && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800">
              <span className="font-bold text-red-700 block mb-0.5">Instructions:</span>
              {order.specialInstructions}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-600">Total Amount</span>
            <span className="text-lg font-semibold font-mono text-slate-900">{formatPaise(order.totalAmount)}</span>
          </div>
        </div>

        {/* Return to Menu Button */}
        {isCinema ? (
          order.cinema?.theatreToken ? (
            <div className="text-center pt-2">
              <Link
                href={`/cinema/${order.cinema.theatreToken}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 hover:text-red-800 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Cinema Concessions Menu</span>
              </Link>
            </div>
          ) : null
        ) : order.restaurant?.slug ? (
          <div className="text-center pt-2">
            <Link
              href={`/menu/${order.restaurant.slug}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Restaurant Menu</span>
            </Link>
          </div>
        ) : null}
        {sessionToken && (
          <div className="pt-2 text-center">
            <Link href={`/track/session/${sessionToken}`} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800 hover:bg-red-100">
              <ClipboardList className="h-4 w-4" /> View all orders from this visit
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

