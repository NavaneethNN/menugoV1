'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket-client';
import {
  SOCKET_EVENTS,
  OrderStatus,
  RestaurantMemberRole
} from '@menugo/shared';
import {
  calculateElapsedMinutes,
  formatElapsedTime,
  getUrgencyLevel,
  getUrgencyBadgeStyles,
  playKitchenChime
} from '@/lib/kds';
import { EventDeduplicator } from '@/lib/realtime-client';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  RefreshCw,
  Utensils,
  Wifi,
  WifiOff,
  AlertCircle,
  ArrowRight,
  Flame,
  BellRing,
  Check,
  Columns3,
  LayoutGrid,
  ChevronDown,
  Sparkles,
  ShieldAlert,
  Loader2,
  Tv,
  Film,
  Armchair,
  ArrowLeft,
  X,
  Search,
  CheckCheck
} from 'lucide-react';

export interface CinemaKitchenOrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
}

export interface CinemaKitchenOrder {
  id: string;
  orderNumber: string;
  theatreId: string;
  orderType: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  specialInstructions: string | null;
  customerName: string | null;
  customerPhone: string | null;
  statusToken: string | null;
  createdAt: string;
  updatedAt: string;
  elapsedMinutes: number;
  screenId: string | null;
  screen?: {
    id: string;
    screenNumber?: number;
    name: string;
    screenName?: string;
    screenType?: string | null;
  } | null;
  movieId: string | null;
  movie?: {
    id: string;
    title: string;
    language: string;
    posterUrl?: string | null;
    durationMinutes?: number | null;
  } | null;
  showId: string | null;
  show?: {
    id: string;
    showDate: string;
    startTime: string;
    expectedEndTime?: string | null;
    status: string;
  } | null;
  showDate?: string | null;
  showtime?: string | null;
  seatRow?: string | null;
  seatNumber?: string | null;
  items: CinemaKitchenOrderItem[];
  statusHistory?: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedByUserId?: string | null;
    changedByRole: string;
    reason?: string | null;
    createdAt: string;
  }>;
}

export default function CinemaKitchenDashboardPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);

  // Theatre & User Context
  const [theatres, setTheatres] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [role, setRole] = useState<RestaurantMemberRole>('kitchen');

  // Orders State
  const [orders, setOrders] = useState<CinemaKitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Layout & Filter States
  const [viewMode, setViewMode] = useState<'columns' | 'grid'>('columns');
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'preparing' | 'ready'>('all');
  const [selectedScreenId, setSelectedScreenId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Realtime & Connectivity States
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Audio Notification States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [newOrderToast, setNewOrderToast] = useState<{
    id: string;
    orderNumber: string;
    screenName?: string | null;
    seat?: string | null;
  } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playedOrderIdsRef = useRef<Set<string>>(new Set());
  const deduplicatorRef = useRef(new EventDeduplicator());

  // Clock ticker for elapsed wait times (updates every 15 seconds)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Initialize WebAudio context
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current
        .resume()
        .then(() => setAudioUnlocked(true))
        .catch((e) => console.warn('Could not resume AudioContext:', e));
    } else if (audioContextRef.current && audioContextRef.current.state === 'running') {
      setAudioUnlocked(true);
    }
  }, []);

  // Check authentication & load cinema theatres
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login?business=cinema&redirect=/cinema/kitchen');
      return;
    }

    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadCinemaMemberships();
    }
  }, [sessionLoading, session, router]);

  const loadCinemaMemberships = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const memberships = await apiRequest('/api/restaurants/my');
      const cinemaList = (memberships || []).filter(
        (m: any) => m.restaurant?.tenantType === 'cinema'
      );

      if (cinemaList.length === 0) {
        setErrorMessage('No cinema theatre accounts found. Please register or join a theatre first.');
        setLoading(false);
        return;
      }

      setTheatres(cinemaList);
      const defaultTheatre = cinemaList[0];
      setSelectedMembership(defaultTheatre);
      setRole((defaultTheatre.role as RestaurantMemberRole) || 'kitchen');
    } catch (err: any) {
      console.error('Failed to load cinema profile:', err);
      setErrorMessage(err?.message || 'Failed to authenticate cinema staff membership');
      setLoading(false);
    }
  };

  const selectedTheatre = selectedMembership?.restaurant;
  const theatreId = selectedTheatre?.id;

  // Load Kitchen Orders from backend
  const fetchKitchenOrders = useCallback(
    async (silent = false) => {
      if (!theatreId) return;

      if (!silent) setRefreshing(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedScreenId && selectedScreenId !== 'all') {
          queryParams.set('screenId', selectedScreenId);
        }
        if (searchQuery.trim()) {
          queryParams.set('search', searchQuery.trim());
        }

        const res = await apiRequest(
          `/api/cinema/kitchen/orders?${queryParams.toString()}`,
          {
            headers: {
              'x-theatre-id': theatreId
            }
          }
        );

        if (res && Array.isArray(res.orders)) {
          setOrders(res.orders);
          setLastSyncTime(new Date());

          // Mark already existing open orders as played so we do not chime on initial load
          res.orders.forEach((o: CinemaKitchenOrder) => {
            playedOrderIdsRef.current.add(o.id);
          });
        }
        setErrorMessage(null);
      } catch (err: any) {
        console.error('Failed to fetch cinema kitchen orders:', err);
        if (!silent) {
          setErrorMessage(err?.message || 'Failed to refresh kitchen orders');
        }
      } finally {
        setLoading(false);
        if (!silent) setRefreshing(false);
      }
    },
    [theatreId, selectedScreenId, searchQuery]
  );

  // Fetch orders when theatre changes or filter updates
  useEffect(() => {
    if (theatreId) {
      fetchKitchenOrders();
    }
  }, [theatreId, selectedScreenId, fetchKitchenOrders]);

  // Realtime Socket Connection
  useEffect(() => {
    if (!theatreId) return;

    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('restaurant:join', { restaurantId: theatreId });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    if (socket.connected) {
      onConnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Handle incoming order:created event
    const handleOrderCreated = (payload: any) => {
      if (payload.restaurantId !== theatreId) return;
      if (payload.eventId && deduplicatorRef.current.has(payload.eventId)) return;
      if (payload.eventId) deduplicatorRef.current.add(payload.eventId);

      // Only paid eligible cinema orders belong in the kitchen queue
      if (payload.orderType && payload.orderType !== 'cinema') return;
      if (payload.paymentStatus && payload.paymentStatus !== 'paid') return;

      // Play alert chime if eligible and unmuted
      if (soundEnabled && !playedOrderIdsRef.current.has(payload.orderId)) {
        playedOrderIdsRef.current.add(payload.orderId);
        playKitchenChime(audioContextRef.current);
      }

      setNewOrderToast({
        id: payload.orderId,
        orderNumber: payload.orderNumber,
        screenName: payload.screenName,
        seat: payload.seatRow ? `${payload.seatRow}${payload.seatNumber || ''}` : null
      });

      // Refetch full enriched orders quietly
      fetchKitchenOrders(true);
    };

    // Handle order:updated event
    const handleOrderUpdated = (payload: any) => {
      if (payload.restaurantId !== theatreId) return;
      if (payload.eventId && deduplicatorRef.current.has(payload.eventId)) return;
      if (payload.eventId) deduplicatorRef.current.add(payload.eventId);

      // Refetch updated status
      fetchKitchenOrders(true);
    };

    socket.on(SOCKET_EVENTS.ORDER_CREATED, handleOrderCreated);
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, handleOrderUpdated);

    // Polling fallback every 30 seconds
    const pollInterval = setInterval(() => {
      fetchKitchenOrders(true);
    }, 30000);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.ORDER_CREATED, handleOrderCreated);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, handleOrderUpdated);
      socket.emit('restaurant:leave', { restaurantId: theatreId });
      clearInterval(pollInterval);
    };
  }, [theatreId, soundEnabled, fetchKitchenOrders]);

  // Order Actions (Accept, Prepare, Ready)
  const handleAcceptOrder = async (orderId: string) => {
    if (!theatreId) return;
    setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: true }));
    try {
      await apiRequest(`/api/cinema/kitchen/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          'x-theatre-id': theatreId
        }
      });
      await fetchKitchenOrders(true);
    } catch (err: any) {
      console.error('Failed to accept order:', err);
      alert(err?.message || 'Failed to accept order');
    } finally {
      setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleStartPreparing = async (orderId: string) => {
    if (!theatreId) return;
    setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: true }));
    try {
      await apiRequest(`/api/cinema/kitchen/orders/${orderId}/prepare`, {
        method: 'POST',
        headers: {
          'x-theatre-id': theatreId
        }
      });
      await fetchKitchenOrders(true);
    } catch (err: any) {
      console.error('Failed to start preparation:', err);
      alert(err?.message || 'Failed to start preparation');
    } finally {
      setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleMarkReady = async (orderId: string) => {
    if (!theatreId) return;
    setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: true }));
    try {
      await apiRequest(`/api/cinema/kitchen/orders/${orderId}/ready`, {
        method: 'POST',
        headers: {
          'x-theatre-id': theatreId
        }
      });
      await fetchKitchenOrders(true);
    } catch (err: any) {
      console.error('Failed to mark order ready:', err);
      alert(err?.message || 'Failed to mark order ready');
    } finally {
      setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    if (!theatreId) return;
    setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: true }));
    try {
      await apiRequest(`/api/cinema/kitchen/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: {
          'x-theatre-id': theatreId
        }
      });
      await fetchKitchenOrders(true);
    } catch (err: any) {
      console.error('Failed to mark order delivered:', err);
      alert(err?.message || 'Failed to mark order as delivered');
    } finally {
      setUpdatingOrderIds((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Group orders into KDS columns
  const groupedOrders = useMemo(() => {
    const newOrders: CinemaKitchenOrder[] = [];
    const preparingOrders: CinemaKitchenOrder[] = [];
    const readyOrders: CinemaKitchenOrder[] = [];

    for (const order of orders) {
      // Exclude terminal / completed states
      if (order.status === 'served' || order.status === 'cancelled') {
        continue;
      }

      if (order.status === 'new' || order.status === 'confirmed') {
        newOrders.push(order);
      } else if (order.status === 'accepted' || order.status === 'preparing') {
        preparingOrders.push(order);
      } else if (order.status === 'ready') {
        readyOrders.push(order);
      }
    }

    // Sort FIFO (oldest wait time first)
    const sortByAgeAsc = (a: CinemaKitchenOrder, b: CinemaKitchenOrder) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    newOrders.sort(sortByAgeAsc);
    preparingOrders.sort(sortByAgeAsc);
    readyOrders.sort(sortByAgeAsc);

    return {
      newOrders,
      preparingOrders,
      readyOrders,
      allActive: [...newOrders, ...preparingOrders, ...readyOrders]
    };
  }, [orders]);

  // Extract unique screens for filter dropdown
  const uniqueScreens = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.screenId && o.screen?.name) {
        map.set(o.screenId, o.screen.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  // Filtered orders based on active tab
  const displayedOrders = useMemo(() => {
    if (activeTab === 'new') return groupedOrders.newOrders;
    if (activeTab === 'preparing') return groupedOrders.preparingOrders;
    if (activeTab === 'ready') return groupedOrders.readyOrders;
    return groupedOrders.allActive;
  }, [activeTab, groupedOrders]);

  if (sessionLoading || (loading && !selectedTheatre && !errorMessage)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-semibold text-slate-400">Opening Cinema Kitchen KDS...</p>
      </div>
    );
  }

  if (errorMessage && !selectedTheatre) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Cinema Kitchen Access</h2>
          <p className="text-sm text-slate-400 mb-6">{errorMessage}</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/cinema/admin/dashboard"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Back to Console
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={initAudio}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none"
    >
      {/* Toast Alert for Incoming Order */}
      {newOrderToast && (
        <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3.5 border border-amber-400/40 animate-bounce">
          <BellRing className="w-6 h-6 animate-spin text-white" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-100">
              New Paid Order Confirmed!
            </div>
            <div className="text-sm font-black">
              #{newOrderToast.orderNumber}
              {newOrderToast.screenName && ` • ${newOrderToast.screenName}`}
              {newOrderToast.seat && ` • Seat ${newOrderToast.seat}`}
            </div>
          </div>
          <button
            onClick={() => setNewOrderToast(null)}
            className="ml-2 p-1 hover:bg-amber-700/50 rounded-lg text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top KDS App Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Theatre Context */}
          <div className="flex items-center gap-3">
            <Link
              href="/cinema/admin/dashboard"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Return to Cinema Console"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/30">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black text-white tracking-tight">
                    Cinema Kitchen KDS
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                    Food Preparation
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  {selectedTheatre?.name || 'Cinema Concession Kitchen'}
                </p>
              </div>
            </div>

            {/* Theatre Switcher (if user has multiple) */}
            {theatres.length > 1 && (
              <select
                value={selectedMembership?.id}
                onChange={(e) => {
                  const m = theatres.find((t) => t.id === e.target.value);
                  if (m) setSelectedMembership(m);
                }}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium ml-2"
              >
                {theatres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.restaurant?.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Controls: Audio, Live Socket, Clock, Refresh */}
          <div className="flex items-center gap-2.5">
            {/* Live Realtime Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isConnected
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/80'
                  : 'bg-amber-950/70 text-amber-400 border-amber-800/80 animate-pulse'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {isConnected ? 'LIVE' : 'SYNCING'}
            </div>

            {/* Sound Notification Toggle */}
            <button
              onClick={() => {
                initAudio();
                setSoundEnabled(!soundEnabled);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                soundEnabled
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title={soundEnabled ? 'Alert Chime Active' : 'Sound Muted'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <span>Chime On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span>Muted</span>
                </>
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setViewMode('columns')}
                className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                  viewMode === 'columns'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Column View (Kanban)"
              >
                <Columns3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchKitchenOrders(false)}
              disabled={refreshing}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Clock Ticker */}
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Audio Unlocked Banner if Autoplay Restricted */}
        {soundEnabled && !audioUnlocked && (
          <div className="mt-2.5 bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Click anywhere on the screen to enable audio chime for new incoming orders</span>
            </div>
            <button
              onClick={initAudio}
              className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[11px]"
            >
              Enable Audio
            </button>
          </div>
        )}
      </header>

      {/* Filter Toolbar: Screen Filter, Search, Tab Statuses */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-slate-100 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>All Active</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {groupedOrders.allActive.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'new'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>New Orders</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'new' ? 'bg-blue-900 text-blue-200' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {groupedOrders.newOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('preparing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'preparing'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Preparing</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'preparing'
                  ? 'bg-orange-900 text-orange-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {groupedOrders.preparingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ready')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'ready'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Ready for Delivery</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'ready' ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {groupedOrders.readyOrders.length}
            </span>
          </button>
        </div>

        {/* Screen Filter & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {uniqueScreens.length > 0 && (
            <select
              value={selectedScreenId}
              onChange={(e) => setSelectedScreenId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="all">All Screens</option>
              {uniqueScreens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search seat, order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Main KDS Workspace */}
      <main className="flex-1 p-4 overflow-x-auto overflow-y-auto">
        {displayedOrders.length === 0 ? (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 mb-4 border border-slate-800">
              <CheckCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">All Caught Up!</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              There are currently no active food preparation orders in the kitchen queue. Newly confirmed paid cinema orders will appear here automatically.
            </p>
            <button
              onClick={() => fetchKitchenOrders(false)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check for Orders
            </button>
          </div>
        ) : viewMode === 'columns' && activeTab === 'all' ? (
          /* Kanban Column View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start min-w-[900px]">
            {/* Column 1: NEW / INCOMING */}
            <div className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="bg-blue-950/60 border-b border-blue-900/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-sm font-black text-blue-200 uppercase tracking-wider">
                    New Incoming Orders
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white">
                  {groupedOrders.newOrders.length}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-3 min-h-[450px]">
                {groupedOrders.newOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-medium">
                    No new orders waiting
                  </div>
                ) : (
                  groupedOrders.newOrders.map((order) => (
                    <CinemaOrderCard
                      key={order.id}
                      order={order}
                      isUpdating={!!updatingOrderIds[order.id]}
                      onAccept={() => handleAcceptOrder(order.id)}
                      onPrepare={() => handleStartPreparing(order.id)}
                      onReady={() => handleMarkReady(order.id)}
                      onDeliver={() => handleMarkDelivered(order.id)}
                      role={role}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column 2: PREPARING */}
            <div className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="bg-orange-950/60 border-b border-orange-900/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-black text-orange-200 uppercase tracking-wider">
                    In Preparation
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-600 text-white">
                  {groupedOrders.preparingOrders.length}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-3 min-h-[450px]">
                {groupedOrders.preparingOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-medium">
                    No orders currently cooking
                  </div>
                ) : (
                  groupedOrders.preparingOrders.map((order) => (
                    <CinemaOrderCard
                      key={order.id}
                      order={order}
                      isUpdating={!!updatingOrderIds[order.id]}
                      onAccept={() => handleAcceptOrder(order.id)}
                      onPrepare={() => handleStartPreparing(order.id)}
                      onReady={() => handleMarkReady(order.id)}
                      onDeliver={() => handleMarkDelivered(order.id)}
                      role={role}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column 3: READY */}
            <div className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="bg-emerald-950/60 border-b border-emerald-900/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-black text-emerald-200 uppercase tracking-wider">
                    Ready for Delivery
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                  {groupedOrders.readyOrders.length}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-3 min-h-[450px]">
                {groupedOrders.readyOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-medium">
                    No orders waiting for pickup
                  </div>
                ) : (
                  groupedOrders.readyOrders.map((order) => (
                    <CinemaOrderCard
                      key={order.id}
                      order={order}
                      isUpdating={!!updatingOrderIds[order.id]}
                      onAccept={() => handleAcceptOrder(order.id)}
                      onPrepare={() => handleStartPreparing(order.id)}
                      onReady={() => handleMarkReady(order.id)}
                      onDeliver={() => handleMarkDelivered(order.id)}
                      role={role}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Grid View or Single Tab View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedOrders.map((order) => (
              <CinemaOrderCard
                key={order.id}
                order={order}
                isUpdating={!!updatingOrderIds[order.id]}
                onAccept={() => handleAcceptOrder(order.id)}
                onPrepare={() => handleStartPreparing(order.id)}
                onReady={() => handleMarkReady(order.id)}
                onDeliver={() => handleMarkDelivered(order.id)}
                role={role}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Cinema Order Card Component (Prominent Screen, Seat & Movie context)
// -----------------------------------------------------------------------------

interface CinemaOrderCardProps {
  order: CinemaKitchenOrder;
  isUpdating: boolean;
  onAccept: () => void;
  onPrepare?: () => void;
  onReady: () => void;
  onDeliver: () => void;
  role: RestaurantMemberRole;
}

function CinemaOrderCard({
  order,
  isUpdating,
  onAccept,
  onPrepare,
  onReady,
  onDeliver,
  role
}: CinemaOrderCardProps) {
  const elapsedMins = calculateElapsedMinutes(order.createdAt);
  const urgency = getUrgencyLevel(elapsedMins);
  const urgencyStyles = getUrgencyBadgeStyles(urgency);

  const screenDisplay =
    order.screen?.name || order.screen?.screenName || (order.screenId ? 'Auditorium' : 'Main Screen');
  const seatDisplay =
    order.seatRow && order.seatNumber
      ? `Row ${order.seatRow} • Seat ${order.seatNumber}`
      : order.seatNumber
      ? `Seat ${order.seatNumber}`
      : 'General Delivery';

  const isNew = order.status === 'new' || order.status === 'confirmed';
  const isAccepted = order.status === 'accepted';
  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';

  return (
    <div
      className={`bg-slate-900 rounded-xl border p-4 flex flex-col justify-between transition-all shadow-md ${
        urgency === 'urgent'
          ? 'border-rose-500/80 shadow-rose-950/40 ring-1 ring-rose-500/50'
          : urgency === 'warning'
          ? 'border-amber-500/60 shadow-amber-950/30'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div>
        {/* Card Header: Prominent Seat Location & Wait Timer */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Prominent Auditorium & Seat Badge */}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 font-black text-xs uppercase tracking-tight">
              <Tv className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{screenDisplay}</span>
            </div>

            <div className="text-base font-black text-white mt-1 tracking-tight flex items-center gap-1.5">
              <Armchair className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{seatDisplay}</span>
            </div>
          </div>

          {/* Wait Time Timer with Urgency styling */}
          <div className="flex flex-col items-end shrink-0">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-black border flex items-center gap-1 ${urgencyStyles.badge}`}
              title="Time elapsed since order was paid"
            >
              <Clock className="w-3 h-3" />
              {formatElapsedTime(elapsedMins)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">#{order.orderNumber}</span>
          </div>
        </div>

        {/* Movie Title & Showtime */}
        {(order.movie?.title || order.showtime) && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 mb-3 flex items-center gap-2 text-xs">
            <Film className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-slate-200">
                {order.movie?.title || 'Feature Presentation'}
              </span>
              {order.showtime && (
                <span className="text-slate-400 font-medium ml-1.5">
                  ({order.showtime.substring(0, 5)})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Ordered Concession Items List */}
        <div className="space-y-1.5 mb-3 border-t border-slate-800/80 pt-2.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between text-xs">
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-5 h-5 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-black text-center text-[11px] leading-5 shrink-0">
                  {item.quantity}x
                </span>
                <span className="font-bold text-slate-100 truncate">{item.productName}</span>
              </div>
              {item.notes && (
                <span className="text-[10px] italic text-amber-400 ml-2 shrink-0">
                  ({item.notes})
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Special Instructions Alert Callout */}
        {order.specialInstructions && (
          <div className="bg-amber-950/50 border border-amber-800/60 rounded-lg p-2 mb-3 text-xs text-amber-300 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="font-medium">{order.specialInstructions}</span>
          </div>
        )}

        {/* Payment & Customer Information */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mb-3">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
            PAID {order.paymentMethod ? `(${order.paymentMethod.toUpperCase()})` : ''}
          </span>
          {order.customerName && (
            <span className="truncate max-w-[120px]">{order.customerName}</span>
          )}
        </div>
      </div>

      {/* Card Action Buttons according to Lifecycle State */}
      <div className="pt-2 border-t border-slate-800 flex gap-2">
        {isNew && (
          <button
            onClick={onAccept}
            disabled={isUpdating}
            className="w-full py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-md shadow-blue-600/20"
          >
            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Accept Order
          </button>
        )}

        {(isAccepted || isPreparing) && (
          <div className="flex gap-2 w-full">
            <button
              onClick={onReady}
              disabled={isUpdating}
              className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-md shadow-emerald-600/30"
            >
              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Mark Food Ready
            </button>
            <button
              onClick={onDeliver}
              disabled={isUpdating}
              className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50 border border-slate-700"
              title="Deliver directly to seat without waiting"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Deliver
            </button>
          </div>
        )}

        {isReady && (
          <div className="w-full flex flex-col gap-1.5">
            <button
              onClick={onDeliver}
              disabled={isUpdating}
              className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-md shadow-emerald-600/30"
              title="Mark order as delivered to customer seat"
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Mark Delivered to Seat</span>
            </button>
            <span className="text-[10px] text-center text-slate-400 font-medium">
              No delivery staff? Deliver directly to {seatDisplay}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
