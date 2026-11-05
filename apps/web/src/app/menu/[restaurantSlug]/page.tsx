'use client';

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { formatPaise } from '@/lib/utils';
import {
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart,
  updateItemNotes,
  calculateCartTotals,
  reconcileCartWithMenu,
  removeUnavailableItems,
  validateCartSubmission,
  getCartStorageKey,
  serializeCartForStorage,
  deserializeCartFromStorage,
  MAX_ITEM_NOTES_LENGTH,
  CartItem
} from '@/lib/cart';
import {
  UtensilsCrossed,
  MapPin,
  Phone,
  Mail,
  Search,
  X,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  Loader2,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  QrCode,
  Info,
  ChevronDown,
  ArrowRight,
  Lock,
  ShieldCheck
} from 'lucide-react';

interface PublicRestaurant {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  currency: string;
  settings?: Record<string, any>;
}

interface PublicCategory {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
}

interface PublicProduct {
  id: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: number; // Integer paise
  imageUrl?: string | null;
  isVegetarian: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

interface MenuData {
  restaurant: PublicRestaurant;
  categories: PublicCategory[];
  products: PublicProduct[];
}

interface VerifiedTable {
  id: string;
  tableNumber: string;
  capacity: number;
  isActive: boolean;
}

// Indian FSSAI-compliant Veg / Non-Veg Badges
function VegBadge({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-4 h-4 rounded-[3px] border border-emerald-600 flex items-center justify-center p-[2px] bg-white shrink-0 ${className}`}
      title="Vegetarian"
      aria-label="Vegetarian"
    >
      <div className="w-2 h-2 rounded-full bg-emerald-600" />
    </div>
  );
}

function NonVegBadge({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-4 h-4 rounded-[3px] border border-rose-700 flex items-center justify-center p-[2px] bg-white shrink-0 ${className}`}
      title="Non-Vegetarian"
      aria-label="Non-Vegetarian"
    >
      <div className="w-2 h-2 rounded-full bg-rose-700" />
    </div>
  );
}

function CustomerMenuContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const restaurantSlug = params.restaurantSlug as string;
  const tableToken = searchParams.get('table');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Table Verification States (from QR Code ?table=token)
  const [verifiedTable, setVerifiedTable] = useState<VerifiedTable | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableSession, setTableSession] = useState<{ id: string; sessionToken: string; status: string } | null>(null);
  const [isTableOccupiedByOther, setIsTableOccupiedByOther] = useState(false);
  const [sessionOccupiedMessage, setSessionOccupiedMessage] = useState<string | null>(null);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [showInfoDetails, setShowInfoDetails] = useState(false);

  // Cart States (Scoped strictly to current restaurant)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderInstructions, setOrderInstructions] = useState('');
  const [activeItemNotesId, setActiveItemNotesId] = useState<string | null>(null);
  const [showOrderReadyModal, setShowOrderReadyModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSubmissionError, setOrderSubmissionError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);
  const [autoRedirectSeconds, setAutoRedirectSeconds] = useState<number | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Auto-redirect timer when order is confirmed
  useEffect(() => {
    if (!placedOrder?.statusToken) {
      setAutoRedirectSeconds(null);
      return;
    }

    setAutoRedirectSeconds(4);
    const interval = setInterval(() => {
      setAutoRedirectSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (placedOrder?.statusToken) {
            router.push(`/track/${placedOrder.statusToken}`);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [placedOrder, router]);

  const handlePlaceOrder = async () => {
    if (!verifiedTable || !restaurantSlug || cart.length === 0) return;

    try {
      setIsSubmittingOrder(true);
      setOrderSubmissionError(null);

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }

      const payload = {
        restaurantSlug,
        tableToken: tableToken || undefined,
        tableId: verifiedTable.id,
        tableSessionToken: tableSession?.sessionToken || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        specialInstructions: orderInstructions.trim() || undefined,
        idempotencyKey: idempotencyKeyRef.current,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes?.trim() || undefined
        }))
      };

      const res = await apiRequest<{ message: string; order: any; idempotent?: boolean }>('/api/orders', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKeyRef.current,
          ...(tableSession?.sessionToken ? { 'x-table-session-token': tableSession.sessionToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res?.order) {
        setPlacedOrder(res.order);
        setCart([]);
        try {
          localStorage.removeItem(getCartStorageKey(restaurantSlug));
        } catch {
          // Ignore storage error
        }
        idempotencyKeyRef.current = null;
        setIsCartOpen(false);
        setShowOrderReadyModal(false);
      }
    } catch (err: any) {
      setOrderSubmissionError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const loadMenu = useCallback(async () => {
    if (!restaurantSlug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MenuData>(`/api/restaurants/by-slug/${restaurantSlug}`);
      setData(res);
    } catch (err: any) {
      setError(
        err.message || 'Unable to load menu at this moment. Please check your internet connection or ask restaurant staff.'
      );
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  const verifyTableToken = useCallback(
    async (token: string) => {
      if (!restaurantSlug || !token) return;
      try {
        const sessionKey = `menugo_session_${restaurantSlug}_${token}`;
        const storedSessionToken =
          typeof window !== 'undefined' ? localStorage.getItem(sessionKey) : null;

        const url = `/api/tables/verify/${token}?restaurantSlug=${restaurantSlug}${
          storedSessionToken ? `&sessionToken=${encodeURIComponent(storedSessionToken)}` : ''
        }`;

        const res = await apiRequest<{
          valid: boolean;
          table: VerifiedTable;
          isOccupied?: boolean;
          sessionActive?: boolean;
          sessionMatches?: boolean;
          session?: { id: string; sessionToken: string; status: string };
          error?: string;
          message?: string;
        }>(url, {
          headers: storedSessionToken ? { 'x-table-session-token': storedSessionToken } : {}
        });

        if (res?.valid && res.table) {
          setVerifiedTable(res.table);

          if (res.isOccupied && res.sessionMatches === false) {
            setIsTableOccupiedByOther(true);
            setSessionOccupiedMessage(
              res.message || 'This table currently has an active dining session.'
            );
            return;
          }

          setIsTableOccupiedByOther(false);
          setSessionOccupiedMessage(null);

          if (res.session?.sessionToken) {
            setTableSession(res.session);
            try {
              localStorage.setItem(sessionKey, res.session.sessionToken);
            } catch {
              // Ignore localStorage errors
            }
          }
          setTableError(null);
        }
      } catch (err: any) {
        setTableError(err.message || 'Invalid or disabled table QR code.');
        setVerifiedTable(null);
      }
    },
    [restaurantSlug]
  );

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (tableToken) {
      verifyTableToken(tableToken);
    }
  }, [tableToken, verifyTableToken]);

  // Restore cart from localStorage on mount (strictly scoped by restaurantSlug)
  useEffect(() => {
    if (!restaurantSlug || !data?.products) return;

    try {
      const stored = localStorage.getItem(getCartStorageKey(restaurantSlug));
      const parsedItems = deserializeCartFromStorage(stored, restaurantSlug);

      if (parsedItems && parsedItems.length > 0) {
        const productMap = new Map<string, PublicProduct>();
        data.products.forEach((p) => productMap.set(p.id, p));

        const restoredCart: CartItem[] = [];
        parsedItems.forEach((item) => {
          const product = productMap.get(item.productId);
          if (product && product.isAvailable) {
            restoredCart.push({
              productId: item.productId,
              product,
              quantity: item.quantity,
              notes: item.notes
            });
          }
        });
        setCart(restoredCart);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [restaurantSlug, data?.products]);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (!restaurantSlug) return;
    try {
      if (cart.length > 0) {
        localStorage.setItem(
          getCartStorageKey(restaurantSlug),
          serializeCartForStorage(restaurantSlug, tableToken, cart)
        );
      } else {
        localStorage.removeItem(getCartStorageKey(restaurantSlug));
      }
    } catch {
      // Ignore localStorage write errors
    }
  }, [cart, restaurantSlug, tableToken]);

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
        setShowOrderReadyModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  const handleAddToCart = (product: PublicProduct) => {
    setCart((prev) => addItemToCart(prev, product));
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) => updateItemQuantity(prev, productId, delta));
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => removeItemFromCart(prev, productId));
  };

  const handleUpdateNotes = (productId: string, notes: string) => {
    setCart((prev) => updateItemNotes(prev, productId, notes));
  };

  const handleRemoveUnavailable = () => {
    if (!data?.products) return;
    setCart((prev) => removeUnavailableItems(prev, data.products));
  };

  const getItemQuantity = (productId: string) => {
    return cart.find((i) => i.productId === productId)?.quantity || 0;
  };

  const { totalCount, indicativeSubtotalPaise } = useMemo(() => {
    return calculateCartTotals(cart);
  }, [cart]);

  const { unavailableItems, hasUnavailableItems } = useMemo(() => {
    if (!data?.products) return { unavailableItems: [], hasUnavailableItems: false };
    return reconcileCartWithMenu(cart, data.products);
  }, [cart, data?.products]);

  const submissionValidation = useMemo(() => {
    return validateCartSubmission(cart, Boolean(verifiedTable), hasUnavailableItems);
  }, [cart, verifiedTable, hasUnavailableItems]);

  // Filter products based on search query, veg-only toggle, and selected category
  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];

    return data.products.filter((product) => {
      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory) {
        return false;
      }

      if (vegOnly && !product.isVegetarian) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesDesc = product.description
          ? product.description.toLowerCase().includes(query)
          : false;
        if (!matchesName && !matchesDesc) {
          return false;
        }
      }

      return true;
    });
  }, [data?.products, selectedCategory, vegOnly, searchQuery]);

  // Group filtered products by category for section display
  const categorizedSections = useMemo(() => {
    if (!data) return [];

    const categoriesList = data.categories || [];
    const productMap = new Map<string, PublicProduct[]>();
    const uncategorizedList: PublicProduct[] = [];

    categoriesList.forEach((cat) => {
      productMap.set(cat.id, []);
    });

    filteredProducts.forEach((product) => {
      if (product.categoryId && productMap.has(product.categoryId)) {
        productMap.get(product.categoryId)!.push(product);
      } else {
        uncategorizedList.push(product);
      }
    });

    const sections = categoriesList
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
        name: 'Special Delicacies',
        description: 'Chef signature picks and recommendations',
        products: uncategorizedList
      });
    }

    return sections;
  }, [data, filteredProducts]);

  // ---------------------------------------------------------------------------
  // 1. Loading Skeleton State
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 pb-20">
        <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm animate-pulse">
          <div className="h-36 sm:h-44 bg-slate-200 w-full" />
          <div className="px-4 pt-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 -mt-8 border-4 border-white shadow-sm shrink-0" />
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
                <div className="w-20 h-20 bg-slate-200 rounded-2xl shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 1b. Table Occupied by Another Customer (Dining Security: Menu Locked)
  // ---------------------------------------------------------------------------
  if (isTableOccupiedByOther) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{verifiedTable ? verifiedTable.tableNumber : 'Table'} Occupied</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Dining Session in Progress
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mt-2.5 mb-6 leading-relaxed">
            {sessionOccupiedMessage ||
              'This table currently has an active dining session. For your security and bill accuracy, digital menu ordering is restricted to the seated customer.'}
          </p>

          <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50 text-left mb-6 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Need Assistance?
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              If you have just been seated at this table, please ask your server or cashier to clear the table or open your new session.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => tableToken && verifyTableToken(tableToken)}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Status</span>
            </button>

            <Link
              href="/staff/login"
              className="block w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Are you restaurant staff? Sign in with PIN &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Error State with Retry Button
  // ---------------------------------------------------------------------------
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 text-center shadow-lg border border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Menu Unavailable</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
            {error || 'The requested restaurant menu could not be loaded.'}
          </p>
          <button
            onClick={loadMenu}
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold rounded-2xl shadow-md transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Menu Loading</span>
          </button>
        </div>
      </div>
    );
  }

  const { restaurant, categories, products } = data;

  // ---------------------------------------------------------------------------
  // 3. Main Customer Menu View
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 selection:bg-orange-100 selection:text-orange-900">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-md relative pb-28">
        {/* Cover Banner */}
        <div className="relative h-32 sm:h-44 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 overflow-hidden">
          {restaurant.coverImageUrl && !imageErrors['cover'] ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={restaurant.coverImageUrl}
              alt={restaurant.name}
              className="w-full h-full object-cover"
              onError={() => handleImageError('cover')}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-600 to-amber-700 text-white/20">
              <UtensilsCrossed className="w-16 h-16 sm:w-20 sm:h-20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-white tracking-wide border border-white/20">
            {restaurant.currency || 'INR'}
          </div>
        </div>

        {/* Restaurant Profile Card */}
        <div className="px-4 sm:px-5 pt-2 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Logo Avatar */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white -mt-8 sm:-mt-10 border-3 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
              {restaurant.logoUrl && !imageErrors['logo'] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError('logo')}
                />
              ) : (
                <div className="w-full h-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xl sm:text-2xl">
                  {restaurant.name?.charAt(0) || 'M'}
                </div>
              )}
            </div>

            {/* Restaurant Info & Table Badge */}
            <div className="flex-1 min-w-0 -mt-1 sm:-mt-2">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                {restaurant.name}
              </h1>

              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {/* Verified Table Badge from QR Code */}
                {verifiedTable ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] sm:text-xs font-bold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>Table {verifiedTable.tableNumber}</span>
                    <span className="text-emerald-600 font-medium hidden sm:inline">• Dine-in</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-[11px] sm:text-xs font-semibold">
                    <QrCode className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Browsing Mode</span>
                  </div>
                )}

                {restaurant.address && (
                  <button
                    onClick={() => setShowInfoDetails(!showInfoDetails)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 transition"
                  >
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[120px] sm:max-w-[160px] truncate">{restaurant.address}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showInfoDetails ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {tableError && (
                <div className="mt-1.5 flex items-center gap-1.5 p-1.5 px-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] rounded-xl font-medium">
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>{tableError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Restaurant Details */}
          {showInfoDetails && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5 animate-in slide-in-from-top-1">
              {restaurant.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>{restaurant.address}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {restaurant.phone && (
                  <a
                    href={`tel:${restaurant.phone}`}
                    className="flex items-center gap-1.5 text-orange-600 font-semibold"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{restaurant.phone}</span>
                  </a>
                )}
                {restaurant.email && (
                  <a
                    href={`mailto:${restaurant.email}`}
                    className="flex items-center gap-1.5 text-slate-600"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>{restaurant.email}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Header: Search Bar, Veg Filter & Category Pills */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
          {/* Search & Veg Filter Toolbar */}
          <div className="px-4 py-2.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes, drinks, desserts..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Veg-Only Toggle Button */}
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                vegOnly
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle vegetarian items only"
            >
              <VegBadge className={vegOnly ? 'scale-110' : ''} />
              <span>Veg Only</span>
            </button>
          </div>

          {/* Sticky Horizontal Category Pills Navigation */}
          {categories.length > 0 && (
            <div className="px-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Dishes ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Menu Content Area */}
        <div className="p-4 sm:p-5">
          {/* Active Filter Notice if category is selected */}
          {selectedCategory !== 'all' && (
            <div className="mb-4 flex items-center justify-between p-2.5 px-3.5 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-950 font-medium">
              <span>
                Viewing <span className="font-bold">{categories.find((c) => c.id === selectedCategory)?.name}</span>
              </span>
              <button
                onClick={() => setSelectedCategory('all')}
                className="font-bold text-orange-700 hover:text-orange-900 underline text-[11px]"
              >
                Show All ({products.length})
              </button>
            </div>
          )}

          {/* Empty Restaurant State (Restaurant has 0 dishes uploaded) */}
          {products.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Menu is being updated</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                This restaurant has not published any dishes yet. Please ask your server or check back shortly.
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Filter Empty State (Search query or veg toggle returned 0 matches) */
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No dishes match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? `No items match "${searchQuery}". Try another keyword.`
                  : 'No vegetarian options found for the selected category.'}
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setVegOnly(false);
                  setSelectedCategory('all');
                }}
                className="mt-3 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            /* Categorized Sections */
            <div className="space-y-6 sm:space-y-8">
              {categorizedSections.map((section) => (
                <div key={section.id} className="scroll-mt-28">
                  {/* Category Header */}
                  <div className="mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                        <span>{section.name}</span>
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
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

                      return (
                        <div
                          key={product.id}
                          className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3 group"
                        >
                          {/* Product Details (Left Side) */}
                          <div className="flex-1 min-w-0 pr-1">
                            {/* Veg / Non-Veg Indicator */}
                            <div className="mb-1 flex items-center gap-1.5">
                              {product.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                              {product.isVegetarian ? (
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                                  Pure Veg
                                </span>
                              ) : null}
                            </div>

                            {/* Product Name */}
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                              {product.name}
                            </h3>

                            {/* Formatted Price (Safe Integer Paise) */}
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                              {formatPaise(product.price, restaurant.currency)}
                            </p>

                            {/* Description */}
                            {product.description && (
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                                {product.description}
                              </p>
                            )}
                          </div>

                          {/* Product Image & Add / Stepper Controls (Right Side) */}
                          {hasImage ? (
                            <div className="relative shrink-0 w-24 sm:w-28 flex flex-col items-center">
                              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100 shadow-xs relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={product.imageUrl!}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={() => handleImageError(product.id)}
                                  loading="lazy"
                                />
                              </div>

                              {/* Floating Overlapping ADD / Stepper Button */}
                              <div className="absolute -bottom-2 inset-x-1 sm:inset-x-2">
                                {quantity === 0 ? (
                                  <button
                                    onClick={() => handleAddToCart(product)}
                                    className="w-full py-1 px-2 bg-white hover:bg-orange-50 active:bg-orange-100 text-orange-600 border border-orange-200 hover:border-orange-400 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1"
                                    aria-label={`Add ${product.name} to order`}
                                  >
                                    <Plus className="w-3.5 h-3.5 text-orange-600 stroke-[3]" />
                                    <span>ADD</span>
                                  </button>
                                ) : (
                                  <div className="w-full py-1 px-1 bg-orange-600 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-between">
                                    <button
                                      onClick={() => handleUpdateQty(product.id, -1)}
                                      className="p-1 hover:bg-orange-700 active:bg-orange-800 rounded-lg transition"
                                      aria-label={`Decrease quantity of ${product.name}`}
                                    >
                                      <Minus className="w-3 h-3 stroke-[3]" />
                                    </button>
                                    <span className="px-1 text-xs font-black text-white">{quantity}</span>
                                    <button
                                      onClick={() => handleUpdateQty(product.id, 1)}
                                      className="p-1 hover:bg-orange-700 active:bg-orange-800 rounded-lg transition"
                                      aria-label={`Increase quantity of ${product.name}`}
                                    >
                                      <Plus className="w-3 h-3 stroke-[3]" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Dish without image: Clean button on the right */
                            <div className="shrink-0 w-20 sm:w-24 self-center">
                              {quantity === 0 ? (
                                <button
                                  onClick={() => handleAddToCart(product)}
                                  className="w-full py-1.5 px-3 bg-white hover:bg-orange-50 active:bg-orange-100 text-orange-600 border border-orange-200 hover:border-orange-400 font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                                  aria-label={`Add ${product.name} to order`}
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>ADD</span>
                                </button>
                              ) : (
                                <div className="w-full py-1 px-1.5 bg-orange-600 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-between">
                                  <button
                                    onClick={() => handleUpdateQty(product.id, -1)}
                                    className="p-1 hover:bg-orange-700 active:bg-orange-800 rounded-lg transition"
                                    aria-label={`Decrease quantity of ${product.name}`}
                                  >
                                    <Minus className="w-3 h-3 stroke-[3]" />
                                  </button>
                                  <span className="px-1 text-xs font-black">{quantity}</span>
                                  <button
                                    onClick={() => handleUpdateQty(product.id, 1)}
                                    className="p-1 hover:bg-orange-700 active:bg-orange-800 rounded-lg transition"
                                    aria-label={`Increase quantity of ${product.name}`}
                                  >
                                    <Plus className="w-3 h-3 stroke-[3]" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-6 pb-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <span>Powered by</span>
            <span className="font-extrabold text-slate-700">MenuGo</span>
          </p>
        </div>
      </div>

      {/* =====================================================================
          4. Floating Mobile Cart Action Bar (Visible when cart has items)
      ===================================================================== */}
      {totalCount > 0 && (
        <div className="fixed bottom-3 inset-x-3 z-40 max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-slate-950 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white relative shadow-sm shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-black flex items-center justify-center border-2 border-slate-950">
                  {totalCount}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 leading-tight">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'} in order
                </p>
                <p className="text-sm font-black text-white">
                  {formatPaise(indicativeSubtotalPaise, restaurant.currency)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <span>View Order</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. Slide-Over Cart Drawer / Sheet
      ===================================================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900">Your Order Composition</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {verifiedTable ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Dine-in at {verifiedTable.tableNumber}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-amber-600" />
                        Browsing Mode (Scan table QR to place order)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                aria-label="Close order drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Out-of-Stock Alert Banner */}
            {hasUnavailableItems && (
              <div className="bg-rose-50 border-b border-rose-200 p-3 px-4 flex items-center justify-between text-xs text-rose-900 font-semibold gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Some items in your cart have sold out.</span>
                </div>
                <button
                  onClick={handleRemoveUnavailable}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition text-[11px] shrink-0"
                >
                  Remove Sold Out
                </button>
              </div>
            )}

            {/* Drawer Body (Scrollable items list & compact inputs) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 divide-y divide-slate-100">
              {cart.length === 0 ? (
                /* Empty Cart State */
                <div className="py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Your order is empty</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Explore our dishes and tap &quot;ADD&quot; to build your dine-in order.
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    Explore Menu
                  </button>
                </div>
              ) : (
                /* Cart Items List */
                cart.map((item) => {
                  const isAvailable = item.product.isAvailable;
                  const itemSubtotal = item.product.price * item.quantity;
                  const isEditingNotes = activeItemNotesId === item.productId;

                  return (
                    <div key={item.productId} className="pt-3.5 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        {/* Title & Price */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {item.product.isVegetarian ? <VegBadge /> : <NonVegBadge />}
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {item.product.name}
                            </h4>
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-xs">
                            <span className={`font-extrabold ${isAvailable ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                              {formatPaise(itemSubtotal, restaurant.currency)}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              ({formatPaise(item.product.price, restaurant.currency)} each)
                            </span>
                            {!isAvailable && (
                              <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                Sold Out
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Controls & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="py-1 px-1 bg-slate-100 rounded-xl flex items-center gap-1 border border-slate-200">
                            <button
                              onClick={() => handleUpdateQty(item.productId, -1)}
                              className="p-1 hover:bg-white active:bg-slate-200 rounded-lg text-slate-700 transition"
                              aria-label={`Decrease quantity of ${item.product.name}`}
                            >
                              <Minus className="w-3 h-3 stroke-[3]" />
                            </button>
                            <span className="w-5 text-center text-xs font-black text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQty(item.productId, 1)}
                              disabled={!isAvailable}
                              className="p-1 hover:bg-white active:bg-slate-200 disabled:opacity-40 rounded-lg text-slate-700 transition"
                              aria-label={`Increase quantity of ${item.product.name}`}
                            >
                              <Plus className="w-3 h-3 stroke-[3]" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                            title="Remove item"
                            aria-label={`Remove ${item.product.name} from order`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Item-Level Cooking Notes Display & Editor */}
                      <div className="text-xs">
                        {isEditingNotes ? (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 animate-in fade-in">
                            <div className="flex justify-between items-center">
                              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-orange-600" />
                                <span>Note for chef (Max {MAX_ITEM_NOTES_LENGTH} chars)</span>
                              </label>
                              <span className="text-[10px] text-slate-400">
                                {(item.notes?.length || 0)}/{MAX_ITEM_NOTES_LENGTH}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={item.notes || ''}
                              maxLength={MAX_ITEM_NOTES_LENGTH}
                              onChange={(e) => handleUpdateNotes(item.productId, e.target.value)}
                              placeholder="e.g. Less spicy, no onion..."
                              className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={() => setActiveItemNotesId(null)}
                                className="px-2.5 py-0.5 bg-slate-900 text-white font-bold text-[11px] rounded-lg"
                              >
                                Save Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {item.notes ? (
                              <div
                                onClick={() => setActiveItemNotesId(item.productId)}
                                className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 cursor-pointer transition"
                              >
                                <MessageSquare className="w-3 h-3 text-orange-600" />
                                <span className="italic line-clamp-1">&quot;{item.notes}&quot;</span>
                                <span className="text-[10px] text-orange-600 font-bold ml-1">Edit</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => setActiveItemNotesId(item.productId)}
                                className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add cooking note</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Quick Customer Name & Special Instructions right in drawer */}
              {cart.length > 0 && (
                <div className="pt-3 space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Guest Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Your Name"
                      maxLength={100}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Order Cooking Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={orderInstructions}
                      onChange={(e) => setOrderInstructions(e.target.value)}
                      placeholder="e.g. Bring water first, extra napkins..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Bill Details Summary Card */}
              {cart.length > 0 && (
                <div className="pt-3 space-y-1.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                    <h4 className="font-bold text-slate-900 text-xs">Bill Summary</h4>
                    <div className="flex justify-between text-slate-600">
                      <span>Item Subtotal ({totalCount} items)</span>
                      <span className="font-black text-slate-900">
                        {formatPaise(indicativeSubtotalPaise, restaurant.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px] border-t border-slate-200/60 pt-1.5">
                      <span>Taxes &amp; Restaurant Charges</span>
                      <span>Included / At checkout</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-white space-y-2">
                {/* Warning if Table QR code is missing */}
                {!verifiedTable && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <QrCode className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="leading-tight text-[11px]">
                      <span className="font-bold">Table QR Required: </span>
                      Please scan your table QR stand with your phone camera to place your dine-in order.
                    </div>
                  </div>
                )}

                {/* Primary Action Button (Proceed to Order / Send to Kitchen) */}
                <button
                  onClick={() => setShowOrderReadyModal(true)}
                  disabled={!submissionValidation.isReady}
                  className={`w-full py-3.5 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-between shadow-md ${
                    submissionValidation.isReady
                      ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white shadow-orange-600/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <div className="text-left">
                    <span className="block text-[10px] font-bold opacity-80 uppercase tracking-wider">
                      {verifiedTable ? `Table ${verifiedTable.tableNumber}` : 'Dine-In Order'}
                    </span>
                    <span className="text-sm font-black">
                      {formatPaise(indicativeSubtotalPaise, restaurant.currency)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-black">
                    <span>{submissionValidation.isReady ? 'Proceed to Order' : 'Order Not Ready'}</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          6. Order Submission Confirmation Modal
      ===================================================================== */}
      {showOrderReadyModal && verifiedTable && !placedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 text-left animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Confirm Dine-in Order</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Table {verifiedTable.tableNumber} • {restaurant.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderReadyModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderSubmissionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{orderSubmissionError}</span>
              </div>
            )}

            {/* Customer Contact Details */}
            <div className="space-y-2 pt-1">
              <span className="block text-xs font-bold text-slate-700">Customer Details (Optional)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  maxLength={100}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
                <input
                  type="tel"
                  placeholder="Phone Number (Optional)"
                  maxLength={20}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Order Items Summary */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Order Summary ({totalCount} items)
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {cart.map((item) => (
                  <div key={item.productId} className="flex justify-between items-center text-slate-700 text-xs">
                    <span className="line-clamp-1 flex-1 pr-2">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span className="font-semibold shrink-0">
                      {formatPaise(item.product.price * item.quantity, restaurant.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-black text-slate-900 text-sm pt-2 border-t border-slate-200">
                <span>Indicative Total</span>
                <span className="text-orange-600">
                  {formatPaise(indicativeSubtotalPaise, restaurant.currency)}
                </span>
              </div>
            </div>

            {orderInstructions && (
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900">
                <span className="font-bold">Instructions: </span>
                <span className="italic">{orderInstructions}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOrderReadyModal(false)}
                disabled={isSubmittingOrder}
                className="flex-1 py-3 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Back to Cart
              </button>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isSubmittingOrder}
                className="flex-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 disabled:opacity-70"
              >
                {isSubmittingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending to Kitchen...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Send Order to Kitchen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          7. Order Confirmed Screen / Modal
      ===================================================================== */}
      {placedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-100 text-center animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-7 h-7" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Order #{placedOrder.orderNumber} Placed!</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Sent to Kitchen</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Your meal is being prepared for{' '}
                <span className="font-bold text-slate-800">
                  {placedOrder.table?.tableNumber || verifiedTable?.tableNumber}
                </span>
                .
              </p>
            </div>

            {/* Order Details Receipt Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Status</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase text-[10px]">
                  {placedOrder.status || 'NEW'}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Table</span>
                <span className="font-bold text-slate-800">
                  {placedOrder.table?.tableNumber || verifiedTable?.tableNumber}
                </span>
              </div>
              {placedOrder.customerName && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Customer</span>
                  <span className="font-medium text-slate-800">{placedOrder.customerName}</span>
                </div>
              )}

              {placedOrder.items && placedOrder.items.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ordered Items</span>
                  {placedOrder.items.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-700 text-xs">
                      <span>{it.quantity}× {it.productName}</span>
                      {it.subtotal !== undefined && (
                        <span className="font-mono text-slate-500 text-[11px]">
                          {formatPaise(it.subtotal, restaurant.currency)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between font-black text-slate-900 text-sm pt-2 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-emerald-700">
                  {formatPaise(placedOrder.totalAmount, restaurant.currency)}
                </span>
              </div>
            </div>

            {/* Tracking Reference & Actions */}
            {placedOrder.statusToken && (
              <div className="space-y-2 pt-1">
                <Link
                  href={`/track/${placedOrder.statusToken}`}
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Track Live Preparation</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                </Link>

                {autoRedirectSeconds !== null && autoRedirectSeconds > 0 && (
                  <p className="text-[11px] text-slate-400">
                    Opening live tracker in {autoRedirectSeconds}s...
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setPlacedOrder(null);
                setOrderInstructions('');
              }}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Order More Items
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerPublicMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      }
    >
      <CustomerMenuContent />
    </Suspense>
  );
}
