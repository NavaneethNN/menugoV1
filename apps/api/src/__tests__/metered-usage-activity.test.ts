import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../index';
import {
  qrosDb,
  restaurants,
  tenantUsageEvents,
  tenantInvoices
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import {
  trackOrderUsage,
  trackMenuBrowseUsage,
  trackAdminActionUsage
} from '../lib/usage-tracking-service';
import {
  calculateTenantCost,
  getTenantUsageSummary
} from '../lib/billing-engine';

describe('Metered Usage Activity Tracking (Orders, Menu Scrolling & Admin Changes)', () => {
  const timestamp = Date.now();
  const restId = `test-usage-rest-${timestamp}`;
  const cineId = `test-usage-cine-${timestamp}`;

  before(async () => {
    await qrosDb.insert(restaurants).values([
      {
        id: restId,
        name: 'Usage Test Restaurant',
        slug: `usage-rest-${timestamp}`,
        tenantType: 'restaurant',
        isActive: true
      },
      {
        id: cineId,
        name: 'Usage Test Cinema',
        slug: `usage-cine-${timestamp}`,
        tenantType: 'cinema',
        isActive: true
      }
    ]);
  });

  after(async () => {
    await qrosDb.delete(tenantInvoices).where(inArray(tenantInvoices.restaurantId, [restId, cineId])).catch(() => {});
    await qrosDb.delete(tenantUsageEvents).where(inArray(tenantUsageEvents.restaurantId, [restId, cineId])).catch(() => {});
    await qrosDb.delete(restaurants).where(inArray(restaurants.id, [restId, cineId])).catch(() => {});
  });

  it('1. Order placement adds small metered usage to tenant ledger', async () => {
    await trackOrderUsage({
      restaurantId: restId,
      tenantType: 'restaurant',
      orderId: `ord-test-${timestamp}`,
      totalAmount: 125000,
      itemCount: 3
    });

    const summary = await getTenantUsageSummary(restId);
    const dbQueryUsage = summary.find((s) => s.unit === 'db_queries');
    const cpuUsage = summary.find((s) => s.unit === 'cpu_ms');

    assert.ok(dbQueryUsage, 'Order placement must add db_queries usage');
    assert.ok(Number(dbQueryUsage.totalQuantity) >= 6);
    assert.ok(Number(dbQueryUsage.totalDirectCostPaise) >= 25);

    assert.ok(cpuUsage, 'Order placement must add cpu_ms usage');
    assert.ok(Number(cpuUsage.totalQuantity) >= 150);
    assert.ok(Number(cpuUsage.totalDirectCostPaise) >= 15);
  });

  it('2. Active user browsing and scrolling adds small metered usage', async () => {
    // Menu view
    await trackMenuBrowseUsage({
      restaurantId: restId,
      tenantType: 'restaurant',
      action: 'view'
    });

    // Menu active scrolling
    await trackMenuBrowseUsage({
      restaurantId: restId,
      tenantType: 'restaurant',
      action: 'scroll',
      scrollDepth: 75
    });

    const summary = await getTenantUsageSummary(restId);
    const egressUsage = summary.find((s) => s.unit === 'egress_bytes');
    assert.ok(egressUsage, 'Menu browse must record egress usage');
    assert.ok(Number(egressUsage.totalQuantity) >= 48000);
    assert.ok(Number(egressUsage.totalDirectCostPaise) >= 5);
  });

  it('3. Admin changes (mutations) add small metered usage', async () => {
    await trackAdminActionUsage({
      restaurantId: restId,
      tenantType: 'restaurant',
      method: 'POST',
      path: '/api/products',
      userEmail: 'owner@test.com'
    });

    const summary = await getTenantUsageSummary(restId);
    const workerUsage = summary.find((s) => s.unit === 'worker_execution_ms');
    assert.ok(workerUsage, 'Admin mutation must record worker execution usage');
    assert.ok(Number(workerUsage.totalQuantity) >= 75);
    assert.ok(Number(workerUsage.totalDirectCostPaise) >= 15);
  });

  it('4. Public scroll interaction endpoint accepts telemetry and increments usage', async () => {
    const res = await request(app)
      .post('/api/billing/public/track-interaction')
      .send({
        restaurantId: cineId,
        tenantType: 'cinema',
        action: 'scroll',
        scrollDepth: 60
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const cineSummary = await getTenantUsageSummary(cineId);
    const cineCpu = cineSummary.find((s) => s.unit === 'cpu_ms');
    assert.ok(cineCpu, 'Cinema menu scroll telemetry must increment cinema usage');
    assert.ok(Number(cineCpu.totalQuantity) >= 40);
  });

  it('5. Tenant cost ledger computes customer charge with 70% gross margin on pure metered usage', async () => {
    const periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 60 * 60 * 1000);

    const ledger = await calculateTenantCost(restId, periodStart, periodEnd);
    assert.ok(ledger.directTenantCostPaise > 0, 'Direct cost must be positive from recorded actions');
    assert.ok(ledger.customerChargePaise > ledger.directTenantCostPaise, 'Customer charge must exceed direct cost');
    assert.ok(ledger.grossMarginPercent >= 70.0, 'Gross margin must be >= 70%');
  });
});
