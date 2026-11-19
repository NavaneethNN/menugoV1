import { Router, Request, Response } from 'express';
import {
  qrosDb,
  restaurants,
  cinemaProfiles,
  tenantSubscriptions,
  subscriptionPayments,
  subscriptionPlans
} from '@menugo/database';
import { eq } from 'drizzle-orm';
import { requireInternalService } from '../../middleware/internal-service-auth';

export const qrosInternalRouter = Router();

// Enforce internal service authentication on all internal QROS platform endpoints
qrosInternalRouter.use(requireInternalService);

/**
 * POST /api/internal/qros/venues/register
 * Called by Restaurant or Cinema domain through API when a venue is onboarded or updated.
 * Records the master venue profile into qrosDb.
 */
qrosInternalRouter.post('/venues/register', async (req: Request, res: Response) => {
  try {
    const { venue, profile } = req.body;

    if (!venue?.id || !venue?.name || !venue?.slug) {
      res.status(400).json({ error: 'Invalid venue payload' });
      return;
    }

    const [upsertedVenue] = await qrosDb
      .insert(restaurants)
      .values({
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        phone: venue.phone || null,
        email: venue.email || null,
        address: venue.address || null,
        logoKey: venue.logoKey || null,
        logoUrl: venue.logoUrl || null,
        coverImageKey: venue.coverImageKey || null,
        coverImageUrl: venue.coverImageUrl || null,
        currency: venue.currency || 'INR',
        tenantType: venue.tenantType || 'restaurant',
        isActive: venue.isActive ?? true,
        settings: venue.settings || {}
      })
      .onConflictDoUpdate({
        target: restaurants.id,
        set: {
          name: venue.name,
          slug: venue.slug,
          phone: venue.phone || null,
          email: venue.email || null,
          address: venue.address || null,
          logoUrl: venue.logoUrl || null,
          coverImageUrl: venue.coverImageUrl || null,
          isActive: venue.isActive ?? true,
          settings: venue.settings || {},
          updatedAt: new Date()
        }
      })
      .returning();

    let upsertedProfile: any = null;
    if (profile && profile.theatreId) {
      const [cp] = await qrosDb
        .insert(cinemaProfiles)
        .values({
          id: profile.id || crypto.randomUUID(),
          theatreId: profile.theatreId,
          theatreName: profile.theatreName || venue.name,
          chainOrBrand: profile.chainOrBrand || null,
          address: profile.address || null,
          city: profile.city || null,
          state: profile.state || null,
          country: profile.country || 'India',
          contactNumber: profile.contactNumber || null,
          contactEmail: profile.contactEmail || null,
          businessDetails: profile.businessDetails || null,
          timezone: profile.timezone || 'Asia/Kolkata',
          currency: profile.currency || 'INR',
          logoKey: profile.logoKey || null,
          logoUrl: profile.logoUrl || null,
          onboardingStage: profile.onboardingStage || 'COMPLETED',
          onboardingCompleted: profile.onboardingCompleted ?? true,
          onboardingStagesCompleted: profile.onboardingStagesCompleted || []
        })
        .onConflictDoUpdate({
          target: cinemaProfiles.id,
          set: {
            theatreName: profile.theatreName || venue.name,
            chainOrBrand: profile.chainOrBrand || null,
            city: profile.city || null,
            state: profile.state || null,
            contactNumber: profile.contactNumber || null,
            contactEmail: profile.contactEmail || null,
            onboardingCompleted: profile.onboardingCompleted ?? true,
            updatedAt: new Date()
          }
        })
        .returning();
      upsertedProfile = cp;
    }

    res.json({
      success: true,
      message: 'Venue registered in QROS master database',
      venue: upsertedVenue,
      profile: upsertedProfile
    });
  } catch (error: any) {
    console.error('[QROS Internal Register Venue Error]:', error);
    res.status(500).json({ error: 'Failed to register venue in QROS platform database' });
  }
});

/**
 * POST /api/internal/qros/subscriptions/sync
 * Called by Restaurant or Cinema domain when a subscription or payment is completed.
 */
qrosInternalRouter.post('/subscriptions/sync', async (req: Request, res: Response) => {
  try {
    const { subscription, payment } = req.body;

    let syncedSub: any = null;
    if (subscription?.id) {
      const [s] = await qrosDb
        .insert(tenantSubscriptions)
        .values({
          id: subscription.id,
          restaurantId: subscription.restaurantId,
          planId: subscription.planId,
          billingCycle: subscription.billingCycle || 'monthly',
          status: subscription.status || 'active',
          currentPeriodStart: subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart) : new Date(),
          currentPeriodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : new Date(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
          trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null
        })
        .onConflictDoUpdate({
          target: tenantSubscriptions.id,
          set: {
            planId: subscription.planId,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : new Date(),
            updatedAt: new Date()
          }
        })
        .returning();
      syncedSub = s;
    }

    let syncedPayment: any = null;
    if (payment?.id) {
      const [p] = await qrosDb
        .insert(subscriptionPayments)
        .values({
          id: payment.id,
          subscriptionId: payment.subscriptionId || syncedSub?.id || null,
          restaurantId: payment.restaurantId,
          planId: payment.planId,
          amountPaise: payment.amountPaise,
          currency: payment.currency || 'INR',
          billingCycle: payment.billingCycle || 'monthly',
          provider: payment.provider || 'razorpay',
          razorpayOrderId: payment.razorpayOrderId || null,
          razorpayPaymentId: payment.razorpayPaymentId || null,
          razorpaySignature: payment.razorpaySignature || null,
          status: payment.status || 'success',
          notes: payment.notes || {}
        })
        .onConflictDoUpdate({
          target: subscriptionPayments.id,
          set: {
            status: payment.status,
            razorpayPaymentId: payment.razorpayPaymentId,
            updatedAt: new Date()
          }
        })
        .returning();
      syncedPayment = p;
    }

    res.json({
      success: true,
      subscription: syncedSub,
      payment: syncedPayment
    });
  } catch (error: any) {
    console.error('[QROS Internal Sync Subscription Error]:', error);
    res.status(500).json({ error: 'Failed to sync subscription into QROS database' });
  }
});

/**
 * GET /api/internal/qros/plans
 * Returns active subscription plans from QROS master DB
 */
qrosInternalRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await qrosDb
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.sortOrder);

    res.json({ success: true, plans });
  } catch (error: any) {
    console.error('[QROS Internal Get Plans Error]:', error);
    res.status(500).json({ error: 'Failed to get plans from QROS database' });
  }
});
