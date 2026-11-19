import { Router, Request, Response } from 'express';
import {
  cinemaDb,
  restaurants,
  cinemaProfiles,
  restaurantMembers,
  cinemaScreens,
  orders,
  orderItems,
  orderStatusHistory,
  products,
  cinemaQrCodes,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionPayments,
  user
} from '@menugo/database';
import { eq, and, sql, count } from 'drizzle-orm';
import { requireInternalService } from '../../middleware/internal-service-auth';

export const cinemaInternalRouter = Router();

// Enforce internal service authentication on all internal cinema endpoints
cinemaInternalRouter.use(requireInternalService);

/**
 * GET /api/internal/cinema/metrics
 * Returns operational KPIs (orders, GMV, venue counts, screens capacity) for cinema domain
 */
cinemaInternalRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const [allVenues, orderStats, screenStats] = await Promise.all([
      cinemaDb
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          isActive: restaurants.isActive,
          createdAt: restaurants.createdAt
        })
        .from(restaurants)
        .where(eq(restaurants.tenantType, 'cinema'))
        .catch(() => []),
      cinemaDb
        .select({
          totalOrders: count(orders.id),
          totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
        })
        .from(orders)
        .catch(() => [{ totalOrders: 0, totalGmvPaise: 0 }]),
      cinemaDb
        .select({
          totalScreens: count(cinemaScreens.id)
        })
        .from(cinemaScreens)
        .where(eq(cinemaScreens.status, 'active'))
        .catch(() => [{ totalScreens: 0 }])
    ]);

    const totalVenues = allVenues.length;
    const activeVenues = allVenues.filter((v) => v.isActive).length;
    const totalOrders = Number(orderStats[0]?.totalOrders || 0);
    const totalGmvPaise = Number(orderStats[0]?.totalGmvPaise || 0);
    const totalCapacity = Number(screenStats[0]?.totalScreens || 0);

    res.json({
      success: true,
      domain: 'cinema',
      totalVenues,
      activeVenues,
      totalOrders,
      totalGmvPaise,
      totalCapacity,
      venues: allVenues
    });
  } catch (error: any) {
    console.error('[Cinema Internal API Metrics Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve cinema operational metrics' });
  }
});

/**
 * GET /api/internal/cinema/tenants
 * Returns detailed operational theatre list with live cinema profiles, owner, subscription, screens, and order metrics
 */
cinemaInternalRouter.get('/tenants', async (req: Request, res: Response) => {
  try {
    const [venues, profileList, ownerList, subsList, orderList, screenList] = await Promise.all([
      cinemaDb
        .select()
        .from(restaurants)
        .where(eq(restaurants.tenantType, 'cinema'))
        .catch(() => []),
      cinemaDb
        .select({
          theatreId: cinemaProfiles.theatreId,
          theatreName: cinemaProfiles.theatreName,
          chainOrBrand: cinemaProfiles.chainOrBrand,
          city: cinemaProfiles.city,
          state: cinemaProfiles.state,
          contactNumber: cinemaProfiles.contactNumber,
          contactEmail: cinemaProfiles.contactEmail,
          onboardingCompleted: cinemaProfiles.onboardingCompleted
        })
        .from(cinemaProfiles)
        .catch(() => []),
      cinemaDb
        .select({
          restaurantId: restaurantMembers.restaurantId,
          userName: user.name,
          userEmail: user.email
        })
        .from(restaurantMembers)
        .leftJoin(user, eq(restaurantMembers.userId, user.id))
        .where(eq(restaurantMembers.role, 'owner'))
        .catch(() => []),
      cinemaDb
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
      cinemaDb
        .select({
          restaurantId: orders.restaurantId,
          orderCount: count(orders.id),
          totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
        })
        .from(orders)
        .groupBy(orders.restaurantId)
        .catch(() => []),
      cinemaDb
        .select({
          theatreId: cinemaScreens.theatreId,
          count: count(cinemaScreens.id)
        })
        .from(cinemaScreens)
        .where(eq(cinemaScreens.status, 'active'))
        .groupBy(cinemaScreens.theatreId)
        .catch(() => [])
    ]);

    const cinemaProfileMap: Record<string, any> = {};
    for (const p of profileList) {
      if (p.theatreId) cinemaProfileMap[p.theatreId] = p;
    }

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
    for (const sc of screenList) {
      if (sc.theatreId) capacityMap[sc.theatreId] = Number(sc.count || 0);
    }

    res.json({
      success: true,
      domain: 'cinema',
      venues,
      cinemaProfileMap,
      ownerMap,
      subMap,
      orderStatsMap,
      capacityMap
    });
  } catch (error: any) {
    console.error('[Cinema Internal API Tenants Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve cinema tenant data' });
  }
});

/**
 * GET /api/internal/cinema/tenants/:id
 * Retrieves a single cinema theatre tenant details
 */
cinemaInternalRouter.get('/tenants/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const [theatre] = await cinemaDb
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (!theatre) {
      res.status(404).json({ error: 'Cinema theatre not found' });
      return;
    }

    res.json({ success: true, theatre });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve cinema theatre' });
  }
});

/**
 * PATCH /api/internal/cinema/tenants/:id/status
 * Updates isActive status of a cinema theatre in cinemaDb
 */
cinemaInternalRouter.patch('/tenants/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive must be a boolean' });
      return;
    }

    const [updated] = await cinemaDb
      .update(restaurants)
      .set({
        isActive,
        updatedAt: new Date()
      })
      .where(eq(restaurants.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Cinema theatre not found' });
      return;
    }

    res.json({
      success: true,
      domain: 'cinema',
      venue: updated
    });
  } catch (error: any) {
    console.error('[Cinema Internal Status Error]:', error);
    res.status(500).json({ error: 'Failed to update cinema status' });
  }
});

/**
 * POST /api/internal/cinema/tenants/:id/plan
 * Assigns or updates a subscription plan for a cinema theatre in cinemaDb
 */
cinemaInternalRouter.post('/tenants/:id/plan', async (req: Request, res: Response) => {
  try {
    const theatreId = req.params.id as string;
    const { planId, billingCycle = 'monthly', status = 'active' } = req.body;

    if (!planId) {
      res.status(400).json({ error: 'planId is required' });
      return;
    }

    // Verify theatre exists
    const [venue] = await cinemaDb
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.id, theatreId))
      .limit(1);

    if (!venue) {
      res.status(404).json({ error: 'Cinema theatre not found' });
      return;
    }

    // Verify plan exists in cinemaDb
    const [plan] = await cinemaDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: 'Subscription plan not found in cinema domain' });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(
      now.getTime() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
    );

    // Cancel existing active subscriptions
    await cinemaDb
      .update(tenantSubscriptions)
      .set({ status: 'cancelled', updatedAt: now })
      .where(
        and(
          eq(tenantSubscriptions.restaurantId, theatreId),
          eq(tenantSubscriptions.status, 'active')
        )
      );

    // Create new subscription
    const [newSub] = await cinemaDb
      .insert(tenantSubscriptions)
      .values({
        restaurantId: theatreId,
        planId,
        billingCycle,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd
      })
      .returning();

    res.json({
      success: true,
      domain: 'cinema',
      subscription: newSub,
      plan
    });
  } catch (error: any) {
    console.error('[Cinema Internal Assign Plan Error]:', error);
    res.status(500).json({ error: 'Failed to assign plan in cinema domain' });
  }
});

/**
 * POST /api/internal/cinema/plans/sync
 * Upserts a subscription plan in cinemaDb
 */
cinemaInternalRouter.post('/plans/sync', async (req: Request, res: Response) => {
  try {
    const plan = req.body;
    if (!plan?.id || !plan?.name || !plan?.slug) {
      res.status(400).json({ error: 'Invalid plan payload' });
      return;
    }

    await cinemaDb
      .insert(subscriptionPlans)
      .values({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        tenantType: plan.tenantType || 'cinema',
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
          maxScreens: plan.maxScreens,
          maxStaff: plan.maxStaff,
          features: plan.features,
          isPopular: plan.isPopular,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
          updatedAt: new Date()
        }
      });

    res.json({ success: true, message: 'Plan synced into cinema database' });
  } catch (error: any) {
    console.error('[Cinema Internal Plan Sync Error]:', error);
    res.status(500).json({ error: 'Failed to sync plan in cinema domain' });
  }
});

/**
 * DELETE /api/internal/cinema/plans/:id
 * Soft deletes / deactivates a plan in cinemaDb
 */
cinemaInternalRouter.delete('/plans/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await cinemaDb
      .update(subscriptionPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id));

    res.json({ success: true, message: 'Plan deactivated in cinema database' });
  } catch (error: any) {
    console.error('[Cinema Internal Plan Delete Error]:', error);
    res.status(500).json({ error: 'Failed to deactivate plan in cinema domain' });
  }
});

/**
 * GET /api/internal/cinema/sync-export
 * Returns cinema entities for central platform synchronization
 */
cinemaInternalRouter.get('/sync-export', async (req: Request, res: Response) => {
  try {
    const [venueList, profileList, userList, memberList, subList, paymentList] = await Promise.all([
      cinemaDb.select().from(restaurants).catch(() => []),
      cinemaDb.select().from(cinemaProfiles).catch(() => []),
      cinemaDb.select().from(user).catch(() => []),
      cinemaDb.select().from(restaurantMembers).where(eq(restaurantMembers.role, 'owner')).catch(() => []),
      cinemaDb.select().from(tenantSubscriptions).catch(() => []),
      cinemaDb.select().from(subscriptionPayments).catch(() => [])
    ]);

    res.json({
      success: true,
      domain: 'cinema',
      venues: venueList,
      profiles: profileList,
      users: userList,
      members: memberList,
      subscriptions: subList,
      payments: paymentList
    });
  } catch (error: any) {
    console.error('[Cinema Sync Export Error]:', error);
    res.status(500).json({ error: 'Failed to export cinema data for sync' });
  }
});

/**
 * GET /api/internal/cinema/theatres/by-slug/:slug
 * Resolves a cinema theatre by slug for cross-domain link routing
 */
cinemaInternalRouter.get('/theatres/by-slug/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const [venue] = await cinemaDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        tenantType: restaurants.tenantType,
        isActive: restaurants.isActive
      })
      .from(restaurants)
      .where(and(eq(restaurants.slug, slug), eq(restaurants.isActive, true)))
      .limit(1);

    if (!venue) {
      res.status(404).json({ error: 'Cinema theatre not found' });
      return;
    }

    const [qr] = await cinemaDb
      .select({
        token: cinemaQrCodes.token,
        theatreToken: cinemaQrCodes.theatreToken
      })
      .from(cinemaQrCodes)
      .where(
        and(
          eq(cinemaQrCodes.theatreId, venue.id),
          eq(cinemaQrCodes.status, 'active')
        )
      )
      .limit(1);

    res.json({
      success: true,
      venue,
      theatreToken: qr?.theatreToken || qr?.token || null
    });
  } catch (error: any) {
    console.error('[Cinema By Slug Error]:', error);
    res.status(500).json({ error: 'Failed to resolve cinema theatre by slug' });
  }
});

/**
 * GET /api/internal/cinema/orders/track/:statusToken
 * Resolves a cinema order tracking status token for customer tracking redirect
 */
cinemaInternalRouter.get('/orders/track/:statusToken', async (req: Request, res: Response) => {
  try {
    const token = req.params.statusToken as string;
    const [orderRecord] = await cinemaDb
      .select({
        order: orders,
        restaurant: {
          name: restaurants.name,
          slug: restaurants.slug,
          currency: restaurants.currency
        }
      })
      .from(orders)
      .leftJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .where(eq(orders.statusToken, token))
      .limit(1);

    if (!orderRecord) {
      res.status(404).json({ error: 'Order not found in cinema domain' });
      return;
    }

    const [items, timeline] = await Promise.all([
      cinemaDb
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          productName: orderItems.productName,
          quantity: orderItems.quantity,
          itemPrice: orderItems.unitPrice,
          totalPrice: orderItems.subtotal,
          notes: sql<string | null>`null`
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderRecord.order.id)),
      cinemaDb
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderRecord.order.id))
        .orderBy(orderStatusHistory.createdAt)
    ]);

    res.json({
      success: true,
      order: {
        id: orderRecord.order.id,
        orderNumber: orderRecord.order.orderNumber,
        status: orderRecord.order.status,
        totalAmount: orderRecord.order.totalAmount,
        currency: orderRecord.restaurant?.currency || 'INR',
        restaurantName: orderRecord.restaurant?.name,
        restaurantSlug: orderRecord.restaurant?.slug,
        isCinema: true,
        items,
        timeline,
        createdAt: orderRecord.order.createdAt,
        updatedAt: orderRecord.order.updatedAt
      }
    });
  } catch (error: any) {
    console.error('[Cinema Track Order Error]:', error);
    res.status(500).json({ error: 'Failed to track cinema order' });
  }
});
