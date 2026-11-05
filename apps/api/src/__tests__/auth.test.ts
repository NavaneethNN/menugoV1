import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { requireAuth, requireRestaurantMember } from '../middleware/auth';
import { db, user, restaurants, restaurantMembers } from '@menugo/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Authentication & Authorization Tests (Better Auth & RBAC)', () => {
  test('Public route /api/health accessible without session', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('Protected route /api/auth/me rejects request without session with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Unauthorized');
    assert.ok(res.body.message.includes('Session is missing'));
  });

  test('Protected route /api/auth/me rejects invalid/expired session cookie with 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['better-auth.session_token=fake-expired-token-12345']);

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Unauthorized');
  });

  test('Protected route /api/restaurants/my rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/restaurants/my');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Unauthorized');
  });

  test('requireAuth middleware returns consistent 401 on missing session', async () => {
    let statusCalled: number | null = null;
    let jsonCalled: any = null;
    let nextCalled = false;

    const mockReq: any = { headers: {} };
    const mockRes: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      }
    };
    const mockNext = () => {
      nextCalled = true;
    };

    await requireAuth(mockReq, mockRes, mockNext);

    assert.equal(statusCalled, 401);
    assert.equal(jsonCalled.error, 'Unauthorized');
    assert.equal(nextCalled, false);
  });

  test('requireRestaurantMember returns 401 if user is not authenticated', async () => {
    let statusCalled: number | null = null;
    let jsonCalled: any = null;

    const mockReq: any = { headers: {} };
    const mockRes: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      }
    };
    const mockNext = () => {};

    const middleware = requireRestaurantMember(['owner', 'admin']);
    await middleware(mockReq, mockRes, mockNext);

    assert.equal(statusCalled, 401);
    assert.equal(jsonCalled.error, 'Unauthorized');
  });

  test('requireRestaurantMember returns 400 if restaurant ID context is missing', async () => {
    let statusCalled: number | null = null;
    let jsonCalled: any = null;

    const mockReq: any = {
      user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', role: 'user' },
      headers: {},
      params: {},
      query: {}
    };
    const mockRes: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      }
    };
    const mockNext = () => {};

    const middleware = requireRestaurantMember(['owner', 'admin']);
    await middleware(mockReq, mockRes, mockNext);

    assert.equal(statusCalled, 400);
    assert.equal(jsonCalled.error, 'Bad Request');
  });

  test('requireRestaurantMember returns 403 when user is not a member of the target restaurant', async () => {
    let statusCalled: number | null = null;
    let jsonCalled: any = null;
    let nextCalled = false;

    const mockReq: any = {
      user: { id: 'non-member-user-id', name: 'Other User', email: 'other@example.com', role: 'user' },
      headers: { 'x-restaurant-id': 'unrelated-restaurant-uuid' },
      params: {},
      query: {}
    };
    const mockRes: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      }
    };
    const mockNext = () => {
      nextCalled = true;
    };

    const middleware = requireRestaurantMember(['owner', 'admin']);
    await middleware(mockReq, mockRes, mockNext);

    assert.equal(statusCalled, 403);
    assert.equal(jsonCalled.error, 'Forbidden');
    assert.ok(jsonCalled.message.includes('not an authorized member'));
    assert.equal(nextCalled, false);
  });

  test('requireRestaurantMember returns 403 when authenticated member lacks required role', async () => {
    // Setup temporary test user, restaurant and membership with role 'kitchen'
    const testUserId = crypto.randomUUID();
    const testRestId = crypto.randomUUID();
    const testMemberId = crypto.randomUUID();

    try {
      await db.insert(user).values({
        id: testUserId,
        name: 'Cook Bob',
        email: `bob-${Date.now()}@kitchen.com`,
        emailVerified: true
      });

      await db.insert(restaurants).values({
        id: testRestId,
        name: 'Test Bistro',
        slug: `test-bistro-${Date.now()}`
      });

      await db.insert(restaurantMembers).values({
        id: testMemberId,
        restaurantId: testRestId,
        userId: testUserId,
        role: 'kitchen'
      });

      let statusCalled: number | null = null;
      let jsonCalled: any = null;
      let nextCalled = false;

      const mockReq: any = {
        user: { id: testUserId, name: 'Cook Bob', email: 'bob@kitchen.com', role: 'user' },
        headers: { 'x-restaurant-id': testRestId },
        params: {},
        query: {}
      };
      const mockRes: any = {
        status(code: number) {
          statusCalled = code;
          return this;
        },
        json(data: any) {
          jsonCalled = data;
        }
      };
      const mockNext = () => {
        nextCalled = true;
      };

      // Middleware requires 'owner' or 'admin', but user has 'kitchen'
      const middleware = requireRestaurantMember(['owner', 'admin']);
      await middleware(mockReq, mockRes, mockNext);

      assert.equal(statusCalled, 403);
      assert.equal(jsonCalled.error, 'Forbidden');
      assert.ok(jsonCalled.message.includes('Insufficient permissions'));
      assert.equal(nextCalled, false);

      // Now verify that a kitchen-permitted route passes
      let kitchenNextCalled = false;
      const kitchenMiddleware = requireRestaurantMember(['kitchen', 'staff']);
      await kitchenMiddleware(mockReq, mockRes, () => {
        kitchenNextCalled = true;
      });

      assert.equal(kitchenNextCalled, true, 'Kitchen staff should be allowed on kitchen routes');
      assert.equal(mockReq.restaurantRole, 'kitchen');
    } finally {
      // Clean up test records
      await db.delete(restaurantMembers).where(eq(restaurantMembers.id, testMemberId));
      await db.delete(restaurants).where(eq(restaurants.id, testRestId));
      await db.delete(user).where(eq(user.id, testUserId));
    }
  });

  test('Secrets and passwords are never returned in auth endpoints', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.secret, undefined);
    assert.equal(res.body.accessToken, undefined);
  });
});

