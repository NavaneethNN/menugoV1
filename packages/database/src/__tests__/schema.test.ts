import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  restaurants,
  user,
  restaurantMembers,
  restaurantInvitations,
  categories,
  products,
  restaurantTables,
  orders,
  orderItems,
  orderStatusHistory
} from '../schema';
import { getTableColumns } from 'drizzle-orm';

describe('Database Schema Domain Rules', () => {
  test('Rule 1: UUID default generators exist for primary keys', () => {
    const tables = [
      restaurants,
      user,
      restaurantMembers,
      restaurantInvitations,
      categories,
      products,
      restaurantTables,
      orders,
      orderItems,
      orderStatusHistory
    ];

    tables.forEach((table) => {
      const cols = getTableColumns(table);
      assert.ok(cols.id, 'Table must have an id column');
      assert.ok(cols.id.primary, 'id column must be primary key');
      assert.equal(cols.id.dataType, 'string', 'id column should be string/UUID');
    });
  });

  test('Rule 2: Money columns are integer paise (never float/numeric)', () => {
    const productCols = getTableColumns(products);
    assert.equal(productCols.price.dataType, 'number', 'products.price must be number (integer)');
    assert.equal(productCols.price.columnType, 'PgInteger', 'products.price must be PgInteger (paise)');

    const orderCols = getTableColumns(orders);
    assert.equal(orderCols.totalAmount.dataType, 'number', 'orders.totalAmount must be number (integer)');
    assert.equal(orderCols.totalAmount.columnType, 'PgInteger', 'orders.totalAmount must be PgInteger (paise)');

    const itemCols = getTableColumns(orderItems);
    assert.equal(itemCols.unitPrice.dataType, 'number', 'orderItems.unitPrice must be number (integer)');
    assert.equal(itemCols.unitPrice.columnType, 'PgInteger', 'orderItems.unitPrice must be PgInteger (paise)');
    assert.equal(itemCols.subtotal.dataType, 'number', 'orderItems.subtotal must be number (integer)');
    assert.equal(itemCols.subtotal.columnType, 'PgInteger', 'orderItems.subtotal must be PgInteger (paise)');
  });

  test('Rule 3: All tenant-owned tables contain restaurant_id', () => {
    const tenantTables = [
      categories,
      products,
      restaurantTables,
      orders,
      restaurantMembers,
      restaurantInvitations
    ];

    tenantTables.forEach((table) => {
      const cols = getTableColumns(table);
      assert.ok(cols.restaurantId, 'Table must have restaurantId column');
      assert.ok(cols.restaurantId.notNull, 'restaurantId must be not null');
    });
  });

  test('Rule 6: Secure table QR token is stored and required', () => {
    const tableCols = getTableColumns(restaurantTables);
    assert.ok(tableCols.tableToken, 'restaurantTables must have tableToken column');
    assert.ok(tableCols.tableToken.notNull, 'tableToken must be not null');
  });

  test('Rule 7: Image object key and URL references are stored separately', () => {
    const productCols = getTableColumns(products);
    assert.ok(productCols.imageKey, 'products must have imageKey column');
    assert.ok(productCols.imageUrl, 'products must have imageUrl column');

    const restCols = getTableColumns(restaurants);
    assert.ok(restCols.logoKey, 'restaurants must have logoKey column');
    assert.ok(restCols.logoUrl, 'restaurants must have logoUrl column');
    assert.ok(restCols.coverImageKey, 'restaurants must have coverImageKey column');
    assert.ok(restCols.coverImageUrl, 'restaurants must have coverImageUrl column');
  });

  test('Rule 8: Order item snapshots capture name and unit price', () => {
    const itemCols = getTableColumns(orderItems);
    assert.ok(itemCols.productName, 'orderItems must have productName snapshot');
    assert.ok(itemCols.unitPrice, 'orderItems must have unitPrice snapshot');
    assert.ok(itemCols.quantity, 'orderItems must have quantity');
    assert.ok(itemCols.subtotal, 'orderItems must have subtotal');
  });

  test('Rule 9: created_at and updated_at are consistently defined', () => {
    const tablesWithTimestamps = [
      restaurants,
      user,
      restaurantMembers,
      restaurantInvitations,
      categories,
      products,
      restaurantTables,
      orders,
      orderItems
    ];

    tablesWithTimestamps.forEach((table) => {
      const cols = getTableColumns(table);
      assert.ok(cols.createdAt, 'Table must have createdAt');
      assert.ok(cols.updatedAt, 'Table must have updatedAt');
    });
  });
});

