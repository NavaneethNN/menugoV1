import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateElapsedMinutes,
  formatElapsedTime,
  getUrgencyLevel,
  getUrgencyBadgeStyles,
  groupOrdersForKDS,
  shouldPlayAlert,
  buildKitchenStatusPayload,
  KitchenOrder
} from '../lib/kds';
import {
  OrderStatus,
  RestaurantMemberRole,
  validateStatusTransition,
  getAllowedNextStatuses
} from '@menugo/shared';

describe('Kitchen Dashboard (KDS) Logic & Behavior (Task 14)', () => {
  // Sample test orders across different statuses and wait times
  const baseTime = new Date('2026-11-05T12:00:00Z');

  const createMockOrder = (
    id: string,
    orderNumber: string,
    status: OrderStatus,
    minutesAgo: number,
    tableNumber: string = '4'
  ): KitchenOrder => {
    const createdAt = new Date(baseTime.getTime() - minutesAgo * 60000).toISOString();
    return {
      id,
      orderNumber,
      restaurantId: 'rest-uuid-1',
      tableId: 'table-uuid-1',
      status,
      totalAmount: 45000,
      specialInstructions: minutesAgo > 15 ? 'Rush order, guest has train to catch' : null,
      customerName: 'Aarav Sharma',
      customerPhone: '+91 98765 11111',
      statusToken: 'tok-abc',
      createdAt,
      updatedAt: createdAt,
      table: {
        id: 'table-uuid-1',
        tableNumber
      },
      items: [
        {
          id: `item-${id}-1`,
          orderId: id,
          productId: 'prod-1',
          productName: 'Paneer Butter Masala',
          quantity: 2,
          unitPrice: 20000,
          subtotal: 40000,
          notes: 'Make it spicy, no coriander'
        },
        {
          id: `item-${id}-2`,
          orderId: id,
          productId: 'prod-2',
          productName: 'Garlic Naan',
          quantity: 3,
          unitPrice: 5000,
          subtotal: 15000,
          notes: null
        }
      ]
    };
  };

  describe('1. Elapsed Time Calculation and Urgency Formatting', () => {
    test('calculates accurate wait minutes from createdAt timestamp', () => {
      const orderFresh = createMockOrder('o1', '101', 'new', 2);
      const orderModerate = createMockOrder('o2', '102', 'accepted', 14);
      const orderOverdue = createMockOrder('o3', '103', 'preparing', 25);

      assert.equal(calculateElapsedMinutes(orderFresh.createdAt, baseTime), 2);
      assert.equal(calculateElapsedMinutes(orderModerate.createdAt, baseTime), 14);
      assert.equal(calculateElapsedMinutes(orderOverdue.createdAt, baseTime), 25);
    });

    test('handles zero and negative clock drift gracefully', () => {
      // Future timestamp due to clock skew
      const futureTime = new Date(baseTime.getTime() + 10000).toISOString();
      assert.equal(calculateElapsedMinutes(futureTime, baseTime), 0);
      assert.equal(calculateElapsedMinutes('invalid-date', baseTime), 0);
    });

    test('formats elapsed minutes into readable labels', () => {
      assert.equal(formatElapsedTime(0), '< 1m');
      assert.equal(formatElapsedTime(5), '5m');
      assert.equal(formatElapsedTime(45), '45m');
      assert.equal(formatElapsedTime(60), '1h 0m');
      assert.equal(formatElapsedTime(85), '1h 25m');
    });

    test('categorizes wait urgency levels based on kitchen thresholds', () => {
      // Normal: < 10 mins
      assert.equal(getUrgencyLevel(0), 'normal');
      assert.equal(getUrgencyLevel(8), 'normal');
      assert.equal(getUrgencyLevel(9), 'normal');

      // Warning: 10m - 19m
      assert.equal(getUrgencyLevel(10), 'warning');
      assert.equal(getUrgencyLevel(15), 'warning');
      assert.equal(getUrgencyLevel(19), 'warning');

      // Urgent (Overdue): >= 20m
      assert.equal(getUrgencyLevel(20), 'urgent');
      assert.equal(getUrgencyLevel(35), 'urgent');
    });

    test('returns high-visibility styling classes matching urgency level', () => {
      const normalStyles = getUrgencyBadgeStyles('normal');
      const warningStyles = getUrgencyBadgeStyles('warning');
      const urgentStyles = getUrgencyBadgeStyles('urgent');

      assert.ok(normalStyles.badge.includes('slate'));
      assert.ok(warningStyles.badge.includes('amber'));
      assert.ok(urgentStyles.badge.includes('rose') || urgentStyles.badge.includes('animate-pulse'));
    });
  });

  describe('2. Order Grouping for Kitchen Kanban Columns', () => {
    test('groups orders into New, Preparing, and Ready columns', () => {
      const mockOrders: KitchenOrder[] = [
        createMockOrder('o-new', '101', 'new', 3),
        createMockOrder('o-pending', '102', 'pending', 5),
        createMockOrder('o-accepted', '103', 'accepted', 10),
        createMockOrder('o-prep', '104', 'preparing', 15),
        createMockOrder('o-ready', '105', 'ready', 22),
        createMockOrder('o-served', '106', 'served', 40), // terminal
        createMockOrder('o-cancelled', '107', 'cancelled', 12) // terminal
      ];

      const grouped = groupOrdersForKDS(mockOrders);

      // New orders column includes both 'new' and 'pending'
      assert.equal(grouped.newOrders.length, 2);
      assert.ok(grouped.newOrders.some((o) => o.id === 'o-new'));
      assert.ok(grouped.newOrders.some((o) => o.id === 'o-pending'));

      // Preparing column includes both 'accepted' and 'preparing'
      assert.equal(grouped.preparingOrders.length, 2);
      assert.ok(grouped.preparingOrders.some((o) => o.id === 'o-accepted'));
      assert.ok(grouped.preparingOrders.some((o) => o.id === 'o-prep'));

      // Ready column includes 'ready'
      assert.equal(grouped.readyOrders.length, 1);
      assert.equal(grouped.readyOrders[0]?.id, 'o-ready');

      // Terminal orders are excluded from all active KDS columns
      assert.equal(grouped.allActiveOrders.length, 5);
      assert.ok(!grouped.allActiveOrders.some((o) => o.status === 'served'));
      assert.ok(!grouped.allActiveOrders.some((o) => o.status === 'cancelled'));
    });

    test('sorts orders within columns in FIFO order (oldest wait time first)', () => {
      const mockOrders: KitchenOrder[] = [
        createMockOrder('o-new-recent', '201', 'new', 2), // 2 mins ago (newer)
        createMockOrder('o-new-old', '202', 'new', 18) // 18 mins ago (older)
      ];

      const grouped = groupOrdersForKDS(mockOrders);
      // Older order must be placed first in queue
      assert.equal(grouped.newOrders[0]?.id, 'o-new-old');
      assert.equal(grouped.newOrders[1]?.id, 'o-new-recent');
    });
  });

  describe('3. Sound Alert Notification & Deduplication Behavior', () => {
    test('triggers chime for new orders not yet played', () => {
      const playedSet = new Set<string>();
      const shouldPlay = shouldPlayAlert('order-999', playedSet, 'new');
      assert.equal(shouldPlay, true);
    });

    test('strictly prevents repeated sound alerts for the same order ID', () => {
      const playedSet = new Set<string>();
      const orderId = 'order-999';

      // First time order arrives: triggers chime
      const firstCheck = shouldPlayAlert(orderId, playedSet, 'new');
      assert.equal(firstCheck, true);
      playedSet.add(orderId);

      // Re-trigger / socket event bounce / poll refresh: MUST NOT chime again
      const secondCheck = shouldPlayAlert(orderId, playedSet, 'new');
      assert.equal(secondCheck, false);

      const thirdCheck = shouldPlayAlert(orderId, playedSet, 'pending');
      assert.equal(thirdCheck, false);
    });

    test('never triggers sound alert for non-new statuses', () => {
      const playedSet = new Set<string>();

      assert.equal(shouldPlayAlert('ord-prep', playedSet, 'preparing'), false);
      assert.equal(shouldPlayAlert('ord-ready', playedSet, 'ready'), false);
      assert.equal(shouldPlayAlert('ord-served', playedSet, 'served'), false);
      assert.equal(shouldPlayAlert('ord-cancel', playedSet, 'cancelled'), false);
    });
  });

  describe('4. Kitchen Staff Role Restrictions & State Machine Transitions', () => {
    const kitchenRole: RestaurantMemberRole = 'kitchen';

    test('kitchen role is authorized to advance orders from new -> accepted -> preparing -> ready', () => {
      // 1. Accept order
      const acceptCheck = validateStatusTransition('new', 'accepted', kitchenRole);
      assert.equal(acceptCheck.valid, true);

      // 2. Start cooking
      const cookCheck = validateStatusTransition('accepted', 'preparing', kitchenRole);
      assert.equal(cookCheck.valid, true);

      // 3. Mark food ready
      const readyCheck = validateStatusTransition('preparing', 'ready', kitchenRole);
      assert.equal(readyCheck.valid, true);
    });

    test('kitchen role is allowed to jump directly from new to preparing (one-click Quick Prep)', () => {
      const quickPrepCheck = validateStatusTransition('new', 'preparing', kitchenRole);
      assert.equal(quickPrepCheck.valid, true);
    });

    test('kitchen role is strictly forbidden from cancelling orders (requires owner or admin)', () => {
      const cancelCheck = validateStatusTransition('new', 'cancelled', kitchenRole);
      assert.equal(cancelCheck.valid, false);
      assert.equal(cancelCheck.errorCode, 'FORBIDDEN_ROLE');
    });

    test('rejects arbitrary backwards transitions (e.g. ready back to accepted)', () => {
      const backwardCheck = validateStatusTransition('ready', 'accepted', kitchenRole);
      assert.equal(backwardCheck.valid, false);
      assert.equal(backwardCheck.errorCode, 'INVALID_TRANSITION');
    });

    test('getAllowedNextStatuses returns only valid progression buttons for kitchen', () => {
      const newAllowed = getAllowedNextStatuses('new', kitchenRole);
      assert.deepEqual([...newAllowed], ['accepted', 'preparing']);

      const prepAllowed = getAllowedNextStatuses('preparing', kitchenRole);
      assert.deepEqual([...prepAllowed], ['ready']);

      const readyAllowed = getAllowedNextStatuses('ready', kitchenRole);
      assert.deepEqual([...readyAllowed], ['served']);
    });
  });

  describe('5. Concurrency Payload Builder with Optimistic Locking', () => {
    test('builds payload attaching expectedCurrentStatus to avoid stale overwrites', () => {
      const result = buildKitchenStatusPayload('ord-1', 'accepted', 'preparing', 'kitchen');

      assert.equal(result.valid, true);
      if (result.valid) {
        assert.deepEqual(result.payload, {
          status: 'preparing',
          expectedCurrentStatus: 'accepted'
        });
      }
    });

    test('rejects invalid transition before network call is attempted', () => {
      const invalidResult = buildKitchenStatusPayload('ord-1', 'ready', 'accepted', 'kitchen');
      assert.equal(invalidResult.valid, false);
      if (!invalidResult.valid) {
        assert.ok(invalidResult.error.length > 0);
      }
    });
  });
});

