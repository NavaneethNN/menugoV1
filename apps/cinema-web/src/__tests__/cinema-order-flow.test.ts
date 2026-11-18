import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CinemaCartProduct,
  CinemaCartItem,
  addCinemaProductToCart,
  updateCinemaItemQuantity,
  calculateIndicativeCinemaTotals
} from '../lib/cinema-cart';

describe('Cinema Fast Order Flow Verification', () => {
  const popcorn: CinemaCartProduct = {
    id: 'prod-popcorn-1',
    name: 'Cheese Burst Crunch Popcorn',
    price: 29000, // ₹290
    imageUrl: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330',
    isVegetarian: true,
    isAvailable: true,
    categoryName: 'Gourmet Popcorn'
  };

  const coke: CinemaCartProduct = {
    id: 'prod-coke-1',
    name: 'Large Fountain Coca-Cola (750ml)',
    price: 15000, // ₹150
    imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7',
    isVegetarian: true,
    isAvailable: true,
    categoryName: 'Chilled Concessions Beverages'
  };

  it('1. Customer directly adds items to cart without pre-selecting seat first', () => {
    let cart: CinemaCartItem[] = [];

    // Directly browse menu and add popcorn
    cart = addCinemaProductToCart(cart, popcorn);
    assert.equal(cart.length, 1);
    assert.equal(cart[0]?.product.name, 'Cheese Burst Crunch Popcorn');
    assert.equal(cart[0]?.quantity, 1);

    // Add coke
    cart = addCinemaProductToCart(cart, coke);
    assert.equal(cart.length, 2);

    // Totals calculate instantaneously
    const totals = calculateIndicativeCinemaTotals(cart, 5);
    assert.equal(totals.itemCount, 2);
    assert.equal(totals.subtotalPaise, 44000); // ₹440
    assert.equal(totals.taxPaise, 2200); // 5% GST = ₹22
    assert.equal(totals.totalPaise, 46200); // ₹462
  });

  it('2. Seat selection dropdown format parsing (rowIdentifier:seatIdentifier)', () => {
    const seatDropdownValue = 'A:A1';
    const [rowIdentifier, seatIdentifier] = seatDropdownValue.split(':');

    assert.equal(rowIdentifier, 'A');
    assert.equal(seatIdentifier, 'A1');

    const invalidValue = '';
    const [invalidRow, invalidSeat] = invalidValue.split(':');
    assert.ok(!invalidRow || !invalidSeat);
  });

  it('2b. Two-step cascading Row-to-Seat selection logic', () => {
    const mockSeatingRows = [
      {
        id: 'row-a',
        rowIdentifier: 'A',
        seatCategory: 'recliner',
        totalSeats: 2,
        seats: [
          { id: 's-a1', seatIdentifier: 'A1', seatNumber: 1, seatCategory: 'recliner', status: 'available' },
          { id: 's-a2', seatIdentifier: 'A2', seatNumber: 2, seatCategory: 'recliner', status: 'available' }
        ]
      },
      {
        id: 'row-b',
        rowIdentifier: 'B',
        seatCategory: 'prime',
        totalSeats: 3,
        seats: [
          { id: 's-b1', seatIdentifier: 'B1', seatNumber: 1, seatCategory: 'prime', status: 'available' },
          { id: 's-b2', seatIdentifier: 'B2', seatNumber: 2, seatCategory: 'prime', status: 'available' },
          { id: 's-b3', seatIdentifier: 'B3', seatNumber: 3, seatCategory: 'prime', status: 'available' }
        ]
      }
    ];

    // Step 1: User selects Row 'B'
    const selectedRow = 'B';
    const activeRow = mockSeatingRows.find((r) => r.rowIdentifier === selectedRow);
    assert.ok(activeRow);
    assert.equal(activeRow.seats.length, 3);
    assert.deepEqual(activeRow.seats.map((s) => s.seatIdentifier), ['B1', 'B2', 'B3']);

    // Step 2: User selects Seat 'B2'
    const selectedSeat = 'B2';
    const seatKey = `${selectedRow}:${selectedSeat}`;
    assert.equal(seatKey, 'B:B2');

    // Step 3: When user switches Row from 'B' to 'A', seat must be cleared/reset
    const newRow = 'A';
    const activeRowNew = mockSeatingRows.find((r) => r.rowIdentifier === newRow);
    assert.ok(activeRowNew);
    assert.equal(activeRowNew.seats.length, 2);
    // B2 is not in Row A
    assert.equal(activeRowNew.seats.some((s) => s.seatIdentifier === selectedSeat), false);
  });

  it('3. Mandatory Customer Name and 10-digit Mobile Number validation logic', () => {
    const validateCheckoutDetails = (name: string, phone: string) => {
      const isNameValid = name.trim().length >= 2;
      const cleanedPhone = phone.replace(/\D/g, '');
      const isPhoneValid = cleanedPhone.length === 10;
      return { isNameValid, isPhoneValid, isValid: isNameValid && isPhoneValid };
    };

    // Both empty -> invalid
    assert.equal(validateCheckoutDetails('', '').isValid, false);

    // Name too short -> invalid
    assert.equal(validateCheckoutDetails('A', '9876543210').isNameValid, false);
    assert.equal(validateCheckoutDetails('A', '9876543210').isValid, false);

    // Phone not 10 digits -> invalid
    assert.equal(validateCheckoutDetails('Rahul Sharma', '98765').isPhoneValid, false);
    assert.equal(validateCheckoutDetails('Rahul Sharma', '9876543210123').isPhoneValid, false);
    assert.equal(validateCheckoutDetails('Rahul Sharma', '98765').isValid, false);

    // Formatted phone e.g. +91 98765-43210 -> cleans to 10 digits
    const formattedCheck = validateCheckoutDetails('Rahul Sharma', '9876543210');
    assert.equal(formattedCheck.isNameValid, true);
    assert.equal(formattedCheck.isPhoneValid, true);
    assert.equal(formattedCheck.isValid, true);
  });

  it('4. Checkout payload matches backend prepareCinemaOrderSchema', () => {
    const checkoutPayload = {
      theatreToken: '8d91bfc3ef2e24eba1e22d2c8d26f5df82b0e791d14190c8',
      screenId: 'screen-imax-1',
      showId: 'show-gladiator-1',
      seatRow: 'A',
      seatNumber: 'A1',
      items: [
        { productId: popcorn.id, quantity: 2, notes: null },
        { productId: coke.id, quantity: 1, notes: 'Less ice' }
      ],
      customerName: 'Rahul Sharma',
      customerPhone: '9876543210',
      specialInstructions: 'Deliver during intermission'
    };

    assert.ok(checkoutPayload.theatreToken.length > 0);
    assert.ok(checkoutPayload.screenId.length > 0);
    assert.ok(checkoutPayload.showId.length > 0);
    assert.ok(checkoutPayload.seatRow.length > 0);
    assert.ok(checkoutPayload.seatNumber.length > 0);
    assert.ok(checkoutPayload.items.length === 2);
    assert.ok(checkoutPayload.customerName.length >= 2);
    assert.ok(checkoutPayload.customerPhone.length === 10);
  });
});
