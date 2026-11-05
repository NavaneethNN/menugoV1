import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStatusTransition,
  getAllowedNextStatuses,
  isOpenOrderStatus,
  isTerminalOrderStatus,
  getStatusDisplayInfo,
  ALLOWED_FORWARD_TRANSITIONS
} from '../order-state-machine';
import { OrderStatus, RestaurantMemberRole } from '../constants';

describe('Order State Machine & Lifecycle Transitions (Task 13)', () => {
  // ---------------------------------------------------------------------------
  // 1. Valid Forward Lifecycle Transitions
  // ---------------------------------------------------------------------------
  describe('Valid Status Transitions', () => {
    test('new -> accepted: permitted for owner, admin, kitchen, staff', () => {
      const roles: RestaurantMemberRole[] = ['owner', 'admin', 'kitchen', 'staff'];
      for (const role of roles) {
        const result = validateStatusTransition('new', 'accepted', role);
        assert.equal(result.valid, true, `Role ${role} should be allowed to accept new order`);
      }
    });

    test('new -> preparing: permitted for owner, admin, kitchen, staff', () => {
      const roles: RestaurantMemberRole[] = ['owner', 'admin', 'kitchen', 'staff'];
      for (const role of roles) {
        const result = validateStatusTransition('new', 'preparing', role);
        assert.equal(result.valid, true, `Role ${role} should be allowed to start preparing directly`);
      }
    });

    test('new -> cancelled: permitted for owner and admin only', () => {
      assert.equal(validateStatusTransition('new', 'cancelled', 'owner').valid, true);
      assert.equal(validateStatusTransition('new', 'cancelled', 'admin').valid, true);
    });

    test('pending -> accepted: permitted for owner, admin, kitchen, staff', () => {
      const roles: RestaurantMemberRole[] = ['owner', 'admin', 'kitchen', 'staff'];
      for (const role of roles) {
        assert.equal(validateStatusTransition('pending', 'accepted', role).valid, true);
      }
    });

    test('accepted -> preparing: permitted for owner, admin, kitchen, staff', () => {
      const roles: RestaurantMemberRole[] = ['owner', 'admin', 'kitchen', 'staff'];
      for (const role of roles) {
        const result = validateStatusTransition('accepted', 'preparing', role);
        assert.equal(result.valid, true, `Role ${role} should be allowed to transition accepted -> preparing`);
      }
    });

    test('accepted -> cancelled: permitted for owner and admin', () => {
      assert.equal(validateStatusTransition('accepted', 'cancelled', 'owner').valid, true);
      assert.equal(validateStatusTransition('accepted', 'cancelled', 'admin').valid, true);
    });

    test('preparing -> ready: permitted for owner, admin, kitchen', () => {
      const roles: RestaurantMemberRole[] = ['owner', 'admin', 'kitchen'];
      for (const role of roles) {
        const result = validateStatusTransition('preparing', 'ready', role);
        assert.equal(result.valid, true, `Role ${role} should be allowed to mark preparing -> ready`);
      }
    });

    test('preparing -> cancelled: permitted for owner and admin', () => {
      assert.equal(validateStatusTransition('preparing', 'cancelled', 'owner').valid, true);
      assert.equal(validateStatusTransition('preparing', 'cancelled', 'admin').valid, true);
    });

    test('ready -> served: permitted for owner, admin, staff, kitchen', () => {
      const roles: RestaurantMemberRole[] = ['owner', 'admin', 'staff', 'kitchen'];
      for (const role of roles) {
        const result = validateStatusTransition('ready', 'served', role);
        assert.equal(result.valid, true, `Role ${role} should be allowed to deliver ready order as served`);
      }
    });

    test('ready -> cancelled: permitted for owner and admin', () => {
      assert.equal(validateStatusTransition('ready', 'cancelled', 'owner').valid, true);
      assert.equal(validateStatusTransition('ready', 'cancelled', 'admin').valid, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Invalid & Backward Status Transitions
  // ---------------------------------------------------------------------------
  describe('Invalid & Backward Status Transitions', () => {
    test('Same-status transition is rejected as no-op error (SAME_STATUS)', () => {
      const statuses: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'served', 'cancelled'];
      for (const s of statuses) {
        const res = validateStatusTransition(s, s, 'owner');
        assert.equal(res.valid, false);
        assert.equal(res.errorCode, 'SAME_STATUS');
        assert.match(res.error || '', /already in status/i);
      }
    });

    test('Arbitrary forward skips are rejected (INVALID_TRANSITION)', () => {
      // new -> ready (skipping accepted/preparing)
      const res1 = validateStatusTransition('new', 'ready', 'owner');
      assert.equal(res1.valid, false);
      assert.equal(res1.errorCode, 'INVALID_TRANSITION');

      // new -> served (skipping everything)
      const res2 = validateStatusTransition('new', 'served', 'owner');
      assert.equal(res2.valid, false);
      assert.equal(res2.errorCode, 'INVALID_TRANSITION');

      // accepted -> served (skipping preparing & ready)
      const res3 = validateStatusTransition('accepted', 'served', 'owner');
      assert.equal(res3.valid, false);
      assert.equal(res3.errorCode, 'INVALID_TRANSITION');

      // preparing -> served (skipping ready)
      const res4 = validateStatusTransition('preparing', 'served', 'owner');
      assert.equal(res4.valid, false);
      assert.equal(res4.errorCode, 'INVALID_TRANSITION');
    });

    test('Backward transitions are strictly rejected (INVALID_TRANSITION)', () => {
      // ready -> preparing
      const res1 = validateStatusTransition('ready', 'preparing', 'owner');
      assert.equal(res1.valid, false);
      assert.equal(res1.errorCode, 'INVALID_TRANSITION');

      // ready -> accepted
      const res2 = validateStatusTransition('ready', 'accepted', 'owner');
      assert.equal(res2.valid, false);
      assert.equal(res2.errorCode, 'INVALID_TRANSITION');

      // preparing -> accepted
      const res3 = validateStatusTransition('preparing', 'accepted', 'owner');
      assert.equal(res3.valid, false);
      assert.equal(res3.errorCode, 'INVALID_TRANSITION');

      // preparing -> new
      const res4 = validateStatusTransition('preparing', 'new', 'owner');
      assert.equal(res4.valid, false);
      assert.equal(res4.errorCode, 'INVALID_TRANSITION');

      // accepted -> new
      const res5 = validateStatusTransition('accepted', 'new', 'owner');
      assert.equal(res5.valid, false);
      assert.equal(res5.errorCode, 'INVALID_TRANSITION');
    });

    test('Terminal state "served" rejects all subsequent transitions (TERMINAL_STATE)', () => {
      const targets: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'cancelled'];
      for (const target of targets) {
        const res = validateStatusTransition('served', target, 'owner');
        assert.equal(res.valid, false);
        assert.equal(res.errorCode, 'TERMINAL_STATE');
        assert.match(res.error || '', /already been served and completed/i);
      }
    });

    test('Terminal state "cancelled" rejects all subsequent transitions (TERMINAL_STATE)', () => {
      const targets: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'served'];
      for (const target of targets) {
        const res = validateStatusTransition('cancelled', target, 'owner');
        assert.equal(res.valid, false);
        assert.equal(res.errorCode, 'TERMINAL_STATE');
        assert.match(res.error || '', /already been cancelled/i);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Role & Permission Boundaries
  // ---------------------------------------------------------------------------
  describe('Role & Permission Boundaries', () => {
    test('Staff role cannot cancel orders (FORBIDDEN_ROLE)', () => {
      const res = validateStatusTransition('new', 'cancelled', 'staff');
      assert.equal(res.valid, false);
      assert.equal(res.errorCode, 'FORBIDDEN_ROLE');
      assert.match(res.error || '', /not permitted to cancel/i);
    });

    test('Kitchen role cannot cancel orders (FORBIDDEN_ROLE)', () => {
      const res = validateStatusTransition('preparing', 'cancelled', 'kitchen');
      assert.equal(res.valid, false);
      assert.equal(res.errorCode, 'FORBIDDEN_ROLE');
      assert.match(res.error || '', /not permitted to cancel/i);
    });

    test('Staff role cannot mark order as "ready" (kitchen responsibility)', () => {
      const res = validateStatusTransition('preparing', 'ready', 'staff');
      assert.equal(res.valid, false);
      assert.equal(res.errorCode, 'FORBIDDEN_ROLE');
      assert.match(res.error || '', /does not have permission/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Helper Functions & UI Utilities
  // ---------------------------------------------------------------------------
  describe('State Machine Helpers & Metadata', () => {
    test('getAllowedNextStatuses returns accurate allowed list for roles', () => {
      // Owner on 'new' -> ['accepted', 'preparing', 'cancelled']
      const ownerOnNew = getAllowedNextStatuses('new', 'owner');
      assert.deepEqual(ownerOnNew, ['accepted', 'preparing', 'cancelled']);

      // Staff on 'new' -> ['accepted', 'preparing'] (no cancelled)
      const staffOnNew = getAllowedNextStatuses('new', 'staff');
      assert.deepEqual(staffOnNew, ['accepted', 'preparing']);

      // Staff on 'preparing' -> [] (cannot mark ready or cancel)
      const staffOnPrep = getAllowedNextStatuses('preparing', 'staff');
      assert.deepEqual(staffOnPrep, []);

      // Kitchen on 'preparing' -> ['ready']
      const kitchenOnPrep = getAllowedNextStatuses('preparing', 'kitchen');
      assert.deepEqual(kitchenOnPrep, ['ready']);

      // Terminal states return empty array for all roles
      assert.deepEqual(getAllowedNextStatuses('served', 'owner'), []);
      assert.deepEqual(getAllowedNextStatuses('cancelled', 'owner'), []);
    });

    test('isOpenOrderStatus correctly distinguishes open and closed orders', () => {
      assert.equal(isOpenOrderStatus('new'), true);
      assert.equal(isOpenOrderStatus('pending'), true);
      assert.equal(isOpenOrderStatus('accepted'), true);
      assert.equal(isOpenOrderStatus('preparing'), true);
      assert.equal(isOpenOrderStatus('ready'), true);

      assert.equal(isOpenOrderStatus('served'), false);
      assert.equal(isOpenOrderStatus('cancelled'), false);
    });

    test('isTerminalOrderStatus correctly identifies terminal states', () => {
      assert.equal(isTerminalOrderStatus('served'), true);
      assert.equal(isTerminalOrderStatus('cancelled'), true);

      assert.equal(isTerminalOrderStatus('new'), false);
      assert.equal(isTerminalOrderStatus('preparing'), false);
    });

    test('getStatusDisplayInfo provides valid UI labels and badge classes', () => {
      const statuses: OrderStatus[] = ['new', 'pending', 'accepted', 'preparing', 'ready', 'served', 'cancelled'];
      for (const s of statuses) {
        const info = getStatusDisplayInfo(s);
        assert.ok(info.label);
        assert.ok(info.description);
        assert.ok(info.badgeClass);
        assert.ok(info.dotClass);
      }
    });
  });
});

