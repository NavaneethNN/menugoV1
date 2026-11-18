/**
 * MenuGo V1 - Customer Cart Domain Logic & Scoping
 *
 * Implements pure, unit-testable cart calculations, restaurant & table scoping,
 * item instruction limits, and out-of-stock item reconciliation.
 */

export interface CartProduct {
  id: string;
  name: string;
  price: number; // Stored in integer paise (e.g. 24000 = ₹240)
  isVegetarian: boolean;
  isAvailable: boolean;
  imageUrl?: string | null;
  description?: string | null;
}

export interface CartItem {
  productId: string;
  product: CartProduct;
  quantity: number;
  notes?: string;
}

export interface StoredCartPayload {
  restaurantSlug: string;
  tableToken?: string | null;
  items: {
    productId: string;
    quantity: number;
    notes?: string;
  }[];
  updatedAt: number;
}

export const MAX_ITEM_QUANTITY = 99;
export const MAX_ITEM_NOTES_LENGTH = 140;

/**
 * Add an item to cart or increment quantity if already present.
 */
export function addItemToCart(
  cart: CartItem[],
  product: CartProduct,
  notes?: string
): CartItem[] {
  if (!product.isAvailable) {
    return cart; // Disallow adding unavailable items
  }

  const existingIndex = cart.findIndex((i) => i.productId === product.id);

  if (existingIndex > -1) {
    const existing = cart[existingIndex]!;
    const newQty = Math.min(existing.quantity + 1, MAX_ITEM_QUANTITY);
    const updated = [...cart];
    updated[existingIndex] = {
      ...existing,
      product, // Update with freshest product data
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
 * Update quantity of an item by delta (+1 or -1). Removes item when quantity falls to 0.
 */
export function updateItemQuantity(
  cart: CartItem[],
  productId: string,
  delta: number
): CartItem[] {
  const existing = cart.find((i) => i.productId === productId);
  if (!existing) return cart;

  const newQty = existing.quantity + delta;
  if (newQty <= 0) {
    return cart.filter((i) => i.productId !== productId);
  }

  const cappedQty = Math.min(newQty, MAX_ITEM_QUANTITY);
  return cart.map((item) =>
    item.productId === productId ? { ...item, quantity: cappedQty } : item
  );
}

/**
 * Set an explicit quantity for a product.
 */
export function setItemQuantity(
  cart: CartItem[],
  productId: string,
  quantity: number
): CartItem[] {
  if (quantity <= 0) {
    return cart.filter((i) => i.productId !== productId);
  }

  const cappedQty = Math.min(Math.floor(quantity), MAX_ITEM_QUANTITY);
  return cart.map((item) =>
    item.productId === productId ? { ...item, quantity: cappedQty } : item
  );
}

/**
 * Remove an item completely from the cart.
 */
export function removeItemFromCart(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter((i) => i.productId !== productId);
}

/**
 * Update item-level cooking instructions / notes with length limit enforcement.
 */
export function updateItemNotes(
  cart: CartItem[],
  productId: string,
  notes: string
): CartItem[] {
  const sanitized = sanitizeNotes(notes);
  return cart.map((item) =>
    item.productId === productId ? { ...item, notes: sanitized } : item
  );
}

/**
 * Sanitize notes to enforce max character limit and trim whitespace.
 */
export function sanitizeNotes(notes: string): string {
  if (!notes) return '';
  return notes.trim().slice(0, MAX_ITEM_NOTES_LENGTH);
}

/**
 * Calculate indicative subtotal and total item count.
 * NOTE: This is client-side indicative only. The backend API recalculates authoritative
 * totals from current database prices upon order submission.
 */
export function calculateCartTotals(cart: CartItem[]): {
  totalCount: number;
  indicativeSubtotalPaise: number;
} {
  return cart.reduce(
    (acc, item) => {
      const price = Number.isInteger(item.product.price) ? item.product.price : 0;
      const qty = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0;
      return {
        totalCount: acc.totalCount + qty,
        indicativeSubtotalPaise: acc.indicativeSubtotalPaise + price * qty
      };
    },
    { totalCount: 0, indicativeSubtotalPaise: 0 }
  );
}

/**
 * Reconcile cart items with current live menu products.
 * Identifies any items that have been disabled, marked unavailable, or removed from the menu.
 */
export function reconcileCartWithMenu(
  cart: CartItem[],
  menuProducts: CartProduct[]
): {
  reconciledCart: CartItem[];
  unavailableItems: CartItem[];
  hasUnavailableItems: boolean;
} {
  const productMap = new Map<string, CartProduct>();
  menuProducts.forEach((p) => productMap.set(p.id, p));

  const reconciledCart: CartItem[] = [];
  const unavailableItems: CartItem[] = [];

  for (const item of cart) {
    const liveProduct = productMap.get(item.productId);

    if (!liveProduct || !liveProduct.isAvailable) {
      // Item is no longer available or removed from menu
      unavailableItems.push({
        ...item,
        product: liveProduct || { ...item.product, isAvailable: false }
      });
      reconciledCart.push({
        ...item,
        product: liveProduct || { ...item.product, isAvailable: false }
      });
    } else {
      // Item is active and available; update with latest price/details
      reconciledCart.push({
        ...item,
        product: liveProduct
      });
    }
  }

  return {
    reconciledCart,
    unavailableItems,
    hasUnavailableItems: unavailableItems.length > 0
  };
}

/**
 * Remove all unavailable items from the cart in one action.
 */
export function removeUnavailableItems(
  cart: CartItem[],
  menuProducts: CartProduct[]
): CartItem[] {
  const availableProductIds = new Set(
    menuProducts.filter((p) => p.isAvailable).map((p) => p.id)
  );

  return cart.filter((item) => availableProductIds.has(item.productId));
}

/**
 * Validate whether the cart is ready for order submission.
 */
export function validateCartSubmission(
  cart: CartItem[],
  hasValidatedTable: boolean,
  hasUnavailableItems: boolean
): {
  isReady: boolean;
  errorReason?: string;
} {
  if (cart.length === 0) {
    return { isReady: false, errorReason: 'Your cart is empty. Please add dishes to order.' };
  }

  if (hasUnavailableItems) {
    return {
      isReady: false,
      errorReason: 'Some items in your cart are currently sold out. Please remove them to proceed.'
    };
  }

  if (!hasValidatedTable) {
    return {
      isReady: false,
      errorReason: 'Table QR code is required. Please scan your table QR code to place an order.'
    };
  }

  return { isReady: true };
}

/**
 * Storage key generator scoped by restaurant slug.
 */
export function getCartStorageKey(restaurantSlug: string): string {
  return `menugo_cart_${restaurantSlug.trim().toLowerCase()}`;
}

/**
 * Serialize cart to localStorage payload. Does NOT store sensitive data.
 */
export function serializeCartForStorage(
  restaurantSlug: string,
  tableToken: string | null | undefined,
  cart: CartItem[]
): string {
  const payload: StoredCartPayload = {
    restaurantSlug,
    tableToken: tableToken || null,
    items: cart.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      notes: i.notes
    })),
    updatedAt: Date.now()
  };
  return JSON.stringify(payload);
}

/**
 * Deserialize cart from localStorage payload with strict restaurant scoping.
 * Returns null if data is missing, expired, or belongs to a different restaurant.
 */
export function deserializeCartFromStorage(
  rawJson: string | null,
  currentRestaurantSlug: string
): { productId: string; quantity: number; notes?: string }[] | null {
  if (!rawJson) return null;

  try {
    const parsed: StoredCartPayload = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return null;

    // Strict restaurant scoping check: Do not mix products across restaurants!
    if (parsed.restaurantSlug?.toLowerCase() !== currentRestaurantSlug.toLowerCase()) {
      return null;
    }

    if (!Array.isArray(parsed.items)) return null;

    // Discard carts older than 24 hours
    const maxAge = 24 * 60 * 60 * 1000;
    if (parsed.updatedAt && Date.now() - parsed.updatedAt > maxAge) {
      return null;
    }

    return parsed.items.filter(
      (item) => item.productId && typeof item.quantity === 'number' && item.quantity > 0
    );
  } catch {
    return null;
  }
}

