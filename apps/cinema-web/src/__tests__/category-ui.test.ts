import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Category Management UI Logic', () => {
  test('Form validation enforces required name and maximum length', () => {
    function validateCategoryForm(name: string, description: string): Record<string, string> {
      const errors: Record<string, string> = {};
      const trimmed = name.trim();
      if (!trimmed) {
        errors.name = 'Category name is required';
      } else if (trimmed.length > 100) {
        errors.name = 'Category name cannot exceed 100 characters';
      }

      if (description && description.length > 500) {
        errors.description = 'Description cannot exceed 500 characters';
      }

      return errors;
    }

    // Valid inputs
    assert.deepEqual(validateCategoryForm('Appetizers', 'Delicious snacks'), {});

    // Empty name
    assert.equal(validateCategoryForm('   ', '').name, 'Category name is required');

    // Name over 100 chars
    assert.equal(validateCategoryForm('A'.repeat(101), '').name, 'Category name cannot exceed 100 characters');

    // Description over 500 chars
    assert.equal(validateCategoryForm('Beverages', 'D'.repeat(501)).description, 'Description cannot exceed 500 characters');
  });

  test('Category list swap reordering computes correct sequential sort orders', () => {
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

    const initialCategories = [
      { id: 'cat-1', name: 'Starters', sortOrder: 0 },
      { id: 'cat-2', name: 'Mains', sortOrder: 1 },
      { id: 'cat-3', name: 'Desserts', sortOrder: 2 }
    ];

    // Move 'Mains' (index 1) UP
    const movedUp = reorderList(initialCategories, 1, 'up');
    assert.ok(movedUp);
    assert.equal(movedUp[0]!.id, 'cat-2');
    assert.equal(movedUp[0]!.sortOrder, 0);
    assert.equal(movedUp[1]!.id, 'cat-1');
    assert.equal(movedUp[1]!.sortOrder, 1);
    assert.equal(movedUp[2]!.id, 'cat-3');
    assert.equal(movedUp[2]!.sortOrder, 2);

    // Boundary checks: Move first item up -> returns null
    assert.equal(reorderList(initialCategories, 0, 'up'), null);

    // Boundary checks: Move last item down -> returns null
    assert.equal(reorderList(initialCategories, 2, 'down'), null);
  });

  test('Next sort order calculator assigns sequential next index', () => {
    function calculateNextSortOrder(existingCategories: Array<{ sortOrder: number }>): number {
      return existingCategories.length > 0
        ? Math.max(...existingCategories.map((c) => c.sortOrder)) + 1
        : 0;
    }

    assert.equal(calculateNextSortOrder([]), 0);
    assert.equal(calculateNextSortOrder([{ sortOrder: 0 }, { sortOrder: 1 }]), 2);
    assert.equal(calculateNextSortOrder([{ sortOrder: 5 }, { sortOrder: 8 }]), 9);
  });
});

