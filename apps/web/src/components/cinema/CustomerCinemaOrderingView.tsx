'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiRequest } from '@/lib/api';
import { formatPaise } from '@menugo/shared';
import {
  Film,
  Tv,
  MapPin,
  Clock,
  AlertTriangle,
  Loader2,
  Armchair,
  UtensilsCrossed,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Leaf,
  Beef,
  Plus,
  Minus,
  ShoppingBag,
  Search,
  X,
  Sparkles,
  Ticket
} from 'lucide-react';
import {
  CinemaCartItem,
  CinemaCartProduct,
  getCinemaCartStorageKey,
  serializeCinemaCart,
  deserializeCinemaCart,
  addCinemaProductToCart,
  updateCinemaItemQuantity,
  removeCinemaItemFromCart,
  clearCinemaCartItems,
  calculateIndicativeCinemaTotals
} from '@/lib/cinema-cart';
import {
  CinemaCartDrawer,
  CinemaShow,
  SeatingRow
} from './CinemaCartDrawer';
import { CinemaOrderPreparedModal } from './CinemaOrderPreparedModal';

interface ResolvedCinemaData {
  valid: boolean;
  qrType: 'theatre' | 'screen';
  theatre: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    currency: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    contactNumber?: string | null;
    contactEmail?: string | null;
    timezone?: string | null;
  };
  isScreenPreselected: boolean;
  selectedScreen?: {
    screenId: string;
    screenName: string;
    screenType: string;
    totalSeats: number;
    screenToken?: string;
  } | null;
  screens: Array<{
    id: string;
    screenName: string;
    screenType: string;
    totalSeats: number;
  }>;
}

interface FoodCategory {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
}

interface FoodProduct {
  id: string;
  categoryId: string | null;
  categoryName?: string | null;
  name: string;
  description?: string | null;
  price: number; // in paise
  imageUrl?: string | null;
  isVegetarian: boolean;
  isAvailable: boolean;
}

interface CustomerCinemaOrderingViewProps {
  theatreToken: string;
  screenToken?: string;
}

export function CustomerCinemaOrderingView({
  theatreToken,
  screenToken
}: CustomerCinemaOrderingViewProps) {
  // Initial Resolution & Data
  const [resolveData, setResolveData] = useState<ResolvedCinemaData | null>(null);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  // Delivery Context State
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [shows, setShows] = useState<CinemaShow[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState<string>('');
  const [seatingRows, setSeatingRows] = useState<SeatingRow[]>([]);
  const [loadingSeating, setLoadingSeating] = useState(false);
  const [selectedSeatKey, setSelectedSeatKey] = useState<string>(''); // format "ROW:SEAT" e.g. "A:A1"

  // Mandatory Customer Contact State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Cart & Drawer State
  const [cartItems, setCartItems] = useState<CinemaCartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Filter & Search State
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('ALL');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Payment & Live Tracking
  const [preparedOrder, setPreparedOrder] = useState<any>(null);
  const [isPreparedModalOpen, setIsPreparedModalOpen] = useState(false);

  // 1. Initial Load: Fetch Resolve Data AND Food Menu in Parallel
  useEffect(() => {
    if (!theatreToken) return;

    let isMounted = true;
    const loadInitialData = async () => {
      try {
        setLoadingInitial(true);
        setInitialError(null);

        const resolveEndpoint = screenToken
          ? `/api/cinema/public/resolve/${theatreToken}/${screenToken}`
          : `/api/cinema/public/resolve/${theatreToken}`;
        const menuEndpoint = `/api/cinema/public/menu/${theatreToken}`;

        const [resolved, menu] = await Promise.all([
          apiRequest<ResolvedCinemaData>(resolveEndpoint),
          apiRequest<{ categories: FoodCategory[]; products: FoodProduct[] }>(menuEndpoint)
        ]);

        if (!isMounted) return;

        setResolveData(resolved);
        setCategories(menu.categories || []);
        setProducts(menu.products || []);

        // Screen selection logic:
        if (resolved.isScreenPreselected && resolved.selectedScreen) {
          setSelectedScreenId(resolved.selectedScreen.screenId);
        } else if (resolved.screens && resolved.screens.length > 0 && resolved.screens[0]) {
          setSelectedScreenId(resolved.screens[0].id);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Failed to load cinema data:', err);
        setInitialError(err?.message || 'Invalid or expired cinema QR stand');
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [theatreToken, screenToken]);

  // 2. Fetch Shows and Seating when selectedScreenId changes
  useEffect(() => {
    if (!theatreToken || !selectedScreenId) return;

    let isMounted = true;

    const fetchScreenDetails = async () => {
      try {
        setLoadingShows(true);
        setLoadingSeating(true);

        const [showsRes, seatingRes] = await Promise.all([
          apiRequest<{ shows: CinemaShow[] }>(
            `/api/cinema/public/shows/${theatreToken}?screenId=${selectedScreenId}`
          ),
          apiRequest<{ rows: SeatingRow[] }>(
            `/api/cinema/public/seating/${theatreToken}/${selectedScreenId}`
          )
        ]);

        if (!isMounted) return;

        const showList: CinemaShow[] = showsRes.shows || [];
        setShows(showList);

        // Auto-select open show if available, or first show
        const openShow = showList.find((s) => s.isOrderingOpen) || showList[0];
        if (openShow) {
          setSelectedShowId(openShow.id);
        } else {
          setSelectedShowId('');
        }

        const rowsList: SeatingRow[] = seatingRes.rows || [];
        setSeatingRows(rowsList);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Could not load shows or seating for screen:', err);
      } finally {
        if (isMounted) {
          setLoadingShows(false);
          setLoadingSeating(false);
        }
      }
    };

    fetchScreenDetails();
    return () => {
      isMounted = false;
    };
  }, [theatreToken, selectedScreenId]);

  // 3. Restore cart & contact info from localStorage on mount
  useEffect(() => {
    if (!theatreToken) return;
    try {
      const storageKey = getCinemaCartStorageKey(theatreToken);
      const raw = localStorage.getItem(storageKey);
      const restored = deserializeCinemaCart(raw, theatreToken);
      if (restored) {
        if (restored.items && restored.items.length > 0) {
          setCartItems(restored.items);
        }
        if (restored.customerName) setCustomerName(restored.customerName);
        if (restored.customerPhone) setCustomerPhone(restored.customerPhone);
        if (restored.specialInstructions) setSpecialInstructions(restored.specialInstructions);
      }
    } catch (e) {
      console.warn('Could not restore cinema cart from localStorage:', e);
    }
  }, [theatreToken]);

  // 4. Persist cart & contact info to localStorage
  useEffect(() => {
    if (!theatreToken) return;
    try {
      const storageKey = getCinemaCartStorageKey(theatreToken);
      if (cartItems.length > 0 || customerName || customerPhone) {
        localStorage.setItem(
          storageKey,
          serializeCinemaCart({
            theatreToken,
            context: null,
            items: cartItems,
            customerName,
            customerPhone,
            specialInstructions,
            updatedAt: Date.now()
          })
        );
      }
    } catch (e) {
      console.warn('Could not save cinema cart to localStorage:', e);
    }
  }, [theatreToken, cartItems, customerName, customerPhone, specialInstructions]);

  // Cart Operations
  const handleAddToCart = useCallback((product: FoodProduct) => {
    setCartItems((prev) =>
      addCinemaProductToCart(prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        isVegetarian: product.isVegetarian,
        isAvailable: product.isAvailable,
        categoryName: product.categoryName,
        description: product.description
      })
    );
  }, []);

  const handleUpdateQty = useCallback((productId: string, delta: number) => {
    setCartItems((prev) => updateCinemaItemQuantity(prev, productId, delta));
  }, []);

  const handleRemoveItem = useCallback((productId: string) => {
    setCartItems((prev) => removeCinemaItemFromCart(prev, productId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems(clearCinemaCartItems());
    if (theatreToken) {
      try {
        localStorage.removeItem(getCinemaCartStorageKey(theatreToken));
      } catch {}
    }
  }, [theatreToken]);

  // Screen selection change
  const handleScreenChange = (screenId: string) => {
    setSelectedScreenId(screenId);
    setSelectedSeatKey(''); // Reset seat when screen changes
    setOrderError(null);
  };

  // Seat selection change
  const handleSeatChange = (seatKey: string) => {
    setSelectedSeatKey(seatKey);
    setOrderError(null);
  };

  // Indicative Totals
  const indicativeTotals = useMemo(() => {
    return calculateIndicativeCinemaTotals(cartItems, 5);
  }, [cartItems]);

  const totalCartCount = indicativeTotals.itemCount;
  const totalCartPaise = indicativeTotals.totalPaise;
  const subtotalPaise = indicativeTotals.subtotalPaise;
  const taxPaise = indicativeTotals.taxPaise;

  // Cart Quantities Map for fast button lookups
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems) {
      map[item.productId] = item.quantity;
    }
    return map;
  }, [cartItems]);

  // Filtered Food Menu
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCatFilter !== 'ALL' && p.categoryId !== selectedCatFilter) return false;
      if (dietaryFilter === 'VEG' && !p.isVegetarian) return false;
      if (dietaryFilter === 'NON_VEG' && p.isVegetarian) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesDesc = p.description?.toLowerCase().includes(query);
        const matchesCat = p.categoryName?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [products, selectedCatFilter, dietaryFilter, searchQuery]);

  // Place Order Action: Prepares order and triggers payment modal
  const handlePlaceOrder = async () => {
    if (!theatreToken || !selectedScreenId || !selectedShowId || !selectedSeatKey) {
      setOrderError('Screen and seat details are required to place your order.');
      return;
    }

    const [seatRow, seatNumber] = selectedSeatKey.split(':');
    if (!seatRow || !seatNumber) {
      setOrderError('Please select a valid seat number from the dropdown.');
      return;
    }

    if (!customerName.trim() || customerPhone.replace(/\D/g, '').length !== 10) {
      setOrderError('Name and 10-digit mobile number are mandatory.');
      return;
    }

    try {
      setIsSubmittingOrder(true);
      setOrderError(null);

      const data = await apiRequest('/api/cinema/public/checkout/prepare', {
        method: 'POST',
        body: JSON.stringify({
          theatreToken,
          screenId: selectedScreenId,
          showId: selectedShowId,
          seatRow,
          seatNumber,
          items: cartItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes || null
          })),
          customerName: customerName.trim(),
          customerPhone: customerPhone.replace(/\D/g, '').trim(),
          specialInstructions: specialInstructions.trim() || null
        })
      });

      // Close cart drawer & open payment modal
      setIsCartDrawerOpen(false);
      setPreparedOrder({
        ...data.order,
        statusToken: data.statusToken || data.order?.statusToken
      });
      setIsPreparedModalOpen(true);

      // Clear local cart
      setCartItems([]);
      if (theatreToken) {
        try {
          localStorage.removeItem(getCinemaCartStorageKey(theatreToken));
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to prepare cinema order:', err);
      setOrderError(err?.message || 'Failed to prepare concessions order. Please try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Render Loading
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-bold text-slate-300">Loading Cinema Concessions...</p>
        <p className="text-xs text-slate-500 mt-1">Connecting to auditorium menu</p>
      </div>
    );
  }

  // Render Error
  if (initialError || !resolveData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white">Invalid or Expired Cinema QR</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {initialError || 'This QR stand token is unrecognized or has expired.'}
          </p>
          <div className="pt-2">
            <p className="text-[11px] text-slate-500">
              Please scan the active QR code stand on your seat or ask theatre staff.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { theatre, screens } = resolveData;
  const selectedScreen = screens.find((s) => s.id === selectedScreenId);
  const [selectedSeatRow, selectedSeatNumber] = selectedSeatKey ? selectedSeatKey.split(':') : ['', ''];

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-600 selection:text-white pb-28">
      {/* Top Fixed Mobile Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-600/30 shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-black text-sm tracking-tight text-white block truncate">
                {theatre.name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
                <Armchair className="w-3 h-3" />
                <span>In-Seat Concessions</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Delivery Badge / Seat Selector Trigger */}
            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(true)}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
            >
              {selectedSeatKey ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    Seat {selectedSeatNumber}
                  </span>
                </>
              ) : selectedScreen ? (
                <>
                  <Tv className="w-3 h-3 text-indigo-400" />
                  <span className="truncate max-w-[120px]">{selectedScreen.screenName}</span>
                </>
              ) : (
                <>
                  <Armchair className="w-3 h-3 text-slate-400" />
                  <span>Select Seat</span>
                </>
              )}
            </button>

            {/* Cart Icon Button */}
            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(true)}
              className="relative p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/30"
              aria-label="Open cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full shadow">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Cinema Welcome Banner */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-violet-950/50 border border-indigo-500/20 shadow-xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider inline-block">
              Express Delivery to Seat
            </span>
            <h1 className="text-base sm:text-lg font-black text-white">
              Concessions & Movie Snacks
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Order gourmet popcorn, hot finger foods, and chilled sodas delivered directly to your cinema seat.
            </p>
          </div>

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
          </div>
        </div>

        {/* Search & Dietary Filters Bar */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search popcorn, beverages, combos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-500 hover:text-white absolute right-3 top-3"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dietary Toggle Filter */}
            <div className="inline-flex rounded-2xl bg-slate-900 border border-slate-800 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setDietaryFilter('ALL')}
                className={`px-3 py-1.5 text-xs rounded-xl font-bold transition ${
                  dietaryFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDietaryFilter('VEG')}
                className={`px-2.5 py-1.5 text-xs rounded-xl font-bold transition flex items-center gap-1 ${
                  dietaryFilter === 'VEG'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400'
                }`}
              >
                <Leaf className="w-3 h-3 text-emerald-400" /> Veg
              </button>
              <button
                type="button"
                onClick={() => setDietaryFilter('NON_VEG')}
                className={`px-2.5 py-1.5 text-xs rounded-xl font-bold transition flex items-center gap-1 ${
                  dietaryFilter === 'NON_VEG'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400'
                }`}
              >
                <Beef className="w-3 h-3 text-rose-400" /> Non-Veg
              </button>
            </div>
          </div>

          {/* Concessions Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCatFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                selectedCatFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Items ({products.length})
            </button>

            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatFilter(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                    selectedCatFilter === cat.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Concessions Menu Items Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/40 rounded-3xl border border-slate-800 p-8 space-y-3">
            <UtensilsCrossed className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Menu Items Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              We couldn&apos;t find any items matching your current search or dietary filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCatFilter('ALL');
                setDietaryFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredProducts.map((prod) => {
              const qty = cartQuantities[prod.id] || 0;
              const isCombo =
                prod.categoryName?.toLowerCase().includes('combo') ||
                prod.name.toLowerCase().includes('combo') ||
                prod.name.includes('+');

              return (
                <div
                  key={prod.id}
                  className="p-4 rounded-3xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition flex flex-col justify-between shadow-lg"
                >
                  <div>
                    {/* Item Image with Badges */}
                    <div className="relative aspect-[16/10] bg-slate-950 rounded-2xl overflow-hidden mb-3 border border-slate-800/80">
                      {prod.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-700">
                          <UtensilsCrossed className="w-8 h-8" />
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border backdrop-blur-md ${
                            prod.isVegetarian
                              ? 'bg-emerald-950/85 text-emerald-400 border-emerald-500/40'
                              : 'bg-rose-950/85 text-rose-400 border-rose-500/40'
                          }`}
                        >
                          {prod.isVegetarian ? 'Veg' : 'Non-Veg'}
                        </span>
                        {isCombo && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-950/85 text-violet-300 border border-violet-500/40 backdrop-blur-md">
                            Combo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    {prod.categoryName && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-0.5">
                        {prod.categoryName}
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-white line-clamp-1">{prod.name}</h3>
                    {prod.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {prod.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Add to Cart Action */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-sm font-black text-white">
                      {formatPaise(prod.price, theatre.currency)}
                    </span>

                    <div className="flex items-center gap-2">
                      {qty > 0 ? (
                        <div className="inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/40 rounded-xl px-2 py-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod.id, -1)}
                            className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-bold text-xs"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black text-white px-1">{qty}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod.id, 1)}
                            className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-bold text-xs"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(prod)}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
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

      {/* Floating Bottom Cart Bar (Shown whenever cart has items) */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                {selectedSeatKey ? (
                  <span className="text-indigo-400">
                    Delivering to {selectedScreen?.screenName} • Seat {selectedSeatNumber}
                  </span>
                ) : (
                  <span>In-Seat Concessions Order</span>
                )}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-black text-white">
                  {formatPaise(totalCartPaise, theatre.currency)}
                </span>
                <span className="text-xs text-indigo-400 font-bold">
                  ({totalCartCount} {totalCartCount === 1 ? 'item' : 'items'})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black transition flex items-center gap-2 shadow-xl shadow-indigo-600/30"
            >
              <span>View Cart & Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Cart & Checkout Drawer */}
      <CinemaCartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
        theatreName={theatre.name}
        currency={theatre.currency}
        cart={cartItems}
        subtotalPaise={subtotalPaise}
        taxPaise={taxPaise}
        totalPaise={totalCartPaise}
        totalCount={totalCartCount}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        screens={screens}
        isScreenPreselected={resolveData.isScreenPreselected}
        selectedScreenId={selectedScreenId}
        onScreenChange={handleScreenChange}
        shows={shows}
        selectedShowId={selectedShowId}
        onShowChange={setSelectedShowId}
        loadingShows={loadingShows}
        seatingRows={seatingRows}
        loadingSeating={loadingSeating}
        selectedSeatKey={selectedSeatKey}
        onSeatChange={handleSeatChange}
        customerName={customerName}
        onCustomerNameChange={setCustomerName}
        customerPhone={customerPhone}
        onCustomerPhoneChange={setCustomerPhone}
        specialInstructions={specialInstructions}
        onSpecialInstructionsChange={setSpecialInstructions}
        onPlaceOrder={handlePlaceOrder}
        isSubmittingOrder={isSubmittingOrder}
        orderError={orderError}
        setOrderError={setOrderError}
      />

      {/* Order Prepared & Payment Gateway Modal */}
      <CinemaOrderPreparedModal
        isOpen={isPreparedModalOpen}
        onClose={() => setIsPreparedModalOpen(false)}
        order={preparedOrder}
      />
    </div>
  );
}
