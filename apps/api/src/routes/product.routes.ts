import { Router, Request, Response } from 'express';
import { getDb, products, categories } from '@menugo/database';
import { eq, and, asc, sql } from 'drizzle-orm';
import { createProductSchema, updateProductSchema, reorderProductsSchema } from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { safeDeleteR2Object } from '../lib/r2';
import crypto from 'crypto';

const router = Router();

// Validate image key does not reference another tenant's files
function validateImageKeyBelongsToTenant(imageKey: string | null | undefined, restaurantId: string) {
  if (!imageKey) return;
  const parts = imageKey.split('/');
  if (parts.length > 1) {
    const root = parts[0] === 'restaurants' ? parts[1] : parts[0];
    if (root && root !== restaurantId && /^[0-9a-fA-F-]{36}$/.test(root)) {
      throw new AppError('Image does not belong to this restaurant', 403);
    }
  }
}

// Apply authentication and tenant authorization to all internal product management
router.use(requireAuth);
router.use(requireTenant(['owner', 'admin', 'staff', 'kitchen']));

// List products for the authenticated restaurant (optional category filter)
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const restaurantId = req.tenant!.restaurantId;
    const categoryId = req.query.categoryId as string | undefined;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    const items = await targetDb
      .select({
        id: products.id,
        restaurantId: products.restaurantId,
        categoryId: products.categoryId,
        categoryName: categories.name,
        name: products.name,
        description: products.description,
        price: products.price,
        imageKey: products.imageKey,
        imageUrl: products.imageUrl,
        isAvailable: products.isAvailable,
        isVegetarian: products.isVegetarian,
        sortOrder: products.sortOrder,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        categoryId
          ? and(eq(products.restaurantId, restaurantId), eq(products.categoryId, categoryId))
          : eq(products.restaurantId, restaurantId)
      )
      .orderBy(asc(products.sortOrder), asc(products.createdAt));

    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Reorder products (owner or admin only, strictly scoped by restaurantId)
router.put('/reorder', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can reorder products', 403);
    }

    const { items } = reorderProductsSchema.parse(req.body);
    const restaurantId = req.tenant!.restaurantId;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    await targetDb.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(products)
          .set({
            sortOrder: item.sortOrder,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(products.id, item.id),
              eq(products.restaurantId, restaurantId) // IDOR protection
            )
          );
      }
    });

    res.json({ message: 'Products reordered successfully' });
  } catch (error) {
    next(error);
  }
});

// Get single product (strictly scoped to restaurant)
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const productId = req.params.id as string;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    const [product] = await targetDb
      .select({
        id: products.id,
        restaurantId: products.restaurantId,
        categoryId: products.categoryId,
        categoryName: categories.name,
        name: products.name,
        description: products.description,
        price: products.price,
        imageKey: products.imageKey,
        imageUrl: products.imageUrl,
        isAvailable: products.isAvailable,
        isVegetarian: products.isVegetarian,
        sortOrder: products.sortOrder,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.id, productId),
          eq(products.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .limit(1);

    if (!product) {
      throw new AppError('Product not found or does not belong to this restaurant', 404);
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Create product (owner or admin only)
router.post('/', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can add menu products', 403);
    }

    const validatedData = createProductSchema.parse({
      ...req.body,
      restaurantId: req.tenant!.restaurantId
    });

    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');
    const targetCategoryId = validatedData.categoryId?.trim() || null;

    // Verify category exists and belongs to the same restaurant
    if (targetCategoryId) {
      const [category] = await targetDb
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, targetCategoryId),
            eq(categories.restaurantId, req.tenant!.restaurantId)
          )
        )
        .limit(1);

      if (!category) {
        throw new AppError('Selected category does not exist or does not belong to this restaurant', 400);
      }
    }

    // Verify imageKey ownership if provided
    if (validatedData.imageKey) {
      validateImageKeyBelongsToTenant(validatedData.imageKey, req.tenant!.restaurantId);
    }

    // Auto-compute next sortOrder if not explicitly specified
    let sortOrder = validatedData.sortOrder;
    if (req.body.sortOrder === undefined) {
      const [maxOrder] = await targetDb
        .select({ max: sql<number>`coalesce(max(${products.sortOrder}), -1)` })
        .from(products)
        .where(eq(products.restaurantId, req.tenant!.restaurantId));
      sortOrder = Number(maxOrder?.max ?? -1) + 1;
    }

    const productId = crypto.randomUUID();

    const [product] = await targetDb
      .insert(products)
      .values({
        id: productId,
        restaurantId: req.tenant!.restaurantId,
        categoryId: targetCategoryId,
        name: validatedData.name,
        description: validatedData.description || null,
        price: validatedData.price,
        imageKey: validatedData.imageKey || null,
        imageUrl: validatedData.imageUrl || null,
        isAvailable: validatedData.isAvailable,
        isVegetarian: validatedData.isVegetarian,
        sortOrder
      })
      .returning();

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// Update product (owner or admin only, strictly scoped by restaurantId to prevent IDOR)
router.patch('/:id', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can edit menu products', 403);
    }

    const productId = req.params.id as string;
    const validatedData = updateProductSchema.parse(req.body);
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    // Fetch existing product imageKey to support safe replacement cleanup
    const [existingProduct] = await targetDb
      .select({ imageKey: products.imageKey })
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.restaurantId, req.tenant!.restaurantId)
        )
      );

    if (!existingProduct) {
      throw new AppError('Product not found or does not belong to this restaurant', 404);
    }

    // Verify category ownership if categoryId is being updated
    if (validatedData.categoryId !== undefined) {
      const targetCategoryId = validatedData.categoryId?.trim() || null;
      if (targetCategoryId) {
        const [category] = await targetDb
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.id, targetCategoryId),
              eq(categories.restaurantId, req.tenant!.restaurantId)
            )
          )
          .limit(1);

        if (!category) {
          throw new AppError('Selected category does not exist or does not belong to this restaurant', 400);
        }
      }
    }

    // Verify imageKey ownership if provided
    if (validatedData.imageKey) {
      validateImageKeyBelongsToTenant(validatedData.imageKey, req.tenant!.restaurantId);
    }

    const updatePayload: any = {
      ...validatedData,
      updatedAt: new Date()
    };

    if (validatedData.categoryId === '') {
      updatePayload.categoryId = null;
    }

    const [product] = await targetDb
      .update(products)
      .set(updatePayload)
      .where(
        and(
          eq(products.id, productId),
          eq(products.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .returning();

    if (!product) {
      throw new AppError('Product not found or does not belong to this restaurant', 404);
    }

    // Safe image replacement: if imageKey changed, safely delete old image if no other record references it
    if (
      existingProduct.imageKey &&
      validatedData.imageKey !== undefined &&
      existingProduct.imageKey !== validatedData.imageKey
    ) {
      safeDeleteR2Object(existingProduct.imageKey, req.tenant!.restaurantId, 0).catch((err) => {
        console.error('Failed to cleanup old R2 image on product update:', err);
      });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Quick toggle availability (allowed for kitchen & staff too, strictly scoped by restaurantId)
router.patch('/:id/availability', async (req: Request, res: Response, next) => {
  try {
    const productId = req.params.id as string;
    const { isAvailable } = req.body;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    if (typeof isAvailable !== 'boolean') {
      throw new AppError('isAvailable boolean is required', 400);
    }

    const [product] = await targetDb
      .update(products)
      .set({
        isAvailable,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .returning();

    if (!product) {
      throw new AppError('Product not found or does not belong to this restaurant', 404);
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Delete product (owner or admin only, strictly scoped by restaurantId to prevent IDOR)
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    if (!req.tenant!.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can delete menu products', 403);
    }

    const productId = req.params.id as string;
    const targetDb = getDb(req.tenant?.restaurant?.tenantType || 'restaurant');

    const [deleted] = await targetDb
      .delete(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.restaurantId, req.tenant!.restaurantId) // IDOR protection
        )
      )
      .returning();

    if (!deleted) {
      throw new AppError('Product not found or does not belong to this restaurant', 404);
    }

    // Safe R2 image deletion: only delete image if no other record references it
    if (deleted.imageKey) {
      safeDeleteR2Object(deleted.imageKey, req.tenant!.restaurantId, 0).catch((err) => {
        console.error('Failed to cleanup R2 image on product deletion:', err);
      });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
