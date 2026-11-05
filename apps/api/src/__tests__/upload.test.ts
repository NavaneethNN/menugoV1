import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  user,
  restaurants,
  restaurantMembers,
  products
} from '@menugo/database';
import { inArray, eq } from 'drizzle-orm';
import crypto from 'crypto';
import {
  detectImageMimeType,
  generateR2ObjectKey,
  getPublicImageUrl,
  countImageReferences,
  safeDeleteR2Object,
  setMockR2Client,
  MAX_IMAGE_FILE_SIZE
} from '../lib/r2';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

process.env.NODE_ENV = 'test';

describe('Cloudflare R2 Image Upload & Security', () => {
  let userAId: string;
  let userKitchenId: string;

  let cookieA: string;
  let cookieKitchen: string;

  const restAId = crypto.randomUUID();
  const restBId = crypto.randomUUID();

  const memberAId = crypto.randomUUID();
  const memberKitchenId = crypto.randomUUID();

  const prodTestId = crypto.randomUUID();

  const sentCommands: any[] = [];
  const now = Date.now();

  before(async () => {
    // 1. Mock S3 client to isolate tests from live R2 network
    const mockS3 = new S3Client({
      region: 'auto',
      endpoint: 'https://mock-account.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'mock-access-key',
        secretAccessKey: 'mock-secret-key'
      }
    });

    mockS3.send = (async (command: any) => {
      sentCommands.push(command);
      return {} as any;
    }) as any;

    setMockR2Client(mockS3);

    // 2. Create Users
    const resA = await auth.api.signUpEmail({
      body: { name: 'Owner Upload A', email: `upload-owner-a-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieA = resA.headers.get('set-cookie')?.split(';')[0] || '';
    userAId = (await resA.json()).user.id;

    const resK = await auth.api.signUpEmail({
      body: { name: 'Kitchen Upload Staff', email: `upload-kitchen-${now}@test.com`, password: 'Password123!' },
      asResponse: true
    });
    cookieKitchen = resK.headers.get('set-cookie')?.split(';')[0] || '';
    userKitchenId = (await resK.json()).user.id;

    // 3. Create Restaurants
    await db.insert(restaurants).values([
      { id: restAId, name: 'Upload Rest A', slug: `upload-rest-a-${now}`, isActive: true },
      { id: restBId, name: 'Upload Rest B', slug: `upload-rest-b-${now}`, isActive: true }
    ]);

    // 4. Create Memberships
    await db.insert(restaurantMembers).values([
      { id: memberAId, restaurantId: restAId, userId: userAId, role: 'owner' },
      { id: memberKitchenId, restaurantId: restAId, userId: userKitchenId, role: 'kitchen' }
    ]);
  });

  after(async () => {
    // Reset mock
    setMockR2Client(null);

    // Teardown DB
    await db.delete(products).where(eq(products.id, prodTestId));
    await db.delete(restaurantMembers).where(
      inArray(restaurantMembers.id, [memberAId, memberKitchenId])
    );
    await db.delete(restaurants).where(inArray(restaurants.id, [restAId, restBId]));
    const userIds = [userAId, userKitchenId].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(user).where(inArray(user.id, userIds));
    }
  });

  // -------------------------------------------------------------------------
  // 1. Unit Tests: File Content & Magic Byte Detection
  // -------------------------------------------------------------------------
  test('detectImageMimeType accurately identifies binary image formats by magic bytes', () => {
    // Valid JPEG: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assert.equal(detectImageMimeType(jpegBuffer), 'image/jpeg');

    // Valid PNG: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    assert.equal(detectImageMimeType(pngBuffer), 'image/png');

    // Valid GIF: GIF89a
    const gifBuffer = Buffer.from('GIF89a...');
    assert.equal(detectImageMimeType(gifBuffer), 'image/gif');

    // Valid WebP: RIFF .... WEBP
    const webpBuffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP')
    ]);
    assert.equal(detectImageMimeType(webpBuffer), 'image/webp');

    // Valid AVIF: .... ftyp avif
    const avifBuffer = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x1c]),
      Buffer.from('ftyp'),
      Buffer.from('avif')
    ]);
    assert.equal(detectImageMimeType(avifBuffer), 'image/avif');

    // Non-image / Executable disguised as image is rejected
    const phpScript = Buffer.from('<?php echo "malicious payload"; ?>');
    assert.equal(detectImageMimeType(phpScript), null);

    const pdfBuffer = Buffer.from('%PDF-1.4...');
    assert.equal(detectImageMimeType(pdfBuffer), null);

    const emptyBuffer = Buffer.from([]);
    assert.equal(detectImageMimeType(emptyBuffer), null);
  });

  // -------------------------------------------------------------------------
  // 2. Unit Tests: Object Key Generation & Scoping
  // -------------------------------------------------------------------------
  test('generateR2ObjectKey produces unpredictable, restaurant-scoped paths', () => {
    const key = generateR2ObjectKey('rest-uuid-123', 'products', 'image/png');

    // Must start with restaurantId/purpose/
    assert.ok(key.startsWith('rest-uuid-123/products/'));
    assert.ok(key.endsWith('.png'));

    // Must not contain path traversal characters
    assert.ok(!key.includes('..'));
    assert.ok(!key.includes('\\'));

    // Two calls generate distinct keys (unpredictable UUID)
    const key2 = generateR2ObjectKey('rest-uuid-123', 'products', 'image/png');
    assert.notEqual(key, key2);
  });

  test('getPublicImageUrl constructs safe public delivery URLs', () => {
    const url = getPublicImageUrl('rest-1/products/sample.png');
    assert.ok(url.endsWith('/rest-1/products/sample.png'));
    assert.ok(!url.includes('//rest-1')); // No double slashes
  });

  // -------------------------------------------------------------------------
  // 3. API Integration: Presigned PUT URL Endpoint
  // -------------------------------------------------------------------------
  test('POST /api/uploads/presigned-url issues short-lived presigned PUT URL for owner', async () => {
    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        fileType: 'image/webp',
        fileSize: 1024 * 500, // 500 KB
        purpose: 'products',
        fileName: 'masala-dosa.webp'
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.uploadUrl, 'Must return uploadUrl');
    assert.ok(res.body.objectKey.startsWith(`${restAId}/products/`));
    assert.ok(res.body.objectKey.endsWith('.webp'));
    assert.equal(res.body.expiresIn, 60);
    assert.equal(res.body.headers['Content-Type'], 'image/webp');
  });

  test('Presigned URL request rejects unsupported file types and oversized files', async () => {
    // Unsupported MIME (PDF)
    const resPdf = await request(app)
      .post('/api/uploads/presigned-url')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        fileType: 'application/pdf',
        purpose: 'products'
      });
    assert.equal(resPdf.status, 400);

    // Oversized (> 5 MB)
    const resLarge = await request(app)
      .post('/api/uploads/presigned-url')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({
        fileType: 'image/jpeg',
        fileSize: 6 * 1024 * 1024, // 6 MB
        purpose: 'products'
      });
    assert.equal(resLarge.status, 400);
  });

  test('Role authorization: Kitchen staff cannot request presigned URLs (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .set('Cookie', cookieKitchen)
      .set('x-restaurant-id', restAId)
      .send({
        fileType: 'image/png',
        purpose: 'products'
      });
    assert.equal(res.status, 403);
  });

  test('Unauthenticated request to presigned URL returns 401', async () => {
    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .send({
        fileType: 'image/jpeg',
        purpose: 'products'
      });
    assert.equal(res.status, 401);
  });

  // -------------------------------------------------------------------------
  // 4. API Integration: Direct Streaming Upload with Magic Bytes Validation
  // -------------------------------------------------------------------------
  test('POST /api/uploads/direct verifies magic bytes and uploads to R2', async () => {
    sentCommands.length = 0;

    // Valid PNG buffer
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

    const res = await request(app)
      .post('/api/uploads/direct')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .attach('file', validPng, 'test-dish.png');

    assert.equal(res.status, 201);
    assert.ok(res.body.objectKey.startsWith(`${restAId}/products/`));
    assert.equal(res.body.mimeType, 'image/png');
    assert.equal(res.body.fileSize, validPng.length);

    // Verify S3Client send was called with PutObjectCommand
    assert.equal(sentCommands.length, 1);
    assert.ok(sentCommands[0] instanceof PutObjectCommand);
  });

  test('Direct upload rejects non-image payload even if named .png', async () => {
    const fakeImage = Buffer.from('I am a malicious text script, not a real image.');

    const res = await request(app)
      .post('/api/uploads/direct')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .attach('file', fakeImage, 'sneaky.png');

    assert.equal(res.status, 400);
    const errMsg = res.body.error || res.body.message || '';
    assert.ok(errMsg.includes('not a supported image format'));
  });

  // -------------------------------------------------------------------------
  // 5. Safe Reference Tracking & Image Deletion
  // -------------------------------------------------------------------------
  test('safeDeleteR2Object refuses deletion if image is still referenced by a product record', async () => {
    sentCommands.length = 0;
    const referencedKey = `${restAId}/products/referenced-dosa.png`;

    // 1. Create a product holding this imageKey
    await db.insert(products).values({
      id: prodTestId,
      restaurantId: restAId,
      name: 'Referenced Dosa Item',
      price: 15000,
      imageKey: referencedKey,
      imageUrl: getPublicImageUrl(referencedKey)
    });

    // 2. Verify reference count
    const count = await countImageReferences(referencedKey);
    assert.equal(count, 1);

    // 3. Attempt safe delete -> should be blocked!
    const deleteResult = await safeDeleteR2Object(referencedKey, restAId, 0);
    assert.equal(deleteResult.deleted, false);
    assert.ok(deleteResult.reason?.includes('referenced by 1 record'));
    assert.equal(sentCommands.length, 0, 'No DeleteObjectCommand should be sent');

    // 4. API endpoint DELETE /api/uploads also returns blocked status
    const resApi = await request(app)
      .delete('/api/uploads')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId)
      .send({ objectKey: referencedKey });

    assert.equal(resApi.status, 200);
    assert.equal(resApi.body.deleted, false);
  });

  test('safeDeleteR2Object deletes object when 0 records reference it', async () => {
    sentCommands.length = 0;
    const orphanedKey = `${restAId}/products/orphaned-image.jpg`;

    // References count is 0
    const count = await countImageReferences(orphanedKey);
    assert.equal(count, 0);

    // Safe delete succeeds
    const deleteResult = await safeDeleteR2Object(orphanedKey, restAId, 0);
    assert.equal(deleteResult.deleted, true);

    // Verify S3Client send was called with DeleteObjectCommand
    assert.equal(sentCommands.length, 1);
    assert.ok(sentCommands[0] instanceof DeleteObjectCommand);
  });

  test('Cross-tenant IDOR protection: cannot delete image key from another restaurant', async () => {
    const foreignKey = `${restBId}/products/foreign-image.jpg`;

    const res = await request(app)
      .delete('/api/uploads')
      .set('Cookie', cookieA)
      .set('x-restaurant-id', restAId) // Scoped to Rest A, trying to delete Rest B key
      .send({ objectKey: foreignKey });

    assert.equal(res.status, 403);
    const errMsg = res.body.error || res.body.message || '';
    assert.ok(errMsg.includes('Object key does not belong to this restaurant'));
  });
});
