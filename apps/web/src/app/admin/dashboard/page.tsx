'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { RestaurantOnboardingForm } from '@/components/RestaurantOnboardingForm';
import { RestaurantProfileModal } from '@/components/RestaurantProfileModal';
import {
  UtensilsCrossed,
  QrCode,
  ChefHat,
  LogOut,
  Plus,
  Store,
  ExternalLink,
  Loader2,
  Settings,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Layers,
  Utensils,
  Users,
  CreditCard,
  Film,
  X
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [cinemaTheatres, setCinemaTheatres] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

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

  const loadRestaurants = async (selectRestaurantId?: string, isSilent = false) => {
    try {
      if (!isSilent && restaurants.length === 0) {
        setLoading(true);
      }
      const data = await apiRequest('/api/restaurants/my');
      const restaurantOnly = data.filter((r: any) => (r.restaurant?.tenantType || 'restaurant') === 'restaurant');
      const cinemaOnly = data.filter((r: any) => r.restaurant?.tenantType === 'cinema');

      setRestaurants(restaurantOnly);
      setCinemaTheatres(cinemaOnly);

      if (restaurantOnly.length > 0) {
        if (selectRestaurantId) {
          const match = restaurantOnly.find((r: any) => r.restaurant.id === selectRestaurantId);
          setSelectedMembership(match || restaurantOnly[0]);
        } else {
          setSelectedMembership((prev: any) => {
            if (!prev) return restaurantOnly[0];
            const found = restaurantOnly.find((r: any) => r.restaurant.id === prev.restaurant?.id);
            return found || restaurantOnly[0];
          });
        }
      } else {
        setSelectedMembership(null);
      }
    } catch (err: any) {
      console.error('Failed to load restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedRestaurant = selectedMembership?.restaurant;
  const currentRole = selectedMembership?.role;

  if ((sessionLoading || loading) && !initialLoadedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white font-bold flex items-center justify-center">
              M
            </div>
            <span className="font-extrabold text-base sm:text-xl text-slate-900 leading-none">
              Menu<span className="text-orange-600">Go</span>
            </span>
          </Link>

          {/* Restaurant switcher */}
          {restaurants.length > 0 && (
            <div className="relative max-w-[140px] sm:max-w-[200px]">
              <select
                value={selectedRestaurant?.id || ''}
                onChange={(e) => {
                  const found = restaurants.find((r) => r.restaurant.id === e.target.value);
                  if (found) setSelectedMembership(found);
                }}
                className="w-full px-2.5 sm:px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 truncate"
              >
                {restaurants.map((item) => (
                  <option key={item.restaurant.id} value={item.restaurant.id}>
                    {item.restaurant.name} ({item.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Switch to Cinema Dashboard if user has cinema accounts */}
          {cinemaTheatres.length > 0 && (
            <Link
              href="/cinema/admin/dashboard"
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition flex items-center gap-1.5 shrink-0"
            >
              <Film className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Cinema Console</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-xs sm:text-sm font-semibold hover:bg-orange-100 transition shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Restaurant</span>
            <span className="sm:hidden">New</span>
          </button>

          <span className="text-xs sm:text-sm font-medium text-slate-600 hidden md:inline max-w-[150px] truncate">
            {session?.user?.name || session?.user?.email}
          </span>

          <button
            onClick={async () => {
              await signOut();
              router.push('/admin/login');
            }}
            className="p-2 text-slate-500 hover:text-red-600 transition rounded-lg hover:bg-slate-100"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {restaurants.length === 0 ? (
          cinemaTheatres.length > 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto p-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <Film className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Cinema Account Detected</h3>
              <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                You are registered as a Cinema Theatre administrator ({cinemaTheatres[0]?.restaurant?.name}).
                Auditorium screens, row seating layouts, and daily movie show schedules are managed in the Cinema Console.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/cinema/admin/dashboard"
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                >
                  <Film className="w-4 h-4" />
                  <span>Go to Cinema Console</span>
                </Link>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition"
                >
                  Register a Restaurant
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto p-8">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Welcome to MenuGo!</h3>
              <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                You haven&apos;t registered any restaurants yet. Set up your restaurant identity and customer QR slug to start serving digital contactless orders.
              </p>
              <div className="mt-8">
                <RestaurantOnboardingForm
                  onSuccess={(newRest) => {
                    loadRestaurants(newRest.id);
                  }}
                />
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {/* Restaurant Profile Banner */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black text-slate-900">{selectedRestaurant?.name}</h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {currentRole}
                  </span>
                  {!selectedRestaurant?.isActive && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="font-mono text-slate-700">
                    Slug: <strong className="text-orange-600">/{selectedRestaurant?.slug}</strong>
                  </span>
                  <span>•</span>
                  <span>Currency: <strong>{selectedRestaurant?.currency}</strong></span>
                  {selectedRestaurant?.phone && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedRestaurant.phone}
                      </span>
                    </>
                  )}
                  {selectedRestaurant?.address && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 max-w-xs truncate" title={selectedRestaurant.address}>
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {selectedRestaurant.address}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition shadow-sm"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Profile Settings</span>
                </button>

                <Link
                  href={`/menu/${selectedRestaurant?.slug}`}
                  target="_blank"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Preview Menu</span>
                </Link>

                <Link
                  href="/admin/cashier"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-md"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Cashier Desk</span>
                </Link>

                <Link
                  href="/kitchen"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition shadow-md"
                >
                  <ChefHat className="w-4 h-4" />
                  <span>Kitchen KDS</span>
                </Link>

                <Link
                  href="/admin/service"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition shadow-md"
                >
                  <Utensils className="w-4 h-4" />
                  <span>Service Pass</span>
                </Link>
              </div>
            </div>

            {/* Quick Action Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link
                href="/admin/cashier"
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition block group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition flex items-center gap-2">
                  <span>Cashier &amp; Tables</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">Live</span>
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  View all tables, live running bills, and close table sessions when customers leave.
                </p>
              </Link>

              <Link
                href="/admin/service"
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition block group"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition">
                  <Utensils className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition flex items-center gap-2">
                  <span>Floor Service Pass</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-700">Ready</span>
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Dedicated view for floor waitstaff. Realtime READY order queue, table numbers, and served actions.
                </p>
              </Link>
              <Link
                href="/admin/products"
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition block group"
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4 group-hover:bg-orange-600 group-hover:text-white transition">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition">
                  Menu Products
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Create dishes, set integer paise prices, veg/non-veg tags, and live availability.
                </p>
              </Link>

              <Link
                href="/admin/categories"
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition block group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition">
                  Menu Categories
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Organize digital sections, reorder courses, and manage display sequence.
                </p>
              </Link>

              <Link
                href="/admin/tables"
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition block group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                  Tables &amp; QR Codes
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Generate table-specific QR codes with instant print and secure regeneration tokens.
                </p>
              </Link>

              <Link
                href="/admin/orders"
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition block group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition">
                  Orders Management
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Manage active dine-in orders, table requests, status transitions and audit history.
                </p>
              </Link>

              <Link
                href="/admin/staff"
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition block group"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
                  Staff &amp; Memberships
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Invite managers, kitchen operators and floor staff with role-based access control.
                </p>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Create New Restaurant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Add New Restaurant</h3>
                  <p className="text-xs text-slate-500">Register a new restaurant under your account.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <RestaurantOnboardingForm
              onSuccess={(newRest) => {
                setShowCreateModal(false);
                loadRestaurants(newRest.id);
              }}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Restaurant Profile & Settings Modal */}
      {selectedRestaurant && (
        <RestaurantProfileModal
          restaurantId={selectedRestaurant.id}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onUpdated={(updated) => {
            loadRestaurants(updated.id);
          }}
        />
      )}
    </div>
  );
}
