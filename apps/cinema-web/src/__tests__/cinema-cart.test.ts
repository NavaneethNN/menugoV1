import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CinemaCartProduct,
  CinemaCartItem,
  addCinemaProductToCart,
  updateCinemaItemQuantity,
  setCinemaItemQuantity,
  removeCinemaItemFromCart,
  clearCinemaCartItems,
  calculateIndicativeCinemaTotals,
  getCinemaCartStorageKey,
  serializeCinemaCart,
  deserializeCinemaCart,
  MAX_CINEMA_ITEM_QUANTITY
} from '../lib/cinema-cart';

describe('Task 10: Cinema Cart Domain Logic & Scoping', () => {
  const popcorn: CinemaCartProduct = {
    id: 'prod-popcorn-1',
    name: 'Large Salted Popcorn',
    price: 24000, // ₹240
    imageUrl: 'https://cdn.menugo.in/popcorn.jpg',
    isVegetarian: true,
    isAvailable: true,
    categoryName: 'Popcorn'
  };

  const coke: CinemaCartProduct = {
    id: 'prod-coke-1',
    name: 'Chilled Coke (650ml)',
    price: 12000, // ₹120
    imageUrl: 'https://cdn.menugo.in/coke.jpg',
    isVegetarian: true,
    isAvailable: true,
    categoryName: 'Beverages'
  };

  const soldOutNachos: CinemaCartProduct = {
    id: 'prod-nachos-soldout',
    name: 'Cheese Nachos Combo',
    price: 32000,
    imageUrl: null,
    isVegetarian: true,
    isAvailable: false,
    categoryName: 'Combos'
  };

  it('1. Adds products to cart and increments quantity on repeat add', () => {
    let cart: CinemaCartItem[] = [];

    // Add first item
    cart = addCinemaProductToCart(cart, popcorn, 'Extra butter');
    assert.equal(cart.length, 1);
    assert.equal(cart[0]?.productId, 'prod-popcorn-1');
    assert.equal(cart[0]?.quantity, 1);
    assert.equal(cart[0]?.notes, 'Extra butter');

    // Add second distinct item
    cart = addCinemaProductToCart(cart, coke);
    assert.equal(cart.length, 2);
    assert.equal(cart[1]?.productId, 'prod-coke-1');
    assert.equal(cart[1]?.quantity, 1);

    // Repeat add popcorn -> quantity increments to 2
    cart = addCinemaProductToCart(cart, popcorn);
    assert.equal(cart.length, 2);
    assert.equal(cart[0]?.quantity, 2);
  });

  it('2. Disallows adding unavailable or sold out products', () => {
    let cart: CinemaCartItem[] = [];
    cart = addCinemaProductToCart(cart, soldOutNachos);
    assert.equal(cart.length, 0, 'Unavailable product should not be added to cart');
  });

  it('3. Quantity updates: increases, decreases, caps at 99, and removes when <= 0', () => {
    let cart: CinemaCartItem[] = [
      { productId: popcorn.id, product: popcorn, quantity: 2 },
      { productId: coke.id, product: coke, quantity: 1 }
    ];

    // Decrement popcorn
    cart = updateCinemaItemQuantity(cart, popcorn.id, -1);
    assert.equal(cart.find((i) => i.productId === popcorn.id)?.quantity, 1);

    // Decrement coke to 0 -> should remove coke completely
    cart = updateCinemaItemQuantity(cart, coke.id, -1);
    assert.equal(cart.length, 1);
    assert.equal(cart.find((i) => i.productId === coke.id), undefined);

    // Cap at MAX_CINEMA_ITEM_QUANTITY (99)
    cart = setCinemaItemQuantity(cart, popcorn.id, 150);
    assert.equal(cart.find((i) => i.productId === popcorn.id)?.quantity, MAX_CINEMA_ITEM_QUANTITY);
  });

  it('4. Removes products and clears cart completely', () => {
    let cart: CinemaCartItem[] = [
      { productId: popcorn.id, product: popcorn, quantity: 2 },
      { productId: coke.id, product: coke, quantity: 1 }
    ];

    cart = removeCinemaItemFromCart(cart, popcorn.id);
    assert.equal(cart.length, 1);
    assert.equal(cart[0]?.productId, coke.id);

    cart = clearCinemaCartItems();
    assert.equal(cart.length, 0);
  });

  it('5. Indicative price calculation calculates subtotals, 5% GST taxes and totals', () => {
    const cart: CinemaCartItem[] = [
      { productId: popcorn.id, product: popcorn, quantity: 2 }, // 2 * 24000 = 48000 paise (₹480)
      { productId: coke.id, product: coke, quantity: 1 } // 1 * 12000 = 12000 paise (₹120)
    ];

    const totals = calculateIndicativeCinemaTotals(cart, 5); // 5% GST
    assert.equal(totals.itemCount, 3);
    assert.equal(totals.subtotalPaise, 60000); // ₹600.00
    assert.equal(totals.taxPaise, 3000); // 5% of 60000 = 3000 paise (₹30.00)
    assert.equal(totals.totalPaise, 63000); // ₹630.00
  });

  it('6. LocalStorage serialization and strict theatre token scoping', () => {
    const theatreToken = 'theatre-pvr-koramangala-token-123';
    const storageKey = getCinemaCartStorageKey(theatreToken);
    assert.equal(storageKey, 'menugo_cinema_cart_theatre-pvr-koramangala-token-123');

    const state = {
      theatreToken,
      context: {
        theatreId: 'th-1',
        theatreName: 'PVR Nexus Mall',
        theatreCurrency: 'INR',
        theatreToken,
        screenId: 'scr-1',
        screenName: 'Screen 1 (IMAX)',
        screenType: 'imax',
        showId: 'sh-1',
        movieTitle: 'Inception',
        showDate: '2026-11-14',
        startTime: '18:30',
        expectedEndTime: '21:00',
        seatRow: 'F',
        seatNumber: 'F12'
      },
      items: [{ productId: popcorn.id, product: popcorn, quantity: 2 }],
      customerName: 'Aarav Patel',
      customerPhone: '9876543210',
      specialInstructions: 'Deliver during intermission',
      updatedAt: Date.now()
    };

    const serialized = serializeCinemaCart(state);
    assert.ok(serialized.includes('prod-popcorn-1'));
    assert.ok(serialized.includes('Aarav Patel'));

    // Deserializing with matching theatre token succeeds
    const restored = deserializeCinemaCart(serialized, theatreToken);
    assert.ok(restored);
    assert.equal(restored.items.length, 1);
    assert.equal(restored.items[0]?.productId, popcorn.id);
    assert.equal(restored.context?.seatNumber, 'F12');
    assert.equal(restored.customerName, 'Aarav Patel');

    // Deserializing with cross-theatre token is strictly rejected (scoping protection)
    const crossTheatre = deserializeCinemaCart(serialized, 'different-theatre-token');
    assert.equal(crossTheatre, null, 'Carts must never bleed across different theatres');
  });
});
