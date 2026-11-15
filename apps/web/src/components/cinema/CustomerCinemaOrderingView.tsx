'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { formatPaise } from '@menugo/shared';
import {
  Film,
  Armchair,
  MapPin,
  Clock,
  Phone,
  Mail,
  Share2,
  Check,
  ChevronDown,
  ChevronRight,
  Flame,
  Star,
  ChefHat,
  Sparkles,
  UtensilsCrossed,
  Search,
  X,
  Plus,
  Minus,
  QrCode,
  Bell,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import { VegBadge, NonVegBadge } from '@/components/menu/VegBadge';
import { ProductDetailModal, ProductDetailItem } from '@/components/menu/ProductDetailModal';
import { CategoryMenuModal } from '@/components/menu/CategoryMenuModal';
import {
  CinemaCartItem,
  getCinemaCartStorageKey,
  serializeCinemaCart,
  deserializeCinemaCart,
  addCinemaProductToCart,
  updateCinemaItemQuantity,
  updateCinemaItemNotes,
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
    coverImageUrl?: string | null;
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
  sortOrder?: number;
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

  // Filter & Search State (Identical to Restaurant Menu)
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'bestsellers' | 'chefs-picks' | 'non-veg'>('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // UI Interactive States
  const [showInfoDetails, setShowInfoDetails] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<FoodProduct | null>(null);
  const [showHelpNotice, setShowHelpNotice] = useState(false);

  // Modal State for Payment & Live Tracking
  const [preparedOrder, setPreparedOrder] = useState<any>(null);
  const [isPreparedModalOpen, setIsPreparedModalOpen] = useState(false);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: resolveData?.theatre?.name || 'Cinema Concessions Menu',
          url: window.location.href
        })
        .catch(() => {});
    } else if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // 1. Initial Load: Fetch Resolve Data AND Food Menu in Parallel
  const loadInitialData = useCallback(async () => {
    if (!theatreToken) return;
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
      console.error('Failed to load cinema data:', err);
      setInitialError(err?.message || 'Invalid or expired cinema QR stand');
    } finally {
      setLoadingInitial(false);
    }
  }, [theatreToken, screenToken]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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
  const handleAddToCart = useCallback((product: FoodProduct, notes?: string) => {
    setCartItems((prev) =>
      addCinemaProductToCart(
        prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          isVegetarian: product.isVegetarian,
          isAvailable: product.isAvailable,
          categoryName: product.categoryName,
          description: product.description
        },
        notes
      )
    );
  }, []);

  const handleUpdateQty = useCallback((productId: string, delta: number) => {
    setCartItems((prev) => updateCinemaItemQuantity(prev, productId, delta));
  }, []);

  const handleUpdateNotes = useCallback((productId: string, notes: string) => {
    setCartItems((prev) => updateCinemaItemNotes(prev, productId, notes));
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

  // Cart Quantities & Notes Map
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems) {
      map[item.productId] = item.quantity;
    }
    return map;
  }, [cartItems]);

  const cartNotes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of cartItems) {
      if (item.notes) map[item.productId] = item.notes;
    }
    return map;
  }, [cartItems]);

  const getItemQuantity = (productId: string) => cartQuantities[productId] || 0;
  const getItemNotes = (productId: string) => cartNotes[productId] || '';

  // Filtered Food Menu
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product.isAvailable) return false;
      if (vegOnly && !product.isVegetarian) return false;

      // Quick filter chips
      if (quickFilter === 'bestsellers' && (product.sortOrder || 99) > 2) return false;
      if (quickFilter === 'chefs-picks' && (product.sortOrder || 99) > 3) return false;
      if (quickFilter === 'non-veg' && product.isVegetarian) return false;

      // Category navigation filter
      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesDesc = product.description?.toLowerCase().includes(query);
        const matchesCat = product.categoryName?.toLowerCase().includes(query);
        return matchesName || matchesDesc || matchesCat;
      }

      return true;
    });
  }, [products, vegOnly, quickFilter, selectedCategory, searchQuery]);

  // Featured / Chef's Recommendation products (Spotlight Carousel)
  const featuredProducts = useMemo(() => {
    return products.filter((p) => p.isAvailable).slice(0, 8);
  }, [products]);

  // Group filtered products by category for section display
  const categorizedSections = useMemo(() => {
    const productMap = new Map<string, FoodProduct[]>();
    const uncategorizedList: FoodProduct[] = [];

    categories.forEach((cat) => {
      productMap.set(cat.id, []);
    });

    filteredProducts.forEach((product) => {
      if (product.categoryId && productMap.has(product.categoryId)) {
        productMap.get(product.categoryId)!.push(product);
      } else {
        uncategorizedList.push(product);
      }
    });

    const sections = categories
      .filter((cat) => (productMap.get(cat.id)?.length || 0) > 0)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        products: productMap.get(cat.id)!
      }));

    if (uncategorizedList.length > 0) {
      sections.push({
        id: 'uncategorized',
        name: 'Movie Snacks & Delights',
        description: 'Chef signature snacks & popcorn specials',
        products: uncategorizedList
      });
    }

    return sections;
  }, [categories, filteredProducts]);

  // Category counts for the category directory modal
  const categoryModalItems = useMemo(() => {
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      count: products.filter((p) => p.categoryId === cat.id).length
    }));
  }, [categories, products]);

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

  // Render Skeleton Loading State (Identical to Restaurant Menu)
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 font-sans">
        <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm animate-pulse border-x border-slate-100">
          <div className="h-36 sm:h-44 bg-slate-200 w-full" />
          <div className="px-4 pt-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 border-2 border-white shadow-sm shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-slate-200 rounded w-2/3" />
                <div className="h-3 bg-slate-200 rounded w-1/3" />
              </div>
            </div>
          </div>
          <div className="p-3 flex gap-2 border-b border-slate-100 overflow-hidden">
            <div className="h-8 w-20 bg-slate-200 rounded-full shrink-0" />
            <div className="h-8 w-28 bg-slate-200 rounded-full shrink-0" />
            <div className="h-8 w-24 bg-slate-200 rounded-full shrink-0" />
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl gap-3">
                <div className="flex-1 space-y-2">
                  <div className="w-4 h-4 bg-slate-200 rounded-sm" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/4" />
                </div>
                <div className="w-24 h-24 bg-slate-200 rounded-2xl shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render Error State
  if (initialError || !resolveData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 text-center shadow-lg border border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Concessions Menu Unavailable</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
            {initialError || 'The requested cinema concessions menu could not be loaded.'}
          </p>
          <button
            onClick={loadInitialData}
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-2xl shadow-md transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Menu Loading</span>
          </button>
        </div>
      </div>
    );
  }

  const { theatre, screens } = resolveData;
  const selectedScreen = screens.find((s) => s.id === selectedScreenId);
  const [selectedSeatRow, selectedSeatNumber] = selectedSeatKey ? selectedSeatKey.split(':') : ['', ''];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-red-100 selection:text-red-900 font-sans">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-2xl relative pb-32 border-x border-slate-100/80">
        
        {/* =====================================================================
            1. Bespoke Hero Header (Rich Crimson & Midnight Obsidian)
        ===================================================================== */}
        <div className="relative bg-gradient-to-br from-slate-950 via-red-950 to-slate-900 text-white overflow-hidden">
          {/* Subtle Ambient Cover Background (if image exists) */}
          {theatre.coverImageUrl && !imageErrors['cover'] ? (
            <div className="absolute inset-0 opacity-25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={theatre.coverImageUrl}
                alt={theatre.name}
                className="w-full h-full object-cover scale-105"
                onError={() => handleImageError('cover')}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            </div>
          ) : (
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px]" />
          )}

          {/* Top Bar Floating Badges */}
          <div className="relative z-10 px-4 pt-3.5 pb-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold border border-white/15 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Concessions Live</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/15 transition shadow-xs"
                title="Share Menu"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setShowHelpNotice(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white backdrop-blur-md text-xs font-black transition shadow-xs border border-red-400/30"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Call Staff</span>
              </button>
            </div>
          </div>

          {/* Cinema Hero Presentation */}
          <div className="relative z-10 px-4 sm:px-6 pt-3 pb-6">
            <div className="flex items-center gap-3.5 sm:gap-4">
              {/* Logo Avatar */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center overflow-hidden shrink-0 border-2 border-white/20 p-0.5">
                {theatre.logoUrl && !imageErrors['logo'] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={theatre.logoUrl}
                    alt={theatre.name}
                    className="w-full h-full object-cover rounded-xl"
                    onError={() => handleImageError('logo')}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 to-rose-800 text-white flex items-center justify-center font-black text-2xl sm:text-3xl rounded-xl">
                    {theatre.name?.charAt(0) || 'P'}
                  </div>
                )}
              </div>

              {/* Theatre Name & Badges */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight truncate">
                  {theatre.name}
                </h1>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {/* Verified Screen/Seat Badge */}
                  {selectedSeatKey ? (
                    <button
                      type="button"
                      onClick={() => setIsCartDrawerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-black transition hover:bg-emerald-500/30"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span>
                        Row {selectedSeatRow} • Seat {selectedSeatNumber}
                      </span>
                      <span className="text-emerald-300 font-medium hidden sm:inline">• Seat Delivery</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCartDrawerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-slate-200 text-xs font-bold hover:bg-white/15 transition"
                    >
                      <QrCode className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{selectedScreen ? selectedScreen.screenName : 'Browsing Mode'}</span>
                    </button>
                  )}

                  {theatre.address && (
                    <button
                      type="button"
                      onClick={() => setShowInfoDetails(!showInfoDetails)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-2.5 py-0.5 rounded-full border border-white/15 transition"
                    >
                      <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="max-w-[130px] sm:max-w-[180px] truncate">{theatre.address}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${showInfoDetails ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible Address & Contact Details */}
            {showInfoDetails && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-300 space-y-1.5 animate-in slide-in-from-top-1">
                {theatre.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <span>{theatre.address}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {theatre.contactNumber && (
                    <a
                      href={`tel:${theatre.contactNumber}`}
                      className="flex items-center gap-1.5 text-red-300 font-bold hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{theatre.contactNumber}</span>
                    </a>
                  )}
                  {theatre.contactEmail && (
                    <a
                      href={`mailto:${theatre.contactEmail}`}
                      className="flex items-center gap-1.5 text-slate-300 hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{theatre.contactEmail}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Staff Assistance Notice Banner */}
        {showHelpNotice && (
          <div className="p-3 mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 truncate">
                  Need Help or Theatre Assistance?
                </p>
                <p className="text-[11px] text-red-700 font-medium">
                  Please speak with any usher in the auditorium aisle or visit the concessions counter.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpNotice(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Prepared Order Banner */}
        {preparedOrder && (
          <div className="p-3 mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 animate-bounce" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 truncate">
                  Order #{preparedOrder.orderNumber} is preparing in the concessions kitchen!
                </p>
                <p className="text-[11px] text-red-700 font-semibold">
                  Delivering to Screen {selectedScreen?.screenName || ''} • Seat {selectedSeatNumber || ''}
                </p>
              </div>
            </div>
            {preparedOrder.statusToken && (
              <Link
                href={`/track/${preparedOrder.statusToken}`}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs transition shrink-0 flex items-center gap-1"
              >
                <span>Track</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        {/* =====================================================================
            2. Sticky Navigation Header (ALWAYS SHOWS THEATRE NAME + FILTERS)
        ===================================================================== */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          {/* Compact Theatre Name Strip */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-red-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                {theatre.name?.charAt(0) || 'P'}
              </div>
              <span className="text-xs font-black text-slate-900 truncate">
                {theatre.name}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-bold text-red-600 truncate">
                {selectedSeatKey
                  ? `Row ${selectedSeatRow}, Seat ${selectedSeatNumber}`
                  : selectedScreen
                  ? `${selectedScreen.screenName}`
                  : 'Seat Delivery Menu'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(true)}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-200/60 transition"
              >
                <Armchair className="w-3 h-3 text-red-600" />
                <span>{selectedSeatKey ? 'Change Seat' : 'Select Seat'}</span>
              </button>
            </div>
          </div>

          {/* Search Bar & Veg Filter */}
          <div className="px-4 pt-2.5 pb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes, drinks, desserts..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs sm:text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Veg-Only Quick Filter Button */}
            <button
              type="button"
              onClick={() => {
                setVegOnly(!vegOnly);
                if (!vegOnly && quickFilter === 'non-veg') setQuickFilter('all');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-all shrink-0 ${
                vegOnly
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle vegetarian items only"
            >
              <VegBadge className={vegOnly ? 'scale-110' : ''} />
              <span className="hidden sm:inline">Veg Only</span>
            </button>
          </div>

          {/* Quick Filter Chips (All Items, Bestsellers, Chef's Picks, Non-Veg) */}
          <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                quickFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter(quickFilter === 'bestsellers' ? 'all' : 'bestsellers')}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                quickFilter === 'bestsellers'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>Bestsellers</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter(quickFilter === 'chefs-picks' ? 'all' : 'chefs-picks')}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                quickFilter === 'chefs-picks'
                  ? 'bg-red-600 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ChefHat className="w-3 h-3" />
              <span>Chef&apos;s Picks</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickFilter(quickFilter === 'non-veg' ? 'all' : 'non-veg');
                setVegOnly(false);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                quickFilter === 'non-veg'
                  ? 'bg-rose-700 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <NonVegBadge />
              <span>Non-Veg</span>
            </button>
          </div>

          {/* Sticky Horizontal Category Navigation */}
          {categories.length > 0 && (
            <div className="px-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* =====================================================================
            3. Menu Content Area
        ===================================================================== */}
        <div className="p-4 sm:p-5">
          {/* Active Filter Notice if category is selected */}
          {selectedCategory !== 'all' && (
            <div className="mb-4 flex items-center justify-between p-2.5 px-3.5 bg-red-50 border border-red-200/80 rounded-2xl text-xs text-red-950 font-medium">
              <span>
                Viewing <span className="font-bold">{categories.find((c) => c.id === selectedCategory)?.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="font-black text-red-600 hover:text-red-800 underline text-[11px]"
              >
                Show All ({products.length})
              </button>
            </div>
          )}

          {/* Chef's Recommendations / Crowd Favorites Spotlight Carousel */}
          {selectedCategory === 'all' && !searchQuery && quickFilter === 'all' && !vegOnly && featuredProducts.length > 0 && (
            <div className="mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    <Flame className="w-4 h-4 fill-current text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                      Chef&apos;s Signature Recommendations
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Most loved dishes by guests today
                    </p>
                  </div>
                </div>
              </div>

              {/* Horizontal Scroll Cards */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0">
                {featuredProducts.map((prod) => {
                  const qty = getItemQuantity(prod.id);
                  const hasImage = Boolean(prod.imageUrl && !imageErrors[prod.id]);
                  return (
                    <div
                      key={prod.id}
                      className="w-40 sm:w-44 shrink-0 rounded-3xl bg-slate-50/90 border border-slate-200/80 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
                      onClick={() => setSelectedProductForModal(prod)}
                    >
                      {/* Card Image */}
                      <div className="h-28 sm:h-32 w-full bg-slate-200 relative overflow-hidden">
                        {hasImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={prod.imageUrl!}
                            alt={prod.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => handleImageError(prod.id)}
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-red-100/50 text-red-400">
                            <UtensilsCrossed className="w-10 h-10" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          {prod.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                        </div>
                        <div className="absolute top-2 right-2 bg-slate-950/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>Must Try</span>
                        </div>
                      </div>

                      {/* Card Details */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs font-black text-slate-900 leading-snug line-clamp-1">
                            {prod.name}
                          </h3>
                          <p className="text-xs font-extrabold text-red-600 mt-0.5">
                            {formatPaise(prod.price, theatre.currency)}
                          </p>
                        </div>

                        {/* Add Button */}
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          {qty === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleAddToCart(prod)}
                              className="w-full py-1.5 px-2 bg-white hover:bg-red-50 active:bg-red-100 text-red-600 border border-red-200 hover:border-red-400 font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5 text-red-600 stroke-[3]" />
                              <span>ADD</span>
                            </button>
                          ) : (
                            <div className="w-full py-1 px-1 bg-red-600 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(prod.id, -1)}
                                className="p-1 hover:bg-red-700 rounded-lg transition"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3 stroke-[3]" />
                              </button>
                              <span className="text-xs font-black">{qty}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(prod.id, 1)}
                                className="p-1 hover:bg-red-700 rounded-lg transition"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3 stroke-[3]" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty / Filtered Empty State */}
          {products.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-200">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">Menu is being prepared</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                This theatre has not published any concession items yet. Please ask an usher or check back shortly.
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No dishes match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? `No items match "${searchQuery}". Try another keyword.`
                  : 'No items found matching the selected filter options.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVegOnly(false);
                  setQuickFilter('all');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            /* Categorized Sections */
            <div className="space-y-7 sm:space-y-9">
              {categorizedSections.map((section) => (
                <div key={section.id} id={`category-${section.id}`} className="scroll-mt-32">
                  {/* Category Header */}
                  <div className="mb-3 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                        <span>{section.name}</span>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {section.products.length}
                        </span>
                      </h2>
                      {section.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{section.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Product Cards List */}
                  <div className="divide-y divide-slate-100">
                    {section.products.map((product) => {
                      const hasImage = Boolean(product.imageUrl && !imageErrors[product.id]);
                      const quantity = getItemQuantity(product.id);
                      const itemNotes = getItemNotes(product.id);

                      return (
                        <div
                          key={product.id}
                          onClick={() => setSelectedProductForModal(product)}
                          className="py-4 first:pt-1 last:pb-1 flex items-start justify-between gap-3 group cursor-pointer hover:bg-slate-50/60 rounded-2xl px-1.5 transition-colors"
                        >
                          {/* Product Details (Left Side) */}
                          <div className="flex-1 min-w-0 pr-1">
                            {/* Veg / Non-Veg Indicator */}
                            <div className="mb-1.5 flex items-center gap-1.5">
                              {product.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                              {product.isVegetarian ? (
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                                  Pure Veg
                                </span>
                              ) : null}
                              {(product.sortOrder || 99) <= 2 && (
                                <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Bestseller</span>
                                </span>
                              )}
                            </div>

                            {/* Product Name */}
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug group-hover:text-red-600 transition-colors">
                              {product.name}
                            </h3>

                            {/* Formatted Price */}
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-sm font-extrabold text-slate-900 font-mono">
                                {formatPaise(product.price, theatre.currency)}
                              </span>
                            </div>

                            {/* Description */}
                            {product.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                {product.description}
                              </p>
                            )}

                            {/* Customized Note Indicator */}
                            {itemNotes && (
                              <div className="mt-2 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md inline-block">
                                Note: {itemNotes}
                              </div>
                            )}
                          </div>

                          {/* Product Image & Add Button (Right Side) */}
                          <div className="w-24 sm:w-28 shrink-0 flex flex-col items-center">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 shrink-0 relative overflow-hidden border border-slate-100 shadow-xs">
                              {hasImage ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={product.imageUrl!}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={() => handleImageError(product.id)}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-300">
                                  <UtensilsCrossed className="w-8 h-8" />
                                </div>
                              )}
                            </div>

                            {/* Floating Add / Stepper Button */}
                            <div className="-mt-3.5 z-10 w-20 sm:w-24" onClick={(e) => e.stopPropagation()}>
                              {quantity === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(product)}
                                  className="w-full py-1.5 bg-white hover:bg-red-50 active:bg-red-100 text-red-600 border border-red-200 hover:border-red-400 font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5 text-red-600 stroke-[3]" />
                                  <span>ADD</span>
                                </button>
                              ) : (
                                <div className="w-full py-1 px-1 bg-red-600 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(product.id, -1)}
                                    className="p-1 hover:bg-red-700 rounded-lg transition"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="w-3 h-3 stroke-[3]" />
                                  </button>
                                  <span className="text-xs font-black">{quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(product.id, 1)}
                                    className="p-1 hover:bg-red-700 rounded-lg transition"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="w-3 h-3 stroke-[3]" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Menu Directory Pill (Bottom Right) */}
        {categories.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="fixed bottom-6 right-4 sm:right-6 z-30 bg-slate-900 text-white rounded-full px-4 py-2.5 shadow-xl flex items-center gap-2 font-black text-xs hover:bg-black transition-all hover:scale-105 active:scale-95 border border-slate-700/80"
          >
            <UtensilsCrossed className="w-4 h-4 text-red-400" />
            <span>Menu ({categories.length})</span>
          </button>
        )}

        {/* Floating Sticky Cart Summary Bar */}
        {totalCartCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl">
            <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  {selectedSeatKey ? (
                    <span className="text-red-600">
                      Delivering to {selectedScreen?.screenName} • Row {selectedSeatRow}, Seat {selectedSeatNumber}
                    </span>
                  ) : (
                    <span>In-Seat Concessions Order</span>
                  )}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-black text-slate-900">
                    {formatPaise(totalCartPaise, theatre.currency)}
                  </span>
                  <span className="text-xs text-red-600 font-bold">
                    ({totalCartCount} {totalCartCount === 1 ? 'item' : 'items'})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(true)}
                className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition flex items-center gap-2 shadow-xl shadow-red-600/30"
              >
                <span>View Cart & Checkout</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Product Detail Modal */}
        {selectedProductForModal && (
          <ProductDetailModal
            product={selectedProductForModal as ProductDetailItem}
            isOpen={Boolean(selectedProductForModal)}
            onClose={() => setSelectedProductForModal(null)}
            currency={theatre.currency}
            quantityInCart={getItemQuantity(selectedProductForModal.id)}
            currentNotes={getItemNotes(selectedProductForModal.id)}
            onAddToCart={(prod, notes) => {
              handleAddToCart(prod as FoodProduct, notes);
            }}
            onUpdateQty={handleUpdateQty}
            onUpdateNotes={handleUpdateNotes}
            suggestedPairings={products
              .filter((p) => p.isAvailable && p.id !== selectedProductForModal.id)
              .slice(0, 3) as ProductDetailItem[]}
          />
        )}

        {/* Category Menu Directory Modal */}
        <CategoryMenuModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          categories={categoryModalItems}
          selectedCategory={selectedCategory}
          onSelectCategory={(catId) => {
            setSelectedCategory(catId);
            setIsCategoryModalOpen(false);
            const el = document.getElementById(`category-${catId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Quick Cart & Checkout Drawer (with Fast Row/Seat Dropdown & Mandatory Contact) */}
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
    </div>
  );
}
