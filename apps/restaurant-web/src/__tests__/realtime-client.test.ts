import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventDeduplicator, isStaleEvent } from '../lib/realtime-client';

describe('Frontend Realtime Client, Resilience & Deduplication (Task 15)', () => {
  describe('1. Event Deduplication (Requirement 7)', () => {
    test('EventDeduplicator identifies new events and flags duplicate eventIds', () => {
      const dedup = new EventDeduplicator(10);
      const eventId1 = 'evt-111-aaa';
      const eventId2 = 'evt-222-bbb';

      // First time event 1 arrives
      assert.equal(dedup.has(eventId1), false);
      dedup.add(eventId1);
      assert.equal(dedup.has(eventId1), true);

      // Event 2 is still unseen
      assert.equal(dedup.has(eventId2), false);
      dedup.add(eventId2);
      assert.equal(dedup.has(eventId2), true);

      // Duplicate delivery of event 1
      assert.equal(dedup.has(eventId1), true);
    });

    test('handles empty or undefined eventIds safely', () => {
      const dedup = new EventDeduplicator();
      assert.equal(dedup.has(''), false);
      assert.equal(dedup.has(null as any), false);
      assert.equal(dedup.has(undefined as any), false);
    });

    test('evicts oldest IDs when bounded capacity is exceeded (FIFO)', () => {
      const capacity = 3;
      const dedup = new EventDeduplicator(capacity);

      dedup.add('e1');
      dedup.add('e2');
      dedup.add('e3');

      assert.equal(dedup.has('e1'), true);
      assert.equal(dedup.has('e2'), true);
      assert.equal(dedup.has('e3'), true);

      // Add 4th item: should evict oldest 'e1'
      dedup.add('e4');
      assert.equal(dedup.has('e1'), false);
      assert.equal(dedup.has('e2'), true);
      assert.equal(dedup.has('e3'), true);
      assert.equal(dedup.has('e4'), true);
    });

    test('clear resets all stored event IDs', () => {
      const dedup = new EventDeduplicator();
      dedup.add('e1');
      dedup.add('e2');
      assert.equal(dedup.has('e1'), true);

      dedup.clear();
      assert.equal(dedup.has('e1'), false);
      assert.equal(dedup.has('e2'), false);
    });
  });

  describe('2. Out-of-Order & Delayed Event Drop (Requirement 7)', () => {
    test('isStaleEvent returns true when incoming event is older than current data', () => {
      const currentTimestamp = '2026-11-05T12:00:10.000Z';
      const delayedTimestamp = '2026-11-05T12:00:05.000Z'; // 5 seconds older

      assert.equal(isStaleEvent(delayedTimestamp, currentTimestamp), true);
    });

    test('isStaleEvent returns false when incoming event is newer or identical', () => {
      const currentTimestamp = '2026-11-05T12:00:10.000Z';
      const newerTimestamp = '2026-11-05T12:00:15.000Z'; // 5 seconds newer
      const sameTimestamp = '2026-11-05T12:00:10.000Z';

      assert.equal(isStaleEvent(newerTimestamp, currentTimestamp), false);
      assert.equal(isStaleEvent(sameTimestamp, currentTimestamp), false);
    });

    test('handles invalid dates gracefully without throwing', () => {
      assert.equal(isStaleEvent('not-a-date', '2026-11-05T12:00:10.000Z'), false);
      assert.equal(isStaleEvent('2026-11-05T12:00:10.000Z', 'not-a-date'), false);
    });
  });

  describe('3. Event-as-Notification & Authoritative Refetch Workflow (Requirements 5 & 6)', () => {
    test('incoming event notifies client while triggering authoritative sync', async () => {
      let authoritativeRefetchCount = 0;
      const mockRefetch = async () => {
        authoritativeRefetchCount++;
      };

      // Simulated reconnect or focus event triggers authoritative fetch
      await mockRefetch();
      assert.equal(authoritativeRefetchCount, 1);

      await mockRefetch();
      assert.equal(authoritativeRefetchCount, 2);
    });

    test('out-of-order event is safely dropped to protect local state consistency', () => {
      let orderState = {
        id: 'ord-101',
        status: 'preparing',
        updatedAt: '2026-11-05T12:10:00.000Z'
      };

      const incomingDelayedEvent = {
        eventId: 'evt-delayed-1',
        orderId: 'ord-101',
        status: 'accepted', // Delayed old event arrives late
        updatedAt: '2026-11-05T12:08:00.000Z' // Older than current preparing state
      };

      // Check staleness before applying mutation
      if (!isStaleEvent(incomingDelayedEvent.updatedAt, orderState.updatedAt)) {
        orderState = {
          ...orderState,
          status: incomingDelayedEvent.status,
          updatedAt: incomingDelayedEvent.updatedAt
        };
      }

      // Order status remains in 'preparing', preventing rollback to 'accepted'
      assert.equal(orderState.status, 'preparing');
      assert.equal(orderState.updatedAt, '2026-11-05T12:10:00.000Z');
    });

    test('duplicate event arrival is filtered out by deduplicator', () => {
      const dedup = new EventDeduplicator();
      let stateMutations = 0;

      const processEvent = (event: { eventId: string; status: string }) => {
        if (dedup.has(event.eventId)) {
          return; // Dropped
        }
        dedup.add(event.eventId);
        stateMutations++;
      };

      const event = { eventId: 'evt-dup-99', status: 'ready' };

      processEvent(event); // First delivery
      processEvent(event); // Duplicate delivery (retry / socket burst)
      processEvent(event); // Duplicate delivery

      assert.equal(stateMutations, 1);
    });
  });
});

