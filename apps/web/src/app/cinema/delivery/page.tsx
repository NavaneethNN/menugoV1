'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket-client';
import { SOCKET_EVENTS } from '@menugo/shared';
import { playKitchenChime } from '@/lib/kds';
import {
  Truck,
  Armchair,
  Tv,
  Film,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  PackageCheck,
  ChefHat,
  ChevronRight,
  Loader2,
  ArrowRight,
  ShoppingBag,
  Bell,
  Search,
  Filter,
  Check
} from 'lucide-react';

interface DeliveryOrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  specialInstructions?: string | null;
}

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  customerName?: string | null;
  customerPhone?: string | null;
  screenId?: string | null;
  movieId?: string | null;
  showId?: string | null;
  seatRow?: string | null;
  seatNumber?: string | null;
  notes?: string | null;
  deliveryStatus?: string | null;
  deliveryStaffId?: string | null;
  deliveryStaffName?: string | null;
  assignedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  screenName?: string | null;
  screenType?: string | null;
  movieTitle?: string | null;
  showDate?: string | null;
  startTime?: string | null;
  items: DeliveryOrderItem[];
}

export default function CinemaDeliveryPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters & Tabs
  const [tab, setTab] = useState<'ready' | 'assigned_for_delivery' | 'delivered'>('ready');
  const [screenFilter, setScreenFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Audio & Socket
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const prevReadyCountRef = useRef(0);

  const initAudio = () => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
  };

  const fetchOrders = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const params = new URLSearchParams();
      if (tab) params.append('status', tab);
      if (screenFilter !== 'all') params.append('screenId', screenFilter);

      const res = await apiRequest(`/api/cinema/delivery/orders?${params.toString()}`);
      if (res.success) {
        const fetchedOrders: DeliveryOrder[] = res.orders || [];
        setOrders(fetchedOrders);

        // Sound chime if new ready orders arrived
        const readyCount = fetchedOrders.filter((o) => o.status === 'ready').length;
        if (readyCount > prevReadyCountRef.current && soundEnabled && !isSilent) {
          playKitchenChime(audioContextRef.current);
        }
        prevReadyCountRef.current = readyCount;
      }
    } catch (err: any) {
      console.error('Failed to fetch delivery orders:', err);
      setError(err.message || 'Failed to load delivery orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, screenFilter, soundEnabled]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Setup WebSocket for realtime new ready orders and status updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    setIsConnected(socket.connected);

    const handleOrderEvent = (data: any) => {
      // Re-fetch orders silently when an order is updated or marked ready
      fetchOrders(true);
      if (data?.status === 'ready' && soundEnabled) {
        playKitchenChime(audioContextRef.current);
      }
    };

    socket.on(SOCKET_EVENTS.ORDER_UPDATED, handleOrderEvent);
    socket.on(SOCKET_EVENTS.ORDER_CREATED, handleOrderEvent);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, handleOrderEvent);
      socket.off(SOCKET_EVENTS.ORDER_CREATED, handleOrderEvent);
    };
  }, [fetchOrders, soundEnabled]);

  const handleAssignOrder = async (orderId: string) => {
    try {
      setActionLoadingId(orderId);
      setError(null);

      await apiRequest(`/api/cinema/delivery/orders/${orderId}/assign`, {
        method: 'POST'
      });

      setSuccessMsg('Delivery assignment accepted! Head to the auditorium.');
      fetchOrders(true);
    } catch (err: any) {
      setError(err.message || 'Failed to assign delivery');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeliverOrder = async (orderId: string) => {
    try {
      setActionLoadingId(orderId);
      setError(null);

      await apiRequest(`/api/cinema/delivery/orders/${orderId}/deliver`, {
        method: 'POST'
      });

      setSuccessMsg('Order marked as delivered to seat successfully!');
      fetchOrders(true);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm delivery');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      (order.screenName && order.screenName.toLowerCase().includes(query)) ||
      (order.seatRow && order.seatRow.toLowerCase().includes(query)) ||
      (order.seatNumber && order.seatNumber.toLowerCase().includes(query)) ||
      (order.movieTitle && order.movieTitle.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-600/30">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Auditorium Seat Delivery
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
                Runner View
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Pickup prepared food from kitchen and deliver directly to patron seats.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Connection Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isConnected ? 'Realtime Live' : 'Reconnecting...'}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              initAudio();
              setSoundEnabled(!soundEnabled);
            }}
            title={soundEnabled ? 'Mute Chimes' : 'Enable Chimes'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audio On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                <span>Muted</span>
              </>
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/cinema/admin/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
          >
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* State Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start">
          <button
            onClick={() => setTab('ready')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tab === 'ready'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Ready for Pickup</span>
          </button>

          <button
            onClick={() => setTab('assigned_for_delivery')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tab === 'assigned_for_delivery'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>In-Transit / Dispatched</span>
          </button>

          <button
            onClick={() => setTab('delivered')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tab === 'delivered'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Delivered History</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search seat, row, screen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          <p className="text-sm font-medium">Loading delivery orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
          <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">
            {tab === 'ready'
              ? 'No orders ready for delivery right now'
              : tab === 'assigned_for_delivery'
              ? 'No active deliveries in transit'
              : 'No delivered orders in this view'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {tab === 'ready'
              ? 'Orders prepared by kitchen staff will appear here immediately for auditorium runner dispatch.'
              : 'Orders you claim for delivery will show up here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const isLoadingThis = actionLoadingId === order.id;

            return (
              <div
                key={order.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-all space-y-4"
              >
                {/* Seat Banner */}
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        #{order.orderNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                        Paid ₹{order.totalAmount}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Seat & Screen Focus Card */}
                  <div className="my-3 p-3.5 rounded-xl bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-800/40 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5" />
                        {order.screenName || 'Screen'} {order.screenType ? `(${order.screenType})` : ''}
                      </div>
                      <div className="text-2xl font-black text-white mt-0.5 tracking-tight flex items-center gap-1.5">
                        <Armchair className="w-5 h-5 text-sky-400" />
                        <span>Row {order.seatRow || '-'} • Seat {order.seatNumber || '-'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 truncate max-w-[120px] font-medium">
                        {order.movieTitle || 'Movie'}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-300">
                        {order.startTime || ''}
                      </div>
                    </div>
                  </div>

                  {/* Item List */}
                  <div className="space-y-1.5 py-1">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Ordered Items ({order.items?.length || 0})
                    </div>
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-sky-400 font-bold text-[11px] flex items-center justify-center">
                            {item.quantity}x
                          </span>
                          <span className="text-white font-medium">{item.productName}</span>
                        </div>
                        <span className="text-slate-400">₹{item.subtotal}</span>
                      </div>
                    ))}
                  </div>

                  {/* Special Instructions */}
                  {order.notes && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                      <span className="font-bold">Instructions:</span> {order.notes}
                    </div>
                  )}

                  {/* Delivery Runner Info if assigned */}
                  {order.deliveryStaffName && (
                    <div className="mt-2 text-xs text-sky-400 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      <span>Runner: <strong>{order.deliveryStaffName}</strong></span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-800">
                  {order.status === 'ready' && (
                    <button
                      onClick={() => handleAssignOrder(order.id)}
                      disabled={isLoadingThis}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all disabled:opacity-50"
                    >
                      {isLoadingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4" />
                      )}
                      <span>Accept Delivery & Head to Seat</span>
                    </button>
                  )}

                  {order.status === 'assigned_for_delivery' && (
                    <button
                      onClick={() => handleDeliverOrder(order.id)}
                      disabled={isLoadingThis}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                    >
                      {isLoadingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PackageCheck className="w-4 h-4" />
                      )}
                      <span>Confirm Delivered to Seat {order.seatRow}{order.seatNumber}</span>
                    </button>
                  )}

                  {order.status === 'delivered' && (
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Delivered at Seat</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
