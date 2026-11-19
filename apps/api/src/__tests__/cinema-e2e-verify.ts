import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../index';
import {
  cinemaDb,
  restaurants,
  restaurantMembers,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaQrCodes,
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory,
  user
} from '@menugo/database';
import { eq } from 'drizzle-orm';

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING END-TO-END CINEMA MODULE COMPREHENSIVE E2E');
  console.log('====================================================');

  const timestamp = Date.now();
  const testEmail = `test-cinema-owner-${timestamp}@menugo.in`;
  const testPassword = 'SecureCinemaPass123!';

  // Step 1: Sign up cinema owner via port 3001 origin (routed to cinemaAuth)
  console.log('\n[1] Registering Cinema Owner account with Origin http://localhost:3001...');
  const signupRes = await request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', 'http://localhost:3001')
    .set('Content-Type', 'application/json')
    .send({
      name: 'PVR Cinema Manager',
      email: testEmail,
      password: testPassword
    });

  console.log('Signup status:', signupRes.status);
  assert.equal(signupRes.status, 200, `Signup failed: ${JSON.stringify(signupRes.body)}`);
  const cinemaCookie = signupRes.headers['set-cookie']?.[0] || '';
  const userId = signupRes.body?.user?.id;
  assert.ok(userId, 'User ID should be returned');
  console.log('Cinema Owner created with ID:', userId);

  // Verify user is physically in cinemaDb
  const [dbUser] = await cinemaDb.select().from(user).where(eq(user.id, userId));
  assert.ok(dbUser, 'User MUST exist in Cinema Database');
  console.log('Verified: User physically exists in Cinema Database!');

  // Step 2: Create Cinema Theatre
  console.log('\n[2] Creating Cinema Theatre...');
  const theatreRes = await request(app)
    .post('/api/cinema/theatres')
    .set('Cookie', cinemaCookie)
    .set('Origin', 'http://localhost:3001')
    .send({
      theatreName: `MenuGo Cineplex Koramangala ${timestamp}`,
      contactNumber: '9876543210',
      contactEmail: testEmail,
      address: '80 Feet Road, 4th Block, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      chainOrBrand: 'MenuGo Cinemas'
    });

  console.log('Create Theatre status:', theatreRes.status);
  assert.equal(theatreRes.status, 201, `Theatre creation failed: ${JSON.stringify(theatreRes.body)}`);
  const theatre = theatreRes.body.theatre;
  const theatreId = theatre.id;
  const theatreSlug = theatre.slug;
  console.log('Cinema Theatre created:', theatre.name, 'ID:', theatreId, 'Slug:', theatreSlug);

  // Step 3: Add Screen
  console.log('\n[3] Adding Screen / Auditorium...');
  const screenRes = await request(app)
    .post('/api/cinema/screens')
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId)
    .send({
      screenName: 'Audi 1 - Laser 4K Dolby Atmos',
      screenType: 'imax',
      description: 'Premium Laser Projection with 64-channel immersive sound',
      status: 'active'
    });

  console.log('Add Screen status:', screenRes.status);
  assert.equal(screenRes.status, 201, `Add screen failed: ${JSON.stringify(screenRes.body)}`);
  const screen = screenRes.body.screen;
  const screenId = screen.id;
  console.log('Screen created:', screen.screenName, 'ID:', screenId);

  // Step 4: Create seating (Row & Seats)
  console.log('\n[4] Configuring Seating Grid for Screen...');
  const seatingRes = await request(app)
    .post(`/api/cinema/screens/${screenId}/rows`)
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId)
    .send({
      rowIdentifier: 'A',
      startSeatNumber: 1,
      endSeatNumber: 10,
      seatCategory: 'recliner',
      status: 'active'
    });

  console.log('Seating config status:', seatingRes.status);
  assert.equal(seatingRes.status, 201, `Seating row creation failed: ${JSON.stringify(seatingRes.body)}`);
  console.log('Seating grid configured with row A and 10 seats!');

  // Step 5: Generate Theatre QR Stand
  console.log('\n[5] Generating Theatre QR Code...');
  const qrRes = await request(app)
    .post('/api/cinema/qr/theatre')
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId);

  console.log('QR Generation status:', qrRes.status);
  assert.equal(qrRes.status, 201, `QR generation failed: ${JSON.stringify(qrRes.body)}`);
  const theatreToken = qrRes.body.qrCode.theatreToken;
  assert.ok(theatreToken, 'theatreToken should be generated');
  console.log('Active Theatre QR Token:', theatreToken);

  // Step 6: Add Food Concessions Category and Product
  console.log('\n[6] Adding Concession Category & Menu Item via /api/categories and /api/products...');
  const catRes = await request(app)
    .post('/api/categories')
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId)
    .send({
      name: 'Popcorn & Combos',
      sortOrder: 1,
      isActive: true
    });

  console.log('Category create status:', catRes.status);
  assert.equal(catRes.status, 201, `Category creation failed: ${JSON.stringify(catRes.body)}`);
  const categoryId = catRes.body.id;

  const prodRes = await request(app)
    .post('/api/products')
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId)
    .send({
      name: 'Large Caramel Tub Popcorn',
      description: 'Freshly popped jumbo corn tossed in golden brown caramel crunch',
      price: 35000, // ₹350.00
      categoryId,
      isAvailable: true,
      isVegetarian: true,
      sortOrder: 1
    });

  console.log('Product create status:', prodRes.status);
  assert.equal(prodRes.status, 201, `Product creation failed: ${JSON.stringify(prodRes.body)}`);
  const productId = prodRes.body.id;
  console.log('Created concession product:', prodRes.body.name, 'Price: ₹350');

  // Verify product is in cinemaDb
  const [dbProduct] = await cinemaDb.select().from(products).where(eq(products.id, productId));
  assert.ok(dbProduct, 'Product MUST be saved directly into Cinema Database');
  console.log('Verified: Concession product saved in Cinema Database!');

  // Step 7: Customer public menu access (no login required)
  console.log('\n[7] Testing Public Customer Menu (GET /api/cinema/public/menu/:theatreToken)...');
  const publicMenuRes = await request(app)
    .get(`/api/cinema/public/menu/${theatreToken}`);

  console.log('Public menu status:', publicMenuRes.status);
  assert.equal(publicMenuRes.status, 200, `Public menu fetch failed: ${JSON.stringify(publicMenuRes.body)}`);
  assert.ok(publicMenuRes.body.categories?.length > 0, 'Categories should be present');
  assert.ok(publicMenuRes.body.products?.length > 0, 'Products should be present');
  console.log('Public menu verified successfully with categories & products!');

  // Step 8: Customer prepares In-Seat Order
  console.log('\n[8] Placing Customer In-Seat Concession Order (POST /api/cinema/public/checkout/prepare)...');
  const orderRes = await request(app)
    .post('/api/cinema/public/checkout/prepare')
    .send({
      theatreToken,
      screenId,
      seatRow: 'A',
      seatNumber: '4',
      customerName: 'Rahul Sharma',
      customerPhone: '9876543210',
      items: [
        {
          productId,
          quantity: 2,
          notes: 'Extra caramel please'
        }
      ]
    });

  console.log('Order prepare status:', orderRes.status);
  assert.equal(orderRes.status, 201, `Order creation failed: ${JSON.stringify(orderRes.body)}`);
  const preparedOrder = orderRes.body.order;
  const orderId = preparedOrder.id;
  const statusToken = orderRes.body.statusToken;
  console.log('Order created successfully! Number:', preparedOrder.orderNumber, 'Total:', preparedOrder.totalAmount, 'paise');
  console.log('In-seat destination: Screen Audi 1, Row A, Seat 4');

  // Verify order is physically in cinemaDb
  const [dbOrder] = await cinemaDb.select().from(orders).where(eq(orders.id, orderId));
  assert.ok(dbOrder, 'Order MUST exist in Cinema Database');
  console.log('Verified: Order physically saved in Cinema Database!');

  // Step 9: Customer Public Order Tracking
  console.log('\n[9] Customer Order Tracking (GET /api/orders/track/:statusToken)...');
  const trackRes = await request(app)
    .get(`/api/orders/track/${statusToken}`);

  console.log('Tracking status:', trackRes.status);
  assert.equal(trackRes.status, 200, `Order tracking failed: ${JSON.stringify(trackRes.body)}`);
  assert.equal(trackRes.body.orderNumber, preparedOrder.orderNumber);
  assert.equal(trackRes.body.cinema?.seatRow, 'A');
  assert.equal(trackRes.body.cinema?.seatNumber, '4');
  console.log('Customer tracking verified! Status:', trackRes.body.status, 'Row:', trackRes.body.cinema?.seatRow, 'Seat:', trackRes.body.cinema?.seatNumber);

  // Step 10: Simulate Payment Confirmation (mark paid)
  console.log('\n[10] Confirming order payment...');
  await cinemaDb
    .update(orders)
    .set({
      status: 'confirmed',
      paymentStatus: 'paid',
      updatedAt: new Date()
    })
    .where(eq(orders.id, orderId));
  console.log('Order #', preparedOrder.orderNumber, 'marked as paid & confirmed!');

  // Step 11: Cinema Admin Live Orders
  console.log('\n[11] Cinema Admin Live Orders (GET /api/cinema/orders)...');
  const adminOrdersRes = await request(app)
    .get('/api/cinema/orders')
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId);

  console.log('Admin orders status:', adminOrdersRes.status);
  assert.equal(adminOrdersRes.status, 200, `Admin orders failed: ${JSON.stringify(adminOrdersRes.body)}`);
  const adminOrderList = adminOrdersRes.body.orders || adminOrdersRes.body;
  assert.ok(adminOrderList.length > 0, 'Order list should have at least 1 order');
  assert.equal(adminOrderList[0].id, orderId);
  console.log('Admin live orders verified! Found order #', adminOrderList[0].orderNumber);

  // Step 12: Kitchen Display System (KDS) Queue & Progression
  console.log('\n[12] Cinema Kitchen Display System (KDS)...');
  const kdsRes = await request(app)
    .get('/api/cinema/kitchen/orders')
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId);

  console.log('KDS fetch status:', kdsRes.status);
  assert.equal(kdsRes.status, 200, `KDS failed: ${JSON.stringify(kdsRes.body)}`);
  const kdsOrders = kdsRes.body.orders || kdsRes.body;
  assert.ok(kdsOrders.length > 0, 'KDS queue should contain the paid order');
  console.log('KDS active queue verified! Advancing order to PREPARING then READY...');

  // Accept & prepare order in kitchen
  await request(app)
    .post(`/api/cinema/kitchen/orders/${orderId}/prepare`)
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId);

  // Mark ready for delivery
  const readyRes = await request(app)
    .post(`/api/cinema/kitchen/orders/${orderId}/ready`)
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId);

  assert.equal(readyRes.status, 200, 'Kitchen mark ready failed');
  console.log('Order marked READY on kitchen pass!');

  // Step 13: Delivery Runner Queue & Seat Delivery
  console.log('\n[13] Cinema Runner Delivery Queue (GET /api/cinema/delivery/orders)...');
  const deliveryRes = await request(app)
    .get('/api/cinema/delivery/orders')
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId);

  console.log('Delivery queue status:', deliveryRes.status);
  assert.equal(deliveryRes.status, 200, `Delivery failed: ${JSON.stringify(deliveryRes.body)}`);
  const deliveryOrders = deliveryRes.body.orders || deliveryRes.body;
  assert.ok(deliveryOrders.length > 0, 'Ready order should appear in Runner queue');
  console.log('Ready order appears in Runner delivery queue! Delivering to Seat A4...');

  // Mark delivered to seat
  const deliveredRes = await request(app)
    .post(`/api/cinema/delivery/orders/${orderId}/deliver`)
    .set('Cookie', cinemaCookie)
    .set('x-theatre-id', theatreId);

  assert.equal(deliveredRes.status, 200, 'Delivery runner deliver failed');
  console.log('Order delivered to seat successfully!');

  // Step 14: Cleanup test data in Cinema Database
  console.log('\n[14] Cleaning up test data in Cinema Database...');
  await cinemaDb.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId));
  await cinemaDb.delete(orderItems).where(eq(orderItems.orderId, orderId));
  await cinemaDb.delete(orders).where(eq(orders.restaurantId, theatreId));
  await cinemaDb.delete(products).where(eq(products.restaurantId, theatreId));
  await cinemaDb.delete(categories).where(eq(categories.restaurantId, theatreId));
  await cinemaDb.delete(cinemaQrCodes).where(eq(cinemaQrCodes.theatreId, theatreId));
  await cinemaDb.delete(cinemaSeats).where(eq(cinemaSeats.theatreId, theatreId));
  await cinemaDb.delete(cinemaRows).where(eq(cinemaRows.theatreId, theatreId));
  await cinemaDb.delete(cinemaScreens).where(eq(cinemaScreens.theatreId, theatreId));
  await cinemaDb.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, theatreId));
  await cinemaDb.delete(restaurants).where(eq(restaurants.id, theatreId));
  await cinemaDb.delete(user).where(eq(user.id, userId));
  console.log('Cleanup completed cleanly!');

  console.log('\n====================================================');
  console.log('ALL CINEMA MODULE END-TO-END FLOW CHECKS PASSED 100%!');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN CINEMA VERIFICATION]:', err);
  process.exit(1);
});
