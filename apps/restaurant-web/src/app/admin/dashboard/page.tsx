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
  X,
  ChevronDown,
  User,
  Menu,
  ClipboardList,
  Coins,
  AlertTriangle,
  Clock
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

      // Strictly verify account domain: theatre accounts cannot access restaurant dashboard
      const accountInfo = await apiRequest('/api/auth/account-type').catch(() => null);
      if (accountInfo?.tenantType === 'cinema') {
        router.replace('/cinema/admin/dashboard');
        return;
      }

      const data = await apiRequest('/api/restaurants/my');
      const restaurantOnly = data.filter((r: any) => (r.restaurant?.tenantType || 'restaurant') === 'restaurant');

      setRestaurants(restaurantOnly);

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

        // Fetch subscription status for the active restaurant
        apiRequest('/api/subscriptions/current')
          .then((sub) => setSubscription(sub))
          .catch((err) => console.warn('Could not load restaurant subscription:', err));
      } else {
        setSelectedMembership(null);
        setSubscription(null);
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
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {/* Mobile Navigation Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 text-white font-black flex items-center justify-center text-lg shadow-sm shadow-orange-500/25 group-hover:scale-105 transition-transform">
              M
            </div>
            <span className="font-extrabold text-base sm:text-xl text-slate-900 leading-none">
              The QROS
            </span>
          </Link>

          {/* Restaurant switcher */}
          {restaurants.length > 0 && (
            <div className="relative max-w-[150px] sm:max-w-[220px]">
              <select
                value={selectedRestaurant?.id || ''}
                onChange={(e) => {
                  const found = restaurants.find((r) => r.restaurant.id === e.target.value);
                  if (found) setSelectedMembership(found);
                }}
                className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 truncate appearance-none cursor-pointer shadow-xs"
              >
                {restaurants.map((item) => (
                  <option key={item.restaurant.id} value={item.restaurant.id}>
                    {item.restaurant.name} ({item.role})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200/90 rounded-xl text-xs sm:text-sm font-bold hover:bg-orange-100 transition shadow-xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Restaurant</span>
            <span className="sm:hidden">New</span>
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 font-semibold max-w-[170px] truncate shadow-xs">
            <User className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span className="truncate">{session?.user?.name || session?.user?.email}</span>
          </div>

          <button
            onClick={async () => {
              await signOut();
              router.push('/admin/login');
            }}
            className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-xl hover:bg-slate-100"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Drawer Content */}
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/60">
              <Link
                href="/"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 text-white font-black flex items-center justify-center text-sm shadow-xs">
                  M
                </div>
                <span className="font-extrabold text-base text-slate-900">
                  The QROS
                </span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                  Admin
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Restaurant Switcher Card */}
              {selectedRestaurant && (
                <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Active Restaurant
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                      <ShieldCheck className="w-3 h-3" />
                      {currentRole}
                    </span>
                  </div>

                  {restaurants.length > 1 ? (
                    <div className="relative">
                      <select
                        value={selectedRestaurant.id}
                        onChange={(e) => {
                          const found = restaurants.find((r) => r.restaurant.id === e.target.value);
                          if (found) setSelectedMembership(found);
                        }}
                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 appearance-none shadow-xs"
                      >
                        {restaurants.map((item) => (
                          <option key={item.restaurant.id} value={item.restaurant.id}>
                            {item.restaurant.name} ({item.role})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <p className="font-extrabold text-sm text-slate-900 truncate">
                      {selectedRestaurant.name}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        setMobileNavOpen(false);
                        setShowProfileModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
                    >
                      <Settings className="w-3 h-3 text-slate-500" />
                      <span>Settings</span>
                    </button>
                    {selectedRestaurant.slug && (
                      <Link
                        href={`/menu/${selectedRestaurant.slug}`}
                        target="_blank"
                        onClick={() => setMobileNavOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                        <span>Live Menu</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation Sections */}
              <div className="space-y-4">
                {/* Operations */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                    Live Operations
                  </p>
                  <div className="space-y-1">
                    <Link
                      href="/admin/cashier"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 transition group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <span>Cashier &amp; Tables</span>
                    </Link>

                    <Link
                      href="/kitchen"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-orange-50 hover:text-orange-900 transition group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition">
                        <ChefHat className="w-3.5 h-3.5" />
                      </div>
                      <span>Kitchen KDS</span>
                    </Link>

                    <Link
                      href="/admin/service"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-purple-50 hover:text-purple-900 transition group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
                        <Utensils className="w-3.5 h-3.5" />
                      </div>
                      <span>Floor Service Pass</span>
                    </Link>

                    <Link
                      href="/admin/orders"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-900 transition group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                        <ClipboardList className="w-3.5 h-3.5" />
                      </div>
                      <span>Orders Management</span>
                    </Link>
                  </div>
                </div>

                {/* Restaurant Catalog & Layout */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                    Catalog &amp; Layout
                  </p>
                  <div className="space-y-1">
                    <Link
                      href="/admin/products"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                      </div>
                      <span>Menu Products</span>
                    </Link>

                    <Link
                      href="/admin/categories"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <span>Menu Categories</span>
                    </Link>

                    <Link
                      href="/admin/tables"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <QrCode className="w-3.5 h-3.5" />
                      </div>
                      <span>Tables &amp; QR Codes</span>
                    </Link>

                    <Link
                      href="/admin/staff"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span>Staff &amp; Memberships</span>
                    </Link>

                    <Link
                      href="/admin/billing"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                        <Coins className="w-3.5 h-3.5" />
                      </div>
                      <span>Billing &amp; Subscriptions</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3 shrink-0">
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {session?.user?.name || 'Logged In'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {session?.user?.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-600" />
                  <span>New Rest.</span>
                </button>

                <button
                  onClick={async () => {
                    await signOut();
                    router.push('/admin/login');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 transition shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {restaurants.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto p-8">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">Welcome to The QROS!</h3>
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
        ) : (
          <div className="space-y-6">
            {/* Subscription Expiration Alert */}
            {subscription?.isExpired && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-red-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-900">Restaurant Subscription Expired</p>
                    <p className="text-xs text-red-700">
                      Your restaurant subscription plan has ended. Renew now to ensure patrons can place contactless table orders without interruption.
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/billing"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm shrink-0 transition"
                >
                  Renew Now via Razorpay
                </Link>
              </div>
            )}

            {!subscription?.isExpired && subscription?.daysRemaining !== null && subscription?.daysRemaining !== undefined && subscription?.daysRemaining <= 5 && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      Subscription Expiring Soon ({subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'day' : 'days'} left)
                    </p>
                    <p className="text-xs text-amber-700">
                      Your {subscription.plan?.name || ''} plan expires in {subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'day' : 'days'}. Renew your subscription to maintain active service.
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/billing"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm shrink-0 transition"
                >
                  Extend Subscription
                </Link>
              </div>
            )}

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
                <Link
                  href="/admin/billing"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition shadow-sm"
                >
                  <Coins className="w-4 h-4" />
                  <span>Billing &amp; Plans</span>
                </Link>

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
