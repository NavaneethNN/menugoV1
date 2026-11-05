import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItemToCart,
  updateItemQuantity,
  setItemQuantity,
  removeItemFromCart,
  updateItemNotes,
  sanitizeNotes,
  calculateCartTotals,
  reconcileCartWithMenu,
  removeUnavailableItems,
  validateCartSubmission,
  serializeCartForStorage,
  deserializeCartFromStorage,
  MAX_ITEM_QUANTITY,
  MAX_ITEM_NOTES_LENGTH,
  CartItem,
  CartProduct
} from '../lib/cart';

describe('Customer Cart Domain Logic & Scoping (Task 11)', () => {
  const sampleProduct1: CartProduct = {
    id: 'prod-1',
    name: 'Paneer Butter Masala',
    price: 26000, // ₹260
    isVegetarian: true,
    isAvailable: true
  };

  const sampleProduct2: CartProduct = {
    id: 'prod-2',
    name: 'Garlic Naan',
    price: 6000, // ₹60
    isVegetarian: true,
    isAvailable: true
  };

  const unavailableProduct: CartProduct = {
    id: 'prod-3',
    name: 'Seasonal Mango Kulfi',
    price: 15000, // ₹150
    isVegetarian: true,
    isAvailable: false // Unavailable item
  };

  // -------------------------------------------------------------------------
  // 1. Add / Remove & Quantity Changes
  // -------------------------------------------------------------------------
  test('addItemToCart adds new product with default quantity 1', () => {
    const initial: CartItem[] = [];
    const updated = addItemToCart(initial, sampleProduct1);

    assert.equal(updated.length, 1);
    assert.equal(updated[0]!.productId, 'prod-1');
    assert.equal(updated[0]!.quantity, 1);
    assert.equal(updated[0]!.product.name, 'Paneer Butter Masala');
  });

  test('addItemToCart increments quantity if product already exists', () => {
    let cart = addItemToCart([], sampleProduct1);
    cart = addItemToCart(cart, sampleProduct1);
    cart = addItemToCart(cart, sampleProduct1);

    assert.equal(cart.length, 1);
    assert.equal(cart[0]!.quantity, 3);
  });

  test('addItemToCart rejects items marked as unavailable', () => {
    const cart = addItemToCart([], unavailableProduct);
    assert.equal(cart.length, 0, 'Unavailable product must not be added to cart');
  });

  test('updateItemQuantity increments and decrements quantity correctly', () => {
    let cart = addItemToCart([], sampleProduct1);
    // +1
    cart = updateItemQuantity(cart, 'prod-1', 1);
    assert.equal(cart[0]!.quantity, 2);

    // -1
    cart = updateItemQuantity(cart, 'prod-1', -1);
    assert.equal(cart[0]!.quantity, 1);
  });

  test('updateItemQuantity removes item when quantity reaches zero', () => {
    let cart = addItemToCart([], sampleProduct1);
    cart = updateItemQuantity(cart, 'prod-1', -1);

    assert.equal(cart.length, 0);
  });

  test('setItemQuantity updates explicit quantity and removes on zero', () => {
    let cart = addItemToCart([], sampleProduct1);
    cart = setItemQuantity(cart, 'prod-1', 5);
    assert.equal(cart[0]!.quantity, 5);

    // Caps at MAX_ITEM_QUANTITY
    cart = setItemQuantity(cart, 'prod-1', 200);
    assert.equal(cart[0]!.quantity, MAX_ITEM_QUANTITY);

    // Removes on 0
    cart = setItemQuantity(cart, 'prod-1', 0);
    assert.equal(cart.length, 0);
  });

  test('removeItemFromCart removes target item without mutating other items', () => {
    let cart = addItemToCart([], sampleProduct1);
    cart = addItemToCart(cart, sampleProduct2);
    assert.equal(cart.length, 2);

    cart = removeItemFromCart(cart, 'prod-1');
    assert.equal(cart.length, 1);
    assert.equal(cart[0]!.productId, 'prod-2');
  });

  // -------------------------------------------------------------------------
  // 2. Item-Level Instructions / Notes
  // -------------------------------------------------------------------------
  test('updateItemNotes sets and sanitizes item instructions with character limits', () => {
    let cart = addItemToCart([], sampleProduct1);
    cart = updateItemNotes(cart, 'prod-1', '  Make it less spicy and extra gravy  ');

    assert.equal(cart[0]!.notes, 'Make it less spicy and extra gravy');

    // Enforces max length (140 characters)
    const longNote = 'A'.repeat(200);
    cart = updateItemNotes(cart, 'prod-1', longNote);
    assert.equal(cart[0]!.notes?.length, MAX_ITEM_NOTES_LENGTH);
    assert.equal(cart[0]!.notes, 'A'.repeat(MAX_ITEM_NOTES_LENGTH));
  });

  test('sanitizeNotes handles empty and whitespace-only notes', () => {
    assert.equal(sanitizeNotes(''), '');
    assert.equal(sanitizeNotes('   '), '');
    assert.equal(sanitizeNotes(null as any), '');
  });

  // -------------------------------------------------------------------------
  // 3. Indicative Cart Calculations (Integer Paise)
  // -------------------------------------------------------------------------
  test('calculateCartTotals computes totalCount and subtotal in integer paise accurately', () => {
    let cart = addItemToCart([], sampleProduct1); // 1 x 26000 = 26000
    cart = addItemToCart(cart, sampleProduct1); // 2 x 26000 = 52000
    cart = addItemToCart(cart, sampleProduct2); // 1 x 6000  = 6000
    cart = updateItemQuantity(cart, 'prod-2', 2); // 3 x 6000 = 18000

    const totals = calculateCartTotals(cart);
    assert.equal(totals.totalCount, 5); // 2 + 3
    assert.equal(totals.indicativeSubtotalPaise, 70000); // 52000 + 18000 = ₹700 (70000 paise)
  });

  test('calculateCartTotals returns zero for empty cart', () => {
    const totals = calculateCartTotals([]);
    assert.equal(totals.totalCount, 0);
    assert.equal(totals.indicativeSubtotalPaise, 0);
  });

  // -------------------------------------------------------------------------
  // 4. Out-of-Stock Reconciliation
  // -------------------------------------------------------------------------
  test('reconcileCartWithMenu identifies items that became unavailable while menu was open', () => {
    // Customer has sampleProduct1 and sampleProduct2 in cart
    let cart = addItemToCart([], sampleProduct1);
    cart = addItemToCart(cart, sampleProduct2);

    // Live menu updates: sampleProduct1 is now out of stock (isAvailable: false)
    const updatedMenu: CartProduct[] = [
      { ...sampleProduct1, isAvailable: false },
      sampleProduct2
    ];

    const { unavailableItems, hasUnavailableItems } = reconcileCartWithMenu(cart, updatedMenu);
    assert.equal(hasUnavailableItems, true);
    assert.equal(unavailableItems.length, 1);
    assert.equal(unavailableItems[0]!.productId, 'prod-1');
  });

  test('removeUnavailableItems purges only unavailable items', () => {
    let cart = addItemToCart([], sampleProduct1);
    cart = addItemToCart(cart, sampleProduct2);

    const updatedMenu: CartProduct[] = [
      { ...sampleProduct1, isAvailable: false },
      sampleProduct2
    ];

    const cleaned = removeUnavailableItems(cart, updatedMenu);
    assert.equal(cleaned.length, 1);
    assert.equal(cleaned[0]!.productId, 'prod-2');
  });

  // -------------------------------------------------------------------------
  // 5. Submission Readiness & Scoping
  // -------------------------------------------------------------------------
  test('validateCartSubmission checks all required conditions', () => {
    const validCart = addItemToCart([], sampleProduct1);

    // Empty cart fails
    assert.equal(validateCartSubmission([], true, false).isReady, false);

    // Missing table fails
    assert.equal(validateCartSubmission(validCart, false, false).isReady, false);

    // Having unavailable items fails
    assert.equal(validateCartSubmission(validCart, true, true).isReady, false);

    // Valid table + active items succeeds
    assert.equal(validateCartSubmission(validCart, true, false).isReady, true);
  });

  // -------------------------------------------------------------------------
  // 6. Restaurant Scoping & Safe Local Storage Persistence
  // -------------------------------------------------------------------------
  test('Cart serialization and deserialization preserves items strictly scoped by restaurant', () => {
    const cart = addItemToCart([], sampleProduct1);
    const serialized = serializeCartForStorage('spice-bistro', 'token-123', cart);

    // Deserializing for matching restaurant succeeds
    const matching = deserializeCartFromStorage(serialized, 'spice-bistro');
    assert.ok(matching);
    assert.equal(matching!.length, 1);
    assert.equal(matching![0]!.productId, 'prod-1');

    // Deserializing for different restaurant returns null (strictly isolated!)
    const crossRestaurant = deserializeCartFromStorage(serialized, 'other-burger-bar');
    assert.equal(
      crossRestaurant,
      null,
      'Cart from Restaurant A must never be read by Restaurant B'
    );
  });

  test('deserializeCartFromStorage rejects malformed or corrupted JSON', () => {
    assert.equal(deserializeCartFromStorage('not-json', 'spice-bistro'), null);
    assert.equal(deserializeCartFromStorage('{}', 'spice-bistro'), null);
    assert.equal(deserializeCartFromStorage(null, 'spice-bistro'), null);
  });
});

