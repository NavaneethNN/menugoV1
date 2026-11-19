import { Router, Request, Response } from 'express';
import {
  db,
  restaurantDb,
  cinemaDb,
  restaurants,
  restaurantMembers,
  user,
  orders,
  restaurantTables,
  cinemaScreens,
  cinemaProfiles,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionPayments
} from '@menugo/database';
import { eq, desc, sql, and, ilike, count } from 'drizzle-orm';
import { requireSuperAdmin } from '../middleware/super-admin-auth';
import { auth } from '../lib/auth';
import { forwardAuthCookies } from './auth.routes';
import { syncSubscriptionExpirations } from '../lib/subscription-service';
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  assignTenantSubscriptionSchema,
  updateTenantStatusSchema,
  updateSubscriptionDurationSchema
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
// SUPER ADMIN PUBLIC LOGIN
// ===========================================================================

/**
 * POST /api/super-admin/login
 * Dedicated, rock-solid login endpoint supporting both platform Master Key and Super Admin credentials.
 */
superAdminRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { masterKey, email, password } = req.body || {};
    const configuredKey = (process.env.SUPER_ADMIN_KEY || '').trim();

    // Method 1: Master Key Login
    if (masterKey !== undefined && masterKey !== null && typeof masterKey === 'string') {
      const trimmedKey = masterKey.trim();
      if (!trimmedKey) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Please provide the platform master administration key.'
        });
      }

      if (trimmedKey !== configuredKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid platform master key. Please verify the secret key.'
        });
      }

      return res.status(200).json({
        success: true,
        isSuperAdmin: true,
        authMethod: 'master_key',
        user: {
          id: 'super-admin-master',
          name: 'Master Platform Admin',
          email: 'superadmin@menugo.in',
          role: 'super_admin',
          tenantType: 'platform',
          emailVerified: true
        },
        masterKey: trimmedKey
      });
    }

    // Method 2: Email & Password Login
    if (email && password) {
      const normalizedEmail = String(email).trim().toLowerCase();

      let authResponse: Response | any;
      try {
        authResponse = await auth.api.signInEmail({
          body: {
            email: normalizedEmail,
            password: String(password)
          },
          asResponse: true
        });
      } catch (authErr: any) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid administrator email or password.'
        });
      }

      if (authResponse.status !== 200) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid administrator email or password.'
        });
      }

      const responseJson = await authResponse.json().catch(() => ({}));
      const loggedUser = responseJson.user;

      if (!loggedUser) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication failed. Please verify credentials.'
        });
      }

      const userRole = (loggedUser.role || '').toLowerCase();
      const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const isAuthorized =
        userRole === 'super_admin' ||
        userRole === 'superadmin' ||
        adminEmails.includes(normalizedEmail);

      if (!isAuthorized) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access Denied: This account is not authorized as a The QROS Super Administrator.'
        });
      }

      // Forward session cookie
      forwardAuthCookies(authResponse, res);

      return res.status(200).json({
        success: true,
        isSuperAdmin: true,
        authMethod: 'session',
        user: {
          id: loggedUser.id,
          name: loggedUser.name,
          email: loggedUser.email,
          role: 'super_admin',
          tenantType: loggedUser.tenantType || 'platform',
          emailVerified: loggedUser.emailVerified
        }
      });
    }

    return res.status(400).json({
      error: 'Bad Request',
      message: 'Please provide either a platform master key or administrator email and password.'
    });
  } catch (err: any) {
    console.error('[Super Admin Login Error]:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process super admin login request.'
    });
  }
});

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
    // 1. Venue counts across restaurantDb and cinemaDb
    const [restaurantVenues, cinemaVenues] = await Promise.all([
      restaurantDb
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          tenantType: restaurants.tenantType,
          isActive: restaurants.isActive,
          createdAt: restaurants.createdAt
        })
        .from(restaurants)
        .catch(() => []),
      cinemaDb
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          tenantType: restaurants.tenantType,
          isActive: restaurants.isActive,
          createdAt: restaurants.createdAt
        })
        .from(restaurants)
        .catch(() => [])
    ]);

    const allVenues = [...restaurantVenues, ...cinemaVenues];

    const totalRestaurants = restaurantVenues.length;
    const activeRestaurants = restaurantVenues.filter((v) => v.isActive).length;
    const totalTheatres = cinemaVenues.length;
    const activeTheatres = cinemaVenues.filter((v) => v.isActive).length;
    const totalSuspended = allVenues.filter((v) => !v.isActive).length;

    // 2. Order counts and GMV across both databases
    const [restaurantOrderStats, cinemaOrderStats] = await Promise.all([
      restaurantDb
        .select({
          totalOrders: count(orders.id),
          totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
        })
        .from(orders)
        .catch(() => [{ totalOrders: 0, totalGmvPaise: 0 }]),
      cinemaDb
        .select({
          totalOrders: count(orders.id),
          totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
        })
        .from(orders)
        .catch(() => [{ totalOrders: 0, totalGmvPaise: 0 }])
    ]);

    const totalOrders =
      Number(restaurantOrderStats[0]?.totalOrders || 0) +
      Number(cinemaOrderStats[0]?.totalOrders || 0);
    const totalGmvPaise =
      Number(restaurantOrderStats[0]?.totalGmvPaise || 0) +
      Number(cinemaOrderStats[0]?.totalGmvPaise || 0);

    // 3. Subscriptions summary across both databases
    const [restaurantSubStats, cinemaSubStats] = await Promise.all([
      restaurantDb
        .select({ totalSubscriptions: count(tenantSubscriptions.id) })
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.status, 'active'))
        .catch(() => [{ totalSubscriptions: 0 }]),
      cinemaDb
        .select({ totalSubscriptions: count(tenantSubscriptions.id) })
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.status, 'active'))
        .catch(() => [{ totalSubscriptions: 0 }])
    ]);

    const activeSubscriptions =
      Number(restaurantSubStats[0]?.totalSubscriptions || 0) +
      Number(cinemaSubStats[0]?.totalSubscriptions || 0);

    // 4. Recent venues across both databases
    const recentVenues = allVenues
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

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

    // 1. Fetch venues from restaurantDb and cinemaDb in parallel
    const [restaurantVenues, cinemaVenues] = await Promise.all([
      restaurantDb
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
        .catch(() => []),
      cinemaDb
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
        .catch(() => [])
    ]);

    const allVenues = [...restaurantVenues, ...cinemaVenues].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 2. Retrieve owner info across both databases
    const [restaurantMembersList, cinemaMembersList] = await Promise.all([
      restaurantDb
        .select({
          restaurantId: restaurantMembers.restaurantId,
          role: restaurantMembers.role,
          userName: user.name,
          userEmail: user.email
        })
        .from(restaurantMembers)
        .leftJoin(user, eq(restaurantMembers.userId, user.id))
        .where(eq(restaurantMembers.role, 'owner'))
        .catch(() => []),
      cinemaDb
        .select({
          restaurantId: restaurantMembers.restaurantId,
          role: restaurantMembers.role,
          userName: user.name,
          userEmail: user.email
        })
        .from(restaurantMembers)
        .leftJoin(user, eq(restaurantMembers.userId, user.id))
        .where(eq(restaurantMembers.role, 'owner'))
        .catch(() => [])
    ]);

    const ownerMap = new Map<string, { name: string; email: string }>();
    for (const m of [...restaurantMembersList, ...cinemaMembersList]) {
      if (m.restaurantId && m.userEmail) {
        ownerMap.set(m.restaurantId, {
          name: m.userName || 'Owner',
          email: m.userEmail
        });
      }
    }

    // 3. Retrieve cinema profiles from cinemaDb
    const allCinemaProfiles = await cinemaDb
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
      .from(cinemaProfiles)
      .catch(() => []);

    const cinemaProfileMap = new Map<string, any>();
    for (const cp of allCinemaProfiles) {
      cinemaProfileMap.set(cp.theatreId, cp);
    }

    // 4. Retrieve active subscriptions across both databases
    const [restSubs, cineSubs] = await Promise.all([
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
        .catch(() => [])
    ]);

    const subMap = new Map<string, any>();
    for (const s of [...restSubs, ...cineSubs]) {
      subMap.set(s.restaurantId, s);
    }

    // 5. Retrieve order stats from both databases
    const [restOrders, cineOrders] = await Promise.all([
      restaurantDb
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
          restaurantId: orders.restaurantId,
          orderCount: count(orders.id),
          totalGmvPaise: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`
        })
        .from(orders)
        .groupBy(orders.restaurantId)
        .catch(() => [])
    ]);

    const orderStatsMap = new Map<string, { count: number; gmvPaise: number }>();
    for (const o of [...restOrders, ...cineOrders]) {
      if (o.restaurantId) {
        orderStatsMap.set(o.restaurantId, {
          count: Number(o.orderCount || 0),
          gmvPaise: Number(o.totalGmvPaise || 0)
        });
      }
    }

    // 6. Retrieve screen counts from cinemaDb
    const screenCounts = await cinemaDb
      .select({
        theatreId: cinemaScreens.theatreId,
        count: count(cinemaScreens.id)
      })
      .from(cinemaScreens)
      .where(eq(cinemaScreens.status, 'active'))
      .groupBy(cinemaScreens.theatreId)
      .catch(() => []);

    const screenMap = new Map<string, number>();
    for (const s of screenCounts) {
      screenMap.set(s.theatreId, Number(s.count || 0));
    }

    // 7. Retrieve table counts from restaurantDb
    const tableCounts = await restaurantDb
      .select({
        restaurantId: restaurantTables.restaurantId,
        count: count(restaurantTables.id)
      })
      .from(restaurantTables)
      .where(eq(restaurantTables.isActive, true))
      .groupBy(restaurantTables.restaurantId)
      .catch(() => []);

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

    // Try restaurantDb first
    let updated = await restaurantDb
      .update(restaurants)
      .set({
        isActive,
        updatedAt: new Date()
      })
      .where(eq(restaurants.id, id))
      .returning();

    // If not found in restaurantDb, try cinemaDb
    if (updated.length === 0) {
      updated = await cinemaDb
        .update(restaurants)
        .set({
          isActive,
          updatedAt: new Date()
        })
        .where(eq(restaurants.id, id))
        .returning();
    }

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

    // Identify target database for this venue
    let targetDb = restaurantDb;
    let [venue] = await restaurantDb
      .select({ id: restaurants.id, tenantType: restaurants.tenantType })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    if (!venue) {
      targetDb = cinemaDb;
      [venue] = await cinemaDb
        .select({ id: restaurants.id, tenantType: restaurants.tenantType })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId))
        .limit(1);
    }

    if (!venue) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Verify plan exists (in targetDb or fallback)
    let plan = await targetDb.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
    if (plan.length === 0) {
      plan = await (targetDb === restaurantDb ? cinemaDb : restaurantDb)
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);
    }

    if (plan.length === 0) {
      res.status(404).json({ error: 'Subscription plan not found' });
      return;
    }

    // Cancel existing active subscriptions for this tenant in target database
    await targetDb
      .update(tenantSubscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(tenantSubscriptions.restaurantId, restaurantId), eq(tenantSubscriptions.status, 'active')));

    // Create new subscription in target database
    const newSub = await targetDb
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
    let plans = await restaurantDb
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.sortOrder);

    if (plans.length === 0) {
      plans = await cinemaDb
        .select()
        .from(subscriptionPlans)
        .orderBy(subscriptionPlans.sortOrder);
    }

    res.json(plans);
  } catch (error: any) {
    console.error('[Get Plans Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription plans' });
  }
});

/**
 * POST /api/super-admin/subscriptions
 * Create a new subscription plan (synced across both databases)
 */
superAdminRouter.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const validation = createSubscriptionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }

    const [createdInRest] = await Promise.all([
      restaurantDb.insert(subscriptionPlans).values(validation.data).returning(),
      cinemaDb.insert(subscriptionPlans).values(validation.data).returning().catch(() => [])
    ]);

    res.status(201).json(createdInRest[0]);
  } catch (error: any) {
    console.error('[Create Plan Error]:', error);
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

/**
 * PATCH /api/super-admin/subscriptions/:id
 * Update an existing subscription plan (synced across both databases)
 */
superAdminRouter.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateSubscriptionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }

    const [restUpdated] = await Promise.all([
      restaurantDb
        .update(subscriptionPlans)
        .set({
          ...validation.data,
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlans.id, id))
        .returning(),
      cinemaDb
        .update(subscriptionPlans)
        .set({
          ...validation.data,
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlans.id, id))
        .returning()
        .catch(() => [])
    ]);

    if (restUpdated.length === 0) {
      res.status(404).json({ error: 'Subscription plan not found' });
      return;
    }

    res.json(restUpdated[0]);
  } catch (error: any) {
    console.error('[Update Plan Error]:', error);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

/**
 * DELETE /api/super-admin/subscriptions/:id
 * Deactivates a subscription plan (synced across both databases)
 */
superAdminRouter.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const [restUpdated] = await Promise.all([
      restaurantDb
        .update(subscriptionPlans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(subscriptionPlans.id, id))
        .returning(),
      cinemaDb
        .update(subscriptionPlans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(subscriptionPlans.id, id))
        .returning()
        .catch(() => [])
    ]);

    if (restUpdated.length === 0) {
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
 * Seed default plans if empty (synced to both databases)
 */
superAdminRouter.post('/seed-plans', async (req: Request, res: Response) => {
  try {
    const existing = await restaurantDb.select().from(subscriptionPlans).limit(1);
    if (existing.length > 0) {
      res.json({ message: 'Subscription plans already seeded', count: existing.length });
      return;
    }

    const [insertedRest] = await Promise.all([
      restaurantDb.insert(subscriptionPlans).values(DEFAULT_SUBSCRIPTION_PLANS).returning(),
      cinemaDb.insert(subscriptionPlans).values(DEFAULT_SUBSCRIPTION_PLANS).returning().catch(() => [])
    ]);

    res.status(201).json({ success: true, message: 'Default subscription plans seeded across databases', plans: insertedRest });
  } catch (error: any) {
    console.error('[Seed Plans Error]:', error);
    res.status(500).json({ error: 'Failed to seed default subscription plans' });
  }
});

/**
 * GET /api/super-admin/tenant-subscriptions
 * Lists all tenant subscriptions across restaurants and theatres with duration, expiration, and owner info.
 */
superAdminRouter.get('/tenant-subscriptions', async (req: Request, res: Response) => {
  try {
    // 1. Sync live expirations first
    await syncSubscriptionExpirations();

    // 2. Fetch subscriptions from restaurantDb and cinemaDb in parallel
    const [restSubs, cineSubs] = await Promise.all([
      restaurantDb
        .select({
          id: tenantSubscriptions.id,
          restaurantId: tenantSubscriptions.restaurantId,
          planId: tenantSubscriptions.planId,
          status: tenantSubscriptions.status,
          billingCycle: tenantSubscriptions.billingCycle,
          currentPeriodStart: tenantSubscriptions.currentPeriodStart,
          currentPeriodEnd: tenantSubscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: tenantSubscriptions.cancelAtPeriodEnd,
          createdAt: tenantSubscriptions.createdAt,
          restaurantName: restaurants.name,
          restaurantSlug: restaurants.slug,
          tenantType: restaurants.tenantType,
          isVenueActive: restaurants.isActive,
          planName: subscriptionPlans.name,
          planSlug: subscriptionPlans.slug,
          priceMonthlyPaise: subscriptionPlans.priceMonthlyPaise,
          priceAnnualPaise: subscriptionPlans.priceAnnualPaise,
          maxTables: subscriptionPlans.maxTables,
          maxScreens: subscriptionPlans.maxScreens,
          maxStaff: subscriptionPlans.maxStaff
        })
        .from(tenantSubscriptions)
        .innerJoin(restaurants, eq(tenantSubscriptions.restaurantId, restaurants.id))
        .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
        .orderBy(desc(tenantSubscriptions.createdAt))
        .catch(() => []),
      cinemaDb
        .select({
          id: tenantSubscriptions.id,
          restaurantId: tenantSubscriptions.restaurantId,
          planId: tenantSubscriptions.planId,
          status: tenantSubscriptions.status,
          billingCycle: tenantSubscriptions.billingCycle,
          currentPeriodStart: tenantSubscriptions.currentPeriodStart,
          currentPeriodEnd: tenantSubscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: tenantSubscriptions.cancelAtPeriodEnd,
          createdAt: tenantSubscriptions.createdAt,
          restaurantName: restaurants.name,
          restaurantSlug: restaurants.slug,
          tenantType: restaurants.tenantType,
          isVenueActive: restaurants.isActive,
          planName: subscriptionPlans.name,
          planSlug: subscriptionPlans.slug,
          priceMonthlyPaise: subscriptionPlans.priceMonthlyPaise,
          priceAnnualPaise: subscriptionPlans.priceAnnualPaise,
          maxTables: subscriptionPlans.maxTables,
          maxScreens: subscriptionPlans.maxScreens,
          maxStaff: subscriptionPlans.maxStaff
        })
        .from(tenantSubscriptions)
        .innerJoin(restaurants, eq(tenantSubscriptions.restaurantId, restaurants.id))
        .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
        .orderBy(desc(tenantSubscriptions.createdAt))
        .catch(() => [])
    ]);

    const allSubs = [...restSubs, ...cineSubs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 3. Resolve owners
    const [restOwners, cineOwners] = await Promise.all([
      restaurantDb
        .select({
          restaurantId: restaurantMembers.restaurantId,
          name: user.name,
          email: user.email
        })
        .from(restaurantMembers)
        .innerJoin(user, eq(restaurantMembers.userId, user.id))
        .where(eq(restaurantMembers.role, 'owner'))
        .catch(() => []),
      cinemaDb
        .select({
          restaurantId: restaurantMembers.restaurantId,
          name: user.name,
          email: user.email
        })
        .from(restaurantMembers)
        .innerJoin(user, eq(restaurantMembers.userId, user.id))
        .where(eq(restaurantMembers.role, 'owner'))
        .catch(() => [])
    ]);

    const ownerMap = new Map<string, { name: string; email: string }>();
    for (const o of [...restOwners, ...cineOwners]) {
      ownerMap.set(o.restaurantId, { name: o.name, email: o.email });
    }

    const now = new Date();
    const enriched = allSubs.map((s) => {
      const owner = ownerMap.get(s.restaurantId);
      let daysRemaining = 0;
      let isExpired = false;

      if (s.currentPeriodEnd) {
        const diffMs = new Date(s.currentPeriodEnd).getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
        isExpired = diffMs <= 0 || s.status === 'expired';
      }

      return {
        ...s,
        ownerName: owner?.name || 'Owner',
        ownerEmail: owner?.email || null,
        daysRemaining,
        isExpired
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('[Get Tenant Subscriptions Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant subscriptions' });
  }
});

/**
 * PATCH /api/super-admin/tenant-subscriptions/:id/duration
 * Adjust or extend subscription duration (e.g. +30 days, +365 days, or set end date)
 */
superAdminRouter.patch('/tenant-subscriptions/:id/duration', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateSubscriptionDurationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', details: validation.error.format() });
    }

    const { daysToAdd, currentPeriodEnd, status } = validation.data;

    // Find subscription in restaurantDb or cinemaDb
    let targetDb = restaurantDb;
    let [sub] = await restaurantDb
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.id, id))
      .limit(1);

    if (!sub) {
      targetDb = cinemaDb;
      [sub] = await cinemaDb
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.id, id))
        .limit(1);
    }

    if (!sub) {
      return res.status(404).json({ error: 'Tenant subscription not found' });
    }

    let newPeriodEnd: Date;
    if (currentPeriodEnd) {
      newPeriodEnd = new Date(currentPeriodEnd);
    } else if (daysToAdd) {
      const baseDate = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date()
        ? new Date(sub.currentPeriodEnd)
        : new Date();
      newPeriodEnd = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    } else {
      newPeriodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : new Date();
    }

    const now = new Date();
    const newStatus = status || (newPeriodEnd > now ? 'active' : 'expired');

    const [updated] = await targetDb
      .update(tenantSubscriptions)
      .set({
        currentPeriodEnd: newPeriodEnd,
        status: newStatus,
        updatedAt: now
      })
      .where(eq(tenantSubscriptions.id, id))
      .returning();

    // If subscription is now active, also ensure the venue is marked isActive = true
    if (newStatus === 'active') {
      await targetDb
        .update(restaurants)
        .set({ isActive: true, updatedAt: now })
        .where(eq(restaurants.id, sub.restaurantId));
    }

    res.json({
      success: true,
      message: `Subscription duration updated. Ends on ${newPeriodEnd.toLocaleDateString()}`,
      subscription: updated
    });
  } catch (error: any) {
    console.error('[Update Duration Error]:', error);
    res.status(500).json({ error: 'Failed to update subscription duration' });
  }
});

/**
 * PATCH /api/super-admin/tenant-subscriptions/:id/status
 * Update status of a tenant subscription ('active', 'expired', 'cancelled', 'past_due')
 */
superAdminRouter.patch('/tenant-subscriptions/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    let targetDb = restaurantDb;
    let [sub] = await restaurantDb
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.id, id))
      .limit(1);

    if (!sub) {
      targetDb = cinemaDb;
      [sub] = await cinemaDb
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.id, id))
        .limit(1);
    }

    if (!sub) {
      return res.status(404).json({ error: 'Tenant subscription not found' });
    }

    const [updated] = await targetDb
      .update(tenantSubscriptions)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(tenantSubscriptions.id, id))
      .returning();

    res.json({
      success: true,
      message: `Subscription status set to ${status}`,
      subscription: updated
    });
  } catch (error: any) {
    console.error('[Update Subscription Status Error]:', error);
    res.status(500).json({ error: 'Failed to update subscription status' });
  }
});

/**
 * GET /api/super-admin/subscription-payments
 * Lists all subscription payment transactions collected via Razorpay across both databases.
 */
superAdminRouter.get('/subscription-payments', async (req: Request, res: Response) => {
  try {
    const [restPayments, cinePayments] = await Promise.all([
      restaurantDb
        .select({
          id: subscriptionPayments.id,
          subscriptionId: subscriptionPayments.subscriptionId,
          restaurantId: subscriptionPayments.restaurantId,
          planId: subscriptionPayments.planId,
          amountPaise: subscriptionPayments.amountPaise,
          currency: subscriptionPayments.currency,
          billingCycle: subscriptionPayments.billingCycle,
          provider: subscriptionPayments.provider,
          razorpayOrderId: subscriptionPayments.razorpayOrderId,
          razorpayPaymentId: subscriptionPayments.razorpayPaymentId,
          status: subscriptionPayments.status,
          createdAt: subscriptionPayments.createdAt,
          restaurantName: restaurants.name,
          tenantType: restaurants.tenantType,
          planName: subscriptionPlans.name
        })
        .from(subscriptionPayments)
        .leftJoin(restaurants, eq(subscriptionPayments.restaurantId, restaurants.id))
        .leftJoin(subscriptionPlans, eq(subscriptionPayments.planId, subscriptionPlans.id))
        .orderBy(desc(subscriptionPayments.createdAt))
        .catch(() => []),
      cinemaDb
        .select({
          id: subscriptionPayments.id,
          subscriptionId: subscriptionPayments.subscriptionId,
          restaurantId: subscriptionPayments.restaurantId,
          planId: subscriptionPayments.planId,
          amountPaise: subscriptionPayments.amountPaise,
          currency: subscriptionPayments.currency,
          billingCycle: subscriptionPayments.billingCycle,
          provider: subscriptionPayments.provider,
          razorpayOrderId: subscriptionPayments.razorpayOrderId,
          razorpayPaymentId: subscriptionPayments.razorpayPaymentId,
          status: subscriptionPayments.status,
          createdAt: subscriptionPayments.createdAt,
          restaurantName: restaurants.name,
          tenantType: restaurants.tenantType,
          planName: subscriptionPlans.name
        })
        .from(subscriptionPayments)
        .leftJoin(restaurants, eq(subscriptionPayments.restaurantId, restaurants.id))
        .leftJoin(subscriptionPlans, eq(subscriptionPayments.planId, subscriptionPlans.id))
        .orderBy(desc(subscriptionPayments.createdAt))
        .catch(() => [])
    ]);

    const allPayments = [...restPayments, ...cinePayments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const formatted = allPayments.map((p) => ({
      ...p,
      amountRupees: Math.round(p.amountPaise / 100)
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('[Get Payments Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription payments' });
  }
});

/**
 * POST /api/super-admin/check-expirations
 * Manually trigger expiration check across all tenant subscriptions
 */
superAdminRouter.post('/check-expirations', async (req: Request, res: Response) => {
  try {
    const result = await syncSubscriptionExpirations();
    res.json({
      success: true,
      message: `Checked subscriptions: ${result.totalExpired} expired and updated`,
      ...result
    });
  } catch (error: any) {
    console.error('[Check Expirations Error]:', error);
    res.status(500).json({ error: 'Failed to run expiration sync' });
  }
});
