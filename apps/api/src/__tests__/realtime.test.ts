import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, restaurants, restaurantMembers, orders, orderItems, restaurantTables, user } from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import {
  authorizeRestaurantSubscription,
  authorizeOrderSubscription,
  sanitizeRestaurantOrderPayload,
  sanitizeCustomerOrderPayload,
  setRealtimeProvider,
  getRealtimeProvider,
  publishOrderCreated,
  publishOrderUpdated,
  RealtimeProvider
} from '../lib/realtime';
import {
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  realtimeRestaurantOrderPayloadSchema,
  realtimeCustomerOrderPayloadSchema,
  RealtimeRestaurantOrderPayload,
  RealtimeCustomerOrderPayload
} from '@menugo/shared';
import crypto from 'crypto';

describe('Realtime Updates Architecture, Authorization & Sanitization (Task 15)', () => {
  // Test Fixture IDs
  const testRestAlphaId = crypto.randomUUID();
  const testRestBetaId = crypto.randomUUID();
  const testUserOwnerAlphaId = crypto.randomUUID();
  const testUserStaffAlphaId = crypto.randomUUID();
  const testUserOwnerBetaId = crypto.randomUUID();
  const testUnrelatedUserId = crypto.randomUUID();

  const testTableId = crypto.randomUUID();
  const testOrderId = crypto.randomUUID();
  const testStatusToken = 'status_tok_' + crypto.randomBytes(24).toString('hex');

  // Mock Provider for testing provider boundary
  class MockRealtimeProvider implements RealtimeProvider {
    public restaurantPublishes: { restaurantId: string; event: string; payload: any }[] = [];
    public orderPublishes: { statusToken: string; event: string; payload: any }[] = [];

    async publishToRestaurant(restaurantId: string, event: string, payload: any): Promise<void> {
      this.restaurantPublishes.push({ restaurantId, event, payload });
    }

    async publishToOrder(statusToken: string, event: string, payload: any): Promise<void> {
      this.orderPublishes.push({ statusToken, event, payload });
    }

    clear(): void {
      this.restaurantPublishes = [];
      this.orderPublishes = [];
    }
  }

  const mockProvider = new MockRealtimeProvider();

  before(async () => {
    setRealtimeProvider(mockProvider);

    // 0. Create test users in Better Auth user table
    await db.insert(user).values([
      {
        id: testUserOwnerAlphaId,
        name: 'Owner Alpha',
        email: `owner-alpha-${Date.now()}@test.com`
      },
      {
        id: testUserStaffAlphaId,
        name: 'Staff Alpha',
        email: `staff-alpha-${Date.now()}@test.com`
      },
      {
        id: testUserOwnerBetaId,
        name: 'Owner Beta',
        email: `owner-beta-${Date.now()}@test.com`
      }
    ]);

    // 1. Create two test restaurants
    await db.insert(restaurants).values([
      {
        id: testRestAlphaId,
        name: 'Realtime Alpha Diner',
        slug: 'realtime-alpha-diner-' + Date.now(),
        currency: 'INR',
        isActive: true
      },
      {
        id: testRestBetaId,
        name: 'Realtime Beta Bistro',
        slug: 'realtime-beta-bistro-' + Date.now(),
        currency: 'INR',
        isActive: true
      }
    ]);

    // 2. Create restaurant memberships
    await db.insert(restaurantMembers).values([
      {
        id: crypto.randomUUID(),
        restaurantId: testRestAlphaId,
        userId: testUserOwnerAlphaId,
        role: 'owner'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: testRestAlphaId,
        userId: testUserStaffAlphaId,
        role: 'staff'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: testRestBetaId,
        userId: testUserOwnerBetaId,
        role: 'owner'
      }
    ]);

    // 3. Create test table and order
    await db.insert(restaurantTables).values({
      id: testTableId,
      restaurantId: testRestAlphaId,
      tableNumber: 'T-101',
      capacity: 4,
      tableToken: 'tbl_tok_' + crypto.randomBytes(16).toString('hex')
    });

    await db.insert(orders).values({
      id: testOrderId,
      restaurantId: testRestAlphaId,
      tableId: testTableId,
      orderNumber: 'RT-8801',
      status: 'new',
      totalAmount: 55000,
      customerName: 'Secret Customer',
      customerPhone: '+91 99999 88888',
      specialInstructions: 'Allergic to shellfish',
      statusToken: testStatusToken
    });
  });

  after(async () => {
    // Teardown test records
    await db.delete(orders).where(eq(orders.id, testOrderId));
    await db.delete(restaurantTables).where(eq(restaurantTables.id, testTableId));
    await db.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, testRestAlphaId));
    await db.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, testRestBetaId));
    await db.delete(restaurants).where(eq(restaurants.id, testRestAlphaId));
    await db.delete(restaurants).where(eq(restaurants.id, testRestBetaId));
    await db.delete(user).where(inArray(user.id, [testUserOwnerAlphaId, testUserStaffAlphaId, testUserOwnerBetaId]));
    setRealtimeProvider(null);
  });

  beforeEach(() => {
    mockProvider.clear();
  });

  describe('1. Event Payload Validation & Schemas', () => {
    test('sanitizeRestaurantOrderPayload validates against Zod schema and attaches required metadata', () => {
      const mockOrder = {
        id: crypto.randomUUID(),
        restaurantId: testRestAlphaId,
        orderNumber: '5012',
        status: 'new',
        tableId: testTableId,
        table: { tableNumber: '12' },
        totalAmount: 42000,
        specialInstructions: 'Extra napkins',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const mockItems = [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Butter Chicken',
          quantity: 2,
          unitPrice: 21000,
          notes: 'Medium spicy'
        }
      ];

      const payload = sanitizeRestaurantOrderPayload(mockOrder, mockItems, 'order:created');

      // Validates successfully against schema
      assert.doesNotThrow(() => realtimeRestaurantOrderPayloadSchema.parse(payload));
      assert.ok(payload.eventId.length > 20);
      assert.equal(payload.eventType, 'order:created');
      assert.equal(payload.orderNumber, '5012');
      assert.equal(payload.tableNumber, '12');
      assert.equal(payload.itemCount, 2);
      assert.equal(payload.items?.length, 1);
    });

    test('sanitizeCustomerOrderPayload strictly validates against customer tracking schema', () => {
      const mockOrder = {
        id: crypto.randomUUID(),
        statusToken: testStatusToken,
        orderNumber: '5012',
        status: 'preparing',
        table: { tableNumber: '12' },
        updatedAt: new Date().toISOString()
      };

      const payload = sanitizeCustomerOrderPayload(mockOrder, 'The Grand Bistro');

      assert.doesNotThrow(() => realtimeCustomerOrderPayloadSchema.parse(payload));
      assert.equal(payload.statusToken, testStatusToken);
      assert.equal(payload.orderNumber, '5012');
      assert.equal(payload.status, 'preparing');
      assert.equal(payload.restaurantName, 'The Grand Bistro');
      assert.equal(payload.tableNumber, '12');
    });
  });

  describe('2. Sanitization & Secrets / PII Protection (Requirement 4)', () => {
    test('customer tracking payloads never leak customer phone numbers, session tokens, or R2 credentials', () => {
      const mockOrderWithSensitiveData = {
        id: crypto.randomUUID(),
        statusToken: testStatusToken,
        orderNumber: '9901',
        status: 'accepted',
        customerName: 'Confidential VIP',
        customerPhone: '+91 98765 00000', // Sensitive PII
        r2SecretKey: 'mock-secret-r2-key', // Secret
        sessionToken: 'sess_secret_xyz123', // Secret
        updatedAt: new Date().toISOString()
      };

      const sanitized = sanitizeCustomerOrderPayload(mockOrderWithSensitiveData);

      // Verify that sensitive keys are NOT present in output payload
      const json = JSON.stringify(sanitized);
      assert.equal(json.includes('customerPhone'), false);
      assert.equal(json.includes('+91 98765 00000'), false);
      assert.equal(json.includes('r2SecretKey'), false);
      assert.equal(json.includes('mock-secret-r2-key'), false);
      assert.equal(json.includes('sessionToken'), false);
      assert.equal(json.includes('sess_secret_xyz123'), false);
    });
  });

  describe('3. Channel Subscription Authorization & Tenant Isolation (Requirements 2 & 3)', () => {
    test('authorizes active restaurant member for private restaurant channel', async () => {
      const res = await authorizeRestaurantSubscription(testUserOwnerAlphaId, testRestAlphaId);
      assert.equal(res.authorized, true);
      assert.equal(res.role, 'owner');
    });

    test('authorizes staff member of restaurant for private restaurant channel', async () => {
      const res = await authorizeRestaurantSubscription(testUserStaffAlphaId, testRestAlphaId);
      assert.equal(res.authorized, true);
      assert.equal(res.role, 'staff');
    });

    test('rejects unauthenticated subscription attempt to private restaurant channel (401)', async () => {
      const res = await authorizeRestaurantSubscription(null, testRestAlphaId);
      assert.equal(res.authorized, false);
      assert.equal(res.statusCode, 401);
      assert.ok(res.error?.includes('Valid authenticated session required'));
    });

    test('strictly prevents cross-tenant subscription (IDOR protection: Member Alpha -> Restaurant Beta) (403)', async () => {
      // User Alpha belongs only to Restaurant Alpha, attempts to listen to Restaurant Beta
      const res = await authorizeRestaurantSubscription(testUserOwnerAlphaId, testRestBetaId);
      assert.equal(res.authorized, false);
      assert.equal(res.statusCode, 403);
      assert.ok(res.error?.includes('Forbidden: You are not an authorized member'));
    });

    test('authorizes customer subscription with valid statusToken', async () => {
      const res = await authorizeOrderSubscription(testStatusToken);
      assert.equal(res.authorized, true);
      assert.equal(res.orderId, testOrderId);
    });

    test('rejects customer subscription with fabricated or missing statusToken (400 / 404)', async () => {
      // Missing token
      const missingRes = await authorizeOrderSubscription('');
      assert.equal(missingRes.authorized, false);
      assert.equal(missingRes.statusCode, 400);

      // Fabricated token not in database
      const fabricatedToken = 'status_tok_' + crypto.randomBytes(24).toString('hex');
      const notFoundRes = await authorizeOrderSubscription(fabricatedToken);
      assert.equal(notFoundRes.authorized, false);
      assert.equal(notFoundRes.statusCode, 404);
    });

    test('verifies channel naming conventions match strict separation', () => {
      assert.equal(REALTIME_CHANNELS.restaurant('rest-123'), 'restaurant:rest-123');
      assert.equal(REALTIME_CHANNELS.customerOrder('tok-abc'), 'order:token:tok-abc');
    });
  });

  describe('4. Mock Provider Boundary & Publishing Operations (Requirements 1 & 8)', () => {
    test('publishOrderCreated dispatches sanitized payload exclusively to private restaurant channel', async () => {
      const sampleOrder = {
        id: testOrderId,
        restaurantId: testRestAlphaId,
        orderNumber: '8801',
        status: 'new',
        totalAmount: 55000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await publishOrderCreated(testRestAlphaId, sampleOrder, [
        { id: '1', productName: 'Paneer Tikka', quantity: 1, unitPrice: 25000 }
      ]);

      assert.equal(mockProvider.restaurantPublishes.length, 1);
      const publish = mockProvider.restaurantPublishes[0];
      assert.equal(publish?.restaurantId, testRestAlphaId);
      assert.equal(publish?.event, REALTIME_EVENTS.ORDER_CREATED);
      assert.equal(publish?.payload.orderNumber, '8801');
      assert.equal(publish?.payload.status, 'new');

      // Order created should NOT broadcast directly to arbitrary customer channels
      assert.equal(mockProvider.orderPublishes.length, 0);
    });

    test('publishOrderUpdated dispatches to private restaurant and customer tracking channel', async () => {
      const updatedOrder = {
        id: testOrderId,
        restaurantId: testRestAlphaId,
        orderNumber: '8801',
        status: 'preparing',
        statusToken: testStatusToken,
        totalAmount: 55000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await publishOrderUpdated(testRestAlphaId, updatedOrder, [], 'Realtime Alpha Diner');

      // 1. Restaurant channel received update
      assert.equal(mockProvider.restaurantPublishes.length, 1);
      assert.equal(mockProvider.restaurantPublishes[0]?.restaurantId, testRestAlphaId);
      assert.equal(mockProvider.restaurantPublishes[0]?.event, REALTIME_EVENTS.ORDER_UPDATED);
      assert.equal(mockProvider.restaurantPublishes[0]?.payload.status, 'preparing');

      // 2. Customer channel received status update
      assert.equal(mockProvider.orderPublishes.length, 1);
      assert.equal(mockProvider.orderPublishes[0]?.statusToken, testStatusToken);
      assert.equal(mockProvider.orderPublishes[0]?.event, REALTIME_EVENTS.ORDER_STATUS_CHANGED);
      assert.equal(mockProvider.orderPublishes[0]?.payload.status, 'preparing');
      assert.equal(mockProvider.orderPublishes[0]?.payload.restaurantName, 'Realtime Alpha Diner');
    });
  });
});
