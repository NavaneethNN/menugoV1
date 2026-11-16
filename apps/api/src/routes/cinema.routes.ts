import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  restaurants,
  restaurantMembers,
  cinemaProfiles,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  cinemaQrCodes,
  cinemaCarts,
  cinemaPaymentAccounts,
  cinemaPaymentTransactions,
  cinemaRefunds,
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, and, or, sql, count, ne, asc, desc, ilike, gte, lte, inArray } from 'drizzle-orm';
import {
  createCinemaProfileSchema,
  updateCinemaProfileSchema,
  updateCinemaOnboardingStageSchema,
  createCinemaScreenSchema,
  updateCinemaScreenSchema,
  createCinemaRowSchema,
  updateCinemaRowSchema,
  createCinemaSeatSchema,
  updateCinemaSeatSchema,
  batchCreateCinemaRowsSchema,
  createCinemaMovieSchema,
  updateCinemaMovieSchema,
  updateCinemaMoviePosterSchema,
  createCinemaShowSchema,
  updateCinemaShowSchema,
  cancelCinemaShowSchema,
  copyCinemaScheduleSchema,
  generateCinemaQrToken,
  buildCinemaTheatreQrUrl,
  buildCinemaScreenQrUrl,
  isValidCinemaQrTokenFormat,
  generateCinemaScreenQrSchema,
  revokeCinemaQrSchema,
  cinemaCartItemSchema,
  cinemaCartContextSchema,
  addCinemaCartItemSchema,
  updateCinemaCartItemQuantitySchema,
  calculateCinemaCheckoutSchema,
  prepareCinemaOrderSchema,
  DEFAULT_TURNAROUND_BUFFER_MINUTES,
  CINEMA_ONBOARDING_STAGES,
  CINEMA_ONBOARDING_STAGE_INFO,
  CinemaOnboardingStage,
  updateOrderStatusSchema,
  validateStatusTransition,
  isTerminalOrderStatus,
  OrderStatus
} from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireCinemaTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { tableVerificationRateLimiter } from '../middleware/rate-limiter';
import { publishOrderUpdated } from '../lib/realtime';
import QRCode from 'qrcode';
import crypto from 'crypto';
import cinemaPaymentRoutes from './cinema-payment.routes';
import cinemaReportsRoutes from './cinema-reports.routes';
import cinemaStaffRoutes from './cinema-staff.routes';
import cinemaDeliveryRoutes from './cinema-delivery.routes';

const router = Router();

// Mount Cinema Payment Gateway Architecture Routes (Task 11)
router.use('/payments', cinemaPaymentRoutes);

// Mount Cinema Reports & Analytics Routes (Task 18)
router.use('/reports', cinemaReportsRoutes);

// Mount Cinema Staff Management Routes (Task 19)
router.use('/staff', cinemaStaffRoutes);

// Mount Cinema Delivery & Seat Runner Routes (Task 19)
router.use('/delivery', cinemaDeliveryRoutes);

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `theatre-${crypto.randomBytes(3).toString('hex')}`;
}

async function generateUniqueSlug(baseName: string): Promise<string> {
  let candidate = slugify(baseName);
  if (candidate.length < 2) candidate = `theatre-${candidate}`;
  if (candidate.length > 90) candidate = candidate.substring(0, 90);

  const [existing] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.slug, candidate))
    .limit(1);

  if (!existing) {
    return candidate;
  }

  // Append random hex suffix
  return `${candidate}-${crypto.randomBytes(2).toString('hex')}`;
}

/**
 * POST /api/cinema/theatres
 * Registers a new Cinema Theatre and its 1:1 cinema_profiles record transactionally.
 * Binds the creating user as owner in restaurant_members.
 */
router.post('/theatres', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createCinemaProfileSchema.parse(req.body);
    const theatreId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    const slug = validatedData.slug || (await generateUniqueSlug(validatedData.theatreName));

    const result = await db.transaction(async (tx) => {
      // 1. Insert into core restaurants table with tenantType = 'cinema'
      const [theatre] = await tx
        .insert(restaurants)
        .values({
          id: theatreId,
          name: validatedData.theatreName,
          slug,
          phone: validatedData.contactNumber,
          email: validatedData.contactEmail,
          address: validatedData.address || null,
          logoKey: validatedData.logoKey || null,
          logoUrl: validatedData.logoUrl || null,
          currency: validatedData.currency || 'INR',
          tenantType: 'cinema',
          isActive: true,
          settings: {
            timezone: validatedData.timezone || 'Asia/Kolkata',
            chainOrBrand: validatedData.chainOrBrand || null,
            businessDetails: validatedData.businessDetails || null,
            city: validatedData.city,
            state: validatedData.state,
            country: validatedData.country || 'India'
          }
        })
        .returning();

      // 2. Assign creating user as owner in restaurant_members
      const [membership] = await tx
        .insert(restaurantMembers)
        .values({
          id: crypto.randomUUID(),
          restaurantId: theatreId,
          userId: req.user!.id,
          role: 'owner'
        })
        .returning();

      // 3. Insert 1:1 cinema_profiles record with initial onboarding stage
      const [profile] = await tx
        .insert(cinemaProfiles)
        .values({
          id: profileId,
          theatreId,
          theatreName: validatedData.theatreName,
          chainOrBrand: validatedData.chainOrBrand || null,
          address: validatedData.address || null,
          city: validatedData.city,
          state: validatedData.state,
          country: validatedData.country || 'India',
          contactNumber: validatedData.contactNumber,
          contactEmail: validatedData.contactEmail,
          businessDetails: validatedData.businessDetails || null,
          timezone: validatedData.timezone || 'Asia/Kolkata',
          currency: validatedData.currency || 'INR',
          logoKey: validatedData.logoKey || null,
          logoUrl: validatedData.logoUrl || null,
          onboardingStage: 'profile_completed',
          onboardingCompleted: false,
          onboardingStagesCompleted: ['profile_completed']
        })
        .returning();

      return { theatre, profile, membership };
    });

    res.status(201).json({
      message: 'Cinema theatre registered successfully',
      theatre: result.theatre,
      profile: result.profile,
      membership: result.membership
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      next(new AppError('A theatre with this slug or name already exists.', 409));
      return;
    }
    next(error);
  }
});

/**
 * GET /api/cinema/access-check
 * Verifies that the authenticated user has access to the requested cinema tenant.
 */
router.get(
  '/access-check',
  requireAuth,
  requireCinemaTenant(),
  async (req: Request, res: Response) => {
    const tenant = req.tenant!;
    res.json({
      hasAccess: true,
      tenantType: tenant.restaurant.tenantType,
      theatre: {
        id: tenant.restaurant.id,
        name: tenant.restaurant.name,
        slug: tenant.restaurant.slug,
        currency: tenant.restaurant.currency,
        isActive: tenant.restaurant.isActive
      },
      membershipId: tenant.membershipId,
      role: tenant.role,
      permissions: tenant.permissions
    });
  }
);

/**
 * GET /api/cinema/profile
 * Returns cinema theatre profile information.
 */
router.get(
  '/profile',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;

      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
        .limit(1);

      if (!profile) {
        // Fallback: If tenant exists in restaurants but cinema_profiles row missing, synthesize/sync
        const [theatre] = await db
          .select()
          .from(restaurants)
          .where(eq(restaurants.id, tenant.restaurantId))
          .limit(1);

        if (!theatre) {
          throw new AppError('Cinema theatre profile not found', 404);
        }

        const settings = (theatre.settings as any) || {};
        const [createdProfile] = await db
          .insert(cinemaProfiles)
          .values({
            id: crypto.randomUUID(),
            theatreId: theatre.id,
            theatreName: theatre.name,
            chainOrBrand: settings.chainOrBrand || null,
            address: theatre.address || null,
            city: settings.city || 'Default City',
            state: settings.state || 'Default State',
            country: settings.country || 'India',
            contactNumber: theatre.phone || '0000000000',
            contactEmail: theatre.email || 'theatre@menugo.dev',
            businessDetails: settings.businessDetails || null,
            timezone: settings.timezone || 'Asia/Kolkata',
            currency: theatre.currency || 'INR',
            logoKey: theatre.logoKey,
            logoUrl: theatre.logoUrl,
            onboardingStage: 'profile_completed',
            onboardingCompleted: false,
            onboardingStagesCompleted: ['profile_completed']
          })
          .returning();

        return res.json({
          ...createdProfile,
          theatreSlug: theatre.slug
        });
      }

      res.json({
        ...profile,
        theatreSlug: tenant.restaurant.slug
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/profile
 * Updates cinema theatre profile and syncs changes to restaurants table.
 */
router.patch(
  '/profile',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const validatedData = updateCinemaProfileSchema.parse(req.body);

      const updated = await db.transaction(async (tx) => {
        // 1. Update cinema_profiles
        const [profile] = await tx
          .update(cinemaProfiles)
          .set({
            ...(validatedData.theatreName ? { theatreName: validatedData.theatreName } : {}),
            ...(validatedData.chainOrBrand !== undefined ? { chainOrBrand: validatedData.chainOrBrand } : {}),
            ...(validatedData.address !== undefined ? { address: validatedData.address } : {}),
            ...(validatedData.city ? { city: validatedData.city } : {}),
            ...(validatedData.state ? { state: validatedData.state } : {}),
            ...(validatedData.country ? { country: validatedData.country } : {}),
            ...(validatedData.contactNumber ? { contactNumber: validatedData.contactNumber } : {}),
            ...(validatedData.contactEmail ? { contactEmail: validatedData.contactEmail } : {}),
            ...(validatedData.businessDetails !== undefined ? { businessDetails: validatedData.businessDetails } : {}),
            ...(validatedData.timezone ? { timezone: validatedData.timezone } : {}),
            ...(validatedData.currency ? { currency: validatedData.currency } : {}),
            ...(validatedData.logoKey !== undefined ? { logoKey: validatedData.logoKey } : {}),
            ...(validatedData.logoUrl !== undefined ? { logoUrl: validatedData.logoUrl } : {}),
            updatedAt: new Date()
          })
          .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
          .returning();

        // 2. Sync corresponding fields in restaurants
        await tx
          .update(restaurants)
          .set({
            ...(validatedData.theatreName ? { name: validatedData.theatreName } : {}),
            ...(validatedData.contactNumber ? { phone: validatedData.contactNumber } : {}),
            ...(validatedData.contactEmail ? { email: validatedData.contactEmail } : {}),
            ...(validatedData.address !== undefined ? { address: validatedData.address } : {}),
            ...(validatedData.logoKey !== undefined ? { logoKey: validatedData.logoKey } : {}),
            ...(validatedData.logoUrl !== undefined ? { logoUrl: validatedData.logoUrl } : {}),
            ...(validatedData.currency ? { currency: validatedData.currency } : {}),
            updatedAt: new Date()
          })
          .where(eq(restaurants.id, tenant.restaurantId));

        return profile;
      });

      if (!updated) {
        throw new AppError('Cinema theatre profile not found to update', 404);
      }

      res.json({
        message: 'Theatre profile updated successfully',
        profile: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/onboarding/status
 * Retrieves authoritative onboarding progress across the 8 sequential stages.
 * Only marks completed what is actually completed in the database.
 */
router.get(
  '/onboarding/status',
  requireAuth,
  requireCinemaTenant(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;

      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
        .limit(1);

      // Verify actual status of stage 1
      const isProfileDone = Boolean(
        profile &&
        profile.theatreName &&
        profile.city &&
        profile.state &&
        profile.contactNumber &&
        profile.contactEmail
      );

      // Verify actual status of stage 2 (Screens - Task 03)
      const screenRows = await db
        .select({ id: cinemaScreens.id })
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.theatreId, tenant.restaurantId),
            ne(cinemaScreens.status, 'archived')
          )
        )
        .limit(1);
      const isScreensDone = screenRows.length > 0;

      // Verify actual status of stage 3 (Seating - Task 04)
      const seatingRows = await db
        .select({ id: cinemaSeats.id })
        .from(cinemaSeats)
        .where(
          and(
            eq(cinemaSeats.theatreId, tenant.restaurantId),
            ne(cinemaSeats.status, 'archived')
          )
        )
        .limit(1);
      const isSeatingDone = seatingRows.length > 0;

      // Verify actual status of stage 4 (Menu - Task 07)
      const productRows = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.restaurantId, tenant.restaurantId))
        .limit(1);
      const isMenuDone = productRows.length > 0;

      // Verify actual status of stage 6 (Shows - Task 06)
      const showRows = await db
        .select({ id: cinemaShows.id })
        .from(cinemaShows)
        .where(
          and(
            eq(cinemaShows.theatreId, tenant.restaurantId),
            ne(cinemaShows.status, 'cancelled')
          )
        )
        .limit(1);
      const isShowsDone = showRows.length > 0;

      // Verify actual status of stage 7 (QR Codes - Task 08)
      const qrRows = await db
        .select({ id: cinemaQrCodes.id })
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.theatreId, tenant.restaurantId),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);
      const isQrDone = qrRows.length > 0;

      // For tasks 03-08: Stages reflect actual database state (no fake states)
      const stagesStatus = CINEMA_ONBOARDING_STAGES.map((stageKey, index) => {
        const info = CINEMA_ONBOARDING_STAGE_INFO[stageKey];
        let isCompleted = false;

        if (stageKey === 'profile_completed') {
          isCompleted = isProfileDone;
        } else if (stageKey === 'screens_added') {
          isCompleted = isScreensDone;
        } else if (stageKey === 'seating_configured') {
          isCompleted = isSeatingDone;
        } else if (stageKey === 'menu_configured') {
          isCompleted = isMenuDone;
        } else if (stageKey === 'shows_scheduled') {
          isCompleted = isShowsDone;
        } else if (stageKey === 'qr_generated') {
          isCompleted = isQrDone;
        }

        // Lock stages beyond the immediately next pending step
        let isLocked = false;
        if (index === 0) {
          isLocked = false;
        } else if (index === 1) {
          isLocked = !isProfileDone;
        } else if (index === 2) {
          isLocked = !isScreensDone;
        } else if (index === 3) {
          isLocked = !isSeatingDone;
        } else if (index === 4) {
          isLocked = !isMenuDone;
        } else if (index === 5) {
          isLocked = !isMenuDone;
        } else if (index === 6) {
          isLocked = !isMenuDone;
        } else {
          isLocked = true;
        }

        return {
          key: stageKey,
          step: info.step,
          title: info.title,
          description: info.description,
          isCompleted,
          isLocked
        };
      });

      const completedCount = stagesStatus.filter((s) => s.isCompleted).length;
      const totalCount = CINEMA_ONBOARDING_STAGES.length;
      const percentage = Math.round((completedCount / totalCount) * 100);

      res.json({
        theatreId: tenant.restaurantId,
        theatreName: tenant.restaurant.name,
        currentStage: profile?.onboardingStage || 'profile_completed',
        isComplete: completedCount === totalCount,
        completedCount,
        totalCount,
        percentage,
        stages: stagesStatus
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/onboarding/stage
 * Updates the current stage milestone for a cinema theatre.
 */
router.patch(
  '/onboarding/stage',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const { stage, completed } = updateCinemaOnboardingStageSchema.parse(req.body);

      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
        .limit(1);

      if (!profile) {
        throw new AppError('Cinema profile not found', 404);
      }

      const existingCompleted = (profile.onboardingStagesCompleted as string[]) || [];
      const updatedStages = completed
        ? Array.from(new Set([...existingCompleted, stage]))
        : existingCompleted.filter((s) => s !== stage);

      const [updated] = await db
        .update(cinemaProfiles)
        .set({
          onboardingStage: stage,
          onboardingStagesCompleted: updatedStages,
          onboardingCompleted: updatedStages.length === CINEMA_ONBOARDING_STAGES.length,
          updatedAt: new Date()
        })
        .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
        .returning();

      res.json({
        message: `Onboarding stage updated to "${stage}"`,
        profile: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/dashboard/summary
 * Cinema Admin Dashboard Overview Summary.
 */
router.get(
  '/dashboard/summary',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;

      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
        .limit(1);

      const [activeScreensResult] = await db
        .select({ count: count() })
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.theatreId, tenant.restaurantId),
            eq(cinemaScreens.status, 'active')
          )
        );

      const summary = {
        theatre: {
          id: tenant.restaurant.id,
          name: tenant.restaurant.name,
          slug: tenant.restaurant.slug,
          currency: tenant.restaurant.currency,
          tenantType: tenant.restaurant.tenantType,
          isActive: tenant.restaurant.isActive,
          city: profile?.city || '',
          state: profile?.state || '',
          timezone: profile?.timezone || 'Asia/Kolkata'
        },
        profile: profile || null,
        userRole: tenant.role,
        permissions: tenant.permissions,
        onboarding: {
          stage: profile?.onboardingStage || 'profile_completed',
          isComplete: Boolean(profile?.onboardingCompleted),
          completedStagesCount: ((profile?.onboardingStagesCompleted as string[]) || []).length,
          totalStagesCount: CINEMA_ONBOARDING_STAGES.length
        },
        stats: {
          todayOrders: 0,
          todaySales: 0,
          pendingOrders: 0,
          preparingOrders: 0,
          readyOrders: 0,
          deliveredOrders: 0,
          activeScreens: Number(activeScreensResult?.count || 0),
          todayShows: 0
        },
        systemStatus: {
          businessType: 'cinema',
          status: 'ready',
          timestamp: new Date().toISOString()
        }
      };

      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// CINEMA SCREEN MANAGEMENT ENDPOINTS (Task 03)
// ===========================================================================

/**
 * POST /api/cinema/screens
 * Creates a new screen for the authenticated cinema theatre.
 */
router.post(
  '/screens',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const validatedData = createCinemaScreenSchema.parse(req.body);

      // Prevent duplicate screen names within the same theatre
      const [existing] = await db
        .select({ id: cinemaScreens.id })
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.theatreId, tenant.restaurantId),
            ne(cinemaScreens.status, 'archived'),
            sql`lower(${cinemaScreens.screenName}) = lower(${validatedData.screenName})`
          )
        )
        .limit(1);

      if (existing) {
        throw new AppError(`A screen named "${validatedData.screenName}" already exists in this theatre`, 409);
      }

      const [screen] = await db
        .insert(cinemaScreens)
        .values({
          id: crypto.randomUUID(),
          theatreId: tenant.restaurantId,
          screenName: validatedData.screenName,
          description: validatedData.description || null,
          screenType: validatedData.screenType || 'standard',
          status: validatedData.status || 'active',
          totalRows: 0,
          totalSeats: 0,
          seatingConfigured: false
        })
        .returning();

      // Automatically advance onboarding milestone stage
      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
        .limit(1);

      if (profile) {
        const completedStages = (profile.onboardingStagesCompleted as string[]) || [];
        if (!completedStages.includes('screens_added')) {
          await db
            .update(cinemaProfiles)
            .set({
              onboardingStage: 'screens_added',
              onboardingStagesCompleted: [...completedStages, 'screens_added'],
              updatedAt: new Date()
            })
            .where(eq(cinemaProfiles.theatreId, tenant.restaurantId));
        }
      }

      res.status(201).json({
        message: 'Cinema screen created successfully',
        screen
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/screens
 * Lists all screens belonging to the authenticated cinema theatre.
 */
router.get(
  '/screens',
  requireAuth,
  requireCinemaTenant(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const statusFilter = req.query.status as string | undefined;

      const conditions = [eq(cinemaScreens.theatreId, tenant.restaurantId)];

      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(cinemaScreens.status, statusFilter));
      } else if (!statusFilter) {
        // Exclude archived screens by default
        conditions.push(ne(cinemaScreens.status, 'archived'));
      }

      const screens = await db
        .select()
        .from(cinemaScreens)
        .where(and(...conditions))
        .orderBy(asc(cinemaScreens.createdAt));

      res.json({
        theatreId: tenant.restaurantId,
        theatreName: tenant.restaurant.name,
        count: screens.length,
        screens
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/screens/:id
 * Retrieves individual screen details.
 */
router.get(
  '/screens/:id',
  requireAuth,
  requireCinemaTenant(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const id = req.params.id as string;

      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, id),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      res.json({ screen });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/screens/:id
 * Updates screen information.
 */
router.patch(
  '/screens/:id',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const id = req.params.id as string;
      const validatedData = updateCinemaScreenSchema.parse(req.body);

      const [existingScreen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, id),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!existingScreen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      // Check duplicate screen name if name is being changed
      if (validatedData.screenName && validatedData.screenName !== existingScreen.screenName) {
        const [duplicate] = await db
          .select({ id: cinemaScreens.id })
          .from(cinemaScreens)
          .where(
            and(
              eq(cinemaScreens.theatreId, tenant.restaurantId),
              ne(cinemaScreens.id, id),
              ne(cinemaScreens.status, 'archived'),
              sql`lower(${cinemaScreens.screenName}) = lower(${validatedData.screenName})`
            )
          )
          .limit(1);

        if (duplicate) {
          throw new AppError(`A screen named "${validatedData.screenName}" already exists in this theatre`, 409);
        }
      }

      const [updated] = await db
        .update(cinemaScreens)
        .set({
          ...(validatedData.screenName ? { screenName: validatedData.screenName } : {}),
          ...(validatedData.description !== undefined ? { description: validatedData.description } : {}),
          ...(validatedData.screenType ? { screenType: validatedData.screenType } : {}),
          ...(validatedData.status ? { status: validatedData.status } : {}),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaScreens.id, id),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      res.json({
        message: 'Screen updated successfully',
        screen: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/screens/:id/activate
 * Activates a screen.
 */
router.post(
  '/screens/:id/activate',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const id = req.params.id as string;

      const [screen] = await db
        .update(cinemaScreens)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaScreens.id, id),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      res.json({
        message: `Screen "${screen.screenName}" activated successfully`,
        screen
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/screens/:id/deactivate
 * Deactivates a screen.
 */
router.post(
  '/screens/:id/deactivate',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const id = req.params.id as string;

      const [screen] = await db
        .update(cinemaScreens)
        .set({
          status: 'inactive',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaScreens.id, id),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      res.json({
        message: `Screen "${screen.screenName}" deactivated successfully`,
        screen
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cinema/screens/:id
 * Historical data protection: Screen deletion vs archival.
 */
router.delete(
  '/screens/:id',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const id = req.params.id as string;
      const permanent = req.query.permanent === 'true';

      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, id),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      // Historical Data Protection:
      // Prevent permanent deletion if historical orders exist in the theatre or seating has been configured
      if (permanent) {
        const orderHistory = await db
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.restaurantId, tenant.restaurantId))
          .limit(1);

        if (screen.seatingConfigured || orderHistory.length > 0) {
          throw new AppError(
            'Cannot permanently delete screen with associated historical activity. Please deactivate or archive the screen instead.',
            409
          );
        }

        await db
          .delete(cinemaScreens)
          .where(
            and(
              eq(cinemaScreens.id, id),
              eq(cinemaScreens.theatreId, tenant.restaurantId)
            )
          );

        return res.json({
          message: `Screen "${screen.screenName}" permanently deleted`,
          deletedId: id
        });
      }

      // Safe default: Archive screen
      const [archived] = await db
        .update(cinemaScreens)
        .set({
          status: 'archived',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaScreens.id, id),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      res.json({
        message: `Screen "${screen.screenName}" archived successfully`,
        screen: archived
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// CINEMA SEATING CONFIGURATION ENDPOINTS (Task 04)
// ===========================================================================

/**
 * Helper: Recalculates totalRows, totalSeats and seatingConfigured status
 * on cinemaScreens, and updates onboarding milestone stage.
 */
async function syncScreenStats(theatreId: string, screenId: string) {
  const [activeRows] = await db
    .select({ count: count() })
    .from(cinemaRows)
    .where(
      and(
        eq(cinemaRows.theatreId, theatreId),
        eq(cinemaRows.screenId, screenId),
        ne(cinemaRows.status, 'archived')
      )
    );

  const [activeSeats] = await db
    .select({ count: count() })
    .from(cinemaSeats)
    .where(
      and(
        eq(cinemaSeats.theatreId, theatreId),
        eq(cinemaSeats.screenId, screenId),
        ne(cinemaSeats.status, 'archived')
      )
    );

  const totalRows = Number(activeRows?.count || 0);
  const totalSeats = Number(activeSeats?.count || 0);

  await db
    .update(cinemaScreens)
    .set({
      totalRows,
      totalSeats,
      seatingConfigured: totalSeats > 0,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(cinemaScreens.theatreId, theatreId),
        eq(cinemaScreens.id, screenId)
      )
    );

  // Auto-progress onboarding milestone if seats exist
  if (totalSeats > 0) {
    const [profile] = await db
      .select()
      .from(cinemaProfiles)
      .where(eq(cinemaProfiles.theatreId, theatreId))
      .limit(1);

    if (profile) {
      const stages = (profile.onboardingStagesCompleted as string[]) || [];
      if (!stages.includes('seating_configured')) {
        await db
          .update(cinemaProfiles)
          .set({
            onboardingStage: 'seating_configured',
            onboardingStagesCompleted: [...stages, 'seating_configured'],
            updatedAt: new Date()
          })
          .where(eq(cinemaProfiles.theatreId, theatreId));
      }
    }
  }
}

/**
 * GET /api/cinema/screens/:screenId/seating
 * Retrieves the complete seating layout for a cinema screen.
 */
router.get(
  '/screens/:screenId/seating',
  requireAuth,
  requireCinemaTenant(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const screenId = req.params.screenId as string;

      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, screenId),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      const rows = await db
        .select()
        .from(cinemaRows)
        .where(
          and(
            eq(cinemaRows.theatreId, tenant.restaurantId),
            eq(cinemaRows.screenId, screenId),
            ne(cinemaRows.status, 'archived')
          )
        )
        .orderBy(asc(cinemaRows.sortOrder), asc(cinemaRows.rowIdentifier));

      const seats = await db
        .select()
        .from(cinemaSeats)
        .where(
          and(
            eq(cinemaSeats.theatreId, tenant.restaurantId),
            eq(cinemaSeats.screenId, screenId),
            ne(cinemaSeats.status, 'archived')
          )
        )
        .orderBy(asc(cinemaSeats.rowIdentifier), asc(cinemaSeats.seatNumber));

      // Group seats by rowId
      const seatsByRowId: Record<string, typeof seats> = {};
      seats.forEach((seat) => {
        if (!seatsByRowId[seat.rowId]) {
          seatsByRowId[seat.rowId] = [];
        }
        seatsByRowId[seat.rowId]!.push(seat);
      });

      const rowsWithSeats = rows.map((r) => ({
        ...r,
        seats: seatsByRowId[r.id] || []
      }));

      // Calculate category breakdowns
      const categoryBreakdown = {
        regular: seats.filter((s) => s.seatCategory === 'regular').length,
        premium: seats.filter((s) => s.seatCategory === 'premium').length,
        recliner: seats.filter((s) => s.seatCategory === 'recliner').length,
        vip: seats.filter((s) => s.seatCategory === 'vip').length
      };

      const statusBreakdown = {
        active: seats.filter((s) => s.status === 'active').length,
        inactive: seats.filter((s) => s.status === 'inactive').length
      };

      res.json({
        screen,
        rows: rowsWithSeats,
        totalRows: rows.length,
        totalSeats: seats.length,
        categoryBreakdown,
        statusBreakdown
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/screens/:screenId/rows
 * Adds a new row and automatically generates individual seat records.
 */
router.post(
  '/screens/:screenId/rows',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const screenId = req.params.screenId as string;
      const validatedData = createCinemaRowSchema.parse(req.body);

      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, screenId),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      // Check duplicate row identifier on this screen
      const [existingRow] = await db
        .select({ id: cinemaRows.id })
        .from(cinemaRows)
        .where(
          and(
            eq(cinemaRows.theatreId, tenant.restaurantId),
            eq(cinemaRows.screenId, screenId),
            ne(cinemaRows.status, 'archived'),
            sql`lower(${cinemaRows.rowIdentifier}) = lower(${validatedData.rowIdentifier})`
          )
        )
        .limit(1);

      if (existingRow) {
        throw new AppError(
          `Row "${validatedData.rowIdentifier}" already exists on this screen`,
          409
        );
      }

      const totalSeatsInRow = validatedData.endSeatNumber - validatedData.startSeatNumber + 1;
      const rowId = crypto.randomUUID();

      // Transactional row creation and seat generation
      const result = await db.transaction(async (tx) => {
        const [createdRow] = await tx
          .insert(cinemaRows)
          .values({
            id: rowId,
            theatreId: tenant.restaurantId,
            screenId,
            rowIdentifier: validatedData.rowIdentifier,
            sortOrder: validatedData.sortOrder ?? 0,
            startSeatNumber: validatedData.startSeatNumber,
            endSeatNumber: validatedData.endSeatNumber,
            totalSeats: totalSeatsInRow,
            seatCategory: validatedData.seatCategory,
            status: validatedData.status
          })
          .returning();

        // Generate individual seats automatically
        const seatsToInsert = [];
        for (let seatNum = validatedData.startSeatNumber; seatNum <= validatedData.endSeatNumber; seatNum++) {
          seatsToInsert.push({
            id: crypto.randomUUID(),
            theatreId: tenant.restaurantId,
            screenId,
            rowId,
            rowIdentifier: validatedData.rowIdentifier,
            seatNumber: seatNum,
            seatIdentifier: `${validatedData.rowIdentifier}${seatNum}`,
            seatCategory: validatedData.seatCategory,
            status: validatedData.status
          });
        }

        const generatedSeats = await tx
          .insert(cinemaSeats)
          .values(seatsToInsert)
          .returning();

        if (!createdRow) {
          throw new AppError('Failed to insert row', 500);
        }

        return { row: createdRow, seats: generatedSeats };
      });

      // Synchronize screen statistics
      await syncScreenStats(tenant.restaurantId, screenId);

      res.status(201).json({
        message: `Row "${result.row.rowIdentifier}" and ${result.seats.length} seats created successfully`,
        row: result.row,
        seats: result.seats
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/rows/:rowId
 * Updates row configuration and optionally cascades updates to seats.
 */
router.patch(
  '/rows/:rowId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const rowId = req.params.rowId as string;
      const validatedData = updateCinemaRowSchema.parse(req.body);

      const [existingRow] = await db
        .select()
        .from(cinemaRows)
        .where(
          and(
            eq(cinemaRows.id, rowId),
            eq(cinemaRows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!existingRow) {
        throw new AppError('Row not found or does not belong to this theatre', 404);
      }

      // Check duplicate row identifier if changing
      if (validatedData.rowIdentifier && validatedData.rowIdentifier !== existingRow.rowIdentifier) {
        const [duplicate] = await db
          .select({ id: cinemaRows.id })
          .from(cinemaRows)
          .where(
            and(
              eq(cinemaRows.theatreId, tenant.restaurantId),
              eq(cinemaRows.screenId, existingRow.screenId),
              ne(cinemaRows.id, rowId),
              ne(cinemaRows.status, 'archived'),
              sql`lower(${cinemaRows.rowIdentifier}) = lower(${validatedData.rowIdentifier})`
            )
          )
          .limit(1);

        if (duplicate) {
          throw new AppError(`Row "${validatedData.rowIdentifier}" already exists on this screen`, 409);
        }
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(cinemaRows)
          .set({
            ...(validatedData.rowIdentifier ? { rowIdentifier: validatedData.rowIdentifier } : {}),
            ...(validatedData.seatCategory ? { seatCategory: validatedData.seatCategory } : {}),
            ...(validatedData.status ? { status: validatedData.status } : {}),
            ...(validatedData.sortOrder !== undefined ? { sortOrder: validatedData.sortOrder } : {}),
            updatedAt: new Date()
          })
          .where(and(eq(cinemaRows.id, rowId), eq(cinemaRows.theatreId, tenant.restaurantId)))
          .returning();

        // Cascade category or status changes to all seats in this row
        if (validatedData.seatCategory || validatedData.status) {
          await tx
            .update(cinemaSeats)
            .set({
              ...(validatedData.seatCategory ? { seatCategory: validatedData.seatCategory } : {}),
              ...(validatedData.status ? { status: validatedData.status } : {}),
              updatedAt: new Date()
            })
            .where(
              and(
                eq(cinemaSeats.rowId, rowId),
                eq(cinemaSeats.theatreId, tenant.restaurantId),
                ne(cinemaSeats.status, 'archived')
              )
            );
        }

        return row;
      });

      await syncScreenStats(tenant.restaurantId, existingRow.screenId);

      res.json({
        message: 'Row updated successfully',
        row: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cinema/rows/:rowId
 * Historical data protection: Row deletion vs archival.
 */
router.delete(
  '/rows/:rowId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const rowId = req.params.rowId as string;
      const permanent = req.query.permanent === 'true';

      const [row] = await db
        .select()
        .from(cinemaRows)
        .where(
          and(
            eq(cinemaRows.id, rowId),
            eq(cinemaRows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!row) {
        throw new AppError('Row not found or does not belong to this theatre', 404);
      }

      // Check historical orders for this theatre
      const orderHistory = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.restaurantId, tenant.restaurantId))
        .limit(1);

      if (permanent && orderHistory.length > 0) {
        throw new AppError(
          'Cannot permanently delete row with historical order activity. Please deactivate or archive the row instead.',
          409
        );
      }

      if (permanent && orderHistory.length === 0) {
        await db.transaction(async (tx) => {
          await tx.delete(cinemaSeats).where(eq(cinemaSeats.rowId, rowId));
          await tx.delete(cinemaRows).where(eq(cinemaRows.id, rowId));
        });

        await syncScreenStats(tenant.restaurantId, row.screenId);

        return res.json({
          message: `Row "${row.rowIdentifier}" permanently deleted`,
          deletedId: rowId
        });
      }

      // Default safe archival
      await db.transaction(async (tx) => {
        await tx
          .update(cinemaSeats)
          .set({ status: 'archived', updatedAt: new Date() })
          .where(eq(cinemaSeats.rowId, rowId));

        await tx
          .update(cinemaRows)
          .set({ status: 'archived', updatedAt: new Date() })
          .where(eq(cinemaRows.id, rowId));
      });

      await syncScreenStats(tenant.restaurantId, row.screenId);

      res.json({
        message: `Row "${row.rowIdentifier}" archived successfully`,
        archivedId: rowId
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/screens/:screenId/seats
 * Adds an individual seat to a cinema screen row.
 */
router.post(
  '/screens/:screenId/seats',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const screenId = req.params.screenId as string;
      const validatedData = createCinemaSeatSchema.parse(req.body);

      const [row] = await db
        .select()
        .from(cinemaRows)
        .where(
          and(
            eq(cinemaRows.id, validatedData.rowId),
            eq(cinemaRows.screenId, screenId),
            eq(cinemaRows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!row) {
        throw new AppError('Row not found on this screen', 404);
      }

      const seatIdentifier = `${row.rowIdentifier}${validatedData.seatNumber}`;

      // Prevent duplicate seat identifiers within the same screen
      const [existingSeat] = await db
        .select({ id: cinemaSeats.id })
        .from(cinemaSeats)
        .where(
          and(
            eq(cinemaSeats.theatreId, tenant.restaurantId),
            eq(cinemaSeats.screenId, screenId),
            ne(cinemaSeats.status, 'archived'),
            eq(cinemaSeats.seatIdentifier, seatIdentifier)
          )
        )
        .limit(1);

      if (existingSeat) {
        throw new AppError(
          `Seat "${seatIdentifier}" already exists on this screen`,
          409
        );
      }

      const [seat] = await db
        .insert(cinemaSeats)
        .values({
          id: crypto.randomUUID(),
          theatreId: tenant.restaurantId,
          screenId,
          rowId: row.id,
          rowIdentifier: row.rowIdentifier,
          seatNumber: validatedData.seatNumber,
          seatIdentifier,
          seatCategory: validatedData.seatCategory || row.seatCategory,
          status: validatedData.status || 'active'
        })
        .returning();

      if (!seat) {
        throw new AppError('Failed to insert seat', 500);
      }

      // Recalculate row totalSeats
      const [rowCount] = await db
        .select({ count: count() })
        .from(cinemaSeats)
        .where(
          and(
            eq(cinemaSeats.rowId, row.id),
            ne(cinemaSeats.status, 'archived')
          )
        );

      await db
        .update(cinemaRows)
        .set({
          totalSeats: Number(rowCount?.count || 1),
          updatedAt: new Date()
        })
        .where(eq(cinemaRows.id, row.id));

      await syncScreenStats(tenant.restaurantId, screenId);

      res.status(201).json({
        message: `Seat "${seat.seatIdentifier}" created successfully`,
        seat
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/seats/:seatId
 * Updates individual seat information (category, status).
 */
router.patch(
  '/seats/:seatId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const seatId = req.params.seatId as string;
      const validatedData = updateCinemaSeatSchema.parse(req.body);

      const [seat] = await db
        .update(cinemaSeats)
        .set({
          ...(validatedData.seatCategory ? { seatCategory: validatedData.seatCategory } : {}),
          ...(validatedData.status ? { status: validatedData.status } : {}),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaSeats.id, seatId),
            eq(cinemaSeats.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      if (!seat) {
        throw new AppError('Seat not found or does not belong to this theatre', 404);
      }

      await syncScreenStats(tenant.restaurantId, seat.screenId);

      res.json({
        message: `Seat "${seat.seatIdentifier}" updated successfully`,
        seat
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/seats/:seatId/activate
 * Activates an individual seat.
 */
router.post(
  '/seats/:seatId/activate',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const seatId = req.params.seatId as string;

      const [seat] = await db
        .update(cinemaSeats)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaSeats.id, seatId),
            eq(cinemaSeats.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      if (!seat) {
        throw new AppError('Seat not found or does not belong to this theatre', 404);
      }

      await syncScreenStats(tenant.restaurantId, seat.screenId);

      res.json({
        message: `Seat "${seat.seatIdentifier}" activated successfully`,
        seat
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/seats/:seatId/deactivate
 * Deactivates an individual seat (e.g. maintenance, broken recliner).
 */
router.post(
  '/seats/:seatId/deactivate',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const seatId = req.params.seatId as string;

      const [seat] = await db
        .update(cinemaSeats)
        .set({
          status: 'inactive',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaSeats.id, seatId),
            eq(cinemaSeats.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      if (!seat) {
        throw new AppError('Seat not found or does not belong to this theatre', 404);
      }

      await syncScreenStats(tenant.restaurantId, seat.screenId);

      res.json({
        message: `Seat "${seat.seatIdentifier}" deactivated successfully`,
        seat
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cinema/seats/:seatId
 * Historical data protection for individual seats.
 */
router.delete(
  '/seats/:seatId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const seatId = req.params.seatId as string;
      const permanent = req.query.permanent === 'true';

      const [seat] = await db
        .select()
        .from(cinemaSeats)
        .where(
          and(
            eq(cinemaSeats.id, seatId),
            eq(cinemaSeats.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!seat) {
        throw new AppError('Seat not found or does not belong to this theatre', 404);
      }

      const orderHistory = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.restaurantId, tenant.restaurantId))
        .limit(1);

      if (permanent && orderHistory.length > 0) {
        throw new AppError(
          'Cannot permanently delete seat with historical order activity. Please deactivate or archive the seat instead.',
          409
        );
      }

      if (permanent && orderHistory.length === 0) {
        await db.delete(cinemaSeats).where(eq(cinemaSeats.id, seatId));
        await syncScreenStats(tenant.restaurantId, seat.screenId);

        return res.json({
          message: `Seat "${seat.seatIdentifier}" permanently deleted`,
          deletedId: seatId
        });
      }

      // Safe default: Archive seat
      const [archived] = await db
        .update(cinemaSeats)
        .set({
          status: 'archived',
          updatedAt: new Date()
        })
        .where(eq(cinemaSeats.id, seatId))
        .returning();

      await syncScreenStats(tenant.restaurantId, seat.screenId);

      res.json({
        message: `Seat "${seat.seatIdentifier}" archived successfully`,
        seat: archived
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// TASK 05: CINEMA MOVIE MANAGEMENT
// ============================================================================

/**
 * GET /api/cinema/movies
 * List all movies for the authenticated cinema tenant.
 */
router.get(
  '/movies',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'staff', 'kitchen']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const statusParam = req.query.status as string | undefined;
      const languageParam = req.query.language as string | undefined;
      const searchParam = req.query.search as string | undefined;
      const includeArchived = req.query.includeArchived === 'true';

      const conditions = [eq(cinemaMovies.theatreId, tenant.restaurantId)];

      if (statusParam) {
        conditions.push(eq(cinemaMovies.status, statusParam));
      } else if (!includeArchived) {
        conditions.push(ne(cinemaMovies.status, 'archived'));
      }

      if (languageParam) {
        conditions.push(eq(cinemaMovies.language, languageParam));
      }

      if (searchParam && searchParam.trim()) {
        conditions.push(ilike(cinemaMovies.title, `%${searchParam.trim()}%`));
      }

      const moviesList = await db
        .select()
        .from(cinemaMovies)
        .where(and(...conditions))
        .orderBy(desc(cinemaMovies.createdAt));

      res.json({
        theatreId: tenant.restaurantId,
        count: moviesList.length,
        movies: moviesList
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/movies
 * Creates a new movie entry in the theatre catalogue.
 */
router.post(
  '/movies',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const validatedData = createCinemaMovieSchema.parse(req.body);

      // Check for duplicate title & language combination in this theatre
      const [existing] = await db
        .select({ id: cinemaMovies.id })
        .from(cinemaMovies)
        .where(
          and(
            eq(cinemaMovies.theatreId, tenant.restaurantId),
            ilike(cinemaMovies.title, validatedData.title.trim()),
            eq(cinemaMovies.language, validatedData.language.trim()),
            ne(cinemaMovies.status, 'archived')
          )
        )
        .limit(1);

      if (existing) {
        throw new AppError(
          `Movie "${validatedData.title}" in ${validatedData.language} already exists in your theatre catalogue`,
          409
        );
      }

      const [createdMovie] = await db
        .insert(cinemaMovies)
        .values({
          theatreId: tenant.restaurantId,
          title: validatedData.title.trim(),
          posterUrl: validatedData.posterUrl || null,
          posterKey: validatedData.posterKey || null,
          language: validatedData.language.trim(),
          durationMinutes: validatedData.durationMinutes,
          description: validatedData.description?.trim() || null,
          status: validatedData.status || 'active'
        })
        .returning();

      if (!createdMovie) {
        throw new AppError('Failed to create movie entry', 500);
      }

      res.status(201).json({
        message: `Movie "${createdMovie.title}" created successfully`,
        movie: createdMovie
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/movies/:movieId
 * Retrieves details of a specific movie.
 */
router.get(
  '/movies/:movieId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'staff', 'kitchen']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const movieId = req.params.movieId as string;

      const [movie] = await db
        .select()
        .from(cinemaMovies)
        .where(
          and(
            eq(cinemaMovies.id, movieId),
            eq(cinemaMovies.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!movie) {
        throw new AppError('Movie not found or does not belong to this theatre', 404);
      }

      res.json({ movie });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/movies/:movieId
 * Updates movie information (title, language, duration, description, status).
 */
router.patch(
  '/movies/:movieId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const movieId = req.params.movieId as string;
      const validatedData = updateCinemaMovieSchema.parse(req.body);

      // Verify movie exists and belongs to this theatre
      const [existingMovie] = await db
        .select()
        .from(cinemaMovies)
        .where(
          and(
            eq(cinemaMovies.id, movieId),
            eq(cinemaMovies.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!existingMovie) {
        throw new AppError('Movie not found or does not belong to this theatre', 404);
      }

      // If title or language is changing, ensure no conflicting duplicate exists
      const targetTitle = validatedData.title ? validatedData.title.trim() : existingMovie.title;
      const targetLang = validatedData.language ? validatedData.language.trim() : existingMovie.language;

      if (validatedData.title || validatedData.language) {
        const [duplicate] = await db
          .select({ id: cinemaMovies.id })
          .from(cinemaMovies)
          .where(
            and(
              eq(cinemaMovies.theatreId, tenant.restaurantId),
              ne(cinemaMovies.id, movieId),
              ilike(cinemaMovies.title, targetTitle),
              eq(cinemaMovies.language, targetLang),
              ne(cinemaMovies.status, 'archived')
            )
          )
          .limit(1);

        if (duplicate) {
          throw new AppError(
            `Another movie titled "${targetTitle}" in ${targetLang} already exists in your catalogue`,
            409
          );
        }
      }

      const [updatedMovie] = await db
        .update(cinemaMovies)
        .set({
          ...(validatedData.title ? { title: validatedData.title.trim() } : {}),
          ...(validatedData.language ? { language: validatedData.language.trim() } : {}),
          ...(validatedData.durationMinutes !== undefined ? { durationMinutes: validatedData.durationMinutes } : {}),
          ...(validatedData.posterUrl !== undefined ? { posterUrl: validatedData.posterUrl || null } : {}),
          ...(validatedData.posterKey !== undefined ? { posterKey: validatedData.posterKey || null } : {}),
          ...(validatedData.description !== undefined ? { description: validatedData.description?.trim() || null } : {}),
          ...(validatedData.status ? { status: validatedData.status } : {}),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaMovies.id, movieId),
            eq(cinemaMovies.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      if (!updatedMovie) {
        throw new AppError('Movie update failed', 500);
      }

      res.json({
        message: `Movie "${updatedMovie.title}" updated successfully`,
        movie: updatedMovie
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/movies/:movieId/poster
 * Dedicated endpoint to update a movie's poster image.
 */
router.patch(
  '/movies/:movieId/poster',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const movieId = req.params.movieId as string;
      const validatedData = updateCinemaMoviePosterSchema.parse(req.body);

      const [updatedMovie] = await db
        .update(cinemaMovies)
        .set({
          posterUrl: validatedData.posterUrl,
          ...(validatedData.posterKey !== undefined ? { posterKey: validatedData.posterKey || null } : {}),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaMovies.id, movieId),
            eq(cinemaMovies.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      if (!updatedMovie) {
        throw new AppError('Movie not found or does not belong to this theatre', 404);
      }

      res.json({
        message: `Movie poster updated successfully for "${updatedMovie.title}"`,
        movie: updatedMovie
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cinema/movies/:movieId
 * Safely archives or deletes movie record with historical protection.
 */
router.delete(
  '/movies/:movieId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const movieId = req.params.movieId as string;
      const permanent = req.query.permanent === 'true';

      const [movie] = await db
        .select()
        .from(cinemaMovies)
        .where(
          and(
            eq(cinemaMovies.id, movieId),
            eq(cinemaMovies.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!movie) {
        throw new AppError('Movie not found or does not belong to this theatre', 404);
      }

      // Check if theatre has order history
      const orderHistory = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.restaurantId, tenant.restaurantId))
        .limit(1);

      if (permanent && orderHistory.length > 0) {
        throw new AppError(
          'Cannot permanently delete movie when historical theatre order records exist. Please archive the movie instead.',
          409
        );
      }

      if (permanent && orderHistory.length === 0) {
        await db
          .delete(cinemaMovies)
          .where(
            and(
              eq(cinemaMovies.id, movieId),
              eq(cinemaMovies.theatreId, tenant.restaurantId)
            )
          );

        return res.json({
          message: `Movie "${movie.title}" permanently deleted`,
          deletedId: movieId
        });
      }

      // Safe default: Archive movie
      const [archived] = await db
        .update(cinemaMovies)
        .set({
          status: 'archived',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaMovies.id, movieId),
            eq(cinemaMovies.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      res.json({
        message: `Movie "${movie.title}" archived successfully`,
        movie: archived
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// TASK 06: DAILY SHOW SCHEDULING
// ============================================================================

/**
 * Helper to check for showtime conflicts on a specific screen, including turnaround buffer.
 */
async function checkShowConflict(
  theatreId: string,
  screenId: string,
  startTime: Date,
  expectedEndTime: Date,
  turnaroundBufferMinutes: number = DEFAULT_TURNAROUND_BUFFER_MINUTES,
  excludeShowId?: string
): Promise<{ hasConflict: boolean; conflictingShow?: any }> {
  const candidateStartMs = startTime.getTime();
  const candidateEndWithBufferMs = expectedEndTime.getTime() + turnaroundBufferMinutes * 60 * 1000;

  const conditions = [
    eq(cinemaShows.theatreId, theatreId),
    eq(cinemaShows.screenId, screenId),
    ne(cinemaShows.status, 'cancelled')
  ];

  if (excludeShowId) {
    conditions.push(ne(cinemaShows.id, excludeShowId));
  }

  const existingShows = await db
    .select({
      id: cinemaShows.id,
      showDate: cinemaShows.showDate,
      startTime: cinemaShows.startTime,
      expectedEndTime: cinemaShows.expectedEndTime,
      turnaroundBufferMinutes: cinemaShows.turnaroundBufferMinutes,
      status: cinemaShows.status,
      movieTitle: cinemaMovies.title
    })
    .from(cinemaShows)
    .innerJoin(cinemaMovies, eq(cinemaShows.movieId, cinemaMovies.id))
    .where(and(...conditions));

  for (const show of existingShows) {
    const existingStartMs = new Date(show.startTime).getTime();
    const existingBuffer = show.turnaroundBufferMinutes ?? DEFAULT_TURNAROUND_BUFFER_MINUTES;
    const existingEndWithBufferMs = new Date(show.expectedEndTime).getTime() + existingBuffer * 60 * 1000;

    // Two intervals [A, B] and [C, D] overlap if A < D and C < B
    if (candidateStartMs < existingEndWithBufferMs && existingStartMs < candidateEndWithBufferMs) {
      return {
        hasConflict: true,
        conflictingShow: show
      };
    }
  }

  return { hasConflict: false };
}

/**
 * GET /api/cinema/shows
 * List scheduled shows for the cinema theatre with filtering by date, screen, movie, and status.
 */
router.get(
  '/shows',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'staff', 'kitchen']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const showDate = req.query.showDate as string | undefined;
      const screenId = req.query.screenId as string | undefined;
      const movieId = req.query.movieId as string | undefined;
      const status = req.query.status as string | undefined;
      const includeCancelled = req.query.includeCancelled === 'true';

      const conditions = [eq(cinemaShows.theatreId, tenant.restaurantId)];

      if (showDate) {
        conditions.push(eq(cinemaShows.showDate, showDate));
      }
      if (screenId) {
        conditions.push(eq(cinemaShows.screenId, screenId));
      }
      if (movieId) {
        conditions.push(eq(cinemaShows.movieId, movieId));
      }
      if (status) {
        conditions.push(eq(cinemaShows.status, status));
      } else if (!includeCancelled) {
        conditions.push(ne(cinemaShows.status, 'cancelled'));
      }

      const showsList = await db
        .select({
          id: cinemaShows.id,
          theatreId: cinemaShows.theatreId,
          screenId: cinemaShows.screenId,
          movieId: cinemaShows.movieId,
          showDate: cinemaShows.showDate,
          startTime: cinemaShows.startTime,
          expectedEndTime: cinemaShows.expectedEndTime,
          orderingStartTime: cinemaShows.orderingStartTime,
          orderingEndTime: cinemaShows.orderingEndTime,
          turnaroundBufferMinutes: cinemaShows.turnaroundBufferMinutes,
          status: cinemaShows.status,
          cancellationReason: cinemaShows.cancellationReason,
          createdByUserId: cinemaShows.createdByUserId,
          createdAt: cinemaShows.createdAt,
          updatedAt: cinemaShows.updatedAt,
          screenName: cinemaScreens.screenName,
          screenType: cinemaScreens.screenType,
          movieTitle: cinemaMovies.title,
          moviePosterUrl: cinemaMovies.posterUrl,
          movieLanguage: cinemaMovies.language,
          movieDurationMinutes: cinemaMovies.durationMinutes
        })
        .from(cinemaShows)
        .innerJoin(cinemaScreens, eq(cinemaShows.screenId, cinemaScreens.id))
        .innerJoin(cinemaMovies, eq(cinemaShows.movieId, cinemaMovies.id))
        .where(and(...conditions))
        .orderBy(asc(cinemaShows.startTime));

      res.json({
        theatreId: tenant.restaurantId,
        count: showsList.length,
        shows: showsList
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/shows
 * Creates and schedules a new show.
 */
router.post(
  '/shows',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const userId = req.user?.id;
      const validatedData = createCinemaShowSchema.parse(req.body);

      // Validate Screen belongs to this theatre
      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, validatedData.screenId),
            eq(cinemaScreens.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }
      if (screen.status === 'archived') {
        throw new AppError('Cannot schedule shows on an archived screen', 400);
      }

      // Validate Movie belongs to this theatre
      const [movie] = await db
        .select()
        .from(cinemaMovies)
        .where(
          and(
            eq(cinemaMovies.id, validatedData.movieId),
            eq(cinemaMovies.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!movie) {
        throw new AppError('Movie not found or does not belong to this theatre', 404);
      }
      if (movie.status === 'archived') {
        throw new AppError('Cannot schedule shows for an archived movie', 400);
      }

      const startTime = new Date(validatedData.startTime);
      const expectedEndTime = new Date(validatedData.expectedEndTime);
      const orderingStartTime = new Date(validatedData.orderingStartTime);
      const orderingEndTime = new Date(validatedData.orderingEndTime);
      const turnaroundBuffer = validatedData.turnaroundBufferMinutes ?? DEFAULT_TURNAROUND_BUFFER_MINUTES;

      // Conflict Check on the same screen
      const conflict = await checkShowConflict(
        tenant.restaurantId,
        validatedData.screenId,
        startTime,
        expectedEndTime,
        turnaroundBuffer
      );

      if (conflict.hasConflict && conflict.conflictingShow) {
        const confStart = new Date(conflict.conflictingShow.startTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        const confEnd = new Date(conflict.conflictingShow.expectedEndTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        throw new AppError(
          `Scheduling conflict on "${screen.screenName}": overlaps with existing show "${conflict.conflictingShow.movieTitle}" (${confStart} - ${confEnd} with ${conflict.conflictingShow.turnaroundBufferMinutes}m turnaround buffer)`,
          409
        );
      }

      const [createdShow] = await db
        .insert(cinemaShows)
        .values({
          theatreId: tenant.restaurantId,
          screenId: validatedData.screenId,
          movieId: validatedData.movieId,
          showDate: validatedData.showDate,
          startTime,
          expectedEndTime,
          orderingStartTime,
          orderingEndTime,
          turnaroundBufferMinutes: turnaroundBuffer,
          status: validatedData.status || 'draft',
          createdByUserId: userId || null
        })
        .returning();

      if (!createdShow) {
        throw new AppError('Failed to create show', 500);
      }

      // Automatically advance onboarding progress: mark 'shows_scheduled'
      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, tenant.restaurantId))
        .limit(1);

      if (profile) {
        const completed = (profile.onboardingStagesCompleted as string[]) || [];
        if (!completed.includes('shows_scheduled')) {
          await db
            .update(cinemaProfiles)
            .set({
              onboardingStagesCompleted: [...completed, 'shows_scheduled'],
              updatedAt: new Date()
            })
            .where(eq(cinemaProfiles.theatreId, tenant.restaurantId));
        }
      }

      res.status(201).json({
        message: `Show for "${movie.title}" scheduled successfully on ${screen.screenName}`,
        show: {
          ...createdShow,
          screenName: screen.screenName,
          movieTitle: movie.title
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/shows/:showId
 * Retrieves detailed information about a single show.
 */
router.get(
  '/shows/:showId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'staff', 'kitchen']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const showId = req.params.showId as string;

      const [show] = await db
        .select({
          id: cinemaShows.id,
          theatreId: cinemaShows.theatreId,
          screenId: cinemaShows.screenId,
          movieId: cinemaShows.movieId,
          showDate: cinemaShows.showDate,
          startTime: cinemaShows.startTime,
          expectedEndTime: cinemaShows.expectedEndTime,
          orderingStartTime: cinemaShows.orderingStartTime,
          orderingEndTime: cinemaShows.orderingEndTime,
          turnaroundBufferMinutes: cinemaShows.turnaroundBufferMinutes,
          status: cinemaShows.status,
          cancellationReason: cinemaShows.cancellationReason,
          createdByUserId: cinemaShows.createdByUserId,
          createdAt: cinemaShows.createdAt,
          updatedAt: cinemaShows.updatedAt,
          screenName: cinemaScreens.screenName,
          screenType: cinemaScreens.screenType,
          movieTitle: cinemaMovies.title,
          moviePosterUrl: cinemaMovies.posterUrl,
          movieLanguage: cinemaMovies.language,
          movieDurationMinutes: cinemaMovies.durationMinutes
        })
        .from(cinemaShows)
        .innerJoin(cinemaScreens, eq(cinemaShows.screenId, cinemaScreens.id))
        .innerJoin(cinemaMovies, eq(cinemaShows.movieId, cinemaMovies.id))
        .where(
          and(
            eq(cinemaShows.id, showId),
            eq(cinemaShows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!show) {
        throw new AppError('Show not found or does not belong to this theatre', 404);
      }

      res.json({ show });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/shows/:showId
 * Updates an existing show, with protection and warnings if already published.
 */
router.patch(
  '/shows/:showId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const showId = req.params.showId as string;
      const validatedData = updateCinemaShowSchema.parse(req.body);

      const [existingShow] = await db
        .select()
        .from(cinemaShows)
        .where(
          and(
            eq(cinemaShows.id, showId),
            eq(cinemaShows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!existingShow) {
        throw new AppError('Show not found or does not belong to this theatre', 404);
      }

      const targetScreenId = validatedData.screenId || existingShow.screenId;
      const targetStartTime = validatedData.startTime ? new Date(validatedData.startTime) : new Date(existingShow.startTime);
      const targetEndTime = validatedData.expectedEndTime ? new Date(validatedData.expectedEndTime) : new Date(existingShow.expectedEndTime);
      const targetBuffer = validatedData.turnaroundBufferMinutes ?? existingShow.turnaroundBufferMinutes;

      // Re-validate conflict if screen, times, or buffer changed
      if (
        validatedData.screenId ||
        validatedData.startTime ||
        validatedData.expectedEndTime ||
        validatedData.turnaroundBufferMinutes !== undefined
      ) {
        const conflict = await checkShowConflict(
          tenant.restaurantId,
          targetScreenId,
          targetStartTime,
          targetEndTime,
          targetBuffer,
          showId
        );

        if (conflict.hasConflict && conflict.conflictingShow) {
          throw new AppError(
            `Updated showtime conflicts with existing show "${conflict.conflictingShow.movieTitle}" on this screen`,
            409
          );
        }
      }

      let warning: string | undefined = undefined;
      if (existingShow.status === 'published') {
        const hasTimeChange =
          (validatedData.startTime && new Date(validatedData.startTime).getTime() !== new Date(existingShow.startTime).getTime()) ||
          (validatedData.expectedEndTime && new Date(validatedData.expectedEndTime).getTime() !== new Date(existingShow.expectedEndTime).getTime());

        if (hasTimeChange || validatedData.screenId) {
          warning =
            'Warning: This show was already published. Modifying showtimes or screens will affect existing audience and kitchen delivery schedules.';
        }
      }

      const [updatedShow] = await db
        .update(cinemaShows)
        .set({
          ...(validatedData.screenId ? { screenId: validatedData.screenId } : {}),
          ...(validatedData.movieId ? { movieId: validatedData.movieId } : {}),
          ...(validatedData.showDate ? { showDate: validatedData.showDate } : {}),
          ...(validatedData.startTime ? { startTime: new Date(validatedData.startTime) } : {}),
          ...(validatedData.expectedEndTime ? { expectedEndTime: new Date(validatedData.expectedEndTime) } : {}),
          ...(validatedData.orderingStartTime ? { orderingStartTime: new Date(validatedData.orderingStartTime) } : {}),
          ...(validatedData.orderingEndTime ? { orderingEndTime: new Date(validatedData.orderingEndTime) } : {}),
          ...(validatedData.turnaroundBufferMinutes !== undefined
            ? { turnaroundBufferMinutes: validatedData.turnaroundBufferMinutes }
            : {}),
          ...(validatedData.status ? { status: validatedData.status } : {}),
          ...(validatedData.cancellationReason !== undefined
            ? { cancellationReason: validatedData.cancellationReason }
            : {}),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cinemaShows.id, showId),
            eq(cinemaShows.theatreId, tenant.restaurantId)
          )
        )
        .returning();

      res.json({
        message: 'Show updated successfully',
        show: updatedShow,
        warning
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/shows/:showId/publish
 * Publishes a draft show, making it visible for ordering and public viewing.
 */
router.post(
  '/shows/:showId/publish',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const showId = req.params.showId as string;

      const [show] = await db
        .select()
        .from(cinemaShows)
        .where(
          and(
            eq(cinemaShows.id, showId),
            eq(cinemaShows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!show) {
        throw new AppError('Show not found or does not belong to this theatre', 404);
      }

      if (show.status === 'published') {
        return res.json({
          message: 'Show is already published',
          show
        });
      }

      // Re-verify no conflicts before publishing
      const conflict = await checkShowConflict(
        tenant.restaurantId,
        show.screenId,
        new Date(show.startTime),
        new Date(show.expectedEndTime),
        show.turnaroundBufferMinutes,
        showId
      );

      if (conflict.hasConflict && conflict.conflictingShow) {
        throw new AppError(
          `Cannot publish show: overlaps with existing show "${conflict.conflictingShow.movieTitle}"`,
          409
        );
      }

      const [published] = await db
        .update(cinemaShows)
        .set({
          status: 'published',
          updatedAt: new Date()
        })
        .where(eq(cinemaShows.id, showId))
        .returning();

      res.json({
        message: 'Show published successfully',
        show: published
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/shows/:showId/cancel
 * Cancels a show with an explicit cancellation reason and protects historical orders.
 */
router.post(
  '/shows/:showId/cancel',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const showId = req.params.showId as string;
      const validatedData = cancelCinemaShowSchema.parse(req.body);

      const [show] = await db
        .select()
        .from(cinemaShows)
        .where(
          and(
            eq(cinemaShows.id, showId),
            eq(cinemaShows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!show) {
        throw new AppError('Show not found or does not belong to this theatre', 404);
      }

      const [cancelled] = await db
        .update(cinemaShows)
        .set({
          status: 'cancelled',
          cancellationReason: validatedData.cancellationReason,
          updatedAt: new Date()
        })
        .where(eq(cinemaShows.id, showId))
        .returning();

      res.json({
        message: `Show cancelled successfully: "${validatedData.cancellationReason}"`,
        show: cancelled
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/shows/copy-schedule
 * Copies all shows from a source date to a target date, shifting showtimes accurately.
 */
router.post(
  '/shows/copy-schedule',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const userId = req.user?.id;
      const validatedData = copyCinemaScheduleSchema.parse(req.body);

      // Fetch source date non-cancelled shows
      const conditions = [
        eq(cinemaShows.theatreId, tenant.restaurantId),
        eq(cinemaShows.showDate, validatedData.sourceDate),
        ne(cinemaShows.status, 'cancelled')
      ];

      if (validatedData.screenId) {
        conditions.push(eq(cinemaShows.screenId, validatedData.screenId));
      }

      const sourceShows = await db
        .select()
        .from(cinemaShows)
        .where(and(...conditions))
        .orderBy(asc(cinemaShows.startTime));

      if (sourceShows.length === 0) {
        throw new AppError(
          `No active shows found on ${validatedData.sourceDate} to copy`,
          404
        );
      }

      // Compute exact day shift in milliseconds
      const sourceDateMidnight = new Date(`${validatedData.sourceDate}T00:00:00Z`).getTime();
      const targetDateMidnight = new Date(`${validatedData.targetDate}T00:00:00Z`).getTime();
      const dayOffsetMs = targetDateMidnight - sourceDateMidnight;

      let copiedCount = 0;
      let skippedCount = 0;
      const createdShows: any[] = [];

      for (const src of sourceShows) {
        const shiftedStart = new Date(new Date(src.startTime).getTime() + dayOffsetMs);
        const shiftedEnd = new Date(new Date(src.expectedEndTime).getTime() + dayOffsetMs);
        const shiftedOrderingStart = new Date(new Date(src.orderingStartTime).getTime() + dayOffsetMs);
        const shiftedOrderingEnd = new Date(new Date(src.orderingEndTime).getTime() + dayOffsetMs);

        // Check if conflict exists on targetDate
        const conflict = await checkShowConflict(
          tenant.restaurantId,
          src.screenId,
          shiftedStart,
          shiftedEnd,
          src.turnaroundBufferMinutes
        );

        if (conflict.hasConflict) {
          skippedCount++;
          continue;
        }

        const [newShow] = await db
          .insert(cinemaShows)
          .values({
            theatreId: tenant.restaurantId,
            screenId: src.screenId,
            movieId: src.movieId,
            showDate: validatedData.targetDate,
            startTime: shiftedStart,
            expectedEndTime: shiftedEnd,
            orderingStartTime: shiftedOrderingStart,
            orderingEndTime: shiftedOrderingEnd,
            turnaroundBufferMinutes: src.turnaroundBufferMinutes,
            status: 'draft', // Copied shows start as draft for admin review
            createdByUserId: userId || null
          })
          .returning();

        if (newShow) {
          copiedCount++;
          createdShows.push(newShow);
        }
      }

      res.status(201).json({
        message: `Copied ${copiedCount} shows to ${validatedData.targetDate} as drafts${
          skippedCount > 0 ? ` (${skippedCount} skipped due to conflicts)` : ''
        }`,
        copiedCount,
        skippedCount,
        shows: createdShows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cinema/shows/:showId
 * Safely handles show deletion with historical order protection.
 */
router.delete(
  '/shows/:showId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const showId = req.params.showId as string;
      const permanent = req.query.permanent === 'true';

      const [show] = await db
        .select()
        .from(cinemaShows)
        .where(
          and(
            eq(cinemaShows.id, showId),
            eq(cinemaShows.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!show) {
        throw new AppError('Show not found or does not belong to this theatre', 404);
      }

      // Check if theatre has order history
      const orderHistory = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.restaurantId, tenant.restaurantId))
        .limit(1);

      if (permanent && orderHistory.length > 0) {
        throw new AppError(
          'Cannot permanently delete show when historical theatre order records exist. Please cancel the show instead.',
          409
        );
      }

      if (permanent && orderHistory.length === 0) {
        await db
          .delete(cinemaShows)
          .where(
            and(
              eq(cinemaShows.id, showId),
              eq(cinemaShows.theatreId, tenant.restaurantId)
            )
          );

        return res.json({
          message: 'Show permanently deleted',
          deletedId: showId
        });
      }

      // Safe default: Cancel show
      const [cancelled] = await db
        .update(cinemaShows)
        .set({
          status: 'cancelled',
          cancellationReason: 'Cancelled by theatre administrator',
          updatedAt: new Date()
        })
        .where(eq(cinemaShows.id, showId))
        .returning();

      res.json({
        message: 'Show cancelled successfully',
        show: cancelled
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// Task 08 - Cinema QR Code Management & Public Resolution Endpoints
// ===========================================================================

/**
 * Public Endpoint: Resolve general theatre QR token
 * GET /api/cinema/public/resolve/:theatreToken
 */
router.get(
  '/public/resolve/:theatreToken',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreToken = req.params.theatreToken as string;

      if (!theatreToken || !isValidCinemaQrTokenFormat(theatreToken)) {
        throw new AppError('Invalid cinema QR token format', 400);
      }

      // Find active theatre QR code
      const [qr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.token, theatreToken),
            eq(cinemaQrCodes.qrType, 'theatre'),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      if (!qr) {
        throw new AppError('Invalid or expired cinema theatre QR code', 404);
      }

      // Lookup theatre and profile
      const [theatre] = await db
        .select()
        .from(restaurants)
        .where(and(eq(restaurants.id, qr.theatreId), eq(restaurants.isActive, true)))
        .limit(1);

      if (!theatre) {
        throw new AppError('Cinema theatre not found or inactive', 404);
      }

      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, qr.theatreId))
        .limit(1);

      // Query active screens for this theatre
      const activeScreens = await db
        .select({
          id: cinemaScreens.id,
          screenName: cinemaScreens.screenName,
          screenType: cinemaScreens.screenType,
          totalSeats: cinemaScreens.totalSeats
        })
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.theatreId, qr.theatreId),
            eq(cinemaScreens.status, 'active')
          )
        )
        .orderBy(asc(cinemaScreens.screenName));

      // Query active verified payment gateways configured for this theatre
      const paymentAccounts = await db
        .select({
          provider: cinemaPaymentAccounts.provider
        })
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, qr.theatreId),
            eq(cinemaPaymentAccounts.isVerified, true),
            ne(cinemaPaymentAccounts.status, 'disabled')
          )
        );

      const paymentProviders = paymentAccounts.map((a) => a.provider);

      res.json({
        valid: true,
        qrType: 'theatre',
        theatre: {
          name: theatre.name,
          slug: theatre.slug,
          logoUrl: theatre.logoUrl || profile?.logoUrl || null,
          coverImageUrl: theatre.coverImageUrl || null,
          currency: theatre.currency || 'INR',
          address: theatre.address || profile?.address || null,
          city: profile?.city || null,
          state: profile?.state || null,
          country: profile?.country || 'India',
          contactNumber: theatre.phone || profile?.contactNumber || null,
          contactEmail: theatre.email || profile?.contactEmail || null,
          timezone: profile?.timezone || 'Asia/Kolkata',
          paymentProviders
        },
        isScreenPreselected: false,
        selectedScreen: null,
        screens: activeScreens
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public Endpoint: Resolve screen-specific QR token
 * GET /api/cinema/public/resolve/:theatreToken/:screenToken
 */
router.get(
  '/public/resolve/:theatreToken/:screenToken',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreToken = req.params.theatreToken as string;
      const screenToken = req.params.screenToken as string;

      if (
        !theatreToken ||
        !screenToken ||
        !isValidCinemaQrTokenFormat(theatreToken) ||
        !isValidCinemaQrTokenFormat(screenToken)
      ) {
        throw new AppError('Invalid cinema QR token format', 400);
      }

      // Verify active theatre QR code
      const [theatreQr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.token, theatreToken),
            eq(cinemaQrCodes.qrType, 'theatre'),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      if (!theatreQr) {
        throw new AppError('Invalid or expired cinema theatre QR code', 404);
      }

      // Verify active screen QR code
      const [screenQr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.theatreId, theatreQr.theatreId),
            eq(cinemaQrCodes.token, screenToken),
            eq(cinemaQrCodes.qrType, 'screen'),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      if (!screenQr || !screenQr.screenId) {
        throw new AppError('Invalid or expired screen QR code', 404);
      }

      // Lookup theatre and screen
      const [theatre] = await db
        .select()
        .from(restaurants)
        .where(and(eq(restaurants.id, theatreQr.theatreId), eq(restaurants.isActive, true)))
        .limit(1);

      if (!theatre) {
        throw new AppError('Cinema theatre not found or inactive', 404);
      }

      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, screenQr.screenId),
            eq(cinemaScreens.theatreId, theatreQr.theatreId),
            eq(cinemaScreens.status, 'active')
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or currently inactive', 404);
      }

      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, theatreQr.theatreId))
        .limit(1);

      // Query active screens for this theatre
      const activeScreens = await db
        .select({
          id: cinemaScreens.id,
          screenName: cinemaScreens.screenName,
          screenType: cinemaScreens.screenType,
          totalSeats: cinemaScreens.totalSeats
        })
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.theatreId, theatreQr.theatreId),
            eq(cinemaScreens.status, 'active')
          )
        )
        .orderBy(asc(cinemaScreens.screenName));

      // Query active verified payment gateways configured for this theatre
      const paymentAccounts = await db
        .select({
          provider: cinemaPaymentAccounts.provider
        })
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreQr.theatreId),
            eq(cinemaPaymentAccounts.isVerified, true),
            ne(cinemaPaymentAccounts.status, 'disabled')
          )
        );

      const paymentProviders = paymentAccounts.map((a) => a.provider);

      res.json({
        valid: true,
        qrType: 'screen',
        theatre: {
          name: theatre.name,
          slug: theatre.slug,
          logoUrl: theatre.logoUrl || profile?.logoUrl || null,
          coverImageUrl: theatre.coverImageUrl || null,
          currency: theatre.currency || 'INR',
          address: theatre.address || profile?.address || null,
          city: profile?.city || null,
          state: profile?.state || null,
          country: profile?.country || 'India',
          contactNumber: theatre.phone || profile?.contactNumber || null,
          contactEmail: theatre.email || profile?.contactEmail || null,
          timezone: profile?.timezone || 'Asia/Kolkata',
          paymentProviders
        },
        isScreenPreselected: true,
        selectedScreen: {
          screenId: screen.id,
          screenName: screen.screenName,
          screenType: screen.screenType,
          totalSeats: screen.totalSeats,
          screenToken: screenQr.token
        },
        screens: activeScreens
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public Endpoint: Get published movie shows for a selected screen & date
 * GET /api/cinema/public/shows/:theatreToken
 */
router.get(
  '/public/shows/:theatreToken',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreToken = req.params.theatreToken as string;
      const screenId = req.query.screenId as string | undefined;
      const requestedDate = req.query.date as string | undefined;

      if (!theatreToken || !isValidCinemaQrTokenFormat(theatreToken)) {
        throw new AppError('Invalid cinema QR token format', 400);
      }

      if (!screenId) {
        throw new AppError('screenId query parameter is required', 400);
      }

      // 1. Resolve theatre by QR token
      const [qr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.token, theatreToken),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      if (!qr) {
        throw new AppError('Invalid or expired cinema QR code', 404);
      }

      // 2. Validate screen ownership
      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, screenId),
            eq(cinemaScreens.theatreId, qr.theatreId),
            eq(cinemaScreens.status, 'active')
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or currently inactive', 404);
      }

      // 3. Resolve theatre profile for timezone
      const [profile] = await db
        .select()
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, qr.theatreId))
        .limit(1);

      const targetDate =
        requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
          ? requestedDate
          : new Date().toISOString().split('T')[0]!;

      // 4. Query published shows for this screen and date
      let showsList = await db
        .select({
          id: cinemaShows.id,
          theatreId: cinemaShows.theatreId,
          screenId: cinemaShows.screenId,
          movieId: cinemaShows.movieId,
          showDate: cinemaShows.showDate,
          startTime: cinemaShows.startTime,
          expectedEndTime: cinemaShows.expectedEndTime,
          orderingStartTime: cinemaShows.orderingStartTime,
          orderingEndTime: cinemaShows.orderingEndTime,
          turnaroundBufferMinutes: cinemaShows.turnaroundBufferMinutes,
          status: cinemaShows.status,
          movieTitle: cinemaMovies.title,
          moviePosterUrl: cinemaMovies.posterUrl,
          language: cinemaMovies.language,
          durationMinutes: cinemaMovies.durationMinutes,
          movieDescription: cinemaMovies.description
        })
        .from(cinemaShows)
        .innerJoin(cinemaMovies, eq(cinemaShows.movieId, cinemaMovies.id))
        .where(
          and(
            eq(cinemaShows.theatreId, qr.theatreId),
            eq(cinemaShows.screenId, screenId),
            eq(cinemaShows.showDate, targetDate),
            eq(cinemaShows.status, 'published')
          )
        )
        .orderBy(asc(cinemaShows.startTime));

      // Fallback: If no shows specifically on targetDate (e.g. testing or date rollover), look for any active published shows for this screen
      if (showsList.length === 0) {
        showsList = await db
          .select({
            id: cinemaShows.id,
            theatreId: cinemaShows.theatreId,
            screenId: cinemaShows.screenId,
            movieId: cinemaShows.movieId,
            showDate: cinemaShows.showDate,
            startTime: cinemaShows.startTime,
            expectedEndTime: cinemaShows.expectedEndTime,
            orderingStartTime: cinemaShows.orderingStartTime,
            orderingEndTime: cinemaShows.orderingEndTime,
            turnaroundBufferMinutes: cinemaShows.turnaroundBufferMinutes,
            status: cinemaShows.status,
            movieTitle: cinemaMovies.title,
            moviePosterUrl: cinemaMovies.posterUrl,
            language: cinemaMovies.language,
            durationMinutes: cinemaMovies.durationMinutes,
            movieDescription: cinemaMovies.description
          })
          .from(cinemaShows)
          .innerJoin(cinemaMovies, eq(cinemaShows.movieId, cinemaMovies.id))
          .where(
            and(
              eq(cinemaShows.theatreId, qr.theatreId),
              eq(cinemaShows.screenId, screenId),
              eq(cinemaShows.status, 'published')
            )
          )
          .orderBy(desc(cinemaShows.showDate), asc(cinemaShows.startTime))
          .limit(4);
      }

      // 5. Enhance each show with ordering window status
      const now = new Date();
      const enhancedShows = showsList.map((show) => {
        const oStart = new Date(show.orderingStartTime);
        const oEnd = new Date(show.orderingEndTime);
        const isOrderingOpen = now >= oStart && now <= oEnd;
        const isUpcoming = now < oStart;
        const isPast = now > oEnd;

        return {
          id: show.id,
          screenId: show.screenId,
          movieId: show.movieId,
          movieTitle: show.movieTitle,
          moviePosterUrl: show.moviePosterUrl,
          language: show.language,
          durationMinutes: show.durationMinutes,
          movieDescription: show.movieDescription,
          showDate: show.showDate,
          startTime: show.startTime,
          expectedEndTime: show.expectedEndTime,
          orderingStartTime: show.orderingStartTime,
          orderingEndTime: show.orderingEndTime,
          isOrderingOpen,
          orderingStatus: isOrderingOpen ? 'open' : isUpcoming ? 'upcoming' : 'closed'
        };
      });

      res.json({
        screenId: screen.id,
        screenName: screen.screenName,
        screenType: screen.screenType,
        targetDate,
        totalShows: enhancedShows.length,
        shows: enhancedShows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public Endpoint: Get seating layout (rows & seats) for a screen
 * GET /api/cinema/public/seating/:theatreToken/:screenId
 */
router.get(
  '/public/seating/:theatreToken/:screenId',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreToken = req.params.theatreToken as string;
      const screenId = req.params.screenId as string;

      if (!theatreToken || !isValidCinemaQrTokenFormat(theatreToken)) {
        throw new AppError('Invalid cinema QR token format', 400);
      }

      // 1. Resolve theatre by QR token
      const [qr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.token, theatreToken),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      if (!qr) {
        throw new AppError('Invalid or expired cinema QR code', 404);
      }

      // 2. Validate screen
      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, screenId),
            eq(cinemaScreens.theatreId, qr.theatreId),
            eq(cinemaScreens.status, 'active')
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or currently inactive', 404);
      }

      // 3. Fetch active rows
      const rows = await db
        .select()
        .from(cinemaRows)
        .where(
          and(
            eq(cinemaRows.theatreId, qr.theatreId),
            eq(cinemaRows.screenId, screenId),
            eq(cinemaRows.status, 'active')
          )
        )
        .orderBy(asc(cinemaRows.sortOrder), asc(cinemaRows.rowIdentifier));

      // 4. Fetch active seats
      const seats = await db
        .select()
        .from(cinemaSeats)
        .where(
          and(
            eq(cinemaSeats.theatreId, qr.theatreId),
            eq(cinemaSeats.screenId, screenId),
            eq(cinemaSeats.status, 'active')
          )
        )
        .orderBy(asc(cinemaSeats.rowIdentifier), asc(cinemaSeats.seatNumber));

      // Group seats by rowId
      const seatsByRowId = new Map<string, typeof seats>();
      for (const s of seats) {
        const list = seatsByRowId.get(s.rowId) || [];
        list.push(s);
        seatsByRowId.set(s.rowId, list);
      }

      const structuredRows = rows.map((r) => ({
        id: r.id,
        rowIdentifier: r.rowIdentifier,
        seatCategory: r.seatCategory,
        totalSeats: r.totalSeats,
        seats: (seatsByRowId.get(r.id) || []).map((s) => ({
          id: s.id,
          seatIdentifier: s.seatIdentifier,
          seatNumber: s.seatNumber,
          seatCategory: s.seatCategory,
          status: s.status
        }))
      }));

      res.json({
        screenId: screen.id,
        screenName: screen.screenName,
        screenType: screen.screenType,
        totalSeats: screen.totalSeats,
        rowsCount: structuredRows.length,
        rows: structuredRows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public Endpoint: Get active food menu (categories and available products)
 * GET /api/cinema/public/menu/:theatreToken
 */
router.get(
  '/public/menu/:theatreToken',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreToken = req.params.theatreToken as string;

      if (!theatreToken || !isValidCinemaQrTokenFormat(theatreToken)) {
        throw new AppError('Invalid cinema QR token format', 400);
      }

      // 1. Resolve theatre by QR token
      const [qr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.token, theatreToken),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      if (!qr) {
        throw new AppError('Invalid or expired cinema QR code', 404);
      }

      // 2. Fetch theatre currency
      const [theatre] = await db
        .select({
          currency: restaurants.currency
        })
        .from(restaurants)
        .where(eq(restaurants.id, qr.theatreId))
        .limit(1);

      // 3. Query active categories
      const activeCategories = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.restaurantId, qr.theatreId),
            eq(categories.isActive, true)
          )
        )
        .orderBy(asc(categories.sortOrder), asc(categories.name));

      // 4. Query available products
      const availableProducts = await db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          categoryName: categories.name,
          name: products.name,
          description: products.description,
          price: products.price,
          imageUrl: products.imageUrl,
          isVegetarian: products.isVegetarian,
          isAvailable: products.isAvailable,
          sortOrder: products.sortOrder
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(products.restaurantId, qr.theatreId),
            eq(products.isAvailable, true)
          )
        )
        .orderBy(asc(products.sortOrder), asc(products.createdAt));

      res.json({
        currency: theatre?.currency || 'INR',
        categories: activeCategories,
        products: availableProducts
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Public Endpoint: Validate entire customer selection (theatre, screen, show, seat)
 * POST /api/cinema/public/validate-selection
 */
router.post(
  '/public/validate-selection',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        theatreToken,
        screenId,
        showId,
        rowIdentifier,
        seatIdentifier,
        bypassTimeWindowForPreview
      } = req.body;

      if (!theatreToken || !isValidCinemaQrTokenFormat(theatreToken)) {
        throw new AppError('Invalid or missing theatreToken', 400);
      }

      if (!screenId || !showId || !rowIdentifier || !seatIdentifier) {
        throw new AppError('screenId, showId, rowIdentifier and seatIdentifier are all required', 400);
      }

      // 1. Resolve theatre by QR token
      const [qr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.token, theatreToken),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      if (!qr) {
        throw new AppError('Invalid or expired cinema QR code', 404);
      }

      // 2. Validate theatre
      const [theatre] = await db
        .select()
        .from(restaurants)
        .where(and(eq(restaurants.id, qr.theatreId), eq(restaurants.isActive, true)))
        .limit(1);

      if (!theatre) {
        throw new AppError('Cinema theatre is not active', 404);
      }

      // 3. Validate screen
      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, screenId),
            eq(cinemaScreens.theatreId, qr.theatreId),
            eq(cinemaScreens.status, 'active')
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Selected screen does not belong to this theatre or is inactive', 400);
      }

      // 4. Validate show
      const [show] = await db
        .select()
        .from(cinemaShows)
        .where(
          and(
            eq(cinemaShows.id, showId),
            eq(cinemaShows.theatreId, qr.theatreId),
            eq(cinemaShows.screenId, screenId)
          )
        )
        .limit(1);

      if (!show) {
        throw new AppError('Selected show does not belong to this screen or theatre', 404);
      }

      if (show.status !== 'published') {
        throw new AppError(
          show.status === 'cancelled'
            ? 'This movie show has been cancelled'
            : 'This show is not published for food orders',
          400
        );
      }

      // Check ordering window unless preview flag is passed
      const now = new Date();
      if (!bypassTimeWindowForPreview) {
        const oStart = new Date(show.orderingStartTime);
        const oEnd = new Date(show.orderingEndTime);
        if (now < oStart || now > oEnd) {
          throw new AppError('Food ordering window for this movie show is currently closed', 400);
        }
      }

      // 5. Validate seat
      const [seat] = await db
        .select()
        .from(cinemaSeats)
        .where(
          and(
            eq(cinemaSeats.theatreId, qr.theatreId),
            eq(cinemaSeats.screenId, screenId),
            eq(cinemaSeats.rowIdentifier, rowIdentifier),
            eq(cinemaSeats.seatIdentifier, seatIdentifier),
            eq(cinemaSeats.status, 'active')
          )
        )
        .limit(1);

      if (!seat) {
        throw new AppError(
          `Selected seat ${seatIdentifier} (Row ${rowIdentifier}) does not exist on ${screen.screenName}`,
          400
        );
      }

      // Fetch movie title for confirmation payload
      const [movie] = await db
        .select({ title: cinemaMovies.title })
        .from(cinemaMovies)
        .where(eq(cinemaMovies.id, show.movieId))
        .limit(1);

      res.json({
        valid: true,
        message: 'Customer cinema selection validated successfully',
        selection: {
          theatreId: qr.theatreId,
          theatreName: theatre.name,
          screenId: screen.id,
          screenName: screen.screenName,
          screenType: screen.screenType,
          showId: show.id,
          movieTitle: movie?.title || 'Featured Movie',
          startTime: show.startTime,
          expectedEndTime: show.expectedEndTime,
          rowIdentifier: seat.rowIdentifier,
          seatIdentifier: seat.seatIdentifier,
          seatCategory: seat.seatCategory
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Generate (or regenerate) General Theatre QR Code
 * POST /api/cinema/qr/theatre
 */
router.post(
  '/qr/theatre',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const theatreToken = generateCinemaQrToken(24);
      const targetUrl = buildCinemaTheatreQrUrl(appUrl, theatreToken);

      const qrCodeData = await QRCode.toDataURL(targetUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 512,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const result = await db.transaction(async (tx) => {
        // 1. Mark existing active theatre QR code as replaced
        await tx
          .update(cinemaQrCodes)
          .set({
            status: 'replaced',
            updatedAt: new Date()
          })
          .where(
            and(
              eq(cinemaQrCodes.theatreId, tenant.restaurantId),
              eq(cinemaQrCodes.qrType, 'theatre'),
              eq(cinemaQrCodes.status, 'active')
            )
          );

        // 2. Insert new active theatre QR code
        const [newQr] = await tx
          .insert(cinemaQrCodes)
          .values({
            id: crypto.randomUUID(),
            theatreId: tenant.restaurantId,
            screenId: null,
            qrType: 'theatre',
            qrName: `${tenant.restaurant.name} General Stand QR`,
            token: theatreToken,
            theatreToken: theatreToken,
            screenToken: null,
            targetUrl,
            qrCodeData,
            status: 'active'
          })
          .returning();

        // 3. Keep active screen QRs in sync with new theatreToken
        const activeScreenQrs = await tx
          .select()
          .from(cinemaQrCodes)
          .where(
            and(
              eq(cinemaQrCodes.theatreId, tenant.restaurantId),
              eq(cinemaQrCodes.qrType, 'screen'),
              eq(cinemaQrCodes.status, 'active')
            )
          );

        for (const scrQr of activeScreenQrs) {
          if (scrQr.screenToken) {
            const updatedUrl = buildCinemaScreenQrUrl(appUrl, theatreToken, scrQr.screenToken);
            const updatedQrData = await QRCode.toDataURL(updatedUrl, {
              errorCorrectionLevel: 'M',
              margin: 2,
              width: 512,
              color: { dark: '#000000', light: '#ffffff' }
            });

            await tx
              .update(cinemaQrCodes)
              .set({
                theatreToken,
                targetUrl: updatedUrl,
                qrCodeData: updatedQrData,
                updatedAt: new Date()
              })
              .where(eq(cinemaQrCodes.id, scrQr.id));
          }
        }

        return newQr;
      });

      res.status(201).json({
        message: 'General theatre QR code generated successfully',
        qrCode: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Generate (or regenerate) Screen-Specific QR Code
 * POST /api/cinema/qr/screens/:screenId
 */
router.post(
  '/qr/screens/:screenId',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const screenId = req.params.screenId as string;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      // 1. Verify screen ownership and active state
      const [screen] = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.id, screenId),
            eq(cinemaScreens.theatreId, tenant.restaurantId),
            ne(cinemaScreens.status, 'archived')
          )
        )
        .limit(1);

      if (!screen) {
        throw new AppError('Screen not found or does not belong to this theatre', 404);
      }

      // 2. Find or auto-provision active theatre QR token
      let [theatreQr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.theatreId, tenant.restaurantId),
            eq(cinemaQrCodes.qrType, 'theatre'),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      let activeTheatreToken = theatreQr?.theatreToken;

      if (!activeTheatreToken) {
        const theatreToken = generateCinemaQrToken(24);
        const theatreUrl = buildCinemaTheatreQrUrl(appUrl, theatreToken);
        const theatreQrData = await QRCode.toDataURL(theatreUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 512,
          color: { dark: '#000000', light: '#ffffff' }
        });

        const [createdTheatreQr] = await db
          .insert(cinemaQrCodes)
          .values({
            id: crypto.randomUUID(),
            theatreId: tenant.restaurantId,
            screenId: null,
            qrType: 'theatre',
            qrName: `${tenant.restaurant.name} General Stand QR`,
            token: theatreToken,
            theatreToken: theatreToken,
            screenToken: null,
            targetUrl: theatreUrl,
            qrCodeData: theatreQrData,
            status: 'active'
          })
          .returning();
        activeTheatreToken = createdTheatreQr?.theatreToken || theatreToken;
      }

      // 3. Generate high-entropy screen token
      const screenToken = generateCinemaQrToken(24);
      const targetUrl = buildCinemaScreenQrUrl(appUrl, activeTheatreToken, screenToken);
      const qrCodeData = await QRCode.toDataURL(targetUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 512,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const result = await db.transaction(async (tx) => {
        // Mark previous active QR for this screen as replaced
        await tx
          .update(cinemaQrCodes)
          .set({
            status: 'replaced',
            updatedAt: new Date()
          })
          .where(
            and(
              eq(cinemaQrCodes.theatreId, tenant.restaurantId),
              eq(cinemaQrCodes.screenId, screen.id),
              eq(cinemaQrCodes.status, 'active')
            )
          );

        // Insert new active screen QR code
        const [newScreenQr] = await tx
          .insert(cinemaQrCodes)
          .values({
            id: crypto.randomUUID(),
            theatreId: tenant.restaurantId,
            screenId: screen.id,
            qrType: 'screen',
            qrName: `${screen.screenName} Stand QR`,
            token: screenToken,
            theatreToken: activeTheatreToken,
            screenToken: screenToken,
            targetUrl,
            qrCodeData,
            status: 'active'
          })
          .returning();

        return newScreenQr;
      });

      res.status(201).json({
        message: `Screen QR code for "${screen.screenName}" generated successfully`,
        qrCode: {
          ...result,
          screenName: screen.screenName,
          screenType: screen.screenType,
          totalSeats: screen.totalSeats
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * List all QR codes for authenticated theatre
 * GET /api/cinema/qr
 */
router.get(
  '/qr',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;

      // Active theatre QR
      const [theatreQr] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.theatreId, tenant.restaurantId),
            eq(cinemaQrCodes.qrType, 'theatre'),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .limit(1);

      // Active screen QRs joined with screen details
      const screenQrs = await db
        .select({
          id: cinemaQrCodes.id,
          theatreId: cinemaQrCodes.theatreId,
          screenId: cinemaQrCodes.screenId,
          screenName: cinemaScreens.screenName,
          screenType: cinemaScreens.screenType,
          totalSeats: cinemaScreens.totalSeats,
          qrType: cinemaQrCodes.qrType,
          qrName: cinemaQrCodes.qrName,
          token: cinemaQrCodes.token,
          theatreToken: cinemaQrCodes.theatreToken,
          screenToken: cinemaQrCodes.screenToken,
          targetUrl: cinemaQrCodes.targetUrl,
          qrCodeData: cinemaQrCodes.qrCodeData,
          status: cinemaQrCodes.status,
          createdAt: cinemaQrCodes.createdAt,
          updatedAt: cinemaQrCodes.updatedAt
        })
        .from(cinemaQrCodes)
        .innerJoin(cinemaScreens, eq(cinemaQrCodes.screenId, cinemaScreens.id))
        .where(
          and(
            eq(cinemaQrCodes.theatreId, tenant.restaurantId),
            eq(cinemaQrCodes.qrType, 'screen'),
            eq(cinemaQrCodes.status, 'active')
          )
        )
        .orderBy(asc(cinemaScreens.screenName));

      // Screens without active QR
      const allScreens = await db
        .select()
        .from(cinemaScreens)
        .where(
          and(
            eq(cinemaScreens.theatreId, tenant.restaurantId),
            ne(cinemaScreens.status, 'archived')
          )
        )
        .orderBy(asc(cinemaScreens.screenName));

      const screensWithActiveQrIds = new Set(screenQrs.map((sq) => sq.screenId));
      const screensWithoutQr = allScreens.filter((s) => !screensWithActiveQrIds.has(s.id));

      // Historical/Revoked QRs
      const history = await db
        .select({
          id: cinemaQrCodes.id,
          qrType: cinemaQrCodes.qrType,
          qrName: cinemaQrCodes.qrName,
          token: cinemaQrCodes.token,
          targetUrl: cinemaQrCodes.targetUrl,
          status: cinemaQrCodes.status,
          revokedAt: cinemaQrCodes.revokedAt,
          createdAt: cinemaQrCodes.createdAt,
          updatedAt: cinemaQrCodes.updatedAt
        })
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.theatreId, tenant.restaurantId),
            ne(cinemaQrCodes.status, 'active')
          )
        )
        .orderBy(desc(cinemaQrCodes.updatedAt))
        .limit(20);

      res.json({
        theatreQr: theatreQr || null,
        screenQrs,
        screensWithoutQr,
        history
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Revoke a QR Code
 * POST /api/cinema/qr/:id/revoke
 */
router.post(
  '/qr/:id/revoke',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const qrId = req.params.id as string;

      const [existing] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.id, qrId),
            eq(cinemaQrCodes.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new AppError('QR code not found or does not belong to this theatre', 404);
      }

      if (existing.status === 'revoked') {
        throw new AppError('This QR code is already revoked', 400);
      }

      const [updated] = await db
        .update(cinemaQrCodes)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedByUserId: req.user!.id,
          updatedAt: new Date()
        })
        .where(eq(cinemaQrCodes.id, qrId))
        .returning();

      res.json({
        message: `QR code "${existing.qrName}" has been successfully revoked`,
        qrCode: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Regenerate / Replace a QR Code
 * POST /api/cinema/qr/:id/regenerate
 */
router.post(
  '/qr/:id/regenerate',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = req.tenant!;
      const qrId = req.params.id as string;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const [existing] = await db
        .select()
        .from(cinemaQrCodes)
        .where(
          and(
            eq(cinemaQrCodes.id, qrId),
            eq(cinemaQrCodes.theatreId, tenant.restaurantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new AppError('QR code not found or does not belong to this theatre', 404);
      }

      if (existing.qrType === 'theatre') {
        // Regenerate theatre QR
        const newTheatreToken = generateCinemaQrToken(24);
        const newTargetUrl = buildCinemaTheatreQrUrl(appUrl, newTheatreToken);
        const newQrData = await QRCode.toDataURL(newTargetUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 512,
          color: { dark: '#000000', light: '#ffffff' }
        });

        const newQr = await db.transaction(async (tx) => {
          await tx
            .update(cinemaQrCodes)
            .set({ status: 'replaced', updatedAt: new Date() })
            .where(eq(cinemaQrCodes.id, existing.id));

          const [inserted] = await tx
            .insert(cinemaQrCodes)
            .values({
              id: crypto.randomUUID(),
              theatreId: tenant.restaurantId,
              screenId: null,
              qrType: 'theatre',
              qrName: existing.qrName,
              token: newTheatreToken,
              theatreToken: newTheatreToken,
              screenToken: null,
              targetUrl: newTargetUrl,
              qrCodeData: newQrData,
              status: 'active'
            })
            .returning();

          // Sync active screen QRs to new theatreToken
          const activeScreens = await tx
            .select()
            .from(cinemaQrCodes)
            .where(
              and(
                eq(cinemaQrCodes.theatreId, tenant.restaurantId),
                eq(cinemaQrCodes.qrType, 'screen'),
                eq(cinemaQrCodes.status, 'active')
              )
            );

          for (const s of activeScreens) {
            if (s.screenToken) {
              const uUrl = buildCinemaScreenQrUrl(appUrl, newTheatreToken, s.screenToken);
              const uData = await QRCode.toDataURL(uUrl, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 512,
                color: { dark: '#000000', light: '#ffffff' }
              });
              await tx
                .update(cinemaQrCodes)
                .set({
                  theatreToken: newTheatreToken,
                  targetUrl: uUrl,
                  qrCodeData: uData,
                  updatedAt: new Date()
                })
                .where(eq(cinemaQrCodes.id, s.id));
            }
          }

          return inserted;
        });

        return res.json({
          message: 'General theatre QR code regenerated successfully',
          qrCode: newQr
        });
      } else {
        // Regenerate screen QR
        if (!existing.screenId) {
          throw new AppError('Screen reference missing for screen QR', 400);
        }

        // Get active theatre token
        const [theatreQr] = await db
          .select()
          .from(cinemaQrCodes)
          .where(
            and(
              eq(cinemaQrCodes.theatreId, tenant.restaurantId),
              eq(cinemaQrCodes.qrType, 'theatre'),
              eq(cinemaQrCodes.status, 'active')
            )
          )
          .limit(1);

        const currentTheatreToken = theatreQr?.theatreToken || existing.theatreToken || generateCinemaQrToken(24);
        const newScreenToken = generateCinemaQrToken(24);
        const newTargetUrl = buildCinemaScreenQrUrl(appUrl, currentTheatreToken, newScreenToken);
        const newQrData = await QRCode.toDataURL(newTargetUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 512,
          color: { dark: '#000000', light: '#ffffff' }
        });

        const newQr = await db.transaction(async (tx) => {
          await tx
            .update(cinemaQrCodes)
            .set({ status: 'replaced', updatedAt: new Date() })
            .where(eq(cinemaQrCodes.id, existing.id));

          const [inserted] = await tx
            .insert(cinemaQrCodes)
            .values({
              id: crypto.randomUUID(),
              theatreId: tenant.restaurantId,
              screenId: existing.screenId,
              qrType: 'screen',
              qrName: existing.qrName,
              token: newScreenToken,
              theatreToken: currentTheatreToken,
              screenToken: newScreenToken,
              targetUrl: newTargetUrl,
              qrCodeData: newQrData,
              status: 'active'
            })
            .returning();

          return inserted;
        });

        return res.json({
          message: 'Screen QR code regenerated successfully',
          qrCode: newQr
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// TASK 10: CINEMA CART AND CHECKOUT BACKEND IMPLEMENTATION
// ===========================================================================

// Helper to generate a unique human-friendly order number within theatre scope
async function generateUniqueCinemaOrderNumber(tx: any, theatreId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${Math.floor(1000 + Math.random() * 9000)}`;
    const [existing] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, theatreId),
          eq(orders.orderNumber, candidate)
        )
      )
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }
  return `${Math.floor(10000 + Math.random() * 90000)}`;
}

// Helper to resolve and validate complete cinema order context
async function validateAndResolveCinemaContext(params: {
  theatreToken: string;
  screenId: string;
  showId: string;
  seatRow: string;
  seatNumber: string;
  bypassTimeWindow?: boolean;
}) {
  const { theatreToken, screenId, showId, seatRow, seatNumber, bypassTimeWindow } = params;

  // 1. Resolve QR Code
  const [qr] = await db
    .select()
    .from(cinemaQrCodes)
    .where(
      and(
        eq(cinemaQrCodes.token, theatreToken),
        eq(cinemaQrCodes.status, 'active')
      )
    )
    .limit(1);

  if (!qr) {
    throw new AppError('Invalid or expired cinema QR code', 404);
  }

  // 2. Validate theatre
  const [theatre] = await db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.id, qr.theatreId), eq(restaurants.isActive, true)))
    .limit(1);

  if (!theatre) {
    throw new AppError('Cinema theatre is inactive or not found', 404);
  }

  // 3. Validate screen
  const [screen] = await db
    .select()
    .from(cinemaScreens)
    .where(
      and(
        eq(cinemaScreens.id, screenId),
        eq(cinemaScreens.theatreId, qr.theatreId),
        eq(cinemaScreens.status, 'active')
      )
    )
    .limit(1);

  if (!screen) {
    throw new AppError('Selected screen does not belong to this theatre or is inactive', 400);
  }

  // 4. Validate show
  const [show] = await db
    .select()
    .from(cinemaShows)
    .where(
      and(
        eq(cinemaShows.id, showId),
        eq(cinemaShows.theatreId, qr.theatreId),
        eq(cinemaShows.screenId, screenId)
      )
    )
    .limit(1);

  if (!show) {
    throw new AppError('Selected show does not belong to this screen or theatre', 404);
  }

  if (show.status !== 'published') {
    throw new AppError(
      show.status === 'cancelled'
        ? 'This movie show has been cancelled'
        : 'This show is not published for food orders',
      400
    );
  }

  // Check ordering window
  const now = new Date();
  if (!bypassTimeWindow) {
    const oStart = new Date(show.orderingStartTime);
    const oEnd = new Date(show.orderingEndTime);
    if (now < oStart || now > oEnd) {
      throw new AppError('Food ordering window for this movie show is currently closed', 400);
    }
  }

  // 5. Validate seat
  const [seat] = await db
    .select()
    .from(cinemaSeats)
    .where(
      and(
        eq(cinemaSeats.theatreId, qr.theatreId),
        eq(cinemaSeats.screenId, screenId),
        eq(cinemaSeats.rowIdentifier, seatRow),
        eq(cinemaSeats.seatIdentifier, seatNumber),
        eq(cinemaSeats.status, 'active')
      )
    )
    .limit(1);

  if (!seat) {
    throw new AppError(
      `Selected seat ${seatNumber} (Row ${seatRow}) does not exist on ${screen.screenName}`,
      400
    );
  }

  // Fetch movie details
  const [movie] = await db
    .select()
    .from(cinemaMovies)
    .where(eq(cinemaMovies.id, show.movieId))
    .limit(1);

  return {
    qr,
    theatre,
    screen,
    show,
    movie: movie || {
      id: show.movieId,
      title: 'Featured Movie',
      posterUrl: null,
      language: 'N/A',
      durationMinutes: 120
    },
    seat
  };
}

// Helper to calculate authoritative prices strictly from database
async function calculateAuthoritativePrices(
  theatreId: string,
  theatreSettings: any,
  items: Array<{ productId: string; quantity: number; notes?: string | null }>
) {
  if (!items || items.length === 0) {
    throw new AppError('Order must contain at least one item', 400);
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const dbProducts = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      restaurantId: products.restaurantId,
      imageUrl: products.imageUrl,
      isVegetarian: products.isVegetarian,
      isAvailable: products.isAvailable
    })
    .from(products)
    .where(
      and(
        eq(products.restaurantId, theatreId),
        inArray(products.id, productIds)
      )
    );

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  // Verify all items belong to this theatre and are active
  let subtotal = 0;
  let totalCount = 0;
  const detailedItems = [];

  for (const item of items) {
    const prod = productMap.get(item.productId);
    if (!prod) {
      throw new AppError(
        `Product ID "${item.productId}" is invalid or does not belong to this theatre`,
        400
      );
    }
    if (!prod.isAvailable) {
      throw new AppError(`Item "${prod.name}" is currently sold out`, 400);
    }

    const unitPrice = prod.price; // authoritative integer paise from DB
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;
    totalCount += item.quantity;

    detailedItems.push({
      productId: prod.id,
      productName: prod.name,
      imageUrl: prod.imageUrl || null,
      isVegetarian: prod.isVegetarian,
      unitPrice,
      quantity: item.quantity,
      subtotal: itemSubtotal,
      notes: item.notes || null
    });
  }

  // Tax Calculation (Standard 5% GST in India on restaurant/cinema concessions)
  const taxRate = typeof theatreSettings?.taxPercentage === 'number' ? theatreSettings.taxPercentage : 5;
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  const totalAmount = subtotal + taxAmount;

  const cgstAmount = Math.round(taxAmount / 2);
  const sgstAmount = taxAmount - cgstAmount;

  const taxes = [
    { name: `CGST (${(taxRate / 2).toFixed(1)}%)`, rate: taxRate / 2, amount: cgstAmount },
    { name: `SGST (${(taxRate / 2).toFixed(1)}%)`, rate: taxRate / 2, amount: sgstAmount }
  ];

  return {
    subtotal,
    taxRate,
    taxAmount,
    taxes,
    totalAmount,
    itemCount: totalCount,
    items: detailedItems
  };
}

/**
 * 1. Add (or increment) item in Cinema Cart
 * POST /api/cinema/public/cart/items
 */
router.post(
  '/public/cart/items',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = addCinemaCartItemSchema.parse(req.body);

      // Validate cinema context & window
      const context = await validateAndResolveCinemaContext({
        theatreToken: validatedData.theatreToken,
        screenId: validatedData.screenId,
        showId: validatedData.showId,
        seatRow: validatedData.seatRow,
        seatNumber: validatedData.seatNumber
      });

      // Find or create cart session
      let cartToken =
        validatedData.cartToken ||
        (req.headers['x-cinema-cart-token'] as string | undefined) ||
        null;

      let cart: typeof cinemaCarts.$inferSelect | undefined;

      if (cartToken) {
        const [existing] = await db
          .select()
          .from(cinemaCarts)
          .where(eq(cinemaCarts.cartToken, cartToken))
          .limit(1);
        cart = existing;
      }

      const existingItems: Array<{ productId: string; quantity: number; notes?: string }> =
        cart?.items || [];

      // Check if product already in items
      const existingItemIndex = existingItems.findIndex(
        (i) => i.productId === validatedData.productId
      );

      let updatedItems: Array<{ productId: string; quantity: number; notes?: string }>;

      if (existingItemIndex > -1) {
        const item = existingItems[existingItemIndex]!;
        const newQty = Math.min(item.quantity + validatedData.quantity, 99);
        updatedItems = [...existingItems];
        updatedItems[existingItemIndex] = {
          ...item,
          quantity: newQty,
          notes: validatedData.notes !== undefined ? (validatedData.notes || undefined) : item.notes
        };
      } else {
        updatedItems = [
          ...existingItems,
          {
            productId: validatedData.productId,
            quantity: validatedData.quantity,
            notes: validatedData.notes || undefined
          }
        ];
      }

      // Calculate authoritative prices
      const summary = await calculateAuthoritativePrices(
        context.theatre.id,
        context.theatre.settings,
        updatedItems
      );

      if (cart) {
        // Update existing cart
        const [saved] = await db
          .update(cinemaCarts)
          .set({
            screenId: context.screen.id,
            showId: context.show.id,
            seatRow: validatedData.seatRow,
            seatNumber: validatedData.seatNumber,
            items: updatedItems,
            customerName: validatedData.customerName || cart.customerName,
            customerPhone: validatedData.customerPhone || cart.customerPhone,
            specialInstructions: validatedData.specialInstructions || cart.specialInstructions,
            updatedAt: new Date()
          })
          .where(eq(cinemaCarts.id, cart.id))
          .returning();
        cart = saved;
      } else {
        // Generate new cryptographic cart token
        cartToken = generateCinemaQrToken(24);
        const [created] = await db
          .insert(cinemaCarts)
          .values({
            id: crypto.randomUUID(),
            cartToken,
            theatreId: context.theatre.id,
            screenId: context.screen.id,
            showId: context.show.id,
            seatRow: validatedData.seatRow,
            seatNumber: validatedData.seatNumber,
            items: updatedItems,
            customerName: validatedData.customerName || null,
            customerPhone: validatedData.customerPhone || null,
            specialInstructions: validatedData.specialInstructions || null
          })
          .returning();
        cart = created;
      }

      res.status(200).json({
        success: true,
        cartToken,
        cart: {
          cartToken,
          items: summary.items,
          summary: {
            subtotal: summary.subtotal,
            taxRate: summary.taxRate,
            taxAmount: summary.taxAmount,
            taxes: summary.taxes,
            totalAmount: summary.totalAmount,
            itemCount: summary.itemCount
          },
          context: {
            theatre: {
              id: context.theatre.id,
              name: context.theatre.name,
              currency: context.theatre.currency
            },
            screen: {
              id: context.screen.id,
              screenName: context.screen.screenName,
              screenType: context.screen.screenType
            },
            movie: {
              id: context.movie.id,
              title: context.movie.title,
              posterUrl: context.movie.posterUrl
            },
            show: {
              id: context.show.id,
              showDate: context.show.showDate,
              startTime: context.show.startTime,
              expectedEndTime: context.show.expectedEndTime
            },
            seat: {
              row: validatedData.seatRow,
              seat: validatedData.seatNumber
            }
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 2. Update item quantity in Cinema Cart
 * PATCH /api/cinema/public/cart/:cartToken/items/:productId
 */
router.patch(
  '/public/cart/:cartToken/items/:productId',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartToken = req.params.cartToken as string;
      const productId = req.params.productId as string;
      const validatedData = updateCinemaCartItemQuantitySchema.parse(req.body);

      const [cart] = await db
        .select()
        .from(cinemaCarts)
        .where(eq(cinemaCarts.cartToken, cartToken))
        .limit(1);

      if (!cart) {
        throw new AppError('Cinema cart session not found or expired', 404);
      }

      let updatedItems: Array<{ productId: string; quantity: number; notes?: string }>;

      if (validatedData.quantity === 0) {
        // Remove item
        updatedItems = (cart.items || []).filter((i) => i.productId !== productId);
      } else {
        const existingIdx = (cart.items || []).findIndex((i) => i.productId === productId);
        if (existingIdx === -1) {
          throw new AppError('Product not found in this cart', 404);
        }
        updatedItems = [...(cart.items || [])];
        const existing = updatedItems[existingIdx]!;
        updatedItems[existingIdx] = {
          ...existing,
          quantity: validatedData.quantity,
          notes: validatedData.notes !== undefined ? (validatedData.notes || undefined) : existing.notes
        };
      }

      // Re-calculate prices if items remain
      const [theatre] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, cart.theatreId))
        .limit(1);

      const summary =
        updatedItems.length > 0
          ? await calculateAuthoritativePrices(
              cart.theatreId,
              theatre?.settings,
              updatedItems
            )
          : {
              subtotal: 0,
              taxRate: 5,
              taxAmount: 0,
              taxes: [],
              totalAmount: 0,
              itemCount: 0,
              items: []
            };

      await db
        .update(cinemaCarts)
        .set({
          items: updatedItems,
          updatedAt: new Date()
        })
        .where(eq(cinemaCarts.id, cart.id));

      res.json({
        success: true,
        cartToken,
        items: summary.items,
        summary
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 3. Remove item completely from Cinema Cart
 * DELETE /api/cinema/public/cart/:cartToken/items/:productId
 */
router.delete(
  '/public/cart/:cartToken/items/:productId',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartToken = req.params.cartToken as string;
      const productId = req.params.productId as string;

      const [cart] = await db
        .select()
        .from(cinemaCarts)
        .where(eq(cinemaCarts.cartToken, cartToken))
        .limit(1);

      if (!cart) {
        throw new AppError('Cinema cart session not found or expired', 404);
      }

      const updatedItems = (cart.items || []).filter((i) => i.productId !== productId);

      const [theatre] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, cart.theatreId))
        .limit(1);

      const summary =
        updatedItems.length > 0
          ? await calculateAuthoritativePrices(
              cart.theatreId,
              theatre?.settings,
              updatedItems
            )
          : {
              subtotal: 0,
              taxRate: 5,
              taxAmount: 0,
              taxes: [],
              totalAmount: 0,
              itemCount: 0,
              items: []
            };

      await db
        .update(cinemaCarts)
        .set({
          items: updatedItems,
          updatedAt: new Date()
        })
        .where(eq(cinemaCarts.id, cart.id));

      res.json({
        success: true,
        cartToken,
        items: summary.items,
        summary
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 4. Get Cinema Cart with authoritative live recalculation
 * GET /api/cinema/public/cart/:cartToken
 */
router.get(
  '/public/cart/:cartToken',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartToken = req.params.cartToken as string;

      const [cart] = await db
        .select()
        .from(cinemaCarts)
        .where(eq(cinemaCarts.cartToken, cartToken))
        .limit(1);

      if (!cart) {
        throw new AppError('Cinema cart session not found or expired', 404);
      }

      const [theatre] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, cart.theatreId))
        .limit(1);

      // Context resolution
      let screen = null;
      if (cart.screenId) {
        const [foundScreen] = await db
          .select()
          .from(cinemaScreens)
          .where(eq(cinemaScreens.id, cart.screenId))
          .limit(1);
        screen = foundScreen || null;
      }

      let show = null;
      let movie = null;
      if (cart.showId) {
        const [foundShow] = await db
          .select()
          .from(cinemaShows)
          .where(eq(cinemaShows.id, cart.showId))
          .limit(1);
        show = foundShow || null;

        if (foundShow) {
          const [foundMovie] = await db
            .select()
            .from(cinemaMovies)
            .where(eq(cinemaMovies.id, foundShow.movieId))
            .limit(1);
          movie = foundMovie || null;
        }
      }

      const rawItems = cart.items || [];
      const summary =
        rawItems.length > 0
          ? await calculateAuthoritativePrices(
              cart.theatreId,
              theatre?.settings,
              rawItems
            )
          : {
              subtotal: 0,
              taxRate: 5,
              taxAmount: 0,
              taxes: [],
              totalAmount: 0,
              itemCount: 0,
              items: []
            };

      res.json({
        success: true,
        cartToken,
        cart: {
          cartToken,
          items: summary.items,
          summary: {
            subtotal: summary.subtotal,
            taxRate: summary.taxRate,
            taxAmount: summary.taxAmount,
            taxes: summary.taxes,
            totalAmount: summary.totalAmount,
            itemCount: summary.itemCount
          },
          context: {
            theatre: theatre
              ? {
                  id: theatre.id,
                  name: theatre.name,
                  currency: theatre.currency
                }
              : null,
            screen: screen
              ? {
                  id: screen.id,
                  screenName: screen.screenName,
                  screenType: screen.screenType
                }
              : null,
            movie: movie
              ? {
                  id: movie.id,
                  title: movie.title,
                  posterUrl: movie.posterUrl
                }
              : null,
            show: show
              ? {
                  id: show.id,
                  showDate: show.showDate,
                  startTime: show.startTime,
                  expectedEndTime: show.expectedEndTime
                }
              : null,
            seat: {
              row: cart.seatRow,
              seat: cart.seatNumber
            }
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 5. Clear Cinema Cart
 * DELETE /api/cinema/public/cart/:cartToken
 */
router.delete(
  '/public/cart/:cartToken',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartToken = req.params.cartToken as string;

      const [cart] = await db
        .select()
        .from(cinemaCarts)
        .where(eq(cinemaCarts.cartToken, cartToken))
        .limit(1);

      if (!cart) {
        throw new AppError('Cinema cart session not found or expired', 404);
      }

      // Clear items but preserve context
      await db
        .update(cinemaCarts)
        .set({
          items: [],
          updatedAt: new Date()
        })
        .where(eq(cinemaCarts.id, cart.id));

      res.json({
        success: true,
        message: 'Cinema cart cleared successfully',
        cartToken
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 6. Calculate Checkout Summary (Authoritative backend prices, taxes, and totals)
 * POST /api/cinema/public/cart/summary & POST /api/cinema/public/checkout/calculate
 */
const handleCalculateCheckoutSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = calculateCinemaCheckoutSchema.parse(req.body);

    const context = await validateAndResolveCinemaContext({
      theatreToken: validatedData.theatreToken,
      screenId: validatedData.screenId,
      showId: validatedData.showId,
      seatRow: validatedData.seatRow,
      seatNumber: validatedData.seatNumber
    });

    const summary = await calculateAuthoritativePrices(
      context.theatre.id,
      context.theatre.settings,
      validatedData.items
    );

    res.json({
      success: true,
      summary,
      context: {
        theatre: {
          id: context.theatre.id,
          name: context.theatre.name,
          currency: context.theatre.currency
        },
        screen: {
          id: context.screen.id,
          screenName: context.screen.screenName,
          screenType: context.screen.screenType
        },
        movie: {
          id: context.movie.id,
          title: context.movie.title,
          posterUrl: context.movie.posterUrl
        },
        show: {
          id: context.show.id,
          showDate: context.show.showDate,
          startTime: context.show.startTime,
          expectedEndTime: context.show.expectedEndTime
        },
        seat: {
          row: validatedData.seatRow,
          seat: validatedData.seatNumber
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

router.post(
  '/public/cart/summary',
  tableVerificationRateLimiter,
  handleCalculateCheckoutSummary
);

router.post(
  '/public/checkout/calculate',
  tableVerificationRateLimiter,
  handleCalculateCheckoutSummary
);

/**
 * 7. Validate Checkout (Comprehensive pre-checkout verification)
 * POST /api/cinema/public/checkout/validate
 */
router.post(
  '/public/checkout/validate',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = calculateCinemaCheckoutSchema.parse(req.body);

      const context = await validateAndResolveCinemaContext({
        theatreToken: validatedData.theatreToken,
        screenId: validatedData.screenId,
        showId: validatedData.showId,
        seatRow: validatedData.seatRow,
        seatNumber: validatedData.seatNumber
      });

      const summary = await calculateAuthoritativePrices(
        context.theatre.id,
        context.theatre.settings,
        validatedData.items
      );

      res.json({
        valid: true,
        message: 'Cinema checkout validated successfully',
        summary,
        context: {
          theatre: {
            id: context.theatre.id,
            name: context.theatre.name,
            currency: context.theatre.currency
          },
          screen: {
            id: context.screen.id,
            screenName: context.screen.screenName,
            screenType: context.screen.screenType
          },
          movie: {
            id: context.movie.id,
            title: context.movie.title,
            posterUrl: context.movie.posterUrl
          },
          show: {
            id: context.show.id,
            showDate: context.show.showDate,
            startTime: context.show.startTime,
            expectedEndTime: context.show.expectedEndTime
          },
          seat: {
            row: validatedData.seatRow,
            seat: validatedData.seatNumber
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 8. Prepare Cinema Order (Prepares pending order awaiting payment in Task 11)
 * POST /api/cinema/public/checkout/prepare
 * STRICT: Does NOT mark order as confirmed or paid! Creates order with status='pending', paymentStatus='unpaid'.
 */
router.post(
  '/public/checkout/prepare',
  tableVerificationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = prepareCinemaOrderSchema.parse(req.body);

      // Validate all context, show status, window, and seat
      const context = await validateAndResolveCinemaContext({
        theatreToken: validatedData.theatreToken,
        screenId: validatedData.screenId,
        showId: validatedData.showId,
        seatRow: validatedData.seatRow,
        seatNumber: validatedData.seatNumber
      });

      // Calculate authoritative prices & taxes
      const summary = await calculateAuthoritativePrices(
        context.theatre.id,
        context.theatre.settings,
        validatedData.items
      );

      // Idempotency check: prevent duplicate submissions
      const idempotencyKey =
        (req.headers['idempotency-key'] as string | undefined)?.trim() ||
        validatedData.idempotencyKey?.trim() ||
        null;

      if (idempotencyKey) {
        const [existingOrder] = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, context.theatre.id),
              eq(orders.idempotencyKey, idempotencyKey)
            )
          )
          .limit(1);

        if (existingOrder) {
          const existingItems = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, existingOrder.id));

          return res.status(200).json({
            message: 'Order already prepared (idempotent replay)',
            idempotent: true,
            order: {
              ...existingOrder,
              items: existingItems
            }
          });
        }
      }

      // Generate order attributes
      const orderId = crypto.randomUUID();
      const statusToken = crypto.randomBytes(16).toString('hex');

      // Atomic transaction: create pending cinema order and snapshots
      const preparedResult = await db.transaction(async (tx) => {
        const orderNumber = await generateUniqueCinemaOrderNumber(tx, context.theatre.id);

        const [newOrder] = await tx
          .insert(orders)
          .values({
            id: orderId,
            orderNumber,
            restaurantId: context.theatre.id,
            orderType: 'cinema',
            screenId: context.screen.id,
            showId: context.show.id,
            movieId: context.movie.id,
            showDate: context.show.showDate,
            showtime:
              context.show.startTime instanceof Date
                ? context.show.startTime.toISOString().substring(11, 19)
                : String(context.show.startTime).substring(0, 20),
            seatRow: validatedData.seatRow,
            seatNumber: validatedData.seatNumber,
            status: 'pending', // Strictly pending, NOT new or confirmed!
            paymentStatus: 'unpaid', // Strictly unpaid!
            subtotal: summary.subtotal,
            taxAmount: summary.taxAmount,
            totalAmount: summary.totalAmount,
            specialInstructions: validatedData.specialInstructions || null,
            customerName: validatedData.customerName || null,
            customerPhone: validatedData.customerPhone || null,
            idempotencyKey,
            statusToken
          })
          .returning();

        if (!newOrder) {
          throw new AppError('Failed to prepare cinema order', 500);
        }

        const insertedItems = await tx
          .insert(orderItems)
          .values(
            summary.items.map((item) => ({
              id: crypto.randomUUID(),
              orderId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              notes: item.notes || null
            }))
          )
          .returning();

        // Audit Trail
        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId,
          fromStatus: 'draft',
          toStatus: 'pending',
          changedByRole: 'customer',
          reason: 'Cinema order prepared awaiting payment gateway connection'
        });

        return {
          order: newOrder,
          items: insertedItems
        };
      });

      // Query active verified payment gateways configured for this theatre
      const paymentAccounts = await db
        .select({
          provider: cinemaPaymentAccounts.provider
        })
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, context.theatre.id),
            eq(cinemaPaymentAccounts.isVerified, true),
            ne(cinemaPaymentAccounts.status, 'disabled')
          )
        );

      const paymentProviders = paymentAccounts.map((a) => a.provider);

      res.status(201).json({
        success: true,
        message: 'Cinema order prepared successfully in pending status',
        statusToken,
        order: {
          ...preparedResult.order,
          theatre: {
            id: context.theatre.id,
            name: context.theatre.name,
            currency: context.theatre.currency,
            paymentProviders
          },
          screen: {
            id: context.screen.id,
            screenName: context.screen.screenName,
            screenType: context.screen.screenType
          },
          movie: {
            id: context.movie.id,
            title: context.movie.title,
            posterUrl: context.movie.posterUrl
          },
          show: {
            id: context.show.id,
            showDate: context.show.showDate,
            startTime: context.show.startTime,
            expectedEndTime: context.show.expectedEndTime
          },
          seat: {
            row: validatedData.seatRow,
            seat: validatedData.seatNumber
          },
          summary: {
            subtotal: summary.subtotal,
            taxRate: summary.taxRate,
            taxAmount: summary.taxAmount,
            taxes: summary.taxes,
            totalAmount: summary.totalAmount,
            itemCount: summary.itemCount
          },
          items: preparedResult.items
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 9. Customer Order Access (Public endpoint protected by secure statusToken)
 * GET /api/cinema/public/orders/:orderId
 * GET /api/cinema/public/orders/status/:token
 * Does not require customer login. Displays complete cinema context and payment status.
 */
const handleGetCinemaOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawOrderId = req.params.orderId as string | undefined;
    const rawToken =
      (req.params.token as string | undefined) ||
      (req.query.statusToken as string | undefined) ||
      (req.headers['x-status-token'] as string | undefined);

    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    if (!token || token.length < 16) {
      throw new AppError('Cinema order not found or invalid access token', 404);
    }

    // Query order with status token validation
    const conditions = [
      eq(orders.statusToken, token),
      eq(orders.orderType, 'cinema')
    ];

    if (rawOrderId) {
      conditions.push(eq(orders.id, rawOrderId));
    }

    const [orderRecord] = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .limit(1);

    if (!orderRecord) {
      throw new AppError('Cinema order not found or invalid access token', 404);
    }

    // Resolve context relations
    const [theatre] = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        currency: restaurants.currency,
        logoUrl: restaurants.logoUrl,
        address: restaurants.address
      })
      .from(restaurants)
      .where(eq(restaurants.id, orderRecord.restaurantId))
      .limit(1);

    const [screen] = orderRecord.screenId
      ? await db
          .select({
            id: cinemaScreens.id,
            screenName: cinemaScreens.screenName,
            screenType: cinemaScreens.screenType
          })
          .from(cinemaScreens)
          .where(eq(cinemaScreens.id, orderRecord.screenId))
          .limit(1)
      : [null];

    const [show] = orderRecord.showId
      ? await db
          .select({
            id: cinemaShows.id,
            showDate: cinemaShows.showDate,
            startTime: cinemaShows.startTime,
            expectedEndTime: cinemaShows.expectedEndTime,
            status: cinemaShows.status
          })
          .from(cinemaShows)
          .where(eq(cinemaShows.id, orderRecord.showId))
          .limit(1)
      : [null];

    const [movie] = orderRecord.movieId
      ? await db
          .select({
            id: cinemaMovies.id,
            title: cinemaMovies.title,
            posterUrl: cinemaMovies.posterUrl,
            language: cinemaMovies.language,
            durationMinutes: cinemaMovies.durationMinutes
          })
          .from(cinemaMovies)
          .where(eq(cinemaMovies.id, orderRecord.movieId))
          .limit(1)
      : [null];

    const items = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        productName: orderItems.productName,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        subtotal: orderItems.subtotal,
        notes: orderItems.notes
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderRecord.id));

    const formattedShowtime =
      orderRecord.showtime ||
      (show?.startTime
        ? show.startTime instanceof Date
          ? show.startTime.toISOString().substring(11, 19)
          : String(show.startTime).substring(0, 20)
        : null);

    const [theatreQr] = await db
      .select({ token: cinemaQrCodes.token, theatreToken: cinemaQrCodes.theatreToken })
      .from(cinemaQrCodes)
      .where(and(eq(cinemaQrCodes.theatreId, orderRecord.restaurantId), eq(cinemaQrCodes.status, 'active')))
      .limit(1);
    const activeTheatreToken = theatreQr?.theatreToken || theatreQr?.token || null;

    res.json({
      success: true,
      order: {
        id: orderRecord.id,
        orderNumber: orderRecord.orderNumber,
        theatreId: orderRecord.restaurantId,
        theatreToken: activeTheatreToken,
        screenId: orderRecord.screenId,
        movieId: orderRecord.movieId,
        showId: orderRecord.showId,
        showDate: orderRecord.showDate || show?.showDate || null,
        showtime: formattedShowtime,
        seatRow: orderRecord.seatRow,
        seatNumber: orderRecord.seatNumber,
        status: orderRecord.status,
        paymentStatus: orderRecord.paymentStatus,
        paymentMethod: orderRecord.paymentMethod,
        paymentReference: orderRecord.paymentReference,
        subtotal: orderRecord.subtotal,
        taxAmount: orderRecord.taxAmount,
        totalAmount: orderRecord.totalAmount,
        specialInstructions: orderRecord.specialInstructions,
        customerName: orderRecord.customerName,
        customerPhone: orderRecord.customerPhone,
        statusToken: orderRecord.statusToken,
        createdAt: orderRecord.createdAt,
        updatedAt: orderRecord.updatedAt,
        theatre: theatre
          ? {
              id: theatre.id,
              name: theatre.name,
              slug: theatre.slug,
              currency: theatre.currency,
              logoUrl: theatre.logoUrl,
              address: theatre.address,
              theatreToken: activeTheatreToken
            }
          : null,
        screen: screen
          ? {
              id: screen.id,
              screenName: screen.screenName,
              screenType: screen.screenType
            }
          : null,
        movie: movie
          ? {
              id: movie.id,
              title: movie.title,
              posterUrl: movie.posterUrl,
              language: movie.language,
              durationMinutes: movie.durationMinutes
            }
          : null,
        show: show
          ? {
              id: show.id,
              showDate: show.showDate,
              startTime: show.startTime,
              expectedEndTime: show.expectedEndTime,
              status: show.status
            }
          : null,
        seat: {
          row: orderRecord.seatRow,
          seat: orderRecord.seatNumber
        },
        items,
        summary: {
          subtotal: orderRecord.subtotal,
          taxAmount: orderRecord.taxAmount,
          totalAmount: orderRecord.totalAmount,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

router.get('/public/orders/:orderId', tableVerificationRateLimiter, handleGetCinemaOrderStatus);
router.get('/public/orders/status/:token', tableVerificationRateLimiter, handleGetCinemaOrderStatus);

// ===========================================================================
// TASK 15: CINEMA KITCHEN DASHBOARD & ORDER PREPARATION WORKFLOW
// ===========================================================================

/**
 * Helper to fetch complete joined context for a list of cinema kitchen orders
 */
async function enrichCinemaKitchenOrders(theatreId: string, orderList: (typeof orders.$inferSelect)[]) {
  if (orderList.length === 0) return [];

  const orderIds = orderList.map((o) => o.id);
  const screenIds = Array.from(new Set(orderList.map((o) => o.screenId).filter(Boolean))) as string[];
  const movieIds = Array.from(new Set(orderList.map((o) => o.movieId).filter(Boolean))) as string[];
  const showIds = Array.from(new Set(orderList.map((o) => o.showId).filter(Boolean))) as string[];

  const [items, history, screensList, moviesList, showsList] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
    db
      .select()
      .from(orderStatusHistory)
      .where(inArray(orderStatusHistory.orderId, orderIds))
      .orderBy(desc(orderStatusHistory.createdAt)),
    screenIds.length > 0
      ? db.select().from(cinemaScreens).where(inArray(cinemaScreens.id, screenIds))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db.select().from(cinemaMovies).where(inArray(cinemaMovies.id, movieIds))
      : Promise.resolve([]),
    showIds.length > 0
      ? db.select().from(cinemaShows).where(inArray(cinemaShows.id, showIds))
      : Promise.resolve([])
  ]);

  const itemsMap: Record<string, typeof items> = {};
  for (const item of items) {
    (itemsMap[item.orderId] ??= []).push(item);
  }

  const historyMap: Record<string, typeof history> = {};
  for (const h of history) {
    (historyMap[h.orderId] ??= []).push(h);
  }

  const screenMap = new Map(screensList.map((s) => [s.id, s]));
  const movieMap = new Map(moviesList.map((m) => [m.id, m]));
  const showMap = new Map(showsList.map((s) => [s.id, s]));

  const now = Date.now();

  return orderList.map((order) => {
    const screen = order.screenId ? screenMap.get(order.screenId) : null;
    const movie = order.movieId ? movieMap.get(order.movieId) : null;
    const show = order.showId ? showMap.get(order.showId) : null;
    const orderItemsList = itemsMap[order.id] || [];
    const auditHistory = historyMap[order.id] || [];

    const createdAtTime = new Date(order.createdAt).getTime();
    const elapsedMinutes = Math.max(0, Math.floor((now - createdAtTime) / 60000));

    let formattedShowtime = order.showtime || null;
    if (!formattedShowtime && show?.startTime) {
      formattedShowtime = show.startTime.toISOString().substring(11, 19);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      theatreId: order.restaurantId,
      orderType: order.orderType,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      specialInstructions: order.specialInstructions,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      statusToken: order.statusToken,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      elapsedMinutes,
      screenId: order.screenId,
      screen: screen
        ? {
            id: screen.id,
            name: screen.screenName,
            screenName: screen.screenName,
            screenType: screen.screenType
          }
        : null,
      movieId: order.movieId,
      movie: movie
        ? {
            id: movie.id,
            title: movie.title,
            language: movie.language,
            posterUrl: movie.posterUrl,
            durationMinutes: movie.durationMinutes
          }
        : null,
      showId: order.showId,
      show: show
        ? {
            id: show.id,
            showDate: show.showDate,
            startTime: show.startTime,
            expectedEndTime: show.expectedEndTime,
            status: show.status
          }
        : null,
      showDate: order.showDate || show?.showDate || null,
      showtime: formattedShowtime,
      seatRow: order.seatRow,
      seatNumber: order.seatNumber,
      deliveryStatus: order.deliveryStatus || 'unassigned',
      deliveryStaffId: order.deliveryStaffId || null,
      deliveryStaffName: order.deliveryStaffName || null,
      assignedAt: order.assignedAt || null,
      deliveredAt: order.deliveredAt || null,
      items: orderItemsList.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes
      })),
      statusHistory: auditHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedByUserId: h.changedByUserId,
        changedByRole: h.changedByRole,
        reason: h.reason,
        createdAt: h.createdAt
      }))
    };
  });
}

/**
 * GET /api/cinema/kitchen/orders
 * Returns confirmed paid orders eligible for cinema kitchen preparation.
 * Unpaid, failed, or pending payment orders are strictly excluded.
 */
router.get(
  '/kitchen/orders',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const statusFilter = (req.query.status as string | undefined)?.toLowerCase().trim();
      const screenIdFilter = (req.query.screenId as string | undefined)?.trim();
      const search = (req.query.search as string | undefined)?.trim();

      const conditions = [
        eq(orders.restaurantId, theatreId),
        eq(orders.orderType, 'cinema'),
        eq(orders.paymentStatus, 'paid') // STRICT REQUIREMENT: Only confirmed paid orders
      ];

      // Status filtering
      if (statusFilter && statusFilter !== 'open' && statusFilter !== 'all') {
        if (statusFilter === 'new') {
          conditions.push(inArray(orders.status, ['new', 'confirmed']));
        } else {
          conditions.push(eq(orders.status, statusFilter));
        }
      } else if (statusFilter !== 'all') {
        // Default: Open kitchen queue (new, confirmed, accepted, preparing, ready)
        conditions.push(inArray(orders.status, ['new', 'confirmed', 'accepted', 'preparing', 'ready']));
      }

      if (screenIdFilter) {
        conditions.push(eq(orders.screenId, screenIdFilter));
      }

      const orderRecords = await db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(asc(orders.createdAt));

      let enriched = await enrichCinemaKitchenOrders(theatreId, orderRecords);

      if (search) {
        const query = search.toLowerCase();
        enriched = enriched.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(query) ||
            (o.customerName && o.customerName.toLowerCase().includes(query)) ||
            (o.seatRow && o.seatRow.toLowerCase().includes(query)) ||
            (o.seatNumber && o.seatNumber.toLowerCase().includes(query)) ||
            (o.movie && o.movie.title.toLowerCase().includes(query))
        );
      }

      res.json({
        success: true,
        theatreId,
        orders: enriched,
        total: enriched.length
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/kitchen/orders/:orderId/accept
 * Moves a paid incoming order from NEW/CONFIRMED to ACCEPTED.
 */
router.post(
  '/kitchen/orders/:orderId/accept',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.orderId as string;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;
      const reason =
        req.body?.reason || 'Order accepted by cinema kitchen (preparation started)';

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, theatreId),
              eq(orders.orderType, 'cinema')
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        // STRICT REQUIREMENT: Only paid orders can enter kitchen queue
        if (order.paymentStatus !== 'paid') {
          throw new AppError(
            `Cannot accept order with unpaid payment status (current status: ${order.paymentStatus})`,
            400
          );
        }

        if (order.status === 'accepted') {
          throw new AppError('Order is already accepted', 400);
        }

        if (order.status === 'preparing' || order.status === 'ready') {
          throw new AppError(
            `Invalid status transition: order is already in "${order.status}" status and cannot be moved back to "accepted"`,
            400
          );
        }

        if (isTerminalOrderStatus(order.status as OrderStatus)) {
          throw new AppError(`Cannot accept order in terminal status "${order.status}"`, 400);
        }

        const [saved] = await tx
          .update(orders)
          .set({
            status: 'accepted',
            updatedAt: new Date()
          })
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'accepted',
          changedByUserId: userId,
          changedByRole: userRole,
          reason
        });

        if (!saved) {
          throw new AppError('Failed to update cinema order', 500);
        }
        return saved;
      });

      const enrichedList = await enrichCinemaKitchenOrders(theatreId, [updatedOrder]);
      const enriched = enrichedList[0];
      if (!enriched) {
        throw new AppError('Failed to retrieve updated cinema order', 500);
      }

      // Realtime notification to all connected kitchen dashboards
      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema',
          screenName: enriched.screen?.name,
          movieTitle: enriched.movie?.title,
          seatRow: enriched.seatRow,
          seatNumber: enriched.seatNumber
        },
        enriched.items,
        'Cinema Kitchen'
      ).catch((err) => console.warn('Realtime publish error in kitchen accept:', err));

      res.json({
        success: true,
        message: 'Order accepted successfully',
        order: enriched
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/kitchen/orders/:orderId/prepare
 * Moves an accepted or new paid order into PREPARING.
 */
router.post(
  '/kitchen/orders/:orderId/prepare',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.orderId as string;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;
      const reason = req.body?.reason || 'Kitchen started preparing food items';

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, theatreId),
              eq(orders.orderType, 'cinema')
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        if (order.paymentStatus !== 'paid') {
          throw new AppError(
            `Cannot prepare order with unpaid payment status (current status: ${order.paymentStatus})`,
            400
          );
        }

        if (order.status === 'preparing') {
          throw new AppError('Order is already in preparation', 400);
        }

        if (order.status === 'ready') {
          throw new AppError(
            'Cannot move ready order back to preparing without an authorized correction workflow',
            400
          );
        }

        if (isTerminalOrderStatus(order.status as OrderStatus)) {
          throw new AppError(`Cannot prepare order in terminal status "${order.status}"`, 400);
        }

        const [saved] = await tx
          .update(orders)
          .set({
            status: 'preparing',
            updatedAt: new Date()
          })
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'preparing',
          changedByUserId: userId,
          changedByRole: userRole,
          reason
        });

        if (!saved) {
          throw new AppError('Failed to update cinema order', 500);
        }
        return saved;
      });

      const enrichedList = await enrichCinemaKitchenOrders(theatreId, [updatedOrder]);
      const enriched = enrichedList[0];
      if (!enriched) {
        throw new AppError('Failed to retrieve updated cinema order', 500);
      }

      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema',
          screenName: enriched.screen?.name,
          movieTitle: enriched.movie?.title,
          seatRow: enriched.seatRow,
          seatNumber: enriched.seatNumber
        },
        enriched.items,
        'Cinema Kitchen'
      ).catch((err) => console.warn('Realtime publish error in kitchen prepare:', err));

      res.json({
        success: true,
        message: 'Order status changed to preparing',
        order: enriched
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/kitchen/orders/:orderId/ready
 * Moves an order in PREPARING to READY for delivery.
 * Authorized for kitchen, admin, and owner roles (floor staff cannot mark ready).
 */
router.post(
  '/kitchen/orders/:orderId/ready',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'kitchen']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.orderId as string;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;
      const reason = req.body?.reason || 'Food preparation completed and marked ready for delivery';

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, theatreId),
              eq(orders.orderType, 'cinema')
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        if (order.paymentStatus !== 'paid') {
          throw new AppError('Cannot mark unpaid order as ready', 400);
        }

        if (order.status === 'ready') {
          throw new AppError('Order is already marked as ready', 400);
        }

        if (order.status !== 'preparing' && order.status !== 'accepted') {
          throw new AppError(
            `Invalid status transition: order must be in "accepted" or "preparing" status before marking ready (current status: "${order.status}")`,
            400
          );
        }

        const [saved] = await tx
          .update(orders)
          .set({
            status: 'ready',
            updatedAt: new Date()
          })
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'ready',
          changedByUserId: userId,
          changedByRole: userRole,
          reason
        });

        if (!saved) {
          throw new AppError('Failed to update cinema order', 500);
        }
        return saved;
      });

      const enrichedList = await enrichCinemaKitchenOrders(theatreId, [updatedOrder]);
      const enriched = enrichedList[0];
      if (!enriched) {
        throw new AppError('Failed to retrieve updated cinema order', 500);
      }

      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema',
          screenName: enriched.screen?.name,
          movieTitle: enriched.movie?.title,
          seatRow: enriched.seatRow,
          seatNumber: enriched.seatNumber
        },
        enriched.items,
        'Cinema Kitchen'
      ).catch((err) => console.warn('Realtime publish error in kitchen ready:', err));

      res.json({
        success: true,
        message: 'Order marked as ready for delivery',
        order: enriched
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/kitchen/orders/:orderId/deliver
 * Marks an order as DELIVERED to seat directly from the kitchen KDS console.
 * Specifically handles cinema theatres operating without dedicated delivery runner staff.
 * Authorized for owner, admin, kitchen, and staff roles.
 */
router.post(
  '/kitchen/orders/:orderId/deliver',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.orderId as string;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;
      const reason =
        (req.body?.notes as string) ||
        (req.body?.reason as string) ||
        'Order delivered to customer seat directly by cinema kitchen staff';

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, theatreId),
              eq(orders.orderType, 'cinema')
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        if (order.paymentStatus !== 'paid') {
          throw new AppError('Cannot mark unpaid order as delivered', 400);
        }

        if (order.status === 'delivered') {
          throw new AppError('Order is already marked as delivered', 400);
        }

        // Allow delivery directly from ready, assigned_for_delivery, preparing, or accepted
        const allowedStatuses: OrderStatus[] = ['ready', 'assigned_for_delivery', 'preparing', 'accepted'];
        if (!allowedStatuses.includes(order.status as OrderStatus)) {
          throw new AppError(
            `Invalid status transition: order must be in ready, preparing, accepted, or assigned status before delivery (current status: "${order.status}")`,
            400
          );
        }

        const now = new Date();
        const [saved] = await tx
          .update(orders)
          .set({
            status: 'delivered',
            deliveryStatus: 'delivered',
            deliveredAt: now,
            updatedAt: now
          })
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'delivered',
          changedByUserId: userId,
          changedByRole: userRole,
          reason
        });

        if (!saved) {
          throw new AppError('Failed to update cinema order to delivered', 500);
        }
        return saved;
      });

      const enrichedList = await enrichCinemaKitchenOrders(theatreId, [updatedOrder]);
      const enriched = enrichedList[0];
      if (!enriched) {
        throw new AppError('Failed to retrieve updated cinema order', 500);
      }

      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema',
          screenName: enriched.screen?.name,
          movieTitle: enriched.movie?.title,
          seatRow: enriched.seatRow,
          seatNumber: enriched.seatNumber
        },
        enriched.items,
        'Cinema Kitchen'
      ).catch((err) => console.warn('Realtime publish error in kitchen deliver:', err));

      res.json({
        success: true,
        message: 'Order marked as delivered successfully by kitchen staff',
        order: enriched
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/kitchen/orders/:orderId/status
 * Generic order status transition for cinema kitchen with state-machine & concurrency validation.
 */
router.patch(
  '/kitchen/orders/:orderId/status',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'kitchen', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.orderId as string;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;

      const { status: targetStatus, expectedCurrentStatus, reason } =
        updateOrderStatusSchema.parse(req.body);

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.restaurantId, theatreId),
              eq(orders.orderType, 'cinema')
            )
          )
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        const currentStatus = order.status as OrderStatus;

        // Concurrency check
        if (expectedCurrentStatus && currentStatus !== expectedCurrentStatus) {
          throw new AppError(
            `Order status conflict: the order is currently in status "${currentStatus}" (expected "${expectedCurrentStatus}"). Please refresh to see latest changes.`,
            409
          );
        }

        // Unpaid check for non-cancellation forward statuses
        if (order.paymentStatus !== 'paid' && targetStatus !== 'cancelled') {
          throw new AppError(
            `Cannot transition unpaid order to "${targetStatus}" (payment status: ${order.paymentStatus})`,
            400
          );
        }

        // Domain validation
        const check = validateStatusTransition(currentStatus, targetStatus, userRole);
        if (!check.valid) {
          const statusCode = check.errorCode === 'FORBIDDEN_ROLE' ? 403 : 400;
          throw new AppError(check.error || 'Invalid status transition', statusCode);
        }

        const updateFields: Partial<typeof orders.$inferInsert> = {
          status: targetStatus,
          updatedAt: new Date()
        };

        if (targetStatus === 'delivered' || targetStatus === 'served') {
          updateFields.deliveryStatus = 'delivered';
          updateFields.deliveredAt = new Date();
        }

        const [saved] = await tx
          .update(orders)
          .set(updateFields)
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          changedByUserId: userId,
          changedByRole: userRole,
          reason: reason || `Cinema kitchen transition to ${targetStatus}`
        });

        if (!saved) {
          throw new AppError('Failed to update cinema order', 500);
        }
        return saved;
      });

      const enrichedList = await enrichCinemaKitchenOrders(theatreId, [updatedOrder]);
      const enriched = enrichedList[0];
      if (!enriched) {
        throw new AppError('Failed to retrieve updated cinema order', 500);
      }

      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema',
          screenName: enriched.screen?.name,
          movieTitle: enriched.movie?.title,
          seatRow: enriched.seatRow,
          seatNumber: enriched.seatNumber
        },
        enriched.items,
        'Cinema Kitchen'
      ).catch((err) => console.warn('Realtime publish error in kitchen status update:', err));

      res.json({
        success: true,
        message: `Order transitioned to ${targetStatus}`,
        order: enriched
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// TASK 17: CINEMA ADMIN ORDER MANAGEMENT & MONITORING
// ===========================================================================

/**
 * GET /api/cinema/orders
 * Paginated cinema orders listing with multi-parameter filtering, search, and live summary stats.
 */
router.get(
  '/orders',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;

      // Pagination
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const offset = (page - 1) * limit;

      // Filters
      const dateFilter = (req.query.date as string | undefined)?.toLowerCase().trim();
      const startDateQuery = req.query.startDate as string | undefined;
      const endDateQuery = req.query.endDate as string | undefined;
      const screenIdFilter = (req.query.screenId as string | undefined)?.trim();
      const showIdFilter = (req.query.showId as string | undefined)?.trim();
      const movieIdFilter = (req.query.movieId as string | undefined)?.trim();
      const statusFilter = (req.query.status as string | undefined)?.toLowerCase().trim();
      const paymentStatusFilter = (req.query.paymentStatus as string | undefined)?.toLowerCase().trim();
      const deliveryStatusFilter = (req.query.deliveryStatus as string | undefined)?.toLowerCase().trim();
      const searchQuery = (req.query.search as string | undefined)?.trim();

      const conditions = [
        eq(orders.restaurantId, theatreId),
        eq(orders.orderType, 'cinema')
      ];

      // Date Filtering
      if (dateFilter) {
        const now = new Date();
        if (dateFilter === 'today') {
          const startOfToday = new Date(now);
          startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date(now);
          endOfToday.setHours(23, 59, 59, 999);
          conditions.push(and(gte(orders.createdAt, startOfToday), lte(orders.createdAt, endOfToday))!);
        } else if (dateFilter === 'yesterday') {
          const startOfYesterday = new Date(now);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          startOfYesterday.setHours(0, 0, 0, 0);
          const endOfYesterday = new Date(now);
          endOfYesterday.setDate(endOfYesterday.getDate() - 1);
          endOfYesterday.setHours(23, 59, 59, 999);
          conditions.push(and(gte(orders.createdAt, startOfYesterday), lte(orders.createdAt, endOfYesterday))!);
        } else if (dateFilter === '7d') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          conditions.push(gte(orders.createdAt, sevenDaysAgo));
        } else if (dateFilter === '30d') {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          thirtyDaysAgo.setHours(0, 0, 0, 0);
          conditions.push(gte(orders.createdAt, thirtyDaysAgo));
        }
      } else if (startDateQuery || endDateQuery) {
        if (startDateQuery) {
          const sDate = new Date(startDateQuery);
          if (!isNaN(sDate.getTime())) conditions.push(gte(orders.createdAt, sDate));
        }
        if (endDateQuery) {
          const eDate = new Date(endDateQuery);
          if (!isNaN(eDate.getTime())) conditions.push(lte(orders.createdAt, eDate));
        }
      }

      // Screen & Show & Movie filters
      if (screenIdFilter && screenIdFilter !== 'all') {
        conditions.push(eq(orders.screenId, screenIdFilter));
      }
      if (showIdFilter && showIdFilter !== 'all') {
        conditions.push(eq(orders.showId, showIdFilter));
      }
      if (movieIdFilter && movieIdFilter !== 'all') {
        conditions.push(eq(orders.movieId, movieIdFilter));
      }

      // Status filter
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'open') {
          conditions.push(inArray(orders.status, ['new', 'confirmed', 'accepted', 'preparing', 'ready', 'assigned_for_delivery']));
        } else if (statusFilter === 'completed') {
          conditions.push(inArray(orders.status, ['delivered', 'served']));
        } else if (statusFilter === 'cancelled') {
          conditions.push(inArray(orders.status, ['cancelled', 'rejected']));
        } else {
          conditions.push(eq(orders.status, statusFilter));
        }
      }

      // Payment status filter
      if (paymentStatusFilter && paymentStatusFilter !== 'all') {
        conditions.push(eq(orders.paymentStatus, paymentStatusFilter));
      }

      // Delivery status filter
      if (deliveryStatusFilter && deliveryStatusFilter !== 'all') {
        conditions.push(eq(orders.deliveryStatus, deliveryStatusFilter));
      }

      // Search query (order number, seat, customer, movie)
      if (searchQuery) {
        const searchPattern = `%${searchQuery}%`;
        conditions.push(
          or(
            ilike(orders.orderNumber, searchPattern),
            ilike(orders.customerName, searchPattern),
            ilike(orders.customerPhone, searchPattern),
            ilike(orders.seatRow, searchPattern),
            ilike(orders.seatNumber, searchPattern)
          )!
        );
      }

      // Fetch total count matching conditions
      const totalCountRows = await db
        .select({ value: count() })
        .from(orders)
        .where(and(...conditions));

      const totalOrders = Number(totalCountRows[0]?.value || 0);

      // Fetch paginated order records
      const orderRecords = await db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);

      // Enrich with joined screen, movie, show, items, status history
      const enrichedOrders = await enrichCinemaKitchenOrders(theatreId, orderRecords);

      // Compute Live Summary Stats for Admin Monitoring
      const allTheatreOrders = await db
        .select({
          id: orders.id,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          deliveryStatus: orders.deliveryStatus,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt
        })
        .from(orders)
        .where(and(eq(orders.restaurantId, theatreId), eq(orders.orderType, 'cinema')));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      let todaySalesPaise = 0;
      let newCount = 0;
      let preparingCount = 0;
      let readyCount = 0;
      let assignedCount = 0;
      let deliveredCount = 0;
      let cancelledCount = 0;

      for (const o of allTheatreOrders) {
        const orderDate = new Date(o.createdAt);
        const isToday = orderDate >= todayStart && orderDate <= todayEnd;

        if (isToday && o.paymentStatus === 'paid') {
          todaySalesPaise += o.totalAmount;
        }

        if (o.status === 'new' || o.status === 'confirmed') newCount++;
        else if (o.status === 'accepted' || o.status === 'preparing') preparingCount++;
        else if (o.status === 'ready') readyCount++;
        else if (o.status === 'assigned_for_delivery' || o.deliveryStatus === 'assigned') assignedCount++;
        else if (o.status === 'delivered' || o.status === 'served' || o.deliveryStatus === 'delivered') deliveredCount++;
        else if (o.status === 'cancelled' || o.status === 'rejected') cancelledCount++;
      }

      const totalPages = Math.ceil(totalOrders / limit) || 1;

      res.json({
        success: true,
        theatreId,
        orders: enrichedOrders,
        summary: {
          total: allTheatreOrders.length,
          todaySales: todaySalesPaise,
          newOrders: newCount,
          preparingOrders: preparingCount,
          readyOrders: readyCount,
          assignedOrders: assignedCount,
          deliveredOrders: deliveredCount,
          cancelledOrders: cancelledCount
        },
        pagination: {
          page,
          limit,
          total: totalOrders,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/orders/:id
 * Retrieves complete detailed order view including payment, refund, audit, and delivery context.
 */
router.get(
  '/orders/:id',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.id as string;

      const [orderRecord] = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.restaurantId, theatreId),
            eq(orders.orderType, 'cinema')
          )
        )
        .limit(1);

      if (!orderRecord) {
        throw new AppError('Cinema order not found or does not belong to this theatre', 404);
      }

      // Fetch joined entities concurrently
      const [
        items,
        history,
        screens,
        movies,
        shows,
        theatreProfile,
        transactions,
        refunds
      ] = await Promise.all([
        db.select().from(orderItems).where(eq(orderItems.orderId, orderRecord.id)),
        db
          .select()
          .from(orderStatusHistory)
          .where(eq(orderStatusHistory.orderId, orderRecord.id))
          .orderBy(desc(orderStatusHistory.createdAt)),
        orderRecord.screenId
          ? db.select().from(cinemaScreens).where(eq(cinemaScreens.id, orderRecord.screenId)).limit(1)
          : Promise.resolve([]),
        orderRecord.movieId
          ? db.select().from(cinemaMovies).where(eq(cinemaMovies.id, orderRecord.movieId)).limit(1)
          : Promise.resolve([]),
        orderRecord.showId
          ? db.select().from(cinemaShows).where(eq(cinemaShows.id, orderRecord.showId)).limit(1)
          : Promise.resolve([]),
        db.select().from(cinemaProfiles).where(eq(cinemaProfiles.theatreId, theatreId)).limit(1),
        db
          .select({
            id: cinemaPaymentTransactions.id,
            provider: cinemaPaymentTransactions.provider,
            providerOrderId: cinemaPaymentTransactions.providerOrderId,
            providerPaymentId: cinemaPaymentTransactions.providerPaymentId,
            amount: cinemaPaymentTransactions.amount,
            currency: cinemaPaymentTransactions.currency,
            status: cinemaPaymentTransactions.status,
            refundStatus: cinemaPaymentTransactions.refundStatus,
            refundAmount: cinemaPaymentTransactions.refundAmount,
            createdAt: cinemaPaymentTransactions.createdAt,
            updatedAt: cinemaPaymentTransactions.updatedAt
          })
          .from(cinemaPaymentTransactions)
          .where(eq(cinemaPaymentTransactions.orderId, orderRecord.id)),
        db
          .select({
            id: cinemaRefunds.id,
            transactionId: cinemaRefunds.transactionId,
            provider: cinemaRefunds.provider,
            providerRefundId: cinemaRefunds.providerRefundId,
            amount: cinemaRefunds.amount,
            reason: cinemaRefunds.reason,
            status: cinemaRefunds.status,
            initiatedBy: cinemaRefunds.initiatedBy,
            createdAt: cinemaRefunds.createdAt
          })
          .from(cinemaRefunds)
          .where(eq(cinemaRefunds.orderId, orderRecord.id))
      ]);

      const screen = screens[0] || null;
      const movie = movies[0] || null;
      const show = shows[0] || null;
      const profile = theatreProfile[0] || null;

      let formattedShowtime = orderRecord.showtime || null;
      if (!formattedShowtime && show?.startTime) {
        formattedShowtime = show.startTime.toISOString().substring(11, 19);
      }

      res.json({
        success: true,
        order: {
          id: orderRecord.id,
          orderNumber: orderRecord.orderNumber,
          theatreId: orderRecord.restaurantId,
          orderType: orderRecord.orderType,
          status: orderRecord.status,
          paymentStatus: orderRecord.paymentStatus,
          paymentMethod: orderRecord.paymentMethod,
          paymentReference: orderRecord.paymentReference,
          subtotal: orderRecord.subtotal,
          taxAmount: orderRecord.taxAmount,
          totalAmount: orderRecord.totalAmount,
          specialInstructions: orderRecord.specialInstructions,
          customerName: orderRecord.customerName,
          customerPhone: orderRecord.customerPhone,
          statusToken: orderRecord.statusToken,
          createdAt: orderRecord.createdAt,
          updatedAt: orderRecord.updatedAt,
          theatre: {
            id: theatreId,
            name: profile?.theatreName || req.tenant!.restaurant.name,
            address: profile?.address || null,
            city: profile?.city || null,
            state: profile?.state || null,
            contactNumber: profile?.contactNumber || null,
            currency: req.tenant!.restaurant.currency
          },
          screen: screen
            ? {
                id: screen.id,
                name: screen.screenName,
                screenName: screen.screenName,
                screenNumber: screen.screenName,
                screenType: screen.screenType
              }
            : null,
          movie: movie
            ? {
                id: movie.id,
                title: movie.title,
                language: movie.language,
                posterUrl: movie.posterUrl,
                durationMinutes: movie.durationMinutes
              }
            : null,
          show: show
            ? {
                id: show.id,
                showDate: show.showDate,
                startTime: show.startTime,
                expectedEndTime: show.expectedEndTime,
                status: show.status
              }
            : null,
          showDate: orderRecord.showDate || show?.showDate || null,
          showtime: formattedShowtime,
          seatRow: orderRecord.seatRow,
          seatNumber: orderRecord.seatNumber,
          seat: {
            row: orderRecord.seatRow,
            seatNumber: orderRecord.seatNumber
          },
          delivery: {
            deliveryStaffId: orderRecord.deliveryStaffId,
            deliveryStaffName: orderRecord.deliveryStaffName,
            deliveryStatus: orderRecord.deliveryStatus || 'unassigned',
            assignedAt: orderRecord.assignedAt,
            deliveredAt: orderRecord.deliveredAt
          },
          items: items.map((it) => ({
            id: it.id,
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: it.subtotal,
            notes: it.notes
          })),
          statusHistory: history.map((h) => ({
            id: h.id,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            changedByUserId: h.changedByUserId,
            changedByRole: h.changedByRole,
            reason: h.reason,
            createdAt: h.createdAt
          })),
          paymentTransaction: transactions[0]
            ? {
                id: transactions[0].id,
                provider: transactions[0].provider,
                providerOrderId: transactions[0].providerOrderId,
                providerPaymentId: transactions[0].providerPaymentId,
                amount: transactions[0].amount,
                currency: transactions[0].currency,
                status: transactions[0].status,
                refundStatus: transactions[0].refundStatus,
                refundAmount: transactions[0].refundAmount,
                createdAt: transactions[0].createdAt
              }
            : null,
          payment: {
            method: orderRecord.paymentMethod,
            status: orderRecord.paymentStatus,
            reference: orderRecord.paymentReference,
            transactions: transactions.map((tx) => ({
              id: tx.id,
              provider: tx.provider,
              amount: tx.amount,
              currency: tx.currency,
              status: tx.status,
              providerPaymentId: tx.providerPaymentId,
              providerOrderId: tx.providerOrderId,
              refundStatus: tx.refundStatus,
              refundAmount: tx.refundAmount,
              createdAt: tx.createdAt
            }))
          },
          refunds: refunds.map((r) => ({
            id: r.id,
            amount: r.amount,
            reason: r.reason,
            status: r.status,
            provider: r.provider,
            providerRefundId: r.providerRefundId,
            initiatedBy: r.initiatedBy,
            createdAt: r.createdAt
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/orders/:id/history
 * Returns the chronological audit history for a cinema order.
 */
router.get(
  '/orders/:id/history',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.id as string;

      const [orderRecord] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.restaurantId, theatreId), eq(orders.orderType, 'cinema')))
        .limit(1);

      if (!orderRecord) {
        throw new AppError('Cinema order not found or does not belong to this theatre', 404);
      }

      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderRecord.id))
        .orderBy(desc(orderStatusHistory.createdAt));

      res.json({
        success: true,
        orderId,
        history
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/cinema/orders/:id/status
 * Administrative correction and status progression with full audit logging.
 */
router.patch(
  '/orders/:id/status',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.id as string;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;

      const {
        status: bodyStatus,
        targetStatus: bodyTargetStatus,
        toStatus,
        expectedCurrentStatus,
        reason,
        deliveryStaffId,
        deliveryStaffName
      } = req.body;

      const targetStatus = bodyTargetStatus || bodyStatus || toStatus;

      if (!targetStatus) {
        throw new AppError('Target status is required', 400);
      }

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.restaurantId, theatreId), eq(orders.orderType, 'cinema')))
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        const currentStatus = order.status as OrderStatus;

        // Concurrency guard
        if (expectedCurrentStatus && currentStatus !== expectedCurrentStatus) {
          throw new AppError(
            `Order status conflict: currently in status "${currentStatus}" (expected "${expectedCurrentStatus}").`,
            409
          );
        }

        // Domain validation
        const check = validateStatusTransition(currentStatus, targetStatus as OrderStatus, userRole);
        if (!check.valid) {
          const statusCode = check.errorCode === 'FORBIDDEN_ROLE' ? 403 : 400;
          throw new AppError(check.error || 'Invalid status transition', statusCode);
        }

        // Prepare fields to update
        const updateData: Partial<typeof orders.$inferInsert> = {
          status: targetStatus,
          updatedAt: new Date()
        };

        if (targetStatus === 'assigned_for_delivery') {
          updateData.deliveryStatus = 'assigned';
          updateData.assignedAt = new Date();
          if (deliveryStaffId) updateData.deliveryStaffId = deliveryStaffId;
          if (deliveryStaffName) updateData.deliveryStaffName = deliveryStaffName;
        } else if (targetStatus === 'delivered' || targetStatus === 'served') {
          updateData.deliveryStatus = 'delivered';
          updateData.deliveredAt = new Date();
        }

        const [saved] = await tx
          .update(orders)
          .set(updateData)
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          changedByUserId: userId,
          changedByRole: userRole,
          reason: reason || `Administrative status change to ${targetStatus}`
        });

        if (!saved) {
          throw new AppError('Failed to update cinema order status', 500);
        }
        return saved;
      });

      const enrichedList = await enrichCinemaKitchenOrders(theatreId, [updatedOrder]);
      const enriched = enrichedList[0];

      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema',
          screenName: enriched?.screen?.name,
          movieTitle: enriched?.movie?.title,
          seatRow: enriched?.seatRow,
          seatNumber: enriched?.seatNumber
        },
        enriched?.items || [],
        'Cinema Admin Console'
      ).catch((err) => console.warn('Realtime publish error in admin order update:', err));

      res.json({
        success: true,
        message: `Order successfully transitioned to ${targetStatus}`,
        order: enriched || updatedOrder
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/orders/:id/cancel
 * Administrative cancellation / voiding of a cinema order with mandatory audit reason.
 */
router.post(
  '/orders/:id/cancel',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const orderId = req.params.id as string;
      const userRole = req.tenant!.role;
      const userId = req.user?.id || null;
      const reason = req.body?.reason?.trim();

      if (!reason) {
        throw new AppError('A valid reason is required for administrative cancellation', 400);
      }

      const updatedOrder = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.restaurantId, theatreId), eq(orders.orderType, 'cinema')))
          .for('update')
          .limit(1);

        if (!order) {
          throw new AppError('Cinema order not found or does not belong to this theatre', 404);
        }

        const currentStatus = order.status as OrderStatus;

        if (isTerminalOrderStatus(currentStatus)) {
          throw new AppError(`Cannot cancel order in terminal state "${currentStatus}"`, 400);
        }

        const [saved] = await tx
          .update(orders)
          .set({
            status: 'cancelled',
            updatedAt: new Date()
          })
          .where(eq(orders.id, order.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: currentStatus,
          toStatus: 'cancelled',
          changedByUserId: userId,
          changedByRole: userRole,
          reason
        });

        if (!saved) {
          throw new AppError('Failed to cancel cinema order', 500);
        }
        return saved;
      });

      const enrichedList = await enrichCinemaKitchenOrders(theatreId, [updatedOrder]);
      const enriched = enrichedList[0];

      await publishOrderUpdated(
        theatreId,
        {
          ...updatedOrder,
          orderType: 'cinema',
          screenName: enriched?.screen?.name,
          movieTitle: enriched?.movie?.title,
          seatRow: enriched?.seatRow,
          seatNumber: enriched?.seatNumber
        },
        enriched?.items || [],
        'Cinema Admin Console'
      ).catch((err) => console.warn('Realtime publish error in admin cancel order:', err));

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        order: enriched || updatedOrder
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;





