import { Router, Request, Response } from 'express';
import {
  restaurantDb,
  restaurants,
  restaurantMembers,
  restaurantTables,
  orders,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionPayments,
  user
} from '@menugo/database';
import { eq, and, sql, count } from 'drizzle-orm';
import { requireInternalService } from '../../middleware/internal-service-auth';

export const restaurantInternalRouter = Router();

// Enforce internal service authentication on all internal restaurant endpoints
restaurantInternalRouter.use(requireInternalService);

/**
 * GET /api/internal/restaurant/metrics
 * Returns operational KPIs (orders, GMV, venue counts, capacity) for restaurant domain
 */
restaurantInternalRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const [allVenues, orderStats, tableStats] = await Promise.all([
      restaurantDb
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          isActive: restaurants.isActive,
          createdAt: restaurants.createdAt
        })
        .from(restaurants)
        .where(eq(restaurants.tenantType, 'restaurant'))
        .catch(() => []),
      restaurantDb
        .select({
          totalOrders: count(orders.id),
          totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
        })
        .from(orders)
        .catch(() => [{ totalOrders: 0, totalGmvPaise: 0 }]),
      restaurantDb
        .select({
          totalTables: count(restaurantTables.id)
        })
        .from(restaurantTables)
        .where(eq(restaurantTables.isActive, true))
        .catch(() => [{ totalTables: 0 }])
    ]);

    const totalVenues = allVenues.length;
    const activeVenues = allVenues.filter((v) => v.isActive).length;
    const totalOrders = Number(orderStats[0]?.totalOrders || 0);
    const totalGmvPaise = Number(orderStats[0]?.totalGmvPaise || 0);
    const totalCapacity = Number(tableStats[0]?.totalTables || 0);

    res.json({
      success: true,
      domain: 'restaurant',
      totalVenues,
      activeVenues,
      totalOrders,
      totalGmvPaise,
      totalCapacity,
      venues: allVenues
    });
  } catch (error: any) {
    console.error('[Restaurant Internal API Metrics Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve restaurant operational metrics' });
  }
});

/**
 * GET /api/internal/restaurant/tenants
 * Returns detailed operational tenant list with live owner, subscription, tables, and order metrics
 */
restaurantInternalRouter.get('/tenants', async (req: Request, res: Response) => {
  try {
    const [venues, ownerList, subsList, orderList, tableList] = await Promise.all([
      restaurantDb
        .select()
        .from(restaurants)
        .where(eq(restaurants.tenantType, 'restaurant'))
        .catch(() => []),
      restaurantDb
        .select({
          restaurantId: restaurantMembers.restaurantId,
          userName: user.name,
          userEmail: user.email
        })
        .from(restaurantMembers)
        .leftJoin(user, eq(restaurantMembers.userId, user.id))
        .where(eq(restaurantMembers.role, 'owner'))
        .catch(() => []),
      restaurantDb
        .select({
          restaurantId: tenantSubscriptions.restaurantId,
          status: tenantSubscriptions.status,
          billingCycle: tenantSubscriptions.billingCycle,
          planId: tenantSubscriptions.planId,
          planName: subscriptionPlans.name,
          planSlug: subscriptionPlans.slug,
          priceMonthlyPaise: subscriptionPlans.priceMonthlyPaise
        })
        .from(tenantSubscriptions)
        .leftJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
        .where(eq(tenantSubscriptions.status, 'active'))
        .catch(() => []),
      restaurantDb
        .select({
          restaurantId: orders.restaurantId,
          orderCount: count(orders.id),
          totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
        })
        .from(orders)
        .groupBy(orders.restaurantId)
        .catch(() => []),
      restaurantDb
        .select({
          restaurantId: restaurantTables.restaurantId,
          count: count(restaurantTables.id)
        })
        .from(restaurantTables)
        .where(eq(restaurantTables.isActive, true))
        .groupBy(restaurantTables.restaurantId)
        .catch(() => [])
    ]);

    const ownerMap: Record<string, { name: string; email: string }> = {};
    for (const o of ownerList) {
      if (o.restaurantId && o.userEmail) {
        ownerMap[o.restaurantId] = { name: o.userName || 'Owner', email: o.userEmail };
      }
    }

    const subMap: Record<string, any> = {};
    for (const s of subsList) {
      if (s.restaurantId) subMap[s.restaurantId] = s;
    }

    const orderStatsMap: Record<string, { count: number; gmvPaise: number }> = {};
    for (const ord of orderList) {
      if (ord.restaurantId) {
        orderStatsMap[ord.restaurantId] = {
          count: Number(ord.orderCount || 0),
          gmvPaise: Number(ord.totalGmvPaise || 0)
        };
      }
    }

    const capacityMap: Record<string, number> = {};
    for (const t of tableList) {
      if (t.restaurantId) capacityMap[t.restaurantId] = Number(t.count || 0);
    }

    res.json({
      success: true,
      domain: 'restaurant',
      venues,
      ownerMap,
      subMap,
      orderStatsMap,
      capacityMap
    });
  } catch (error: any) {
    console.error('[Restaurant Internal API Tenants Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve restaurant tenant data' });
  }
});

/**
 * GET /api/internal/restaurant/tenants/:id
 * Retrieves a single restaurant tenant details
 */
restaurantInternalRouter.get('/tenants/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const [rest] = await restaurantDb
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (!rest) {
      res.status(404).json({ error: 'Restaurant tenant not found' });
      return;
    }

    res.json({ success: true, restaurant: rest });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve restaurant tenant' });
  }
});

/**
 * PATCH /api/internal/restaurant/tenants/:id/status
 * Updates isActive status of a restaurant in restaurantDb
 */
restaurantInternalRouter.patch('/tenants/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive must be a boolean' });
      return;
    }

    const [updated] = await restaurantDb
      .update(restaurants)
      .set({
        isActive,
        updatedAt: new Date()
      })
      .where(eq(restaurants.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Restaurant venue not found' });
      return;
    }

    res.json({
      success: true,
      domain: 'restaurant',
      venue: updated
    });
  } catch (error: any) {
    console.error('[Restaurant Internal Status Error]:', error);
    res.status(500).json({ error: 'Failed to update restaurant status' });
  }
});

/**
 * POST /api/internal/restaurant/tenants/:id/plan
 * Assigns or updates a subscription plan for a restaurant in restaurantDb
 */
restaurantInternalRouter.post('/tenants/:id/plan', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.params.id as string;
    const { planId, billingCycle = 'monthly', status = 'active' } = req.body;

    if (!planId) {
      res.status(400).json({ error: 'planId is required' });
      return;
    }

    // Verify restaurant exists
    const [venue] = await restaurantDb
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    if (!venue) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    // Verify plan exists in restaurantDb
    const [plan] = await restaurantDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: 'Subscription plan not found in restaurant domain' });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(
      now.getTime() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
    );

    // Cancel existing active subscriptions
    await restaurantDb
      .update(tenantSubscriptions)
      .set({ status: 'cancelled', updatedAt: now })
      .where(
        and(
          eq(tenantSubscriptions.restaurantId, restaurantId),
          eq(tenantSubscriptions.status, 'active')
        )
      );

    // Create new subscription
    const [newSub] = await restaurantDb
      .insert(tenantSubscriptions)
      .values({
        restaurantId,
        planId,
        billingCycle,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd
      })
      .returning();

    res.json({
      success: true,
      domain: 'restaurant',
      subscription: newSub,
      plan
    });
  } catch (error: any) {
    console.error('[Restaurant Internal Assign Plan Error]:', error);
    res.status(500).json({ error: 'Failed to assign plan in restaurant domain' });
  }
});

/**
 * POST /api/internal/restaurant/plans/sync
 * Upserts a subscription plan in restaurantDb
 */
restaurantInternalRouter.post('/plans/sync', async (req: Request, res: Response) => {
  try {
    const plan = req.body;
    if (!plan?.id || !plan?.name || !plan?.slug) {
      res.status(400).json({ error: 'Invalid plan payload' });
      return;
    }

    await restaurantDb
      .insert(subscriptionPlans)
      .values({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        tenantType: plan.tenantType || 'restaurant',
        priceMonthlyPaise: plan.priceMonthlyPaise,
        priceAnnualPaise: plan.priceAnnualPaise,
        maxTables: plan.maxTables,
        maxScreens: plan.maxScreens,
        maxStaff: plan.maxStaff,
        features: plan.features,
        isPopular: plan.isPopular,
        isActive: plan.isActive ?? true,
        sortOrder: plan.sortOrder || 0
      })
      .onConflictDoUpdate({
        target: subscriptionPlans.id,
        set: {
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          priceMonthlyPaise: plan.priceMonthlyPaise,
          priceAnnualPaise: plan.priceAnnualPaise,
          maxTables: plan.maxTables,
          maxStaff: plan.maxStaff,
          features: plan.features,
          isPopular: plan.isPopular,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
          updatedAt: new Date()
        }
      });

    res.json({ success: true, message: 'Plan synced into restaurant database' });
  } catch (error: any) {
    console.error('[Restaurant Internal Plan Sync Error]:', error);
    res.status(500).json({ error: 'Failed to sync plan in restaurant domain' });
  }
});

/**
 * DELETE /api/internal/restaurant/plans/:id
 * Soft deletes / deactivates a plan in restaurantDb
 */
restaurantInternalRouter.delete('/plans/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await restaurantDb
      .update(subscriptionPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id));

    res.json({ success: true, message: 'Plan deactivated in restaurant database' });
  } catch (error: any) {
    console.error('[Restaurant Internal Plan Delete Error]:', error);
    res.status(500).json({ error: 'Failed to deactivate plan in restaurant domain' });
  }
});

/**
 * GET /api/internal/restaurant/sync-export
 * Returns restaurant entities for central platform synchronization
 */
restaurantInternalRouter.get('/sync-export', async (req: Request, res: Response) => {
  try {
    const [venueList, userList, memberList, subList, paymentList] = await Promise.all([
      restaurantDb.select().from(restaurants).catch(() => []),
      restaurantDb.select().from(user).catch(() => []),
      restaurantDb.select().from(restaurantMembers).where(eq(restaurantMembers.role, 'owner')).catch(() => []),
      restaurantDb.select().from(tenantSubscriptions).catch(() => []),
      restaurantDb.select().from(subscriptionPayments).catch(() => [])
    ]);

    res.json({
      success: true,
      domain: 'restaurant',
      venues: venueList,
      users: userList,
      members: memberList,
      subscriptions: subList,
      payments: paymentList
    });
  } catch (error: any) {
    console.error('[Restaurant Sync Export Error]:', error);
    res.status(500).json({ error: 'Failed to export restaurant data for sync' });
  }
});
