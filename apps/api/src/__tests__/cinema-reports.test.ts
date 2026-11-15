import { it, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  pool,
  user,
  restaurants,
  restaurantMembers,
  cinemaProfiles,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  cinemaPaymentTransactions,
  cinemaRefunds,
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';

describe('Task 18: Cinema Reports & Analytics', () => {
  let userCinemaAOwnerId: string;
  let userCinemaAStaffId: string;
  let userCinemaBOwnerId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaAOwner: string;
  let cookieCinemaAStaff: string;
  let cookieCinemaBOwner: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let screenA1Id: string;
  let screenA2Id: string;
  let movieA1Id: string;
  let movieA2Id: string;
  let showA1Id: string;
  let showA2Id: string;
  let showA3Id: string;

  let popcornProductId: string;
  let sodaProductId: string;
  let nachosProductId: string;

  let orderA1DeliveredId: string;
  let orderA2ReadyId: string;
  let orderA3PreparingId: string;
  let orderA4YesterdayDeliveredId: string;
  let orderA5CancelledId: string;
  let orderA6PendingId: string;
  let orderBPaidId: string;

  let paymentTransA3Id: string;
  let refundRecordA3Id: string;
  let todayStr: string;
  let yesterdayStr: string;

  const timestamp = Date.now();
  const createdUsersToClean: string[] = [];

  before(async () => {
    // 1. Create Cinema A Owner User
    const ownerAEmail = `theatreA.reports.owner.${timestamp}@example.com`;
    const ownerARes = await auth.api.signUpEmail({
      body: { name: 'PVR Reports Admin', email: ownerAEmail, password: 'password123' }
    });
    userCinemaAOwnerId = ownerARes.user.id;
    createdUsersToClean.push(userCinemaAOwnerId);

    const signinAOwner = await auth.api.signInEmail({
      body: { email: ownerAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAOwner = signinAOwner.headers.get('set-cookie') || '';

    // 2. Create Cinema A Staff User (Kitchen/Staff role - non-admin)
    const staffAEmail = `theatreA.reports.staff.${timestamp}@example.com`;
    const staffARes = await auth.api.signUpEmail({
      body: { name: 'PVR Reports Staff', email: staffAEmail, password: 'password123' }
    });
    userCinemaAStaffId = staffARes.user.id;
    createdUsersToClean.push(userCinemaAStaffId);

    const signinAStaff = await auth.api.signInEmail({
      body: { email: staffAEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaAStaff = signinAStaff.headers.get('set-cookie') || '';

    // 3. Create Cinema B Owner User (Tenant Isolation)
    const ownerBEmail = `theatreB.reports.owner.${timestamp}@example.com`;
    const ownerBRes = await auth.api.signUpEmail({
      body: { name: 'INOX Reports Admin', email: ownerBEmail, password: 'password123' }
    });
    userCinemaBOwnerId = ownerBRes.user.id;
    createdUsersToClean.push(userCinemaBOwnerId);

    const signinBOwner = await auth.api.signInEmail({
      body: { email: ownerBEmail, password: 'password123' },
      asResponse: true
    });
    cookieCinemaBOwner = signinBOwner.headers.get('set-cookie') || '';

    // 4. Create Restaurant Owner User (Cross-Tenant Security)
    const restEmail = `restaurant.reports.owner.${timestamp}@example.com`;
    const restRes = await auth.api.signUpEmail({
      body: { name: 'Bistro Reports Owner', email: restEmail, password: 'password123' }
    });
    userRestaurantOwnerId = restRes.user.id;
    createdUsersToClean.push(userRestaurantOwnerId);

    const signinRest = await auth.api.signInEmail({
      body: { email: restEmail, password: 'password123' },
      asResponse: true
    });
    cookieRestaurantOwner = signinRest.headers.get('set-cookie') || '';

    // 5. Seed Restaurants & Profiles
    await db.insert(restaurants).values([
      {
        id: theatreAId,
        name: `PVR Multiplex Reports ${timestamp}`,
        slug: `pvr-reports-${timestamp}`,
        tenantType: 'cinema',
        currency: 'INR'
      },
      {
        id: theatreBId,
        name: `INOX Leisure Reports ${timestamp}`,
        slug: `inox-reports-${timestamp}`,
        tenantType: 'cinema',
        currency: 'INR'
      },
      {
        id: restaurantId,
        name: `Urban Bistro Reports ${timestamp}`,
        slug: `urban-bistro-rep-${timestamp}`,
        tenantType: 'restaurant',
        currency: 'INR'
      }
    ]);

    await db.insert(cinemaProfiles).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        theatreName: 'PVR Reports Multiplex',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        contactNumber: '9876543210',
        contactEmail: 'contact@pvrreports.com',
        onboardingStage: 'completed'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreBId,
        theatreName: 'INOX Reports Leisure',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        contactNumber: '9123456789',
        contactEmail: 'contact@inoxreports.com',
        onboardingStage: 'completed'
      }
    ]);

    await db.insert(restaurantMembers).values([
      {
        id: crypto.randomUUID(),
        restaurantId: theatreAId,
        userId: userCinemaAOwnerId,
        role: 'owner'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: theatreAId,
        userId: userCinemaAStaffId,
        role: 'staff'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: theatreBId,
        userId: userCinemaBOwnerId,
        role: 'owner'
      },
      {
        id: crypto.randomUUID(),
        restaurantId: restaurantId,
        userId: userRestaurantOwnerId,
        role: 'owner'
      }
    ]);

    // 6. Seed Screens for Theatre A
    screenA1Id = crypto.randomUUID();
    screenA2Id = crypto.randomUUID();
    await db.insert(cinemaScreens).values([
      {
        id: screenA1Id,
        theatreId: theatreAId,
        screenName: 'Screen 1 IMAX',
        screenType: 'imax',
        totalRows: 1,
        totalSeats: 3,
        seatingConfigured: true
      },
      {
        id: screenA2Id,
        theatreId: theatreAId,
        screenName: 'Screen 2 Gold Class',
        screenType: 'gold_class',
        totalRows: 1,
        totalSeats: 2,
        seatingConfigured: true
      }
    ]);

    const rowA1Id = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowA1Id,
      theatreId: theatreAId,
      screenId: screenA1Id,
      rowIdentifier: 'A',
      sortOrder: 1,
      startSeatNumber: 1,
      endSeatNumber: 3,
      totalSeats: 3
    });

    await db.insert(cinemaSeats).values([
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'A',
        seatNumber: 1,
        seatIdentifier: 'A1',
        seatCategory: 'standard',
        status: 'active'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'A',
        seatNumber: 2,
        seatIdentifier: 'A2',
        seatCategory: 'standard',
        status: 'active'
      },
      {
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        screenId: screenA1Id,
        rowId: rowA1Id,
        rowIdentifier: 'A',
        seatNumber: 3,
        seatIdentifier: 'A3',
        seatCategory: 'standard',
        status: 'active'
      }
    ]);

    // 7. Seed Movies and Shows
    movieA1Id = crypto.randomUUID();
    movieA2Id = crypto.randomUUID();
    await db.insert(cinemaMovies).values([
      {
        id: movieA1Id,
        theatreId: theatreAId,
        title: 'Oppenheimer Reports Edition',
        language: 'English',
        durationMinutes: 180,
        status: 'active'
      },
      {
        id: movieA2Id,
        theatreId: theatreAId,
        title: 'Dune Part Two Reports Edition',
        language: 'English',
        durationMinutes: 166,
        status: 'active'
      }
    ]);

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    todayStr = formatter.format(now);
    const yesterdayDate = new Date(now.getTime() - 86400000);
    yesterdayStr = formatter.format(yesterdayDate);
    const yesterdayOrderTime = new Date(new Date(`${yesterdayStr}T12:00:00`).getTime() - 5.5 * 3600000);

    showA1Id = crypto.randomUUID();
    showA2Id = crypto.randomUUID();
    showA3Id = crypto.randomUUID();

    await db.insert(cinemaShows).values([
      {
        id: showA1Id,
        theatreId: theatreAId,
        screenId: screenA1Id,
        movieId: movieA1Id,
        showDate: todayStr,
        startTime: new Date(now.getTime() - 2 * 3600000),
        expectedEndTime: new Date(now.getTime() + 1 * 3600000),
        orderingStartTime: new Date(now.getTime() - 3 * 3600000),
        orderingEndTime: new Date(now.getTime() + 30 * 60000),
        status: 'published'
      },
      {
        id: showA2Id,
        theatreId: theatreAId,
        screenId: screenA2Id,
        movieId: movieA1Id,
        showDate: todayStr,
        startTime: new Date(now.getTime() - 1 * 3600000),
        expectedEndTime: new Date(now.getTime() + 2 * 3600000),
        orderingStartTime: new Date(now.getTime() - 2 * 3600000),
        orderingEndTime: new Date(now.getTime() + 90 * 60000),
        status: 'published'
      },
      {
        id: showA3Id,
        theatreId: theatreAId,
        screenId: screenA1Id,
        movieId: movieA2Id,
        showDate: yesterdayStr,
        startTime: new Date(yesterdayDate.getTime() - 2 * 3600000),
        expectedEndTime: new Date(yesterdayDate.getTime() + 1 * 3600000),
        orderingStartTime: new Date(yesterdayDate.getTime() - 3 * 3600000),
        orderingEndTime: new Date(yesterdayDate.getTime() + 30 * 60000),
        status: 'published'
      }
    ]);

    // 8. Seed Menu Products
    const catId = crypto.randomUUID();
    await db.insert(categories).values({
      id: catId,
      restaurantId: theatreAId,
      name: 'Cinema Snacks'
    });

    popcornProductId = crypto.randomUUID();
    sodaProductId = crypto.randomUUID();
    nachosProductId = crypto.randomUUID();

    await db.insert(products).values([
      {
        id: popcornProductId,
        restaurantId: theatreAId,
        categoryId: catId,
        name: 'Tub Salted Popcorn',
        price: 35000, // 350 INR in paise
        isAvailable: true
      },
      {
        id: sodaProductId,
        restaurantId: theatreAId,
        categoryId: catId,
        name: 'Chilled Pepsi 500ml',
        price: 15000, // 150 INR in paise
        isAvailable: true
      },
      {
        id: nachosProductId,
        restaurantId: theatreAId,
        categoryId: catId,
        name: 'Crispy Cheese Nachos',
        price: 25000, // 250 INR in paise
        isAvailable: true
      }
    ]);

    // 9. Seed Orders in Theatre A
    // Order 1: Today, Show A1 (Screen 1), status=delivered, paid via Razorpay (52500 paise)
    // Items: 1 Popcorn (35000) + 1 Soda (15000) = 50000 subtotal, 2500 tax
    orderA1DeliveredId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA1DeliveredId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-REP-01',
      orderType: 'cinema',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      paymentReference: 'pay_rzp_rep_01',
      subtotal: 50000,
      taxAmount: 2500,
      totalAmount: 52500,
      screenId: screenA1Id,
      movieId: movieA1Id,
      showId: showA1Id,
      seatRow: 'A',
      seatNumber: '1',
      statusToken: 'tok_rep_01_secure_key',
      deliveryStatus: 'delivered',
      createdAt: new Date(now.getTime() - 90 * 60000) // 90 mins ago today
    });
    await db.insert(orderItems).values([
      {
        id: crypto.randomUUID(),
        orderId: orderA1DeliveredId,
        productId: popcornProductId,
        productName: 'Tub Salted Popcorn',
        quantity: 1,
        unitPrice: 35000,
        subtotal: 35000
      },
      {
        id: crypto.randomUUID(),
        orderId: orderA1DeliveredId,
        productId: sodaProductId,
        productName: 'Chilled Pepsi 500ml',
        quantity: 1,
        unitPrice: 15000,
        subtotal: 15000
      }
    ]);
    await db.insert(cinemaPaymentTransactions).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      orderId: orderA1DeliveredId,
      provider: 'razorpay',
      providerOrderId: 'order_rzp_rep_01',
      providerPaymentId: 'pay_rzp_rep_01',
      amount: 52500,
      currency: 'INR',
      status: 'captured'
    });

    // Order 2: Today, Show A1 (Screen 1), status=ready, paid via Paytm (26250 paise)
    // Items: 1 Nachos (25000) = 25000 subtotal, 1250 tax
    orderA2ReadyId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA2ReadyId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-REP-02',
      orderType: 'cinema',
      status: 'ready',
      paymentStatus: 'paid',
      paymentMethod: 'paytm',
      paymentReference: 'pay_ptm_rep_02',
      subtotal: 25000,
      taxAmount: 1250,
      totalAmount: 26250,
      screenId: screenA1Id,
      movieId: movieA1Id,
      showId: showA1Id,
      seatRow: 'A',
      seatNumber: '2',
      statusToken: 'tok_rep_02_secure_key',
      deliveryStatus: 'unassigned',
      createdAt: new Date(now.getTime() - 45 * 60000) // 45 mins ago today
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA2ReadyId,
      productId: nachosProductId,
      productName: 'Crispy Cheese Nachos',
      quantity: 1,
      unitPrice: 25000,
      subtotal: 25000
    });
    await db.insert(cinemaPaymentTransactions).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      orderId: orderA2ReadyId,
      provider: 'paytm',
      providerOrderId: 'order_ptm_rep_02',
      providerPaymentId: 'pay_ptm_rep_02',
      amount: 26250,
      currency: 'INR',
      status: 'captured'
    });

    // Order 3: Today, Show A2 (Screen 2), status=preparing, paid via Razorpay (36750 paise)
    // With 5000 paise processed refund
    // Items: 1 Popcorn (35000) = 35000 subtotal, 1750 tax
    orderA3PreparingId = crypto.randomUUID();
    paymentTransA3Id = crypto.randomUUID();
    refundRecordA3Id = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA3PreparingId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-REP-03',
      orderType: 'cinema',
      status: 'preparing',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      paymentReference: 'pay_rzp_rep_03',
      subtotal: 35000,
      taxAmount: 1750,
      totalAmount: 36750,
      screenId: screenA2Id,
      movieId: movieA1Id,
      showId: showA2Id,
      seatRow: 'A',
      seatNumber: '3',
      statusToken: 'tok_rep_03_secure_key',
      deliveryStatus: 'unassigned',
      createdAt: new Date(now.getTime() - 20 * 60000) // 20 mins ago today
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA3PreparingId,
      productId: popcornProductId,
      productName: 'Tub Salted Popcorn',
      quantity: 1,
      unitPrice: 35000,
      subtotal: 35000
    });
    await db.insert(cinemaPaymentTransactions).values({
      id: paymentTransA3Id,
      theatreId: theatreAId,
      orderId: orderA3PreparingId,
      provider: 'razorpay',
      providerOrderId: 'order_rzp_rep_03',
      providerPaymentId: 'pay_rzp_rep_03',
      amount: 36750,
      currency: 'INR',
      status: 'captured'
    });
    await db.insert(cinemaRefunds).values({
      id: refundRecordA3Id,
      theatreId: theatreAId,
      orderId: orderA3PreparingId,
      transactionId: paymentTransA3Id,
      provider: 'razorpay',
      providerRefundId: 'rfnd_rzp_rep_03',
      amount: 5000,
      status: 'REFUND_PROCESSED',
      initiatedBy: userCinemaAOwnerId,
      reason: 'Partial courtesy refund approved'
    });

    // Order 4: Yesterday, Show A3 (Screen 1), status=delivered, paid via Razorpay (15750 paise)
    // Items: 1 Soda (15000) = 15000 subtotal, 750 tax
    orderA4YesterdayDeliveredId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA4YesterdayDeliveredId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-REP-04',
      orderType: 'cinema',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      paymentReference: 'pay_rzp_rep_04',
      subtotal: 15000,
      taxAmount: 750,
      totalAmount: 15750,
      screenId: screenA1Id,
      movieId: movieA2Id,
      showId: showA3Id,
      seatRow: 'A',
      seatNumber: '1',
      statusToken: 'tok_rep_04_secure_key',
      deliveryStatus: 'delivered',
      createdAt: yesterdayOrderTime // Yesterday noon IST
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA4YesterdayDeliveredId,
      productId: sodaProductId,
      productName: 'Chilled Pepsi 500ml',
      quantity: 1,
      unitPrice: 15000,
      subtotal: 15000
    });
    await db.insert(cinemaPaymentTransactions).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      orderId: orderA4YesterdayDeliveredId,
      provider: 'razorpay',
      providerOrderId: 'order_rzp_rep_04',
      providerPaymentId: 'pay_rzp_rep_04',
      amount: 15750,
      currency: 'INR',
      status: 'captured'
    });

    // Order 5: Today, Show A1 (Screen 1), status=cancelled, paymentStatus=failed via Paytm (36750 paise)
    // Should NOT count towards sales!
    orderA5CancelledId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA5CancelledId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-REP-05',
      orderType: 'cinema',
      status: 'cancelled',
      paymentStatus: 'failed',
      paymentMethod: 'paytm',
      subtotal: 35000,
      taxAmount: 1750,
      totalAmount: 36750,
      screenId: screenA1Id,
      movieId: movieA1Id,
      showId: showA1Id,
      seatRow: 'A',
      seatNumber: '2',
      statusToken: 'tok_rep_05_secure_key',
      createdAt: new Date(now.getTime() - 30 * 60000)
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA5CancelledId,
      productId: popcornProductId,
      productName: 'Tub Salted Popcorn',
      quantity: 1,
      unitPrice: 35000,
      subtotal: 35000
    });
    await db.insert(cinemaPaymentTransactions).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      orderId: orderA5CancelledId,
      provider: 'paytm',
      providerOrderId: 'order_ptm_rep_05',
      amount: 36750,
      currency: 'INR',
      status: 'failed'
    });

    // Order 6: Today, Show A1 (Screen 1), status=new, paymentStatus=pending via Razorpay (26250 paise)
    // Should NOT count towards captured sales!
    orderA6PendingId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderA6PendingId,
      restaurantId: theatreAId,
      orderNumber: 'CIN-REP-06',
      orderType: 'cinema',
      status: 'new',
      paymentStatus: 'pending',
      paymentMethod: 'razorpay',
      subtotal: 25000,
      taxAmount: 1250,
      totalAmount: 26250,
      screenId: screenA1Id,
      movieId: movieA1Id,
      showId: showA1Id,
      seatRow: 'A',
      seatNumber: '3',
      statusToken: 'tok_rep_06_secure_key',
      createdAt: new Date(now.getTime() - 10 * 60000)
    });
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId: orderA6PendingId,
      productId: nachosProductId,
      productName: 'Crispy Cheese Nachos',
      quantity: 1,
      unitPrice: 25000,
      subtotal: 25000
    });
    await db.insert(cinemaPaymentTransactions).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      orderId: orderA6PendingId,
      provider: 'razorpay',
      providerOrderId: 'order_rzp_rep_06',
      amount: 26250,
      currency: 'INR',
      status: 'initiated'
    });

    // Order B: Cinema B order (Tenant Isolation Verification)
    orderBPaidId = crypto.randomUUID();
    await db.insert(orders).values({
      id: orderBPaidId,
      restaurantId: theatreBId,
      orderNumber: 'INOX-REP-99',
      orderType: 'cinema',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      subtotal: 40000,
      taxAmount: 2000,
      totalAmount: 42000,
      statusToken: 'tok_rep_b_99_secure_key',
      createdAt: new Date()
    });
  });

  after(async () => {
    // Teardown created test records
    await db.delete(cinemaRefunds).where(eq(cinemaRefunds.theatreId, theatreAId));
    await db.delete(cinemaPaymentTransactions).where(eq(cinemaPaymentTransactions.theatreId, theatreAId));
    await db.delete(orderItems).where(inArray(orderItems.orderId, [
      orderA1DeliveredId,
      orderA2ReadyId,
      orderA3PreparingId,
      orderA4YesterdayDeliveredId,
      orderA5CancelledId,
      orderA6PendingId
    ]));
    await db.delete(orders).where(inArray(orders.restaurantId, [theatreAId, theatreBId]));
    await db.delete(cinemaShows).where(inArray(cinemaShows.id, [showA1Id, showA2Id, showA3Id]));
    await db.delete(cinemaMovies).where(inArray(cinemaMovies.id, [movieA1Id, movieA2Id]));
    await db.delete(cinemaSeats).where(eq(cinemaSeats.screenId, screenA1Id));
    await db.delete(cinemaRows).where(eq(cinemaRows.screenId, screenA1Id));
    await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, [theatreAId, theatreBId]));
    await db.delete(products).where(eq(products.restaurantId, theatreAId));
    await db.delete(categories).where(eq(categories.restaurantId, theatreAId));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId]));
    await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));

    if (createdUsersToClean.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }

    await pool.end().catch(() => {});
  });

  // =========================================================================
  // 1. Consolidated Cinema Reports (GET /api/cinema/reports)
  // =========================================================================
  describe('Consolidated Reports Engine (GET /api/cinema/reports)', () => {
    it('should return complete consolidated report payload with all sections and metrics', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.theatreId, theatreAId);
      assert.strictEqual(res.body.currency, 'INR');
      assert.strictEqual(res.body.timezone, 'Asia/Kolkata');

      // Check top-level report structures
      assert.ok(res.body.summary, 'Must contain summary');
      assert.ok(Array.isArray(res.body.dailySales), 'Must contain dailySales array');
      assert.ok(Array.isArray(res.body.screenReports), 'Must contain screenReports array');
      assert.ok(Array.isArray(res.body.showReports), 'Must contain showReports array');
      assert.ok(Array.isArray(res.body.productReports), 'Must contain productReports array');
      assert.ok(res.body.paymentReports, 'Must contain paymentReports object');
      assert.ok(res.body.fulfilmentReports, 'Must contain fulfilmentReports object');

      // Check Summary Metrics values for Theatre A:
      // Total orders = 6
      assert.strictEqual(res.body.summary.totalOrders, 6);
      // Gross sales = 52500 + 26250 + 36750 + 15750 = 131250 paise
      assert.strictEqual(res.body.summary.grossSales, 131250);
      // Refunds = 5000 paise
      assert.strictEqual(res.body.summary.totalRefunds, 5000);
      // Net sales = 131250 - 5000 = 126250 paise
      assert.strictEqual(res.body.summary.netSales, 126250);
      // Delivered orders = 2
      assert.strictEqual(res.body.summary.deliveredOrders, 2);
      // Cancelled orders = 1
      assert.strictEqual(res.body.summary.cancelledOrders, 1);
      // Paid orders = 4
      assert.strictEqual(res.body.summary.paymentSummary.paid, 4);
      // Average Order Value = 131250 / 4 = 32813 paise (rounded)
      assert.strictEqual(res.body.summary.averageOrderValue, Math.round(131250 / 4));
    });

    it('should maintain mathematical accuracy: netSales === grossSales - totalRefunds', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      const { grossSales, netSales, totalRefunds } = res.body.summary;
      assert.strictEqual(netSales, grossSales - totalRefunds, 'Net sales must strictly equal gross minus refunds');
    });
  });

  // =========================================================================
  // 2. Summary Overview API (GET /api/cinema/reports/summary)
  // =========================================================================
  describe('Summary Overview (GET /api/cinema/reports/summary)', () => {
    it('should return summary KPIs, payment status breakdown, and lifecycle rates', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/summary')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.summary.totalOrders, 6);
      assert.strictEqual(res.body.summary.paymentSummary.paid, 4);
      assert.strictEqual(res.body.summary.paymentSummary.pending.count, 1);
      assert.strictEqual(res.body.summary.paymentSummary.failed.count, 1);

      // Delivery Rate: 2 delivered / 6 total = 33.3%
      assert.strictEqual(res.body.summary.deliveryRate, 33.3);
      // Cancellation Rate: 1 cancelled / 6 total = 16.7%
      assert.strictEqual(res.body.summary.cancellationRate, 16.7);
    });
  });

  // =========================================================================
  // 3. Daily Sales Reports (GET /api/cinema/reports/daily)
  // =========================================================================
  describe('Daily Sales Reports (GET /api/cinema/reports/daily)', () => {
    it('should aggregate sales grouped by operating date in theatre timezone', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/daily')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      const days = res.body.dailySales;
      assert.ok(Array.isArray(days));
      assert.ok(days.length >= 2, 'Must have at least 2 operating dates (today and yesterday)');

      // Verify each daily row structure
      for (const day of days) {
        assert.ok(day.operatingDate, 'Must have operatingDate in YYYY-MM-DD');
        assert.ok(typeof day.orderCount === 'number');
        assert.ok(typeof day.grossSales === 'number');
        assert.ok(typeof day.refunds === 'number');
        assert.ok(typeof day.netSales === 'number');
        assert.strictEqual(day.netSales, day.grossSales - day.refunds, 'Daily netSales must equal gross minus refunds');
      }

      // Verify yesterday's sales: exactly 1 order (Order 4) = 15750 paise gross, 0 refund, 15750 net
      const yesterdayRecord = days.find((d: any) => d.operatingDate === yesterdayStr || d.date === yesterdayStr);
      assert.ok(yesterdayRecord, `Yesterday record (${yesterdayStr}) must be present`);
      assert.strictEqual(yesterdayRecord.grossSales, 15750);
      assert.strictEqual(yesterdayRecord.netSales, 15750);
      assert.strictEqual(yesterdayRecord.deliveredOrders, 1);
    });
  });

  // =========================================================================
  // 4. Screen-Wise Reports (GET /api/cinema/reports/screens)
  // =========================================================================
  describe('Screen-Wise Reports (GET /api/cinema/reports/screens)', () => {
    it('should compare food sales and order volume across cinema screens', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/screens')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      const screens = res.body.screenReports;
      assert.ok(Array.isArray(screens));
      assert.strictEqual(screens.length, 2, 'Should report both Screen 1 and Screen 2');

      const screen1 = screens.find((s: any) => s.screenId === screenA1Id);
      const screen2 = screens.find((s: any) => s.screenId === screenA2Id);

      assert.ok(screen1, 'Screen 1 IMAX report must be present');
      assert.ok(screen2, 'Screen 2 Gold Class report must be present');

      // Screen 1: Paid Orders 1, 2, 4 -> Gross: 52500 + 26250 + 15750 = 94500 paise, Net: 94500 paise
      assert.strictEqual(screen1.grossSales, 94500);
      assert.strictEqual(screen1.refunds, 0);
      assert.strictEqual(screen1.netSales, 94500);

      // Screen 2: Paid Order 3 -> Gross: 36750 paise, Refund: 5000 paise, Net: 31750 paise
      assert.strictEqual(screen2.grossSales, 36750);
      assert.strictEqual(screen2.refunds, 5000);
      assert.strictEqual(screen2.netSales, 31750);

      // Verify contribution percent sums to 100% (72.0% + 28.0% = 100.0%)
      const totalContribution = Number((screen1.contributionPercent + screen2.contributionPercent).toFixed(1));
      assert.ok(Math.abs(totalContribution - 100.0) <= 0.1, `Contribution should sum to ~100%, got ${totalContribution}`);
    });
  });

  // =========================================================================
  // 5. Show-Wise Reports (GET /api/cinema/reports/shows)
  // =========================================================================
  describe('Show-Wise Reports (GET /api/cinema/reports/shows)', () => {
    it('should aggregate order counts and sales for individual movie screenings', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/shows')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      const shows = res.body.showReports;
      assert.ok(Array.isArray(shows));
      assert.ok(shows.length >= 3, 'Must report all 3 shows');

      // Show A1 (Oppenheimer, Screen 1): Order 1 (52500), Order 2 (26250) -> Gross: 78750 paise
      const show1 = shows.find((s: any) => s.showId === showA1Id);
      assert.ok(show1, 'Show A1 must be present');
      assert.strictEqual(show1.movieTitle, 'Oppenheimer Reports Edition');
      assert.strictEqual(show1.screenName, 'Screen 1 IMAX');
      assert.strictEqual(show1.grossSales, 78750);
      assert.strictEqual(show1.netSales, 78750);

      // Show A2 (Oppenheimer, Screen 2): Order 3 (36750 gross, 5000 refund, 31750 net)
      const show2 = shows.find((s: any) => s.showId === showA2Id);
      assert.ok(show2, 'Show A2 must be present');
      assert.strictEqual(show2.grossSales, 36750);
      assert.strictEqual(show2.refunds, 5000);
      assert.strictEqual(show2.netSales, 31750);

      // Show A3 (Dune 2, Screen 1): Order 4 (15750 gross, 0 refund)
      const show3 = shows.find((s: any) => s.showId === showA3Id);
      assert.ok(show3, 'Show A3 must be present');
      assert.strictEqual(show3.movieTitle, 'Dune Part Two Reports Edition');
      assert.strictEqual(show3.grossSales, 15750);
    });
  });

  // =========================================================================
  // 6. Product-Wise Reports (GET /api/cinema/reports/products)
  // =========================================================================
  describe('Product-Wise Reports (GET /api/cinema/reports/products)', () => {
    it('should accurately aggregate food items, quantities sold, revenue, and contribution', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/products')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      const productsList = res.body.productReports;
      assert.ok(Array.isArray(productsList));

      // Paid orders contain:
      // Popcorn: Order 1 (1 qty, 35000), Order 3 (1 qty, 35000) = 2 qty, 70000 paise
      // Soda: Order 1 (1 qty, 15000), Order 4 (1 qty, 15000) = 2 qty, 30000 paise
      // Nachos: Order 2 (1 qty, 25000) = 1 qty, 25000 paise
      // Note: Order 5 (cancelled) and Order 6 (pending) popcorn and nachos MUST NOT be included!
      const popcorn = productsList.find((p: any) => p.productId === popcornProductId);
      const soda = productsList.find((p: any) => p.productId === sodaProductId);
      const nachos = productsList.find((p: any) => p.productId === nachosProductId);

      assert.ok(popcorn, 'Popcorn report must be present');
      assert.strictEqual(popcorn.quantitySold, 2);
      assert.strictEqual(popcorn.totalRevenue, 70000);
      assert.strictEqual(popcorn.categoryName, 'Cinema Snacks');

      assert.ok(soda, 'Soda report must be present');
      assert.strictEqual(soda.quantitySold, 2);
      assert.strictEqual(soda.totalRevenue, 30000);

      assert.ok(nachos, 'Nachos report must be present');
      assert.strictEqual(nachos.quantitySold, 1);
      assert.strictEqual(nachos.totalRevenue, 25000);

      // Verify total food revenue = 70000 + 30000 + 25000 = 125000 paise
      // Sales contributions:
      // Popcorn: 70000 / 125000 = 56.0%
      // Soda: 30000 / 125000 = 24.0%
      // Nachos: 25000 / 125000 = 20.0%
      assert.strictEqual(popcorn.salesContribution, 56.0);
      assert.strictEqual(soda.salesContribution, 24.0);
      assert.strictEqual(nachos.salesContribution, 20.0);
    });
  });

  // =========================================================================
  // 7. Payment Gateway Reports (GET /api/cinema/reports/payments)
  // =========================================================================
  describe('Payment Gateway Reports (GET /api/cinema/reports/payments)', () => {
    it('should report Razorpay vs Paytm transaction counts, volumes, refunds, and net settlement', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/payments')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      const { providers, totalNetSettlement } = res.body.paymentReports;
      assert.ok(Array.isArray(providers));

      const rzp = providers.find((p: any) => p.provider === 'razorpay');
      const ptm = providers.find((p: any) => p.provider === 'paytm');

      assert.ok(rzp, 'Razorpay provider stats must be present');
      assert.ok(ptm, 'Paytm provider stats must be present');

      // Razorpay:
      // Order 1 (52500 captured), Order 3 (36750 captured, 5000 refund), Order 4 (15750 captured), Order 6 (26250 pending)
      assert.strictEqual(rzp.capturedCount, 3);
      assert.strictEqual(rzp.pendingCount, 1);
      assert.strictEqual(rzp.failedCount, 0);
      assert.strictEqual(rzp.grossCapturedAmount, 105000);
      assert.strictEqual(rzp.refundedAmount, 5000);
      assert.strictEqual(rzp.netSettlement, 100000);

      // Paytm:
      // Order 2 (26250 captured), Order 5 (36750 failed)
      assert.strictEqual(ptm.capturedCount, 1);
      assert.strictEqual(ptm.pendingCount, 0);
      assert.strictEqual(ptm.failedCount, 1);
      assert.strictEqual(ptm.grossCapturedAmount, 26250);
      assert.strictEqual(ptm.refundedAmount, 0);
      assert.strictEqual(ptm.netSettlement, 26250);

      // Total Net Settlement = 100000 + 26250 = 126250 paise
      assert.strictEqual(totalNetSettlement, 126250);
    });
  });

  // =========================================================================
  // 8. Order Fulfilment Pipeline (GET /api/cinema/reports/fulfilment)
  // =========================================================================
  describe('Order Fulfilment Pipeline (GET /api/cinema/reports/fulfilment)', () => {
    it('should report order counts across lifecycle states with delivery and cancellation rates', async () => {
      const res = await request(app)
        .get('/api/cinema/reports/fulfilment')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      const stages = res.body.fulfilmentReports.stages;
      assert.ok(Array.isArray(stages));

      // States present in test:
      // new: Order 6 (1)
      // preparing: Order 3 (1)
      // ready: Order 2 (1)
      // delivered: Order 1, Order 4 (2)
      // cancelled: Order 5 (1)
      const stageMap = new Map(stages.map((s: any) => [s.status, s.count]));
      assert.strictEqual(stageMap.get('new'), 1);
      assert.strictEqual(stageMap.get('preparing'), 1);
      assert.strictEqual(stageMap.get('ready'), 1);
      assert.strictEqual(stageMap.get('delivered'), 2);
      assert.strictEqual(stageMap.get('cancelled'), 1);

      assert.strictEqual(res.body.deliveryRate, 33.3);
      assert.strictEqual(res.body.cancellationRate, 16.7);
    });
  });

  // =========================================================================
  // 9. Multi-Dimension Filtering
  // =========================================================================
  describe('Multi-Dimension Report Filtering', () => {
    it('should filter reports by dateRange=today (excluding yesterday orders)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'today' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      // Today orders: Order 1 (52500), Order 2 (26250), Order 3 (36750, 5000 ref), Order 5 (cancelled), Order 6 (pending)
      // Total orders today = 5
      assert.strictEqual(res.body.summary.totalOrders, 5);
      // Gross sales = 52500 + 26250 + 36750 = 115500 paise (excludes yesterday's 15750)
      assert.strictEqual(res.body.summary.grossSales, 115500);
      assert.strictEqual(res.body.summary.netSales, 110500);
      assert.strictEqual(res.body.summary.deliveredOrders, 1); // Only Order 1
    });

    it('should filter reports by dateRange=yesterday', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'yesterday' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      // Yesterday orders: exactly Order 4 (15750 paise, delivered)
      assert.strictEqual(res.body.summary.totalOrders, 1);
      assert.strictEqual(res.body.summary.grossSales, 15750);
      assert.strictEqual(res.body.summary.netSales, 15750);
      assert.strictEqual(res.body.summary.deliveredOrders, 1);
    });

    it('should filter reports by screenId (Screen 2 only)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', screenId: screenA2Id })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      // Screen 2 only has Order 3
      assert.strictEqual(res.body.summary.totalOrders, 1);
      assert.strictEqual(res.body.summary.grossSales, 36750);
      assert.strictEqual(res.body.summary.netSales, 31750);
      assert.strictEqual(res.body.summary.totalRefunds, 5000);
    });

    it('should filter reports by payment provider (paytm only)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', provider: 'paytm' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      // Paytm orders: Order 2 (paid, 26250), Order 5 (failed, 36750)
      assert.strictEqual(res.body.summary.totalOrders, 2);
      assert.strictEqual(res.body.summary.grossSales, 26250);
      assert.strictEqual(res.body.summary.netSales, 26250);
      assert.strictEqual(res.body.summary.cancelledOrders, 1);
    });

    it('should filter reports by order status (delivered only)', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAOwner)
        .set('x-restaurant-id', theatreAId)
        .query({ dateRange: 'all', status: 'delivered' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      // Delivered orders: Order 1 (52500) and Order 4 (15750)
      assert.strictEqual(res.body.summary.totalOrders, 2);
      assert.strictEqual(res.body.summary.grossSales, 68250);
      assert.strictEqual(res.body.summary.deliveredOrders, 2);
    });
  });

  // =========================================================================
  // 10. Security, Tenant Isolation & Access Control
  // =========================================================================
  describe('Security & Tenant Isolation', () => {
    it('should reject unauthenticated request with 401', async () => {
      await request(app)
        .get('/api/cinema/reports')
        .set('x-restaurant-id', theatreAId)
        .expect(401);
    });

    it('should strictly isolate Theatre B reports from Theatre A', async () => {
      const resB = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaBOwner)
        .set('x-restaurant-id', theatreBId)
        .query({ dateRange: 'all' })
        .expect(200);

      assert.strictEqual(resB.body.success, true);
      assert.strictEqual(resB.body.theatreId, theatreBId);
      // Theatre B has only 1 order (Order B1, 42000 paise)
      assert.strictEqual(resB.body.summary.totalOrders, 1);
      assert.strictEqual(resB.body.summary.grossSales, 42000);
      assert.strictEqual(resB.body.summary.netSales, 42000);
      assert.strictEqual(resB.body.summary.totalRefunds, 0);

      // Verify Theatre B sees zero screens or shows from Theatre A
      const bScreenIds = resB.body.screenReports.map((s: any) => s.screenId);
      assert.ok(!bScreenIds.includes(screenA1Id));
      assert.ok(!bScreenIds.includes(screenA2Id));
    });

    it('should reject restaurant tenant from accessing cinema reports with 403', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieRestaurantOwner)
        .set('x-restaurant-id', restaurantId)
        .expect(403);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message || res.body.error, /cross-module access denied|only accessible by cinema/i);
    });

    it('should reject non-admin staff from accessing reports with 403', async () => {
      const res = await request(app)
        .get('/api/cinema/reports')
        .set('Cookie', cookieCinemaAStaff)
        .set('x-restaurant-id', theatreAId)
        .expect(403);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message || res.body.error, /insufficient permissions|forbidden|access/i);
    });
  });

  // =========================================================================
  // 11. Restaurant Dine-in Regression Guard
  // =========================================================================
  describe('Restaurant Dine-in Regression Guard', () => {
    it('should ensure standard restaurant orders endpoint functions independently', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Cookie', cookieRestaurantOwner)
        .set('x-restaurant-id', restaurantId)
        .expect(200);

      assert.ok(Array.isArray(res.body), 'Restaurant orders list must return an array');
    });
  });
});
