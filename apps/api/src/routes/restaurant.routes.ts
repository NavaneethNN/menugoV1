import { Router, Request, Response } from 'express';
import { db, restaurants, restaurantMembers, categories, products, restaurantTables } from '@menugo/database';
import { eq, and, asc, ne } from 'drizzle-orm';
import { createRestaurantSchema, updateRestaurantSchema } from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import crypto from 'crypto';

const router = Router();

// Create new restaurant (Authenticated owner onboarding, executed transactionally)
router.post('/', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const validatedData = createRestaurantSchema.parse(req.body);

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

      return { restaurant, membership };
    });

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

// Get all restaurants for current logged-in user
router.get('/my', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const userMemberships = await db
      .select({
        membershipId: restaurantMembers.id,
        role: restaurantMembers.role,
        restaurant: restaurants
      })
      .from(restaurantMembers)
      .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
      .where(eq(restaurantMembers.userId, req.user!.id));

    res.json(userMemberships);
  } catch (error) {
    next(error);
  }
});

// Public endpoint: Get restaurant menu by slug (for customer digital menu)
router.get('/by-slug/:slug', async (req: Request, res: Response, next) => {
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
        settings: restaurants.settings
      })
      .from(restaurants)
      .where(and(eq(restaurants.slug, slug), eq(restaurants.isActive, true)))
      .limit(1);

    if (!restaurant) {
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
        settings: restaurants.settings
      })
      .from(restaurants)
      .where(and(eq(restaurants.slug, slug), eq(restaurants.isActive, true)))
      .limit(1);

    if (!restaurant) {
      throw new AppError('Restaurant not found or inactive', 404);
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

