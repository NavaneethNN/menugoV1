import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema
} from '../index';

describe('Category Domain Schemas & Rules', () => {
  test('createCategorySchema requires restaurantId and non-empty name', () => {
    // Valid category
    const valid = createCategorySchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: 'Starters',
      description: 'Appetizers and quick bites',
      sortOrder: 0,
      isActive: true
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.name, 'Starters');
    }

    // Name with leading/trailing whitespace is trimmed
    const trimmed = createCategorySchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: '  Main Course  '
    });
    assert.equal(trimmed.success, true);
    if (trimmed.success) {
      assert.equal(trimmed.data.name, 'Main Course');
    }

    // Empty name fails
    const emptyName = createCategorySchema.safeParse({
      restaurantId: 'rest-uuid-1',
      name: '   '
    });
    assert.equal(emptyName.success, false);

    // Missing restaurantId fails
    const missingRest = createCategorySchema.safeParse({
      name: 'Desserts'
    });
    assert.equal(missingRest.success, false);
  });

  test('createCategorySchema enforces length limits and non-negative sortOrder', () => {
    // Name > 100 chars fails
    const longName = createCategorySchema.safeParse({
      restaurantId: 'rest-1',
      name: 'A'.repeat(101)
    });
    assert.equal(longName.success, false);

    // Description > 500 chars fails
    const longDesc = createCategorySchema.safeParse({
      restaurantId: 'rest-1',
      name: 'Beverages',
      description: 'D'.repeat(501)
    });
    assert.equal(longDesc.success, false);

    // Negative sort order fails
    const negativeSort = createCategorySchema.safeParse({
      restaurantId: 'rest-1',
      name: 'Beverages',
      sortOrder: -1
    });
    assert.equal(negativeSort.success, false);
  });

  test('updateCategorySchema permits partial updates without restaurantId', () => {
    // Update name only
    const nameOnly = updateCategorySchema.safeParse({
      name: 'Updated Appetizers'
    });
    assert.equal(nameOnly.success, true);

    // Toggle active only
    const toggleOnly = updateCategorySchema.safeParse({
      isActive: false
    });
    assert.equal(toggleOnly.success, true);

    // Empty payload is valid partial
    const empty = updateCategorySchema.safeParse({});
    assert.equal(empty.success, true);
  });

  test('reorderCategoriesSchema validates sequential reorder payloads', () => {
    // Valid reorder
    const valid = reorderCategoriesSchema.safeParse({
      items: [
        { id: 'cat-1', sortOrder: 0 },
        { id: 'cat-2', sortOrder: 1 },
        { id: 'cat-3', sortOrder: 2 }
      ]
    });
    assert.equal(valid.success, true);

    // Empty items array fails
    const empty = reorderCategoriesSchema.safeParse({
      items: []
    });
    assert.equal(empty.success, false);

    // Negative sort order fails
    const negative = reorderCategoriesSchema.safeParse({
      items: [{ id: 'cat-1', sortOrder: -2 }]
    });
    assert.equal(negative.success, false);
  });
});

