import { Router, Request, Response } from 'express';
import { db, restaurantDb, getDb, restaurants, restaurantMembers, categories, products, restaurantTables, user } from '@menugo/database';
import { eq, and, asc, ne } from 'drizzle-orm';
import { createRestaurantSchema, updateRestaurantSchema } from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { syncSingleVenueToQros } from '../lib/qros-sync-service';
import { cinemaApiClient } from '../lib/internal-api-client';
import { trackMenuBrowseUsage } from '../lib/usage-tracking-service';
import crypto from 'crypto';

const router = Router();

// Create new restaurant (Authenticated owner onboarding, executed transactionally)
router.post('/', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const validatedData = createRestaurantSchema.parse(req.body);

    // Verify caller is not a cinema theatre user
    const [callingUser] = await db
      .select({ tenantType: user.tenantType })
      .from(user)
      .where(eq(user.id, req.user!.id))
      .limit(1);

    if (callingUser?.tenantType === 'cinema') {
      throw new AppError(
        'Theatre accounts cannot create or manage restaurant profiles. Please create a dedicated restaurant account.',
        403
      );
    }

    const result = await db.transaction(async (tx) => {
      // 1. Check slug uniqueness within transaction
      const [existing] = await tx
        .select({ id: restaurants.id })
        .from(restaurants)
        .where(eq(restaurants.slug, validatedData.slug))
        .limit(1);

      if (existing) {
        throw new AppError('Restaurant with this slug already exists. Please choose a different slug.', 409);
      }

      const restaurantId = crypto.randomUUID();

      // 2. Insert restaurant record
      const [restaurant] = await tx
        .insert(restaurants)
        .values({
          id: restaurantId,
          name: validatedData.name,
          slug: validatedData.slug,
          phone: validatedData.phone || null,
          email: validatedData.email || null,
          address: validatedData.address || null,
          logoKey: validatedData.logoKey || null,
          logoUrl: validatedData.logoUrl || null,
          coverImageKey: validatedData.coverImageKey || null,
          coverImageUrl: validatedData.coverImageUrl || null,
          currency: validatedData.currency || 'INR',
          tenantType: validatedData.tenantType || 'restaurant',
          isActive: validatedData.isActive ?? true,
          settings: validatedData.settings || {}
        })
        .returning();

      // 3. Assign creating user as owner in restaurant_members transactionally
      // Guaranteed to bind to req.user!.id (cannot create on behalf of other users)
      const [membership] = await tx
        .insert(restaurantMembers)
        .values({
          id: crypto.randomUUID(),
          restaurantId,
          userId: req.user!.id,
          role: 'owner'
        })
        .returning();

      // 4. Ensure user is stamped as restaurant tenant
      await tx
        .update(user)
        .set({ tenantType: 'restaurant' })
        .where(eq(user.id, req.user!.id));

      return { restaurant, membership };
    });

    // Mirror newly onboarded restaurant to central QROS master DB
    syncSingleVenueToQros({
      ...result.restaurant,
      tenantType: 'restaurant'
    }).catch(() => {});

    res.status(201).json({
      message: 'Restaurant created successfully',
      restaurant: result.restaurant,
      membership: result.membership
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      next(new AppError('Restaurant with this slug already exists. Please choose a different slug.', 409));
      return;
    }
    next(error);
  }
});

// Get all restaurants/theatres for current logged-in user (supports ?tenantType=restaurant|cinema)
router.get('/my', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const requestedType = (req.query.tenantType || req.query.type) as string | undefined;

    // Check user tenantType
    const [callingUser] = await db
      .select({ tenantType: user.tenantType })
      .from(user)
      .where(eq(user.id, req.user!.id))
      .limit(1);

    const userTenantType = callingUser?.tenantType || req.user?.tenantType;

    // Enforce tenant boundary:
    // If account is theatre/cinema, it cannot query or receive restaurant memberships
    if (userTenantType === 'cinema' && requestedType === 'restaurant') {
      return res.json([]);
    }
    // If account is restaurant, it cannot query or receive cinema memberships
    if (userTenantType === 'restaurant' && requestedType === 'cinema') {
      return res.json([]);
    }

    const effectiveType = requestedType || (userTenantType === 'cinema' ? 'cinema' : 'restaurant');
    const targetDb = getDb(effectiveType);

    const query = targetDb
      .select({
        membershipId: restaurantMembers.id,
        role: restaurantMembers.role,
        restaurant: restaurants
      })
      .from(restaurantMembers)
      .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
      .where(
        and(
          eq(restaurantMembers.userId, req.user!.id),
          eq(restaurants.tenantType, effectiveType)
        )
      );

    const userMemberships = await query;
    res.json(userMemberships);
  } catch (error) {
    next(error);
  }
});

// Public endpoint: Get restaurant menu by slug (for customer digital menu)
router.get('/by-slug/:slug', async (req: Request, res: Response, next) => {
  try {
    const slug = req.params.slug as string;

    let [restaurant] = await restaurantDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        phone: restaurants.phone,
        email: restaurants.email,
        address: restaurants.address,
        logoUrl: restaurants.logoUrl,
        coverImageUrl: restaurants.coverImageUrl,
        currency: restaurants.currency,
        tenantType: restaurants.tenantType,
        settings: restaurants.settings
      })
      .from(restaurants)
      .where(and(eq(restaurants.slug, slug), eq(restaurants.isActive, true)))
      .limit(1);

    if (!restaurant) {
      // Cross-domain check: If slug belongs to a cinema theatre, resolve via Cinema Backend API
      const cinemaMatch = await cinemaApiClient.getTheatreBySlug(slug).catch(() => null);
      if (cinemaMatch?.venue) {
        return res.json({
          isCinema: true,
          theatreToken: cinemaMatch.theatreToken,
          restaurant: {
            id: cinemaMatch.venue.id,
            name: cinemaMatch.venue.name,
            slug: cinemaMatch.venue.slug,
            tenantType: 'cinema'
          },
          categories: []
        });
      }

      throw new AppError('Restaurant not found or inactive', 404);
    }

    // Fetch active categories (only customer-safe fields)
    const activeCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        description: categories.description,
        sortOrder: categories.sortOrder
      })
      .from(categories)
      .where(and(eq(categories.restaurantId, restaurant.id), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder));

    // Fetch available products (only customer-safe fields)
    const availableProducts = await db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        name: products.name,
        description: products.description,
        price: products.price,
        imageUrl: products.imageUrl,
        isVegetarian: products.isVegetarian,
        isAvailable: products.isAvailable,
        sortOrder: products.sortOrder
      })
      .from(products)
      .where(and(eq(products.restaurantId, restaurant.id), eq(products.isAvailable, true)))
      .orderBy(asc(products.sortOrder));

    // Filter out products assigned to inactive categories
    const activeCategoryIds = new Set(activeCategories.map((c) => c.id));
    const publicProducts = availableProducts.filter(
      (p) => !p.categoryId || activeCategoryIds.has(p.categoryId)
    );

    res.json({
      restaurant,
      categories: activeCategories,
      products: publicProducts
    });

    // Track metered infrastructure usage for active customer menu browsing
    trackMenuBrowseUsage({
      restaurantId: restaurant.id,
      tenantType: 'restaurant',
      action: 'view'
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// Public endpoint: Get customer-facing public profile (exposes only customer-safe fields)
router.get('/public/:slug', async (req: Request, res: Response, next) => {
  try {
    const slug = req.params.slug as string;

    const [restaurant] = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        phone: restaurants.phone,
        email: restaurants.email,
        address: restaurants.address,
        logoUrl: restaurants.logoUrl,
        coverImageUrl: restaurants.coverImageUrl,
        currency: restaurants.currency,
        tenantType: restaurants.tenantType,
        settings: restaurants.settings
      })
      .from(restaurants)
      .where(and(eq(restaurants.slug, slug), eq(restaurants.isActive, true)))
      .limit(1);

    if (!restaurant || restaurant.tenantType === 'cinema') {
      const cinemaMatch = await cinemaApiClient.getTheatreBySlug(slug).catch(() => null);
      if (cinemaMatch?.venue) {
        return res.json({
          isCinema: true,
          theatreToken: cinemaMatch.theatreToken,
          restaurant: {
            id: cinemaMatch.venue.id,
            name: cinemaMatch.venue.name,
            slug: cinemaMatch.venue.slug,
            tenantType: 'cinema'
          },
          categories: [],
          products: []
        });
      }

      if (!restaurant) {
        throw new AppError('Restaurant not found or inactive', 404);
      }
    }

    res.json({ restaurant });
  } catch (error) {
    next(error);
  }
});

// Get restaurant admin details by ID
router.get('/:restaurantId', requireTenant(), async (req: Request, res: Response, next) => {
  try {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, req.tenant!.restaurantId))
      .limit(1);

    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    res.json({ restaurant, userRole: req.tenant!.role, permissions: req.tenant!.permissions });
  } catch (error) {
    next(error);
  }
});

// Update restaurant profile (owner or admin only)
router.patch(
  '/:restaurantId',
  requireTenant(['owner', 'admin']),
  async (req: Request, res: Response, next) => {
    try {
      const validatedData = updateRestaurantSchema.parse(req.body);

      // If updating slug, check whether it conflicts with another restaurant
      if (validatedData.slug) {
        const [conflict] = await db
          .select({ id: restaurants.id })
          .from(restaurants)
          .where(
            and(
              eq(restaurants.slug, validatedData.slug),
              ne(restaurants.id, req.tenant!.restaurantId)
            )
          )
          .limit(1);

        if (conflict) {
          throw new AppError('This URL slug is already taken by another restaurant. Please choose a different slug.', 409);
        }
      }

      const [updated] = await db
        .update(restaurants)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(restaurants.id, req.tenant!.restaurantId))
        .returning();

      res.json({
        message: 'Restaurant profile updated successfully',
        restaurant: updated
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        next(new AppError('This URL slug is already taken by another restaurant. Please choose a different slug.', 409));
        return;
      }
      next(error);
    }
  }
);

export default router;

