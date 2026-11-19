import { Router, Request, Response } from 'express';
import { getDb, categories, products } from '@menugo/database';
import { eq, and, asc, ne, sql, count } from 'drizzle-orm';
import { createCategorySchema, updateCategorySchema, reorderCategoriesSchema } from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import crypto from 'crypto';

const router = Router();

// Apply authentication and tenant membership authorization to all category management endpoints
router.use(requireAuth);
router.use(requireTenant(['owner', 'admin', 'staff', 'kitchen']));

// List categories for the authenticated restaurant
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const restaurantId = req.tenant!.restaurantId;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    const items = await targetDb
      .select()
      .from(categories)
      .where(eq(categories.restaurantId, restaurantId))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Reorder categories (owner or admin only) - defined before /:id route
router.put('/reorder', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can reorder categories', 403);
    }

    const { items } = reorderCategoriesSchema.parse(req.body);
    const restaurantId = req.tenant!.restaurantId;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    await targetDb.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(categories)
          .set({
            sortOrder: item.sortOrder,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(categories.id, item.id),
              eq(categories.restaurantId, restaurantId) // IDOR protection
            )
          );
      }
    });

    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    next(error);
  }
});

// Get single category by ID
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const categoryId = req.params.id as string;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    const [category] = await targetDb
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.restaurantId, req.tenant!.restaurantId)
        )
      )
      .limit(1);

    if (!category) {
      throw new AppError('Category not found or does not belong to this restaurant', 404);
    }

    res.json(category);
  } catch (error) {
    next(error);
  }
});

// Create category (owner or admin only, prevents duplicate names)
router.post('/', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can create categories', 403);
    }

    const validatedData = createCategorySchema.parse({
      ...req.body,
      restaurantId: req.tenant!.restaurantId
    });

    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    // Check duplicate name within this restaurant (case-insensitive)
    const [existing] = await targetDb
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.restaurantId, req.tenant!.restaurantId),
          sql`lower(${categories.name}) = lower(${validatedData.name})`
        )
      )
      .limit(1);

    if (existing) {
      throw new AppError('Category with this name already exists in this restaurant', 409);
    }

    const categoryId = crypto.randomUUID();

    const [category] = await targetDb
      .insert(categories)
      .values({
        id: categoryId,
        restaurantId: req.tenant!.restaurantId,
        name: validatedData.name,
        description: validatedData.description || null,
        sortOrder: validatedData.sortOrder,
        isActive: validatedData.isActive
      })
      .returning();

    res.status(201).json(category);
  } catch (error: any) {
    if (error?.code === '23505') {
      next(new AppError('Category with this name already exists in this restaurant', 409));
      return;
    }
    next(error);
  }
});

// Update category (owner or admin only, strictly scoped by restaurantId to prevent IDOR)
router.patch('/:id', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can update categories', 403);
    }

    const categoryId = req.params.id as string;
    const validatedData = updateCategorySchema.parse(req.body);
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    // If name is updated, check for duplicate within restaurant
    if (validatedData.name) {
      const [existing] = await targetDb
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.restaurantId, req.tenant!.restaurantId),
            sql`lower(${categories.name}) = lower(${validatedData.name})`,
            ne(categories.id, categoryId)
          )
        )
        .limit(1);

      if (existing) {
        throw new AppError('Category with this name already exists in this restaurant', 409);
      }
    }

    const [category] = await targetDb
      .update(categories)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .returning();

    if (!category) {
      throw new AppError('Category not found or does not belong to this restaurant', 404);
    }

    res.json(category);
  } catch (error: any) {
    if (error?.code === '23505') {
      next(new AppError('Category with this name already exists in this restaurant', 409));
      return;
    }
    next(error);
  }
});

// Delete category (owner or admin only, blocks deletion if products are attached)
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can delete categories', 403);
    }

    const categoryId = req.params.id as string;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    // Verify category exists and belongs to this restaurant
    const [category] = await targetDb
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.restaurantId, req.tenant!.restaurantId)
        )
      )
      .limit(1);

    if (!category) {
      throw new AppError('Category not found or does not belong to this restaurant', 404);
    }

    // Safety rule: Count products assigned to this category
    const [productCountResult] = await targetDb
      .select({ count: count() })
      .from(products)
      .where(
        and(
          eq(products.categoryId, categoryId),
          eq(products.restaurantId, req.tenant!.restaurantId)
        )
      );

    const productCount = Number(productCountResult?.count || 0);
    if (productCount > 0) {
      throw new AppError(
        `Cannot delete category "${category.name}": It contains ${productCount} product${productCount > 1 ? 's' : ''}. Please reassign or delete the products first.`,
        409
      );
    }

    // Proceed to delete if 0 products attached
    const [deleted] = await targetDb
      .delete(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .returning();

    if (!deleted) {
      throw new AppError('Category not found or does not belong to this restaurant', 404);
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
