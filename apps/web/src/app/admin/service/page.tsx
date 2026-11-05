'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket-client';
import {
  SOCKET_EVENTS,
  OrderStatus,
  RestaurantMemberRole,
  getAllowedNextStatuses
} from '@menugo/shared';
import {
  ServiceOrder,
  filterReadyOrders,
  filterRecentlyServedOrders,
  calculatePassWaitMinutes,
  formatPassWaitTime,
  getPassUrgency,
  getPassUrgencyStyles,
  formatTableDisplay,
  buildServedStatusPayload,
  shouldPlayServiceAlert,
  playServicePassChime
} from '@/lib/service-workflow';
import { EventDeduplicator, isStaleEvent } from '@/lib/realtime-client';
import { formatPaise } from '@/lib/utils';
import {
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Utensils,
  Wifi,
  WifiOff,
  ChefHat,
  Search,
  Check,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Square,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

export default function StaffServicePassPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);
  const initialOrdersLoadedRef = useRef(false);

  // Restaurant & User Context
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [role, setRole] = useState<RestaurantMemberRole>('staff');

  // Orders State
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tabs & Search
  const [activeTab, setActiveTab] = useState<'ready' | 'served'>('ready');
  const [searchQuery, setSearchQuery] = useState('');

  // Item Checkbox State for Tray Verification (Local UI state per order)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Realtime & Connectivity
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const deduplicatorRef = useRef(new EventDeduplicator());

  // Audio Alerts
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playedOrderIdsRef = useRef<Set<string>>(new Set());

  // Clock ticker for elapsed pass wait times (updates every 10 seconds)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Unlock WebAudio on user interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().then(() => setAudioUnlocked(true));
    } else if (audioContextRef.current?.state === 'running') {
      setAudioUnlocked(true);
    }
  }, []);

  const toggleSound = () => {
    initAudio();
    setSoundEnabled((prev) => !prev);
  };

  // 1. Load User's Restaurant Memberships
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadRestaurants();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionLoading, router]);

  const loadRestaurants = async (isSilent = false) => {
    try {
      if (!isSilent && restaurants.length === 0) {
        setLoading(true);
      }
      const data = await apiRequest('/api/restaurants/my');
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedMembership((prev: any) => {
          if (!prev) return data[0];
          const match = data.find((r: any) => (r.restaurant?.id || r.restaurantId) === (prev.restaurant?.id || prev.restaurantId));
          return match || data[0];
        });
        setRole((prev) => (data[0]?.role as RestaurantMemberRole) || prev);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load restaurant profile');
    } finally {
      setLoading(false);
    }
  };

  const selectedRestaurant = selectedMembership?.restaurant;

  // 2. Fetch Orders for Selected Restaurant
  const loadOrders = useCallback(async (isSilent = false) => {
    if (!selectedRestaurant?.id) return;

    if (!isSilent && !initialOrdersLoadedRef.current) {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      // Fetch open & completed orders to cover both ready and served today
      const data: ServiceOrder[] = await apiRequest(
        `/api/orders?view=all&date=today`,
        { restaurantId: selectedRestaurant.id }
      );
      initialOrdersLoadedRef.current = true;
      setOrders(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch service pass orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRestaurant?.id]);

  useEffect(() => {
    if (selectedRestaurant?.id) {
      loadOrders();
    }
  }, [selectedRestaurant?.id, loadOrders]);

  // 3. Realtime Socket Integration
  useEffect(() => {
    if (!selectedRestaurant?.id) return;
    const restaurantId = selectedRestaurant.id;

    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      socket.emit(SOCKET_EVENTS.JOIN_RESTAURANT, restaurantId);
      // Silent background state sync on reconnect
      loadOrders(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onReconnectAttempt = () => {
      setIsReconnecting(true);
    };

    const handleOrderEvent = (data: any) => {
      if (!data) return;

      const eventId = data.eventId;
      if (eventId) {
        if (deduplicatorRef.current.has(eventId)) return;
        deduplicatorRef.current.add(eventId);
      }

      // Check if event is relevant to this restaurant
      if (data.restaurantId && data.restaurantId !== restaurantId) {
        return;
      }

      const orderId = data.orderId || data.id;
      if (!orderId) return;

      // Trigger pass chime if an order just became READY
      if (data.status === 'ready' && soundEnabled) {
        if (shouldPlayServiceAlert(orderId, playedOrderIdsRef.current, 'ready')) {
          playedOrderIdsRef.current.add(orderId);
          playServicePassChime(audioContextRef.current);
        }
      }

      const normalized: ServiceOrder = {
        id: orderId,
        orderNumber: String(data.orderNumber),
        restaurantId: data.restaurantId || restaurantId,
        tableId: data.tableId || null,
        status: data.status,
        totalAmount: Number(data.totalAmount || 0),
        specialInstructions: data.specialInstructions || null,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        statusToken: data.statusToken || null,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        table: data.table || (data.tableNumber ? { id: data.tableId || '', tableNumber: String(data.tableNumber) } : null),
        items: Array.isArray(data.items)
          ? data.items.map((it: any) => ({
              id: it.id || crypto.randomUUID(),
              orderId,
              productId: it.productId || null,
              productName: it.productName || 'Item',
              quantity: Number(it.quantity || 1),
              unitPrice: Number(it.unitPrice || 0),
              subtotal: Number(it.subtotal || (it.unitPrice || 0) * (it.quantity || 1)),
              notes: it.notes || null
            }))
          : []
      };

      // Instantly update orders in-memory without page reload
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === orderId);
        if (exists) {
          return prev.map((o) => (o.id === orderId ? { ...o, ...normalized } : o));
        }
        return [normalized, ...prev];
      });
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on(SOCKET_EVENTS.ORDER_CREATED, handleOrderEvent);
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, handleOrderEvent);
    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGED, handleOrderEvent);

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_RESTAURANT, restaurantId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off(SOCKET_EVENTS.ORDER_CREATED, handleOrderEvent);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, handleOrderEvent);
      socket.off(SOCKET_EVENTS.ORDER_STATUS_CHANGED, handleOrderEvent);
    };
  }, [selectedRestaurant?.id, soundEnabled, loadOrders]);

  // Window Visibility Recovery (silent sync only if socket disconnected while tab was in background)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const socket = getSocket();
        if (!socket.connected) {
          socket.connect();
          loadOrders(true);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadOrders]);

  // 4. Action: Mark as SERVED (with concurrency protection)
  const handleMarkServed = async (order: ServiceOrder) => {
    if (!selectedRestaurant?.id) return;
    initAudio();

    // Verify state machine & build safe concurrency payload
    const check = buildServedStatusPayload(order.id, order.status, role);
    if (!check.valid) {
      setErrorMessage(check.error);
      return;
    }

    setUpdatingOrderIds((prev) => ({ ...prev, [order.id]: true }));
    setErrorMessage(null);

    try {
      const res = await apiRequest<{ message: string; order: ServiceOrder }>(
        `/api/orders/${order.id}/status`,
        {
          method: 'PATCH',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify(check.payload)
        }
      );

      // Optimistically update local orders list
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, status: 'served', updatedAt: new Date().toISOString() }
            : o
        )
      );

      setToastMessage(`Table ${order.table?.tableNumber || 'Order'} #${order.orderNumber} served!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      if (err.message && err.message.includes('Order status conflict')) {
        // Concurrency conflict: someone else marked it served or updated it
        setToastMessage(`Notice: Order #${order.orderNumber} was already updated by another staff member.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(err.message || 'Failed to update order status');
      }
      // Re-sync with server
      loadOrders(true);
    } finally {
      setUpdatingOrderIds((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Toggle item tray check
  const toggleItemCheck = (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Filter & Group Orders
  const readyOrders = useMemo(() => filterReadyOrders(orders), [orders]);
  const servedOrders = useMemo(() => filterRecentlyServedOrders(orders), [orders]);

  // Search Filter
  const filteredReadyOrders = useMemo(() => {
    if (!searchQuery.trim()) return readyOrders;
    const q = searchQuery.toLowerCase().trim();
    return readyOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.table?.tableNumber && o.table.tableNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q))
    );
  }, [readyOrders, searchQuery]);

  const filteredServedOrders = useMemo(() => {
    if (!searchQuery.trim()) return servedOrders;
    const q = searchQuery.toLowerCase().trim();
    return servedOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.table?.tableNumber && o.table.tableNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q))
    );
  }, [servedOrders, searchQuery]);

  // Urgent Count (> 5 minutes on pass)
  const urgentCount = useMemo(() => {
    return readyOrders.filter((o) => {
      const wait = calculatePassWaitMinutes(o.updatedAt || o.createdAt, currentTime);
      return wait >= 5;
    }).length;
  }, [readyOrders, currentTime]);

  if ((sessionLoading || loading) && !initialOrdersLoadedRef.current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Utensils className="w-10 h-10 text-purple-400 animate-bounce mb-3" />
        <p className="text-slate-300 font-medium">Loading Floor Service Pass...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 group text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Dashboard</span>
          </Link>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-purple-900/50">
              S
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white leading-tight flex items-center gap-2">
                Floor Service Pass
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Ready Orders
                </span>
              </h1>
            </div>
          </div>

          {/* Restaurant switcher */}
          {restaurants.length > 1 && (
            <select
              value={selectedRestaurant?.id || ''}
              onChange={(e) => {
                const found = restaurants.find((r) => r.restaurant.id === e.target.value);
                if (found) {
                  setSelectedMembership(found);
                  setRole(found.role as RestaurantMemberRole);
                }
              }}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-purple-500"
            >
              {restaurants.map((item) => (
                <option key={item.restaurant.id} value={item.restaurant.id}>
                  {item.restaurant.name} ({item.role})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Socket Connectivity Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isConnected
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                : isReconnecting
                ? 'bg-amber-950/60 text-amber-400 border-amber-800/80 animate-pulse'
                : 'bg-rose-950/60 text-rose-400 border-rose-800/80'
            }`}
            title={isConnected ? 'Realtime live connection active' : 'Connecting to realtime service'}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>{isReconnecting ? 'Reconnecting...' : 'Offline'}</span>
              </>
            )}
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              soundEnabled
                ? 'bg-purple-950/60 text-purple-300 border-purple-700/80 hover:bg-purple-900/60'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
            title={soundEnabled ? 'Pass alert chimes enabled' : 'Chimes muted'}
          >
            {soundEnabled ? <Bell className="w-3.5 h-3.5 text-purple-400" /> : <BellOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Bell On' : 'Muted'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => loadOrders(false)}
            disabled={refreshing}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 disabled:opacity-50"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          {/* Link to Kitchen */}
          <Link
            href="/kitchen"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <ChefHat className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Kitchen</span>
          </Link>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-emerald-400/30">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Main Service Pass Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-950/70 border border-rose-800/80 rounded-2xl text-rose-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs uppercase font-bold text-rose-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Floor Pass Metrics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Ready on Pass
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-400">{readyOrders.length}</span>
              <span className="text-xs text-slate-400">awaiting pickup</span>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border transition shadow-sm ${
              urgentCount > 0
                ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider block mb-1">
              Urgent (&gt; 5m on Pass)
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${urgentCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
                {urgentCount}
              </span>
              <span className="text-xs">{urgentCount > 0 ? 'Needs immediate run!' : 'All fresh'}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Served Today
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{servedOrders.length}</span>
              <span className="text-xs text-slate-400">completed</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Staff Role
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold uppercase tracking-wider border border-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                {role}
              </span>
              <span className="text-xs text-emerald-400 font-medium">Authorized to Serve</span>
            </div>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/70 p-3 rounded-2xl border border-slate-800">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ready')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'ready'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Ready for Service</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                activeTab === 'ready' ? 'bg-purple-800 text-purple-100' : 'bg-slate-700 text-slate-300'
              }`}>
                {readyOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('served')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'served'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Served Today</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                activeTab === 'served' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-700 text-slate-300'
              }`}>
                {servedOrders.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table or order #..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: READY ORDERS (The Service Pass) */}
        {activeTab === 'ready' && (
          <div>
            {filteredReadyOrders.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800/80 max-w-lg mx-auto p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-950/60 text-purple-400 flex items-center justify-center mx-auto border border-purple-800/50">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white">The Service Pass is Clear!</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {searchQuery
                    ? 'No ready orders match your search filter.'
                    : 'All hot dishes have been delivered to tables. When kitchen staff marks an order ready, it will appear here automatically.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-700 transition"
                  >
                    Clear Search Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredReadyOrders.map((order) => {
                  const waitMinutes = calculatePassWaitMinutes(order.updatedAt || order.createdAt, currentTime);
                  const urgency = getPassUrgency(waitMinutes);
                  const urgencyStyles = getPassUrgencyStyles(urgency);
                  const tableDisplay = formatTableDisplay(order.table);
                  const isUpdating = updatingOrderIds[order.id];

                  return (
                    <div
                      key={order.id}
                      className={`bg-slate-900 rounded-3xl border ${urgencyStyles.cardBorder} p-5 flex flex-col justify-between shadow-xl transition hover:shadow-2xl space-y-5`}
                    >
                      {/* Top Header: Giant Table Number & Wait Timer (Mistake-Proof) */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          {/* Giant Table Badge */}
                          <div className="flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              Deliver To
                            </span>
                            <div className="inline-block px-4 py-2 rounded-2xl bg-purple-600 text-white font-black text-2xl tracking-wide shadow-md shadow-purple-900/60 border border-purple-400/40">
                              {tableDisplay.badgeText}
                            </div>
                          </div>

                          {/* Order # and Pass Timer */}
                          <div className="text-right">
                            <span className="font-mono text-sm font-extrabold text-slate-300 block">
                              #{order.orderNumber}
                            </span>
                            <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs border bg-slate-950/80">
                              <Clock className={`w-3.5 h-3.5 ${urgencyStyles.timerText}`} />
                              <span className={urgencyStyles.timerText}>
                                Ready {formatPassWaitTime(waitMinutes)} ago
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Urgent Pass Warning Banner if > 5m */}
                        {urgency === 'urgent' && (
                          <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs font-bold flex items-center gap-2 mb-3 animate-pulse">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>⚠️ {waitMinutes}m on Pass — Hot food waiting for table delivery!</span>
                          </div>
                        )}

                        {/* Customer note / special instructions */}
                        {order.specialInstructions && (
                          <div className="p-2.5 bg-amber-950/50 border border-amber-800/60 rounded-xl text-amber-200 text-xs font-medium mb-3">
                            <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-400">
                              Order Instructions:
                            </span>
                            {order.specialInstructions}
                          </div>
                        )}

                        {/* Customer name (if dine-in guest identified) */}
                        {order.customerName && (
                          <p className="text-xs text-slate-400 mb-2">
                            Guest: <strong className="text-slate-200">{order.customerName}</strong>
                          </p>
                        )}

                        {/* Dish Checklist for Waitstaff Tray Verification */}
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Tray Checklist ({order.items.length} dishes):
                          </span>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {order.items.map((item) => {
                              const checkKey = `${order.id}-${item.id}`;
                              const isChecked = checkedItems[checkKey] || false;

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => toggleItemCheck(order.id, item.id)}
                                  className={`flex items-start justify-between gap-2 p-2 rounded-xl text-xs transition cursor-pointer select-none border ${
                                    isChecked
                                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                                      : 'bg-slate-950/60 border-slate-800/80 text-slate-200 hover:bg-slate-800/60'
                                  }`}
                                >
                                  <div className="flex items-start gap-2 flex-1">
                                    <span className="mt-0.5 text-slate-400">
                                      {isChecked ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                                      ) : (
                                        <Square className="w-4 h-4" />
                                      )}
                                    </span>
                                    <div>
                                      <span className={`font-bold ${isChecked ? 'line-through text-emerald-400/80' : 'text-white'}`}>
                                        {item.quantity}x {item.productName}
                                      </span>
                                      {item.notes && (
                                        <span className="block text-[10px] text-amber-400/90 font-medium">
                                          Note: {item.notes}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action: Big Mistake-Proof "Mark as Served" Button */}
                      <div className="pt-3 border-t border-slate-800">
                        <button
                          onClick={() => handleMarkServed(order)}
                          disabled={isUpdating}
                          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold text-sm transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50 border border-emerald-400/30"
                        >
                          {isUpdating ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Delivering Order...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              <span>Mark as Served</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: SERVED TODAY */}
        {activeTab === 'served' && (
          <div className="space-y-4">
            {filteredServedOrders.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800/80 max-w-lg mx-auto p-8 space-y-3">
                <ShoppingBag className="w-12 h-12 text-slate-500 mx-auto" />
                <h3 className="text-lg font-bold text-white">No Served Orders Yet</h3>
                <p className="text-slate-400 text-xs">
                  Orders marked as served today will be logged here for staff review.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Delivered &amp; Completed ({filteredServedOrders.length} orders)
                  </span>
                </div>
                <div className="divide-y divide-slate-800/80">
                  {filteredServedOrders.map((order) => {
                    const tableDisplay = formatTableDisplay(order.table);

                    return (
                      <div
                        key={order.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center gap-4">
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-black text-sm">
                            {tableDisplay.badgeText}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-white">
                                #{order.orderNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                                Served
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">
                            {formatPaise(order.totalAmount)}
                          </span>
                          <span>•</span>
                          <span>{new Date(order.updatedAt || order.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
