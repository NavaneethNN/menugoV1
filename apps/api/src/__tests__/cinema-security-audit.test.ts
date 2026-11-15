import { it, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  user,
  restaurants,
  restaurantMembers,
  cinemaProfiles,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  cinemaQrCodes,
  cinemaPaymentAccounts,
  cinemaPaymentTransactions,
  cinemaRefunds,
  cinemaWebhookEvents,
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { encryptSecret, decryptSecret } from '../lib/encryption';
import { generateRazorpaySignature } from '../lib/payment/razorpay.adapter';
import { generatePaytmParamChecksum } from '../lib/payment/paytm.adapter';

process.env.NODE_ENV = 'test';

describe('Task 20: Cinema Security & Reliability Audit Suite', () => {
  // Cinema A
  let userCinemaAOwnerId: string;
  let userCinemaAAdminId: string;
  let userCinemaAKitchenId: string;
  let userCinemaADelivery1Id: string;
  let userCinemaADelivery2Id: string;

  let cookieCinemaAOwner: string;
  let cookieCinemaAAdmin: string;
  let cookieCinemaAKitchen: string;
  let cookieCinemaADelivery1: string;
  let cookieCinemaADelivery2: string;

  let memberCinemaAOwnerId: string;
  let memberCinemaAAdminId: string;
  let memberCinemaAKitchenId: string;
  let memberCinemaADelivery1Id: string;
  let memberCinemaADelivery2Id: string;

  const theatreAId = crypto.randomUUID();
  const theatreASlug = `theatre-sec-a-${Date.now()}`;
  const theatreAToken = crypto.randomBytes(24).toString('hex');

  // Cinema B (cross-tenant target)
  let userCinemaBOwnerId: string;
  let cookieCinemaBOwner: string;
  const theatreBId = crypto.randomUUID();
  const theatreBSlug = `theatre-sec-b-${Date.now()}`;
  const theatreBToken = crypto.randomBytes(24).toString('hex');

  // Restaurant tenant (cross-module target)
  let userRestaurantOwnerId: string;
  let cookieRestaurantOwner: string;
  const restaurantId = crypto.randomUUID();
  const restaurantSlug = `rest-sec-${Date.now()}`;

  // Entities for Cinema A
  let screenA1Id: string;
  let screenA2Id: string;
  let rowA1Id: string;
  let seatA1Id: string;
  let seatA2Id: string;
  let movieA1Id: string;
  let showA1Id: string;
  let categoryA1Id: string;
  let productA1Id: string; // Popcorn, 25000 paise (250 INR)
  let productA2Id: string; // Soda, 12000 paise (unavailable)
  let activeQrTokenA1: string;
  let revokedQrTokenA1: string;

  // Entities for Cinema B
  let screenB1Id: string;
  let movieB1Id: string;
  let showB1Id: string;
  let productB1Id: string;

  // Payment credentials for Theatre A
  const rawRazorpaySecret = 'test_rzp_secret_key_audit_xyz123';
  const rawPaytmKey = 'test_paytm_merchant_key_audit_987';
  const paytmMidA = 'MID_SEC_AUDIT_01';
  let rzpAccountId: string;
  let paytmAccountId: string;

  const timestamp = Date.now();
  const createdUsersToClean: string[] = [];

  before(async () => {
    try {
      // -----------------------------------------------------------------------
      // 1. Create Cinema A Users (Owner, Admin, Kitchen, Delivery 1, Delivery 2)
      // -----------------------------------------------------------------------
      const emailAOwner = `audit.owner.a.${timestamp}@example.com`;
      const resAOwner = await auth.api.signUpEmail({
        body: { name: 'PVR Audit Owner', email: emailAOwner, password: 'password123' }
      });
      userCinemaAOwnerId = resAOwner.user.id;
      createdUsersToClean.push(userCinemaAOwnerId);
      const signinAOwner = await auth.api.signInEmail({
        body: { email: emailAOwner, password: 'password123' },
        asResponse: true
      });
      cookieCinemaAOwner = signinAOwner.headers.get('set-cookie') || '';

      const emailAAdmin = `audit.admin.a.${timestamp}@example.com`;
      const resAAdmin = await auth.api.signUpEmail({
        body: { name: 'PVR Audit Admin', email: emailAAdmin, password: 'password123' }
      });
      userCinemaAAdminId = resAAdmin.user.id;
      createdUsersToClean.push(userCinemaAAdminId);
      const signinAAdmin = await auth.api.signInEmail({
        body: { email: emailAAdmin, password: 'password123' },
        asResponse: true
      });
      cookieCinemaAAdmin = signinAAdmin.headers.get('set-cookie') || '';

      const emailAKitchen = `audit.kitchen.a.${timestamp}@example.com`;
      const resAKitchen = await auth.api.signUpEmail({
        body: { name: 'PVR Audit Kitchen Chef', email: emailAKitchen, password: 'password123' }
      });
      userCinemaAKitchenId = resAKitchen.user.id;
      createdUsersToClean.push(userCinemaAKitchenId);
      const signinAKitchen = await auth.api.signInEmail({
        body: { email: emailAKitchen, password: 'password123' },
        asResponse: true
      });
      cookieCinemaAKitchen = signinAKitchen.headers.get('set-cookie') || '';

      const emailADelivery1 = `audit.deliv1.a.${timestamp}@example.com`;
      const resADelivery1 = await auth.api.signUpEmail({
        body: { name: 'PVR Audit Runner One', email: emailADelivery1, password: 'password123' }
      });
      userCinemaADelivery1Id = resADelivery1.user.id;
      createdUsersToClean.push(userCinemaADelivery1Id);
      const signinADelivery1 = await auth.api.signInEmail({
        body: { email: emailADelivery1, password: 'password123' },
        asResponse: true
      });
      cookieCinemaADelivery1 = signinADelivery1.headers.get('set-cookie') || '';

      const emailADelivery2 = `audit.deliv2.a.${timestamp}@example.com`;
      const resADelivery2 = await auth.api.signUpEmail({
        body: { name: 'PVR Audit Runner Two', email: emailADelivery2, password: 'password123' }
      });
      userCinemaADelivery2Id = resADelivery2.user.id;
      createdUsersToClean.push(userCinemaADelivery2Id);
      const signinADelivery2 = await auth.api.signInEmail({
        body: { email: emailADelivery2, password: 'password123' },
        asResponse: true
      });
      cookieCinemaADelivery2 = signinADelivery2.headers.get('set-cookie') || '';

      // -----------------------------------------------------------------------
      // 2. Create Cinema B Owner (Cross-Tenant target)
      // -----------------------------------------------------------------------
      const emailBOwner = `audit.owner.b.${timestamp}@example.com`;
      const resBOwner = await auth.api.signUpEmail({
        body: { name: 'INOX Audit Owner', email: emailBOwner, password: 'password123' }
      });
      userCinemaBOwnerId = resBOwner.user.id;
      createdUsersToClean.push(userCinemaBOwnerId);
      const signinBOwner = await auth.api.signInEmail({
        body: { email: emailBOwner, password: 'password123' },
        asResponse: true
      });
      cookieCinemaBOwner = signinBOwner.headers.get('set-cookie') || '';

      // -----------------------------------------------------------------------
      // 3. Create Restaurant Owner (Cross-Module target)
      // -----------------------------------------------------------------------
      const emailRestOwner = `audit.rest.owner.${timestamp}@example.com`;
      const resRestOwner = await auth.api.signUpEmail({
        body: { name: 'Bistro Audit Owner', email: emailRestOwner, password: 'password123' }
      });
      userRestaurantOwnerId = resRestOwner.user.id;
      createdUsersToClean.push(userRestaurantOwnerId);
      const signinRestOwner = await auth.api.signInEmail({
        body: { email: emailRestOwner, password: 'password123' },
        asResponse: true
      });
      cookieRestaurantOwner = signinRestOwner.headers.get('set-cookie') || '';

      // -----------------------------------------------------------------------
      // 4. Seed Cinema A & Profile
      // -----------------------------------------------------------------------
      await db.insert(restaurants).values({
        id: theatreAId,
        name: 'PVR Security Audit Cinemas',
        slug: theatreASlug,
        businessType: 'cinema',
        tenantType: 'cinema',
        theatreToken: theatreAToken,
        isActive: true,
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      });

      await db.insert(cinemaProfiles).values({
        theatreId: theatreAId,
        theatreName: 'PVR Security Audit Cinemas',
        theatreCode: 'PVR-SEC-A',
        city: 'Mumbai',
        state: 'Maharashtra',
        address: '100 Security Blvd, BKC',
        contactEmail: 'security@pvrcinemas.com',
        contactNumber: '9988776655',
        fssaiLicenseNumber: '11223344556677'
      });

      // -----------------------------------------------------------------------
      // 5. Seed Cinema B & Profile
      // -----------------------------------------------------------------------
      await db.insert(restaurants).values({
        id: theatreBId,
        name: 'INOX Security Audit Cinemas',
        slug: theatreBSlug,
        businessType: 'cinema',
        tenantType: 'cinema',
        theatreToken: theatreBToken,
        isActive: true,
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      });

      await db.insert(cinemaProfiles).values({
        theatreId: theatreBId,
        theatreName: 'INOX Security Audit Cinemas',
        theatreCode: 'INOX-SEC-B',
        city: 'Bangalore',
        state: 'Karnataka',
        address: '200 MG Road',
        contactEmail: 'security@inoxcinemas.com',
        contactNumber: '9123456789',
        fssaiLicenseNumber: '99887766554433'
      });

      // -----------------------------------------------------------------------
      // 6. Seed Restaurant (Standard F&B tenant)
      // -----------------------------------------------------------------------
      await db.insert(restaurants).values({
        id: restaurantId,
        name: 'Olive Garden Bistro',
        slug: restaurantSlug,
        businessType: 'restaurant',
        tenantType: 'restaurant',
        isActive: true,
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      });

      // -----------------------------------------------------------------------
      // 7. Seed Staff Memberships
      // -----------------------------------------------------------------------
      const [mAOwner] = await db
        .insert(restaurantMembers)
        .values({
          restaurantId: theatreAId,
          userId: userCinemaAOwnerId,
          role: 'owner',
          staffName: 'Owner PVR',
          status: 'active'
        })
        .returning();
      memberCinemaAOwnerId = mAOwner.id;

      const [mAAdmin] = await db
        .insert(restaurantMembers)
        .values({
          restaurantId: theatreAId,
          userId: userCinemaAAdminId,
          role: 'admin',
          staffName: 'Admin PVR',
          status: 'active'
        })
        .returning();
      memberCinemaAAdminId = mAAdmin.id;

      const [mAKitchen] = await db
        .insert(restaurantMembers)
        .values({
          restaurantId: theatreAId,
          userId: userCinemaAKitchenId,
          role: 'kitchen',
          staffName: 'Chef PVR',
          status: 'active'
        })
        .returning();
      memberCinemaAKitchenId = mAKitchen.id;

      const [mADelivery1] = await db
        .insert(restaurantMembers)
        .values({
          restaurantId: theatreAId,
          userId: userCinemaADelivery1Id,
          role: 'delivery',
          staffName: 'Runner One',
          status: 'active'
        })
        .returning();
      memberCinemaADelivery1Id = mADelivery1.id;

      const [mADelivery2] = await db
        .insert(restaurantMembers)
        .values({
          restaurantId: theatreAId,
          userId: userCinemaADelivery2Id,
          role: 'delivery',
          staffName: 'Runner Two',
          status: 'active'
        })
        .returning();
      memberCinemaADelivery2Id = mADelivery2.id;

      await db.insert(restaurantMembers).values({
        restaurantId: theatreBId,
        userId: userCinemaBOwnerId,
        role: 'owner',
        staffName: 'Owner INOX',
        status: 'active'
      });

      await db.insert(restaurantMembers).values({
        restaurantId: restaurantId,
        userId: userRestaurantOwnerId,
        role: 'owner',
        staffName: 'Owner Bistro',
        status: 'active'
      });

      // -----------------------------------------------------------------------
      // 8. Seed Cinema A Screens, Rows, Seats, Movies, Shows, Menu & QRs
      // -----------------------------------------------------------------------
      screenA1Id = crypto.randomUUID();
      await db.insert(cinemaScreens).values({
        id: screenA1Id,
        theatreId: theatreAId,
        screenNumber: 1,
        screenName: 'IMAX Screen 1',
        screenType: 'IMAX',
        seatingCapacity: 50,
        supportedServiceTypes: ['seat_delivery'],
        status: 'active'
      });

      screenA2Id = crypto.randomUUID();
      await db.insert(cinemaScreens).values({
        id: screenA2Id,
        theatreId: theatreAId,
        screenNumber: 2,
        screenName: 'Gold Screen 2',
        screenType: 'GOLD',
        seatingCapacity: 20,
        supportedServiceTypes: ['seat_delivery'],
        status: 'active'
      });

      rowA1Id = crypto.randomUUID();
      await db.insert(cinemaRows).values({
        id: rowA1Id,
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowIdentifier: 'A',
        sortOrder: 1,
        startSeatNumber: 1,
        endSeatNumber: 10,
        totalSeats: 10,
        seatCategory: 'regular',
        status: 'active'
      });

      seatA1Id = crypto.randomUUID();
      await db.insert(cinemaSeats).values({
        id: seatA1Id,
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'A',
        seatNumber: 1,
        seatIdentifier: '1',
        seatCategory: 'regular',
        status: 'active'
      });

      seatA2Id = crypto.randomUUID();
      await db.insert(cinemaSeats).values({
        id: seatA2Id,
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'A',
        seatNumber: 2,
        seatIdentifier: '2',
        seatCategory: 'regular',
        status: 'active'
      });

      movieA1Id = crypto.randomUUID();
      await db.insert(cinemaMovies).values({
        id: movieA1Id,
        theatreId: theatreAId,
        title: 'Inception 4K',
        certification: 'UA',
        durationMinutes: 148,
        language: 'English',
        status: 'active'
      });

      const now = new Date();
      const showStart = new Date(now.getTime() + 30 * 60 * 1000); // starts in 30 mins
      const showEnd = new Date(showStart.getTime() + 150 * 60 * 1000);
      const ordStart = new Date(now.getTime() - 10 * 60 * 1000); // opened 10 mins ago
      const ordEnd = new Date(showEnd.getTime() - 30 * 60 * 1000); // closes 30 mins before end

      showA1Id = crypto.randomUUID();
      await db.insert(cinemaShows).values({
        id: showA1Id,
        theatreId: theatreAId,
        screenId: screenA1Id,
        movieId: movieA1Id,
        showDate: '2026-11-15',
        startTime: showStart,
        expectedEndTime: showEnd,
        orderingStartTime: ordStart,
        orderingEndTime: ordEnd,
        status: 'published'
      });

      categoryA1Id = crypto.randomUUID();
      await db.insert(categories).values({
        id: categoryA1Id,
        restaurantId: theatreAId,
        name: 'Popcorn & Snacks'
      });

      productA1Id = crypto.randomUUID();
      await db.insert(products).values({
        id: productA1Id,
        restaurantId: theatreAId,
        categoryId: categoryA1Id,
        name: 'Jumbo Butter Popcorn',
        price: 25000,
        isAvailable: true
      });

      productA2Id = crypto.randomUUID();
      await db.insert(products).values({
        id: productA2Id,
        restaurantId: theatreAId,
        categoryId: categoryA1Id,
        name: 'Fountain Soda (Out of Stock)',
        price: 12000,
        isAvailable: false
      });

      // QR Codes for Cinema A
      activeQrTokenA1 = theatreAToken;
      await db.insert(cinemaQrCodes).values({
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        qrType: 'theatre',
        qrName: 'PVR Theatre Main QR',
        token: activeQrTokenA1,
        theatreToken: activeQrTokenA1,
        targetUrl: `https://menugo.com/cinema/${activeQrTokenA1}`,
        qrCodeData: 'data:image/png;base64,mockQrData',
        status: 'active'
      });

      revokedQrTokenA1 = crypto.randomBytes(24).toString('hex');
      await db.insert(cinemaQrCodes).values({
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        qrType: 'theatre',
        qrName: 'PVR Theatre Revoked QR',
        token: revokedQrTokenA1,
        theatreToken: revokedQrTokenA1,
        targetUrl: `https://menugo.com/cinema/${revokedQrTokenA1}`,
        qrCodeData: 'data:image/png;base64,mockQrData',
        status: 'revoked',
        revokedAt: new Date()
      });

      // -----------------------------------------------------------------------
      // 9. Seed Cinema B Screens & Shows
      // -----------------------------------------------------------------------
      screenB1Id = crypto.randomUUID();
      await db.insert(cinemaScreens).values({
        id: screenB1Id,
        theatreId: theatreBId,
        screenNumber: 1,
        screenName: 'INOX Screen 1',
        screenType: 'STANDARD',
        seatingCapacity: 40,
        supportedServiceTypes: ['seat_delivery'],
        status: 'active'
      });

      movieB1Id = crypto.randomUUID();
      await db.insert(cinemaMovies).values({
        id: movieB1Id,
        theatreId: theatreBId,
        title: 'Interstellar',
        certification: 'UA',
        durationMinutes: 169,
        language: 'English',
        status: 'active'
      });

      showB1Id = crypto.randomUUID();
      await db.insert(cinemaShows).values({
        id: showB1Id,
        theatreId: theatreBId,
        screenId: screenB1Id,
        movieId: movieB1Id,
        showDate: '2026-11-15',
        startTime: showStart,
        expectedEndTime: showEnd,
        orderingStartTime: ordStart,
        orderingEndTime: ordEnd,
        status: 'published'
      });

      const categoryB1Id = crypto.randomUUID();
      await db.insert(categories).values({
        id: categoryB1Id,
        restaurantId: theatreBId,
        name: 'Snacks B'
      });

      productB1Id = crypto.randomUUID();
      await db.insert(products).values({
        id: productB1Id,
        restaurantId: theatreBId,
        categoryId: categoryB1Id,
        name: 'Nachos Supreme',
        price: 22000,
        isAvailable: true
      });

      // -----------------------------------------------------------------------
      // 10. Configure Payment Gateways for Theatre A (Razorpay & Paytm)
      // -----------------------------------------------------------------------
      rzpAccountId = crypto.randomUUID();
      await db.insert(cinemaPaymentAccounts).values({
        id: rzpAccountId,
        theatreId: theatreAId,
        provider: 'razorpay',
        environment: 'test',
        keyId: 'rzp_test_sec_audit',
        encryptedKeySecret: encryptSecret(rawRazorpaySecret),
        encryptedWebhookSecret: encryptSecret('rzp_wh_sec_audit'),
        maskedKeySecret: '••••••••',
        status: 'connected',
        isVerified: true
      });

      paytmAccountId = crypto.randomUUID();
      await db.insert(cinemaPaymentAccounts).values({
        id: paytmAccountId,
        theatreId: theatreAId,
        provider: 'paytm',
        environment: 'test',
        keyId: paytmMidA,
        encryptedKeySecret: encryptSecret(rawPaytmKey),
        encryptedWebhookSecret: encryptSecret('paytm_wh_sec_audit'),
        maskedKeySecret: '••••••••',
        status: 'connected',
        isVerified: true
      });
    } catch (setupError) {
      console.error('SETUP ERROR OCCURRED IN BEFORE HOOK:', setupError);
      throw setupError;
    }
  });

  after(async () => {
    try {
      await db.delete(orderStatusHistory).where(
        inArray(
          orderStatusHistory.orderId,
          db.select({ id: orders.id }).from(orders).where(inArray(orders.restaurantId, [theatreAId, theatreBId]))
        )
      );
      await db.delete(orderItems).where(
        inArray(
          orderItems.orderId,
          db.select({ id: orders.id }).from(orders).where(inArray(orders.restaurantId, [theatreAId, theatreBId]))
        )
      );
      await db.delete(orders).where(inArray(orders.restaurantId, [theatreAId, theatreBId]));
      await db.delete(cinemaRefunds).where(inArray(cinemaRefunds.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaPaymentTransactions).where(inArray(cinemaPaymentTransactions.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaWebhookEvents).where(inArray(cinemaWebhookEvents.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaPaymentAccounts).where(inArray(cinemaPaymentAccounts.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaQrCodes).where(inArray(cinemaQrCodes.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaShows).where(inArray(cinemaShows.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaSeats).where(inArray(cinemaSeats.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaRows).where(inArray(cinemaRows.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, [theatreAId, theatreBId]));
      await db.delete(products).where(inArray(products.restaurantId, [theatreAId, theatreBId]));
      await db.delete(categories).where(inArray(categories.restaurantId, [theatreAId, theatreBId]));
      await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));
      if (createdUsersToClean.length > 0) {
        await db.delete(user).where(inArray(user.id, createdUsersToClean));
      }
    } catch (cleanupErr) {
      console.warn('Cleanup error in cinema security test:', cleanupErr);
    }
  });

  // =========================================================================
  // AUDIT AREA 1: AUTHENTICATION & SESSION HANDLING
  // =========================================================================
  describe('Area 1: Authentication & Session Handling', () => {
    it('rejects unauthenticated requests to protected cinema screens endpoint (401)', async () => {
      const res = await request(app).get('/api/cinema/screens');
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated requests to cinema payment settings (401)', async () => {
      const res = await request(app).get('/api/cinema/payments/settings');
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated requests to cinema staff management (401)', async () => {
      const res = await request(app).get('/api/cinema/staff');
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated requests to cinema reports (401)', async () => {
      const res = await request(app).get('/api/cinema/reports/summary');
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated requests to cinema kitchen queue (401)', async () => {
      const res = await request(app).get('/api/cinema/kitchen/orders');
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated requests to cinema delivery queue (401)', async () => {
      const res = await request(app).get('/api/cinema/delivery/orders');
      assert.equal(res.status, 401);
    });

    it('rejects requests with forged/tampered session cookie (401)', async () => {
      const res = await request(app)
        .get('/api/cinema/screens')
        .set('Cookie', 'auth_session=forged_invalid_session_signature_12345')
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 401);
    });
  });

  // =========================================================================
  // AUDIT AREA 2: MULTI-TENANT ISOLATION
  // =========================================================================
  describe('Area 2: Multi-Tenant Isolation', () => {
    it('Cinema A Owner CANNOT read Cinema B screens via tenant header manipulation (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/screens')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-theatre-id', theatreBId);
      assert.equal(res.status, 403);
    });

    it('Cinema A Owner CANNOT read Cinema B staff roster (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-theatre-id', theatreBId);
      assert.equal(res.status, 403);
    });

    it('Cinema A Owner CANNOT read Cinema B reports (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/summary')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-theatre-id', theatreBId);
      assert.equal(res.status, 403);
    });

    it('Cinema A Owner CANNOT read Cinema B payment settings (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-theatre-id', theatreBId);
      assert.equal(res.status, 403);
    });

    it('Restaurant Owner CANNOT access Cinema endpoints (403 Forbidden: Cross-module access denied)', async () => {
      const res = await request(app)
        .get('/api/cinema/screens')
        .set('Cookie', cookieRestaurantOwner)
        .set('x-restaurant-id', restaurantId);
      assert.equal(res.status, 403);
      assert.match(res.body.message || '', /cross-module/i);
    });
  });

  // =========================================================================
  // AUDIT AREA 3: ROLE-BASED OPERATIONAL PERMISSIONS
  // =========================================================================
  describe('Area 3: Role-Based Operational Permissions', () => {
    it('Kitchen staff CAN access Kitchen queue (200 OK)', async () => {
      const res = await request(app)
        .get('/api/cinema/kitchen/orders')
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.orders));
    });

    it('Kitchen staff CANNOT create screens (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/cinema/screens')
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId)
        .send({
          screenNumber: 99,
          screenName: 'Unauthorized Kitchen Screen',
          screenType: 'standard',
          seatingCapacity: 100,
          supportedServiceTypes: ['seat_delivery']
        });
      assert.equal(res.status, 403);
    });

    it('Kitchen staff CANNOT access Payment settings (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 403);
    });

    it('Kitchen staff CANNOT access Staff management (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 403);
    });

    it('Kitchen staff CANNOT access Cinema Reports (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/summary')
        .set('Cookie', cookieCinemaAKitchen)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 403);
    });

    it('Delivery runner CAN access Delivery runner queue (200 OK)', async () => {
      const res = await request(app)
        .get('/api/cinema/delivery/orders')
        .set('Cookie', cookieCinemaADelivery1)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.orders));
    });

    it('Delivery runner CANNOT access Staff management (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/staff')
        .set('Cookie', cookieCinemaADelivery1)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 403);
    });

    it('Delivery runner CANNOT access Payment settings (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaADelivery1)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 403);
    });

    it('Deactivated staff member is immediately rejected with 403 Forbidden', async () => {
      // 1. Deactivate Delivery Runner 2
      await db
        .update(restaurantMembers)
        .set({ status: 'inactive' })
        .where(eq(restaurantMembers.id, memberCinemaADelivery2Id));

      // 2. Attempt access with deactivated runner
      const res = await request(app)
        .get('/api/cinema/delivery/orders')
        .set('Cookie', cookieCinemaADelivery2)
        .set('x-theatre-id', theatreAId);
      assert.equal(res.status, 403);

      // Re-activate for future tests
      await db
        .update(restaurantMembers)
        .set({ status: 'active' })
        .where(eq(restaurantMembers.id, memberCinemaADelivery2Id));
    });
  });

  // =========================================================================
  // AUDIT AREA 4: QR SECURITY & UNPREDICTABILITY
  // =========================================================================
  describe('Area 4: QR Security & Token Protection', () => {
    it('Cryptographic active QR token successfully resolves cinema theatre details', async () => {
      const res = await request(app).get(`/api/cinema/public/resolve/${activeQrTokenA1}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.valid, true);
      assert.equal(res.body.theatre.name, 'PVR Security Audit Cinemas');
      assert.equal(res.body.theatre.city, 'Mumbai');
    });

    it('Fabricated / guessed QR token returns 404 Not Found', async () => {
      const randomHex48 = crypto.randomBytes(24).toString('hex');
      const res = await request(app).get(`/api/cinema/public/resolve/${randomHex48}`);
      assert.equal(res.status, 404);
    });

    it('Revoked / deactivated QR token is rejected with 404 Not Found', async () => {
      const res = await request(app).get(`/api/cinema/public/resolve/${revokedQrTokenA1}`);
      assert.equal(res.status, 404);
    });

    it('Public scanning endpoint does not accept raw sequential numeric IDs', async () => {
      const res = await request(app).get('/api/cinema/public/resolve/1');
      assert.equal(res.status, 400); // Fails regex validation format check
    });
  });

  // =========================================================================
  // AUDIT AREA 5: PRICING INTEGRITY & CHECKOUT VALIDATION
  // =========================================================================
  describe('Area 5: Pricing Integrity & Checkout Validation', () => {
    it('Ignores client-supplied malicious unit prices and recalculates authoritative total from DB', async () => {
      // Client tries to order Popcorn claiming unitPrice is 1.00 and total is 2.00
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id,
          showId: showA1Id,
          seatRow: 'A',
          seatNumber: '1',
          items: [
            {
              productId: productA1Id,
              quantity: 2,
              unitPrice: 1.0 // Malicious price tampering
            }
          ],
          totalAmount: 2.0 // Malicious total tampering
        });

      assert.equal(res.status, 201);
      // Backend calculates 2 * 25000 = 50000 paise (500 INR) + 5% tax = 52500 paise (525 INR)
      assert.equal(res.body.order.summary.subtotal, 50000);
      assert.equal(res.body.order.summary.totalAmount, 52500);
      assert.equal(res.body.order.status, 'pending');
      assert.equal(res.body.order.paymentStatus, 'unpaid');
    });

    it('Rejects ordering inactive or out-of-stock products (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id,
          showId: showA1Id,
          seatRow: 'A',
          seatNumber: '1',
          items: [
            {
              productId: productA2Id, // Unavailable soda
              quantity: 1
            }
          ]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message || '', /not available|out of stock/i);
    });

    it('Rejects ordering products belonging to another tenant (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id,
          showId: showA1Id,
          seatRow: 'A',
          seatNumber: '1',
          items: [
            {
              productId: productB1Id, // Product from Theatre B
              quantity: 1
            }
          ]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message || '', /belong/i);
    });

    it('Rejects ordering when show does not match selected screen (404 Not Found)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAToken,
          screenId: screenA2Id, // Screen 2
          showId: showA1Id, // Show on Screen 1
          seatRow: 'A',
          seatNumber: '1',
          items: [{ productId: productA1Id, quantity: 1 }]
        });

      assert.equal(res.status, 404);
      assert.match(res.body.message || '', /Selected show does not belong to this screen/i);
    });

    it('Rejects ordering with seat that does not exist on screen (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id, // Screen 1
          showId: showA1Id, // Show on Screen 1
          seatRow: 'Z', // Non-existent row Z
          seatNumber: '99', // Non-existent seat 99
          items: [{ productId: productA1Id, quantity: 1 }]
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message || '', /does not exist on/i);
    });
  });

  // =========================================================================
  // AUDIT AREA 6: PAYMENT SECURITY & SIGNATURE VERIFICATION
  // =========================================================================
  describe('Area 6: Payment Security & Signature Verification', () => {
    let orderToPayId: string;
    let orderStatusToken: string;
    let rzpTxId: string;
    let rzpOrderId: string;

    before(async () => {
      // Create a cinema order to pay
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id,
          showId: showA1Id,
          seatRow: 'A',
          seatNumber: '1',
          items: [{ productId: productA1Id, quantity: 1 }]
        });
      orderToPayId = res.body.order.id;
      orderStatusToken = res.body.statusToken;

      // Initiate payment order via /payments/order
      const txRes = await request(app)
        .post('/api/cinema/payments/order')
        .send({
          orderId: orderToPayId,
          statusToken: orderStatusToken,
          provider: 'razorpay'
        });

      rzpTxId = txRes.body.transactionId;
      rzpOrderId = txRes.body.providerOrderId;
    });

    it('Rejects Razorpay payment verification with forged signature (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToPayId,
          statusToken: orderStatusToken,
          transactionId: rzpTxId,
          provider: 'razorpay',
          providerOrderId: rzpOrderId,
          providerPaymentId: 'pay_test_forged_123',
          providerSignature: 'forged_fake_signature_hex'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.verified, false);
    });

    it('Accepts Razorpay payment verification with valid HMAC-SHA256 signature', async () => {
      const paymentId = `pay_valid_${crypto.randomBytes(6).toString('hex')}`;
      const validSignature = generateRazorpaySignature(rzpOrderId, paymentId, rawRazorpaySecret);

      const res = await request(app)
        .post('/api/cinema/payments/verify')
        .send({
          orderId: orderToPayId,
          statusToken: orderStatusToken,
          transactionId: rzpTxId,
          provider: 'razorpay',
          providerOrderId: rzpOrderId,
          providerPaymentId: paymentId,
          providerSignature: validSignature
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.verified, true);
      assert.equal(res.body.status, 'CAPTURED');

      // Verify order in database transitioned to confirmed/paid
      const [orderRec] = await db.select().from(orders).where(eq(orders.id, orderToPayId)).limit(1);
      assert.equal(orderRec.paymentStatus, 'paid');
    });

    it('Webhook Replay Attack: Replaying processed webhook is idempotent (200 OK without re-running)', async () => {
      const duplicateTxnId = `TXN_REPLAY_${Date.now()}`;
      const payload: Record<string, string> = {
        MID: paytmMidA,
        ORDERID: rzpOrderId,
        TXNAMOUNT: '262.50',
        CURRENCY: 'INR',
        TXNID: duplicateTxnId,
        STATUS: 'TXN_SUCCESS',
        RESPCODE: '01',
        RESPMSG: 'Txn Success'
      };

      const checksum = generatePaytmParamChecksum(payload, rawPaytmKey);
      payload.CHECKSUMHASH = checksum;

      // First webhook submission
      const res1 = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(payload);

      // Replay with identical payload & provider transaction ID
      const res2 = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(payload);

      assert.equal(res2.status, 200);
      assert.match(res2.body.message || '', /already processed|idempotent/i);
    });

    it('Delayed Failure Webhook Protection: Webhook reporting failure on CAPTURED order is safely ignored', async () => {
      const delayedFailPayload: Record<string, string> = {
        MID: paytmMidA,
        ORDERID: rzpOrderId,
        TXNAMOUNT: '262.50',
        CURRENCY: 'INR',
        TXNID: `TXN_FAIL_${Date.now()}`,
        STATUS: 'TXN_FAILURE',
        RESPCODE: '227',
        RESPMSG: 'Delayed Txn Failure'
      };

      delayedFailPayload.CHECKSUMHASH = generatePaytmParamChecksum(delayedFailPayload, rawPaytmKey);

      const res = await request(app)
        .post(`/api/cinema/payments/webhook/${theatreAId}/paytm`)
        .send(delayedFailPayload);

      assert.equal(res.status, 200);
      assert.match(res.body.message || '', /already CAPTURED|ignored/i);

      // Verify order status was NOT downgraded
      const [orderRec] = await db.select().from(orders).where(eq(orders.id, orderToPayId)).limit(1);
      assert.equal(orderRec.paymentStatus, 'paid');
    });

    it('Refund Security: Attempting to refund more than captured amount is rejected (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/cinema/payments/refunds')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-theatre-id', theatreAId)
        .send({
          transactionId: rzpTxId,
          amount: 5000000, // 50,000 INR exceeds captured transaction amount
          reason: 'Excessive refund test'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message || '', /exceed/i);
    });
  });

  // =========================================================================
  // AUDIT AREA 7: ORDER SECURITY & STATE MACHINE INTEGRITY
  // =========================================================================
  describe('Area 7: Order Security & State Machine Integrity', () => {
    let lifecycleOrderId: string;
    let lifecycleStatusToken: string;

    before(async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id,
          showId: showA1Id,
          seatRow: 'A',
          seatNumber: '1',
          items: [{ productId: productA1Id, quantity: 1 }]
        });
      lifecycleOrderId = res.body.order.id;
      lifecycleStatusToken = res.body.statusToken;

      // Mark order as paid so it enters kitchen
      await db.update(orders).set({ paymentStatus: 'paid' }).where(eq(orders.id, lifecycleOrderId));
    });

    it('Public order tracking requires valid cryptographic statusToken (IDOR Protection)', async () => {
      // 1. Guessing orderId without token fails (404)
      const resFail = await request(app).get(`/api/cinema/public/orders/${lifecycleOrderId}`);
      assert.equal(resFail.status, 404);

      // 2. Supplying valid statusToken succeeds
      const resSuccess = await request(app)
        .get(`/api/cinema/public/orders/${lifecycleOrderId}`)
        .query({ statusToken: lifecycleStatusToken });
      assert.equal(resSuccess.status, 200);
      assert.equal(resSuccess.body.order.id, lifecycleOrderId);
    });

    it('State Machine: Direct jump from new/pending to delivered is rejected (400/403)', async () => {
      const res = await request(app)
        .post(`/api/cinema/delivery/orders/${lifecycleOrderId}/deliver`)
        .set('Cookie', cookieCinemaAAdmin)
        .set('x-theatre-id', theatreAId)
        .send({ notes: 'Invalid jump' });

      assert.equal(res.status, 400);
    });

    it('Delivery Security: Unassigned order in ready status CANNOT be marked delivered directly (400 Bad Request)', async () => {
      // Set order to ready (unassigned)
      await db
        .update(orders)
        .set({ status: 'ready', deliveryStatus: 'pending', deliveryStaffId: null })
        .where(eq(orders.id, lifecycleOrderId));

      const res = await request(app)
        .post(`/api/cinema/delivery/orders/${lifecycleOrderId}/deliver`)
        .set('Cookie', cookieCinemaADelivery1)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 400);
      assert.match(res.body.message || '', /assigned/i);
    });

    it('Delivery Security: Runner cannot mark order delivered if assigned to a different runner (403 Forbidden)', async () => {
      // Assign order to Runner 2
      await db
        .update(orders)
        .set({
          status: 'assigned_for_delivery',
          deliveryStatus: 'assigned',
          deliveryStaffId: userCinemaADelivery2Id,
          deliveryStaffName: 'Runner Two'
        })
        .where(eq(orders.id, lifecycleOrderId));

      // Runner 1 attempts to deliver Runner 2's assigned order
      const res = await request(app)
        .post(`/api/cinema/delivery/orders/${lifecycleOrderId}/deliver`)
        .set('Cookie', cookieCinemaADelivery1) // Authenticated as Runner 1
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 403);
      assert.match(res.body.message || '', /assigned delivery runner/i);
    });
  });

  // =========================================================================
  // AUDIT AREA 8: API SECURITY & INPUT VALIDATION
  // =========================================================================
  describe('Area 8: API Security & Input Validation', () => {
    it('Malformed JSON body with invalid types returns 400 Bad Request with Zod validation details', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: 12345, // Should be hex string
          screenId: 'not-a-uuid',
          items: 'not-an-array'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error || res.body.issues || res.body.message);
    });

    it('Error responses do not leak database connection strings or stack traces', async () => {
      const res = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .send({
          theatreToken: crypto.randomBytes(24).toString('hex'),
          screenId: '00000000-0000-0000-0000-000000000000',
          showId: '00000000-0000-0000-0000-000000000000',
          seatRow: 'Z',
          seatNumber: '99',
          items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }]
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.stack, undefined);
      assert.ok(!JSON.stringify(res.body).includes('postgresql://'));
    });
  });

  // =========================================================================
  // AUDIT AREA 9: CREDENTIAL SECURITY & SECRET MASKING
  // =========================================================================
  describe('Area 9: Credential Security & Secret Protection', () => {
    it('Merchant API secrets are encrypted at rest with AES-256-GCM', async () => {
      const [acc] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreAId),
            eq(cinemaPaymentAccounts.provider, 'razorpay')
          )
        )
        .limit(1);

      assert.ok(acc);
      assert.ok(acc.encryptedKeySecret);
      // Verify ciphertext is NOT cleartext
      assert.notEqual(acc.encryptedKeySecret, rawRazorpaySecret);
      // Verify decrypt recovers cleartext
      const decrypted = decryptSecret(acc.encryptedKeySecret);
      assert.equal(decrypted, rawRazorpaySecret);
    });

    it('Payment settings GET endpoint masks secret keys and never returns raw secrets', async () => {
      const res = await request(app)
        .get('/api/cinema/payments/settings')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-theatre-id', theatreAId);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.accounts));
      const rzpAcc = res.body.accounts.find((a: any) => a.provider === 'razorpay');
      assert.ok(rzpAcc);
      assert.equal(rzpAcc.maskedKeySecret, '••••••••');
      assert.equal(rzpAcc.hasWebhookSecret, true);
      assert.equal(rzpAcc.encryptedKeySecret, undefined);
      assert.ok(!JSON.stringify(res.body).includes(rawRazorpaySecret));
    });
  });

  // =========================================================================
  // AUDIT AREA 10: DATABASE RELIABILITY & CONCURRENCY
  // =========================================================================
  describe('Area 10: Database Reliability & Concurrency', () => {
    it('Idempotency: Repeated order creation with identical Idempotency-Key returns original order', async () => {
      const idempotencyKey = `idem_sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const res1 = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .set('idempotency-key', idempotencyKey)
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id,
          showId: showA1Id,
          seatRow: 'A',
          seatNumber: '2',
          items: [{ productId: productA1Id, quantity: 1 }]
        });

      assert.equal(res1.status, 201);
      const order1Id = res1.body.order.id;

      const res2 = await request(app)
        .post('/api/cinema/public/checkout/prepare')
        .set('idempotency-key', idempotencyKey)
        .send({
          theatreToken: theatreAToken,
          screenId: screenA1Id,
          showId: showA1Id,
          seatRow: 'A',
          seatNumber: '2',
          items: [{ productId: productA1Id, quantity: 1 }]
        });

      assert.equal(res2.status, 200);
      assert.equal(res2.body.idempotent, true);
      assert.equal(res2.body.order.id, order1Id);
    });
  });

  // =========================================================================
  // AUDIT AREA 11: AUDIT LOGS & ADMINISTRATIVE TRACEABILITY
  // =========================================================================
  describe('Area 11: Audit Logs & Traceability', () => {
    it('Every order status transition logs an entry in order_status_history', async () => {
      const historyRows = await db
        .select()
        .from(orderStatusHistory)
        .where(
          inArray(
            orderStatusHistory.orderId,
            db.select({ id: orders.id }).from(orders).where(eq(orders.restaurantId, theatreAId))
          )
        );

      assert.ok(historyRows.length > 0);
      const sample = historyRows[0];
      assert.ok(sample.orderId);
      assert.ok(sample.toStatus);
      assert.ok(sample.changedByRole);
      assert.ok(sample.createdAt);
    });

    it('Webhook processing generates audit logs in cinema_webhook_events', async () => {
      const webhookRows = await db
        .select()
        .from(cinemaWebhookEvents)
        .where(eq(cinemaWebhookEvents.theatreId, theatreAId));

      assert.ok(webhookRows.length > 0);
      const sample = webhookRows[0];
      assert.equal(sample.theatreId, theatreAId);
      assert.ok(sample.providerEventId);
    });
  });

  // =========================================================================
  // AUDIT AREA 12: RELIABILITY & STRESS HANDLING
  // =========================================================================
  describe('Area 12: Reliability & Stress Handling', () => {
    it('Concurrent requests for seat validation with valid parameters execute cleanly without crashing', async () => {
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get(`/api/cinema/public/seating/${theatreAToken}/${screenA1Id}`)
      );

      const responses = await Promise.all(promises);
      for (const res of responses) {
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.rows));
      }
    });
  });
});
