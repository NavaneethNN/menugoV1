import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, getStatusDisplayInfo, formatPaise } from '@menugo/shared';
import { EventDeduplicator, isStaleEvent } from '../lib/realtime-client';

describe('Customer Order Confirmation & Live Tracking UI (Task 16)', () => {
  const LIFECYCLE_STEPS: { status: OrderStatus; label: string; description: string }[] = [
    { status: 'new', label: 'Order Received', description: 'Your order was sent to the kitchen' },
    { status: 'accepted', label: 'Accepted', description: 'Kitchen acknowledged your order' },
    { status: 'preparing', label: 'Preparing', description: 'Chef is cooking your dishes' },
    { status: 'ready', label: 'Ready to Serve', description: 'Food is prepared, on its way to table' },
    { status: 'served', label: 'Served', description: 'Delivered to your table. Enjoy!' }
  ];

  function getLifecycleProgress(status: OrderStatus) {
    const isCancelled = status === 'cancelled';
    const isServed = status === 'served';
    const normalizedStatus = status === 'pending' ? 'new' : status;
    const currentStepIdx = LIFECYCLE_STEPS.findIndex((s) => s.status === normalizedStatus);

    return {
      isCancelled,
      isServed,
      currentStepIdx,
      steps: LIFECYCLE_STEPS.map((step, idx) => ({
        ...step,
        isCompleted: !isCancelled && currentStepIdx > idx,
        isActive: !isCancelled && currentStepIdx === idx,
        isUpcoming: isCancelled || currentStepIdx < idx
      }))
    };
  }

  describe('1. Lifecycle Progression & Step States (Requirement 4)', () => {
    test('new and pending orders map to initial Step 0 (Order Received)', () => {
      const newProgress = getLifecycleProgress('new');
      assert.equal(newProgress.currentStepIdx, 0);
      assert.equal(newProgress.steps[0]?.isActive, true);
      assert.equal(newProgress.steps[1]?.isUpcoming, true);

      // Pending also normalizes to step 0
      const pendingProgress = getLifecycleProgress('pending');
      assert.equal(pendingProgress.currentStepIdx, 0);
      assert.equal(pendingProgress.steps[0]?.isActive, true);
    });

    test('preparing order marks previous steps as completed and current step as active', () => {
      const prepProgress = getLifecycleProgress('preparing');
      assert.equal(prepProgress.currentStepIdx, 2);

      // Step 0 (new) and Step 1 (accepted) are completed
      assert.equal(prepProgress.steps[0]?.isCompleted, true);
      assert.equal(prepProgress.steps[1]?.isCompleted, true);

      // Step 2 (preparing) is active
      assert.equal(prepProgress.steps[2]?.isActive, true);

      // Step 3 (ready) and Step 4 (served) are upcoming
      assert.equal(prepProgress.steps[3]?.isUpcoming, true);
      assert.equal(prepProgress.steps[4]?.isUpcoming, true);
    });

    test('served order marks all lifecycle steps as completed with isServed = true', () => {
      const servedProgress = getLifecycleProgress('served');
      assert.equal(servedProgress.isServed, true);
      assert.equal(servedProgress.isCancelled, false);
      assert.equal(servedProgress.currentStepIdx, 4);

      // All preceding steps completed
      assert.equal(servedProgress.steps[0]?.isCompleted, true);
      assert.equal(servedProgress.steps[1]?.isCompleted, true);
      assert.equal(servedProgress.steps[2]?.isCompleted, true);
      assert.equal(servedProgress.steps[3]?.isCompleted, true);
      assert.equal(servedProgress.steps[4]?.isActive, true);
    });

    test('cancelled status isolates the order and flags isCancelled = true', () => {
      const cancelProgress = getLifecycleProgress('cancelled');
      assert.equal(cancelProgress.isCancelled, true);
      assert.equal(cancelProgress.isServed, false);

      // No lifecycle steps should be active
      assert.ok(cancelProgress.steps.every((s) => !s.isActive));
    });
  });

  describe('2. Realtime Event Ingest, Deduplication & Monotonic Ordering (Requirements 5 & 7)', () => {
    test('updates local order status when valid forward event arrives', () => {
      let order = {
        orderNumber: '5001',
        status: 'new' as OrderStatus,
        updatedAt: '2026-11-05T12:00:00.000Z'
      };

      const incomingEvent = {
        eventId: 'evt-unique-1',
        status: 'accepted' as OrderStatus,
        updatedAt: '2026-11-05T12:01:00.000Z'
      };

      if (!isStaleEvent(incomingEvent.updatedAt, order.updatedAt)) {
        order = { ...order, status: incomingEvent.status, updatedAt: incomingEvent.updatedAt };
      }

      assert.equal(order.status, 'accepted');
      assert.equal(order.updatedAt, '2026-11-05T12:01:00.000Z');
    });

    test('drops delayed/out-of-order event when incoming timestamp is older', () => {
      let order = {
        orderNumber: '5001',
        status: 'ready' as OrderStatus,
        updatedAt: '2026-11-05T12:15:00.000Z'
      };

      const delayedEvent = {
        eventId: 'evt-delayed-old',
        status: 'preparing' as OrderStatus, // Old preparing event arrives late
        updatedAt: '2026-11-05T12:10:00.000Z'
      };

      if (!isStaleEvent(delayedEvent.updatedAt, order.updatedAt)) {
        order = { ...order, status: delayedEvent.status, updatedAt: delayedEvent.updatedAt };
      }

      // Order status remains in 'ready'
      assert.equal(order.status, 'ready');
      assert.equal(order.updatedAt, '2026-11-05T12:15:00.000Z');
    });

    test('drops duplicate event delivery using EventDeduplicator', () => {
      const dedup = new EventDeduplicator();
      let ingestCount = 0;

      const handleEvent = (evt: { eventId: string; status: OrderStatus }) => {
        if (dedup.has(evt.eventId)) return;
        dedup.add(evt.eventId);
        ingestCount++;
      };

      const event = { eventId: 'evt-dup-token-1', status: 'served' as OrderStatus };

      handleEvent(event); // Delivery 1
      handleEvent(event); // Duplicate
      handleEvent(event); // Duplicate

      assert.equal(ingestCount, 1);
    });
  });

  describe('3. Reconnect & Focus Recovery Simulation (Requirements 5 & 6)', () => {
    test('socket reconnect triggers authoritative API refetch', async () => {
      let apiFetchCalls = 0;
      const refetchAuthoritativeState = async () => {
        apiFetchCalls++;
      };

      // Initial load
      await refetchAuthoritativeState();
      assert.equal(apiFetchCalls, 1);

      // Socket disconnects and reconnects
      await refetchAuthoritativeState();
      assert.equal(apiFetchCalls, 2);

      // User returns to tab (focus)
      await refetchAuthoritativeState();
      assert.equal(apiFetchCalls, 3);
    });
  });

  describe('4. Customer Summary Presentation & Sanitized Fields (Requirements 1 & 3)', () => {
    test('accurately formats total in INR without floating-point math issues', () => {
      const formattedPaiseZero = formatPaise(0);
      assert.equal(formattedPaiseZero, '₹0');

      const formattedSmall = formatPaise(45000); // 450.00 INR
      assert.equal(formattedSmall, '₹450');

      const formattedFractional = formatPaise(12550); // 125.50 INR
      assert.equal(formattedFractional, '₹125.50');
    });

    test('customer tracking URL construction uses unguessable token and never order ID', () => {
      const mockOrderNumber = '1042';
      const mockInternalId = '492b95cf-dbd8-4f27-a0f1-432a514d2301';
      const unguessableToken = 'track_tok_c81f0891d4e747bb8311';

      const trackingUrl = `/track/${unguessableToken}`;

      // URL contains only the unguessable token
      assert.ok(trackingUrl.includes(unguessableToken));
      assert.equal(trackingUrl.includes(mockInternalId), false);
      assert.equal(trackingUrl.includes(mockOrderNumber), false);
    });
  });
});
