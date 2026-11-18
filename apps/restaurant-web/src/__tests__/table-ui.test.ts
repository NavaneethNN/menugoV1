import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTableToken,
  buildCustomerTableUrl,
  isValidTableTokenFormat
} from '@menugo/shared';

describe('Table Management UI Logic & QR Generation (Task 10)', () => {
  // -------------------------------------------------------------------------
  // 1. Form Validation Logic
  // -------------------------------------------------------------------------
  test('Validates table creation form inputs', () => {
    function validateTableForm(tableNumber: string, capacityStr: string): Record<string, string> {
      const errors: Record<string, string> = {};
      const trimmed = tableNumber.trim();

      if (!trimmed) {
        errors.tableNumber = 'Table number or name is required';
      } else if (trimmed.length > 50) {
        errors.tableNumber = 'Table number cannot exceed 50 characters';
      }

      const cap = parseInt(capacityStr, 10);
      if (isNaN(cap) || cap < 1) {
        errors.capacity = 'Capacity must be at least 1 guest';
      } else if (cap > 100) {
        errors.capacity = 'Capacity cannot exceed 100 guests';
      }

      return errors;
    }

    // Valid
    assert.deepEqual(validateTableForm('Table 4', '4'), {});
    assert.deepEqual(validateTableForm('VIP Lounge', '12'), {});

    // Empty table number
    assert.equal(validateTableForm('   ', '4').tableNumber, 'Table number or name is required');

    // Long table number
    assert.ok(validateTableForm('A'.repeat(51), '4').tableNumber);

    // Invalid capacity
    assert.equal(validateTableForm('Table 1', '0').capacity, 'Capacity must be at least 1 guest');
    assert.equal(validateTableForm('Table 1', '-5').capacity, 'Capacity must be at least 1 guest');
    assert.equal(validateTableForm('Table 1', 'abc').capacity, 'Capacity must be at least 1 guest');
    assert.equal(validateTableForm('Table 1', '101').capacity, 'Capacity cannot exceed 100 guests');
  });

  // -------------------------------------------------------------------------
  // 2. Customer URL & Token Resolution
  // -------------------------------------------------------------------------
  test('Customer table URL includes unguessable token and clean restaurant slug', () => {
    const token = generateTableToken(24);
    const url = buildCustomerTableUrl('https://menugo.in', 'paradise-biryani', token);

    assert.equal(url, `https://menugo.in/menu/paradise-biryani?table=${token}`);
    assert.ok(isValidTableTokenFormat(token));
  });

  // -------------------------------------------------------------------------
  // 3. QR Download File Naming
  // -------------------------------------------------------------------------
  test('Generates clean download file names for printable QR PNGs', () => {
    function generateQrFileName(restaurantSlug: string, tableNumber: string): string {
      const sanitizedNum = tableNumber.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
      return `${restaurantSlug}-${sanitizedNum}-qr.png`;
    }

    assert.equal(generateQrFileName('spice-bistro', 'Table 1'), 'spice-bistro-Table-1-qr.png');
    assert.equal(generateQrFileName('cafe-rio', 'VIP #2'), 'cafe-rio-VIP--2-qr.png');
  });

  // -------------------------------------------------------------------------
  // 4. Customer Menu Table Verification State Resolution
  // -------------------------------------------------------------------------
  test('Resolves customer table verification states accurately', () => {
    interface VerificationResponse {
      valid: boolean;
      table?: { tableNumber: string; capacity: number; isActive: boolean };
      error?: string;
    }

    function resolveTableBadgeState(response: VerificationResponse) {
      if (response.valid && response.table?.isActive) {
        return {
          type: 'VERIFIED_DINE_IN',
          badgeText: `${response.table.tableNumber} • Dine-in Verified`
        };
      }
      if (response.table && !response.table.isActive) {
        return {
          type: 'TABLE_DISABLED',
          badgeText: 'This table is currently disabled. Browse full menu below.'
        };
      }
      return {
        type: 'INVALID_TOKEN',
        badgeText: 'Invalid table QR token.'
      };
    }

    // Active table
    const activeResult = resolveTableBadgeState({
      valid: true,
      table: { tableNumber: 'Table 7', capacity: 4, isActive: true }
    });
    assert.equal(activeResult.type, 'VERIFIED_DINE_IN');
    assert.equal(activeResult.badgeText, 'Table 7 • Dine-in Verified');

    // Inactive table
    const inactiveResult = resolveTableBadgeState({
      valid: false,
      table: { tableNumber: 'Table 7', capacity: 4, isActive: false }
    });
    assert.equal(inactiveResult.type, 'TABLE_DISABLED');

    // Invalid token
    const invalidResult = resolveTableBadgeState({ valid: false });
    assert.equal(invalidResult.type, 'INVALID_TOKEN');
  });
});

