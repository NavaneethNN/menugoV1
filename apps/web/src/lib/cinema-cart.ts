/**
 * MenuGo V1 - Cinema Cart Domain Logic & Local Persistence (Task 10)
 *
 * Implements pure, unit-testable cinema cart calculations, cinema order context scoping,
 * and localStorage persistence for the mobile-first customer cinema experience.
 */

export interface CinemaOrderContext {
  theatreId: string;
  theatreName: string;
  theatreCurrency: string;
  theatreToken: string;
  screenId: string;
  screenName: string;
  screenType: string;
  showId: string;
  movieTitle: string;
  moviePosterUrl?: string | null;
  showDate: string;
  startTime: string;
  expectedEndTime: string;
  seatRow: string;
  seatNumber: string;
  seatCategory?: string;
}

export interface CinemaCartProduct {
  id: string;
  name: string;
  price: number; // Integer paise (e.g. 18000 = ₹180)
  imageUrl?: string | null;
  isVegetarian: boolean;
  isAvailable: boolean;
  categoryName?: string | null;
  description?: string | null;
}

export interface CinemaCartItem {
  productId: string;
  product: CinemaCartProduct;
  quantity: number;
  notes?: string;
}

export interface CinemaCartState {
  theatreToken: string;
  context: CinemaOrderContext | null;
  items: CinemaCartItem[];
  customerName?: string;
  customerPhone?: string;
  specialInstructions?: string;
  updatedAt: number;
}

export const MAX_CINEMA_ITEM_QUANTITY = 99;
export const MAX_CINEMA_ITEM_NOTES_LENGTH = 140;

/**
 * Add product to cinema cart or increment quantity if already present.
 */
export function addCinemaProductToCart(
  cart: CinemaCartItem[],
  product: CinemaCartProduct,
  notes?: string
): CinemaCartItem[] {
  if (!product.isAvailable) {
    return cart; // Disallow adding out-of-stock items
  }

  const existingIndex = cart.findIndex((i) => i.productId === product.id);

  if (existingIndex > -1) {
    const existing = cart[existingIndex]!;
    const newQty = Math.min(existing.quantity + 1, MAX_CINEMA_ITEM_QUANTITY);
    const updated = [...cart];
    updated[existingIndex] = {
      ...existing,
      product, // Update with freshest data
      quantity: newQty,
      notes: notes !== undefined ? sanitizeNotes(notes) : existing.notes
    };
    return updated;
  }

  return [
    ...cart,
    {
      productId: product.id,
      product,
      quantity: 1,
      notes: notes ? sanitizeNotes(notes) : undefined
    }
  ];
}

/**
 * Update quantity of a cinema item by delta (+1 or -1). Removes item when quantity falls to 0.
 */
export function updateCinemaItemQuantity(
  cart: CinemaCartItem[],
  productId: string,
  delta: number
): CinemaCartItem[] {
  const existing = cart.find((i) => i.productId === productId);
  if (!existing) return cart;

  const newQty = existing.quantity + delta;
  if (newQty <= 0) {
    return cart.filter((i) => i.productId !== productId);
  }

  const cappedQty = Math.min(newQty, MAX_CINEMA_ITEM_QUANTITY);
  return cart.map((item) =>
    item.productId === productId ? { ...item, quantity: cappedQty } : item
  );
}

/**
 * Set explicit quantity for a cinema product.
 */
export function setCinemaItemQuantity(
  cart: CinemaCartItem[],
  productId: string,
  quantity: number
): CinemaCartItem[] {
  if (quantity <= 0) {
    return cart.filter((i) => i.productId !== productId);
  }

  const cappedQty = Math.min(Math.floor(quantity), MAX_CINEMA_ITEM_QUANTITY);
  return cart.map((item) =>
    item.productId === productId ? { ...item, quantity: cappedQty } : item
  );
}

/**
 * Remove an item completely from cinema cart.
 */
export function removeCinemaItemFromCart(
  cart: CinemaCartItem[],
  productId: string
): CinemaCartItem[] {
  return cart.filter((i) => i.productId !== productId);
}

/**
 * Clear all items from cinema cart.
 */
export function clearCinemaCartItems(): CinemaCartItem[] {
  return [];
}

/**
 * Update notes for an existing item in cinema cart.
 */
export function updateCinemaItemNotes(
  cart: CinemaCartItem[],
  productId: string,
  notes: string
): CinemaCartItem[] {
  return cart.map((item) =>
    item.productId === productId ? { ...item, notes: sanitizeNotes(notes) } : item
  );
}

/**
 * Sanitize item-level instructions / notes.
 */
export function sanitizeNotes(notes: string): string {
  if (!notes) return '';
  return notes.trim().slice(0, MAX_CINEMA_ITEM_NOTES_LENGTH);
}

/**
 * Calculate client-side indicative totals (subtotal, taxes, total, itemCount).
 * Authoritative calculations are always performed and verified on the backend.
 */
export function calculateIndicativeCinemaTotals(
  cart: CinemaCartItem[],
  taxRatePercent = 5
): {
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  itemCount: number;
} {
  const subtotalPaise = cart.reduce((acc, item) => {
    const price = Number.isInteger(item.product.price) ? item.product.price : 0;
    const qty = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0;
    return acc + price * qty;
  }, 0);

  const itemCount = cart.reduce((acc, item) => acc + (item.quantity > 0 ? item.quantity : 0), 0);
  const taxPaise = Math.round(subtotalPaise * (taxRatePercent / 100));
  const totalPaise = subtotalPaise + taxPaise;

  return {
    subtotalPaise,
    taxPaise,
    totalPaise,
    itemCount
  };
}

/**
 * Generate localStorage storage key scoped by theatreToken.
 */
export function getCinemaCartStorageKey(theatreToken: string): string {
  return `menugo_cinema_cart_${theatreToken.trim().toLowerCase()}`;
}

/**
 * Serialize cinema cart state to JSON for localStorage.
 */
export function serializeCinemaCart(state: CinemaCartState): string {
  return JSON.stringify({
    theatreToken: state.theatreToken,
    context: state.context,
    items: state.items.map((i) => ({
      productId: i.productId,
      product: i.product,
      quantity: i.quantity,
      notes: i.notes
    })),
    customerName: state.customerName,
    customerPhone: state.customerPhone,
    specialInstructions: state.specialInstructions,
    updatedAt: Date.now()
  });
}

/**
 * Deserialize cinema cart state from JSON with theatreToken scoping.
 */
export function deserializeCinemaCart(
  rawJson: string | null,
  expectedTheatreToken: string
): CinemaCartState | null {
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.theatreToken?.toLowerCase() !== expectedTheatreToken.toLowerCase()) {
      return null;
    }

    // Discard carts older than 24 hours
    const maxAge = 24 * 60 * 60 * 1000;
    if (parsed.updatedAt && Date.now() - parsed.updatedAt > maxAge) {
      return null;
    }

    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(
          (item: any) =>
            item &&
            item.productId &&
            item.product &&
            typeof item.quantity === 'number' &&
            item.quantity > 0
        )
      : [];

    return {
      theatreToken: parsed.theatreToken,
      context: parsed.context || null,
      items,
      customerName: parsed.customerName || undefined,
      customerPhone: parsed.customerPhone || undefined,
      specialInstructions: parsed.specialInstructions || undefined,
      updatedAt: parsed.updatedAt || Date.now()
    };
  } catch {
    return null;
  }
}
