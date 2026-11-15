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
  calculateElapsedMinutes,
  formatElapsedTime,
  getUrgencyLevel,
  getUrgencyBadgeStyles,
  groupOrdersForKDS,
  shouldPlayAlert,
  playKitchenChime,
  buildKitchenStatusPayload,
  KitchenOrder
} from '@/lib/kds';
import { EventDeduplicator, isStaleEvent } from '@/lib/realtime-client';
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
  Loader2
} from 'lucide-react';

export default function KitchenDashboardPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);
  const initialOrdersLoadedRef = useRef(false);

  // Restaurant & User Context
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [role, setRole] = useState<RestaurantMemberRole>('kitchen');

  // Orders State
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Layout & Filter States
  const [viewMode, setViewMode] = useState<'columns' | 'grid'>('columns');
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'preparing' | 'ready'>('all');

  // Realtime & Connectivity States
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isStaleData, setIsStaleData] = useState(false);

  // Audio Notification States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [newOrderToast, setNewOrderToast] = useState<{ id: string; orderNumber: string; tableNumber?: string | null } | null>(null);
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

  // Check data staleness every 10 seconds
  useEffect(() => {
    const staleChecker = setInterval(() => {
      const secondsSinceSync = (Date.now() - lastSyncTime.getTime()) / 1000;
      if ((!isConnected && secondsSinceSync > 25) || secondsSinceSync > 90) {
        setIsStaleData(true);
      } else {
        setIsStaleData(false);
      }
    }, 10000);
    return () => clearInterval(staleChecker);
  }, [isConnected, lastSyncTime]);

  // Audio Context unlocker on user gesture
  const initAudio = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          setAudioUnlocked(true);
        });
      } else if (audioContextRef.current && audioContextRef.current.state === 'running') {
        setAudioUnlocked(true);
      }
    } catch (e) {
      console.warn('AudioContext initialization error:', e);
    }
  }, []);

  // Global click listener to unlock audio automatically on first interaction
  useEffect(() => {
    const handleFirstGesture = () => {
      initAudio();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture);
    window.addEventListener('keydown', handleFirstGesture);
    window.addEventListener('touchstart', handleFirstGesture);

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, [initAudio]);

  // Trigger sound alert safely with deduplication
  const triggerOrderChime = useCallback(
    (orderId: string, status: OrderStatus) => {
      if (!soundEnabled) return;
      if (!shouldPlayAlert(orderId, playedOrderIdsRef.current, status)) return;

      playedOrderIdsRef.current.add(orderId);
      playKitchenChime(audioContextRef.current);
    },
    [soundEnabled]
  );

  // 1. Session & Restaurant Memberships Fetch
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadUserRestaurants();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionLoading, router]);

  const loadUserRestaurants = async (isSilent = false) => {
    try {
      if (!isSilent && restaurants.length === 0) {
        setLoading(true);
      }
      const data = await apiRequest('/api/restaurants/my');
      setRestaurants(data);
      if (data && data.length > 0) {
        setSelectedMembership((prev: any) => {
          if (!prev) return data[0];
          const match = data.find((r: any) => (r.restaurant?.id || r.restaurantId) === (prev.restaurant?.id || prev.restaurantId));
          return match || data[0];
        });
        setRole((prev) => data[0]?.role || prev);
      }
    } catch (err: any) {
      console.error('Failed to load user restaurants:', err);
      setErrorMessage(err.message || 'Could not load restaurant memberships.');
    } finally {
      setLoading(false);
    }
  };

  const activeRestaurant = selectedMembership?.restaurant;
  const activeRestaurantId = activeRestaurant?.id;

  // 2. Load Active Kitchen Orders
  const loadOrders = useCallback(
    async (isManualRefresh = false, isSilent = false) => {
      if (!activeRestaurantId) return;

      if (isManualRefresh) {
        setRefreshing(true);
      } else if (!isSilent && !initialOrdersLoadedRef.current) {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        const fetchedOrders: KitchenOrder[] = await apiRequest('/api/orders', {
          restaurantId: activeRestaurantId,
          params: {
            view: 'open'
          }
        });

        initialOrdersLoadedRef.current = true;
        setOrders(fetchedOrders);
        setLastSyncTime(new Date());
        setIsStaleData(false);

        // Pre-populate playedOrderIds for existing orders so sound alert doesn't trigger on initial load
        fetchedOrders.forEach((o) => {
          if (!playedOrderIdsRef.current.has(o.id)) {
            playedOrderIdsRef.current.add(o.id);
          }
        });
      } catch (err: any) {
        console.error('Failed to load kitchen orders:', err);
        setErrorMessage(err.message || 'Failed to fetch open kitchen orders.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeRestaurantId]
  );

  // Reload orders whenever active restaurant changes
  useEffect(() => {
    if (activeRestaurantId) {
      loadOrders();
    }
  }, [activeRestaurantId, loadOrders]);

  // 3. Tab Visibility Recovery (Silent sync only if socket disconnected while tab was in background)
  useEffect(() => {
    if (!activeRestaurantId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const socket = getSocket();
        if (!socket.connected) {
          socket.connect();
          loadOrders(false, true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeRestaurantId, loadOrders]);

  // 4. Socket.io Real-Time Synchronization & Room Management
  useEffect(() => {
    if (!activeRestaurantId) return;

    const sessionToken = (session as any)?.session?.token;
    const socket = getSocket(sessionToken);

    const emitJoin = () => {
      socket.emit(
        SOCKET_EVENTS.JOIN_RESTAURANT,
        {
          restaurantId: activeRestaurantId,
          userId,
          token: sessionToken
        },
        (ack: any) => {
          if (ack?.success) {
            setIsConnected(true);
            setIsReconnecting(false);
          } else if (ack?.error) {
            console.warn('[Kitchen] Socket room join warning:', ack.error);
          }
        }
      );
    };

    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      emitJoin();
      // Silent background state sync on reconnect
      loadOrders(false, true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    const onConnectError = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    // Instant Realtime: New order arrives (0ms latency push)
    const onOrderCreated = (rawOrder: any) => {
      if (!rawOrder) return;
      const rId = rawOrder.restaurantId || rawOrder.restaurant_id;
      if (rId && activeRestaurantId && String(rId).trim().toLowerCase() !== String(activeRestaurantId).trim().toLowerCase()) {
        return;
      }

      // Deduplication check
      const eventId = rawOrder.eventId;
      if (eventId && deduplicatorRef.current.has(eventId)) {
        return;
      }
      if (eventId) {
        deduplicatorRef.current.add(eventId);
      }

      const orderId = rawOrder.orderId || rawOrder.id;
      if (!orderId) return;

      const newOrder: KitchenOrder = {
        id: orderId,
        orderNumber: String(rawOrder.orderNumber),
        restaurantId: rId || activeRestaurantId,
        tableId: rawOrder.tableId || null,
        status: rawOrder.status || 'new',
        totalAmount: Number(rawOrder.totalAmount || 0),
        specialInstructions: rawOrder.specialInstructions || null,
        customerName: rawOrder.customerName || null,
        customerPhone: rawOrder.customerPhone || null,
        statusToken: rawOrder.statusToken || null,
        createdAt: rawOrder.createdAt || new Date().toISOString(),
        updatedAt: rawOrder.updatedAt || new Date().toISOString(),
        table: rawOrder.table || (rawOrder.tableNumber ? { id: rawOrder.tableId || '', tableNumber: String(rawOrder.tableNumber) } : null),
        items: Array.isArray(rawOrder.items)
          ? rawOrder.items.map((it: any) => ({
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

      // Instantly add to orders state without page refresh (0ms delay)
      setOrders((prev) => {
        if (prev.some((o) => o.id === orderId)) return prev;
        return [newOrder, ...prev];
      });

      setLastSyncTime(new Date());
      setIsStaleData(false);

      // Play alert chime for the new order immediately
      triggerOrderChime(orderId, newOrder.status);

      // Visual flash toast
      setNewOrderToast({
        id: orderId,
        orderNumber: newOrder.orderNumber,
        tableNumber: newOrder.table?.tableNumber
      });
      setTimeout(() => setNewOrderToast(null), 8000);

      // Silent background sync for full database relations
      loadOrders(false, true);
    };

    // Kitchen Alert listener (alternative channel for guaranteed delivery)
    const onKitchenAlert = (data: any) => {
      if (!data) return;
      if (data.order) {
        onOrderCreated(data.order);
      } else if (data.orderId) {
        triggerOrderChime(data.orderId, 'new');
        loadOrders(false, true);
      }
    };

    // Instant Realtime: Order status updated
    const onOrderStatusChanged = (payload: any) => {
      if (!payload) return;
      const orderId = payload.orderId || payload.id;
      if (!orderId) return;

      const status: OrderStatus = payload.status;
      const eventId = payload.eventId;
      if (eventId && deduplicatorRef.current.has(eventId)) {
        return;
      }
      if (eventId) {
        deduplicatorRef.current.add(eventId);
      }

      setOrders((prev) => {
        // If transitioned to terminal status (served or cancelled), remove from active KDS
        if (status === 'served' || status === 'cancelled') {
          return prev.filter((o) => o.id !== orderId);
        }

        return prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status,
              updatedAt: payload.updatedAt || new Date().toISOString(),
              ...(payload.tableNumber ? { table: { id: payload.tableId || '', tableNumber: String(payload.tableNumber) } } : {})
            };
          }
          return o;
        });
      });

      setLastSyncTime(new Date());
    };

    // Attach listeners across all event aliases
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(SOCKET_EVENTS.ORDER_CREATED, onOrderCreated);
    socket.on('order:created', onOrderCreated);
    socket.on('order:new', onOrderCreated);
    socket.on(SOCKET_EVENTS.KITCHEN_ALERT, onKitchenAlert);
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, onOrderStatusChanged);
    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGED, onOrderStatusChanged);

    // Initial state check
    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_RESTAURANT, activeRestaurantId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(SOCKET_EVENTS.ORDER_CREATED, onOrderCreated);
      socket.off('order:created', onOrderCreated);
      socket.off('order:new', onOrderCreated);
      socket.off(SOCKET_EVENTS.KITCHEN_ALERT, onKitchenAlert);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, onOrderStatusChanged);
      socket.off(SOCKET_EVENTS.ORDER_STATUS_CHANGED, onOrderStatusChanged);
    };
  }, [activeRestaurantId, userId, session, triggerOrderChime, loadOrders]);

  // 5. Silent 5s Background Sync Interval (Fail-safe for network disruptions)
  useEffect(() => {
    if (!activeRestaurantId) return;
    const pollInterval = setInterval(() => {
      loadOrders(false, true);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [activeRestaurantId, loadOrders]);

  // 4. Server-Authoritative Status Update with Concurrency Protection
  const handleUpdateStatus = async (order: KitchenOrder, targetStatus: OrderStatus) => {
    if (!activeRestaurantId) return;

    const buildResult = buildKitchenStatusPayload(order.id, order.status, targetStatus, role);
    if (!buildResult.valid) {
      setErrorMessage(buildResult.error);
      return;
    }

    setUpdatingOrderIds((prev) => ({ ...prev, [order.id]: true }));
    setErrorMessage(null);

    try {
      await apiRequest(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        restaurantId: activeRestaurantId,
        body: JSON.stringify(buildResult.payload)
      });

      // Update state locally
      setOrders((prev) => {
        if (targetStatus === 'served' || targetStatus === 'cancelled') {
          return prev.filter((o) => o.id !== order.id);
        }
        return prev.map((o) => (o.id === order.id ? { ...o, status: targetStatus, updatedAt: new Date().toISOString() } : o));
      });
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Failed to update status:', err);
      // 409 Conflict: Reload orders from server to resolve state discrepancy
      if (err.message?.includes('conflict') || err.message?.includes('status conflict')) {
        setErrorMessage(`Conflict: Order #${order.orderNumber} was updated by another team member. Synced with server.`);
        loadOrders();
      } else {
        setErrorMessage(err.message || 'Failed to update order status');
      }
    } finally {
      setUpdatingOrderIds((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Group orders into KDS columns
  const groupedOrders = useMemo(() => groupOrdersForKDS(orders), [orders]);

  // Filter for grid view
  const gridFilteredOrders = useMemo(() => {
    switch (activeTab) {
      case 'new':
        return groupedOrders.newOrders;
      case 'preparing':
        return groupedOrders.preparingOrders;
      case 'ready':
        return groupedOrders.readyOrders;
      case 'all':
      default:
        return groupedOrders.allActiveOrders;
    }
  }, [activeTab, groupedOrders]);

  // Render individual Order Card
  const renderOrderCard = (order: KitchenOrder) => {
    const elapsedMins = calculateElapsedMinutes(order.createdAt, currentTime);
    const urgency = getUrgencyLevel(elapsedMins);
    const urgencyStyles = getUrgencyBadgeStyles(urgency);
    const isUpdating = !!updatingOrderIds[order.id];

    const isNew = order.status === 'new' || order.status === 'pending';
    const isAccepted = order.status === 'accepted';
    const isPreparing = order.status === 'preparing';
    const isReady = order.status === 'ready';

    return (
      <div
        key={order.id}
        className={`bg-slate-900/90 border rounded-2xl flex flex-col overflow-hidden shadow-xl transition-all duration-200 ${
          isNew
            ? 'border-orange-500/80 shadow-orange-950/20 ring-1 ring-orange-500/40'
            : urgencyStyles.border
        }`}
      >
        {/* Card Header */}
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-slate-400">Order</span>
              <h3 className="font-black text-2xl text-white tracking-tight">#{order.orderNumber}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs uppercase font-extrabold tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-md">
                {order.table?.tableNumber ? `Table ${order.table.tableNumber}` : 'Takeaway'}
              </span>
              {order.customerName && (
                <span className="text-xs text-slate-400 truncate max-w-[120px]" title={order.customerName}>
                  • {order.customerName}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {/* Urgency Badge */}
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${urgencyStyles.badge}`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatElapsedTime(elapsedMins)}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between text-xs font-medium">
          <span className="text-slate-400">Stage:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[11px] ${
              isNew
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                : isAccepted
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : isPreparing
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : isReady
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {order.status === 'pending' ? 'new' : order.status}
          </span>
        </div>

        {/* Items List */}
        <div className="p-4 flex-1 space-y-3 divide-y divide-slate-800/80 overflow-y-auto max-h-[360px]">
          {order.items?.map((item) => (
            <div key={item.id} className="pt-2.5 first:pt-0">
              <div className="flex items-start gap-2.5">
                <span className="font-black text-orange-400 text-lg leading-none pt-0.5 min-w-[28px]">
                  {item.quantity}×
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-100 leading-snug">{item.productName}</p>
                  {item.notes && (
                    <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900/50 px-2 py-1 rounded-md mt-1.5 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Note: {item.notes}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Customer Special Instructions */}
          {order.specialInstructions && (
            <div className="pt-3">
              <div className="p-2.5 rounded-xl bg-orange-950/30 border border-orange-900/40">
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                  Order Instructions
                </span>
                <p className="text-xs text-orange-200/90 mt-1 font-medium">{order.specialInstructions}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800">
          {isNew && (
            <button
              disabled={isUpdating}
              onClick={() => handleUpdateStatus(order, 'accepted')}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Accept Order</span>
            </button>
          )}

          {(isAccepted || isPreparing) && (
            <button
              disabled={isUpdating}
              onClick={() => handleUpdateStatus(order, 'ready')}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Ready to Serve</span>
            </button>
          )}

          {isReady && (
            <button
              disabled={isUpdating}
              onClick={() => handleUpdateStatus(order, 'served')}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Mark Served (Complete)</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  if (sessionLoading && !initialLoadedRef.current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-3" />
        <p className="text-slate-400 font-medium text-sm">Authenticating Kitchen Display...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* 1. KDS Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3.5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Kitchen Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-950/50">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MenuGo KDS
                </h1>
                {/* Connection Status Pill */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isConnected
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                      : isReconnecting
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/80 animate-pulse'
                      : 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                  }`}
                  title={isConnected ? 'Live WebSocket Connected' : 'Reconnecting to server...'}
                >
                  {isConnected ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="hidden sm:inline">Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-amber-400" />
                      <span>{isReconnecting ? 'Reconnecting' : 'Offline'}</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {activeRestaurant ? activeRestaurant.name : 'Kitchen Display System'} • Role: {role}
              </p>
            </div>
          </div>

          {/* Restaurant Switcher & Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            {restaurants.length > 1 && (
              <div className="relative">
                <select
                  value={selectedMembership?.restaurantId || ''}
                  onChange={(e) => {
                    const match = restaurants.find((m) => m.restaurantId === e.target.value);
                    if (match) {
                      setSelectedMembership(match);
                      setRole(match.role || 'kitchen');
                    }
                  }}
                  className="bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {restaurants.map((m) => (
                    <option key={m.restaurantId} value={m.restaurantId}>
                      {m.restaurant.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* View Mode Switcher (Columns / Grid) */}
            <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('columns')}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  viewMode === 'columns' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Column Kanban View"
              >
                <Columns3 className="w-4 h-4" />
                <span className="text-[11px] hidden md:inline">Columns</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  viewMode === 'grid' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid Card View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-[11px] hidden md:inline">Grid</span>
              </button>
            </div>

            {/* Sound Toggle Button */}
            <button
              onClick={() => {
                initAudio();
                setSoundEnabled(!soundEnabled);
              }}
              className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold ${
                soundEnabled
                  ? 'bg-orange-600/20 text-orange-400 border-orange-500/40 hover:bg-orange-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title={soundEnabled ? 'Kitchen sound chimes enabled' : 'Kitchen sounds muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden md:inline">{soundEnabled ? 'Audio On' : 'Muted'}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => loadOrders(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition disabled:opacity-50"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-400' : ''}`} />
            </button>

            {/* Navigation to Cashier Desk */}
            <Link
              href="/admin/cashier"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition"
            >
              Cashier
            </Link>

            {/* Navigation to Admin */}
            <Link
              href="/admin/orders"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition"
            >
              All Orders
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Audio Autoplay Permission Banner (If sound is enabled but context suspended) */}
      {soundEnabled && !audioUnlocked && (
        <div
          onClick={initAudio}
          className="bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md hover:brightness-105 transition"
        >
          <BellRing className="w-4 h-4 animate-bounce" />
          <span>Tap anywhere to enable kitchen audio chimes (browser autoplay requires 1 tap)</span>
        </div>
      )}

      {/* Instant New Order Alert Flash Banner */}
      {newOrderToast && (
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-4 py-2.5 flex items-center justify-between shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-yellow-300 animate-bounce shrink-0" />
            <div>
              <p className="font-black text-xs sm:text-sm tracking-wide">
                NEW ORDER #{newOrderToast.orderNumber} RECEIVED!
              </p>
              <p className="text-[11px] text-orange-100 font-medium">
                {newOrderToast.tableNumber ? `Table ${newOrderToast.tableNumber}` : 'Dine-in Order'} • Added to queue instantly (0ms delay)
              </p>
            </div>
          </div>
          <button
            onClick={() => setNewOrderToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition"
            aria-label="Dismiss alert"
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      )}

      {/* 3. Stale Data / Disconnection Alert */}
      {isStaleData && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 text-amber-200 px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Connection delayed. Orders might be out of date.</span>
          </div>
          <button
            onClick={() => loadOrders(true)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition"
          >
            Refresh Now
          </button>
        </div>
      )}

      {/* 4. Global Error Alert */}
      {errorMessage && (
        <div className="m-4 p-3.5 bg-rose-950/90 border border-rose-700/80 rounded-xl text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-rose-300 hover:text-white px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5. Incoming Orders Urgent Notice Banner */}
      {groupedOrders.newOrders.length > 0 && (
        <section className="bg-gradient-to-r from-orange-950/90 via-slate-900 to-slate-900 border-b border-orange-500/40 px-4 md:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            <span className="text-xs md:text-sm font-black text-orange-300 uppercase tracking-wide">
              {groupedOrders.newOrders.length} New {groupedOrders.newOrders.length === 1 ? 'Order' : 'Orders'} Awaiting Acknowledgment
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Total In Kitchen: <span className="font-bold text-slate-200">{groupedOrders.allActiveOrders.length}</span>
          </div>
        </section>
      )}

      {/* 6. Main Kitchen Content Area */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        {loading ? (
          // Skeleton Loading State
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-4 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="w-24 h-6 bg-slate-800 rounded"></div>
                  <div className="w-16 h-6 bg-slate-800 rounded-full"></div>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-4 bg-slate-800 rounded"></div>
                  <div className="w-3/4 h-4 bg-slate-800 rounded"></div>
                </div>
                <div className="w-full h-10 bg-slate-800 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : groupedOrders.allActiveOrders.length === 0 ? (
          // Empty State
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-700 mb-4 shadow-inner">
              <Utensils className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-200 tracking-tight">Kitchen Queue is Clear</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1.5 leading-relaxed">
              No orders are currently waiting. When customers place orders from a table QR code, they will chime and
              appear here automatically in real time.
            </p>
            <button
              onClick={() => loadOrders(true)}
              className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              Check For Orders
            </button>
          </div>
        ) : viewMode === 'columns' ? (
          // 3-Column Kanban KDS Layout (Optimized for Tablets & Large Screens)
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Column 1: Incoming / New Orders */}
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-slate-900/80 border border-orange-500/30 rounded-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-orange-400">
                    New Incoming
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {groupedOrders.newOrders.length}
                </span>
              </div>

              {groupedOrders.newOrders.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  No new orders waiting
                </div>
              ) : (
                groupedOrders.newOrders.map(renderOrderCard)
              )}
            </div>

            {/* Column 2: In Preparation */}
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-slate-900/80 border border-cyan-500/30 rounded-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-cyan-400">
                    In Preparation
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {groupedOrders.preparingOrders.length}
                </span>
              </div>

              {groupedOrders.preparingOrders.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  No orders currently cooking
                </div>
              ) : (
                groupedOrders.preparingOrders.map(renderOrderCard)
              )}
            </div>

            {/* Column 3: Ready for Delivery */}
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-slate-900/80 border border-purple-500/30 rounded-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400">
                    Ready to Serve
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {groupedOrders.readyOrders.length}
                </span>
              </div>

              {groupedOrders.readyOrders.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  No completed dishes awaiting table run
                </div>
              ) : (
                groupedOrders.readyOrders.map(renderOrderCard)
              )}
            </div>
          </div>
        ) : (
          // Grid View Layout with Filter Pills
          <div className="space-y-6">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>All Active</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30">
                  {groupedOrders.allActiveOrders.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('new')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'new'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>New</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30">
                  {groupedOrders.newOrders.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('preparing')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'preparing'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>Cooking</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30">
                  {groupedOrders.preparingOrders.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ready')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'ready'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>Ready</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30">
                  {groupedOrders.readyOrders.length}
                </span>
              </button>
            </div>

            {/* Grid display */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {gridFilteredOrders.map(renderOrderCard)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
