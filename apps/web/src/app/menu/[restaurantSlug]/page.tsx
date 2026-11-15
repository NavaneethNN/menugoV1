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
  CartItem
} from '@/lib/cart';
import { VegBadge, NonVegBadge } from '@/components/menu/VegBadge';
import { ProductDetailModal } from '@/components/menu/ProductDetailModal';
import { CartDrawer } from '@/components/menu/CartDrawer';
import { OrderConfirmModal } from '@/components/menu/OrderConfirmModal';
import { OrderSuccessModal } from '@/components/menu/OrderSuccessModal';
import { ServiceRequestModal } from '@/components/menu/ServiceRequestModal';
import { CategoryMenuModal } from '@/components/menu/CategoryMenuModal';
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
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  QrCode,
  Info,
  ChevronDown,
  ArrowRight,
  Lock,
  Flame,
  Star,
  ChefHat,
  Share2,
  Bell,
  Check
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

type QuickFilterType = 'all' | 'bestsellers' | 'chefs-picks' | 'veg' | 'non-veg';

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
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [showInfoDetails, setShowInfoDetails] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Cart States (Scoped strictly to current restaurant)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderInstructions, setOrderInstructions] = useState('');
  const [showOrderReadyModal, setShowOrderReadyModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSubmissionError, setOrderSubmissionError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);
  const [autoRedirectSeconds, setAutoRedirectSeconds] = useState<number | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Modal States
  const [selectedProductForModal, setSelectedProductForModal] = useState<PublicProduct | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Auto-redirect timer when order is confirmed
  useEffect(() => {
    if (!placedOrder?.statusToken) {
      setAutoRedirectSeconds(null);
      return;
    }

    setAutoRedirectSeconds(5);
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

  // Auto-recovery polling
  useEffect(() => {
    if (!isTableOccupiedByOther || !tableToken) return;

    const interval = setInterval(() => {
      verifyTableToken(tableToken);
    }, 6000);

    return () => clearInterval(interval);
  }, [isTableOccupiedByOther, tableToken, verifyTableToken]);

  // Restore cart from localStorage on mount
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
        setSelectedProductForModal(null);
        setIsServiceModalOpen(false);
        setIsCategoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  const handleAddToCart = (product: PublicProduct | any, notes?: string) => {
    setCart((prev) => addItemToCart(prev, product, notes));
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

  const getItemNotes = (productId: string) => {
    return cart.find((i) => i.productId === productId)?.notes || '';
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

  // Share Table Link / Web Share API
  const handleShareTable = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${data?.restaurant.name || 'MenuGo'} - Table Menu`,
          text: `Check out the menu and order together at ${data?.restaurant.name}!`,
          url
        });
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {
        // Clipboard error
      }
    }
  };

  // Filter products based on search query, veg-only toggle, quick filters, and selected category
  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];

    return data.products.filter((product) => {
      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory) {
        return false;
      }

      if (vegOnly && !product.isVegetarian) {
        return false;
      }

      if (quickFilter === 'veg' && !product.isVegetarian) return false;
      if (quickFilter === 'non-veg' && product.isVegetarian) return false;
      if (quickFilter === 'bestsellers' && product.sortOrder > 3) return false;
      if (quickFilter === 'chefs-picks' && product.sortOrder > 2) return false;

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
  }, [data?.products, selectedCategory, vegOnly, quickFilter, searchQuery]);

  // Featured / Chef's Recommendation products
  const featuredProducts = useMemo(() => {
    if (!data?.products) return [];
    return data.products
      .filter((p) => p.isAvailable)
      .slice(0, 8);
  }, [data?.products]);

  // Smart Upsell / Cross-Sell Recommendations
  const upsellProducts = useMemo(() => {
    if (!data?.products) return [];
    const cartProductIds = new Set(cart.map((i) => i.productId));
    return data.products
      .filter((p) => p.isAvailable && !cartProductIds.has(p.id))
      .slice(0, 6);
  }, [data?.products, cart]);

  // Suggested pairings for selected product modal
  const modalPairings = useMemo(() => {
    if (!data?.products || !selectedProductForModal) return [];
    return data.products
      .filter(
        (p) =>
          p.isAvailable &&
          p.id !== selectedProductForModal.id &&
          p.categoryId !== selectedProductForModal.categoryId
      )
      .slice(0, 3);
  }, [data?.products, selectedProductForModal]);

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

  // Category counts for the category modal
  const categoryModalItems = useMemo(() => {
    if (!data) return [];
    return (data.categories || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      count: data.products.filter((p) => p.categoryId === cat.id).length
    }));
  }, [data]);

  // ---------------------------------------------------------------------------
  // 1. Loading Skeleton State
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm animate-pulse">
          <div className="h-32 sm:h-40 bg-slate-200 w-full" />
          <div className="px-4 pt-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 border-2 border-white shadow-sm shrink-0" />
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

  // ---------------------------------------------------------------------------
  // 1b. Table Occupied by Another Customer
  // ---------------------------------------------------------------------------
  if (isTableOccupiedByOther) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
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

          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 text-left mb-6 space-y-2">
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
              className="w-full py-3.5 px-5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
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
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-2xl shadow-md transition"
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
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-red-100 selection:text-red-900 font-sans">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-2xl relative pb-32 border-x border-slate-100/80">
        
        {/* =====================================================================
            1. Bespoke Hero Header (Rich Crimson & Midnight Obsidian)
        ===================================================================== */}
        <div className="relative bg-gradient-to-br from-slate-950 via-red-950 to-slate-900 text-white overflow-hidden">
          {/* Subtle Ambient Cover Background (if image exists) */}
          {restaurant.coverImageUrl && !imageErrors['cover'] ? (
            <div className="absolute inset-0 opacity-25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={restaurant.coverImageUrl}
                alt={restaurant.name}
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
              <span>Kitchen Live</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShareTable}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/15 transition shadow-sm"
                title="Share Table Menu"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white backdrop-blur-md text-xs font-black transition shadow-sm border border-red-400/30"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Call Staff</span>
              </button>
            </div>
          </div>

          {/* Restaurant Hero Presentation (PROMINENT RESTAURANT NAME) */}
          <div className="relative z-10 px-4 sm:px-6 pt-3 pb-6">
            <div className="flex items-center gap-3.5 sm:gap-4">
              {/* Logo Avatar */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center overflow-hidden shrink-0 border-2 border-white/20 p-0.5">
                {restaurant.logoUrl && !imageErrors['logo'] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={restaurant.logoUrl}
                    alt={restaurant.name}
                    className="w-full h-full object-cover rounded-xl"
                    onError={() => handleImageError('logo')}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 to-rose-800 text-white flex items-center justify-center font-black text-2xl sm:text-3xl rounded-xl">
                    {restaurant.name?.charAt(0) || 'M'}
                  </div>
                )}
              </div>

              {/* Proud Restaurant Name & Badges */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight truncate">
                  {restaurant.name}
                </h1>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {/* Verified Table Badge */}
                  {verifiedTable ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-black">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span>Table {verifiedTable.tableNumber}</span>
                      <span className="text-emerald-300 font-medium hidden sm:inline">• Dine-in</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-slate-200 text-xs font-bold">
                      <QrCode className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>Browsing Mode</span>
                    </div>
                  )}

                  {restaurant.address && (
                    <button
                      onClick={() => setShowInfoDetails(!showInfoDetails)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-2.5 py-0.5 rounded-full border border-white/15 transition"
                    >
                      <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="max-w-[130px] sm:max-w-[180px] truncate">{restaurant.address}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showInfoDetails ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {tableError && (
              <div className="mt-3 flex items-center gap-1.5 p-2 bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[11px] rounded-xl font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{tableError}</span>
              </div>
            )}

            {/* Collapsible Restaurant Address & Contact Details */}
            {showInfoDetails && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-300 space-y-1.5 animate-in slide-in-from-top-1">
                {restaurant.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <span>{restaurant.address}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {restaurant.phone && (
                    <a
                      href={`tel:${restaurant.phone}`}
                      className="flex items-center gap-1.5 text-red-300 font-bold hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{restaurant.phone}</span>
                    </a>
                  )}
                  {restaurant.email && (
                    <a
                      href={`mailto:${restaurant.email}`}
                      className="flex items-center gap-1.5 text-slate-300 hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{restaurant.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Order Preparation Banner */}
        {placedOrder && (
          <div className="p-3 mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 animate-bounce" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 truncate">
                  Order #{placedOrder.orderNumber} is preparing in the kitchen!
                </p>
                <p className="text-[11px] text-red-700 font-semibold">
                  Feel free to add more dishes for Round 2
                </p>
              </div>
            </div>
            {placedOrder.statusToken && (
              <Link
                href={`/track/${placedOrder.statusToken}`}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs transition shrink-0 flex items-center gap-1"
              >
                <span>Track</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        {/* =====================================================================
            2. Sticky Navigation Header (ALWAYS SHOWS RESTAURANT NAME + FILTERS)
        ===================================================================== */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          {/* Compact Restaurant Name Strip (Guarantees Name is NEVER Hidden on Scroll) */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-red-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                {restaurant.name?.charAt(0) || 'M'}
              </div>
              <span className="text-xs font-black text-slate-900 truncate">
                {restaurant.name}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-bold text-red-600 truncate">
                {verifiedTable ? `Table ${verifiedTable.tableNumber}` : 'Dine-In Menu'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-200/60 transition"
              >
                <Bell className="w-3 h-3 text-red-600" />
                <span>Help</span>
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

          {/* Quick Filter Chips (Bestsellers, Chef's Picks, Non-Veg) */}
          <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
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
                            {formatPaise(prod.price, restaurant.currency)}
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
                              >
                                <Minus className="w-3 h-3 stroke-[3]" />
                              </button>
                              <span className="text-xs font-black">{qty}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(prod.id, 1)}
                                className="p-1 hover:bg-red-700 rounded-lg transition"
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

          {/* Empty Restaurant State */}
          {products.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-200">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">Menu is being prepared</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                This restaurant has not published any dishes yet. Please ask your server or check back shortly.
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
                              {product.sortOrder <= 2 && (
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
                            <p className="text-sm font-black text-slate-900 mt-0.5">
                              {formatPaise(product.price, restaurant.currency)}
                            </p>

                            {/* Description */}
                            {product.description && (
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                                {product.description}
                              </p>
                            )}

                            {/* Note indicator if attached */}
                            {itemNotes && (
                              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-md font-medium">
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span className="italic truncate max-w-[150px]">&quot;{itemNotes}&quot;</span>
                              </div>
                            )}
                          </div>

                          {/* Product Image & Add / Stepper Controls (Right Side) */}
                          {hasImage ? (
                            <div
                              className="relative shrink-0 w-24 sm:w-28 flex flex-col items-center"
                              onClick={(e) => e.stopPropagation()}
                            >
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
                                    type="button"
                                    onClick={() => handleAddToCart(product)}
                                    className="w-full py-1.5 px-2 bg-white hover:bg-red-50 active:bg-red-100 text-red-600 border border-red-200 hover:border-red-400 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1"
                                    aria-label={`Add ${product.name} to order`}
                                  >
                                    <Plus className="w-3.5 h-3.5 text-red-600 stroke-[3]" />
                                    <span>ADD</span>
                                  </button>
                                ) : (
                                  <div className="w-full py-1 px-1 bg-red-600 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(product.id, -1)}
                                      className="p-1 hover:bg-red-700 rounded-lg transition"
                                      aria-label={`Decrease quantity of ${product.name}`}
                                    >
                                      <Minus className="w-3 h-3 stroke-[3]" />
                                    </button>
                                    <span className="px-1 text-xs font-black text-white">{quantity}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(product.id, 1)}
                                      className="p-1 hover:bg-red-700 rounded-lg transition"
                                      aria-label={`Increase quantity of ${product.name}`}
                                    >
                                      <Plus className="w-3 h-3 stroke-[3]" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Dish without image */
                            <div
                              className="shrink-0 w-20 sm:w-24 self-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {quantity === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(product)}
                                  className="w-full py-2 px-3 bg-white hover:bg-red-50 active:bg-red-100 text-red-600 border border-red-200 hover:border-red-400 font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                                  aria-label={`Add ${product.name} to order`}
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>ADD</span>
                                </button>
                              ) : (
                                <div className="w-full py-1.5 px-1.5 bg-red-600 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(product.id, -1)}
                                    className="p-1 hover:bg-red-700 rounded-lg transition"
                                    aria-label={`Decrease quantity of ${product.name}`}
                                  >
                                    <Minus className="w-3 h-3 stroke-[3]" />
                                  </button>
                                  <span className="px-1 text-xs font-black">{quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(product.id, 1)}
                                    className="p-1 hover:bg-red-700 rounded-lg transition"
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
        <div className="mt-8 pt-6 pb-6 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <span>Powered by</span>
            <span className="font-extrabold text-slate-700">MenuGo</span>
          </p>
        </div>
      </div>

      {/* =====================================================================
          Floating Category Navigator FAB (Mobile Menu Jump Button)
      ===================================================================== */}
      {categories.length > 1 && (
        <div className="fixed bottom-20 right-4 z-40">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-4 py-2 bg-slate-900/90 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs rounded-full shadow-xl backdrop-blur-md border border-slate-700 flex items-center gap-1.5 transition"
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-red-400" />
            <span>Menu ({categories.length})</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          Floating Mobile Cart Action Bar (Visible when cart has items)
      ===================================================================== */}
      {totalCount > 0 && (
        <div className="fixed bottom-3 inset-x-3 z-40 max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-slate-950 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 backdrop-blur-md ring-1 ring-red-500/20">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white relative shadow-sm shrink-0">
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
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <span>View Order</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          Product Detail Sensory Modal / Customizer
      ===================================================================== */}
      <ProductDetailModal
        product={selectedProductForModal}
        isOpen={Boolean(selectedProductForModal)}
        onClose={() => setSelectedProductForModal(null)}
        currency={restaurant.currency}
        quantityInCart={selectedProductForModal ? getItemQuantity(selectedProductForModal.id) : 0}
        currentNotes={selectedProductForModal ? getItemNotes(selectedProductForModal.id) : ''}
        onAddToCart={handleAddToCart}
        onUpdateQty={handleUpdateQty}
        onUpdateNotes={handleUpdateNotes}
        suggestedPairings={modalPairings}
      />

      {/* =====================================================================
          Slide-Over Cart Drawer with Complete Your Feast Upsells
      ===================================================================== */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        currency={restaurant.currency}
        verifiedTable={verifiedTable}
        totalCount={totalCount}
        indicativeSubtotalPaise={indicativeSubtotalPaise}
        hasUnavailableItems={hasUnavailableItems}
        onRemoveUnavailable={handleRemoveUnavailable}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onUpdateNotes={handleUpdateNotes}
        onAddToCart={handleAddToCart}
        customerName={customerName}
        setCustomerName={setCustomerName}
        orderInstructions={orderInstructions}
        setOrderInstructions={setOrderInstructions}
        isReadyToSubmit={submissionValidation.isReady}
        onProceedToOrder={() => {
          setIsCartOpen(false);
          setShowOrderReadyModal(true);
        }}
        upsellProducts={upsellProducts}
      />

      {/* =====================================================================
          Order Submission Confirmation Modal
      ===================================================================== */}
      {showOrderReadyModal && verifiedTable && !placedOrder && (
        <OrderConfirmModal
          isOpen={showOrderReadyModal}
          onClose={() => setShowOrderReadyModal(false)}
          verifiedTable={verifiedTable}
          restaurantName={restaurant.name}
          currency={restaurant.currency}
          cart={cart}
          totalCount={totalCount}
          indicativeSubtotalPaise={indicativeSubtotalPaise}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          orderInstructions={orderInstructions}
          isSubmittingOrder={isSubmittingOrder}
          orderSubmissionError={orderSubmissionError}
          onPlaceOrder={handlePlaceOrder}
        />
      )}

      {/* =====================================================================
          Order Confirmed Screen / Modal
      ===================================================================== */}
      {placedOrder && (
        <OrderSuccessModal
          order={placedOrder}
          currency={restaurant.currency}
          tableNumber={verifiedTable?.tableNumber}
          autoRedirectSeconds={autoRedirectSeconds}
          onOrderMore={() => {
            setPlacedOrder(null);
            setOrderInstructions('');
          }}
        />
      )}

      {/* =====================================================================
          Table Service Assistance Modal (Water, Cutlery, Waiter, Bill)
      ===================================================================== */}
      <ServiceRequestModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        tableNumber={verifiedTable?.tableNumber}
        restaurantName={restaurant.name}
      />

      {/* =====================================================================
          Category Jump Modal (Mobile FAB Sheet)
      ===================================================================== */}
      <CategoryMenuModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categoryModalItems}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          if (catId !== 'all') {
            const el = document.getElementById(`category-${catId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }}
      />
    </div>
  );
}

export default function CustomerPublicMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </div>
      }
    >
      <CustomerMenuContent />
    </Suspense>
  );
}
