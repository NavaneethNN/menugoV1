import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  createProductSchema,
  createOrderSchema,
  createRestaurantSchema
} from '../index';

describe('Shared Domain Logic & Schemas', () => {
  test('Currency conversion handles paise accurately without floating-point drift', () => {
    assert.equal(rupeesToPaise(180), 18000);
    assert.equal(rupeesToPaise(99.99), 9999);
    assert.equal(rupeesToPaise(0.5), 50);

    assert.equal(paiseToRupees(18000), 180);
    assert.equal(paiseToRupees(9999), 99.99);

    const formatted = formatPaise(18000, 'INR');
    assert.ok(formatted.includes('180'), `Formatted currency should contain 180, got ${formatted}`);
  });

  test('createProductSchema validates integer paise prices', () => {
    const valid = createProductSchema.safeParse({
      restaurantId: 'rest-123',
      name: 'Paneer Butter Masala',
      price: 24000, // ₹240.00
      isVegetarian: true
    });
    assert.ok(valid.success, 'Valid product in paise should parse successfully');

    const invalidFloat = createProductSchema.safeParse({
      restaurantId: 'rest-123',
      name: 'Paneer Butter Masala',
      price: 240.5, // float is invalid for integer paise
      isVegetarian: true
    });
    assert.ok(!invalidFloat.success, 'Float price should fail validation');
  });

  test('createRestaurantSchema enforces valid slug format', () => {
    const valid = createRestaurantSchema.safeParse({
      name: 'Green Delight',
      slug: 'green-delight',
      currency: 'INR'
    });
    assert.ok(valid.success);

    const invalid = createRestaurantSchema.safeParse({
      name: 'Green Delight',
      slug: 'Green Delight!',
      currency: 'INR'
    });
    assert.ok(!invalid.success);

    // Reject leading hyphen
    assert.ok(!createRestaurantSchema.safeParse({ name: 'Test', slug: '-invalid' }).success);
    // Reject trailing hyphen
    assert.ok(!createRestaurantSchema.safeParse({ name: 'Test', slug: 'invalid-' }).success);
    // Reject consecutive hyphens
    assert.ok(!createRestaurantSchema.safeParse({ name: 'Test', slug: 'in--valid' }).success);
    // Reject single char slug
    assert.ok(!createRestaurantSchema.safeParse({ name: 'Test', slug: 'a' }).success);
  });

  test('slugify utility generates valid and clean URL slugs', () => {
    const { slugify, isValidSlug } = require('../index');
    assert.equal(slugify('Café Delight & Bistro!'), 'caf-delight-bistro');
    assert.equal(slugify('  Spicy   Szechuan 99  '), 'spicy-szechuan-99');
    assert.equal(slugify('The Grand Palace - Downtown'), 'the-grand-palace-downtown');
    assert.equal(slugify('---leading-and-trailing---'), 'leading-and-trailing');

    assert.equal(isValidSlug('green-delight'), true);
    assert.equal(isValidSlug('bistro-99'), true);
    assert.equal(isValidSlug('-bad'), false);
    assert.equal(isValidSlug('bad-'), false);
    assert.equal(isValidSlug('bad--slug'), false);
    assert.equal(isValidSlug('Bad'), false);
    assert.equal(isValidSlug('a'), false);
  });

  test('createOrderSchema requires at least one order item and valid table identifier', () => {
    const valid = createOrderSchema.safeParse({
      restaurantId: 'rest-1',
      tableId: 'tab-1',
      items: [{ productId: 'prod-1', quantity: 2 }]
    });
    assert.ok(valid.success);

    const noItems = createOrderSchema.safeParse({
      restaurantId: 'rest-1',
      tableId: 'tab-1',
      items: []
    });
    assert.ok(!noItems.success);
  });
});

