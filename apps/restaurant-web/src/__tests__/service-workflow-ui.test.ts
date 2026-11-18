import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceOrder,
  filterReadyOrders,
  filterRecentlyServedOrders,
  calculatePassWaitMinutes,
  formatPassWaitTime,
  getPassUrgency,
  getPassUrgencyStyles,
  formatTableDisplay,
  buildServedStatusPayload,
  shouldPlayServiceAlert
} from '../lib/service-workflow';

describe('Task 17 — Staff Service Workflow UI & Logic', () => {
  const mockOrders: ServiceOrder[] = [
    {
      id: 'ord-1',
      orderNumber: '101',
      restaurantId: 'rest-1',
      tableId: 'tbl-1',
      status: 'ready',
      totalAmount: 25000,
      createdAt: '2026-11-05T01:00:00.000Z',
      updatedAt: '2026-11-05T01:10:00.000Z', // 20m ago relative to 01:30
      table: { id: 'tbl-1', tableNumber: 'Table 4' },
      items: [
        { id: 'item-1', productName: 'Paneer Tikka', quantity: 2 }
      ]
    },
    {
      id: 'ord-2',
      orderNumber: '102',
      restaurantId: 'rest-1',
      tableId: 'tbl-2',
      status: 'ready',
      totalAmount: 18000,
      createdAt: '2026-11-05T01:05:00.000Z',
      updatedAt: '2026-11-05T01:28:00.000Z', // 2m ago relative to 01:30
      table: { id: 'tbl-2', tableNumber: '12' },
      items: [
        { id: 'item-2', productName: 'Garlic Naan', quantity: 4 }
      ]
    },
    {
      id: 'ord-3',
      orderNumber: '103',
      restaurantId: 'rest-1',
      tableId: 'tbl-1',
      status: 'preparing',
      totalAmount: 12000,
      createdAt: '2026-11-05T01:15:00.000Z',
      updatedAt: '2026-11-05T01:15:00.000Z',
      table: { id: 'tbl-1', tableNumber: 'Table 4' },
      items: [
        { id: 'item-3', productName: 'Dal Makhani', quantity: 1 }
      ]
    },
    {
      id: 'ord-4',
      orderNumber: '104',
      restaurantId: 'rest-1',
      tableId: null,
      status: 'served',
      totalAmount: 35000,
      createdAt: '2026-11-05T00:50:00.000Z',
      updatedAt: '2026-11-05T01:25:00.000Z',
      table: null,
      items: [
        { id: 'item-4', productName: 'Biryani Platter', quantity: 1 }
      ]
    },
    {
      id: 'ord-5',
      orderNumber: '105',
      restaurantId: 'rest-1',
      tableId: 'tbl-3',
      status: 'cancelled',
      totalAmount: 5000,
      createdAt: '2026-11-05T00:30:00.000Z',
      updatedAt: '2026-11-05T00:40:00.000Z',
      table: { id: 'tbl-3', tableNumber: '9' },
      items: []
    }
  ];

  // 1. Ready Orders Filter & Sorting
  it('filterReadyOrders filters out non-ready orders and sorts oldest waiting on pass first', () => {
    const ready = filterReadyOrders(mockOrders);

    assert.equal(ready.length, 2, 'Should only include the 2 ready orders');
    assert.equal(ready[0]?.id, 'ord-1', 'ord-1 was ready at 01:10 (older), should be first');
    assert.equal(ready[1]?.id, 'ord-2', 'ord-2 was ready at 01:28 (newer), should be second');

    for (const ord of ready) {
      assert.equal(ord.status, 'ready');
    }
  });

  // 2. Served Orders Filter & Sorting
  it('filterRecentlyServedOrders filters out non-served orders and sorts newest served first', () => {
    const served = filterRecentlyServedOrders(mockOrders);

    assert.equal(served.length, 1);
    assert.equal(served[0]?.id, 'ord-4');
    assert.equal(served[0]?.status, 'served');
  });

  // 3. Pass Wait Time Calculation & Clock Skew Resilience
  it('calculatePassWaitMinutes accurately computes elapsed minutes and prevents negative drift', () => {
    const now = new Date('2026-11-05T01:30:00.000Z');

    // 20 minutes elapsed
    const elapsed20 = calculatePassWaitMinutes('2026-11-05T01:10:00.000Z', now);
    assert.equal(elapsed20, 20);

    // 2 minutes elapsed
    const elapsed2 = calculatePassWaitMinutes('2026-11-05T01:28:00.000Z', now);
    assert.equal(elapsed2, 2);

    // Future timestamp / clock skew should return 0
    const elapsedFuture = calculatePassWaitMinutes('2026-11-05T01:35:00.000Z', now);
    assert.equal(elapsedFuture, 0);

    // Invalid timestamp returns 0
    const elapsedInvalid = calculatePassWaitMinutes('invalid-date', now);
    assert.equal(elapsedInvalid, 0);
  });

  // 4. Pass Wait Time Formatting
  it('formatPassWaitTime formats labels clearly for floor staff', () => {
    assert.equal(formatPassWaitTime(0), '< 1m');
    assert.equal(formatPassWaitTime(1), '1m');
    assert.equal(formatPassWaitTime(8), '8m');
    assert.equal(formatPassWaitTime(60), '1h 0m');
    assert.equal(formatPassWaitTime(75), '1h 15m');
  });

  // 5. Pass Urgency & Warning Thresholds
  it('getPassUrgency applies appropriate warning thresholds to prevent cold food delivery', () => {
    // Normal: < 3 minutes
    assert.equal(getPassUrgency(0), 'normal');
    assert.equal(getPassUrgency(2), 'normal');

    // Warning: 3 - 5 minutes
    assert.equal(getPassUrgency(3), 'warning');
    assert.equal(getPassUrgency(4), 'warning');

    // Urgent (> 5 minutes waiting on pass)
    assert.equal(getPassUrgency(5), 'urgent');
    assert.equal(getPassUrgency(12), 'urgent');

    const urgentStyles = getPassUrgencyStyles('urgent');
    assert.ok(urgentStyles.badge.includes('animate-pulse'));
    assert.ok(urgentStyles.badge.includes('rose'));
    assert.equal(urgentStyles.tagText, 'Urgent Delivery');

    const warningStyles = getPassUrgencyStyles('warning');
    assert.ok(warningStyles.badge.includes('amber'));
    assert.equal(warningStyles.tagText, 'Waiting on Pass');

    const normalStyles = getPassUrgencyStyles('normal');
    assert.ok(normalStyles.badge.includes('purple'));
  });

  // 6. Table Number Display Formatting (Mistake-Proof)
  it('formatTableDisplay clearly displays table numbers or takeaway tags', () => {
    const tableWithNumber = formatTableDisplay({ tableNumber: '12' });
    assert.equal(tableWithNumber.badgeText, 'TABLE 12');
    assert.equal(tableWithNumber.isTakeaway, false);

    const tableWithPrefix = formatTableDisplay({ tableNumber: 'Table 4' });
    assert.equal(tableWithPrefix.badgeText, 'TABLE 4');
    assert.equal(tableWithPrefix.isTakeaway, false);

    const takeawayOrder = formatTableDisplay(null);
    assert.equal(takeawayOrder.badgeText, 'TAKEAWAY');
    assert.equal(takeawayOrder.isTakeaway, true);
  });

  // 7. Served Payload Generator & Concurrency Protection
  it('buildServedStatusPayload enforces role permission and optimistic concurrency token', () => {
    // Authorized staff marking ready order
    const validStaffResult = buildServedStatusPayload('ord-1', 'ready', 'staff');
    assert.equal(validStaffResult.valid, true);
    if (validStaffResult.valid) {
      assert.equal(validStaffResult.payload.status, 'served');
      assert.equal(validStaffResult.payload.expectedCurrentStatus, 'ready');
    }

    // Authorized kitchen marking ready order
    const validKitchenResult = buildServedStatusPayload('ord-1', 'ready', 'kitchen');
    assert.equal(validKitchenResult.valid, true);

    // Reject marking preparing order directly as served
    const invalidPreparingResult = buildServedStatusPayload('ord-3', 'preparing', 'staff');
    assert.equal(invalidPreparingResult.valid, false);
    if (!invalidPreparingResult.valid) {
      assert.ok(invalidPreparingResult.error.includes('Invalid transition'));
    }

    // Reject marking already served order
    const invalidServedResult = buildServedStatusPayload('ord-4', 'served', 'staff');
    assert.equal(invalidServedResult.valid, false);
  });

  // 8. Service Sound Alert Triggering & Deduplication
  it('shouldPlayServiceAlert triggers sound chime only for new ready orders and ignores duplicates', () => {
    const playedSet = new Set<string>();

    // Initial ready order triggers chime
    assert.equal(shouldPlayServiceAlert('ord-ready-1', playedSet, 'ready'), true);
    playedSet.add('ord-ready-1');

    // Duplicate event does not re-chime
    assert.equal(shouldPlayServiceAlert('ord-ready-1', playedSet, 'ready'), false);

    // Non-ready orders never trigger service chime
    assert.equal(shouldPlayServiceAlert('ord-prep-1', playedSet, 'preparing'), false);
    assert.equal(shouldPlayServiceAlert('ord-served-1', playedSet, 'served'), false);
    assert.equal(shouldPlayServiceAlert('ord-new-1', playedSet, 'new'), false);
  });
});

