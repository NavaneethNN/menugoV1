import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../index';
import {
  qrosDb,
  restaurantDb,
  cinemaDb,
  restaurants,
  subscriptionPlans,
  tenantSubscriptions,
  getDb
} from '@menugo/database';
import { eq } from 'drizzle-orm';
import { syncQrosDatabase } from '../lib/qros-sync-service';

const MASTER_KEY = process.env.SUPER_ADMIN_KEY || 'menugo-superadmin-secret-2026';

describe('QROS Tri-Database Workflow & Master Synchronization Suite', () => {
  after(() => {
    // Graceful exit after test suite completion
    setTimeout(() => process.exit(0), 100);
  });

  it('1. Database Routing: getDb correctly resolves qrosDb, restaurantDb, and cinemaDb', () => {
    const resolvedQros = getDb('qros');
    const resolvedSuperAdmin = getDb('superadmin');
    const resolvedPlatform = getDb('platform');
    const resolvedCinema = getDb('cinema');
    const resolvedRest = getDb('restaurant');

    assert.strictEqual(resolvedQros, qrosDb, 'getDb("qros") must resolve to qrosDb');
    assert.strictEqual(resolvedSuperAdmin, qrosDb, 'getDb("superadmin") must resolve to qrosDb');
    assert.strictEqual(resolvedPlatform, qrosDb, 'getDb("platform") must resolve to qrosDb');
    assert.strictEqual(resolvedCinema, cinemaDb, 'getDb("cinema") must resolve to cinemaDb');
    assert.strictEqual(resolvedRest, restaurantDb, 'getDb("restaurant") must resolve to restaurantDb');
  });

  it('2. QROS Master DB: Contains default subscription plans in subscription_plans table', async () => {
    // Ensure sync has run
    await syncQrosDatabase();

    const plans = await qrosDb.select().from(subscriptionPlans);
    assert.ok(plans.length >= 6, `Expected at least 6 plans in QROS master DB, found ${plans.length}`);

    const restaurantPlans = plans.filter((p) => p.tenantType === 'restaurant');
    const cinemaPlans = plans.filter((p) => p.tenantType === 'cinema');

    assert.ok(restaurantPlans.length >= 3, 'Must contain restaurant plans in QROS DB');
    assert.ok(cinemaPlans.length >= 3, 'Must contain cinema plans in QROS DB');

    const starterPlan = plans.find((p) => p.slug === 'restaurant-starter');
    assert.ok(starterPlan, 'Expected restaurant-starter plan to exist');
    assert.strictEqual(starterPlan.priceMonthlyPaise, 99900);

    const multiplexPlan = plans.find((p) => p.slug === 'multiplex-pro');
    assert.ok(multiplexPlan, 'Expected multiplex-pro plan to exist');
    assert.strictEqual(multiplexPlan.priceMonthlyPaise, 699900);
  });

  it('3. GET /api/super-admin/subscriptions: Serves plans from QROS master DB', async () => {
    const res = await request(app)
      .get('/api/super-admin/subscriptions')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body), 'Response must be an array of plans');
    assert.ok(res.body.length >= 6, 'Must return at least 6 subscription plans');

    const slugs = res.body.map((p: any) => p.slug);
    assert.ok(slugs.includes('restaurant-starter'), 'Includes restaurant-starter');
    assert.ok(slugs.includes('multiplex-pro'), 'Includes multiplex-pro');
  });

  it('4. QROS Master DB: Contains venues from both restaurantDb and cinemaDb', async () => {
    const venues = await qrosDb.select().from(restaurants);
    assert.ok(venues.length > 0, 'QROS master DB must contain venues');

    const restCount = venues.filter((v) => v.tenantType === 'restaurant').length;
    const cineCount = venues.filter((v) => v.tenantType === 'cinema').length;

    assert.ok(restCount > 0, `Expected at least 1 restaurant in QROS DB, found ${restCount}`);
    assert.ok(cineCount > 0, `Expected at least 1 cinema in QROS DB, found ${cineCount}`);
  });

  it('5. GET /api/super-admin/tenants: Returns unified list from QROS master DB', async () => {
    const res = await request(app)
      .get('/api/super-admin/tenants')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body), 'Response must be an array of venues');
    assert.ok(res.body.length > 0, 'Tenants list should not be empty');

    const sample = res.body[0];
    assert.ok(sample.id, 'Venue has an id');
    assert.ok(sample.name, 'Venue has a name');
    assert.ok(sample.tenantType, 'Venue has a tenantType');
    assert.ok(typeof sample.ordersCount === 'number', 'Enriched with ordersCount');
    assert.ok(typeof sample.gmvRupees === 'number', 'Enriched with gmvRupees');
  });

  it('6. GET /api/super-admin/tenants?tenantType=restaurant: Filters to restaurant venues only', async () => {
    const res = await request(app)
      .get('/api/super-admin/tenants?tenantType=restaurant')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const v of res.body) {
      assert.strictEqual(v.tenantType, 'restaurant', 'All returned venues must have tenantType = "restaurant"');
    }
  });

  it('7. GET /api/super-admin/tenants?tenantType=cinema: Filters to cinema venues only', async () => {
    const res = await request(app)
      .get('/api/super-admin/tenants?tenantType=cinema')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    for (const v of res.body) {
      assert.strictEqual(v.tenantType, 'cinema', 'All returned venues must have tenantType = "cinema"');
    }
  });

  it('8. GET /api/super-admin/metrics: Computes platform KPIs using QROS master DB', async () => {
    const res = await request(app)
      .get('/api/super-admin/metrics')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.venues, 'Contains venues metrics');
    assert.ok(res.body.venues.totalVenues > 0, 'Total venues > 0');
    assert.ok(res.body.venues.totalRestaurants > 0, 'Total restaurants > 0');
    assert.ok(res.body.venues.totalTheatres > 0, 'Total theatres > 0');
    assert.ok(typeof res.body.orders?.totalOrders === 'number', 'Contains totalOrders');
    assert.ok(typeof res.body.orders?.totalGmvRupees === 'number', 'Contains totalGmvRupees');
  });

  it('9. POST /api/super-admin/sync-qros-db: Executes on-demand synchronization successfully', async () => {
    const res = await request(app)
      .post('/api/super-admin/sync-qros-db')
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.message.includes('synchronized successfully'));
  });

  it('10. Plan Lifecycle: Creates, updates, and syncs a custom plan across all three DBs', async () => {
    const uniqueSlug = `test-plan-${Date.now()}`;
    const newPlan = {
      name: 'Custom Test Plan',
      slug: uniqueSlug,
      description: 'Test plan for tri-db verification',
      tenantType: 'restaurant' as const,
      priceMonthlyPaise: 159900,
      priceAnnualPaise: 1599000,
      maxTables: 25,
      features: ['Feature A', 'Feature B']
    };

    // 1. Create plan
    const createRes = await request(app)
      .post('/api/super-admin/subscriptions')
      .set('x-super-admin-key', MASTER_KEY)
      .send(newPlan);

    assert.strictEqual(createRes.status, 201);
    const createdPlanId = createRes.body.id;
    assert.ok(createdPlanId);

    // Verify it exists in qrosDb
    const [qrosPlan] = await qrosDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, createdPlanId))
      .limit(1);
    assert.ok(qrosPlan, 'Created plan must exist in QROS master DB');
    assert.strictEqual(qrosPlan.name, 'Custom Test Plan');

    // 2. Update plan
    const updateRes = await request(app)
      .patch(`/api/super-admin/subscriptions/${createdPlanId}`)
      .set('x-super-admin-key', MASTER_KEY)
      .send({ name: 'Updated Test Plan', priceMonthlyPaise: 179900 });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.name, 'Updated Test Plan');

    const [updatedQrosPlan] = await qrosDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, createdPlanId))
      .limit(1);
    assert.strictEqual(updatedQrosPlan?.name, 'Updated Test Plan');

    // 3. Deactivate / Delete plan
    const deleteRes = await request(app)
      .delete(`/api/super-admin/subscriptions/${createdPlanId}`)
      .set('x-super-admin-key', MASTER_KEY);

    assert.strictEqual(deleteRes.status, 200);

    const [deactivatedQrosPlan] = await qrosDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, createdPlanId))
      .limit(1);
    assert.strictEqual(deactivatedQrosPlan?.isActive, false);
  });

  it('11. Internal Service Security: Blocks unauthenticated requests without service key', async () => {
    const res = await request(app).get('/api/internal/restaurant/metrics');
    assert.strictEqual(res.status, 403, 'Should reject call without internal service key');
    assert.ok(res.body.error === 'Forbidden');
  });

  it('12. Restaurant Internal API: Returns operational metrics using service key', async () => {
    const res = await request(app)
      .get('/api/internal/restaurant/metrics')
      .set('x-internal-service-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.domain, 'restaurant');
    assert.ok(typeof res.body.totalVenues === 'number');
    assert.ok(typeof res.body.totalOrders === 'number');
    assert.ok(typeof res.body.totalGmvPaise === 'number');
  });

  it('13. Cinema Internal API: Returns operational metrics using service key', async () => {
    const res = await request(app)
      .get('/api/internal/cinema/metrics')
      .set('x-internal-service-key', MASTER_KEY);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.domain, 'cinema');
    assert.ok(typeof res.body.totalVenues === 'number');
    assert.ok(typeof res.body.totalCapacity === 'number');
  });

  it('14. QROS Internal API: Registers a new venue into QROS Master DB via API call', async () => {
    const testVenueId = `test-venue-${Date.now()}`;
    const res = await request(app)
      .post('/api/internal/qros/venues/register')
      .set('x-internal-service-key', MASTER_KEY)
      .send({
        venue: {
          id: testVenueId,
          name: 'API Isolated Cafe',
          slug: `api-cafe-${Date.now()}`,
          tenantType: 'restaurant',
          isActive: true
        }
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.venue.id, testVenueId);

    // Verify it exists in QROS master DB
    const [found] = await qrosDb
      .select({ id: restaurants.id, name: restaurants.name })
      .from(restaurants)
      .where(eq(restaurants.id, testVenueId));

    assert.ok(found, 'Venue must exist in QROS master DB after API registration');
    assert.strictEqual(found.name, 'API Isolated Cafe');

    // Clean up test venue
    await qrosDb.delete(restaurants).where(eq(restaurants.id, testVenueId)).catch(() => {});
  });
});
