import {
  qrosDb,
  restaurants,
  cinemaProfiles,
  subscriptionPlans,
  tenantSubscriptions,
  restaurantMembers,
  user
} from '@menugo/database';
import { eq } from 'drizzle-orm';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../routes/super-admin.routes';
import {
  restaurantApiClient,
  cinemaApiClient,
  qrosApiClient
} from './internal-api-client';

/**
 * Ensures all subscription plans exist in QROS master DB,
 * and synchronizes them to Restaurant and Cinema domains via their Backend APIs.
 */
export async function syncSubscriptionPlans(): Promise<void> {
  try {
    const existingQrosPlans = await qrosDb.select().from(subscriptionPlans).catch(() => []);

    if (existingQrosPlans.length === 0) {
      console.log('[QROS SYNC] Seeding default subscription plans into QROS Master DB...');
      for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
        await qrosDb
          .insert(subscriptionPlans)
          .values(plan)
          .onConflictDoNothing();
      }
    }

    // Sync plans to Restaurant and Cinema via their Backend APIs
    const allQrosPlans = await qrosDb.select().from(subscriptionPlans);
    for (const plan of allQrosPlans) {
      await Promise.allSettled([
        restaurantApiClient.syncPlan(plan),
        cinemaApiClient.syncPlan(plan)
      ]);
    }
    console.log(`[QROS SYNC] Harmonized ${allQrosPlans.length} subscription plans across APIs.`);
  } catch (error: any) {
    console.error('[QROS SYNC] Error syncing subscription plans via API:', error?.message || error);
  }
}

/**
 * Synchronizes all venues, profiles, and accounts into QROS Master DB
 * by calling Restaurant and Cinema Backend APIs (Application & DB Isolation).
 */
export async function syncVenuesToQros(): Promise<void> {
  const toDate = (v: any) => (v ? new Date(v) : new Date());
  const toNullableDate = (v: any) => (v ? new Date(v) : null);

  try {
    // 1. Fetch data from Restaurant Backend API
    const restData = await restaurantApiClient.getSyncExport().catch((err: any) => {
      console.warn('[QROS SYNC] Notice: Restaurant API export failed:', err?.message || err);
      return { venues: [], users: [], members: [], subscriptions: [], payments: [] };
    });

    // 2. Fetch data from Cinema Backend API
    const cineData = await cinemaApiClient.getSyncExport().catch((err: any) => {
      console.warn('[QROS SYNC] Notice: Cinema API export failed:', err?.message || err);
      return { venues: [], profiles: [], users: [], members: [], subscriptions: [], payments: [] };
    });

    // 3. Ingest Users into QROS Master DB first (preserves foreign keys)
    const combinedUsers = [...(restData.users || []), ...(cineData.users || [])];
    for (const u of combinedUsers) {
      await qrosDb
        .insert(user)
        .values({
          id: u.id,
          name: u.name,
          email: u.email,
          emailVerified: u.emailVerified,
          image: u.image,
          role: u.role,
          tenantType: u.tenantType,
          createdAt: toDate(u.createdAt),
          updatedAt: toDate(u.updatedAt)
        })
        .onConflictDoUpdate({
          target: user.id,
          set: {
            role: u.role,
            tenantType: u.tenantType,
            updatedAt: new Date()
          }
        });
    }

    // 4. Ingest Restaurant venues into QROS Master DB
    let restSynced = 0;
    for (const r of restData.venues || []) {
      await qrosDb
        .insert(restaurants)
        .values({
          id: r.id,
          name: r.name,
          slug: r.slug,
          phone: r.phone,
          email: r.email,
          address: r.address,
          logoKey: r.logoKey,
          logoUrl: r.logoUrl,
          coverImageKey: r.coverImageKey,
          coverImageUrl: r.coverImageUrl,
          currency: r.currency,
          tenantType: 'restaurant',
          isActive: r.isActive,
          settings: r.settings,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt)
        })
        .onConflictDoUpdate({
          target: restaurants.id,
          set: {
            name: r.name,
            phone: r.phone,
            email: r.email,
            address: r.address,
            logoUrl: r.logoUrl,
            isActive: r.isActive,
            settings: r.settings,
            updatedAt: new Date()
          }
        });
      restSynced++;
    }

    // 5. Ingest Cinema venues into QROS Master DB
    let cineSynced = 0;
    for (const c of cineData.venues || []) {
      await qrosDb
        .insert(restaurants)
        .values({
          id: c.id,
          name: c.name,
          slug: c.slug,
          phone: c.phone,
          email: c.email,
          address: c.address,
          logoKey: c.logoKey,
          logoUrl: c.logoUrl,
          coverImageKey: c.coverImageKey,
          coverImageUrl: c.coverImageUrl,
          currency: c.currency,
          tenantType: 'cinema',
          isActive: c.isActive,
          settings: c.settings,
          createdAt: toDate(c.createdAt),
          updatedAt: toDate(c.updatedAt)
        })
        .onConflictDoUpdate({
          target: restaurants.id,
          set: {
            name: c.name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            logoUrl: c.logoUrl,
            isActive: c.isActive,
            settings: c.settings,
            updatedAt: new Date()
          }
        });
      cineSynced++;
    }

    // 6. Ingest Cinema Profiles into QROS Master DB
    for (const p of cineData.profiles || []) {
      await qrosDb
        .insert(cinemaProfiles)
        .values({
          id: p.id,
          theatreId: p.theatreId,
          theatreName: p.theatreName,
          chainOrBrand: p.chainOrBrand,
          address: p.address,
          city: p.city,
          state: p.state,
          country: p.country,
          contactNumber: p.contactNumber,
          contactEmail: p.contactEmail,
          businessDetails: p.businessDetails,
          timezone: p.timezone,
          currency: p.currency,
          logoKey: p.logoKey,
          logoUrl: p.logoUrl,
          onboardingStage: p.onboardingStage,
          onboardingCompleted: p.onboardingCompleted,
          onboardingStagesCompleted: p.onboardingStagesCompleted,
          createdAt: toDate(p.createdAt),
          updatedAt: toDate(p.updatedAt)
        })
        .onConflictDoUpdate({
          target: cinemaProfiles.id,
          set: {
            theatreName: p.theatreName,
            chainOrBrand: p.chainOrBrand,
            city: p.city,
            state: p.state,
            contactNumber: p.contactNumber,
            contactEmail: p.contactEmail,
            updatedAt: new Date()
          }
        });
    }

    // 7. Ingest Memberships into QROS Master DB
    const combinedMembers = [...(restData.members || []), ...(cineData.members || [])];
    for (const m of combinedMembers) {
      await qrosDb
        .insert(restaurantMembers)
        .values({
          id: m.id,
          restaurantId: m.restaurantId,
          userId: m.userId,
          role: m.role,
          createdAt: toDate(m.createdAt),
          updatedAt: toDate(m.updatedAt)
        })
        .onConflictDoNothing();
    }

    // 8. Ingest Subscriptions into QROS Master DB
    const combinedSubs = [...(restData.subscriptions || []), ...(cineData.subscriptions || [])];
    for (const s of combinedSubs) {
      await qrosDb
        .insert(tenantSubscriptions)
        .values({
          id: s.id,
          restaurantId: s.restaurantId,
          planId: s.planId,
          billingCycle: s.billingCycle,
          status: s.status,
          currentPeriodStart: toDate(s.currentPeriodStart),
          currentPeriodEnd: toDate(s.currentPeriodEnd),
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          trialEndsAt: toNullableDate(s.trialEndsAt),
          createdAt: toDate(s.createdAt),
          updatedAt: toDate(s.updatedAt)
        })
        .onConflictDoUpdate({
          target: tenantSubscriptions.id,
          set: {
            status: s.status,
            currentPeriodEnd: toDate(s.currentPeriodEnd),
            planId: s.planId,
            updatedAt: new Date()
          }
        });
    }

    console.log(`[QROS SYNC] Successfully synced ${restSynced} restaurants and ${cineSynced} cinema theatres into QROS Master DB via API.`);
  } catch (error: any) {
    console.error('[QROS SYNC] Error syncing venues to QROS DB via API:', error?.message || error);
  }
}

/**
 * Registers a single venue into QROS Master DB via the QROS Internal API.
 * Called immediately upon restaurant creation or cinema onboarding.
 */
export async function syncSingleVenueToQros(
  venueData: any,
  profileData?: any
): Promise<void> {
  try {
    await qrosApiClient.registerVenue(venueData, profileData);
  } catch (err: any) {
    console.warn(`[QROS SYNC] Non-critical notice: syncing venue ${venueData?.id} via API:`, err?.message || err);
  }
}

/**
 * Master initialization runner for QROS DB.
 */
export async function syncQrosDatabase(): Promise<void> {
  console.log('[QROS] Running API-driven tri-database harmonization & sync...');
  await syncSubscriptionPlans();
  await syncVenuesToQros();
  console.log('[QROS] API-driven sync complete. QROS DB is fully up to date.');
}
