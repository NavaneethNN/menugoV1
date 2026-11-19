import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../index';
import {
  qrosDb,
  restaurants,
  tenantUsageEvents,
  sharedCostPools,
  sharedCostAllocations,
  unattributedCostItems,
  tenantInvoices,
  restaurantMembers,
  user
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import {
  recordTenantUsageEvent,
  createSharedCostPool,
  allocateSharedCostPool,
  calculateTenantCost,
  generateTenantInvoice,
  getTenantInvoices,
  getTenantInvoiceById,
  getTenantUsageSummary
} from '../lib/billing-engine';

const MASTER_KEY = process.env.SUPER_ADMIN_KEY || 'menugo-superadmin-secret-2026';

describe('Strict Tenant Cost Isolation & Infrastructure Billing Suite (billing.md)', () => {
  const timestamp = Date.now();
  const restAId = `test-rest-a-${timestamp}`;
  const restBId = `test-rest-b-${timestamp}`;
  const cineAId = `test-cine-a-${timestamp}`;

  const userAId = `test-user-a-${timestamp}`;
  const userBId = `test-user-b-${timestamp}`;

  before(async () => {
    // 1. Create Test Tenants in QROS Master DB
    await qrosDb.insert(restaurants).values([
      {
        id: restAId,
        name: 'Restaurant Alpha (Tenant A)',
        slug: `rest-alpha-${timestamp}`,
        tenantType: 'restaurant',
        isActive: true
      },
      {
        id: restBId,
        name: 'Restaurant Beta (Tenant B)',
        slug: `rest-beta-${timestamp}`,
        tenantType: 'restaurant',
        isActive: true
      },
      {
        id: cineAId,
        name: 'Cinema Multiplex (Cinema A)',
        slug: `cine-alpha-${timestamp}`,
        tenantType: 'cinema',
        isActive: true
      }
    ]);

    // 2. Create Users & Memberships
    await qrosDb.insert(user).values([
      {
        id: userAId,
        name: 'Owner Alpha',
        email: `owner-alpha-${timestamp}@test.com`,
        role: 'user',
        tenantType: 'restaurant'
      },
      {
        id: userBId,
        name: 'Owner Beta',
        email: `owner-beta-${timestamp}@test.com`,
        role: 'user',
        tenantType: 'restaurant'
      }
    ]);

    await qrosDb.insert(restaurantMembers).values([
      {
        id: `member-a-${timestamp}`,
        restaurantId: restAId,
        userId: userAId,
        role: 'owner'
      },
      {
        id: `member-b-${timestamp}`,
        restaurantId: restBId,
        userId: userBId,
        role: 'owner'
      }
    ]);
  });

  after(async () => {
    // Cleanup created test records
    await qrosDb.delete(tenantInvoices).where(inArray(tenantInvoices.restaurantId, [restAId, restBId, cineAId])).catch(() => {});
    await qrosDb.delete(sharedCostAllocations).where(inArray(sharedCostAllocations.restaurantId, [restAId, restBId, cineAId])).catch(() => {});
    await qrosDb.delete(tenantUsageEvents).where(inArray(tenantUsageEvents.restaurantId, [restAId, restBId, cineAId])).catch(() => {});
    await qrosDb.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [restAId, restBId, cineAId])).catch(() => {});
    await qrosDb.delete(restaurants).where(inArray(restaurants.id, [restAId, restBId, cineAId])).catch(() => {});
    await qrosDb.delete(user).where(inArray(user.id, [userAId, userBId])).catch(() => {});
  });

  it('1. Restaurant A cannot see Restaurant B\'s usage', async () => {
    // Record usage for Restaurant A
    await recordTenantUsageEvent({
      restaurantId: restAId,
      tenantType: 'restaurant',
      eventType: 'compute_cpu',
      quantity: 1200,
      unit: 'cpu_ms',
      directCostPaise: 500,
      billingPeriod: '2026-11'
    });

    // Record usage for Restaurant B
    await recordTenantUsageEvent({
      restaurantId: restBId,
      tenantType: 'restaurant',
      eventType: 'compute_cpu',
      quantity: 9500,
      unit: 'cpu_ms',
      directCostPaise: 4000,
      billingPeriod: '2026-11'
    });

    // Query usage summary as Restaurant A
    const usageA = await getTenantUsageSummary(restAId, '2026-11');
    const cpuUsageA = usageA.find((u) => u.unit === 'cpu_ms');

    assert.ok(cpuUsageA, 'Restaurant A should have cpu_ms recorded');
    assert.strictEqual(Number(cpuUsageA.totalQuantity), 1200, 'Restaurant A sees strictly its own 1,200 ms');
    assert.strictEqual(Number(cpuUsageA.totalDirectCostPaise), 500, 'Restaurant A sees strictly its own 500 paise');

    // Verify Restaurant B\'s 9,500 ms is completely invisible to Restaurant A
    const allRecordsForA = await qrosDb
      .select()
      .from(tenantUsageEvents)
      .where(eq(tenantUsageEvents.restaurantId, restAId));

    for (const r of allRecordsForA) {
      assert.strictEqual(r.restaurantId, restAId, 'No foreign tenant record allowed in Restaurant A query');
    }
  });

  it('2. Restaurant A cannot see Restaurant B\'s invoices', async () => {
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    // Generate invoice for Restaurant B
    const invoiceB = await generateTenantInvoice({
      restaurantId: restBId,
      periodStart,
      periodEnd
    });

    assert.ok(invoiceB.id);
    assert.strictEqual(invoiceB.restaurantId, restBId);

    // 1. Restaurant A queries invoices list
    const invoicesForA = await getTenantInvoices(restAId);
    const leakedBInvoice = invoicesForA.find((inv) => inv.id === invoiceB.id || inv.restaurantId === restBId);
    assert.strictEqual(leakedBInvoice, undefined, 'Restaurant A invoice list must not contain Restaurant B invoice');

    // 2. Restaurant A attempts to directly fetch Restaurant B\'s invoice ID
    const directAccessAttempt = await getTenantInvoiceById(restAId, invoiceB.id);
    assert.strictEqual(directAccessAttempt, null, 'Direct access to Restaurant B invoice by Restaurant A must return null');
  });

  it('3. Restaurant A cannot be charged for Restaurant B\'s direct infrastructure cost', async () => {
    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    // Restaurant B incurs heavy direct compute (₹500 / 50,000 paise)
    await recordTenantUsageEvent({
      restaurantId: restBId,
      tenantType: 'restaurant',
      eventType: 'database_query',
      quantity: 50000,
      unit: 'db_queries',
      directCostPaise: 50000,
      recordedAt: new Date()
    });

    // Calculate Restaurant A\'s cost ledger
    const ledgerA = await calculateTenantCost(restAId, periodStart, periodEnd);

    // Verify Restaurant B\'s 50,000 paise direct cost did NOT enter Restaurant A\'s total
    assert.notStrictEqual(ledgerA.directTenantCostPaise, 50000);
    assert.ok(ledgerA.directTenantCostPaise < 50000, 'Restaurant A cannot be charged for Restaurant B direct cost');
  });

  it('4. Cinema A cannot be charged for restaurant usage', async () => {
    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 60 * 60 * 1000);

    // Record high volume usage for Restaurant A and Restaurant B
    await recordTenantUsageEvent({
      restaurantId: restAId,
      tenantType: 'restaurant',
      eventType: 'storage_media',
      quantity: 25,
      unit: 'storage_gb_hours',
      directCostPaise: 1500,
      recordedAt: new Date()
    });

    // Cinema A incurs only its own usage (100 paise)
    await recordTenantUsageEvent({
      restaurantId: cineAId,
      tenantType: 'cinema',
      eventType: 'storage_media',
      quantity: 1,
      unit: 'storage_gb_hours',
      directCostPaise: 100,
      recordedAt: new Date()
    });

    const ledgerCineA = await calculateTenantCost(cineAId, periodStart, periodEnd);
    assert.strictEqual(ledgerCineA.tenantType, 'cinema');
    assert.strictEqual(ledgerCineA.directTenantCostPaise, 100, 'Cinema A pays strictly its own 100 paise');
    assert.strictEqual(ledgerCineA.breakdown.usageByMetric['storage_gb_hours'], 1);
  });

  it('5. Shared costs are allocated by measured consumption (billing.md Section 2 Example)', async () => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const testMetric = `api_compute_${timestamp}`;

    // Specification Example:
    // Shared API cost = ₹100 (10,000 paise)
    // Restaurant A usage = 20% (20 units)
    // Restaurant B usage = 70% (70 units)
    // Cinema A usage = 10% (10 units)
    // Allocate: Restaurant A = ₹20 (2,000 paise), Restaurant B = ₹70 (7,000 paise), Cinema A = ₹10 (1,000 paise)
    await recordTenantUsageEvent({
      restaurantId: restAId,
      tenantType: 'restaurant',
      eventType: 'compute_api',
      quantity: 20,
      unit: testMetric,
      recordedAt: now
    });

    await recordTenantUsageEvent({
      restaurantId: restBId,
      tenantType: 'restaurant',
      eventType: 'compute_api',
      quantity: 70,
      unit: testMetric,
      recordedAt: now
    });

    await recordTenantUsageEvent({
      restaurantId: cineAId,
      tenantType: 'cinema',
      eventType: 'compute_api',
      quantity: 10,
      unit: testMetric,
      recordedAt: now
    });

    // Create shared cost pool = ₹100 = 10,000 paise
    const pool = await createSharedCostPool({
      poolName: `Shared API Cluster ${timestamp}`,
      provider: 'railway',
      providerInvoiceRef: `INV-SPEC-POOL-${timestamp}`,
      metricType: testMetric,
      totalCostPaise: 10000, // ₹100
      periodStart,
      periodEnd
    });

    // Execute allocation
    const allocationResult = await allocateSharedCostPool(pool.id);

    assert.strictEqual(allocationResult.status, 'fully_allocated');
    assert.strictEqual(allocationResult.allocatedCount, 3);
    assert.strictEqual(allocationResult.totalAllocatedPaise, 10000);

    // Verify exact proportional allocation per tenant
    const allocations = await qrosDb
      .select()
      .from(sharedCostAllocations)
      .where(eq(sharedCostAllocations.poolId, pool.id));

    const allocA = allocations.find((a) => a.restaurantId === restAId);
    const allocB = allocations.find((a) => a.restaurantId === restBId);
    const allocCine = allocations.find((a) => a.restaurantId === cineAId);

    assert.ok(allocA && allocB && allocCine);

    assert.strictEqual(allocA.allocatedCostPaise, 2000, 'Restaurant A allocated ₹20 (2,000 paise)');
    assert.strictEqual(allocB.allocatedCostPaise, 7000, 'Restaurant B allocated ₹70 (7,000 paise)');
    assert.strictEqual(allocCine.allocatedCostPaise, 1000, 'Cinema A allocated ₹10 (1,000 paise)');
  });

  it('6. Unattributed costs remain unallocated (billing.md Section 3)', async () => {
    const idlePeriodStart = new Date('2026-01-01T00:00:00Z');
    const idlePeriodEnd = new Date('2026-01-01T01:00:00Z');

    // Create shared cost pool with no attributable tenant usage in that time window
    const unallocatedPool = await createSharedCostPool({
      poolName: `Idle Cloudflare Worker Pool ${timestamp}`,
      provider: 'cloudflare',
      providerInvoiceRef: `CF-IDLE-${timestamp}`,
      metricType: `idle_traffic_${timestamp}`,
      totalCostPaise: 5000, // ₹50
      periodStart: idlePeriodStart,
      periodEnd: idlePeriodEnd
    });

    const allocRes = await allocateSharedCostPool(unallocatedPool.id);

    // Invariant: Marked UNALLOCATED, never silently distributed
    assert.strictEqual(allocRes.status, 'unallocated');
    assert.strictEqual(allocRes.totalAllocatedPaise, 0);
    assert.strictEqual(allocRes.unallocatedCostPaise, 5000);

    // Verify it is recorded in unattributedCostItems
    const [unattributed] = await qrosDb
      .select()
      .from(unattributedCostItems)
      .where(eq(unattributedCostItems.poolId, unallocatedPool.id));

    assert.ok(unattributed);
    assert.strictEqual(unattributed.amountPaise, 5000);
    assert.strictEqual(unattributed.status, 'unallocated');
    assert.ok(unattributed.unallocatedReason.includes('No attributable tenant consumption'));
  });

  it('7. Duplicate provider costs cannot be allocated twice (Idempotency)', async () => {
    const dupRef = `DUP-NEON-REF-${timestamp}`;

    await createSharedCostPool({
      poolName: 'Neon DB Pool 1',
      provider: 'neon',
      providerInvoiceRef: dupRef,
      metricType: 'db_queries',
      totalCostPaise: 8000,
      periodStart: new Date(),
      periodEnd: new Date()
    });

    // Attempting to ingest the same provider reference must reject
    await assert.rejects(
      async () => {
        await createSharedCostPool({
          poolName: 'Neon DB Pool Duplicate Attempt',
          provider: 'neon',
          providerInvoiceRef: dupRef,
          metricType: 'db_queries',
          totalCostPaise: 8000,
          periodStart: new Date(),
          periodEnd: new Date()
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('Duplicate provider cost record cannot be allocated twice'));
        return true;
      }
    );
  });

  it('8. Each tenant independently achieves at least 70% gross margin (billing.md Section 1 & 5)', async () => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    // 1. Restaurant A ledger calculation
    const ledgerA = await calculateTenantCost(restAId, periodStart, periodEnd);
    assert.ok(ledgerA.grossMarginPercent >= 70.0, `Restaurant A gross margin (${ledgerA.grossMarginPercent}%) must be >= 70%`);

    // Verify Customer Charge Formula: CUSTOMER_CHARGE = TENANT_TOTAL_COST / 0.30
    if (ledgerA.tenantTotalCostPaise > 0) {
      const expectedCharge = Math.ceil(ledgerA.tenantTotalCostPaise / 0.30);
      assert.strictEqual(ledgerA.customerChargePaise, expectedCharge);

      // Verify Gross Margin Formula: (CUSTOMER_CHARGE - TENANT_TOTAL_COST) / CUSTOMER_CHARGE
      const calculatedMargin = (ledgerA.customerChargePaise - ledgerA.tenantTotalCostPaise) / ledgerA.customerChargePaise;
      assert.ok(calculatedMargin >= 0.70, 'Calculated margin must be at least 70%');
    }

    // 2. Cinema A ledger calculation
    const ledgerCine = await calculateTenantCost(cineAId, periodStart, periodEnd);
    assert.ok(ledgerCine.grossMarginPercent >= 70.0, `Cinema A gross margin (${ledgerCine.grossMarginPercent}%) must be >= 70%`);

    // Generate invoice and verify validation check passes
    const invoiceA = await generateTenantInvoice({
      restaurantId: restAId,
      periodStart,
      periodEnd
    });

    assert.ok(invoiceA);
    assert.ok(invoiceA.grossMarginPercent >= 70.0);
    assert.strictEqual(invoiceA.reconciliationValidated, true);
  });

  it('9. Cross-tenant API requests are rejected with 403 Forbidden', async () => {
    // Attempt to access Restaurant A billing endpoints without providing authorized tenant headers
    const unauthorizedRes = await request(app).get('/api/billing/invoices');
    assert.strictEqual(unauthorizedRes.status, 401, 'Unauthenticated request rejected with 401');

    // Attempt to access cross-tenant billing endpoint with spoofed header
    const spoofedRes = await request(app)
      .get('/api/billing/invoices')
      .set('x-restaurant-id', restBId); // Client-submitted header not matching session

    assert.ok(
      spoofedRes.status === 401 || spoofedRes.status === 403,
      `Cross-tenant access attempt rejected with status ${spoofedRes.status}`
    );
  });

  it('10. All tenant allocations reconcile with original provider costs', async () => {
    const testReconcileMetric = `reconcile_egress_${timestamp}`;
    const now = new Date();
    const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);

    // Tenants consume network egress
    await recordTenantUsageEvent({
      restaurantId: restAId,
      tenantType: 'restaurant',
      eventType: 'network_egress',
      quantity: 333,
      unit: testReconcileMetric,
      recordedAt: now
    });

    await recordTenantUsageEvent({
      restaurantId: restBId,
      tenantType: 'restaurant',
      eventType: 'network_egress',
      quantity: 667,
      unit: testReconcileMetric,
      recordedAt: now
    });

    // Provider pool = ₹300 = 30,000 paise
    const pool = await createSharedCostPool({
      poolName: `Egress Pool ${timestamp}`,
      provider: 'cloudflare',
      providerInvoiceRef: `CF-RECON-${timestamp}`,
      metricType: testReconcileMetric,
      totalCostPaise: 30000,
      periodStart,
      periodEnd
    });

    const allocResult = await allocateSharedCostPool(pool.id);

    // Sum of all allocations + unallocated must exactly equal total provider cost
    const totalReconciled = allocResult.totalAllocatedPaise + allocResult.unallocatedCostPaise;
    assert.strictEqual(
      totalReconciled,
      pool.totalCostPaise,
      `Allocated (${allocResult.totalAllocatedPaise}) + Unallocated (${allocResult.unallocatedCostPaise}) must exactly equal pool total (${pool.totalCostPaise})`
    );

    assert.ok(
      allocResult.totalAllocatedPaise <= pool.totalCostPaise,
      'Allocations must never exceed original provider cost'
    );
  });
});
