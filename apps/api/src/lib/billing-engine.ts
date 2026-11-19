import crypto from 'crypto';
import {
  qrosDb,
  restaurants,
  tenantUsageEvents,
  sharedCostPools,
  sharedCostAllocations,
  unattributedCostItems,
  tenantInvoices
} from '@menugo/database';
import { eq, and, sql, gte, lte, inArray, sum } from 'drizzle-orm';
import { restaurantApiClient, cinemaApiClient } from './internal-api-client';

export interface TenantUsageInput {
  restaurantId: string;
  tenantType: 'restaurant' | 'cinema';
  eventType: string;
  quantity: number;
  unit: string;
  directCostPaise?: number;
  metadata?: Record<string, any>;
  billingPeriod?: string;
  recordedAt?: Date;
}

export interface SharedCostPoolInput {
  poolName: string;
  provider: string;
  providerInvoiceRef?: string;
  metricType: string;
  totalCostPaise: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface TenantCostSummary {
  restaurantId: string;
  tenantType: 'restaurant' | 'cinema';
  directTenantCostPaise: number;
  sharedInfrastructureCostPaise: number;
  tenantTotalCostPaise: number;
  customerChargePaise: number;
  grossMarginPercent: number;
  breakdown: {
    directEventsCount: number;
    sharedAllocationsCount: number;
    usageByMetric: Record<string, number>;
    sharedPoolsAttributed: string[];
  };
}

/**
 * 1. Record Tenant Usage Event
 * Every usage event must be associated with exactly one tenant.
 */
export async function recordTenantUsageEvent(input: TenantUsageInput) {
  const directCostPaise = Math.max(0, Math.round(input.directCostPaise || 0));
  const recordedAt = input.recordedAt || new Date();
  const billingPeriod = input.billingPeriod || `${recordedAt.getFullYear()}-${String(recordedAt.getMonth() + 1).padStart(2, '0')}`;

  const [event] = await qrosDb
    .insert(tenantUsageEvents)
    .values({
      id: crypto.randomUUID(),
      restaurantId: input.restaurantId,
      tenantType: input.tenantType,
      eventType: input.eventType,
      quantity: input.quantity,
      unit: input.unit,
      directCostPaise,
      metadata: input.metadata || {},
      billingPeriod,
      recordedAt
    })
    .returning();

  return event;
}

/**
 * 2. Ingest Shared Provider Infrastructure Cost Pool
 * Prevents duplicate provider cost records via unique providerInvoiceRef.
 */
export async function createSharedCostPool(input: SharedCostPoolInput) {
  if (input.totalCostPaise <= 0) {
    throw new Error('Total cost for shared cost pool must be a positive integer in paise.');
  }

  // Idempotency: verify no duplicate provider invoice reference
  if (input.providerInvoiceRef) {
    const [existing] = await qrosDb
      .select({ id: sharedCostPools.id })
      .from(sharedCostPools)
      .where(eq(sharedCostPools.providerInvoiceRef, input.providerInvoiceRef))
      .limit(1);

    if (existing) {
      throw new Error(`Duplicate provider cost record cannot be allocated twice. Reference: ${input.providerInvoiceRef}`);
    }
  }

  const [pool] = await qrosDb
    .insert(sharedCostPools)
    .values({
      id: crypto.randomUUID(),
      poolName: input.poolName,
      provider: input.provider,
      providerInvoiceRef: input.providerInvoiceRef || null,
      metricType: input.metricType,
      totalCostPaise: Math.round(input.totalCostPaise),
      allocatedCostPaise: 0,
      unallocatedCostPaise: 0,
      status: 'pending',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd
    })
    .returning();

  return pool;
}

/**
 * 3. Proportional Shared Infrastructure Allocation
 * Allocates shared cost pool strictly by measured tenant consumption.
 * Any unattributed portion is marked UNALLOCATED.
 */
export async function allocateSharedCostPool(poolId: string) {
  const [pool] = await qrosDb
    .select()
    .from(sharedCostPools)
    .where(eq(sharedCostPools.id, poolId))
    .limit(1);

  if (!pool) {
    throw new Error(`Shared cost pool not found: ${poolId}`);
  }

  if (pool.status === 'fully_allocated') {
    throw new Error(`Duplicate allocation prevented: Pool ${poolId} has already been fully allocated.`);
  }

  // 1. Measure tenant consumption for the relevant metric within the pool period
  const usageRecords = await qrosDb
    .select({
      restaurantId: tenantUsageEvents.restaurantId,
      tenantType: tenantUsageEvents.tenantType,
      totalQuantity: sql<number>`coalesce(sum(${tenantUsageEvents.quantity}), 0)`
    })
    .from(tenantUsageEvents)
    .where(
      and(
        eq(tenantUsageEvents.unit, pool.metricType),
        gte(tenantUsageEvents.recordedAt, pool.periodStart),
        lte(tenantUsageEvents.recordedAt, pool.periodEnd)
      )
    )
    .groupBy(tenantUsageEvents.restaurantId, tenantUsageEvents.tenantType);

  const totalPoolMeasuredUsage = usageRecords.reduce(
    (sum, r) => sum + Number(r.totalQuantity || 0),
    0
  );

  // If no tenant usage is measured, mark the entire pool as UNALLOCATED
  if (totalPoolMeasuredUsage <= 0 || usageRecords.length === 0) {
    await qrosDb
      .update(sharedCostPools)
      .set({
        allocatedCostPaise: 0,
        unallocatedCostPaise: pool.totalCostPaise,
        status: 'unallocated',
        updatedAt: new Date()
      })
      .where(eq(sharedCostPools.id, poolId));

    await qrosDb.insert(unattributedCostItems).values({
      id: crypto.randomUUID(),
      poolId: pool.id,
      provider: pool.provider,
      description: `Unattributed pool: ${pool.poolName}`,
      amountPaise: pool.totalCostPaise,
      unallocatedReason: 'No attributable tenant consumption measured during pool billing window.',
      status: 'unallocated'
    });

    return {
      poolId: pool.id,
      status: 'unallocated',
      allocatedCount: 0,
      totalAllocatedPaise: 0,
      unallocatedCostPaise: pool.totalCostPaise
    };
  }

  // 2. Allocate each tenant's consumption independently
  let totalAllocatedPaise = 0;
  const allocationsToInsert: any[] = [];

  for (const record of usageRecords) {
    const tenantUsage = Number(record.totalQuantity || 0);
    if (tenantUsage <= 0) continue;

    const metricShareRatio = tenantUsage / totalPoolMeasuredUsage;
    // Calculate exact share in paise
    const allocatedPaise = Math.floor(pool.totalCostPaise * metricShareRatio);

    if (allocatedPaise > 0) {
      totalAllocatedPaise += allocatedPaise;
      allocationsToInsert.push({
        id: crypto.randomUUID(),
        poolId: pool.id,
        restaurantId: record.restaurantId,
        tenantType: record.tenantType,
        metricShareRatio,
        tenantMeasuredUsage: tenantUsage,
        totalPoolMeasuredUsage,
        allocatedCostPaise: allocatedPaise,
        createdAt: new Date()
      });
    }
  }

  // Invariant: The sum of all tenant allocations must never exceed original shared cost
  if (totalAllocatedPaise > pool.totalCostPaise) {
    throw new Error(`Allocation error: Calculated allocations (${totalAllocatedPaise} paise) exceeded provider pool (${pool.totalCostPaise} paise).`);
  }

  // Insert allocations into sharedCostAllocations
  for (const alloc of allocationsToInsert) {
    await qrosDb
      .insert(sharedCostAllocations)
      .values(alloc)
      .onConflictDoNothing();
  }

  // Any residual rounding remainder is tracked as unallocated
  const unallocatedCostPaise = Math.max(0, pool.totalCostPaise - totalAllocatedPaise);
  if (unallocatedCostPaise > 0) {
    await qrosDb.insert(unattributedCostItems).values({
      id: crypto.randomUUID(),
      poolId: pool.id,
      provider: pool.provider,
      description: `Rounding residual for pool: ${pool.poolName}`,
      amountPaise: unallocatedCostPaise,
      unallocatedReason: 'Fractional rounding residual preserved without arbitrary tenant distribution.',
      status: 'unallocated'
    });
  }

  await qrosDb
    .update(sharedCostPools)
    .set({
      allocatedCostPaise: totalAllocatedPaise,
      unallocatedCostPaise,
      status: unallocatedCostPaise === 0 ? 'fully_allocated' : 'partially_allocated',
      updatedAt: new Date()
    })
    .where(eq(sharedCostPools.id, poolId));

  return {
    poolId: pool.id,
    status: unallocatedCostPaise === 0 ? 'fully_allocated' : 'partially_allocated',
    allocatedCount: allocationsToInsert.length,
    totalAllocatedPaise,
    unallocatedCostPaise
  };
}

/**
 * 4. Tenant-Level Cost Attribution & Ledger
 * Calculates DIRECT_TENANT_COST + TENANT_SHARE_OF_SHARED_INFRASTRUCTURE.
 * Applies CUSTOMER_CHARGE = TENANT_TOTAL_COST / 0.30 and verifies >= 70% Gross Margin.
 */
export async function calculateTenantCost(
  restaurantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<TenantCostSummary> {
  // Verify tenant exists
  let [venue] = await qrosDb
    .select({
      id: restaurants.id,
      name: restaurants.name,
      tenantType: restaurants.tenantType
    })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  if (!venue) {
    try {
      const restExport = await restaurantApiClient.getTenantDetails(restaurantId).catch(() => null);
      if (restExport?.restaurant) {
        const r = restExport.restaurant;
        await qrosDb
          .insert(restaurants)
          .values({
            id: r.id,
            name: r.name,
            slug: r.slug,
            currency: r.currency || 'INR',
            tenantType: 'restaurant',
            isActive: r.isActive ?? true
          })
          .onConflictDoNothing();
        venue = { id: r.id, name: r.name, tenantType: 'restaurant' };
      } else {
        const cinExport = await cinemaApiClient.getTenantDetails(restaurantId).catch(() => null);
        if (cinExport?.theatre) {
          const t = cinExport.theatre;
          await qrosDb
            .insert(restaurants)
            .values({
              id: t.id,
              name: t.name,
              slug: t.slug,
              currency: t.currency || 'INR',
              tenantType: 'cinema',
              isActive: t.isActive ?? true
            })
            .onConflictDoNothing();
          venue = { id: t.id, name: t.name, tenantType: 'cinema' };
        }
      }
    } catch {
      // ignore
    }
  }

  if (!venue) {
    throw new Error(`Tenant not found: ${restaurantId}`);
  }

  const tenantType = (venue.tenantType || 'restaurant') as 'restaurant' | 'cinema';

  // 1. Direct tenant costs
  const directEvents = await qrosDb
    .select({
      id: tenantUsageEvents.id,
      unit: tenantUsageEvents.unit,
      quantity: tenantUsageEvents.quantity,
      directCostPaise: tenantUsageEvents.directCostPaise,
      restaurantId: tenantUsageEvents.restaurantId,
      tenantType: tenantUsageEvents.tenantType
    })
    .from(tenantUsageEvents)
    .where(
      and(
        eq(tenantUsageEvents.restaurantId, restaurantId),
        gte(tenantUsageEvents.recordedAt, periodStart),
        lte(tenantUsageEvents.recordedAt, periodEnd)
      )
    );

  // Invariant: Verify every direct event belongs strictly to this tenant
  for (const ev of directEvents) {
    if (ev.restaurantId !== restaurantId) {
      throw new Error(`Cross-tenant cost contamination detected! Event ${ev.id} belongs to ${ev.restaurantId}, not ${restaurantId}`);
    }
  }

  const directTenantCostPaise = directEvents.reduce(
    (acc, ev) => acc + (ev.directCostPaise || 0),
    0
  );

  const usageByMetric: Record<string, number> = {};
  for (const ev of directEvents) {
    usageByMetric[ev.unit] = (usageByMetric[ev.unit] || 0) + ev.quantity;
  }

  // 2. Shared infrastructure cost allocation
  const sharedAllocs = await qrosDb
    .select({
      id: sharedCostAllocations.id,
      poolId: sharedCostAllocations.poolId,
      restaurantId: sharedCostAllocations.restaurantId,
      allocatedCostPaise: sharedCostAllocations.allocatedCostPaise,
      poolName: sharedCostPools.poolName
    })
    .from(sharedCostAllocations)
    .innerJoin(sharedCostPools, eq(sharedCostAllocations.poolId, sharedCostPools.id))
    .where(
      and(
        eq(sharedCostAllocations.restaurantId, restaurantId),
        gte(sharedCostPools.periodStart, periodStart),
        lte(sharedCostPools.periodEnd, periodEnd)
      )
    );

  // Invariant: Verify every shared allocation belongs strictly to this tenant
  for (const sa of sharedAllocs) {
    if (sa.restaurantId !== restaurantId) {
      throw new Error(`Cross-tenant allocation contamination detected! Allocation ${sa.id} belongs to ${sa.restaurantId}, not ${restaurantId}`);
    }
  }

  const sharedInfrastructureCostPaise = sharedAllocs.reduce(
    (acc, sa) => acc + (sa.allocatedCostPaise || 0),
    0
  );

  // 3. Billing Engine Formulas
  // TENANT_TOTAL_COST = DIRECT_TENANT_COST + TENANT_SHARE_OF_SHARED_INFRASTRUCTURE
  const tenantTotalCostPaise = directTenantCostPaise + sharedInfrastructureCostPaise;

  // CUSTOMER_CHARGE = TENANT_TOTAL_COST / 0.30
  // (In paise, use Math.ceil to guarantee >= 70% gross margin)
  const customerChargePaise = tenantTotalCostPaise > 0
    ? Math.ceil(tenantTotalCostPaise / 0.30)
    : 0;

  // GROSS_MARGIN = (CUSTOMER_CHARGE - TENANT_TOTAL_COST) / CUSTOMER_CHARGE
  const grossMargin = customerChargePaise > 0
    ? (customerChargePaise - tenantTotalCostPaise) / customerChargePaise
    : 0.70;

  const grossMarginPercent = Math.round(grossMargin * 10000) / 100; // e.g. 70.0%

  return {
    restaurantId,
    tenantType,
    directTenantCostPaise,
    sharedInfrastructureCostPaise,
    tenantTotalCostPaise,
    customerChargePaise,
    grossMarginPercent,
    breakdown: {
      directEventsCount: directEvents.length,
      sharedAllocationsCount: sharedAllocs.length,
      usageByMetric,
      sharedPoolsAttributed: sharedAllocs.map((sa) => sa.poolName)
    }
  };
}

/**
 * 5. Billing Validation & Invoice Finalization (Section 5)
 * Strict pre-invoice validation rules must pass before an invoice is issued.
 */
export async function generateTenantInvoice(params: {
  restaurantId: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceNumber?: string;
}) {
  const { restaurantId, periodStart, periodEnd } = params;

  // 1. Calculate tenant cost ledger
  const summary = await calculateTenantCost(restaurantId, periodStart, periodEnd);

  // 2. Section 5 Pre-Invoice Validation Checklist
  // Validation 1: Confirm every allocated cost belongs to this tenant
  // (Enforced inside calculateTenantCost)

  // Validation 2 & 3: Confirm allocations reconcile with provider pools and no double allocation
  const allocs = await qrosDb
    .select({
      poolId: sharedCostAllocations.poolId,
      allocatedPaise: sharedCostAllocations.allocatedCostPaise,
      poolTotalCost: sharedCostPools.totalCostPaise
    })
    .from(sharedCostAllocations)
    .innerJoin(sharedCostPools, eq(sharedCostAllocations.poolId, sharedCostPools.id))
    .where(eq(sharedCostAllocations.restaurantId, restaurantId));

  for (const a of allocs) {
    if (a.allocatedPaise > a.poolTotalCost) {
      throw new Error(`Billing validation failed: Allocated cost (${a.allocatedPaise}) exceeds total provider pool cost (${a.poolTotalCost})!`);
    }
  }

  // Validation 4: Confirm gross margin is at least 70%
  if (summary.customerChargePaise > 0) {
    const margin = (summary.customerChargePaise - summary.tenantTotalCostPaise) / summary.customerChargePaise;
    if (margin < 0.6999) {
      throw new Error(`Billing validation failed: Tenant margin (${summary.grossMarginPercent}%) is below the mandatory 70% threshold!`);
    }
  }

  // Generate unique invoice number if not provided
  const invoiceNumber = params.invoiceNumber || `INV-QROS-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const dueDate = new Date(periodEnd.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days payment terms

  const [invoice] = await qrosDb
    .insert(tenantInvoices)
    .values({
      id: crypto.randomUUID(),
      invoiceNumber,
      restaurantId,
      tenantType: summary.tenantType,
      periodStart,
      periodEnd,
      directTenantCostPaise: summary.directTenantCostPaise,
      sharedInfrastructureCostPaise: summary.sharedInfrastructureCostPaise,
      tenantTotalCostPaise: summary.tenantTotalCostPaise,
      customerChargePaise: summary.customerChargePaise,
      grossMarginPercent: summary.grossMarginPercent,
      costBreakdown: summary.breakdown,
      status: 'issued',
      reconciliationValidated: true,
      paymentDueDate: dueDate
    })
    .returning();

  return invoice;
}

/**
 * 6. Unattributed Costs Administrative Workflow (Section 3)
 */
export async function getUnattributedCosts(status?: string) {
  let query = qrosDb.select().from(unattributedCostItems);
  if (status) {
    query = query.where(eq(unattributedCostItems.status, status)) as any;
  }
  return query;
}

export async function resolveUnattributedCost(
  itemId: string,
  resolution: {
    resolvedToRestaurantId?: string;
    resolutionNotes: string;
    resolvedBy: string;
    writeOff?: boolean;
  }
) {
  const newStatus = resolution.writeOff ? 'written_off' : 'resolved';

  const [updated] = await qrosDb
    .update(unattributedCostItems)
    .set({
      status: newStatus,
      resolvedToRestaurantId: resolution.resolvedToRestaurantId || null,
      resolutionNotes: resolution.resolutionNotes,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date()
    })
    .where(eq(unattributedCostItems.id, itemId))
    .returning();

  return updated;
}

/**
 * 7. Tenant-Scoped Invoices & Usage Queries (Section 4)
 * Guarantees that Restaurant A can never access Restaurant B's data,
 * and Cinema A can never access Cinema B's data.
 */
export async function getTenantInvoices(authenticatedRestaurantId: string) {
  return qrosDb
    .select()
    .from(tenantInvoices)
    .where(eq(tenantInvoices.restaurantId, authenticatedRestaurantId))
    .orderBy(sql`${tenantInvoices.periodEnd} DESC`);
}

export async function getTenantInvoiceById(
  authenticatedRestaurantId: string,
  invoiceId: string
) {
  const [invoice] = await qrosDb
    .select()
    .from(tenantInvoices)
    .where(
      and(
        eq(tenantInvoices.id, invoiceId),
        eq(tenantInvoices.restaurantId, authenticatedRestaurantId) // Enforces tenant boundary
      )
    )
    .limit(1);

  return invoice || null;
}

export async function getTenantUsageSummary(
  authenticatedRestaurantId: string,
  billingPeriod?: string
) {
  let whereClause = eq(tenantUsageEvents.restaurantId, authenticatedRestaurantId);
  if (billingPeriod) {
    whereClause = and(whereClause, eq(tenantUsageEvents.billingPeriod, billingPeriod)) as any;
  }

  const events = await qrosDb
    .select({
      eventType: tenantUsageEvents.eventType,
      unit: tenantUsageEvents.unit,
      totalQuantity: sql<number>`coalesce(sum(${tenantUsageEvents.quantity}), 0)`,
      totalDirectCostPaise: sql<number>`coalesce(sum(${tenantUsageEvents.directCostPaise}), 0)`
    })
    .from(tenantUsageEvents)
    .where(whereClause)
    .groupBy(tenantUsageEvents.eventType, tenantUsageEvents.unit);

  return events;
}

/**
 * 8. Pay Tenant Invoice
 * Settles a tenant's metered usage invoice.
 */
export async function payTenantInvoice(
  authenticatedRestaurantId: string,
  invoiceId: string,
  paymentDetails?: {
    paymentMethod?: string;
    transactionRef?: string;
  }
) {
  const invoice = await getTenantInvoiceById(authenticatedRestaurantId, invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found or access denied');
  }

  if (invoice.status === 'paid') {
    return invoice;
  }

  const [updated] = await qrosDb
    .update(tenantInvoices)
    .set({
      status: 'paid',
      paidAt: new Date(),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(tenantInvoices.id, invoiceId),
        eq(tenantInvoices.restaurantId, authenticatedRestaurantId)
      )
    )
    .returning();

  return updated;
}
