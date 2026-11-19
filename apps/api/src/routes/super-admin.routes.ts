import { Router, Request, Response } from 'express';
import {
  qrosDb,
  restaurants,
  restaurantMembers,
  user,
  cinemaProfiles,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionPayments,
  sharedCostPools,
  tenantInvoices
} from '@menugo/database';
import { eq, desc, and, count } from 'drizzle-orm';
import { requireSuperAdmin } from '../middleware/super-admin-auth';
import { auth } from '../lib/auth';
import { forwardAuthCookies } from './auth.routes';
import { timingSafeMatch } from '../lib/encryption';
import { syncSubscriptionExpirations } from '../lib/subscription-service';
import { syncQrosDatabase, syncSubscriptionPlans } from '../lib/qros-sync-service';
import {
  restaurantApiClient,
  cinemaApiClient
} from '../lib/internal-api-client';
import {
  createSharedCostPool,
  allocateSharedCostPool,
  getUnattributedCosts,
  resolveUnattributedCost,
  generateTenantInvoice,
  recordTenantUsageEvent,
  getUsagePricingCatalogue,
  updateUsagePricingCatalogueItem,
  getPlatformBillingConfig,
  updatePlatformBillingConfig,
  simulateUsagePrice
} from '../lib/billing-engine';
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
    let existing = await qrosDb.select().from(subscriptionPlans).limit(1).catch(() => []);
    if (existing.length === 0) {
      await syncSubscriptionPlans().catch(() => {});
    }

    const plans = await qrosDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder)
      .catch(() => []);

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
    const isProduction = process.env.NODE_ENV === 'production';
    const configuredKey = (
      process.env.SUPER_ADMIN_KEY ||
      process.env.SUPER_ADMIN_MASTER_KEY ||
      (!isProduction ? 'menugo-superadmin-secret-2026' : '')
    ).trim();

    // Method 1: Master Key Login
    if (masterKey !== undefined && masterKey !== null && typeof masterKey === 'string') {
      const trimmedKey = masterKey.trim();
      if (!trimmedKey) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Please provide the platform master administration key.'
        });
      }

      if (!configuredKey || configuredKey.length < 16 || !timingSafeMatch(trimmedKey, configuredKey)) {
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
        }
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
 * High-level platform KPIs across all restaurants and theatres.
 * Reads master venues & subscriptions from qrosDb, and calls Restaurant & Cinema APIs for operational metrics.
 */
superAdminRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    // 1. Venue counts from central QROS master DB
    const allVenues = await qrosDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        tenantType: restaurants.tenantType,
        isActive: restaurants.isActive,
        createdAt: restaurants.createdAt
      })
      .from(restaurants)
      .catch(() => []);

    const restaurantVenues = allVenues.filter((v) => v.tenantType === 'restaurant');
    const cinemaVenues = allVenues.filter((v) => v.tenantType === 'cinema');

    const totalRestaurants = restaurantVenues.length;
    const activeRestaurants = restaurantVenues.filter((v) => v.isActive).length;
    const totalTheatres = cinemaVenues.length;
    const activeTheatres = cinemaVenues.filter((v) => v.isActive).length;
    const totalSuspended = allVenues.filter((v) => !v.isActive).length;

    // 2. Fetch order metrics and capacity via Restaurant and Cinema Backend APIs
    const [restMetrics, cineMetrics] = await Promise.all([
      restaurantApiClient.getMetrics().catch(() => ({ totalOrders: 0, totalGmvPaise: 0, totalCapacity: 0 })),
      cinemaApiClient.getMetrics().catch(() => ({ totalOrders: 0, totalGmvPaise: 0, totalCapacity: 0 }))
    ]);

    const totalOrders = (restMetrics.totalOrders || 0) + (cineMetrics.totalOrders || 0);
    const totalGmvPaise = (restMetrics.totalGmvPaise || 0) + (cineMetrics.totalGmvPaise || 0);

    // 3. Subscriptions summary from QROS master DB
    const qrosSubStats = await qrosDb
      .select({ totalSubscriptions: count(tenantSubscriptions.id) })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.status, 'active'))
      .catch(() => []);

    const activeSubscriptions = Number(qrosSubStats[0]?.totalSubscriptions || 0);

    // 4. Recent venues across both domains
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
      capacity: {
        totalTables: restMetrics.totalCapacity || 0,
        totalScreens: cineMetrics.totalCapacity || 0
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
 * Lists venues (restaurants and theatres) from QROS Master DB,
 * enriched with live operational metrics from Restaurant and Cinema Backend APIs.
 */
superAdminRouter.get('/tenants', async (req: Request, res: Response) => {
  try {
    const { tenantType, status, search } = req.query;

    // 1. Fetch master venues registry from QROS Master DB
    const allVenues = await qrosDb
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
      .catch(() => []);

    allVenues.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 2. Fetch operational details via Restaurant & Cinema Backend APIs
    const [restData, cineData] = await Promise.all([
      restaurantApiClient.getTenants().catch(() => ({
        ownerMap: {},
        subMap: {},
        orderStatsMap: {},
        capacityMap: {}
      })),
      cinemaApiClient.getTenants().catch(() => ({
        cinemaProfileMap: {},
        ownerMap: {},
        subMap: {},
        orderStatsMap: {},
        capacityMap: {}
      }))
    ]);

    const ownerMap = { ...(restData.ownerMap || {}), ...(cineData.ownerMap || {}) };
    const subMap = { ...(restData.subMap || {}), ...(cineData.subMap || {}) };
    const orderStatsMap = { ...(restData.orderStatsMap || {}), ...(cineData.orderStatsMap || {}) };
    const capacityMap = { ...(restData.capacityMap || {}), ...(cineData.capacityMap || {}) };
    const cinemaProfileMap = cineData.cinemaProfileMap || {};

    // 3. Compose enriched items
    let enriched = allVenues.map((v) => {
      const owner = ownerMap[v.id];
      const cinemaProfile = cinemaProfileMap[v.id];
      const sub = subMap[v.id];
      const stats = orderStatsMap[v.id] || { count: 0, gmvPaise: 0 };
      const capacity = capacityMap[v.id] || 0;

      return {
        ...v,
        ownerName: owner?.name || null,
        ownerEmail: owner?.email || null,
        cinemaProfile: cinemaProfile || null,
        subscription: sub || null,
        ordersCount: stats.count,
        gmvRupees: Math.round(stats.gmvPaise / 100),
        capacityCount: capacity
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
 * Toggle isActive status (Suspend or Activate a venue).
 * Updates QROS Master DB and communicates change to Restaurant or Cinema domain through its Backend API.
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

    // Check venue in QROS master DB to determine tenantType
    const [venue] = await qrosDb
      .select({ id: restaurants.id, tenantType: restaurants.tenantType })
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (!venue) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Call domain Backend API based on tenantType (Application & DB Isolation)
    if (venue.tenantType === 'cinema') {
      await cinemaApiClient.updateTenantStatus(id, isActive).catch((err: any) => {
        console.warn(`[Super Admin API] Notice: Cinema API status update: ${err?.message || err}`);
      });
    } else {
      await restaurantApiClient.updateTenantStatus(id, isActive).catch((err: any) => {
        console.warn(`[Super Admin API] Notice: Restaurant API status update: ${err?.message || err}`);
      });
    }

    // Update in QROS master DB
    const [updated] = await qrosDb
      .update(restaurants)
      .set({
        isActive,
        updatedAt: new Date()
      })
      .where(eq(restaurants.id, id))
      .returning();

    res.json({
      success: true,
      message: isActive ? 'Tenant activated successfully' : 'Tenant suspended successfully',
      tenant: updated
    });
  } catch (error: any) {
    console.error('[Tenant Status Error]:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

/**
 * PATCH /api/super-admin/tenants/:id/plan
 * Assign or update a tenant's subscription plan.
 * Communicates with Restaurant/Cinema domain via Backend API and mirrors into QROS Master DB.
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

    // 1. Check venue in QROS master DB
    const [venue] = await qrosDb
      .select({ id: restaurants.id, tenantType: restaurants.tenantType })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    if (!venue) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // 2. Verify plan exists in QROS master DB
    const [plan] = await qrosDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: 'Subscription plan not found in platform master database' });
      return;
    }

    // 3. Dispatch to tenant domain via its Backend API (Application & DB Isolation)
    let domainResult: any;
    if (venue.tenantType === 'cinema') {
      domainResult = await cinemaApiClient.assignTenantPlan(restaurantId, { planId, billingCycle, status });
    } else {
      domainResult = await restaurantApiClient.assignTenantPlan(restaurantId, { planId, billingCycle, status });
    }

    // 4. Update in QROS master DB
    const now = new Date();
    await qrosDb
      .update(tenantSubscriptions)
      .set({ status: 'cancelled', updatedAt: now })
      .where(
        and(
          eq(tenantSubscriptions.restaurantId, restaurantId),
          eq(tenantSubscriptions.status, 'active')
        )
      );

    const [newSub] = await qrosDb
      .insert(tenantSubscriptions)
      .values({
        restaurantId,
        planId,
        billingCycle,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000)
      })
      .returning();

    res.json({
      success: true,
      message: `Subscription plan ${plan.name} assigned successfully`,
      subscription: domainResult?.subscription || newSub,
      plan
    });
  } catch (error: any) {
    console.error('[Assign Plan Error]:', error);
    res.status(500).json({ error: 'Failed to assign subscription plan' });
  }
});

/**
 * GET /api/super-admin/subscriptions
 * List all subscription plans directly from QROS master DB
 */
superAdminRouter.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const plans = await qrosDb
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.sortOrder)
      .catch(() => []);

    res.json(plans);
  } catch (error: any) {
    console.error('[Get Plans Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription plans' });
  }
});

/**
 * POST /api/super-admin/subscriptions
 * Create a new subscription plan in QROS master DB and synchronize via Restaurant and Cinema APIs.
 */
superAdminRouter.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const validation = createSubscriptionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }

    const [createdInQros] = await qrosDb
      .insert(subscriptionPlans)
      .values(validation.data)
      .returning();

    // Propagate plan to Restaurant and Cinema via their Backend APIs
    await Promise.allSettled([
      restaurantApiClient.syncPlan(createdInQros),
      cinemaApiClient.syncPlan(createdInQros)
    ]);

    res.status(201).json(createdInQros);
  } catch (error: any) {
    console.error('[Create Plan Error]:', error);
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

/**
 * PATCH /api/super-admin/subscriptions/:id
 * Update an existing subscription plan in QROS master DB and synchronize via Backend APIs.
 */
superAdminRouter.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateSubscriptionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }

    const [qrosUpdated] = await qrosDb
      .update(subscriptionPlans)
      .set({
        ...validation.data,
        updatedAt: new Date()
      })
      .where(eq(subscriptionPlans.id, id))
      .returning();

    if (!qrosUpdated) {
      res.status(404).json({ error: 'Subscription plan not found' });
      return;
    }

    // Synchronize to Restaurant and Cinema via Backend APIs
    await Promise.allSettled([
      restaurantApiClient.syncPlan(qrosUpdated),
      cinemaApiClient.syncPlan(qrosUpdated)
    ]);

    res.json(qrosUpdated);
  } catch (error: any) {
    console.error('[Update Plan Error]:', error);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

/**
 * DELETE /api/super-admin/subscriptions/:id
 * Deactivates a subscription plan in QROS master DB and synchronizes via Backend APIs.
 */
superAdminRouter.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const [qrosUpdated] = await qrosDb
      .update(subscriptionPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();

    if (!qrosUpdated) {
      res.status(404).json({ error: 'Subscription plan not found' });
      return;
    }

    // Propagate deactivation to Restaurant and Cinema via Backend APIs
    await Promise.allSettled([
      restaurantApiClient.deactivatePlan(id),
      cinemaApiClient.deactivatePlan(id)
    ]);

    res.json({ success: true, message: 'Subscription plan deactivated', plan: qrosUpdated });
  } catch (error: any) {
    console.error('[Delete Plan Error]:', error);
    res.status(500).json({ error: 'Failed to deactivate subscription plan' });
  }
});

/**
 * POST /api/super-admin/seed-plans
 * Seed default plans in QROS master DB if empty, and sync to operational APIs.
 */
superAdminRouter.post('/seed-plans', async (req: Request, res: Response) => {
  try {
    const existing = await qrosDb.select().from(subscriptionPlans).limit(1).catch(() => []);
    if (existing.length > 0) {
      res.json({ message: 'Subscription plans already seeded in QROS master DB', count: existing.length });
      return;
    }

    await syncSubscriptionPlans();
    const plans = await qrosDb.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
    res.status(201).json({ success: true, message: 'Default subscription plans seeded across platform APIs', plans });
  } catch (error: any) {
    console.error('[Seed Plans Error]:', error);
    res.status(500).json({ error: 'Failed to seed default subscription plans' });
  }
});

/**
 * GET /api/super-admin/tenant-subscriptions
 * Lists all tenant subscriptions directly from QROS master DB.
 */
superAdminRouter.get('/tenant-subscriptions', async (req: Request, res: Response) => {
  try {
    // 1. Sync live expirations
    await syncSubscriptionExpirations();

    // 2. Fetch subscriptions from QROS master DB
    const allSubs = await qrosDb
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
      .catch(() => []);

    // 3. Resolve owners from QROS master DB
    const owners = await qrosDb
      .select({
        restaurantId: restaurantMembers.restaurantId,
        name: user.name,
        email: user.email
      })
      .from(restaurantMembers)
      .innerJoin(user, eq(restaurantMembers.userId, user.id))
      .where(eq(restaurantMembers.role, 'owner'))
      .catch(() => []);

    const ownerMap = new Map<string, { name: string; email: string }>();
    for (const o of owners) {
      if (o.restaurantId) {
        ownerMap.set(o.restaurantId, { name: o.name, email: o.email });
      }
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
 * Adjust or extend subscription duration in QROS master DB.
 */
superAdminRouter.patch('/tenant-subscriptions/:id/duration', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateSubscriptionDurationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', details: validation.error.format() });
    }

    const { daysToAdd, currentPeriodEnd, status } = validation.data;

    const [sub] = await qrosDb
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.id, id))
      .limit(1);

    if (!sub) {
      return res.status(404).json({ error: 'Tenant subscription not found in QROS master DB' });
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

    const [updated] = await qrosDb
      .update(tenantSubscriptions)
      .set({
        currentPeriodEnd: newPeriodEnd,
        status: newStatus,
        updatedAt: now
      })
      .where(eq(tenantSubscriptions.id, id))
      .returning();

    // If subscription is now active, ensure venue is marked isActive = true in QROS master DB
    if (newStatus === 'active') {
      await qrosDb
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
 * Update status of a tenant subscription in QROS master DB.
 */
superAdminRouter.patch('/tenant-subscriptions/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const [updated] = await qrosDb
      .update(tenantSubscriptions)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(tenantSubscriptions.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Tenant subscription not found in QROS master DB' });
    }

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
 * Lists all subscription payment transactions directly from QROS master DB.
 */
superAdminRouter.get('/subscription-payments', async (req: Request, res: Response) => {
  try {
    const allPayments = await qrosDb
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
      .catch(() => []);

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

/**
 * POST /api/super-admin/sync-qros-db
 * Trigger manual synchronization of all venues, subscriptions, and plans into QROS master DB via APIs.
 */
superAdminRouter.post('/sync-qros-db', async (req: Request, res: Response) => {
  try {
    await syncQrosDatabase();
    res.json({
      success: true,
      message: 'QROS master database synchronized successfully across restaurants and theatres via APIs.'
    });
  } catch (error: any) {
    console.error('[Sync QROS DB Error]:', error);
    res.status(500).json({ error: 'Failed to synchronize QROS database' });
  }
});

// ===========================================================================
// STRICT TENANT COST ISOLATION & BILLING ENGINE (Super Admin Control)
// ===========================================================================

/**
 * GET /api/super-admin/billing/cost-pools
 * Lists all shared provider infrastructure cost pools
 */
superAdminRouter.get('/billing/cost-pools', async (req: Request, res: Response) => {
  try {
    const pools = await qrosDb
      .select()
      .from(sharedCostPools)
      .orderBy(desc(sharedCostPools.createdAt));

    res.json(pools);
  } catch (error: any) {
    console.error('[Billing Cost Pools Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve shared cost pools' });
  }
});

/**
 * POST /api/super-admin/billing/cost-pools
 * Records a new provider infrastructure expense pool (Neon, Railway, Cloudflare, AWS)
 */
superAdminRouter.post('/billing/cost-pools', async (req: Request, res: Response) => {
  try {
    const { poolName, provider, providerInvoiceRef, metricType, totalCostPaise, periodStart, periodEnd } = req.body;

    if (!poolName || !provider || !metricType || !totalCostPaise || !periodStart || !periodEnd) {
      res.status(400).json({ error: 'Missing required cost pool parameters' });
      return;
    }

    const pool = await createSharedCostPool({
      poolName,
      provider,
      providerInvoiceRef,
      metricType,
      totalCostPaise: Number(totalCostPaise),
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd)
    });

    res.status(201).json(pool);
  } catch (error: any) {
    console.error('[Create Cost Pool Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to create shared cost pool' });
  }
});

/**
 * POST /api/super-admin/billing/cost-pools/:id/allocate
 * Executes proportional allocation of a shared provider pool strictly by measured tenant consumption
 */
superAdminRouter.post('/billing/cost-pools/:id/allocate', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await allocateSharedCostPool(id);
    res.json({
      success: true,
      message: 'Shared cost pool allocated successfully',
      result
    });
  } catch (error: any) {
    console.error('[Allocate Cost Pool Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to allocate shared cost pool' });
  }
});

/**
 * GET /api/super-admin/billing/unattributed-costs
 * Lists unallocated infrastructure costs requiring investigation
 */
superAdminRouter.get('/billing/unattributed-costs', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const items = await getUnattributedCosts(status);
    res.json(items);
  } catch (error: any) {
    console.error('[Unattributed Costs Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve unattributed costs' });
  }
});

/**
 * POST /api/super-admin/billing/unattributed-costs/:id/resolve
 * Administrative resolution workflow for unattributed expenses
 */
superAdminRouter.post('/billing/unattributed-costs/:id/resolve', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { resolvedToRestaurantId, resolutionNotes, writeOff } = req.body;

    if (!resolutionNotes) {
      res.status(400).json({ error: 'Resolution notes are mandatory' });
      return;
    }

    const resolved = await resolveUnattributedCost(id, {
      resolvedToRestaurantId,
      resolutionNotes,
      resolvedBy: (req.user as any)?.email || 'super_admin',
      writeOff: Boolean(writeOff)
    });

    res.json({ success: true, item: resolved });
  } catch (error: any) {
    console.error('[Resolve Unattributed Cost Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to resolve unattributed cost' });
  }
});

/**
 * POST /api/super-admin/billing/invoices/generate
 * Finalizes and issues a tenant invoice with strict pre-validation checklist
 */
superAdminRouter.post('/billing/invoices/generate', async (req: Request, res: Response) => {
  try {
    const { restaurantId, periodStart, periodEnd, invoiceNumber } = req.body;

    if (!restaurantId || !periodStart || !periodEnd) {
      res.status(400).json({ error: 'restaurantId, periodStart, and periodEnd are required' });
      return;
    }

    const invoice = await generateTenantInvoice({
      restaurantId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      invoiceNumber
    });

    res.status(201).json(invoice);
  } catch (error: any) {
    console.error('[Generate Invoice Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to generate tenant invoice' });
  }
});

/**
 * GET /api/super-admin/billing/invoices
 * Lists all tenant invoices across platform with gross margin audit
 */
superAdminRouter.get('/billing/invoices', async (req: Request, res: Response) => {
  try {
    const invoices = await qrosDb
      .select({
        id: tenantInvoices.id,
        invoiceNumber: tenantInvoices.invoiceNumber,
        restaurantId: tenantInvoices.restaurantId,
        restaurantName: restaurants.name,
        tenantType: tenantInvoices.tenantType,
        periodStart: tenantInvoices.periodStart,
        periodEnd: tenantInvoices.periodEnd,
        directTenantCostPaise: tenantInvoices.directTenantCostPaise,
        sharedInfrastructureCostPaise: tenantInvoices.sharedInfrastructureCostPaise,
        tenantTotalCostPaise: tenantInvoices.tenantTotalCostPaise,
        customerChargePaise: tenantInvoices.customerChargePaise,
        grossMarginPercent: tenantInvoices.grossMarginPercent,
        status: tenantInvoices.status,
        reconciliationValidated: tenantInvoices.reconciliationValidated,
        createdAt: tenantInvoices.createdAt
      })
      .from(tenantInvoices)
      .innerJoin(restaurants, eq(tenantInvoices.restaurantId, restaurants.id))
      .orderBy(desc(tenantInvoices.createdAt));

    res.json(invoices);
  } catch (error: any) {
    console.error('[Get All Invoices Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve platform invoices' });
  }
});

/**
 * POST /api/super-admin/billing/record-usage
 * Records a tenant infrastructure usage event (worker tasks, compute, storage, egress)
 */
superAdminRouter.post('/billing/record-usage', async (req: Request, res: Response) => {
  try {
    const { restaurantId, tenantType, eventType, quantity, unit, directCostPaise, metadata, billingPeriod } = req.body;

    if (!restaurantId || !tenantType || !eventType || quantity === undefined || !unit) {
      res.status(400).json({ error: 'Missing required usage event fields' });
      return;
    }

    const event = await recordTenantUsageEvent({
      restaurantId,
      tenantType,
      eventType,
      quantity: Number(quantity),
      unit,
      directCostPaise: directCostPaise ? Number(directCostPaise) : 0,
      metadata,
      billingPeriod
    });

    res.status(201).json(event);
  } catch (error: any) {
    console.error('[Record Usage Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to record usage event' });
  }
});

/**
 * GET /api/super-admin/billing/catalogue
 * Retrieves the Super Admin usage pricing catalogue and platform billing configuration.
 */
superAdminRouter.get('/billing/catalogue', async (req: Request, res: Response) => {
  try {
    const [catalogue, config] = await Promise.all([
      getUsagePricingCatalogue(),
      getPlatformBillingConfig()
    ]);
    res.json({
      catalogue,
      config
    });
  } catch (error: any) {
    console.error('[Get Usage Catalogue Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve usage pricing catalogue' });
  }
});

/**
 * PATCH /api/super-admin/billing/catalogue/:id
 * Updates an item in the Usage Pricing Catalogue (e.g. rate, active status, unit, multiplier).
 */
superAdminRouter.patch('/billing/catalogue/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { ratePaise, isActive, displayName, unit, unitMultiplier, description } = req.body;

    const updated = await updateUsagePricingCatalogueItem(id, {
      ratePaise: ratePaise !== undefined ? Number(ratePaise) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      displayName,
      unit,
      unitMultiplier: unitMultiplier !== undefined ? Number(unitMultiplier) : undefined,
      description
    });

    res.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('[Update Usage Catalogue Item Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to update catalogue item' });
  }
});

/**
 * PATCH /api/super-admin/billing/config
 * Updates global billing configuration including the Minimum Gross Margin percentage.
 */
superAdminRouter.patch('/billing/config', async (req: Request, res: Response) => {
  try {
    const { minimumGrossMarginPercent, taxRatePercent, reconciliationNotes } = req.body;

    const updated = await updatePlatformBillingConfig({
      minimumGrossMarginPercent: minimumGrossMarginPercent !== undefined ? Number(minimumGrossMarginPercent) : undefined,
      taxRatePercent: taxRatePercent !== undefined ? Number(taxRatePercent) : undefined,
      reconciliationNotes,
      updatedBy: (req.user as any)?.email || 'super_admin'
    });

    res.json({ success: true, config: updated });
  } catch (error: any) {
    console.error('[Update Billing Config Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to update billing config' });
  }
});

/**
 * POST /api/super-admin/billing/simulate
 * Simulates pricing calculations based on the configured pricing catalogue and margin.
 */
superAdminRouter.post('/billing/simulate', async (req: Request, res: Response) => {
  try {
    const result = await simulateUsagePrice(req.body || {});
    res.json(result);
  } catch (error: any) {
    console.error('[Simulate Usage Price Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to simulate pricing' });
  }
});

