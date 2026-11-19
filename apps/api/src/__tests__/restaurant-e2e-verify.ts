import request from 'supertest';
import assert from 'node:assert/strict';
import { app } from '../index';
import {
  restaurantDb,
  cinemaDb,
  restaurants,
  restaurantMembers,
  restaurantTables,
  categories,
  products,
  orders,
  orderItems,
  orderStatusHistory,
  tableSessions,
  user
} from '@menugo/database';
import { eq } from 'drizzle-orm';

async function runRestaurantVerification() {
  console.log('====================================================');
  console.log('STARTING END-TO-END RESTAURANT MODULE COMPREHENSIVE E2E');
  console.log('====================================================');

  const timestamp = Date.now();
  const testEmail = `test-rest-owner-${timestamp}@menugo.in`;
  const testPassword = 'SecureRestPass123!';

  // Step 1: Sign up restaurant owner via port 3000 origin (routed to restaurantAuth)
  console.log('\n[1] Registering Restaurant Owner account with Origin http://localhost:3000...');
  const signupRes = await request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', 'http://localhost:3000')
    .set('Content-Type', 'application/json')
    .send({
      name: 'Chef Rameshwaram',
      email: testEmail,
      password: testPassword
    });

  console.log('Signup status:', signupRes.status);
  assert.equal(signupRes.status, 200, `Signup failed: ${JSON.stringify(signupRes.body)}`);
  const restCookie = signupRes.headers['set-cookie']?.[0] || '';
  const userId = signupRes.body?.user?.id;
  assert.ok(userId, 'User ID should be returned');
  console.log('Restaurant Owner created with ID:', userId);

  // Step 2: Verify user exists physically in Restaurant Database
  console.log('\n[2] Verifying user exists strictly in Restaurant Database...');
  const [dbUser] = await restaurantDb.select().from(user).where(eq(user.id, userId));
  assert.ok(dbUser, 'User MUST exist in Restaurant Database (ep-tiny-bonus-bdg0jlgg)');
  console.log('Verified: User physically exists in Restaurant Database!');

  // Verify user does NOT exist in Cinema Database
  const [cinemaUser] = await cinemaDb.select().from(user).where(eq(user.id, userId));
  assert.equal(cinemaUser, undefined, 'User MUST NOT exist in Cinema Database (Strict Isolation)');
  console.log('Verified: Strict isolation confirmed! User does NOT exist in Cinema Database.');

  // Step 3: Create Restaurant Profile
  console.log('\n[3] Creating Restaurant Profile (POST /api/restaurants)...');
  const createRestRes = await request(app)
    .post('/api/restaurants')
    .set('Cookie', restCookie)
    .set('Origin', 'http://localhost:3000')
    .send({
      name: `Rameshwaram Cafe Indiranagar ${timestamp}`,
      slug: `rameshwaram-cafe-${timestamp}`,
      phone: '9845012345',
      email: testEmail,
      address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru',
      currency: 'INR'
    });

  console.log('Create Restaurant status:', createRestRes.status);
  assert.equal(createRestRes.status, 201, `Restaurant creation failed: ${JSON.stringify(createRestRes.body)}`);
  const restData = createRestRes.body.restaurant;
  const restaurantId = restData.id;
  const restaurantSlug = restData.slug;
  console.log('Restaurant created:', restData.name, 'ID:', restaurantId, 'Slug:', restaurantSlug);

  // Step 4: Create Dining Table
  console.log('\n[4] Adding Dining Table (POST /api/tables)...');
  const tableRes = await request(app)
    .post('/api/tables')
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      tableNumber: 'T-12',
      capacity: 4,
      floorZone: 'Main Dining Hall'
    });

  console.log('Create Table status:', tableRes.status);
  assert.equal(tableRes.status, 201, `Table creation failed: ${JSON.stringify(tableRes.body)}`);
  const table = tableRes.body;
  const tableId = table.id;
  const tableToken = table.tableToken;
  console.log('Dining Table created:', table.tableNumber, 'ID:', tableId, 'QR Token:', tableToken);

  // Step 5: Add Food Menu Category and Product
  console.log('\n[5] Adding Menu Category (POST /api/categories)...');
  const catRes = await request(app)
    .post('/api/categories')
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      name: 'South Indian Specialties',
      sortOrder: 1,
      isActive: true
    });

  console.log('Category create status:', catRes.status);
  assert.equal(catRes.status, 201, `Category creation failed: ${JSON.stringify(catRes.body)}`);
  const categoryId = catRes.body.id;

  console.log('\n[6] Adding Menu Product (POST /api/products)...');
  const prodRes = await request(app)
    .post('/api/products')
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      name: 'Ghee Podi Masala Dosa',
      description: 'Crispy golden crepe smeared with signature red chutney and spiced gunpowder podi',
      price: 16000, // ₹160.00
      categoryId,
      isAvailable: true,
      isVegetarian: true,
      sortOrder: 1
    });

  console.log('Product create status:', prodRes.status);
  assert.equal(prodRes.status, 201, `Product creation failed: ${JSON.stringify(prodRes.body)}`);
  const productId = prodRes.body.id;
  console.log('Created restaurant product:', prodRes.body.name, 'Price: ₹160');

  // Verify product is in restaurantDb
  const [dbProduct] = await restaurantDb.select().from(products).where(eq(products.id, productId));
  assert.ok(dbProduct, 'Product MUST exist in Restaurant Database');
  console.log('Verified: Product physically saved in Restaurant Database!');

  // Step 6: Customer Public Menu Access
  console.log('\n[7] Testing Public Customer Menu (GET /api/restaurants/public/:slug)...');
  const publicMenuRes = await request(app)
    .get(`/api/restaurants/public/${restaurantSlug}`);

  console.log('Public menu status:', publicMenuRes.status);
  assert.equal(publicMenuRes.status, 200, `Public menu failed: ${JSON.stringify(publicMenuRes.body)}`);
  assert.equal(publicMenuRes.body.restaurant?.name || publicMenuRes.body.name, restData.name);
  console.log('Public restaurant menu verified successfully!');

  // Step 7: Customer places Dine-in Table Order
  console.log('\n[8] Customer placing dine-in order at Table T-12 (POST /api/orders)...');
  const orderRes = await request(app)
    .post('/api/orders')
    .send({
      restaurantSlug,
      tableId,
      customerName: 'Ananya Deshmukh',
      customerPhone: '9876543210',
      items: [
        {
          productId,
          quantity: 2,
          notes: 'Crispy and extra sambar'
        }
      ]
    });

  console.log('Place order status:', orderRes.status);
  assert.equal(orderRes.status, 201, `Order placement failed: ${JSON.stringify(orderRes.body)}`);
  const placedOrder = orderRes.body.order;
  const orderId = placedOrder.id;
  const statusToken = placedOrder.statusToken;
  console.log('Order created successfully! #:', placedOrder.orderNumber, 'Total:', placedOrder.totalAmount, 'paise');

  // Verify order is physically in restaurantDb
  const [dbOrder] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId));
  assert.ok(dbOrder, 'Order MUST exist in Restaurant Database');
  console.log('Verified: Dine-in order physically saved in Restaurant Database!');

  // Step 8: Customer tracks order in real time
  console.log('\n[9] Customer Order Tracking (GET /api/orders/track/:statusToken)...');
  const trackRes = await request(app)
    .get(`/api/orders/track/${statusToken}`);

  console.log('Tracking status:', trackRes.status);
  assert.equal(trackRes.status, 200, `Order tracking failed: ${JSON.stringify(trackRes.body)}`);
  assert.equal(trackRes.body.orderNumber, placedOrder.orderNumber);
  assert.equal(trackRes.body.table?.tableNumber, 'T-12');
  console.log('Customer tracking verified! Status:', trackRes.body.status, 'Table:', trackRes.body.table?.tableNumber);

  // Step 9: Staff / Admin Live Orders listing
  console.log('\n[10] Restaurant Admin Live Orders (GET /api/orders)...');
  const adminOrdersRes = await request(app)
    .get('/api/orders')
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId);

  console.log('Admin orders status:', adminOrdersRes.status);
  assert.equal(adminOrdersRes.status, 200, `Admin orders failed: ${JSON.stringify(adminOrdersRes.body)}`);
  const orderList = adminOrdersRes.body.orders || adminOrdersRes.body;
  assert.ok(orderList.length > 0, 'Orders list should contain the placed order');
  assert.equal(orderList[0].id, orderId);
  console.log('Admin live orders verified! Found order #', orderList[0].orderNumber);

  // Step 10: Kitchen advances order (Accepted -> Preparing -> Ready)
  console.log('\n[11] Kitchen KDS advancing order status...');
  // Move to accepted
  const acceptRes = await request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      status: 'accepted',
      expectedCurrentStatus: 'new'
    });
  assert.equal(acceptRes.status, 200, 'Kitchen accept order failed');

  // Move to preparing
  const prepRes = await request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      status: 'preparing',
      expectedCurrentStatus: 'accepted'
    });
  assert.equal(prepRes.status, 200, 'Kitchen prepare order failed');

  // Move to ready
  const readyRes = await request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      status: 'ready',
      expectedCurrentStatus: 'preparing'
    });
  assert.equal(readyRes.status, 200, 'Kitchen ready order failed');
  console.log('Order status successfully progressed: new -> accepted -> preparing -> ready!');

  // Step 11: Waiter / Floor Service marks order served
  console.log('\n[12] Floor Staff serving food to Table T-12...');
  const servedRes = await request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      status: 'served',
      expectedCurrentStatus: 'ready'
    });
  assert.equal(servedRes.status, 200, 'Waiter mark served failed');
  console.log('Order marked SERVED at Table T-12!');

  // Step 12: Cashier Settle Bill
  console.log('\n[13] Cashier checking bill and closing table session (POST /api/cashier/tables/:tableId/close-session)...');
  const billRes = await request(app)
    .get(`/api/cashier/tables/${tableId}/bill`)
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId);

  console.log('Cashier bill status:', billRes.status);
  assert.equal(billRes.status, 200, 'Cashier bill fetch failed');
  console.log('Bill generated: Total ₹', (billRes.body.bill?.totalPaise || 32000) / 100);

  const closeSessionRes = await request(app)
    .post(`/api/cashier/tables/${tableId}/close-session`)
    .set('Cookie', restCookie)
    .set('x-restaurant-id', restaurantId)
    .send({
      reason: 'Customer completed payment via UPI'
    });

  console.log('Close session status:', closeSessionRes.status);
  assert.equal(closeSessionRes.status, 200, `Close session failed: ${JSON.stringify(closeSessionRes.body)}`);
  console.log('Table session closed and table released for new guests!');

  // Step 13: Strict Boundary Check: Restaurant account cannot manage cinema
  console.log('\n[14] Security Audit: Restaurant owner attempting to access Cinema endpoints...');
  const cinemaForbiddenRes = await request(app)
    .get('/api/cinema/orders')
    .set('Cookie', restCookie)
    .set('x-theatre-id', restaurantId);

  console.log('Cinema access attempt status:', cinemaForbiddenRes.status);
  assert.ok(
    cinemaForbiddenRes.status === 403 || cinemaForbiddenRes.status === 401 || cinemaForbiddenRes.status === 400,
    `Restaurant account must NOT access cinema routes. Received status: ${cinemaForbiddenRes.status}`
  );
  console.log('Verified: Restaurant account is strictly denied access to Cinema endpoints!');

  // Step 14: Cleanup test data in Restaurant Database
  console.log('\n[15] Cleaning up test data in Restaurant Database...');
  await restaurantDb.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId));
  await restaurantDb.delete(orderItems).where(eq(orderItems.orderId, orderId));
  await restaurantDb.delete(orders).where(eq(orders.restaurantId, restaurantId));
  await restaurantDb.delete(products).where(eq(products.restaurantId, restaurantId));
  await restaurantDb.delete(categories).where(eq(categories.restaurantId, restaurantId));
  await restaurantDb.delete(tableSessions).where(eq(tableSessions.restaurantId, restaurantId));
  await restaurantDb.delete(restaurantTables).where(eq(restaurantTables.restaurantId, restaurantId));
  await restaurantDb.delete(restaurantMembers).where(eq(restaurantMembers.restaurantId, restaurantId));
  await restaurantDb.delete(restaurants).where(eq(restaurants.id, restaurantId));
  await restaurantDb.delete(user).where(eq(user.id, userId));
  console.log('Cleanup completed cleanly!');

  console.log('\n====================================================');
  console.log('ALL RESTAURANT MODULE END-TO-END FLOW CHECKS PASSED 100%!');
  console.log('====================================================');
  process.exit(0);
}

runRestaurantVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN RESTAURANT VERIFICATION]:', err);
  process.exit(1);
});
