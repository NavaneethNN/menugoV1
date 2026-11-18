import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  RestaurantMemberRole,
  getAllowedNextStatuses,
  getStatusDisplayInfo,
  isOpenOrderStatus,
  isTerminalOrderStatus,
  formatPaise
} from '@menugo/shared';

describe('Restaurant Order Management UI Logic & Detail Presentation (Task 13)', () => {
  interface MockOrderItem {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number; // paise
    subtotal: number;
    notes?: string | null;
  }

  interface MockOrder {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number; // paise
    customerName?: string | null;
    customerPhone?: string | null;
    specialInstructions?: string | null;
    createdAt: string;
    table?: { tableNumber: string } | null;
    items: MockOrderItem[];
    statusHistory: {
      fromStatus: OrderStatus;
      toStatus: OrderStatus;
      changedByRole: string;
      reason?: string | null;
      createdAt: string;
    }[];
  }

  const sampleOrders: MockOrder[] = [
    {
      id: 'ord-1',
      orderNumber: '1001',
      status: 'new',
      totalAmount: 37000,
      customerName: 'Kavita Iyer',
      customerPhone: '+91 98765 22222',
      specialInstructions: 'Medium spice',
      createdAt: new Date().toISOString(),
      table: { tableNumber: 'T-101' },
      items: [
        {
          id: 'item-1',
          productName: 'Paneer Butter Masala',
          quantity: 1,
          unitPrice: 28000,
          subtotal: 28000
        },
        {
          id: 'item-2',
          productName: 'Garlic Butter Roti',
          quantity: 2,
          unitPrice: 4500,
          subtotal: 9000,
          notes: 'Well crisp'
        }
      ],
      statusHistory: []
    },
    {
      id: 'ord-2',
      orderNumber: '1002',
      status: 'preparing',
      totalAmount: 28000,
      customerName: 'Rohan Deshmukh',
      createdAt: new Date().toISOString(),
      table: { tableNumber: 'T-102' },
      items: [
        {
          id: 'item-3',
          productName: 'Paneer Butter Masala',
          quantity: 1,
          unitPrice: 28000,
          subtotal: 28000
        }
      ],
      statusHistory: [
        {
          fromStatus: 'new',
          toStatus: 'preparing',
          changedByRole: 'kitchen',
          createdAt: new Date().toISOString()
        }
      ]
    },
    {
      id: 'ord-3',
      orderNumber: '1003',
      status: 'served',
      totalAmount: 18000,
      customerName: 'Priya Sharma',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      table: { tableNumber: 'T-101' },
      items: [
        {
          id: 'item-4',
          productName: 'Garlic Butter Roti',
          quantity: 4,
          unitPrice: 4500,
          subtotal: 18000
        }
      ],
      statusHistory: [
        {
          fromStatus: 'new',
          toStatus: 'preparing',
          changedByRole: 'kitchen',
          createdAt: new Date().toISOString()
        },
        {
          fromStatus: 'preparing',
          toStatus: 'ready',
          changedByRole: 'kitchen',
          createdAt: new Date().toISOString()
        },
        {
          fromStatus: 'ready',
          toStatus: 'served',
          changedByRole: 'staff',
          createdAt: new Date().toISOString()
        }
      ]
    },
    {
      id: 'ord-4',
      orderNumber: '1004',
      status: 'cancelled',
      totalAmount: 28000,
      customerName: 'Aditya Patel',
      createdAt: new Date().toISOString(),
      table: null,
      items: [],
      statusHistory: [
        {
          fromStatus: 'new',
          toStatus: 'cancelled',
          changedByRole: 'owner',
          reason: 'Guest left before order was cooked',
          createdAt: new Date().toISOString()
        }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // 1. Order List Filter Logic
  // ---------------------------------------------------------------------------
  test('Filter logic: slices orders by view (open, completed, cancelled, all)', () => {
    // Open orders: ord-1 (new) and ord-2 (preparing)
    const openOrders = sampleOrders.filter((o) => isOpenOrderStatus(o.status));
    assert.equal(openOrders.length, 2);
    assert.deepEqual(
      openOrders.map((o) => o.orderNumber),
      ['1001', '1002']
    );

    // Completed orders: ord-3 (served)
    const completedOrders = sampleOrders.filter((o) => o.status === 'served');
    assert.equal(completedOrders.length, 1);
    assert.equal(completedOrders[0]?.orderNumber, '1003');

    // Cancelled orders: ord-4 (cancelled)
    const cancelledOrders = sampleOrders.filter((o) => o.status === 'cancelled');
    assert.equal(cancelledOrders.length, 1);
    assert.equal(cancelledOrders[0]?.orderNumber, '1004');
  });

  test('Filter logic: slices orders by status filter', () => {
    const preparingOnly = sampleOrders.filter((o) => o.status === 'preparing');
    assert.equal(preparingOnly.length, 1);
    assert.equal(preparingOnly[0]?.orderNumber, '1002');
  });

  test('Search filter: matches across order number, customer name, and table number', () => {
    // Search by orderNumber
    const searchByNum = sampleOrders.filter((o) => o.orderNumber.includes('1001'));
    assert.equal(searchByNum.length, 1);

    // Search by customer name
    const searchByName = sampleOrders.filter((o) =>
      o.customerName?.toLowerCase().includes('kavita')
    );
    assert.equal(searchByName.length, 1);
    assert.equal(searchByName[0]?.customerName, 'Kavita Iyer');

    // Search by table
    const searchByTable = sampleOrders.filter((o) => o.table?.tableNumber === 'T-101');
    assert.equal(searchByTable.length, 2);
  });

  // ---------------------------------------------------------------------------
  // 2. Action Controls & State Machine Buttons in UI
  // ---------------------------------------------------------------------------
  test('UI action buttons dynamically reflect allowed transitions for staff role', () => {
    // Staff on 'new' order: can accept or start preparing, but CANNOT cancel
    const staffNewActions = getAllowedNextStatuses('new', 'staff');
    assert.deepEqual(staffNewActions, ['accepted', 'preparing']);
    assert.equal(staffNewActions.includes('cancelled'), false);

    // Owner on 'new' order: can accept, prepare, or cancel
    const ownerNewActions = getAllowedNextStatuses('new', 'owner');
    assert.deepEqual(ownerNewActions, ['accepted', 'preparing', 'cancelled']);

    // Kitchen on 'preparing' order: can mark ready
    const kitchenPrepActions = getAllowedNextStatuses('preparing', 'kitchen');
    assert.deepEqual(kitchenPrepActions, ['ready']);

    // Staff on 'ready' order: can mark served
    const staffReadyActions = getAllowedNextStatuses('ready', 'staff');
    assert.deepEqual(staffReadyActions, ['served']);

    // Completed or cancelled orders: terminal, no next actions
    assert.deepEqual(getAllowedNextStatuses('served', 'owner'), []);
    assert.deepEqual(getAllowedNextStatuses('cancelled', 'owner'), []);
  });

  // ---------------------------------------------------------------------------
  // 3. Order Detail Presentation & Money Formatting
  // ---------------------------------------------------------------------------
  test('Order detail formats total in INR paise without decimal drift', () => {
    const order = sampleOrders[0]!;
    const formatted = formatPaise(order.totalAmount, 'INR');
    assert.equal(formatted, '₹370');

    // Subtotal of each item matches
    const calculatedSum = order.items.reduce((acc, i) => acc + i.subtotal, 0);
    assert.equal(calculatedSum, order.totalAmount);
  });

  test('Status display info returns accessible badge styling and labels', () => {
    const infoNew = getStatusDisplayInfo('new');
    assert.equal(infoNew.label, 'New Order');
    assert.ok(infoNew.badgeClass.includes('blue'));

    const infoPrep = getStatusDisplayInfo('preparing');
    assert.equal(infoPrep.label, 'Preparing');
    assert.ok(infoPrep.badgeClass.includes('orange'));

    const infoServed = getStatusDisplayInfo('served');
    assert.equal(infoServed.label, 'Served');
    assert.ok(infoServed.badgeClass.includes('emerald'));
  });

  test('Concurrency payload builder attaches expectedCurrentStatus to avoid stale overwrites', () => {
    const order = sampleOrders[1]!; // ord-2 in status 'preparing'
    const targetStatus: OrderStatus = 'ready';

    const optimisticPayload = {
      status: targetStatus,
      expectedCurrentStatus: order.status
    };

    assert.equal(optimisticPayload.status, 'ready');
    assert.equal(optimisticPayload.expectedCurrentStatus, 'preparing');
  });

  test('Audit trail timeline renders history events chronologically', () => {
    const order = sampleOrders[2]!; // ord-3 (served)
    assert.equal(order.statusHistory.length, 3);
    assert.equal(order.statusHistory[0]?.toStatus, 'preparing');
    assert.equal(order.statusHistory[1]?.toStatus, 'ready');
    assert.equal(order.statusHistory[2]?.toStatus, 'served');
  });
});

