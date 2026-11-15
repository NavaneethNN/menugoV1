import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { db, products, restaurants } from '@menugo/database';
import { eq, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler';

dotenv.config();

// Allowed image MIME types and extensions
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MIME_TO_EXTENSION: Record<AllowedImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates binary buffer headers against known image magic numbers.
 * Protects against files disguised with fake extensions or MIME headers.
 */
export function detectImageMimeType(buffer: Buffer): AllowedImageMimeType | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer.subarray(0, 3).toString('ascii') === 'GIF' &&
    (buffer.subarray(3, 6).toString('ascii') === '87a' ||
      buffer.subarray(3, 6).toString('ascii') === '89a')
  ) {
    return 'image/gif';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  // AVIF: .... ftyp avif or avis
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
    (buffer.subarray(8, 12).toString('ascii') === 'avif' ||
      buffer.subarray(8, 12).toString('ascii') === 'avis')
  ) {
    return 'image/avif';
  }

  return null;
}

export function isValidImageMimeType(mime: string): mime is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function getBucketName(): string {
  return process.env.R2_BUCKET_NAME || 'menugo-media';
}

export function getPublicBaseUrl(): string | null {
  return process.env.R2_PUBLIC_URL || null;
}

/**
 * Builds public delivery URL for an object key.
 */
export function getPublicImageUrl(objectKey: string): string {
  const publicUrl = getPublicBaseUrl();
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = getBucketName();

  if (publicUrl) {
    const base = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    return `${base}/${objectKey}`;
  }

  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${objectKey}`;
}

/**
 * S3/R2 client instance
 */
let cachedClient: S3Client | null = null;

export function getR2Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const customEndpoint = process.env.R2_ENDPOINT;

  const endpoint =
    customEndpoint ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  cachedClient = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: accessKeyId || 'mock-access-key',
      secretAccessKey: secretAccessKey || 'mock-secret-key'
    }
  });

  return cachedClient;
}

export function setMockR2Client(mockClient: S3Client | null): void {
  cachedClient = mockClient;
}

export type UploadPurpose = 'products' | 'restaurants' | 'theatres' | 'movies';

/**
 * Generates an unpredictable, restaurant-scoped object key.
 * Pattern: ${restaurantId}/${purpose}/${randomUUID()}.${extension}
 */
export function generateR2ObjectKey(
  restaurantId: string,
  purpose: UploadPurpose,
  mimeType: AllowedImageMimeType
): string {
  const ext = MIME_TO_EXTENSION[mimeType];
  const uniqueId = crypto.randomUUID();
  return `${restaurantId}/${purpose}/${uniqueId}.${ext}`;
}

/**
 * Generates a presigned PUT URL for direct-to-R2 browser uploads.
 */
export async function generatePresignedUploadUrl(params: {
  restaurantId: string;
  purpose: UploadPurpose;
  mimeType: AllowedImageMimeType;
  fileSize?: number;
  expiresInSeconds?: number;
}): Promise<{
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
}> {
  const { restaurantId, purpose, mimeType, expiresInSeconds = 60 } = params;

  if (params.fileSize && params.fileSize > MAX_IMAGE_FILE_SIZE) {
    throw new AppError(
      `File size exceeds maximum allowed limit of ${MAX_IMAGE_FILE_SIZE / (1024 * 1024)} MB`,
      400
    );
  }

  const objectKey = generateR2ObjectKey(restaurantId, purpose, mimeType);
  const bucket = getBucketName();
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: mimeType
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds
  });

  const publicUrl = getPublicImageUrl(objectKey);

  return {
    uploadUrl,
    objectKey,
    publicUrl,
    expiresIn: expiresInSeconds,
    headers: {
      'Content-Type': mimeType
    }
  };
}

/**
 * Uploads a verified buffer directly to Cloudflare R2.
 */
export async function uploadBufferToR2(params: {
  restaurantId: string;
  purpose: UploadPurpose;
  buffer: Buffer;
  mimeType?: string;
}): Promise<{
  objectKey: string;
  publicUrl: string;
  mimeType: AllowedImageMimeType;
  fileSize: number;
}> {
  const { restaurantId, purpose, buffer } = params;

  if (buffer.length > MAX_IMAGE_FILE_SIZE) {
    throw new AppError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 5 MB`,
      400
    );
  }

  // Detect and verify actual image format from binary magic numbers
  const detectedMime = detectImageMimeType(buffer);
  if (!detectedMime) {
    throw new AppError(
      'Invalid file content: The uploaded file is not a supported image format (JPEG, PNG, WebP, GIF, AVIF)',
      400
    );
  }

  const objectKey = generateR2ObjectKey(restaurantId, purpose, detectedMime);
  const bucket = getBucketName();
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: detectedMime
    })
  );

  const publicUrl = getPublicImageUrl(objectKey);

  return {
    objectKey,
    publicUrl,
    mimeType: detectedMime,
    fileSize: buffer.length
  };
}

/**
 * Counts database references to an image key across products and restaurants.
 */
export async function countImageReferences(objectKey: string): Promise<number> {
  const [prodRefs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.imageKey, objectKey));

  const [logoRefs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(restaurants)
    .where(eq(restaurants.logoKey, objectKey));

  const [coverRefs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(restaurants)
    .where(eq(restaurants.coverImageKey, objectKey));

  return (
    Number(prodRefs?.count || 0) +
    Number(logoRefs?.count || 0) +
    Number(coverRefs?.count || 0)
  );
}

/**
 * Safely deletes an R2 object only if no database records still reference it.
 */
export async function safeDeleteR2Object(
  objectKey: string,
  restaurantId: string,
  allowIfMaxReferences = 0
): Promise<{ deleted: boolean; reason?: string }> {
  // Enforce tenant scoping: objectKey MUST start with ${restaurantId}/
  if (!objectKey.startsWith(`${restaurantId}/`)) {
    throw new AppError('Unauthorized: Object key does not belong to this restaurant', 403);
  }

  const refCount = await countImageReferences(objectKey);
  if (refCount > allowIfMaxReferences) {
    return {
      deleted: false,
      reason: `Object still referenced by ${refCount} record(s)`
    };
  }

  try {
    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey
      })
    );
    return { deleted: true };
  } catch (err: any) {
    console.error(`Failed to delete object ${objectKey} from R2:`, err);
    return { deleted: false, reason: err.message };
  }
}
