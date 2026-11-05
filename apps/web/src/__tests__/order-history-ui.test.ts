import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePaginationPages,
  formatCompletionTime,
  buildOrderQueryParams,
  RestaurantOrder,
  OrderPaginationMeta
} from '../lib/order-history';

describe('Order History UI & Helper Utilities (Task 19)', () => {
  describe('calculatePaginationPages()', () => {
    it('returns [1] when totalPages is 0 or 1', () => {
      assert.deepEqual(calculatePaginationPages(1, 0), [1]);
      assert.deepEqual(calculatePaginationPages(1, 1), [1]);
    });

    it('returns full array when totalPages <= maxVisible (5)', () => {
      assert.deepEqual(calculatePaginationPages(1, 3), [1, 2, 3]);
      assert.deepEqual(calculatePaginationPages(2, 4), [1, 2, 3, 4]);
      assert.deepEqual(calculatePaginationPages(5, 5), [1, 2, 3, 4, 5]);
    });

    it('returns leading pages with trailing ellipsis when currentPage is near start', () => {
      const pages = calculatePaginationPages(1, 10, 5);
      assert.deepEqual(pages, [1, 2, 3, 4, 5, 'ellipsis', 10]);
    });

    it('returns middle pages with two ellipses when currentPage is in the middle', () => {
      const pages = calculatePaginationPages(5, 10, 5);
      // Start is max(1, 5 - 2) = 3, end is min(10, 3 + 5 - 1) = 7
      assert.deepEqual(pages, [1, 'ellipsis', 3, 4, 5, 6, 7, 'ellipsis', 10]);
    });

    it('returns trailing pages with leading ellipsis when currentPage is near end', () => {
      const pages = calculatePaginationPages(10, 10, 5);
      assert.deepEqual(pages, [1, 'ellipsis', 6, 7, 8, 9, 10]);
    });
  });

  describe('formatCompletionTime()', () => {
    const mockOrder: RestaurantOrder = {
      id: 'ord-1',
      orderNumber: '1001',
      restaurantId: 'rest-1',
      status: 'served',
      totalAmount: 25000,
      createdAt: '2026-11-05T01:00:00.000Z',
      updatedAt: '2026-11-05T01:30:00.000Z',
      servedAt: '2026-11-05T01:25:00.000Z',
      rejectedAt: null,
      items: []
    };

    it('formats served order with servedAt timestamp', () => {
      const result = formatCompletionTime(mockOrder);
      assert.equal(result.label, 'Served');
      assert.ok(result.time !== null);
    });

    it('formats cancelled order with rejectedAt timestamp', () => {
      const cancelledOrder: RestaurantOrder = {
        ...mockOrder,
        status: 'cancelled',
        servedAt: null,
        rejectedAt: '2026-11-05T01:10:00.000Z'
      };
      const result = formatCompletionTime(cancelledOrder);
      assert.equal(result.label, 'Cancelled');
      assert.ok(result.time !== null);
    });

    it('formats open / newly placed order with createdAt timestamp', () => {
      const newOrder: RestaurantOrder = {
        ...mockOrder,
        status: 'new',
        servedAt: null,
        rejectedAt: null
      };
      const result = formatCompletionTime(newOrder);
      assert.equal(result.label, 'Placed');
      assert.ok(result.time !== null);
    });

    it('safely handles missing or invalid timestamps without throwing', () => {
      const invalidOrder: any = {
        status: 'served',
        createdAt: 'invalid-date',
        servedAt: null
      };
      const result = formatCompletionTime(invalidOrder);
      assert.equal(result.label, 'Served');
      assert.equal(result.time, null);
    });
  });

  describe('buildOrderQueryParams()', () => {
    it('always includes paginate=true by default', () => {
      const params = buildOrderQueryParams({});
      assert.equal(params.paginate, 'true');
    });

    it('includes page and limit when provided', () => {
      const params = buildOrderQueryParams({ page: 2, limit: 24 });
      assert.equal(params.page, '2');
      assert.equal(params.limit, '24');
    });

    it('includes status filter when status is not "all"', () => {
      const params = buildOrderQueryParams({ status: 'ready' });
      assert.equal(params.status, 'ready');
      assert.equal(params.view, undefined);
    });

    it('includes view filter when status is "all" or omitted', () => {
      const params = buildOrderQueryParams({ status: 'all', view: 'open' });
      assert.equal(params.status, undefined);
      assert.equal(params.view, 'open');
    });

    it('includes date filter when date is not "all"', () => {
      const params = buildOrderQueryParams({ date: 'yesterday' });
      assert.equal(params.date, 'yesterday');
    });

    it('trims and includes search parameter', () => {
      const params = buildOrderQueryParams({ search: '  #1002  ' });
      assert.equal(params.search, '#1002');
    });

    it('ignores empty search parameter', () => {
      const params = buildOrderQueryParams({ search: '   ' });
      assert.equal(params.search, undefined);
    });

    it('includes custom date boundaries startDate and endDate', () => {
      const params = buildOrderQueryParams({
        startDate: '2026-11-01',
        endDate: '2026-11-05'
      });
      assert.equal(params.startDate, '2026-11-01');
      assert.equal(params.endDate, '2026-11-05');
    });
  });

  describe('Stable Pagination Boundary Invariants', () => {
    it('calculates correct record range display', () => {
      const meta: OrderPaginationMeta = {
        page: 2,
        limit: 12,
        totalOrders: 27,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true
      };

      const start = (meta.page - 1) * meta.limit + 1;
      const end = Math.min(meta.page * meta.limit, meta.totalOrders);

      assert.equal(start, 13);
      assert.equal(end, 24);
    });

    it('calculates correct record range on last page', () => {
      const meta: OrderPaginationMeta = {
        page: 3,
        limit: 12,
        totalOrders: 27,
        totalPages: 3,
        hasNextPage: false,
        hasPrevPage: true
      };

      const start = (meta.page - 1) * meta.limit + 1;
      const end = Math.min(meta.page * meta.limit, meta.totalOrders);

      assert.equal(start, 25);
      assert.equal(end, 27);
    });
  });
});

