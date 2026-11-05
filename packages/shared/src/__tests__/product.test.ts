import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProductSchema,
  updateProductSchema,
  reorderProductsSchema,
  rupeesToPaise,
  paiseToRupees,
  formatPaise
} from '../index';

describe('Product Domain Schemas, Rules & Price Conversion', () => {
  test('Currency conversion handles paise accurately without floating point drift', () => {
    // 150.50 rupees = 15050 paise
    assert.equal(rupeesToPaise(150.5), 15050);
    assert.equal(rupeesToPaise(19.99), 1999);
    assert.equal(rupeesToPaise(0), 0);
    assert.equal(rupeesToPaise(999.0), 99900);

    // paiseToRupees
    assert.equal(paiseToRupees(15050), 150.5);
    assert.equal(paiseToRupees(1999), 19.99);
    assert.equal(paiseToRupees(0), 0);

    // formatPaise
    const formatted = formatPaise(25000);
    assert.ok(formatted.includes('250'), 'Formatted string should contain 250');
  });

  test('createProductSchema validates integer paise and rejects malformed/floating point values', () => {
    // Valid product with integer paise price
    const valid = createProductSchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: 'Paneer Butter Masala',
      price: 24000, // ₹240.00
      categoryId: 'cat-1',
      description: 'Cottage cheese in rich tomato butter gravy',
      isVegetarian: true,
      isAvailable: true
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.price, 24000);
      assert.equal(valid.data.isVegetarian, true);
      assert.equal(valid.data.isAvailable, true);
      assert.equal(valid.data.sortOrder, 0); // default sortOrder
    }

    // Zero paise is valid (e.g. complimentary item)
    const zeroPrice = createProductSchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: 'Complimentary Chutney',
      price: 0
    });
    assert.equal(zeroPrice.success, true);

    // Floating point price in paise is REJECTED (strict integer rule)
    const floatPrice = createProductSchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: 'Float Item',
      price: 240.5
    });
    assert.equal(floatPrice.success, false);
    if (!floatPrice.success) {
      assert.ok(
        floatPrice.error.issues.some((i) => i.message.includes('integer number of paise'))
      );
    }

    // Negative price is REJECTED
    const negativePrice = createProductSchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: 'Negative Item',
      price: -500
    });
    assert.equal(negativePrice.success, false);

    // Missing price is REJECTED
    const missingPrice = createProductSchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: 'No Price Item'
    });
    assert.equal(missingPrice.success, false);
  });

  test('createProductSchema enforces name length and optional category/image references', () => {
    // Leading/trailing whitespace trimmed
    const trimmed = createProductSchema.safeParse({
      restaurantId: 'rest-1',
      name: '   Crispy Masala Dosa   ',
      price: 12000
    });
    assert.equal(trimmed.success, true);
    if (trimmed.success) {
      assert.equal(trimmed.data.name, 'Crispy Masala Dosa');
    }

    // Empty name fails
    const emptyName = createProductSchema.safeParse({
      restaurantId: 'rest-1',
      name: '   ',
      price: 12000
    });
    assert.equal(emptyName.success, false);

    // Name > 255 chars fails
    const longName = createProductSchema.safeParse({
      restaurantId: 'rest-1',
      name: 'D'.repeat(256),
      price: 12000
    });
    assert.equal(longName.success, false);

    // CategoryId can be empty string or null
    const emptyCat = createProductSchema.safeParse({
      restaurantId: 'rest-1',
      name: 'Uncategorized Dish',
      price: 10000,
      categoryId: ''
    });
    assert.equal(emptyCat.success, true);

    // Invalid image URL fails
    const invalidUrl = createProductSchema.safeParse({
      restaurantId: 'rest-1',
      name: 'Dish with bad image',
      price: 10000,
      imageUrl: 'not-a-valid-url'
    });
    assert.equal(invalidUrl.success, false);

    // Valid image URL passes
    const validUrl = createProductSchema.safeParse({
      restaurantId: 'rest-1',
      name: 'Dish with valid image',
      price: 10000,
      imageUrl: 'https://cdn.example.com/images/dosa.jpg'
    });
    assert.equal(validUrl.success, true);
  });

  test('updateProductSchema allows partial updates without restaurantId', () => {
    const update = updateProductSchema.safeParse({
      name: 'Updated Dosa Name',
      price: 13500,
      isAvailable: false
    });
    assert.equal(update.success, true);
    if (update.success) {
      assert.equal(update.data.price, 13500);
      assert.equal(update.data.isAvailable, false);
    }

    // Partial update rejecting float price
    const invalidUpdate = updateProductSchema.safeParse({
      price: 199.99
    });
    assert.equal(invalidUpdate.success, false);
  });

  test('reorderProductsSchema validates sequential reorder payloads', () => {
    const validReorder = reorderProductsSchema.safeParse({
      items: [
        { id: 'prod-1', sortOrder: 0 },
        { id: 'prod-2', sortOrder: 1 },
        { id: 'prod-3', sortOrder: 2 }
      ]
    });
    assert.equal(validReorder.success, true);

    // Empty items array fails
    const emptyReorder = reorderProductsSchema.safeParse({
      items: []
    });
    assert.equal(emptyReorder.success, false);

    // Negative sort order fails
    const negativeReorder = reorderProductsSchema.safeParse({
      items: [{ id: 'prod-1', sortOrder: -1 }]
    });
    assert.equal(negativeReorder.success, false);
  });
});

