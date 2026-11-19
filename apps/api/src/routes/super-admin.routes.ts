import { Router, Request, Response } from 'express';
import {
  db,
  restaurants,
  restaurantMembers,
  user,
  orders,
  restaurantTables,
  cinemaScreens,
  cinemaProfiles,
  subscriptionPlans,
  tenantSubscriptions
} from '@menugo/database';
import { eq, desc, sql, and, ilike, count } from 'drizzle-orm';
import { requireSuperAdmin } from '../middleware/super-admin-auth';
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  assignTenantSubscriptionSchema,
  updateTenantStatusSchema
} from '@menugo/shared';

export const superAdminRouter = Router();

// ===========================================================================
// DEFAULT SEED SUBSCRIPTION PLANS
// ===========================================================================
export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    name: 'Restaurant Starter',
    slug: 'restaurant-starter',
    description: 'Perfect for small cafes and quick-service diners getting started with contactless QR ordering.',
    tenantType: 'restaurant' as const,
    priceMonthlyPaise: 99900, // ₹999/mo
    priceAnnualPaise: 999000, // ₹9,990/yr
    maxTables: 15,
    maxScreens: null,
    maxStaff: 5,
    features: [
      'Up to 15 Smart QR Tables',
      'Digital Customer Menu with Categories',
      'Kitchen Display System (KDS)',
      'Basic Order History & CSV Export',
      'Staff PIN Login (5 Staff Accounts)',
      'Email Support'
    ],
    isPopular: false,
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Restaurant Growth',
    slug: 'restaurant-growth',
    description: 'Advanced ordering and operations for busy dine-in restaurants and multi-floor venues.',
    tenantType: 'restaurant' as const,
    priceMonthlyPaise: 249900, // ₹2,499/mo
    priceAnnualPaise: 2499000, // ₹24,990/yr
    maxTables: 40,
    maxScreens: null,
    maxStaff: 20,
    features: [
      'Up to 40 Smart QR Tables',
      'Waiter Call & Water Service Pings',
      'Realtime Multi-Station KDS',
      'Direct Razorpay / Paytm Customer Checkout',
      'Detailed Daily Sales & Analytics',
      'Unlimited Staff Accounts',
      'Priority Phone & Chat Support'
    ],
    isPopular: true,
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Restaurant Enterprise',
    slug: 'restaurant-enterprise',
    description: 'High-volume restaurant chains, hotels, and food courts requiring custom limits and SLA.',
    tenantType: 'restaurant' as const,
    priceMonthlyPaise: 499900, // ₹4,999/mo
    priceAnnualPaise: 4999000, // ₹49,990/yr
    maxTables: null,
    maxScreens: null,
    maxStaff: null,
    features: [
      'Unlimited Smart QR Tables',
      'Multi-Location Centralized Dashboard',
      'Custom Domain & Brand Whitelabeling',
      'Dedicated Kitchen Stations & Expediter Mode',
      'Automated Inventory Stockout Sync',
      'Dedicated 24/7 Account Manager'
    ],
    isPopular: false,
    isActive: true,
    sortOrder: 3
  },
  {
    name: 'Cinema Single Screen',
    slug: 'cinema-single-screen',
    description: 'Tailored for standalone single-screen theatres and independent auditoriums.',
    tenantType: 'cinema' as const,
    priceMonthlyPaise: 299900, // ₹2,999/mo
    priceAnnualPaise: 2999000, // ₹29,990/yr
    maxTables: null,
    maxScreens: 1,
    maxStaff: 10,
    features: [
      '1 Screen / Auditorium',
      'Unlimited Seat QR Codes (Armrest Stickers)',
      'Custom Screen Row & Seat Grid Layout',
      'Cinema Concession Kitchen KDS',
      'Auditorium Delivery Runner Dashboard',
      'Direct Merchant Razorpay / Paytm Settlement',
      'Standard Support'
    ],
    isPopular: false,
    isActive: true,
    sortOrder: 4
  },
  {
    name: 'Multiplex Pro',
    slug: 'multiplex-pro',
    description: 'Full concession ordering infrastructure for 2 to 6 screen multiplex cinema chains.',
    tenantType: 'cinema' as const,
    priceMonthlyPaise: 699900, // ₹6,999/mo
    priceAnnualPaise: 6999000, // ₹69,990/yr
    maxTables: null,
    maxScreens: 6,
    maxStaff: 40,
    features: [
      'Up to 6 Screens / Auditoriums',
      'Realtime In-Seat Delivery with Runner Tickets',
      'Showtime Window Scheduling & Intermission Modes',
      'Dual Kitchen Pass & Runner Dispatch System',
      'Per-Screen Sales & Itemized Tax Reports',
      'POS Terminal Auto-Lock for Counter Devices',
      'Priority 24/7 Technical Support'
    ],
    isPopular: true,
    isActive: true,
    sortOrder: 5
  },
  {
    name: 'Multiplex Enterprise',
    slug: 'multiplex-enterprise',
    description: 'Unlimited auditoriums and custom POS integration for premier national multiplex chains.',
    tenantType: 'cinema' as const,
    priceMonthlyPaise: 1499900, // ₹14,999/mo
    priceAnnualPaise: 14999000, // ₹149,990/yr
    maxTables: null,
    maxScreens: null,
    maxStaff: null,
    features: [
      'Unlimited Screens & Auditoriums',
      'Box Office / Ticketing System Integration',
      'Custom Brand Splash & PWA Experience',
      'Multi-Theatre Centralized Management',
      'Custom Payment Routing & Split Settlement',
      'Dedicated SLA & On-Site Deployment Support'
    ],
    isPopular: false,
    isActive: true,
    sortOrder: 6
  }
];

/**
 * Public route to list active subscription plans for landing page pricing
 */
export async function getPublicSubscriptionPlans(req: Request, res: Response) {
  try {
    // Ensure default plans are present if table is empty
    const existing = await db.select().from(subscriptionPlans).limit(1);
    if (existing.length === 0) {
      await db.insert(subscriptionPlans).values(DEFAULT_SUBSCRIPTION_PLANS);
    }

    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);

    res.json(plans);
  } catch (error: any) {
    console.error('[Public Plans Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription plans' });
  }
}

// ===========================================================================
// SUPER ADMIN PROTECTED ROUTES
// ===========================================================================
superAdminRouter.use(requireSuperAdmin);

/**
 * GET /api/super-admin/me
 * Check admin identity and status
 */
superAdminRouter.get('/me', (req: Request, res: Response) => {
  res.json({
    isSuperAdmin: true,
    user: req.user
  });
});

/**
 * GET /api/super-admin/metrics
 * High-level platform KPIs across all restaurants and theatres
 */
superAdminRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    // 1. Venue counts
    const allVenues = await db
      .select({
        id: restaurants.id,
        tenantType: restaurants.tenantType,
        isActive: restaurants.isActive
      })
      .from(restaurants);

    const totalRestaurants = allVenues.filter((v) => v.tenantType === 'restaurant').length;
    const activeRestaurants = allVenues.filter((v) => v.tenantType === 'restaurant' && v.isActive).length;
    const totalTheatres = allVenues.filter((v) => v.tenantType === 'cinema').length;
    const activeTheatres = allVenues.filter((v) => v.tenantType === 'cinema' && v.isActive).length;
    const totalSuspended = allVenues.filter((v) => !v.isActive).length;

    // 2. Order counts and GMV
    const orderStats = await db
      .select({
        totalOrders: count(orders.id),
        totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
      })
      .from(orders);

    const totalOrders = Number(orderStats[0]?.totalOrders || 0);
    const totalGmvPaise = Number(orderStats[0]?.totalGmvPaise || 0);

    // 3. Subscriptions summary
    const subStats = await db
      .select({
        totalSubscriptions: count(tenantSubscriptions.id)
      })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.status, 'active'));

    const activeSubscriptions = Number(subStats[0]?.totalSubscriptions || 0);

    // 4. Recent venues
    const recentVenues = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        tenantType: restaurants.tenantType,
        isActive: restaurants.isActive,
        createdAt: restaurants.createdAt
      })
      .from(restaurants)
      .orderBy(desc(restaurants.createdAt))
      .limit(5);

    res.json({
      venues: {
        totalRestaurants,
        activeRestaurants,
        totalTheatres,
        activeTheatres,
        totalSuspended,
        totalVenues: allVenues.length
      },
      orders: {
        totalOrders,
        totalGmvPaise,
        totalGmvRupees: Math.round(totalGmvPaise / 100)
      },
      subscriptions: {
        activeSubscriptions
      },
      recentVenues
    });
  } catch (error: any) {
    console.error('[Super Admin Metrics Error]:', error);
    res.status(500).json({ error: 'Failed to compute platform metrics' });
  }
});

/**
 * GET /api/super-admin/tenants
 * Lists venues (restaurants and theatres) with search, filter, owner, and plan info
 */
superAdminRouter.get('/tenants', async (req: Request, res: Response) => {
  try {
    const { tenantType, status, search } = req.query;

    const allVenues = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        phone: restaurants.phone,
        email: restaurants.email,
        address: restaurants.address,
        currency: restaurants.currency,
        tenantType: restaurants.tenantType,
        isActive: restaurants.isActive,
        createdAt: restaurants.createdAt,
        updatedAt: restaurants.updatedAt
      })
      .from(restaurants)
      .orderBy(desc(restaurants.createdAt));

    // Retrieve owner info for each restaurant
    const allMembers = await db
      .select({
        restaurantId: restaurantMembers.restaurantId,
        role: restaurantMembers.role,
        userName: user.name,
        userEmail: user.email
      })
      .from(restaurantMembers)
      .leftJoin(user, eq(restaurantMembers.userId, user.id))
      .where(eq(restaurantMembers.role, 'owner'));

    const ownerMap = new Map<string, { name: string; email: string }>();
    for (const m of allMembers) {
      if (m.restaurantId && m.userEmail) {
        ownerMap.set(m.restaurantId, {
          name: m.userName || 'Owner',
          email: m.userEmail
        });
      }
    }

    // Retrieve cinema profiles if cinema
    const allCinemaProfiles = await db
      .select({
        theatreId: cinemaProfiles.theatreId,
        theatreName: cinemaProfiles.theatreName,
        city: cinemaProfiles.city,
        state: cinemaProfiles.state,
        chainOrBrand: cinemaProfiles.chainOrBrand,
        contactNumber: cinemaProfiles.contactNumber,
        contactEmail: cinemaProfiles.contactEmail,
        onboardingCompleted: cinemaProfiles.onboardingCompleted
      })
      .from(cinemaProfiles);

    const cinemaProfileMap = new Map<string, any>();
    for (const cp of allCinemaProfiles) {
      cinemaProfileMap.set(cp.theatreId, cp);
    }

    // Retrieve active subscriptions
    const allSubs = await db
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
      .where(eq(tenantSubscriptions.status, 'active'));

    const subMap = new Map<string, any>();
    for (const s of allSubs) {
      subMap.set(s.restaurantId, s);
    }

    // Retrieve order stats per restaurant
    const orderAggregates = await db
      .select({
        restaurantId: orders.restaurantId,
        orderCount: count(orders.id),
        totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
      })
      .from(orders)
      .groupBy(orders.restaurantId);

    const orderStatsMap = new Map<string, { count: number; gmvPaise: number }>();
    for (const o of orderAggregates) {
      if (o.restaurantId) {
        orderStatsMap.set(o.restaurantId, {
          count: Number(o.orderCount || 0),
          gmvPaise: Number(o.totalGmvPaise || 0)
        });
      }
    }

    // Retrieve screen counts for cinema
    const screenCounts = await db
      .select({
        theatreId: cinemaScreens.theatreId,
        count: count(cinemaScreens.id)
      })
      .from(cinemaScreens)
      .where(eq(cinemaScreens.status, 'active'))
      .groupBy(cinemaScreens.theatreId);

    const screenMap = new Map<string, number>();
    for (const s of screenCounts) {
      screenMap.set(s.theatreId, Number(s.count || 0));
    }

    // Retrieve table counts for restaurants
    const tableCounts = await db
      .select({
        restaurantId: restaurantTables.restaurantId,
        count: count(restaurantTables.id)
      })
      .from(restaurantTables)
      .where(eq(restaurantTables.isActive, true))
      .groupBy(restaurantTables.restaurantId);

    const tableMap = new Map<string, number>();
    for (const t of tableCounts) {
      tableMap.set(t.restaurantId, Number(t.count || 0));
    }

    // Compose enriched items
    let enriched = allVenues.map((v) => {
      const owner = ownerMap.get(v.id);
      const cinemaProfile = cinemaProfileMap.get(v.id);
      const sub = subMap.get(v.id);
      const stats = orderStatsMap.get(v.id) || { count: 0, gmvPaise: 0 };
      const screensCount = screenMap.get(v.id) || 0;
      const tablesCount = tableMap.get(v.id) || 0;

      return {
        ...v,
        ownerName: owner?.name || null,
        ownerEmail: owner?.email || null,
        cinemaProfile: cinemaProfile || null,
        subscription: sub || null,
        ordersCount: stats.count,
        gmvRupees: Math.round(stats.gmvPaise / 100),
        capacityCount: v.tenantType === 'cinema' ? screensCount : tablesCount
      };
    });

    // Apply filters
    if (tenantType && tenantType !== 'all') {
      enriched = enriched.filter((v) => v.tenantType === tenantType);
    }

    if (status && status !== 'all') {
      const shouldBeActive = status === 'active';
      enriched = enriched.filter((v) => v.isActive === shouldBeActive);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      enriched = enriched.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.slug.toLowerCase().includes(q) ||
          (v.email && v.email.toLowerCase().includes(q)) ||
          (v.ownerEmail && v.ownerEmail.toLowerCase().includes(q)) ||
          (v.cinemaProfile?.city && v.cinemaProfile.city.toLowerCase().includes(q))
      );
    }

    res.json(enriched);
  } catch (error: any) {
    console.error('[Super Admin Tenants Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant list' });
  }
});

/**
 * PATCH /api/super-admin/tenants/:id/status
 * Toggle isActive status (Suspend or Activate a venue)
 */
superAdminRouter.patch('/tenants/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateTenantStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Invalid payload', details: validation.error.format() });
      return;
    }

    const { isActive } = validation.data;

    const updated = await db
      .update(restaurants)
      .set({
        isActive,
        updatedAt: new Date()
      })
      .where(eq(restaurants.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json({
      success: true,
      message: isActive ? 'Tenant activated successfully' : 'Tenant suspended successfully',
      tenant: updated[0]
    });
  } catch (error: any) {
    console.error('[Tenant Status Error]:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

/**
 * PATCH /api/super-admin/tenants/:id/plan
 * Assign or update a tenant's subscription plan
 */
superAdminRouter.patch('/tenants/:id/plan', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.params.id as string;
    const validation = assignTenantSubscriptionSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Invalid payload', details: validation.error.format() });
      return;
    }

    const { planId, billingCycle, status } = validation.data;

    // Verify plan exists
    const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
    if (plan.length === 0) {
      res.status(404).json({ error: 'Subscription plan not found' });
      return;
    }

    // Cancel existing active subscriptions for this tenant
    await db
      .update(tenantSubscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(tenantSubscriptions.restaurantId, restaurantId), eq(tenantSubscriptions.status, 'active')));

    // Create new subscription
    const newSub = await db
      .insert(tenantSubscriptions)
      .values({
        restaurantId,
        planId,
        billingCycle,
        status,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000)
      })
      .returning();

    res.json({
      success: true,
      message: `Subscription plan ${plan[0]!.name} assigned successfully`,
      subscription: newSub[0],
      plan: plan[0]
    });
  } catch (error: any) {
    console.error('[Assign Plan Error]:', error);
    res.status(500).json({ error: 'Failed to assign subscription plan' });
  }
});

/**
 * GET /api/super-admin/subscriptions
 * List all subscription plans
 */
superAdminRouter.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.sortOrder);

    res.json(plans);
  } catch (error: any) {
    console.error('[Get Plans Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription plans' });
  }
});

/**
 * POST /api/super-admin/subscriptions
 * Create a new subscription plan
 */
superAdminRouter.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const validation = createSubscriptionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }

    const created = await db.insert(subscriptionPlans).values(validation.data).returning();
    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error('[Create Plan Error]:', error);
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

/**
 * PATCH /api/super-admin/subscriptions/:id
 * Update an existing subscription plan
 */
superAdminRouter.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateSubscriptionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }

    const updated = await db
      .update(subscriptionPlans)
      .set({
        ...validation.data,
        updatedAt: new Date()
      })
      .where(eq(subscriptionPlans.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: 'Subscription plan not found' });
      return;
    }

    res.json(updated[0]);
  } catch (error: any) {
    console.error('[Update Plan Error]:', error);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

/**
 * DELETE /api/super-admin/subscriptions/:id
 * Deactivates or deletes a subscription plan
 */
superAdminRouter.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const updated = await db
      .update(subscriptionPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: 'Subscription plan not found' });
      return;
    }

    res.json({ success: true, message: 'Plan deactivated successfully' });
  } catch (error: any) {
    console.error('[Delete Plan Error]:', error);
    res.status(500).json({ error: 'Failed to delete subscription plan' });
  }
});

/**
 * POST /api/super-admin/seed-plans
 * Seed default plans if empty
 */
superAdminRouter.post('/seed-plans', async (req: Request, res: Response) => {
  try {
    const existing = await db.select().from(subscriptionPlans).limit(1);
    if (existing.length > 0) {
      res.json({ message: 'Subscription plans already seeded', count: existing.length });
      return;
    }

    const inserted = await db.insert(subscriptionPlans).values(DEFAULT_SUBSCRIPTION_PLANS).returning();
    res.status(201).json({ success: true, message: 'Default subscription plans seeded', plans: inserted });
  } catch (error: any) {
    console.error('[Seed Plans Error]:', error);
    res.status(500).json({ error: 'Failed to seed default subscription plans' });
  }
});
