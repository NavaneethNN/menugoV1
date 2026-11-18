import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rupeesToPaise, paiseToRupees, formatPaise } from '@menugo/shared';

describe('Product Management UI Logic', () => {
  test('Form validation enforces required name, non-negative price, and valid URL', () => {
    function validateProductForm(
      name: string,
      priceRupees: string,
      description?: string,
      imageUrl?: string
    ): Record<string, string> {
      const errors: Record<string, string> = {};
      const trimmedName = name.trim();

      if (!trimmedName) {
        errors.name = 'Product name is required';
      } else if (trimmedName.length > 255) {
        errors.name = 'Product name cannot exceed 255 characters';
      }

      const priceNum = parseFloat(priceRupees);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.price = 'Please enter a valid non-negative price in rupees (e.g. 150.00)';
      }

      if (description && description.length > 1000) {
        errors.description = 'Description cannot exceed 1000 characters';
      }

      if (imageUrl && imageUrl.trim()) {
        try {
          new URL(imageUrl.trim());
        } catch {
          errors.imageUrl = 'Please enter a valid URL (e.g. https://...)';
        }
      }

      return errors;
    }

    // Valid inputs
    const valid = validateProductForm(
      'Butter Chicken',
      '350.00',
      'Rich buttery curry',
      'https://cdn.example.com/dish.jpg'
    );
    assert.deepEqual(valid, {});

    // Empty name
    assert.equal(validateProductForm('   ', '100').name, 'Product name is required');

    // Negative price
    assert.ok(validateProductForm('Naan', '-50').price);

    // Invalid number price
    assert.ok(validateProductForm('Naan', 'abc').price);

    // Name exceeding 255 chars
    assert.equal(
      validateProductForm('N'.repeat(256), '100').name,
      'Product name cannot exceed 255 characters'
    );

    // Description exceeding 1000 chars
    assert.equal(
      validateProductForm('Naan', '100', 'D'.repeat(1001)).description,
      'Description cannot exceed 1000 characters'
    );

    // Malformed URL
    assert.equal(
      validateProductForm('Naan', '100', '', 'not-a-url').imageUrl,
      'Please enter a valid URL (e.g. https://...)'
    );
  });

  test('Rupees to paise conversion operates accurately for form payloads', () => {
    assert.equal(rupeesToPaise(150), 15000);
    assert.equal(rupeesToPaise(249.5), 24950);
    assert.equal(rupeesToPaise(0), 0);
    assert.equal(paiseToRupees(15000), 150);
    assert.equal(paiseToRupees(24950), 249.5);
  });

  test('Filter logic accurately slices by category, search text, and availability', () => {
    interface TestProduct {
      id: string;
      name: string;
      description: string | null;
      categoryId: string | null;
      categoryName?: string | null;
      isAvailable: boolean;
    }

    const testProducts: TestProduct[] = [
      { id: '1', name: 'Paneer Tikka', description: 'Grilled spiced cheese', categoryId: 'cat-starters', categoryName: 'Starters', isAvailable: true },
      { id: '2', name: 'Chicken Biryani', description: 'Hyderabadi dum biryani', categoryId: 'cat-mains', categoryName: 'Mains', isAvailable: true },
      { id: '3', name: 'Mutton Kebab', description: 'Tender minced lamb skewers', categoryId: 'cat-starters', categoryName: 'Starters', isAvailable: false },
      { id: '4', name: 'Special Filter Coffee', description: 'Traditional South Indian coffee', categoryId: null, categoryName: null, isAvailable: true }
    ];

    function filterProducts(
      items: TestProduct[],
      catFilter: string,
      availFilter: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE',
      search: string
    ) {
      return items.filter((p) => {
        if (catFilter !== 'ALL') {
          if (catFilter === 'UNCATEGORIZED') {
            if (p.categoryId) return false;
          } else if (p.categoryId !== catFilter) {
            return false;
          }
        }
        if (availFilter === 'AVAILABLE' && !p.isAvailable) return false;
        if (availFilter === 'UNAVAILABLE' && p.isAvailable) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const match =
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.categoryName?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
    }

    // Filter by Category 'cat-starters'
    const starters = filterProducts(testProducts, 'cat-starters', 'ALL', '');
    assert.equal(starters.length, 2);

    // Filter by Uncategorized
    const uncategorized = filterProducts(testProducts, 'UNCATEGORIZED', 'ALL', '');
    assert.equal(uncategorized.length, 1);
    assert.equal(uncategorized[0]!.id, '4');

    // Filter by Availability: AVAILABLE
    const inStock = filterProducts(testProducts, 'ALL', 'AVAILABLE', '');
    assert.equal(inStock.length, 3);

    // Filter by Availability: UNAVAILABLE
    const soldOut = filterProducts(testProducts, 'ALL', 'UNAVAILABLE', '');
    assert.equal(soldOut.length, 1);
    assert.equal(soldOut[0]!.id, '3');

    // Search by keyword in description
    const searched = filterProducts(testProducts, 'ALL', 'ALL', 'biryani');
    assert.equal(searched.length, 1);
    assert.equal(searched[0]!.id, '2');
  });

  test('Product list swap reordering computes correct sequential sort orders', () => {
    function reorderList<T extends { id: string; sortOrder: number }>(
      items: T[],
      index: number,
      direction: 'up' | 'down'
    ): T[] | null {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return null;

      const newItems = [...items];
      const target = newItems[targetIndex];
      const current = newItems[index];
      if (!target || !current) return null;

      newItems[index] = target;
      newItems[targetIndex] = current;

      return newItems.map((item, idx) => ({
        ...item,
        sortOrder: idx
      }));
    }

    const initial = [
      { id: 'p1', sortOrder: 0 },
      { id: 'p2', sortOrder: 1 },
      { id: 'p3', sortOrder: 2 }
    ];

    // Move p2 up to index 0
    const movedUp = reorderList(initial, 1, 'up');
    assert.ok(movedUp);
    assert.equal(movedUp[0]!.id, 'p2');
    assert.equal(movedUp[0]!.sortOrder, 0);
    assert.equal(movedUp[1]!.id, 'p1');
    assert.equal(movedUp[1]!.sortOrder, 1);

    // Boundary check
    assert.equal(reorderList(initial, 0, 'up'), null);
    assert.equal(reorderList(initial, 2, 'down'), null);
  });
});

