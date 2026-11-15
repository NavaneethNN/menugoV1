'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket-client';
import { SOCKET_EVENTS, formatPaise } from '@menugo/shared';
import {
  CreditCard,
  UtensilsCrossed,
  ChefHat,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  X,
  Search,
  Printer,
  Sparkles,
  QrCode,
  Wifi,
  WifiOff,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Check
} from 'lucide-react';

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  totalFormatted: string;
  createdAt: string;
}

interface ActiveSession {
  id: string;
  sessionToken: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  openedAt: string;
  durationMinutes: number;
  orderCount: number;
  unservedCount: number;
  totalPaise: number;
  totalFormatted: string;
  orders: ActiveOrder[];
}

interface CashierTable {
  id: string;
  tableNumber: string;
  capacity: number;
  isActive: boolean;
  status: 'available' | 'occupied';
  qrCodeUrl?: string | null;
  activeSession: ActiveSession | null;
}

interface CashierSummary {
  totalTables: number;
  occupiedCount: number;
  availableCount: number;
  totalActiveRevenuePaise: number;
  totalActiveRevenueFormatted: string;
  activeOrdersCount: number;
}

interface BillItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  subtotal: number;
  subtotalFormatted: string;
  notes?: string | null;
}

interface BillOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalPaise: number;
  totalFormatted: string;
  createdAt: string;
  items: BillItem[];
}

interface TableBillData {
  restaurant: {
    id: string;
    name: string;
    currency: string;
  };
  table: {
    id: string;
    tableNumber: string;
    capacity: number;
  };
  session: {
    id: string;
    status?: string;
    openedAt: string;
    closedAt?: string | null;
    durationMinutes: number;
    customerName?: string | null;
    customerPhone?: string | null;
  };
  orders: BillOrder[];
  grandTotalPaise: number;
  grandTotalFormatted: string;
}

export default function AdminCashierPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);

  // Restaurant Context
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);

  // Cashier State
  const [tables, setTables] = useState<CashierTable[]>([]);
  const [summary, setSummary] = useState<CashierSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Realtime Status
  const [socketConnected, setSocketConnected] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'occupied' | 'available'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [closingTable, setClosingTable] = useState<CashierTable | null>(null);
  const [activeBillTable, setActiveBillTable] = useState<CashierTable | null>(null);
  const [billData, setBillData] = useState<TableBillData | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [showManualOpenModal, setShowManualOpenModal] = useState<CashierTable | null>(null);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
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

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<any[]>('/api/restaurants/my');
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedMembership(data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load restaurant profile');
    } finally {
      setLoading(false);
    }
  };

  const selectedRestaurant = selectedMembership?.restaurant;
  const currentRole = selectedMembership?.role;
  const canCashier =
    currentRole === 'owner' ||
    currentRole === 'admin' ||
    Boolean(selectedMembership?.canCashier);

  // 2. Fetch Cashier Table Overview
  const loadCashierTables = useCallback(async (isSilent = false) => {
    if (!selectedRestaurant?.id) return;

    try {
      if (!isSilent) setLoading(true);
      setError(null);

      const res = await apiRequest<{ tables: CashierTable[]; summary: CashierSummary }>(
        `/api/cashier/tables`,
        {
          restaurantId: selectedRestaurant.id
        }
      );

      if (res) {
        setTables(res.tables || []);
        setSummary(res.summary || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load cashier tables overview');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [selectedRestaurant?.id]);

  useEffect(() => {
    if (selectedRestaurant?.id) {
      loadCashierTables();
    }
  }, [selectedRestaurant?.id, loadCashierTables]);

  // 3. Realtime WebSocket Connection & Event Subscriptions
  useEffect(() => {
    if (!selectedRestaurant?.id) return;

    const socket = getSocket();

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_RESTAURANT, selectedRestaurant.id);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Live update triggers: refresh tables silently without flashing
    const handleLiveUpdate = () => {
      loadCashierTables(true);
    };

    socket.on(SOCKET_EVENTS.TABLE_SESSION_STARTED, handleLiveUpdate);
    socket.on(SOCKET_EVENTS.TABLE_SESSION_CLOSED, handleLiveUpdate);
    socket.on(SOCKET_EVENTS.TABLE_UPDATED, handleLiveUpdate);
    socket.on(SOCKET_EVENTS.ORDER_CREATED, handleLiveUpdate);
    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGED, handleLiveUpdate);

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_RESTAURANT, selectedRestaurant.id);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(SOCKET_EVENTS.TABLE_SESSION_STARTED, handleLiveUpdate);
      socket.off(SOCKET_EVENTS.TABLE_SESSION_CLOSED, handleLiveUpdate);
      socket.off(SOCKET_EVENTS.TABLE_UPDATED, handleLiveUpdate);
      socket.off(SOCKET_EVENTS.ORDER_CREATED, handleLiveUpdate);
      socket.off(SOCKET_EVENTS.ORDER_STATUS_CHANGED, handleLiveUpdate);
    };
  }, [selectedRestaurant?.id, loadCashierTables]);

  // 4. Close Session & Release Table Action
  const handleCloseSession = async () => {
    if (!selectedRestaurant?.id || !closingTable) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ success: boolean; message: string }>(
        `/api/cashier/tables/${closingTable.id}/close-session`,
        {
          method: 'POST',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({
            forceClose: closingTable.activeSession?.unservedCount ? true : false
          })
        }
      );

      showToast(res.message || `Table ${closingTable.tableNumber} released successfully!`);
      setClosingTable(null);
      loadCashierTables(true);
    } catch (err: any) {
      setError(err.message || 'Failed to close table session');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Open Bill Modal
  const handleOpenBill = async (table: CashierTable) => {
    if (!selectedRestaurant?.id || !table.activeSession) return;

    setActiveBillTable(table);
    setLoadingBill(true);
    setError(null);

    try {
      const res = await apiRequest<TableBillData>(
        `/api/cashier/tables/${table.id}/bill`,
        {
          restaurantId: selectedRestaurant.id
        }
      );
      setBillData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bill details');
    } finally {
      setLoadingBill(false);
    }
  };

  // 6. Manual Open Session Action
  const handleManualOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant?.id || !showManualOpenModal) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ success: boolean; message: string }>(
        `/api/cashier/tables/${showManualOpenModal.id}/open-session`,
        {
          method: 'POST',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({
            customerName: manualCustomerName.trim() || undefined,
            customerPhone: manualCustomerPhone.trim() || undefined
          })
        }
      );

      showToast(res.message || `Session opened for Table ${showManualOpenModal.tableNumber}`);
      setShowManualOpenModal(null);
      setManualCustomerName('');
      setManualCustomerPhone('');
      loadCashierTables(true);
    } catch (err: any) {
      setError(err.message || 'Failed to open table session');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      // Tab filter
      if (activeTab === 'occupied' && t.status !== 'occupied') return false;
      if (activeTab === 'available' && t.status !== 'available') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = t.tableNumber.toLowerCase().includes(q);
        const matchesGuest =
          t.activeSession?.customerName?.toLowerCase().includes(q) || false;
        return matchesNumber || matchesGuest;
      }

      return true;
    });
  }, [tables, activeTab, searchQuery]);

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'accepted':
      case 'preparing':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ready':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'served':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200 line-through';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Cashier &amp; Tables</span>
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                Cashier Desk
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {selectedRestaurant?.name || 'Table Session Settlement & Guest Release'}
            </p>
          </div>

          {/* Restaurant switcher */}
          {restaurants.length > 1 && (
            <select
              value={selectedRestaurant?.id}
              onChange={(e) => {
                const found = restaurants.find((r) => r.restaurant.id === e.target.value);
                if (found) setSelectedMembership(found);
              }}
              className="ml-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {restaurants.map((m) => (
                <option key={m.restaurant.id} value={m.restaurant.id}>
                  {m.restaurant.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Realtime Live Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              socketConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
            title={socketConnected ? 'Instant WebSocket Updates Active' : 'Connecting WebSocket...'}
          >
            {socketConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                <span>Reconnecting</span>
              </>
            )}
          </div>

          <button
            onClick={() => loadCashierTables()}
            disabled={actionLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Refresh Table Sessions"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <Link
            href="/admin/service"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-purple-600" />
            <span>Service Pass</span>
          </Link>

          <Link
            href="/kitchen"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
          >
            <ChefHat className="w-3.5 h-3.5 text-orange-600" />
            <span>Kitchen</span>
          </Link>
        </div>
      </header>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary Metric Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Tables
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {summary.totalTables}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
                  Available (Free)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                  {summary.availableCount}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block mb-1">
                  Occupied (Dining)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-700">
                  {summary.occupiedCount}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 sm:p-5 rounded-2xl text-white shadow-md flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 block mb-1">
                  Active Running Bills
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {summary.totalActiveRevenueFormatted}
                </span>
                <span className="text-[10px] text-emerald-200 block mt-0.5">
                  Across {summary.activeOrdersCount} active orders
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Tables ({tables.length})
            </button>
            <button
              onClick={() => setActiveTab('occupied')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'occupied'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-200 animate-pulse" />
              <span>Occupied ({summary?.occupiedCount ?? 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'available'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-200" />
              <span>Available ({summary?.availableCount ?? 0})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by table name..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Table Cards Grid */}
        {loading && tables.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
            <p className="text-sm font-bold text-slate-600">Loading live table sessions...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
            <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No tables found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? 'Try matching a different table name.' : 'No tables match this filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTables.map((table) => {
              const isOccupied = table.status === 'occupied' && Boolean(table.activeSession);
              const session = table.activeSession;

              return (
                <div
                  key={table.id}
                  className={`rounded-3xl border transition shadow-xs flex flex-col justify-between overflow-hidden ${
                    isOccupied
                      ? 'bg-white border-amber-300 ring-1 ring-amber-200 hover:shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900 tracking-tight">
                          {table.tableNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{table.capacity} Seats</span>
                        </span>
                      </div>

                      {isOccupied && session ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-800 font-bold mt-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>Active Session • Seated {session.durationMinutes}m ago</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mt-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Available &amp; Ready</span>
                        </div>
                      )}
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                        isOccupied
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      {isOccupied ? 'Occupied' : 'Available'}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    {isOccupied && session ? (
                      <div className="space-y-3">
                        {/* Guest / Party Details */}
                        {session.customerName && (
                          <div className="text-xs text-slate-600 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            Guest: <strong className="text-slate-900">{session.customerName}</strong>
                            {session.customerPhone && (
                              <span className="text-slate-400 ml-1">({session.customerPhone})</span>
                            )}
                          </div>
                        )}

                        {/* Orders List */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            <span>Placed Orders ({session.orders.length})</span>
                            {session.unservedCount > 0 ? (
                              <span className="text-amber-600 font-extrabold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-500" />
                                <span>{session.unservedCount} in kitchen</span>
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span>All served</span>
                              </span>
                            )}
                          </div>

                          {session.orders.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No orders submitted yet.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {session.orders.map((order) => (
                                <div
                                  key={order.id}
                                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-800">
                                      #{order.orderNumber}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${getOrderStatusBadge(
                                        order.status
                                      )}`}
                                    >
                                      {order.status}
                                    </span>
                                  </div>
                                  <span className="font-black text-slate-900">
                                    {order.totalFormatted}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Live Total Bill */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Total Bill:
                          </span>
                          <span className="text-xl font-black text-emerald-700">
                            {session.totalFormatted}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center space-y-2">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                          <Check className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Table is clean and ready. When guests scan the table QR code, an active dining session will be initiated automatically.
                        </p>
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="pt-2">
                      {isOccupied && session ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleOpenBill(table)}
                            className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            <span>View Bill</span>
                          </button>

                          <button
                            onClick={() => setClosingTable(table)}
                            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-white" />
                            <span>Close &amp; Release</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowManualOpenModal(table)}
                          className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Manual Seat Walk-in</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal 1: Close Table Session & Release Confirmation */}
      {closingTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-slate-900">
                Close Session &amp; Release Table?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to close the dining session for{' '}
                <strong className="text-slate-900">{closingTable.tableNumber}</strong>.
              </p>
            </div>

            {/* Bill Summary Notice */}
            {closingTable.activeSession && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Total Orders:</span>
                  <span className="font-bold text-slate-800">
                    {closingTable.activeSession.orderCount} orders
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>Amount to Collect:</span>
                  <span className="text-emerald-700 text-base font-black">
                    {closingTable.activeSession.totalFormatted}
                  </span>
                </div>
              </div>
            )}

            {/* Unserved warning if orders still cooking */}
            {closingTable.activeSession && closingTable.activeSession.unservedCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Notice: <strong>{closingTable.activeSession.unservedCount}</strong> order(s) are still not marked as served.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setClosingTable(null)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseSession}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:bg-emerald-800 transition shadow-sm flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Release Table</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Itemized Bill / Receipt Statement */}
      {activeBillTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Bill Statement • {activeBillTable.tableNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Itemized receipt summary</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveBillTable(null);
                  setBillData(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingBill ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                <p className="text-xs font-bold text-slate-600">Generating receipt breakdown...</p>
              </div>
            ) : billData ? (
              <div className="space-y-4">
                {/* Receipt Header */}
                <div className="text-center p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <h4 className="text-base font-black text-slate-900">{billData.restaurant.name}</h4>
                  <p className="text-xs text-slate-500">
                    {billData.table.tableNumber} • Seated {new Date(billData.session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({billData.session.durationMinutes} min)
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        billData.session.status === 'closed'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {billData.session.status === 'closed' ? 'Settled & Released' : 'Active Session'}
                    </span>
                  </div>
                  {billData.session.customerName && (
                    <p className="text-xs text-slate-600 font-semibold pt-0.5">
                      Guest: {billData.session.customerName}
                    </p>
                  )}
                </div>

                {/* Orders Breakdown */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {billData.orders.map((order) => (
                    <div key={order.id} className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-200">
                        <span>Order #{order.orderNumber}</span>
                        <span className="font-extrabold text-slate-900">{order.totalFormatted}</span>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs text-slate-600">
                            <span>
                              {item.quantity}x {item.productName}
                            </span>
                            <span className="font-semibold text-slate-800">{item.subtotalFormatted}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grand Total Bar */}
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <span className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                    Grand Total
                  </span>
                  <span className="text-2xl font-black text-emerald-800">
                    {billData.grandTotalFormatted}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Print Receipt</span>
                  </button>

                  {billData.session.status !== 'closed' && (
                    <button
                      onClick={() => {
                        const target = activeBillTable;
                        setActiveBillTable(null);
                        setBillData(null);
                        setClosingTable(target);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Settle &amp; Release Table</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal 3: Manual Open Table Session */}
      {showManualOpenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Seat Guests • {showManualOpenModal.tableNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Manual Walk-in Seating</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualOpenModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualOpenSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Guest Name (Optional)
                </label>
                <input
                  type="text"
                  value={manualCustomerName}
                  onChange={(e) => setManualCustomerName(e.target.value)}
                  placeholder="e.g. Vikram Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Guest Phone (Optional)
                </label>
                <input
                  type="text"
                  value={manualCustomerPhone}
                  onChange={(e) => setManualCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
                Opening this session will mark the table as Occupied immediately and activate the dining session.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualOpenModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-xs flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Open Session</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

