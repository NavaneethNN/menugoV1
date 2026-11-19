import express, { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  restaurantDb,
  cinemaDb,
  restaurants,
  restaurantMembers,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionPayments
} from '@menugo/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  createSubscriptionCheckoutSchema,
  verifySubscriptionPaymentSchema
} from '@menugo/shared';
import {
  syncSubscriptionExpirations,
  createSubscriptionOrder,
  activateSubscriptionFromPayment,
  getPlatformRazorpayCredentials
} from '../lib/subscription-service';
import { AppError } from '../middleware/error-handler';

export const subscriptionRouter = Router();
subscriptionRouter.use(express.json());

/**
 * Helper to resolve the user's primary venue across restaurantDb and cinemaDb.
 */
async function resolveUserVenue(userId: string, preferredVenueId?: string) {
  // 1. Try preferred venue or first owned venue in restaurantDb
  let restaurantQuery = restaurantDb
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      tenantType: restaurants.tenantType,
      isActive: restaurants.isActive,
      role: restaurantMembers.role
    })
    .from(restaurantMembers)
    .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
    .where(eq(restaurantMembers.userId, userId));

  const restVenues = await restaurantQuery.catch(() => []);
  if (preferredVenueId) {
    const match = restVenues.find((v) => v.id === preferredVenueId);
    if (match) return { venue: match, tenantType: 'restaurant' as const };
  }

  // 2. Try cinemaDb
  let cinemaQuery = cinemaDb
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      tenantType: restaurants.tenantType,
      isActive: restaurants.isActive,
      role: restaurantMembers.role
    })
    .from(restaurantMembers)
    .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
    .where(eq(restaurantMembers.userId, userId));

  const cineVenues = await cinemaQuery.catch(() => []);
  if (preferredVenueId) {
    const match = cineVenues.find((v) => v.id === preferredVenueId);
    if (match) return { venue: match, tenantType: 'cinema' as const };
  }

  if (restVenues.length > 0) {
    const ownerVenue = restVenues.find((v) => v.role === 'owner') || restVenues[0];
    return { venue: ownerVenue!, tenantType: 'restaurant' as const };
  }

  if (cineVenues.length > 0) {
    const ownerVenue = cineVenues.find((v) => v.role === 'owner') || cineVenues[0];
    return { venue: ownerVenue!, tenantType: 'cinema' as const };
  }

  return null;
}

/**
 * GET /api/subscriptions/plans
 * Public endpoint to list active subscription plans by tenant type ('restaurant', 'cinema', or 'all')
 */
subscriptionRouter.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantType = (req.query.tenantType as string) || 'all';

    let plans = await restaurantDb
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);

    if (plans.length === 0) {
      plans = await cinemaDb
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(subscriptionPlans.sortOrder);
    }

    const filtered = plans.filter((p) => {
      if (tenantType === 'all') return true;
      return p.tenantType === tenantType || p.tenantType === 'all';
    });

    res.json(filtered);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscriptions/current
 * Returns active subscription, limits, and expiration metadata for the authenticated user's venue.
 */
subscriptionRouter.get('/current', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Automatically sync expirations so expired dates are live and accurate
    await syncSubscriptionExpirations();

    const preferredVenueId =
      (req.headers['x-restaurant-id'] as string) ||
      (req.headers['x-theatre-id'] as string) ||
      (req.headers['x-tenant-id'] as string) ||
      (req.query.restaurantId as string);

    const resolved = await resolveUserVenue(req.user!.id, preferredVenueId);

    if (!resolved) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No registered restaurant or cinema theatre found for this account.'
      });
    }

    const { venue, tenantType } = resolved;
    const targetDb = tenantType === 'cinema' ? cinemaDb : restaurantDb;

    // 2. Fetch latest subscription for this venue
    const [sub] = await targetDb
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
        plan: {
          id: subscriptionPlans.id,
          name: subscriptionPlans.name,
          slug: subscriptionPlans.slug,
          description: subscriptionPlans.description,
          tenantType: subscriptionPlans.tenantType,
          priceMonthlyPaise: subscriptionPlans.priceMonthlyPaise,
          priceAnnualPaise: subscriptionPlans.priceAnnualPaise,
          maxTables: subscriptionPlans.maxTables,
          maxScreens: subscriptionPlans.maxScreens,
          maxStaff: subscriptionPlans.maxStaff,
          features: subscriptionPlans.features
        }
      })
      .from(tenantSubscriptions)
      .leftJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
      .where(eq(tenantSubscriptions.restaurantId, venue.id))
      .orderBy(desc(tenantSubscriptions.createdAt))
      .limit(1);

    // 3. Compute duration remaining
    const now = new Date();
    let daysRemaining = 0;
    let isExpired = false;

    if (sub && sub.currentPeriodEnd) {
      const endMs = new Date(sub.currentPeriodEnd).getTime();
      const diffMs = endMs - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      isExpired = diffMs <= 0 || sub.status === 'expired';
    }

    // 4. Retrieve recent payment receipts
    const payments = await targetDb
      .select({
        id: subscriptionPayments.id,
        amountPaise: subscriptionPayments.amountPaise,
        currency: subscriptionPayments.currency,
        billingCycle: subscriptionPayments.billingCycle,
        provider: subscriptionPayments.provider,
        razorpayPaymentId: subscriptionPayments.razorpayPaymentId,
        status: subscriptionPayments.status,
        createdAt: subscriptionPayments.createdAt
      })
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.restaurantId, venue.id))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(5)
      .catch(() => []);

    const { keyId } = getPlatformRazorpayCredentials();

    res.json({
      venue: {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        tenantType,
        isActive: venue.isActive
      },
      subscription: sub || null,
      daysRemaining,
      isExpired,
      payments,
      razorpayKeyId: keyId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions/create-checkout-order
 * Initiates Razorpay checkout for a subscription tier.
 */
subscriptionRouter.post('/create-checkout-order', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = createSubscriptionCheckoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validation.error.format()
      });
    }

    const { planId, billingCycle, restaurantId: inputRestaurantId } = validation.data;
    const preferredVenueId =
      inputRestaurantId ||
      (req.headers['x-restaurant-id'] as string) ||
      (req.headers['x-theatre-id'] as string);

    const resolved = await resolveUserVenue(req.user!.id, preferredVenueId);
    if (!resolved) {
      throw new AppError('No eligible restaurant or cinema venue found for payment checkout.', 404);
    }

    const { venue, tenantType } = resolved;

    const checkoutOrder = await createSubscriptionOrder({
      planId,
      billingCycle,
      restaurantId: venue.id,
      venueName: venue.name,
      tenantType
    });

    res.status(200).json(checkoutOrder);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions/verify-payment
 * Verifies Razorpay signature and instantly activates tenant subscription for the configured duration.
 */
subscriptionRouter.post('/verify-payment', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = verifySubscriptionPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validation.error.format()
      });
    }

    const {
      planId,
      billingCycle,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      restaurantId: inputRestaurantId
    } = validation.data;

    const preferredVenueId =
      inputRestaurantId ||
      (req.headers['x-restaurant-id'] as string) ||
      (req.headers['x-theatre-id'] as string);

    const resolved = await resolveUserVenue(req.user!.id, preferredVenueId);
    if (!resolved) {
      throw new AppError('No eligible restaurant or cinema venue found for payment verification.', 404);
    }

    const { venue, tenantType } = resolved;

    const result = await activateSubscriptionFromPayment({
      restaurantId: venue.id,
      planId,
      billingCycle,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      tenantType
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
