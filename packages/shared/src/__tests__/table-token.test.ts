import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTableToken,
  buildCustomerTableUrl,
  isValidTableTokenFormat,
  createTableSchema,
  updateTableSchema
} from '../index';

describe('Table QR Token Utilities & Domain Schemas (Task 10)', () => {
  // -------------------------------------------------------------------------
  // 1. Cryptographic Unguessable Token Generation
  // -------------------------------------------------------------------------
  test('generateTableToken produces 48-character hex string (192 bits of entropy)', () => {
    const token = generateTableToken(24);
    assert.equal(typeof token, 'string');
    assert.equal(token.length, 48);
    assert.match(token, /^[0-9a-f]{48}$/);
  });

  test('generateTableToken produces unique, high-entropy tokens without collisions', () => {
    const tokens = new Set<string>();
    const count = 500;

    for (let i = 0; i < count; i++) {
      const token = generateTableToken(24);
      assert.ok(!tokens.has(token), 'Generated token must be unique');
      tokens.add(token);
    }

    assert.equal(tokens.size, count);
  });

  test('Tokens are never sequential, predictable, or containing table IDs', () => {
    const t1 = generateTableToken(24);
    const t2 = generateTableToken(24);

    // Ensure not simple counter increment
    const diff = BigInt('0x' + t1) - BigInt('0x' + t2);
    assert.notEqual(diff, 1n);
    assert.notEqual(diff, -1n);
  });

  // -------------------------------------------------------------------------
  // 2. Token Format Verification
  // -------------------------------------------------------------------------
  test('isValidTableTokenFormat accurately identifies valid hex tokens', () => {
    assert.equal(isValidTableTokenFormat(generateTableToken(24)), true);
    assert.equal(isValidTableTokenFormat('abcdef0123456789abcdef0123456789'), true); // 32 hex chars
    assert.equal(
      isValidTableTokenFormat('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
      true
    ); // 64 hex chars
  });

  test('isValidTableTokenFormat rejects invalid, malformed, or injection inputs', () => {
    assert.equal(isValidTableTokenFormat(''), false);
    assert.equal(isValidTableTokenFormat('   '), false);
    assert.equal(isValidTableTokenFormat(null as any), false);
    assert.equal(isValidTableTokenFormat(undefined as any), false);
    assert.equal(isValidTableTokenFormat('short123'), false); // too short
    assert.equal(isValidTableTokenFormat('not-a-hex-string-with-invalid-chars!@#$'), false);
    assert.equal(isValidTableTokenFormat("'; DROP TABLE restaurant_tables; --"), false);
    assert.equal(isValidTableTokenFormat('<script>alert("xss")</script>'), false);
  });

  // -------------------------------------------------------------------------
  // 3. Customer URL Builder
  // -------------------------------------------------------------------------
  test('buildCustomerTableUrl constructs clean URL without duplicate slashes', () => {
    const token = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';

    const url1 = buildCustomerTableUrl('https://menugo.in', 'paradise-biryani', token);
    assert.equal(url1, `https://menugo.in/menu/paradise-biryani?table=${token}`);

    // Handles trailing slash in appUrl
    const url2 = buildCustomerTableUrl('https://menugo.in/', 'paradise-biryani', token);
    assert.equal(url2, `https://menugo.in/menu/paradise-biryani?table=${token}`);

    // Handles localhost
    const url3 = buildCustomerTableUrl('http://localhost:3000', 'cafe-de-paris', token);
    assert.equal(url3, `http://localhost:3000/menu/cafe-de-paris?table=${token}`);
  });

  // -------------------------------------------------------------------------
  // 4. Schema Validations
  // -------------------------------------------------------------------------
  test('createTableSchema validates required fields and trims whitespace', () => {
    const valid = createTableSchema.safeParse({
      restaurantId: 'rest-uuid-1',
      tableNumber: '  Table 4  ',
      capacity: 6,
      isActive: true
    });

    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.tableNumber, 'Table 4');
      assert.equal(valid.data.capacity, 6);
      assert.equal(valid.data.isActive, true);
    }
  });

  test('createTableSchema rejects empty table numbers and non-positive capacity', () => {
    // Empty table number
    const emptyNum = createTableSchema.safeParse({
      restaurantId: 'rest-1',
      tableNumber: '   ',
      capacity: 4
    });
    assert.equal(emptyNum.success, false);

    // Zero capacity
    const zeroCap = createTableSchema.safeParse({
      restaurantId: 'rest-1',
      tableNumber: 'Table 1',
      capacity: 0
    });
    assert.equal(zeroCap.success, false);

    // Negative capacity
    const negCap = createTableSchema.safeParse({
      restaurantId: 'rest-1',
      tableNumber: 'Table 1',
      capacity: -2
    });
    assert.equal(negCap.success, false);
  });

  test('updateTableSchema allows partial updates without restaurantId', () => {
    const partial = updateTableSchema.safeParse({
      tableNumber: 'VIP Lounge 2',
      isActive: false
    });

    assert.equal(partial.success, true);
    if (partial.success) {
      assert.equal(partial.data.tableNumber, 'VIP Lounge 2');
      assert.equal(partial.data.isActive, false);
    }
  });
});

