'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { formatPaise } from '@menugo/shared';
import {
  Film,
  Tv,
  Sparkles,
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
  Calendar,
  Layers,
  Leaf,
  Beef,
  Plus,
  Minus,
  ShoppingBag,
  HelpCircle,
  X,
  RotateCcw,
  Check,
  CreditCard,
  User,
  Phone,
  MessageSquare,
  Trash2
} from 'lucide-react';
import {
  CinemaCartItem,
  CinemaOrderContext,
  getCinemaCartStorageKey,
  serializeCinemaCart,
  deserializeCinemaCart,
  addCinemaProductToCart,
  updateCinemaItemQuantity,
  removeCinemaItemFromCart,
  clearCinemaCartItems,
  calculateIndicativeCinemaTotals
} from '@/lib/cinema-cart';
import { CinemaCartDrawer } from './CinemaCartDrawer';
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

interface CinemaShow {
  id: string;
  screenId: string;
  movieId: string;
  movieTitle: string;
  moviePosterUrl?: string | null;
  language?: string | null;
  durationMinutes: number;
  movieDescription?: string | null;
  showDate: string;
  startTime: string;
  expectedEndTime: string;
  orderingStartTime: string;
  orderingEndTime: string;
  isOrderingOpen: boolean;
  orderingStatus: 'open' | 'upcoming' | 'closed';
}

interface SeatingRow {
  id: string;
  rowIdentifier: string;
  seatCategory: string;
  totalSeats: number;
  seats: Array<{
    id: string;
    seatIdentifier: string;
    seatNumber: number;
    seatCategory: string;
    status: string;
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
  // Stepper State: 1 = Screen, 2 = Showtime, 3 = Seat, 4 = Menu, 5 = Checkout
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Resolved Data
  const [resolveData, setResolveData] = useState<ResolvedCinemaData | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  // Selection State
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [selectedScreenObj, setSelectedScreenObj] = useState<any>(null);

  // Shows State
  const [shows, setShows] = useState<CinemaShow[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [selectedShow, setSelectedShow] = useState<CinemaShow | null>(null);

  // Seating State
  const [seatingRows, setSeatingRows] = useState<SeatingRow[]>([]);
  const [loadingSeating, setLoadingSeating] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string>('');
  const [selectedSeat, setSelectedSeat] = useState<any>(null);
  const [validatingSelection, setValidatingSelection] = useState(false);
  const [selectionValidated, setSelectionValidated] = useState(false);

  // Menu State
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('ALL');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  // Task 10: Cinema Cart & Checkout State
  const [cartItems, setCartItems] = useState<CinemaCartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [serverSummary, setServerSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [preparedOrder, setPreparedOrder] = useState<any>(null);
  const [isPreparedModalOpen, setIsPreparedModalOpen] = useState(false);

  // General Error / Alert
  const [stepError, setStepError] = useState<string | null>(null);

  // 1. Initial QR Resolution
  useEffect(() => {
    if (!theatreToken) return;

    const resolveQR = async () => {
      try {
        setLoadingInitial(true);
        setInitialError(null);

        const endpoint = screenToken
          ? `/api/cinema/public/resolve/${theatreToken}/${screenToken}`
          : `/api/cinema/public/resolve/${theatreToken}`;

        const data: ResolvedCinemaData = await apiRequest(endpoint);
        setResolveData(data);

        // If screen is preselected from QR, lock screen and advance to showtime selection
        if (data.isScreenPreselected && data.selectedScreen) {
          setSelectedScreenId(data.selectedScreen.screenId);
          setSelectedScreenObj(data.selectedScreen);
          setCurrentStep(2);
        } else if (data.screens.length === 1 && data.screens[0]) {
          // If only 1 auditorium in the theatre, auto-select it
          setSelectedScreenId(data.screens[0].id);
          setSelectedScreenObj(data.screens[0]);
          setCurrentStep(2);
        }
      } catch (err: any) {
        console.error('Failed to resolve QR token:', err);
        setInitialError(err?.message || 'Invalid or expired cinema QR stand');
      } finally {
        setLoadingInitial(false);
      }
    };

    resolveQR();
  }, [theatreToken, screenToken]);

  // 2. Load Shows when screen changes or on step 2
  useEffect(() => {
    if (!theatreToken || !selectedScreenId || currentStep < 2) return;

    const fetchShows = async () => {
      try {
        setLoadingShows(true);
        setStepError(null);

        const data = await apiRequest(
          `/api/cinema/public/shows/${theatreToken}?screenId=${selectedScreenId}`
        );
        setShows(data.shows || []);
      } catch (err: any) {
        console.error('Failed to load shows:', err);
        setStepError(err?.message || 'Failed to retrieve movie show schedules');
      } finally {
        setLoadingShows(false);
      }
    };

    fetchShows();
  }, [theatreToken, selectedScreenId, currentStep]);

  // 3. Load Seating Layout when show is selected or on step 3
  useEffect(() => {
    if (!theatreToken || !selectedScreenId || currentStep < 3) return;

    const fetchSeating = async () => {
      try {
        setLoadingSeating(true);
        setStepError(null);

        const data = await apiRequest(
          `/api/cinema/public/seating/${theatreToken}/${selectedScreenId}`
        );
        const rows: SeatingRow[] = data.rows || [];
        setSeatingRows(rows);

        // Auto-select first row if none selected
        if (rows.length > 0 && rows[0] && !selectedRowId) {
          setSelectedRowId(rows[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load seating layout:', err);
        setStepError(err?.message || 'Failed to retrieve screen seating layout');
      } finally {
        setLoadingSeating(false);
      }
    };

    fetchSeating();
  }, [theatreToken, selectedScreenId, currentStep, selectedRowId]);

  // 4. Load Food Menu when reaching step 4
  useEffect(() => {
    if (!theatreToken || currentStep < 4) return;

    const fetchMenu = async () => {
      try {
        setLoadingMenu(true);
        setStepError(null);

        const data = await apiRequest(`/api/cinema/public/menu/${theatreToken}`);
        setCategories(data.categories || []);
        setProducts(data.products || []);
      } catch (err: any) {
        console.error('Failed to load concessions menu:', err);
        setStepError(err?.message || 'Failed to retrieve concessions menu');
      } finally {
        setLoadingMenu(false);
      }
    };

    fetchMenu();
  }, [theatreToken, currentStep]);

  // Step 1: Select Screen
  const handleSelectScreen = (screen: any) => {
    setSelectedScreenId(screen.id);
    setSelectedScreenObj(screen);
    setSelectedShow(null);
    setSelectedSeat(null);
    setSelectionValidated(false);
    setCurrentStep(2);
  };

  // Step 2: Select Show
  const handleSelectShow = (show: CinemaShow) => {
    setSelectedShow(show);
    setSelectedSeat(null);
    setSelectionValidated(false);
    setCurrentStep(3);
  };

  // Step 3: Validate Seat & Advance to Menu
  const handleConfirmSeatAndAdvance = async () => {
    if (!selectedScreenId || !selectedShow || !selectedSeat) {
      setStepError('Please select both a row and a seat');
      return;
    }

    try {
      setValidatingSelection(true);
      setStepError(null);

      const currentRow = seatingRows.find((r) => r.id === selectedRowId);
      if (!currentRow) throw new Error('Selected row not found');

      // Server-side validation of full guest selection
      await apiRequest('/api/cinema/public/validate-selection', {
        method: 'POST',
        body: JSON.stringify({
          theatreToken,
          screenId: selectedScreenId,
          showId: selectedShow.id,
          rowIdentifier: currentRow.rowIdentifier,
          seatIdentifier: selectedSeat.seatIdentifier,
          bypassTimeWindowForPreview: !selectedShow.isOrderingOpen
        })
      });

      setSelectionValidated(true);
      setCurrentStep(4);
    } catch (err: any) {
      console.error('Selection validation failed:', err);
      setStepError(err?.message || 'Seat selection could not be validated on the server');
    } finally {
      setValidatingSelection(false);
    }
  };

  // Cinema Order Context Definition
  const currentContext: CinemaOrderContext | null = useMemo(() => {
    if (!resolveData?.theatre || !selectedScreenObj || !selectedShow || !selectedSeat) {
      return null;
    }
    const currentRow = seatingRows.find((r) => r.id === selectedRowId);
    return {
      theatreId: resolveData.theatre.name,
      theatreName: resolveData.theatre.name,
      theatreCurrency: resolveData.theatre.currency,
      theatreToken,
      screenId: selectedScreenId,
      screenName: selectedScreenObj.screenName,
      screenType: selectedScreenObj.screenType,
      showId: selectedShow.id,
      movieTitle: selectedShow.movieTitle,
      moviePosterUrl: selectedShow.moviePosterUrl,
      showDate: selectedShow.showDate,
      startTime: selectedShow.startTime,
      expectedEndTime: selectedShow.expectedEndTime,
      seatRow: currentRow?.rowIdentifier || selectedSeat.seatIdentifier?.charAt(0) || 'A',
      seatNumber: selectedSeat.seatIdentifier,
      seatCategory: selectedSeat.seatCategory
    };
  }, [
    resolveData,
    selectedScreenObj,
    selectedShow,
    selectedSeat,
    seatingRows,
    selectedRowId,
    theatreToken,
    selectedScreenId
  ]);

  // Restore cart from localStorage on mount
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

  // Persist cart to localStorage whenever items or context change
  useEffect(() => {
    if (!theatreToken) return;
    try {
      const storageKey = getCinemaCartStorageKey(theatreToken);
      if (cartItems.length > 0 || currentContext) {
        localStorage.setItem(
          storageKey,
          serializeCinemaCart({
            theatreToken,
            context: currentContext,
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
  }, [theatreToken, cartItems, currentContext, customerName, customerPhone, specialInstructions]);

  // Authoritative server-side price calculation
  const fetchAuthoritativeSummary = async () => {
    if (!currentContext || cartItems.length === 0) return;
    try {
      setLoadingSummary(true);
      setStepError(null);

      const data = await apiRequest('/api/cinema/public/cart/summary', {
        method: 'POST',
        body: JSON.stringify({
          theatreToken,
          screenId: currentContext.screenId,
          showId: currentContext.showId,
          seatRow: currentContext.seatRow,
          seatNumber: currentContext.seatNumber,
          items: cartItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes || null
          })),
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          specialInstructions: specialInstructions || null
        })
      });

      setServerSummary(data.summary);
    } catch (err: any) {
      console.error('Authoritative checkout calculation failed:', err);
      setStepError(err?.message || 'Could not calculate authoritative order totals');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Recalculate server prices when reaching step 5
  useEffect(() => {
    if (currentStep === 5 && currentContext && cartItems.length > 0) {
      fetchAuthoritativeSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, cartItems, currentContext]);

  // Cart Handlers
  const handleAddToCart = (product: FoodProduct) => {
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
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCartItems((prev) => updateCinemaItemQuantity(prev, productId, delta));
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => removeCinemaItemFromCart(prev, productId));
  };

  const handleClearCart = () => {
    setCartItems(clearCinemaCartItems());
    if (theatreToken) {
      try {
        localStorage.removeItem(getCinemaCartStorageKey(theatreToken));
      } catch {}
    }
  };

  // Prepare Order Action (Task 10)
  const handlePrepareOrder = async () => {
    if (!currentContext || cartItems.length === 0) {
      setStepError('Your cart is empty or cinema context is incomplete');
      return;
    }

    try {
      setIsSubmittingOrder(true);
      setStepError(null);

      const data = await apiRequest('/api/cinema/public/checkout/prepare', {
        method: 'POST',
        body: JSON.stringify({
          theatreToken,
          screenId: currentContext.screenId,
          showId: currentContext.showId,
          seatRow: currentContext.seatRow,
          seatNumber: currentContext.seatNumber,
          items: cartItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes || null
          })),
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          specialInstructions: specialInstructions.trim() || null
        })
      });

      setPreparedOrder({
        ...data.order,
        statusToken: data.statusToken || data.order?.statusToken
      });
      setIsPreparedModalOpen(true);
      // Clear cart from state & localStorage
      setCartItems([]);
      if (theatreToken) {
        try {
          localStorage.removeItem(getCinemaCartStorageKey(theatreToken));
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to prepare cinema order:', err);
      setStepError(err?.message || 'Failed to prepare cinema concessions order');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Filtered Food Menu
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCatFilter !== 'ALL' && p.categoryId !== selectedCatFilter) return false;
      if (dietaryFilter === 'VEG' && !p.isVegetarian) return false;
      if (dietaryFilter === 'NON_VEG' && p.isVegetarian) return false;
      return true;
    });
  }, [products, selectedCatFilter, dietaryFilter]);

  // Cart Quantities map for quick product card lookups
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems) {
      map[item.productId] = item.quantity;
    }
    return map;
  }, [cartItems]);

  // Indicative totals (Client-side fast feedback)
  const indicativeTotals = useMemo(() => {
    return calculateIndicativeCinemaTotals(cartItems, 5);
  }, [cartItems]);

  const totalCartCount = indicativeTotals.itemCount;
  const totalCartPaise = serverSummary?.totalAmount ?? indicativeTotals.totalPaise;
  const subtotalPaise = serverSummary?.subtotal ?? indicativeTotals.subtotalPaise;
  const taxPaise = serverSummary?.taxAmount ?? indicativeTotals.taxPaise;

  // Render Loading
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium text-slate-400">Connecting to Cinema Concessions...</p>
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
          <h2 className="text-lg font-black text-white">Invalid or Expired QR Stand</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {initialError || 'This QR stand token is unrecognized or has been revoked by theatre management.'}
          </p>
          <div className="pt-2">
            <p className="text-[11px] text-slate-500">
              Please ask an usher or theatre staff member for an active QR code stand.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { theatre, screens } = resolveData;
  const activeRow = seatingRows.find((r) => r.id === selectedRowId);

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-600 selection:text-white pb-24">
      {/* Top Mobile Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-600/30">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <span className="font-black text-sm tracking-tight text-white block">
                {theatre.name}
              </span>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider block">
                In-Seat Ordering
              </span>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Verified Stand</span>
          </span>
        </div>

        {/* 5-Step Progress Ribbon */}
        <div className="max-w-2xl mx-auto px-2 sm:px-4 py-2 border-t border-slate-800/80 grid grid-cols-5 gap-1 text-center text-[9px] sm:text-[10px] font-bold">
          <button
            onClick={() => {
              if (!resolveData.isScreenPreselected) setCurrentStep(1);
            }}
            disabled={resolveData.isScreenPreselected}
            className={`py-1 px-1 rounded-md transition truncate flex items-center justify-center gap-1 ${
              currentStep === 1
                ? 'bg-indigo-600 text-white'
                : selectedScreenId
                ? 'text-indigo-400 bg-indigo-950/40'
                : 'text-slate-500'
            }`}
          >
            <span>1. Screen</span>
            {selectedScreenObj && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
          </button>

          <button
            onClick={() => {
              if (selectedScreenId) setCurrentStep(2);
            }}
            disabled={!selectedScreenId}
            className={`py-1 px-1 rounded-md transition truncate flex items-center justify-center gap-1 ${
              currentStep === 2
                ? 'bg-indigo-600 text-white'
                : selectedShow
                ? 'text-indigo-400 bg-indigo-950/40'
                : 'text-slate-500'
            }`}
          >
            <span>2. Show</span>
            {selectedShow && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
          </button>

          <button
            onClick={() => {
              if (selectedShow) setCurrentStep(3);
            }}
            disabled={!selectedShow}
            className={`py-1 px-1 rounded-md transition truncate flex items-center justify-center gap-1 ${
              currentStep === 3
                ? 'bg-indigo-600 text-white'
                : selectedSeat
                ? 'text-indigo-400 bg-indigo-950/40'
                : 'text-slate-500'
            }`}
          >
            <span>3. Seat</span>
            {selectedSeat && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
          </button>

          <button
            onClick={() => {
              if (selectedSeat && selectionValidated) setCurrentStep(4);
            }}
            disabled={!selectedSeat || !selectionValidated}
            className={`py-1 px-1 rounded-md transition truncate ${
              currentStep === 4
                ? 'bg-indigo-600 text-white'
                : totalCartCount > 0
                ? 'text-indigo-400 bg-indigo-950/40'
                : 'text-slate-500'
            }`}
          >
            4. Menu {totalCartCount > 0 ? `(${totalCartCount})` : ''}
          </button>

          <button
            onClick={() => {
              if (totalCartCount > 0) setCurrentStep(5);
            }}
            disabled={totalCartCount === 0}
            className={`py-1 px-1 rounded-md transition truncate ${
              currentStep === 5
                ? 'bg-indigo-600 text-white'
                : totalCartCount > 0
                ? 'text-indigo-300 bg-indigo-950/40'
                : 'text-slate-600'
            }`}
          >
            5. Checkout
          </button>
        </div>
      </header>

      {/* Main Responsive Body */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Step Error Banner */}
        {stepError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{stepError}</span>
            </div>
            <button onClick={() => setStepError(null)} className="text-rose-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected Destination Pill (when show or seat is picked) */}
        {selectedScreenObj && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Tv className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                <strong>{selectedScreenObj.screenName}</strong>
                {selectedShow && ` • ${selectedShow.movieTitle}`}
                {selectedSeat && ` • Seat ${selectedSeat.seatIdentifier}`}
              </span>
            </div>
            {currentStep === 4 && (
              <button
                onClick={() => setCurrentStep(3)}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Change Seat
              </button>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 1: SELECT AUDITORIUM SCREEN
        ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-white">Select Your Auditorium</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose the screen where you are watching your movie
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {screens.map((scr) => (
                <div
                  key={scr.id}
                  onClick={() => handleSelectScreen(scr)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedScreenId === scr.id
                      ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      {scr.screenType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {scr.totalSeats || 0} Seats
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{scr.screenName}</h3>
                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-indigo-400">
                    <span>View Today&apos;s Shows</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 2: SELECT MOVIE SHOWTIME
        ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Select Movie Showtime</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Published shows scheduled for {selectedScreenObj?.screenName} today
                </p>
              </div>
              {!resolveData.isScreenPreselected && (
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-indigo-400 font-semibold"
                >
                  ← Change Screen
                </button>
              )}
            </div>

            {loadingShows ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs">Loading today&apos;s shows...</p>
              </div>
            ) : shows.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
                <Film className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white">No Published Shows Today</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  There are currently no published show schedules accepting food orders for this auditorium today.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {shows.map((show) => {
                  const startTimeStr = new Date(show.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const endTimeStr = new Date(show.expectedEndTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={show.id}
                      onClick={() => handleSelectShow(show)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                        selectedShow?.id === show.id
                          ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {show.moviePosterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={show.moviePosterUrl}
                            alt={show.movieTitle}
                            className="w-14 h-20 object-cover rounded-xl border border-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-20 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                            <Film className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                show.isOrderingOpen
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {show.isOrderingOpen ? 'Ordering Open' : 'Upcoming Window'}
                            </span>
                            {show.language && (
                              <span className="text-[10px] text-slate-400">{show.language}</span>
                            )}
                          </div>

                          <h3 className="text-sm font-bold text-white truncate">
                            {show.movieTitle}
                          </h3>

                          <p className="text-xs text-indigo-300 font-semibold mt-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {startTimeStr} – {endTimeStr}
                            </span>
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 3: SELECT SEATING DETAILS (ROW & SEAT)
        ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Select Your Seat</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Food will be delivered directly to this seat during the movie
                </p>
              </div>
              <button
                onClick={() => setCurrentStep(2)}
                className="text-xs text-indigo-400 font-semibold"
              >
                ← Change Show
              </button>
            </div>

            {loadingSeating ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs">Loading seating layout...</p>
              </div>
            ) : seatingRows.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
                <Armchair className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white">No Seating Rows Configured</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  This auditorium does not have an active seating configuration in the system yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Row Selector Pills */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    1. Choose Row ({seatingRows.length} rows available)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {seatingRows.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRowId(r.id);
                          setSelectedSeat(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          selectedRowId === r.id
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>Row {r.rowIdentifier}</span>
                        <span className="text-[10px] opacity-75 capitalize">
                          ({r.seatCategory})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Seat Selector Grid */}
                {activeRow && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        2. Choose Seat Number in Row {activeRow.rowIdentifier}
                      </label>
                      <span className="text-[10px] text-indigo-400 font-semibold capitalize">
                        {activeRow.seatCategory} Tier
                      </span>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800 max-h-56 overflow-y-auto">
                      {activeRow.seats.map((seat) => {
                        const isSelected = selectedSeat?.id === seat.id;
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => setSelectedSeat(seat)}
                            className={`py-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 ring-2 ring-emerald-400'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            <span>{seat.seatIdentifier}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Destination Preview Card */}
                {selectedSeat && activeRow && (
                  <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        Confirmed Delivery Destination
                      </p>
                      <p className="text-sm font-black text-white mt-0.5">
                        {selectedScreenObj?.screenName} • Row {activeRow.rowIdentifier}, Seat {selectedSeat.seatIdentifier}
                      </p>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {selectedSeat.seatCategory} Seat Tier
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                    </span>
                  </div>
                )}

                {/* Confirm Button */}
                <button
                  type="button"
                  disabled={!selectedSeat || validatingSelection}
                  onClick={handleConfirmSeatAndAdvance}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 disabled:opacity-50"
                >
                  {validatingSelection ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UtensilsCrossed className="w-4 h-4" />
                  )}
                  Confirm Seat & Browse Concessions Menu
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 4: BROWSE FOOD MENU
        ========================================================================= */}
        {currentStep === 4 && (
          <div className="space-y-5">
            {/* Delivery Destination Tag */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Armchair className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-400 block">
                    Delivering To Your Seat
                  </span>
                  <span className="text-xs font-bold text-white">
                    {selectedScreenObj?.screenName} • Seat {selectedSeat?.seatIdentifier}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep(3)}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Change Seat
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setSelectedCatFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedCatFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All Items ({products.length})
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      selectedCatFilter === cat.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Dietary Filter */}
              <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-0.5">
                <button
                  onClick={() => setDietaryFilter('ALL')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    dietaryFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setDietaryFilter('VEG')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition flex items-center gap-1 ${
                    dietaryFilter === 'VEG' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  <Leaf className="w-3 h-3 text-emerald-400" /> Veg
                </button>
                <button
                  onClick={() => setDietaryFilter('NON_VEG')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition flex items-center gap-1 ${
                    dietaryFilter === 'NON_VEG' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400'
                  }`}
                >
                  <Beef className="w-3 h-3 text-rose-400" /> Non-Veg
                </button>
              </div>
            </div>

            {/* Products List */}
            {loadingMenu ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs">Loading concessions menu...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
                <UtensilsCrossed className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white">No Food Items Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No food or beverage items are currently available matching the chosen filter.
                </p>
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
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition"
                    >
                      <div>
                        {/* Top: Image & Badge */}
                        <div className="relative aspect-[16/10] bg-slate-950 rounded-xl overflow-hidden mb-3 border border-slate-800">
                          {prod.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <UtensilsCrossed className="w-8 h-8" />
                            </div>
                          )}

                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border backdrop-blur-md ${
                                prod.isVegetarian
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                                  : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                              }`}
                            >
                              {prod.isVegetarian ? 'Veg' : 'Non-Veg'}
                            </span>
                            {isCombo && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-950/80 text-violet-300 border border-violet-500/40 backdrop-blur-md">
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
                        <h4 className="text-sm font-bold text-white line-clamp-1">{prod.name}</h4>
                        {prod.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                            {prod.description}
                          </p>
                        )}
                      </div>

                      {/* Price & Quantity Controls */}
                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
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
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black text-white px-1">{qty}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(prod.id, 1)}
                                className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-bold text-xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddToCart(prod)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-indigo-600/30"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 5: ORDER SUMMARY & CHECKOUT (TASK 10)
        ========================================================================= */}
        {currentStep === 5 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Context Summary Header */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Cinema Order Context</h3>
                    <p className="text-[11px] text-slate-400">{theatre.name}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  + Add More Items
                </button>
              </div>

              {/* 4 Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Screen</span>
                  <span className="font-bold text-white block truncate">{selectedScreenObj?.screenName}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{selectedScreenObj?.screenType}</span>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
                  <span className="text-[10px] text-indigo-400 uppercase font-bold block">In-Auditorium Seat</span>
                  <span className="font-black text-indigo-300 block text-sm">
                    Row {currentContext?.seatRow || selectedSeat?.seatIdentifier?.charAt(0)} • Seat {selectedSeat?.seatIdentifier}
                  </span>
                  <span className="text-[10px] text-indigo-400/80">Direct Delivery Destination</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Movie Showtime</span>
                  <span className="font-bold text-white block truncate">{selectedShow?.movieTitle}</span>
                  <span className="text-[10px] text-slate-400">{selectedShow?.startTime} ({selectedShow?.showDate})</span>
                </div>
              </div>
            </div>

            {/* Itemized Order Products */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                  Ordered Products ({totalCartCount} {totalCartCount === 1 ? 'item' : 'items'})
                </span>
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-400 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear Cart
                </button>
              </div>

              <div className="divide-y divide-slate-800/80 space-y-3">
                {cartItems.map((item) => (
                  <div key={item.productId} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 relative">
                        {item.product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <UtensilsCrossed className="w-4 h-4" />
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded text-[7px] font-bold ${
                            item.product.isVegetarian
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {item.product.isVegetarian ? 'V' : 'NV'}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{item.product.name}</h4>
                        <p className="text-[11px] text-slate-400">
                          {formatPaise(item.product.price, theatre.currency)} each
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          className="w-5 h-5 text-slate-300 hover:text-white flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-white px-1">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          className="w-5 h-5 text-slate-300 hover:text-white flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-black text-white w-16 text-right font-mono">
                        {formatPaise(item.product.price * item.quantity, theatre.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Guest Details & Delivery Instructions */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-400 block">
                Guest & Usher Delivery Details (Optional)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Guest Name"
                    maxLength={100}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="Mobile number for SMS update"
                    maxLength={20}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Special Delivery Instructions for Usher
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Please deliver during intermission, extra napkins requested"
                    maxLength={200}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Authoritative Price Calculation & Tax Breakdown */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                  Authoritative Price Breakdown
                </span>
                {loadingSummary && (
                  <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verifying DB prices...
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Concessions Subtotal</span>
                  <span className="font-mono text-white">
                    {formatPaise(subtotalPaise, theatre.currency)}
                  </span>
                </div>

                {serverSummary?.taxes ? (
                  serverSummary.taxes.map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-400">
                      <span>{t.name}</span>
                      <span className="font-mono text-white">{formatPaise(t.amount, theatre.currency)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-slate-400">
                    <span>Applicable Taxes (GST 5%)</span>
                    <span className="font-mono text-white">{formatPaise(taxPaise, theatre.currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-black text-white pt-2.5 border-t border-slate-800">
                  <span>Final Total</span>
                  <span className="font-mono text-indigo-400 text-lg">
                    {formatPaise(totalCartPaise, theatre.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Task 10 Preparation Notice */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-2.5 text-xs text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Task 10 Order Preparation:</strong> Submitting prepares the concessions order in <code className="text-indigo-300 font-mono">PENDING</code> status with server-side price validation. Payment gateway connection (Razorpay/Paytm) activates in Task 11.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Menu</span>
              </button>

              <button
                type="button"
                disabled={isSubmittingOrder || cartItems.length === 0}
                onClick={handlePrepareOrder}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 disabled:opacity-50"
              >
                {isSubmittingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Concessions Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Order Details (Prepare Order)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar for Step 4 */}
      {currentStep === 4 && totalCartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Delivering to Seat {selectedSeat?.seatIdentifier}
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
                <span>View Cart</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <span>Checkout</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CinemaCartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
        cart={cartItems}
        currency={theatre.currency}
        context={currentContext}
        subtotalPaise={subtotalPaise}
        taxPaise={taxPaise}
        totalPaise={totalCartPaise}
        totalCount={totalCartCount}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={() => {
          setIsCartDrawerOpen(false);
          setCurrentStep(5);
        }}
      />

      {/* Order Prepared Modal (Task 10 Completion) */}
      <CinemaOrderPreparedModal
        isOpen={isPreparedModalOpen}
        onClose={() => {
          setIsPreparedModalOpen(false);
          setCurrentStep(4);
        }}
        order={preparedOrder}
      />
    </div>
  );
}
