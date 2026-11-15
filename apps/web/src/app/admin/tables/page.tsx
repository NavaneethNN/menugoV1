'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import {
  UtensilsCrossed,
  Plus,
  ArrowLeft,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Store,
  Layers,
  ShieldCheck,
  LogOut,
  X,
  QrCode,
  RotateCw,
  Printer,
  Download,
  Copy,
  Check,
  Users,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

interface RestaurantTable {
  id: string;
  restaurantId: string;
  tableNumber: string;
  tableToken: string;
  capacity: number;
  isActive: boolean;
  qrCodeUrl: string | null;
  qrCodeData: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTablesPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [deletingTable, setDeletingTable] = useState<RestaurantTable | null>(null);
  const [rotatingTable, setRotatingTable] = useState<RestaurantTable | null>(null);
  const [previewQrTable, setPreviewQrTable] = useState<RestaurantTable | null>(null);

  // Form states
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Feedback states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Permissions check
  const role = selectedMembership?.role;
  const canManageTables = role === 'owner' || role === 'admin';

  // Load user's restaurants
  const loadRestaurants = useCallback(async () => {
    try {
      const data = await apiRequest('/api/restaurants/my');
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedMembership((prev: any) => {
          if (!prev) return data[0];
          const match = data.find((r: any) => r.restaurant.id === prev.restaurant.id);
          return match || data[0];
        });
      }
    } catch (err: any) {
      console.error('Failed to load restaurants:', err);
    }
  }, []);

  // Load tables for selected restaurant
  const loadTables = useCallback(async (restaurantId: string) => {
    try {
      setLoading(true);
      const data = await apiRequest<RestaurantTable[]>('/api/tables', { restaurantId });
      setTables(data);
    } catch (err: any) {
      console.error('Failed to load tables:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (selectedMembership?.restaurant?.id) {
      loadTables(selectedMembership.restaurant.id);
    }
  }, [selectedMembership, loadTables]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // ---------------------------------------------------------------------------
  // Create Table Handler
  // ---------------------------------------------------------------------------
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMembership?.restaurant?.id) return;

    const trimmed = tableNumber.trim();
    if (!trimmed) {
      setFormError('Table number or name is required');
      return;
    }

    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum < 1) {
      setFormError('Capacity must be at least 1 guest');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const created = await apiRequest<RestaurantTable>('/api/tables', {
        method: 'POST',
        restaurantId: selectedMembership.restaurant.id,
        body: JSON.stringify({
          tableNumber: trimmed,
          capacity: capNum,
          isActive
        })
      });

      setTables((prev) => [...prev, created].sort((a, b) => a.tableNumber.localeCompare(b.tableNumber)));
      setShowAddModal(false);
      setTableNumber('');
      setCapacity('4');
      setIsActive(true);
      showSuccess(`Table "${created.tableNumber}" created with secure QR code!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create table. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Update Table Handler
  // ---------------------------------------------------------------------------
  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !selectedMembership?.restaurant?.id) return;

    const trimmed = tableNumber.trim();
    if (!trimmed) {
      setFormError('Table number or name is required');
      return;
    }

    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum < 1) {
      setFormError('Capacity must be at least 1 guest');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const updated = await apiRequest<RestaurantTable>(`/api/tables/${editingTable.id}`, {
        method: 'PATCH',
        restaurantId: selectedMembership.restaurant.id,
        body: JSON.stringify({
          tableNumber: trimmed,
          capacity: capNum,
          isActive
        })
      });

      setTables((prev) =>
        prev
          .map((t) => (t.id === updated.id ? updated : t))
          .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber))
      );
      setEditingTable(null);
      showSuccess(`Table "${updated.tableNumber}" updated successfully.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update table.');
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rotate / Revoke Token Handler
  // ---------------------------------------------------------------------------
  const handleRotateToken = async () => {
    if (!rotatingTable || !selectedMembership?.restaurant?.id) return;

    setFormLoading(true);
    try {
      const res = await apiRequest<{ message: string; table: RestaurantTable }>(
        `/api/tables/${rotatingTable.id}/rotate-token`,
        {
          method: 'POST',
          restaurantId: selectedMembership.restaurant.id
        }
      );

      setTables((prev) => prev.map((t) => (t.id === res.table.id ? res.table : t)));
      setRotatingTable(null);
      showSuccess(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to rotate QR token.');
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete Table Handler
  // ---------------------------------------------------------------------------
  const handleDeleteTable = async () => {
    if (!deletingTable || !selectedMembership?.restaurant?.id) return;

    setFormLoading(true);
    try {
      await apiRequest(`/api/tables/${deletingTable.id}`, {
        method: 'DELETE',
        restaurantId: selectedMembership.restaurant.id
      });

      setTables((prev) => prev.filter((t) => t.id !== deletingTable.id));
      showSuccess(`Table "${deletingTable.tableNumber}" deleted.`);
      setDeletingTable(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete table.');
    } finally {
      setFormLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrintStand = () => {
    window.print();
  };

  if (sessionLoading && !initialLoadedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  const restaurant = selectedMembership?.restaurant;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/dashboard"
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold text-lg">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-900 leading-tight">
                    Tables & QR Codes
                  </h1>
                  <p className="text-xs text-slate-500">
                    Dine-in table management and printable QR codes
                  </p>
                </div>
              </div>
            </div>

            {/* Restaurant Selector & Actions */}
            <div className="flex items-center gap-3">
              {restaurants.length > 1 && (
                <select
                  value={selectedMembership?.restaurant?.id || ''}
                  onChange={(e) => {
                    const match = restaurants.find((r) => r.restaurant.id === e.target.value);
                    if (match) setSelectedMembership(match);
                  }}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {restaurants.map((r) => (
                    <option key={r.restaurant.id} value={r.restaurant.id}>
                      {r.restaurant.name} ({r.role})
                    </option>
                  ))}
                </select>
              )}

              {canManageTables && (
                <button
                  onClick={() => {
                    setTableNumber('');
                    setCapacity('4');
                    setIsActive(true);
                    setFormError(null);
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Table</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6 border-t border-slate-100 text-xs font-semibold">
          <Link
            href="/admin/dashboard"
            className="py-3 text-slate-500 hover:text-slate-800 transition"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/products"
            className="py-3 text-slate-500 hover:text-slate-800 transition"
          >
            Products
          </Link>
          <Link
            href="/admin/categories"
            className="py-3 text-slate-500 hover:text-slate-800 transition"
          >
            Categories
          </Link>
          <Link
            href="/admin/tables"
            className="py-3 border-b-2 border-orange-600 text-orange-600 font-bold"
          >
            Tables & QR
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Alert */}
        {successMessage && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Notice Info Banner */}
        <div className="mb-6 bg-blue-50/70 border border-blue-200/60 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Cryptographically Unguessable QR Tokens: </span>
            Each table QR code contains a 192-bit cryptographic token. Sequential table IDs or numbers
            are never used as security identifiers. If you rotate a table&apos;s token, previously printed QR
            stands will be immediately invalidated to prevent unauthorized scans.
          </div>
        </div>

        {/* Tables Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
                <div className="h-6 bg-slate-200 rounded w-1/2" />
                <div className="h-44 bg-slate-200 rounded-2xl" />
                <div className="h-8 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : tables.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-md mx-auto shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Tables Configured</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
              Add your dining tables or seating zones to automatically generate high-resolution QR codes
              for customer ordering.
            </p>
            {canManageTables && (
              <button
                onClick={() => {
                  setTableNumber('');
                  setCapacity('4');
                  setIsActive(true);
                  setFormError(null);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Table</span>
              </button>
            )}
          </div>
        ) : (
          /* Table Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tables.map((table) => (
              <div
                key={table.id}
                className={`bg-white rounded-3xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                  table.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-80'
                }`}
              >
                <div>
                  {/* Table Header */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{table.tableNumber}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Seats {table.capacity} guests</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        table.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {table.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* QR Code Preview Thumbnail */}
                  <div
                    onClick={() => setPreviewQrTable(table)}
                    className="relative bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-orange-50/40 hover:border-orange-200 transition"
                    title="Click to view full QR code and print options"
                  >
                    {table.qrCodeData ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={table.qrCodeData}
                        alt={`QR code for ${table.tableNumber}`}
                        className="w-36 h-36 object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-36 h-36 flex items-center justify-center text-slate-300">
                        <QrCode className="w-16 h-16" />
                      </div>
                    )}
                    <span className="text-[11px] font-bold text-orange-600 mt-2 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                      <Eye className="w-3.5 h-3.5" />
                      View & Print QR
                    </span>
                  </div>
                </div>

                {/* Table Actions */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPreviewQrTable(table)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl transition"
                    title="Printable QR Code"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Print Stand</span>
                  </button>

                  {canManageTables && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTable(table);
                          setTableNumber(table.tableNumber);
                          setCapacity(String(table.capacity));
                          setIsActive(table.isActive);
                          setFormError(null);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                        title="Edit Table"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setRotatingTable(table)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition"
                        title="Rotate / Revoke QR Token"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingTable(table)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Delete Table"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* =====================================================================
          1. Create Table Modal
      ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Add Dining Table</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Table Number or Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 1, T-12, Rooftop 4, Bar 2"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seating Capacity (Guests)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white font-medium"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Active (Customers can scan and access menu)
                  </span>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                >
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate QR Table</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. Edit Table Modal
      ===================================================================== */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Edit Table</h2>
              </div>
              <button
                onClick={() => setEditingTable(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTable} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Table Number or Name *
                </label>
                <input
                  type="text"
                  required
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seating Capacity (Guests)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white font-medium"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      Active for Dine-In Customers
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      When disabled, scanning this QR code returns a table disabled notice.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                >
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. Rotate Token Confirmation Modal
      ===================================================================== */}
      {rotatingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <RotateCw className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">
              Rotate QR Token for &quot;{rotatingTable.tableNumber}&quot;?
            </h3>

            <div className="mt-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Warning: Revokes Previous Printed QR Codes</span>
              </p>
              <p>
                Generating a new QR token will immediately invalidate any previously printed table
                stands or stickers. Customers scanning old QR codes will be denied access.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setRotatingTable(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Keep Existing Token
              </button>
              <button
                type="button"
                onClick={handleRotateToken}
                disabled={formLoading}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
              >
                {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Rotate & Revoke Old QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. Delete Table Confirmation Modal
      ===================================================================== */}
      {deletingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">
              Delete &quot;{deletingTable.tableNumber}&quot;?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-2">
              Are you sure you want to delete this table? The QR code will cease functioning permanently.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingTable(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTable}
                disabled={formLoading}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
              >
                {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Table</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. Full QR Code Preview & Printable Table Stand Sheet Modal
      ===================================================================== */}
      {previewQrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:p-0 print:bg-white print:fixed print:inset-0">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 print:shadow-none print:border-none print:max-w-none print:w-full">
            {/* Modal Header (Hidden during print) */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {previewQrTable.tableNumber} QR Code
                </h2>
              </div>
              <button
                onClick={() => setPreviewQrTable(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Table Stand Card Preview */}
            <div className="my-6 p-6 sm:p-8 bg-white border-2 border-slate-200 rounded-3xl text-center shadow-xs flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-bold text-xl mb-3 shadow-sm">
                <UtensilsCrossed className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {restaurant?.name || 'MenuGo'}
              </h3>
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mt-0.5">
                Scan &amp; Order
              </p>

              {/* QR Image */}
              <div className="my-5 p-3 bg-white rounded-2xl border border-slate-200 shadow-xs inline-block">
                {previewQrTable.qrCodeData ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewQrTable.qrCodeData}
                    alt={`QR Code for ${previewQrTable.tableNumber}`}
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-50 text-slate-300">
                    <QrCode className="w-20 h-20" />
                  </div>
                )}
              </div>

              {/* Table Name Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-sm font-extrabold tracking-wide">
                <span>{previewQrTable.tableNumber}</span>
              </div>

              <p className="text-xs text-slate-500 mt-3 max-w-xs leading-relaxed">
                Point your phone camera at the QR code to browse our digital menu and order.
              </p>
            </div>

            {/* Customer URL & Copy Link (Hidden during print) */}
            {previewQrTable.qrCodeUrl && (
              <div className="mb-6 print:hidden">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Customer URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={previewQrTable.qrCodeUrl}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono truncate"
                  />
                  <button
                    onClick={() => copyToClipboard(previewQrTable.qrCodeUrl!)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0"
                    title="Copy Customer Menu Link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons (Hidden during print) */}
            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
              {previewQrTable.qrCodeData && (
                <a
                  href={previewQrTable.qrCodeData}
                  download={`${restaurant?.slug || 'restaurant'}-${previewQrTable.tableNumber}-qr.png`}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Download PNG</span>
                </a>
              )}

              <button
                onClick={handlePrintStand}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Stand Card</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

