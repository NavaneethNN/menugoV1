import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import crypto from 'node:crypto';
import QRCode from 'qrcode';
import {
  db,
  pool,
  restaurants,
  cinemaProfiles,
  cinemaScreens,
  cinemaRows,
  cinemaSeats,
  cinemaMovies,
  cinemaShows,
  cinemaQrCodes,
  cinemaPaymentAccounts,
  cinemaPaymentTransactions,
  cinemaWebhookEvents,
  orders,
  orderItems,
  orderStatusHistory,
  user,
  session,
  account,
  restaurantMembers,
  categories,
  products
} from '@menugo/database';
import { eq, inArray, and } from 'drizzle-orm';
import { auth } from '../apps/api/src/lib/auth';
import { encryptSecret } from '../apps/api/src/lib/encryption';

async function seedCinema() {
  console.log(' =========================================================');
  console.log(' Seeding Sample Cinema Theatre Data for MenuGo Pilot');
  console.log(' =========================================================\n');

  const adminEmail = 'theatre.admin@menugo.com';
  const adminPassword = 'CinemaAdmin123!';
  const theatreSlug = 'pvr-grand-luxe';
  const theatreName = 'PVR Grand Luxe IMAX';

  // 1. Clean up existing records for this slug/email if any
  console.log(' Cleaning up prior demo seed records...');
  const existingTheatres = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.slug, theatreSlug));

  const theatreIdsToClean = existingTheatres.map((t) => t.id);

  if (theatreIdsToClean.length > 0) {
    await db.delete(orderStatusHistory);
    await db.delete(orderItems);
    await db.delete(orders).where(inArray(orders.restaurantId, theatreIdsToClean));
    await db.delete(cinemaWebhookEvents).where(inArray(cinemaWebhookEvents.theatreId, theatreIdsToClean));
    await db.delete(cinemaPaymentTransactions).where(inArray(cinemaPaymentTransactions.theatreId, theatreIdsToClean));
    await db.delete(cinemaPaymentAccounts).where(inArray(cinemaPaymentAccounts.theatreId, theatreIdsToClean));
    await db.delete(cinemaQrCodes).where(inArray(cinemaQrCodes.theatreId, theatreIdsToClean));
    await db.delete(cinemaShows).where(inArray(cinemaShows.theatreId, theatreIdsToClean));
    await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, theatreIdsToClean));
    await db.delete(cinemaSeats).where(inArray(cinemaSeats.theatreId, theatreIdsToClean));
    await db.delete(cinemaRows).where(inArray(cinemaRows.theatreId, theatreIdsToClean));
    await db.delete(cinemaScreens).where(inArray(cinemaScreens.theatreId, theatreIdsToClean));
    await db.delete(products).where(inArray(products.restaurantId, theatreIdsToClean));
    await db.delete(categories).where(inArray(categories.restaurantId, theatreIdsToClean));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, theatreIdsToClean));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, theatreIdsToClean));
    await db.delete(restaurants).where(inArray(restaurants.id, theatreIdsToClean));
    console.log(`   Cleaned up ${theatreIdsToClean.length} prior theatre record(s).`);
  }

  // Check user
  let adminUserId: string;
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, adminEmail))
    .limit(1);

  if (existingUser) {
    adminUserId = existingUser.id;
    console.log(` Found existing admin user account: ${adminEmail} (ID: ${adminUserId})`);
  } else {
    console.log(` Creating new admin account for ${adminEmail}...`);
    const signupRes = await auth.api.signUpEmail({
      body: {
        name: 'PVR Cinema Admin',
        email: adminEmail,
        password: adminPassword
      }
    });

    if (!signupRes?.user?.id) {
      throw new Error(`Failed to create admin user: ${JSON.stringify(signupRes)}`);
    }

    adminUserId = signupRes.user.id;
    console.log(`   Created admin user account: ${adminEmail} (ID: ${adminUserId})`);
  }

  // 2. Create Restaurant / Cinema Tenant
  console.log('\n️ Creating Cinema Theatre entity...');
  const theatreId = crypto.randomUUID();
  await db.insert(restaurants).values({
    id: theatreId,
    name: theatreName,
    slug: theatreSlug,
    tenantType: 'cinema',
    address: 'Phoenix Marketcity, Whitefield Main Rd, Devasandra Industrial Estate',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    currency: 'INR',
    phone: '+919876543210',
    email: adminEmail,
    logoUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&auto=format&fit=crop&q=80',
    isActive: true
  });

  // Cinema Profile
  await db.insert(cinemaProfiles).values({
    id: crypto.randomUUID(),
    theatreId,
    theatreName,
    chainOrBrand: 'PVR INOX',
    address: 'Phoenix Marketcity, Whitefield Main Rd, Devasandra Industrial Estate',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    contactNumber: '+919876543210',
    contactEmail: adminEmail,
    businessDetails: 'GSTIN: 29AAACP1234F1Z5 • FSSAI License: 11223344556677',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    logoUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&auto=format&fit=crop&q=80',
    onboardingStage: 'go_live',
    onboardingCompleted: true,
    onboardingStagesCompleted: [
      'profile_completed',
      'screens_configured',
      'seating_configured',
      'menu_configured',
      'payment_configured',
      'shows_published',
      'qr_generated',
      'go_live'
    ]
  });

  // Assign Admin User as Owner
  await db.insert(restaurantMembers).values({
    id: crypto.randomUUID(),
    restaurantId: theatreId,
    userId: adminUserId,
    role: 'owner',
    status: 'active'
  });
  console.log(`    Theatre registered: "${theatreName}" (ID: ${theatreId})`);

  // 3. Create Screens
  console.log('\n Creating Auditoriums / Cinema Screens...');
  const screen1Id = crypto.randomUUID();
  const screen2Id = crypto.randomUUID();

  await db.insert(cinemaScreens).values([
    {
      id: screen1Id,
      theatreId,
      screenName: 'Audi 1 - IMAX with Laser',
      screenType: 'imax',
      description: 'Commercial 4K Laser Projection with 12-Channel Immersive Audio & Luxury Recliners',
      status: 'active',
      totalRows: 3,
      totalSeats: 26,
      seatingConfigured: true
    },
    {
      id: screen2Id,
      theatreId,
      screenName: 'Audi 2 - Dolby Atmos 4K',
      screenType: 'standard',
      description: 'Dolby 7.1 Surround Sound with 4K Christie Digital Cinema Projection',
      status: 'active',
      totalRows: 3,
      totalSeats: 26,
      seatingConfigured: true
    }
  ]);
  console.log('    Screen 1: Audi 1 - IMAX with Laser (26 seats)');
  console.log('    Screen 2: Audi 2 - Dolby Atmos 4K (26 seats)');

  // 4. Create Rows and Seats
  console.log('\n Creating Seating Layout (Rows & Seats)...');
  const configureScreenSeats = async (screenId: string, screenLabel: string) => {
    // Row A: Recliner (6 seats: A1..A6)
    const rowAId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowAId,
      theatreId,
      screenId,
      rowIdentifier: 'A',
      sortOrder: 1,
      startSeatNumber: 1,
      endSeatNumber: 6,
      totalSeats: 6,
      seatCategory: 'recliner',
      status: 'active'
    });

    const rowASeats = Array.from({ length: 6 }, (_, i) => ({
      id: crypto.randomUUID(),
      theatreId,
      screenId,
      rowId: rowAId,
      rowIdentifier: 'A',
      seatNumber: i + 1,
      seatIdentifier: `A${i + 1}`,
      seatCategory: 'recliner',
      status: 'active'
    }));
    await db.insert(cinemaSeats).values(rowASeats);

    // Row B: Premium (10 seats: B1..B10)
    const rowBId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowBId,
      theatreId,
      screenId,
      rowIdentifier: 'B',
      sortOrder: 2,
      startSeatNumber: 1,
      endSeatNumber: 10,
      totalSeats: 10,
      seatCategory: 'premium',
      status: 'active'
    });

    const rowBSeats = Array.from({ length: 10 }, (_, i) => ({
      id: crypto.randomUUID(),
      theatreId,
      screenId,
      rowId: rowBId,
      rowIdentifier: 'B',
      seatNumber: i + 1,
      seatIdentifier: `B${i + 1}`,
      seatCategory: 'premium',
      status: 'active'
    }));
    await db.insert(cinemaSeats).values(rowBSeats);

    // Row C: Regular (10 seats: C1..C10)
    const rowCId = crypto.randomUUID();
    await db.insert(cinemaRows).values({
      id: rowCId,
      theatreId,
      screenId,
      rowIdentifier: 'C',
      sortOrder: 3,
      startSeatNumber: 1,
      endSeatNumber: 10,
      totalSeats: 10,
      seatCategory: 'regular',
      status: 'active'
    });

    const rowCSeats = Array.from({ length: 10 }, (_, i) => ({
      id: crypto.randomUUID(),
      theatreId,
      screenId,
      rowId: rowCId,
      rowIdentifier: 'C',
      seatNumber: i + 1,
      seatIdentifier: `C${i + 1}`,
      seatCategory: 'regular',
      status: 'active'
    }));
    await db.insert(cinemaSeats).values(rowCSeats);

    console.log(`   Configured 26 seats for ${screenLabel} (Row A: Recliners, Row B: Premium, Row C: Regular)`);
  };

  await configureScreenSeats(screen1Id, 'Audi 1 - IMAX');
  await configureScreenSeats(screen2Id, 'Audi 2 - Dolby Atmos');

  // 5. Create Movies
  console.log('\n️ Adding Movies to Catalogue...');
  const movie1Id = crypto.randomUUID();
  const movie2Id = crypto.randomUUID();

  await db.insert(cinemaMovies).values([
    {
      id: movie1Id,
      theatreId,
      title: 'Gladiator II',
      language: 'English',
      durationMinutes: 148,
      description: 'Years after witnessing the death of Maximus, Lucius enters the Colosseum to return the glory of Rome.',
      posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
      status: 'active'
    },
    {
      id: movie2Id,
      theatreId,
      title: 'Dune: Part Two',
      language: 'English',
      durationMinutes: 166,
      description: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against those who destroyed his family.',
      posterUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&auto=format&fit=crop&q=80',
      status: 'active'
    }
  ]);
  console.log('    Movie 1: Gladiator II (148 min)');
  console.log('    Movie 2: Dune: Part Two (166 min)');

  // 6. Create Daily Shows (Active and OPEN for ordering right now!)
  console.log('\n Scheduling Daily Shows (Setting food ordering window OPEN now)...');
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Show 1: Audi 1, Gladiator II -> Currently Active & Ordering OPEN!
  const show1StartTime = new Date(now.getTime() - 20 * 60 * 1000); // started 20 mins ago
  const show1EndTime = new Date(now.getTime() + 128 * 60 * 1000);  // ends in ~2 hrs
  const show1OrderStart = new Date(now.getTime() - 45 * 60 * 1000); // ordering opened 45 mins ago
  const show1OrderEnd = new Date(now.getTime() + 75 * 60 * 1000);   // ordering open for 75 more mins!

  // Show 2: Audi 1, Dune: Part Two -> Later Today
  const show2StartTime = new Date(now.getTime() + 180 * 60 * 1000);
  const show2EndTime = new Date(now.getTime() + 346 * 60 * 1000);
  const show2OrderStart = new Date(now.getTime() + 120 * 60 * 1000);
  const show2OrderEnd = new Date(now.getTime() + 280 * 60 * 1000);

  // Show 3: Audi 2, Dune: Part Two -> Currently Active & Ordering OPEN!
  const show3StartTime = new Date(now.getTime() - 10 * 60 * 1000);
  const show3EndTime = new Date(now.getTime() + 156 * 60 * 1000);
  const show3OrderStart = new Date(now.getTime() - 30 * 60 * 1000);
  const show3OrderEnd = new Date(now.getTime() + 90 * 60 * 1000);

  const show1Id = crypto.randomUUID();
  const show2Id = crypto.randomUUID();
  const show3Id = crypto.randomUUID();

  await db.insert(cinemaShows).values([
    {
      id: show1Id,
      theatreId,
      screenId: screen1Id,
      movieId: movie1Id,
      showDate: today,
      startTime: show1StartTime,
      expectedEndTime: show1EndTime,
      orderingStartTime: show1OrderStart,
      orderingEndTime: show1OrderEnd,
      status: 'published'
    },
    {
      id: show2Id,
      theatreId,
      screenId: screen1Id,
      movieId: movie2Id,
      showDate: today,
      startTime: show2StartTime,
      expectedEndTime: show2EndTime,
      orderingStartTime: show2OrderStart,
      orderingEndTime: show2OrderEnd,
      status: 'published'
    },
    {
      id: show3Id,
      theatreId,
      screenId: screen2Id,
      movieId: movie2Id,
      showDate: today,
      startTime: show3StartTime,
      expectedEndTime: show3EndTime,
      orderingStartTime: show3OrderStart,
      orderingEndTime: show3OrderEnd,
      status: 'published'
    }
  ]);
  console.log(`    Show 1: Audi 1 - Gladiator II [ACTIVE NOW - Food Ordering OPEN]`);
  console.log(`    Show 2: Audi 1 - Dune: Part Two [Upcoming Today at ${show2StartTime.toLocaleTimeString()}]`);
  console.log(`    Show 3: Audi 2 - Dune: Part Two [ACTIVE NOW - Food Ordering OPEN]`);

  // 7. Food Concessions Menu
  console.log('\n Populating Concessions Menu & Pricing...');
  const cat1Id = crypto.randomUUID();
  const cat2Id = crypto.randomUUID();
  const cat3Id = crypto.randomUUID();
  const cat4Id = crypto.randomUUID();

  await db.insert(categories).values([
    {
      id: cat1Id,
      restaurantId: theatreId,
      name: 'Gourmet Popcorn',
      description: 'Freshly popped gourmet popcorn tossed in artisanal flavours',
      sortOrder: 1
    },
    {
      id: cat2Id,
      restaurantId: theatreId,
      name: 'Hot Savouries & Nachos',
      description: 'Sizzling finger foods and loaded nacho platters',
      sortOrder: 2
    },
    {
      id: cat3Id,
      restaurantId: theatreId,
      name: 'Chilled Concessions Beverages',
      description: 'Ice-cold fountain sodas and iced teas',
      sortOrder: 3
    },
    {
      id: cat4Id,
      restaurantId: theatreId,
      name: 'Blockbuster Combos',
      description: 'Value combo packs for movies',
      sortOrder: 4
    }
  ]);

  await db.insert(products).values([
    // Popcorn
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat1Id,
      name: 'Jumbo Caramel Gourmet Popcorn',
      description: 'Crunchy golden caramel gourmet popcorn popped fresh in pure coconut oil',
      price: 32000, // ₹320.00
      imageUrl: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    },
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat1Id,
      name: 'Classic Salted Butter Popcorn',
      description: 'Traditional movie-theatre buttery warm popcorn tub',
      price: 26000, // ₹260.00
      imageUrl: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    },
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat1Id,
      name: 'Cheese Burst Crunch Popcorn',
      description: 'Zesty sharp cheddar cheese dusted popcorn',
      price: 29000, // ₹290.00
      imageUrl: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    },
    // Hot Savouries
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat2Id,
      name: 'Loaded Cheese Nachos with Jalapeños',
      description: 'Crisp tortilla chips topped with melted cheddar, diced jalapeños, and tangy salsa',
      price: 28000, // ₹280.00
      imageUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    },
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat2Id,
      name: 'Smoked Chicken Tikka Kathi Wrap',
      description: 'Tender tandoori chicken tikka rolled in flaky parotta with mint mayo',
      price: 27000, // ₹270.00
      imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&auto=format&fit=crop&q=80',
      isVegetarian: false,
      isAvailable: true
    },
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat2Id,
      name: 'Crispy Peri-Peri French Fries',
      description: 'Golden potato fries tossed in fiery African peri-peri spices with garlic dip',
      price: 22000, // ₹220.00
      imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    },
    // Beverages
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat3Id,
      name: 'Large Fountain Coca-Cola (750ml)',
      description: 'Chilled draught cola served with ice cubes',
      price: 15000, // ₹150.00
      imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    },
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat3Id,
      name: 'Iced Lemon Peach Tea (500ml)',
      description: 'Refreshing brew with real peach syrup and sliced lemon',
      price: 18000, // ₹180.00
      imageUrl: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    },
    // Combos
    {
      id: crypto.randomUUID(),
      restaurantId: theatreId,
      categoryId: cat4Id,
      name: 'Blockbuster Combo: Jumbo Popcorn + 2 Large Cokes',
      description: '1 Jumbo Gourmet Popcorn tub with 2 Large (750ml) fountain drinks of your choice',
      price: 56000, // ₹560.00
      imageUrl: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=400&auto=format&fit=crop&q=80',
      isVegetarian: true,
      isAvailable: true
    }
  ]);
  console.log('    Populated 4 concession categories and 9 delicious items');

  // 8. Configure Payment Gateways (Razorpay & Paytm test accounts)
  console.log('\n Configuring Theatre Payment Gateways (Razorpay & Paytm)...');
  const razorpaySecret = 'mock_secret_key_12345';
  const paytmSecret = 'mock_paytm_secret_key_12345';

  await db.insert(cinemaPaymentAccounts).values([
    {
      id: crypto.randomUUID(),
      theatreId,
      provider: 'razorpay',
      environment: 'test',
      keyId: 'rzp_test_mock_cinema',
      encryptedKeySecret: encryptSecret(razorpaySecret),
      encryptedWebhookSecret: encryptSecret('whsec_mock_cinema'),
      maskedKeySecret: '••••••••1234',
      status: 'connected',
      isVerified: true,
      verifiedAt: new Date(),
      settings: {
        displayName: 'PVR Grand Luxe IMAX',
        themeColor: '#4F46E5'
      }
    },
    {
      id: crypto.randomUUID(),
      theatreId,
      provider: 'paytm',
      environment: 'test',
      keyId: 'TEST_CINEMA_MID',
      encryptedKeySecret: encryptSecret(paytmSecret),
      encryptedWebhookSecret: encryptSecret('whsec_mock_paytm'),
      maskedKeySecret: '••••••••2345',
      status: 'connected',
      isVerified: true,
      verifiedAt: new Date(),
      settings: {
        websiteName: 'WEBSTAGING',
        channelId: 'WAP',
        industryTypeId: 'Retail'
      }
    }
  ]);
  console.log('    Razorpay Test Account connected & verified (Key: rzp_test_mock_cinema)');
  console.log('    Paytm Test Account connected & verified (MID: TEST_CINEMA_MID)');

  // 9. Generate and Register QR Codes
  console.log('\n Generating Public QR Codes for Customer In-Seat Ordering...');
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Tokens must be 32..64 hex characters per isValidCinemaQrTokenFormat
  const theatreToken = crypto.randomBytes(24).toString('hex');
  const screen1Token = crypto.randomBytes(24).toString('hex');
  const screen2Token = crypto.randomBytes(24).toString('hex');

  const theatreUrl = `${appBaseUrl}/cinema/${theatreToken}`;
  const screen1Url = `${appBaseUrl}/cinema/${theatreToken}/${screen1Token}`;
  const screen2Url = `${appBaseUrl}/cinema/${theatreToken}/${screen2Token}`;

  const theatreQrCodeData = await QRCode.toDataURL(theatreUrl, {
    width: 600,
    margin: 2,
    color: { dark: '#0F172A', light: '#FFFFFF' }
  });

  const screen1QrCodeData = await QRCode.toDataURL(screen1Url, {
    width: 600,
    margin: 2,
    color: { dark: '#1E1B4B', light: '#FFFFFF' }
  });

  const screen2QrCodeData = await QRCode.toDataURL(screen2Url, {
    width: 600,
    margin: 2,
    color: { dark: '#1E1B4B', light: '#FFFFFF' }
  });

  await db.insert(cinemaQrCodes).values([
    {
      id: crypto.randomUUID(),
      theatreId,
      qrType: 'theatre',
      qrName: 'PVR Grand Luxe Main Foyer Stand QR',
      token: theatreToken,
      theatreToken: theatreToken,
      targetUrl: theatreUrl,
      qrCodeData: theatreQrCodeData,
      status: 'active'
    },
    {
      id: crypto.randomUUID(),
      theatreId,
      screenId: screen1Id,
      qrType: 'screen',
      qrName: 'Audi 1 - IMAX Stand QR',
      token: screen1Token,
      theatreToken: theatreToken,
      screenToken: screen1Token,
      targetUrl: screen1Url,
      qrCodeData: screen1QrCodeData,
      status: 'active'
    },
    {
      id: crypto.randomUUID(),
      theatreId,
      screenId: screen2Id,
      qrType: 'screen',
      qrName: 'Audi 2 - Dolby Atmos Stand QR',
      token: screen2Token,
      theatreToken: theatreToken,
      screenToken: screen2Token,
      targetUrl: screen2Url,
      qrCodeData: screen2QrCodeData,
      status: 'active'
    }
  ]);

  console.log('    Theatre QR Code generated: token = ' + theatreToken);
  console.log('    Screen 1 QR Code generated: token = ' + screen1Token);
  console.log('    Screen 2 QR Code generated: token = ' + screen2Token);

  console.log('\n=============================================================');
  console.log(' CINEMA SAMPLE DATA SEEDED SUCCESSFULLY!');
  console.log('=============================================================');
  console.log(' CINEMA ADMIN CREDENTIALS:');
  console.log(`   Sign In URL:  ${appBaseUrl}/admin/login?business=cinema`);
  console.log(`   Email:        ${adminEmail}`);
  console.log(`   Password:     ${adminPassword}`);
  console.log(`   Dashboard:    ${appBaseUrl}/cinema/admin/dashboard`);
  console.log('\n CUSTOMER ORDERING ENTRY POINTS (Ready to test right now):');
  console.log(`   General Theatre QR (choose screen & show):`);
  console.log(`    ${theatreUrl}`);
  console.log(`\n   Screen 1 QR (Audi 1 - IMAX with Laser, preselected):`);
  console.log(`    ${screen1Url}`);
  console.log(`\n   Screen 2 QR (Audi 2 - Dolby Atmos, preselected):`);
  console.log(`    ${screen2Url}`);
  console.log('=============================================================\n');

  await pool.end();
}

seedCinema().catch((err) => {
  console.error(' Failed to seed cinema data:', err);
  process.exit(1);
});
