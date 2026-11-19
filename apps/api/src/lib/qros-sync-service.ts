import {
  qrosDb,
  restaurantDb,
  cinemaDb,
  restaurants,
  cinemaProfiles,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionPayments,
  restaurantMembers,
  user
} from '@menugo/database';
import { eq, sql } from 'drizzle-orm';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../routes/super-admin.routes';

/**
 * Ensures all subscription plans exist in QROS master DB,
 * and are harmonized across restaurantDb and cinemaDb.
 */
export async function syncSubscriptionPlans(): Promise<void> {
  try {
    const existingQrosPlans = await qrosDb.select().from(subscriptionPlans);
    
    if (existingQrosPlans.length === 0) {
      console.log('[QROS SYNC] Seeding default subscription plans into QROS Master DB...');
      for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
        await qrosDb
          .insert(subscriptionPlans)
          .values(plan)
          .onConflictDoNothing();
      }
    }

    // Ensure restaurantDb and cinemaDb also have the plans
    const allQrosPlans = await qrosDb.select().from(subscriptionPlans);
    for (const plan of allQrosPlans) {
      await Promise.allSettled([
        restaurantDb
          .insert(subscriptionPlans)
          .values({
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            description: plan.description,
            tenantType: plan.tenantType,
            priceMonthlyPaise: plan.priceMonthlyPaise,
            priceAnnualPaise: plan.priceAnnualPaise,
            maxTables: plan.maxTables,
            maxScreens: plan.maxScreens,
            maxStaff: plan.maxStaff,
            features: plan.features,
            isPopular: plan.isPopular,
            isActive: plan.isActive,
            sortOrder: plan.sortOrder
          })
          .onConflictDoUpdate({
            target: subscriptionPlans.id,
            set: {
              name: plan.name,
              priceMonthlyPaise: plan.priceMonthlyPaise,
              priceAnnualPaise: plan.priceAnnualPaise,
              isActive: plan.isActive,
              sortOrder: plan.sortOrder
            }
          }),
        cinemaDb
          .insert(subscriptionPlans)
          .values({
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            description: plan.description,
            tenantType: plan.tenantType,
            priceMonthlyPaise: plan.priceMonthlyPaise,
            priceAnnualPaise: plan.priceAnnualPaise,
            maxTables: plan.maxTables,
            maxScreens: plan.maxScreens,
            maxStaff: plan.maxStaff,
            features: plan.features,
            isPopular: plan.isPopular,
            isActive: plan.isActive,
            sortOrder: plan.sortOrder
          })
          .onConflictDoUpdate({
            target: subscriptionPlans.id,
            set: {
              name: plan.name,
              priceMonthlyPaise: plan.priceMonthlyPaise,
              priceAnnualPaise: plan.priceAnnualPaise,
              isActive: plan.isActive,
              sortOrder: plan.sortOrder
            }
          })
      ]);
    }
    console.log(`[QROS SYNC] Harmonized ${allQrosPlans.length} subscription plans across all databases.`);
  } catch (error: any) {
    console.error('[QROS SYNC] Error syncing subscription plans:', error?.message || error);
  }
}

/**
 * Synchronizes all restaurant venues from restaurantDb and all cinema venues from cinemaDb
 * into the central QROS master database (qrosDb).
 */
export async function syncVenuesToQros(): Promise<void> {
  try {
    // 1. Fetch from restaurantDb
    const restVenues = await restaurantDb.select().from(restaurants).catch(() => []);
    let restSynced = 0;
    for (const r of restVenues) {
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
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
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

    // 2. Fetch from cinemaDb
    const cineVenues = await cinemaDb.select().from(restaurants).catch(() => []);
    const cineProfiles = await cinemaDb.select().from(cinemaProfiles).catch(() => []);
    let cineSynced = 0;

    for (const c of cineVenues) {
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
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
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

    // Sync cinema profiles into qrosDb
    for (const p of cineProfiles) {
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
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
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

    // 3. Sync user accounts FIRST so foreign keys on restaurant_members are satisfied
    const [restUsers, cineUsers] = await Promise.all([
      restaurantDb.select().from(user).catch(() => []),
      cinemaDb.select().from(user).catch(() => [])
    ]);

    for (const u of [...restUsers, ...cineUsers]) {
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
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
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

    // 4. Sync memberships for venue owners so Super Admin can display contact info
    const [restMembers, cineMembers] = await Promise.all([
      restaurantDb.select().from(restaurantMembers).where(eq(restaurantMembers.role, 'owner')).catch(() => []),
      cinemaDb.select().from(restaurantMembers).where(eq(restaurantMembers.role, 'owner')).catch(() => [])
    ]);

    const allOwnerMembers = [...restMembers, ...cineMembers];
    for (const m of allOwnerMembers) {
      await qrosDb
        .insert(restaurantMembers)
        .values({
          id: m.id,
          restaurantId: m.restaurantId,
          userId: m.userId,
          role: m.role,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt
        })
        .onConflictDoNothing();
    }

    // 4. Sync subscriptions into qrosDb
    const [restSubs, cineSubs] = await Promise.all([
      restaurantDb.select().from(tenantSubscriptions).catch(() => []),
      cinemaDb.select().from(tenantSubscriptions).catch(() => [])
    ]);

    for (const s of [...restSubs, ...cineSubs]) {
      await qrosDb
        .insert(tenantSubscriptions)
        .values({
          id: s.id,
          restaurantId: s.restaurantId,
          planId: s.planId,
          billingCycle: s.billingCycle,
          status: s.status,
          currentPeriodStart: s.currentPeriodStart,
          currentPeriodEnd: s.currentPeriodEnd,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          trialEndsAt: s.trialEndsAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        })
        .onConflictDoUpdate({
          target: tenantSubscriptions.id,
          set: {
            status: s.status,
            currentPeriodEnd: s.currentPeriodEnd,
            planId: s.planId,
            updatedAt: new Date()
          }
        });
    }

    console.log(`[QROS SYNC] Successfully synced ${restSynced} restaurants and ${cineSynced} cinema theatres into QROS Master DB.`);
  } catch (error: any) {
    console.error('[QROS SYNC] Error syncing venues to QROS DB:', error?.message || error);
  }
}

/**
 * Upserts a single venue (restaurant or cinema) directly into the QROS master database.
 * Called immediately upon restaurant creation or cinema onboarding.
 */
export async function syncSingleVenueToQros(
  venueData: any,
  profileData?: any
): Promise<void> {
  try {
    await qrosDb
      .insert(restaurants)
      .values(venueData)
      .onConflictDoUpdate({
        target: restaurants.id,
        set: {
          name: venueData.name,
          slug: venueData.slug,
          phone: venueData.phone,
          email: venueData.email,
          address: venueData.address,
          logoUrl: venueData.logoUrl,
          coverImageUrl: venueData.coverImageUrl,
          currency: venueData.currency,
          tenantType: venueData.tenantType,
          isActive: venueData.isActive,
          settings: venueData.settings,
          updatedAt: new Date()
        }
      });

    if (profileData) {
      await qrosDb
        .insert(cinemaProfiles)
        .values(profileData)
        .onConflictDoUpdate({
          target: cinemaProfiles.id,
          set: {
            theatreName: profileData.theatreName,
            chainOrBrand: profileData.chainOrBrand,
            city: profileData.city,
            state: profileData.state,
            contactNumber: profileData.contactNumber,
            contactEmail: profileData.contactEmail,
            updatedAt: new Date()
          }
        });
    }
  } catch (err: any) {
    console.warn(`[QROS SYNC] Non-critical error syncing venue ${venueData.id} to QROS DB:`, err?.message || err);
  }
}

/**
 * Master initialization runner for QROS DB.
 */
export async function syncQrosDatabase(): Promise<void> {
  console.log('[QROS] Running tri-database harmonization & sync...');
  await syncSubscriptionPlans();
  await syncVenuesToQros();
  console.log('[QROS] Tri-database sync complete. QROS DB is fully up to date.');
}
