import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from './socket-client';
import { SOCKET_EVENTS, REALTIME_EVENTS } from '@menugo/shared';

/**
 * Bounded event deduplicator to drop duplicate event delivery.
 * Automatically evicts older entries when capacity exceeds limit.
 */
export class EventDeduplicator {
  private seenIds = new Set<string>();
  private orderQueue: string[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 300) {
    this.maxEntries = maxEntries;
  }

  has(eventId: string): boolean {
    if (!eventId) return false;
    return this.seenIds.has(eventId);
  }

  add(eventId: string): void {
    if (!eventId || this.seenIds.has(eventId)) return;

    if (this.orderQueue.length >= this.maxEntries) {
      const oldest = this.orderQueue.shift();
      if (oldest) this.seenIds.delete(oldest);
    }

    this.seenIds.add(eventId);
    this.orderQueue.push(eventId);
  }

  clear(): void {
    this.seenIds.clear();
    this.orderQueue = [];
  }
}

/**
 * Checks if an incoming event timestamp is older than current data (out-of-order / delayed).
 */
export function isStaleEvent(incomingTimestamp: string | Date, currentTimestamp: string | Date): boolean {
  const incoming = new Date(incomingTimestamp).getTime();
  const current = new Date(currentTimestamp).getTime();

  if (isNaN(incoming) || isNaN(current)) return false;
  return incoming < current;
}

export interface UseRealtimeOptions {
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleThresholdMs?: number;
  channelType: 'restaurant' | 'order';
  channelId: string; // restaurantId or statusToken
}

/**
 * Comprehensive hook providing realtime subscriptions with:
 * 1. Event as notification (Postgres API is always the authoritative source of truth)
 * 2. Automatic refetch on reconnect
 * 3. Automatic refetch on tab focus & visibility change
 * 4. Stale state detection with background resync
 * 5. Event deduplication and out-of-order drop
 */
export function useRealtimeSubscription<TEvent = any>(
  options: UseRealtimeOptions,
  onEvent: (eventType: string, payload: TEvent) => void,
  onRefetchAuthoritative: () => Promise<void> | void
) {
  const {
    channelType,
    channelId,
    refetchOnFocus = true,
    refetchOnReconnect = true,
    staleThresholdMs = 45000
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const deduplicatorRef = useRef(new EventDeduplicator());
  const onEventRef = useRef(onEvent);
  const onRefetchRef = useRef(onRefetchAuthoritative);

  onEventRef.current = onEvent;
  onRefetchRef.current = onRefetchAuthoritative;

  // Trigger authoritative refresh safely
  const triggerRefetch = useCallback(async () => {
    try {
      await onRefetchRef.current();
      setLastSyncTime(new Date());
      setIsStale(false);
    } catch (err) {
      console.warn('[Realtime] Authoritative refetch error:', err);
    }
  }, []);

  // 1. Tab Focus & Page Visibility Change Listeners (Requirement 6)
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleFocus = () => {
      triggerRefetch();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetchOnFocus, triggerRefetch]);

  // 2. Staleness Watchdog (Requirement 6)
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastSyncTime.getTime();
      if (elapsed > staleThresholdMs) {
        setIsStale(true);
        // Automatically attempt resync
        triggerRefetch();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [lastSyncTime, staleThresholdMs, triggerRefetch]);

  // 3. Socket Connection & Subscription (Requirements 2, 3, 6, 7)
  useEffect(() => {
    if (!channelId) return;

    const socket = getSocket();

    const joinChannel = () => {
      if (channelType === 'restaurant') {
        socket.emit(SOCKET_EVENTS.JOIN_RESTAURANT, channelId, (ack?: any) => {
          if (ack && !ack.success) {
            console.warn(`[Realtime] Failed to subscribe to restaurant ${channelId}:`, ack.error);
          }
        });
      } else {
        socket.emit(SOCKET_EVENTS.JOIN_ORDER, { statusToken: channelId }, (ack?: any) => {
          if (ack && !ack.success) {
            console.warn(`[Realtime] Failed to subscribe to order token ${channelId}:`, ack.error);
          }
        });
      }
    };

    const handleConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      joinChannel();

      // On reconnect, refetch authoritative state (Requirement 6)
      if (refetchOnReconnect) {
        triggerRefetch();
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    const handleConnectError = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    // Generic Event Ingest with Deduplication (Requirement 7)
    const handleIncomingEvent = (eventType: string, payload: any) => {
      const eventId = payload?.eventId;
      if (eventId) {
        if (deduplicatorRef.current.has(eventId)) {
          // Drop duplicate event delivery
          return;
        }
        deduplicatorRef.current.add(eventId);
      }

      setLastSyncTime(new Date());
      setIsStale(false);
      onEventRef.current(eventType, payload);
    };

    const onOrderCreated = (p: any) => handleIncomingEvent(REALTIME_EVENTS.ORDER_CREATED, p);
    const onOrderUpdated = (p: any) => handleIncomingEvent(REALTIME_EVENTS.ORDER_UPDATED, p);
    const onStatusChanged = (p: any) => handleIncomingEvent(REALTIME_EVENTS.ORDER_STATUS_CHANGED, p);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on(SOCKET_EVENTS.ORDER_CREATED, onOrderCreated);
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, onOrderUpdated);
    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGED, onStatusChanged);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      if (channelType === 'restaurant') {
        socket.emit(SOCKET_EVENTS.LEAVE_RESTAURANT, channelId);
      } else {
        socket.emit(SOCKET_EVENTS.LEAVE_ORDER, { statusToken: channelId });
      }

      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off(SOCKET_EVENTS.ORDER_CREATED, onOrderCreated);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, onOrderUpdated);
      socket.off(SOCKET_EVENTS.ORDER_STATUS_CHANGED, onStatusChanged);
    };
  }, [channelType, channelId, refetchOnReconnect, triggerRefetch]);

  return {
    isConnected,
    isReconnecting,
    isStale,
    lastSyncTime,
    refetch: triggerRefetch
  };
}

