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
  cinemaQrCodes,
  cinemaCarts,
  categories,
  products,
  restaurantTables,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 10: Cinema Cart and Checkout', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantId: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let screen1AId: string;
  let screen1BId: string;

  let movie1AId: string;
  let publishedShowOpenId: string;
  let publishedShowClosedId: string;

  let theatreAQrToken: string;
  let screen1AQrToken: string;

  let prodPopcornId: string;
  let prodCokeId: string;
  let prodNachosId: string;
  let prodSoldOutId: string;
  let prodTheatreBId: string;

  let activeCartToken: string;
  let preparedOrderId: string;

  before(async () => {
    // 1. Create Cinema Administrator for Theatre A
    const userA = await auth.api.signUpEmail({
      body: {
        email: `theatre-cart-a-${Date.now()}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre Cart Admin A'
      }
    });
    userCinemaAId = userA.user.id;

    // 2. Create Cinema Administrator for Theatre B
    const userB = await auth.api.signUpEmail({
      body: {
        email: `theatre-cart-b-${Date.now()}@cinema.com`,
        password: 'Password123!',
        name: 'Theatre Cart Admin B'
      }
    });
    userCinemaBId = userB.user.id;

    // 3. Create Restaurant Owner for Regression Testing
    const userRest = await auth.api.signUpEmail({
      body: {
        email: `rest-cart-owner-${Date.now()}@restaurant.com`,
        password: 'Password123!',
        name: 'Restaurant Owner'
      }
    });
    userRestaurantId = userRest.user.id;

    // 4. Create Theatre A tenant
    await db.insert(restaurants).values({
      id: theatreAId,
      name: 'PVR Nexus Grand Cinemas',
      slug: `pvr-nexus-${Date.now()}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true,
      settings: { taxPercentage: 5 } // 5% GST standard
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreAId,
      theatreName: 'PVR Nexus Grand Cinemas',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9876543210',
      contactEmail: 'contact@pvrnexus.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      onboardingCompleted: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreAId,
      userId: userCinemaAId,
      role: 'owner'
    });

    // 5. Create Theatre B tenant (for cross-tenant rejection)
    await db.insert(restaurants).values({
      id: theatreBId,
      name: 'INOX Forum Mall',
      slug: `inox-forum-${Date.now()}`,
      currency: 'INR',
      tenantType: 'cinema',
      isActive: true,
      settings: { taxPercentage: 5 }
    });

    await db.insert(cinemaProfiles).values({
      theatreId: theatreBId,
      theatreName: 'INOX Forum Mall',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      contactNumber: '9123456780',
      contactEmail: 'contact@inoxforum.com',
      currency: 'INR',
      onboardingCompleted: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId: theatreBId,
      userId: userCinemaBId,
      role: 'owner'
    });

    // 6. Create Restaurant tenant (for regression testing)
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Spice Garden Dine-In',
      slug: `spice-garden-${Date.now()}`,
      currency: 'INR',
      tenantType: 'restaurant',
      isActive: true
    });

    await db.insert(restaurantMembers).values({
      restaurantId,
      userId: userRestaurantId,
      role: 'owner'
    });

    // 7. Screens & Seating for Theatre A
    screen1AId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1AId,
      theatreId: theatreAId,
      screenName: 'Audi 1 (Dolby Atmos)',
      screenType: 'dolby_atmos',
      status: 'active'
    });

    const rowFId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowFId,
      theatreId: theatreAId,
      screenId: screen1AId,
      rowIdentifier: 'F',
      seatCategory: 'premium',
      startSeatNumber: 1,
      endSeatNumber: 15,
      totalSeats: 15,
      status: 'active'
    });

    await db.insert(cinemaSeats).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      screenId: screen1AId,
      rowId: rowFId,
      rowIdentifier: 'F',
      seatNumber: 12,
      seatIdentifier: 'F12',
      seatCategory: 'premium',
      status: 'active'
    });

    // Screen for Theatre B
    screen1BId = crypto.randomUUID();
    await db.insert(cinemaScreens).values({
      id: screen1BId,
      theatreId: theatreBId,
      screenName: 'Screen B1',
      screenType: 'standard',
      status: 'active'
    });

    // 8. Movie for Theatre A
    movie1AId = crypto.randomUUID();
    await db.insert(cinemaMovies).values({
      id: movie1AId,
      theatreId: theatreAId,
      title: 'Interstellar: The IMAX Experience',
      language: 'English',
      durationMinutes: 169,
      status: 'active'
    });

    // 9. Published Shows for Theatre A
    // Open ordering window: now - 30m to now + 60m
    const now = new Date();
    publishedShowOpenId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: publishedShowOpenId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie1AId,
      showDate: '2026-11-14',
      startTime: new Date(now.getTime() - 15 * 60000),
      expectedEndTime: new Date(now.getTime() + 150 * 60000),
      orderingStartTime: new Date(now.getTime() - 30 * 60000),
      orderingEndTime: new Date(now.getTime() + 60 * 60000),
      turnaroundBufferMinutes: 15,
      status: 'published'
    });

    // Closed ordering window: past show (ended earlier)
    publishedShowClosedId = crypto.randomUUID();
    await db.insert(cinemaShows).values({
      id: publishedShowClosedId,
      theatreId: theatreAId,
      screenId: screen1AId,
      movieId: movie1AId,
      showDate: '2026-11-14',
      startTime: new Date(now.getTime() - 300 * 60000),
      expectedEndTime: new Date(now.getTime() - 120 * 60000),
      orderingStartTime: new Date(now.getTime() - 320 * 60000),
      orderingEndTime: new Date(now.getTime() - 130 * 60000),
      turnaroundBufferMinutes: 15,
      status: 'published'
    });

    // 10. QR Codes for Theatre A
    theatreAQrToken = crypto.randomBytes(24).toString('hex');
    await db.insert(cinemaQrCodes).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      qrType: 'theatre',
      qrName: 'Main Lobby Stand',
      token: theatreAQrToken,
      targetUrl: `http://localhost:3000/cinema/${theatreAQrToken}`,
      qrCodeData: 'data:image/png;base64,mock',
      status: 'active'
    });

    screen1AQrToken = crypto.randomBytes(24).toString('hex');
    await db.insert(cinemaQrCodes).values({
      id: crypto.randomUUID(),
      theatreId: theatreAId,
      screenId: screen1AId,
      qrType: 'screen',
      qrName: 'Audi 1 Entrance Stand',
      token: screen1AQrToken,
      theatreToken: theatreAQrToken,
      screenToken: screen1AQrToken,
      targetUrl: `http://localhost:3000/cinema/${theatreAQrToken}/${screen1AQrToken}`,
      qrCodeData: 'data:image/png;base64,mock',
      status: 'active'
    });

    // 11. Food Products under Theatre A
    const [popcorn] = await db
      .insert(products)
      .values({
        restaurantId: theatreAId,
        name: 'Jumbo Butter Popcorn',
        price: 24000, // ₹240.00
        isVegetarian: true,
        isAvailable: true
      })
      .returning();
    prodPopcornId = popcorn!.id;

    const [coke] = await db
      .insert(products)
      .values({
        restaurantId: theatreAId,
        name: 'Chilled Coke (650ml)',
        price: 12000, // ₹120.00
        isVegetarian: true,
        isAvailable: true
      })
      .returning();
    prodCokeId = coke!.id;

    const [nachos] = await db
      .insert(products)
      .values({
        restaurantId: theatreAId,
        name: 'Loaded Salsa Nachos Combo',
        price: 35000, // ₹350.00
        isVegetarian: true,
        isAvailable: true
      })
      .returning();
    prodNachosId = nachos!.id;

    const [soldOut] = await db
      .insert(products)
      .values({
        restaurantId: theatreAId,
        name: 'Crispy Veg Samosa (Sold Out)',
        price: 15000,
        isVegetarian: true,
        isAvailable: false // Sold out
      })
      .returning();
    prodSoldOutId = soldOut!.id;

    // 12. Food Product under Theatre B (for cross-tenant testing)
    const [theatreBProd] = await db
      .insert(products)
      .values({
        restaurantId: theatreBId,
        name: 'Theatre B Gourmet Burger',
        price: 28000,
        isVegetarian: false,
        isAvailable: true
      })
      .returning();
    prodTheatreBId = theatreBProd!.id;

    // 13. Restaurant Table & Products (for regression testing)
    const [restTable] = await db
      .insert(restaurantTables)
      .values({
        restaurantId,
        tableNumber: 'Table 5',
        tableToken: crypto.randomBytes(16).toString('hex'),
        isActive: true
      })
      .returning();

    const [restDish] = await db
      .insert(products)
      .values({
        restaurantId,
        name: 'Paneer Butter Masala',
        price: 32000,
        isVegetarian: true,
        isAvailable: true
      })
      .returning();
  });

  after(async () => {
    // Clean up test data
    try {
      await db.delete(orders).where(inArray(orders.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(cinemaCarts).where(inArray(cinemaCarts.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaQrCodes).where(inArray(cinemaQrCodes.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaShows).where(inArray(cinemaShows.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaSeats).where(inArray(cinemaSeats.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaRows).where(inArray(cinemaRows.theatreId, [theatreAId, theatreBId]));
      await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, [theatreAId, theatreBId]));
      await db.delete(products).where(inArray(products.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(restaurantTables).where(eq(restaurantTables.restaurantId, restaurantId));
      await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, [theatreAId, theatreBId]));
      await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, [theatreAId, theatreBId, restaurantId]));
      await db.delete(restaurants).where(inArray(restaurants.id, [theatreAId, theatreBId, restaurantId]));
      await db.delete(user).where(inArray(user.id, [userCinemaAId, userCinemaBId, userRestaurantId]));
      await pool.end().catch(() => {});
    } catch (err) {
      console.warn('Cleanup error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // 1. ADD PRODUCTS TO CART
  // -------------------------------------------------------------------------
  it('1. POST /api/cinema/public/cart/items - Adds product and initializes cinema cart session', async () => {
    const res = await request(app)
      .post('/api/cinema/public/cart/items')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        productId: prodPopcornId,
        quantity: 1,
        notes: 'Extra butter requested'
      });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.success, true);
    assert.ok(res.body.cartToken);
    activeCartToken = res.body.cartToken;

    // Verify context
    assert.equal(res.body.cart.context.screen.screenName, 'Audi 1 (Dolby Atmos)');
    assert.equal(res.body.cart.context.seat.row, 'F');
    assert.equal(res.body.cart.context.seat.seat, 'F12');

    // Verify authoritative DB price: ₹240 = 24000 paise
    assert.equal(res.body.cart.items.length, 1);
    assert.equal(res.body.cart.items[0].productName, 'Jumbo Butter Popcorn');
    assert.equal(res.body.cart.items[0].unitPrice, 24000);
    assert.equal(res.body.cart.items[0].quantity, 1);
    assert.equal(res.body.cart.summary.subtotal, 24000);
    assert.equal(res.body.cart.summary.taxAmount, 1200); // 5% GST = 1200 paise
    assert.equal(res.body.cart.summary.totalAmount, 25200); // ₹252.00
  });

  it('2. POST /api/cinema/public/cart/items - Increments quantity and adds second product', async () => {
    // Add Coke
    const res = await request(app)
      .post('/api/cinema/public/cart/items')
      .send({
        cartToken: activeCartToken,
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        productId: prodCokeId,
        quantity: 2
      });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.cart.items.length, 2);

    // Subtotal: 24000 (1 Popcorn) + 24000 (2 Cokes @ 12000) = 48000 paise
    assert.equal(res.body.cart.summary.subtotal, 48000);
    assert.equal(res.body.cart.summary.taxAmount, 2400); // 5% of 48000 = 2400 paise
    assert.equal(res.body.cart.summary.totalAmount, 50400); // ₹504.00
    assert.equal(res.body.cart.summary.itemCount, 3);
  });

  // -------------------------------------------------------------------------
  // 2. UPDATE AND REMOVE ITEMS
  // -------------------------------------------------------------------------
  it('3. PATCH /api/cinema/public/cart/:cartToken/items/:productId - Updates quantity', async () => {
    const res = await request(app)
      .patch(`/api/cinema/public/cart/${activeCartToken}/items/${prodPopcornId}`)
      .send({
        quantity: 2,
        notes: 'Double butter topping'
      });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.success, true);

    // Subtotal: 2 * 24000 + 2 * 12000 = 72000 paise
    assert.equal(res.body.summary.subtotal, 72000);
    assert.equal(res.body.summary.taxAmount, 3600); // 5% of 72000 = 3600 paise
    assert.equal(res.body.summary.totalAmount, 75600); // ₹756.00
    assert.equal(res.body.summary.itemCount, 4);
  });

  it('4. DELETE /api/cinema/public/cart/:cartToken/items/:productId - Removes product', async () => {
    const res = await request(app)
      .delete(`/api/cinema/public/cart/${activeCartToken}/items/${prodCokeId}`);

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].productId, prodPopcornId);

    // Subtotal after Coke removed: 2 * 24000 = 48000 paise
    assert.equal(res.body.summary.subtotal, 48000);
    assert.equal(res.body.summary.taxAmount, 2400);
    assert.equal(res.body.summary.totalAmount, 50400);
  });

  // -------------------------------------------------------------------------
  // 3. GET CART
  // -------------------------------------------------------------------------
  it('5. GET /api/cinema/public/cart/:cartToken - Retrieves cart with full cinema context and authoritative prices', async () => {
    const res = await request(app)
      .get(`/api/cinema/public/cart/${activeCartToken}`);

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.success, true);
    assert.equal(res.body.cart.cartToken, activeCartToken);
    assert.equal(res.body.cart.context.seat.row, 'F');
    assert.equal(res.body.cart.context.seat.seat, 'F12');
    assert.equal(res.body.cart.context.movie.title, 'Interstellar: The IMAX Experience');
    assert.equal(res.body.cart.items.length, 1);
    assert.equal(res.body.cart.summary.subtotal, 48000);
  });

  // -------------------------------------------------------------------------
  // 4. CHECKOUT SUMMARY & VALIDATION
  // -------------------------------------------------------------------------
  it('6. POST /api/cinema/public/cart/summary - Calculates authoritative checkout summary ignoring client price tampering', async () => {
    const res = await request(app)
      .post('/api/cinema/public/cart/summary')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        items: [
          { productId: prodPopcornId, quantity: 2, clientPricePaise: 100 }, // Client attempts ₹1 price
          { productId: prodNachosId, quantity: 1, clientPricePaise: 50 }
        ]
      });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.success, true);

    // Authoritative prices strictly enforced from database:
    // Popcorn: 2 * 24000 = 48000
    // Nachos: 1 * 35000 = 35000
    // Subtotal: 83000 paise (₹830.00)
    // 5% GST: 4150 paise (₹41.50)
    // Total: 87150 paise (₹871.50)
    assert.equal(res.body.summary.subtotal, 83000);
    assert.equal(res.body.summary.taxAmount, 4150);
    assert.equal(res.body.summary.totalAmount, 87150);
    assert.equal(res.body.summary.taxes.length, 2);
    assert.equal(res.body.summary.taxes[0].name, 'CGST (2.5%)');
  });

  it('7. POST /api/cinema/public/checkout/validate - Validates valid customer checkout submission', async () => {
    const res = await request(app)
      .post('/api/cinema/public/checkout/validate')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        items: [{ productId: prodPopcornId, quantity: 2 }]
      });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.context.screen.screenName, 'Audi 1 (Dolby Atmos)');
    assert.equal(res.body.context.seat.seat, 'F12');
  });

  // -------------------------------------------------------------------------
  // 5. STRICT REJECTION TESTS
  // -------------------------------------------------------------------------
  it('8. Validation: Rejects sold-out products during checkout validation', async () => {
    const res = await request(app)
      .post('/api/cinema/public/checkout/validate')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        items: [{ productId: prodSoldOutId, quantity: 1 }]
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('sold out'));
  });

  it('9. Validation: Rejects cross-tenant products (Theatre B product submitted for Theatre A)', async () => {
    const res = await request(app)
      .post('/api/cinema/public/checkout/validate')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        items: [{ productId: prodTheatreBId, quantity: 1 }]
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('does not belong to this theatre'));
  });

  it('10. Validation: Rejects checkout when food ordering window is closed', async () => {
    const res = await request(app)
      .post('/api/cinema/public/checkout/validate')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowClosedId, // Closed window
        seatRow: 'F',
        seatNumber: 'F12',
        items: [{ productId: prodPopcornId, quantity: 1 }]
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('ordering window'));
  });

  it('11. Validation: Rejects non-existent seat identifier', async () => {
    const res = await request(app)
      .post('/api/cinema/public/checkout/validate')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'Z',
        seatNumber: 'Z99',
        items: [{ productId: prodPopcornId, quantity: 1 }]
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('does not exist'));
  });

  // -------------------------------------------------------------------------
  // 6. ORDER PREPARATION (TASK 10 REQUIREMENT 7)
  // -------------------------------------------------------------------------
  it('12. POST /api/cinema/public/checkout/prepare - Prepares order in PENDING status (unpaid, awaiting Task 11)', async () => {
    const idempotencyKey = `cinema-order-idem-${Date.now()}`;

    const res = await request(app)
      .post('/api/cinema/public/checkout/prepare')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        customerName: 'Aarav Patel',
        customerPhone: '9876543210',
        specialInstructions: 'Please deliver during intermission',
        idempotencyKey,
        items: [
          { productId: prodPopcornId, quantity: 2, notes: 'Extra butter' },
          { productId: prodCokeId, quantity: 1 }
        ]
      });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.success, true);
    assert.ok(res.body.order.id);
    assert.ok(res.body.order.orderNumber);
    assert.ok(res.body.statusToken);
    preparedOrderId = res.body.order.id;

    // STRICT RULES CHECK: Order must be pending and unpaid!
    assert.equal(res.body.order.orderType, 'cinema');
    assert.equal(res.body.order.status, 'pending', 'Order must be in pending status, NEVER marked as confirmed or new');
    assert.equal(res.body.order.paymentStatus, 'unpaid', 'Order must be unpaid until Task 11 gateway verification');

    // Context check
    assert.equal(res.body.order.seat.row, 'F');
    assert.equal(res.body.order.seat.seat, 'F12');
    assert.equal(res.body.order.screen.screenName, 'Audi 1 (Dolby Atmos)');
    assert.equal(res.body.order.movie.title, 'Interstellar: The IMAX Experience');

    // Price verification: 2 * 24000 + 1 * 12000 = 60000 paise (₹600) + 5% GST = 63000 paise (₹630)
    assert.equal(res.body.order.subtotal, 60000);
    assert.equal(res.body.order.taxAmount, 3000);
    assert.equal(res.body.order.totalAmount, 63000);

    // Verify DB records
    const [dbOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, preparedOrderId))
      .limit(1);

    assert.ok(dbOrder);
    assert.equal(dbOrder.orderType, 'cinema');
    assert.equal(dbOrder.status, 'pending');
    assert.equal(dbOrder.paymentStatus, 'unpaid');
    assert.equal(dbOrder.seatRow, 'F');
    assert.equal(dbOrder.seatNumber, 'F12');

    // Verify items in DB
    const dbItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, preparedOrderId));
    assert.equal(dbItems.length, 2);

    // Verify audit history recorded
    const history = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, preparedOrderId));
    assert.ok(history.length >= 1);
    assert.equal(history[0]?.toStatus, 'pending');

    // Idempotent retry check: repeating same request returns same order without creating duplicate
    const retryRes = await request(app)
      .post('/api/cinema/public/checkout/prepare')
      .send({
        theatreToken: theatreAQrToken,
        screenId: screen1AId,
        showId: publishedShowOpenId,
        seatRow: 'F',
        seatNumber: 'F12',
        idempotencyKey,
        items: [
          { productId: prodPopcornId, quantity: 2 },
          { productId: prodCokeId, quantity: 1 }
        ]
      });

    assert.equal(retryRes.status, 200);
    assert.equal(retryRes.body.idempotent, true);
    assert.equal(retryRes.body.order.id, preparedOrderId);
  });

  // -------------------------------------------------------------------------
  // 7. CLEAR CART
  // -------------------------------------------------------------------------
  it('13. DELETE /api/cinema/public/cart/:cartToken - Clears cart items while preserving cart session', async () => {
    const res = await request(app)
      .delete(`/api/cinema/public/cart/${activeCartToken}`);

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.success, true);

    // Verify cart now has 0 items
    const getRes = await request(app)
      .get(`/api/cinema/public/cart/${activeCartToken}`);

    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.cart.items.length, 0);
    assert.equal(getRes.body.cart.summary.subtotal, 0);
    // Cinema context is preserved!
    assert.equal(getRes.body.cart.context.seat.row, 'F');
    assert.equal(getRes.body.cart.context.seat.seat, 'F12');
  });

  // -------------------------------------------------------------------------
  // 8. RESTAURANT REGRESSION TEST
  // -------------------------------------------------------------------------
  it('14. Restaurant Regression Check - Table dine-in order creation remains 100% operational', async () => {
    // 1. Fetch table token for restaurant
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.restaurantId, restaurantId))
      .limit(1);

    const [restProduct] = await db
      .select()
      .from(products)
      .where(eq(products.restaurantId, restaurantId))
      .limit(1);

    const [rest] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    // Place restaurant dine-in order via existing POST /api/orders
    const res = await request(app)
      .post('/api/orders')
      .send({
        restaurantSlug: rest!.slug,
        tableToken: table!.tableToken,
        customerName: 'Restaurant Guest',
        items: [{ productId: restProduct!.id, quantity: 2 }]
      });

    assert.equal(res.status, 201, res.text);
    assert.ok(res.body.order.id);
    assert.equal(res.body.order.table.tableNumber, 'Table 5');
    assert.equal(res.body.order.status, 'new'); // Restaurant dine-in orders start as 'new'
  });
});
