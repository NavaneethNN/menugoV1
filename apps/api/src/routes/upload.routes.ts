import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { uploadRateLimiter } from '../middleware/rate-limiter';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE,
  AllowedImageMimeType,
  isValidImageMimeType,
  generatePresignedUploadUrl,
  uploadBufferToR2,
  safeDeleteR2Object
} from '../lib/r2';

const router = Router();

// Multer in-memory storage for direct uploads with 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE
  }
});

// Require authentication and tenant authorization
router.use(requireAuth);
router.use(requireTenant(['owner', 'admin']));

// Input validation schema for presigned URL requests
const presignedUrlRequestSchema = z.object({
  fileType: z.string().refine(isValidImageMimeType, {
    message: `Unsupported file type. Allowed formats: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`
  }),
  purpose: z.enum(['products', 'restaurants']).default('products'),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_IMAGE_FILE_SIZE, `File size exceeds maximum allowed limit of 5 MB`)
    .optional(),
  fileName: z.string().max(255).optional()
});

/**
 * POST /api/uploads/presigned-url
 * Issues a short-lived presigned PUT URL for direct browser-to-R2 upload.
 */
router.post('/presigned-url', uploadRateLimiter, async (req: Request, res: Response, next) => {
  try {
    const tenant = req.tenant!;
    const validated = presignedUrlRequestSchema.parse(req.body);

    // Permission check based on purpose
    if (validated.purpose === 'products' && !tenant.permissions.canManageMenu) {
      throw new AppError('Forbidden: Only owner or admin can upload product images', 403);
    }
    if (validated.purpose === 'restaurants' && !tenant.permissions.canManageRestaurant) {
      throw new AppError('Forbidden: Only owner can upload restaurant assets', 403);
    }

    const result = await generatePresignedUploadUrl({
      restaurantId: tenant.restaurantId,
      purpose: validated.purpose,
      mimeType: validated.fileType as AllowedImageMimeType,
      fileSize: validated.fileSize,
      expiresInSeconds: 60 // 60 seconds expiry
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/uploads/direct
 * Direct backend multipart upload that verifies file magic bytes.
 */
router.post(
  '/direct',
  uploadRateLimiter,
  upload.single('file'),
  async (req: Request, res: Response, next) => {
    try {
      const tenant = req.tenant!;
      const purpose = req.body.purpose === 'restaurants' ? 'restaurants' : 'products';

      // Permission check based on purpose
      if (purpose === 'products' && !tenant.permissions.canManageMenu) {
        throw new AppError('Forbidden: Only owner or admin can upload product images', 403);
      }
      if (purpose === 'restaurants' && !tenant.permissions.canManageRestaurant) {
        throw new AppError('Forbidden: Only owner can upload restaurant assets', 403);
      }

      if (!req.file) {
        throw new AppError('No file provided for upload', 400);
      }

      const result = await uploadBufferToR2({
        restaurantId: tenant.restaurantId,
        purpose,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/uploads
 * Safely delete an R2 object, refusing deletion if active records still reference it.
 */
router.delete('/', async (req: Request, res: Response, next) => {
  try {
    const tenant = req.tenant!;
    const { objectKey } = req.body;

    if (!objectKey || typeof objectKey !== 'string') {
      throw new AppError('objectKey is required', 400);
    }

    const result = await safeDeleteR2Object(objectKey, tenant.restaurantId, 0);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

