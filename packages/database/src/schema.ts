import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// 1. Better Auth Tables (user, session, account, verification)
// ---------------------------------------------------------------------------
export const user = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(),
  tenantType: varchar('tenant_type', { length: 50 }).default('restaurant').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const session = pgTable('session', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const verification = pgTable('verification', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Alias for plan consistency (Section 5: users table)
export const users = user;

// ---------------------------------------------------------------------------
// 2. Restaurants Table
// ---------------------------------------------------------------------------
export const restaurants = pgTable(
  'restaurants',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    logoKey: text('logo_key'),
    logoUrl: text('logo_url'),
    coverImageKey: text('cover_image_key'),
    coverImageUrl: text('cover_image_url'),
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    tenantType: varchar('tenant_type', { length: 50 }).default('restaurant').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    settings: jsonb('settings').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('restaurant_slug_idx').on(table.slug),
    index('restaurant_created_at_idx').on(table.createdAt),
    index('restaurant_tenant_type_idx').on(table.tenantType)
  ]
);

// ---------------------------------------------------------------------------
// 2b. Cinema Profiles Table (Multi-tenant Cinema Theatre Profile & Onboarding)
// ---------------------------------------------------------------------------
export const cinemaProfiles = pgTable(
  'cinema_profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    theatreName: varchar('theatre_name', { length: 255 }).notNull(),
    chainOrBrand: varchar('chain_or_brand', { length: 255 }),
    address: text('address'),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 100 }).notNull(),
    country: varchar('country', { length: 100 }).default('India').notNull(),
    contactNumber: varchar('contact_number', { length: 50 }).notNull(),
    contactEmail: varchar('contact_email', { length: 255 }).notNull(),
    businessDetails: text('business_details'),
    timezone: varchar('timezone', { length: 100 }).default('Asia/Kolkata').notNull(),
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    logoKey: text('logo_key'),
    logoUrl: text('logo_url'),
    onboardingStage: varchar('onboarding_stage', { length: 50 }).default('profile_completed').notNull(),
    onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
    onboardingStagesCompleted: jsonb('onboarding_stages_completed').default(['profile_completed']).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('cinema_profiles_theatre_idx').on(table.theatreId),
    index('cinema_profiles_city_idx').on(table.city),
    index('cinema_profiles_state_idx').on(table.state)
  ]
);

// ---------------------------------------------------------------------------
// 2c. Cinema Screens Table (Multi-tenant Auditorium Management - Task 03)
// ---------------------------------------------------------------------------
export const cinemaScreens = pgTable(
  'cinema_screens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    screenName: varchar('screen_name', { length: 100 }).notNull(),
    description: text('description'),
    screenType: varchar('screen_type', { length: 50 }).default('standard').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    totalRows: integer('total_rows').default(0).notNull(),
    totalSeats: integer('total_seats').default(0).notNull(),
    seatingConfigured: boolean('seating_configured').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_screens_theatre_idx').on(table.theatreId),
    index('cinema_screens_status_idx').on(table.status),
    uniqueIndex('cinema_screens_theatre_name_idx').on(table.theatreId, table.screenName)
  ]
);

// ---------------------------------------------------------------------------
// 2d. Cinema Rows Table (Task 04 - Cinema Seating Configuration)
// ---------------------------------------------------------------------------
export const cinemaRows = pgTable(
  'cinema_rows',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    screenId: text('screen_id')
      .notNull()
      .references(() => cinemaScreens.id, { onDelete: 'cascade' }),
    rowIdentifier: varchar('row_identifier', { length: 10 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    startSeatNumber: integer('start_seat_number').default(1).notNull(),
    endSeatNumber: integer('end_seat_number').notNull(),
    totalSeats: integer('total_seats').notNull(),
    seatCategory: varchar('seat_category', { length: 50 }).default('regular').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_rows_theatre_idx').on(table.theatreId),
    index('cinema_rows_screen_idx').on(table.screenId),
    index('cinema_rows_sort_idx').on(table.screenId, table.sortOrder),
    uniqueIndex('cinema_rows_screen_row_idx').on(table.screenId, table.rowIdentifier)
  ]
);

// ---------------------------------------------------------------------------
// 2e. Cinema Seats Table (Task 04 - Cinema Individual Seat Records)
// ---------------------------------------------------------------------------
export const cinemaSeats = pgTable(
  'cinema_seats',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    screenId: text('screen_id')
      .notNull()
      .references(() => cinemaScreens.id, { onDelete: 'cascade' }),
    rowId: text('row_id')
      .notNull()
      .references(() => cinemaRows.id, { onDelete: 'cascade' }),
    rowIdentifier: varchar('row_identifier', { length: 10 }).notNull(),
    seatNumber: integer('seat_number').notNull(),
    seatIdentifier: varchar('seat_identifier', { length: 20 }).notNull(),
    seatCategory: varchar('seat_category', { length: 50 }).default('regular').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_seats_theatre_idx').on(table.theatreId),
    index('cinema_seats_screen_idx').on(table.screenId),
    index('cinema_seats_row_idx').on(table.rowId),
    uniqueIndex('cinema_seats_screen_seat_idx').on(table.screenId, table.seatIdentifier)
  ]
);

// ---------------------------------------------------------------------------
// 2f. Cinema Movies Table (Task 05 - Cinema Movie Management)
// ---------------------------------------------------------------------------
export const cinemaMovies = pgTable(
  'cinema_movies',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    posterUrl: text('poster_url'),
    posterKey: text('poster_key'),
    language: varchar('language', { length: 100 }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('active').notNull(), // 'active' | 'inactive' | 'archived'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_movies_theatre_idx').on(table.theatreId),
    index('cinema_movies_theatre_status_idx').on(table.theatreId, table.status)
  ]
);

// ---------------------------------------------------------------------------
// 2g. Cinema Shows Table (Task 06 - Daily Show Scheduling)
// ---------------------------------------------------------------------------
export const cinemaShows = pgTable(
  'cinema_shows',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    screenId: text('screen_id')
      .notNull()
      .references(() => cinemaScreens.id, { onDelete: 'cascade' }),
    movieId: text('movie_id')
      .notNull()
      .references(() => cinemaMovies.id, { onDelete: 'cascade' }),
    showDate: varchar('show_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    expectedEndTime: timestamp('expected_end_time', { withTimezone: true }).notNull(),
    orderingStartTime: timestamp('ordering_start_time', { withTimezone: true }).notNull(),
    orderingEndTime: timestamp('ordering_end_time', { withTimezone: true }).notNull(),
    turnaroundBufferMinutes: integer('turnaround_buffer_minutes').default(15).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(), // 'draft' | 'published' | 'cancelled' | 'completed'
    cancellationReason: text('cancellation_reason'),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_shows_theatre_idx').on(table.theatreId),
    index('cinema_shows_screen_idx').on(table.screenId),
    index('cinema_shows_movie_idx').on(table.movieId),
    index('cinema_shows_theatre_date_idx').on(table.theatreId, table.showDate),
    index('cinema_shows_screen_date_idx').on(table.screenId, table.showDate),
    index('cinema_shows_screen_time_idx').on(table.screenId, table.startTime, table.expectedEndTime),
    index('cinema_shows_status_idx').on(table.theatreId, table.status)
  ]
);






// ---------------------------------------------------------------------------
// 2h. Cinema QR Codes Table (Task 08 - General & Screen QR Codes)
// ---------------------------------------------------------------------------
export const cinemaQrCodes = pgTable(
  'cinema_qr_codes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    screenId: text('screen_id').references(() => cinemaScreens.id, {
      onDelete: 'cascade'
    }),
    qrType: varchar('qr_type', { length: 30 }).notNull(), // 'theatre' | 'screen'
    qrName: varchar('qr_name', { length: 255 }).notNull(),
    token: varchar('token', { length: 64 }).notNull(), // Unique public token
    theatreToken: varchar('theatre_token', { length: 64 }), // Associated theatre token
    screenToken: varchar('screen_token', { length: 64 }), // Associated screen token
    targetUrl: text('target_url').notNull(),
    qrCodeData: text('qr_code_data').notNull(), // High-res base64 PNG data URL
    status: varchar('status', { length: 20 }).default('active').notNull(), // 'active' | 'revoked' | 'replaced'
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: text('revoked_by_user_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_qr_theatre_idx').on(table.theatreId),
    index('cinema_qr_screen_idx').on(table.screenId),
    uniqueIndex('cinema_qr_token_idx').on(table.token),
    index('cinema_qr_status_idx').on(table.status),
    index('cinema_qr_theatre_type_status_idx').on(table.theatreId, table.qrType, table.status)
  ]
);

// ---------------------------------------------------------------------------
// 2i. Cinema Payment Accounts Table (Task 11 - Theatre Gateway Architecture)
// ---------------------------------------------------------------------------
export const cinemaPaymentAccounts = pgTable(
  'cinema_payment_accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(), // 'razorpay' | 'paytm'
    environment: varchar('environment', { length: 20 }).default('test').notNull(), // 'test' | 'live'
    keyId: varchar('key_id', { length: 255 }).notNull(), // Razorpay Key ID or Paytm MID
    encryptedKeySecret: text('encrypted_key_secret').notNull(), // AES-256-GCM encrypted
    encryptedWebhookSecret: text('encrypted_webhook_secret'), // AES-256-GCM encrypted (optional)
    maskedKeySecret: varchar('masked_key_secret', { length: 50 }).notNull(), // e.g. ••••••••abcd
    status: varchar('status', { length: 30 }).default('disconnected').notNull(), // 'connected' | 'disconnected' | 'verification_failed' | 'disabled'
    isVerified: boolean('is_verified').default(false).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastVerificationError: text('last_verification_error'),
    settings: jsonb('settings').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_pay_accts_theatre_idx').on(table.theatreId),
    uniqueIndex('cinema_pay_accts_theatre_provider_idx').on(table.theatreId, table.provider)
  ]
);

// ---------------------------------------------------------------------------
// 2j. Cinema Payment Transactions Table (Task 11 - Payment Ledger)
// ---------------------------------------------------------------------------
export const cinemaPaymentTransactions = pgTable(
  'cinema_payment_transactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    paymentAccountId: text('payment_account_id').references(() => cinemaPaymentAccounts.id, { onDelete: 'set null' }),
    provider: varchar('provider', { length: 30 }).notNull(), // 'razorpay' | 'paytm'
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),
    providerOrderId: varchar('provider_order_id', { length: 255 }),
    amount: integer('amount').notNull(), // in integer paise
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    status: varchar('status', { length: 50 }).default('PENDING').notNull(), // 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED'
    refundStatus: varchar('refund_status', { length: 50 }),
    refundAmount: integer('refund_amount').default(0).notNull(), // in integer paise
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_pay_tx_theatre_idx').on(table.theatreId),
    index('cinema_pay_tx_order_idx').on(table.orderId),
    index('cinema_pay_tx_provider_order_idx').on(table.provider, table.providerOrderId),
    index('cinema_pay_tx_provider_payment_idx').on(table.provider, table.providerPaymentId)
  ]
);

// ---------------------------------------------------------------------------
// 2k. Cinema Refunds Table (Task 11 - Admin Refund Audit)
// ---------------------------------------------------------------------------
export const cinemaRefunds = pgTable(
  'cinema_refunds',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id').references(() => cinemaPaymentTransactions.id, { onDelete: 'cascade' }),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    provider: varchar('provider', { length: 30 }).notNull(),
    providerRefundId: varchar('provider_refund_id', { length: 255 }),
    amount: integer('amount').notNull(), // in integer paise
    reason: text('reason'),
    status: varchar('status', { length: 50 }).default('REFUND_PENDING').notNull(), // 'REFUND_PENDING' | 'REFUND_PROCESSED' | 'REFUND_FAILED'
    initiatedBy: varchar('initiated_by', { length: 255 }).notNull(),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_refunds_theatre_idx').on(table.theatreId),
    index('cinema_refunds_tx_idx').on(table.transactionId),
    index('cinema_refunds_order_idx').on(table.orderId)
  ]
);

// ---------------------------------------------------------------------------
// 2l. Cinema Webhook Events Table (Task 12/13 - Idempotent Webhook Audit)
// ---------------------------------------------------------------------------
export const cinemaWebhookEvents = pgTable(
  'cinema_webhook_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(), // 'paytm' | 'razorpay'
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    providerOrderId: varchar('provider_order_id', { length: 255 }),
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),
    status: varchar('status', { length: 50 }).default('processed').notNull(), // 'processed' | 'duplicate_ignored' | 'failed'
    payload: jsonb('payload').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('cinema_wh_events_theatre_idx').on(table.theatreId),
    index('cinema_wh_events_provider_idx').on(table.provider, table.providerEventId),
    uniqueIndex('cinema_wh_events_unique_idx').on(table.theatreId, table.provider, table.providerEventId)
  ]
);

// ---------------------------------------------------------------------------
// 3. Restaurant Members (Multi-tenancy Access Control)
// ---------------------------------------------------------------------------
export const restaurantMembers = pgTable(
  'restaurant_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    restaurantId: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).default('staff').notNull(), // 'owner' | 'admin' | 'staff' | 'kitchen' | 'delivery'
    status: varchar('status', { length: 50 }).default('active').notNull(), // 'active' | 'inactive'
    phone: varchar('phone', { length: 50 }),
    staffName: varchar('staff_name', { length: 255 }),
    pin: varchar('pin', { length: 10 }),
    isPasswordSet: boolean('is_password_set').default(false).notNull(),
    canCashier: boolean('can_cashier').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('restaurant_members_restaurant_idx').on(table.restaurantId),
    index('restaurant_members_user_idx').on(table.userId),
    uniqueIndex('restaurant_members_unique_idx').on(table.restaurantId, table.userId),
    index('restaurant_members_restaurant_pin_idx').on(table.restaurantId, table.pin)
  ]
);

// ---------------------------------------------------------------------------
// 3b. Restaurant Invitations (Staff Invitation Workflow)
// ---------------------------------------------------------------------------
export const restaurantInvitations = pgTable(
  'restaurant_invitations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    restaurantId: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).default('staff').notNull(), // 'admin' | 'staff' | 'kitchen'
    token: varchar('token', { length: 255 }).notNull(),
    invitedByUserId: text('invited_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending' | 'accepted' | 'revoked' | 'expired'
    canCashier: boolean('can_cashier').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('restaurant_invitations_restaurant_idx').on(table.restaurantId),
    index('restaurant_invitations_email_idx').on(table.email),
    uniqueIndex('restaurant_invitations_token_idx').on(table.token)
  ]
);

// ---------------------------------------------------------------------------
// 4. Categories Table
// ---------------------------------------------------------------------------
export const categories = pgTable(
  'categories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    restaurantId: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('categories_restaurant_idx').on(table.restaurantId),
    index('categories_restaurant_sort_idx').on(table.restaurantId, table.sortOrder),
    uniqueIndex('categories_restaurant_name_idx').on(table.restaurantId, table.name)
  ]
);

// ---------------------------------------------------------------------------
// 5. Products / Menu Items Table (Prices in integer paise)
// ---------------------------------------------------------------------------
export const products = pgTable(
  'products',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    restaurantId: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'set null'
    }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    price: integer('price').notNull(), // stored in integer paise (₹180 = 18000 paise)
    imageKey: text('image_key'),
    imageUrl: text('image_url'),
    isAvailable: boolean('is_available').default(true).notNull(),
    isVegetarian: boolean('is_vegetarian').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('products_restaurant_idx').on(table.restaurantId),
    index('products_category_idx').on(table.categoryId),
    index('products_restaurant_available_idx').on(table.restaurantId, table.isAvailable)
  ]
);

// ---------------------------------------------------------------------------
// 6. Restaurant Tables (Cryptographically random table_token)
// ---------------------------------------------------------------------------
export const restaurantTables = pgTable(
  'restaurant_tables',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    restaurantId: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    tableNumber: varchar('table_number', { length: 50 }).notNull(),
    tableToken: varchar('table_token', { length: 100 })
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomBytes(16).toString('hex')),
    capacity: integer('capacity').default(4).notNull(),
    qrCodeUrl: text('qr_code_url'),
    qrCodeData: text('qr_code_data'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('tables_restaurant_idx').on(table.restaurantId),
    uniqueIndex('table_restaurant_number_idx').on(table.restaurantId, table.tableNumber),
    uniqueIndex('table_token_idx').on(table.tableToken)
  ]
);

// ---------------------------------------------------------------------------
// 6b. Table Sessions (Single Active Party Security & Cashier Flow)
// ---------------------------------------------------------------------------
export const tableSessions = pgTable(
  'table_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    restaurantId: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    tableId: text('table_id')
      .notNull()
      .references(() => restaurantTables.id, { onDelete: 'cascade' }),
    sessionToken: varchar('session_token', { length: 100 })
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomBytes(32).toString('hex')),
    status: varchar('status', { length: 50 }).default('active').notNull(), // 'active' | 'closed'
    customerName: varchar('customer_name', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 50 }),
    deviceFingerprint: text('device_fingerprint'),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByUserId: text('closed_by_user_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('table_sessions_restaurant_idx').on(table.restaurantId),
    index('table_sessions_table_status_idx').on(table.tableId, table.status),
    uniqueIndex('table_sessions_token_idx').on(table.sessionToken),
    uniqueIndex('table_sessions_single_active_idx')
      .on(table.tableId)
      .where(sql`status = 'active'`)
  ]
);

// ---------------------------------------------------------------------------
// 7. Orders Table (totalAmount in integer paise)
// ---------------------------------------------------------------------------
export const orders = pgTable(
  'orders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderNumber: varchar('order_number', { length: 50 }).notNull(),
    restaurantId: text('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    orderType: varchar('order_type', { length: 50 }).default('restaurant').notNull(), // 'restaurant' | 'cinema'
    tableId: text('table_id').references(() => restaurantTables.id, {
      onDelete: 'set null'
    }),
    tableSessionId: text('table_session_id').references(() => tableSessions.id, {
      onDelete: 'set null'
    }),
    // Cinema Order Context (Task 10 & 14)
    screenId: text('screen_id').references(() => cinemaScreens.id, {
      onDelete: 'set null'
    }),
    showId: text('show_id').references(() => cinemaShows.id, {
      onDelete: 'set null'
    }),
    movieId: text('movie_id').references(() => cinemaMovies.id, {
      onDelete: 'set null'
    }),
    showDate: varchar('show_date', { length: 20 }),
    showtime: varchar('showtime', { length: 20 }),
    seatRow: varchar('seat_row', { length: 50 }),
    seatNumber: varchar('seat_number', { length: 50 }),
    status: varchar('status', { length: 50 }).default('new').notNull(),
    subtotal: integer('subtotal').default(0).notNull(), // stored in integer paise
    taxAmount: integer('tax_amount').default(0).notNull(), // stored in integer paise
    totalAmount: integer('total_amount').default(0).notNull(), // stored in integer paise
    paymentStatus: varchar('payment_status', { length: 50 }).default('unpaid').notNull(), // 'unpaid' | 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'
    paymentMethod: varchar('payment_method', { length: 50 }), // 'razorpay' | 'paytm'
    paymentReference: varchar('payment_reference', { length: 255 }),
    specialInstructions: text('special_instructions'),
    customerName: varchar('customer_name', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 50 }),
    // Delivery Tracking Context (Task 16 & 17)
    deliveryStaffId: text('delivery_staff_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    deliveryStaffName: varchar('delivery_staff_name', { length: 255 }),
    deliveryStatus: varchar('delivery_status', { length: 50 }).default('unassigned'), // 'unassigned' | 'assigned' | 'delivered'
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    statusToken: varchar('status_token', { length: 100 })
      .$defaultFn(() => crypto.randomBytes(16).toString('hex')),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('orders_restaurant_idx').on(table.restaurantId),
    index('orders_type_idx').on(table.orderType),
    index('orders_table_idx').on(table.tableId),
    index('orders_table_session_idx').on(table.tableSessionId),
    index('orders_screen_idx').on(table.screenId),
    index('orders_show_idx').on(table.showId),
    index('orders_movie_idx').on(table.movieId),
    index('orders_payment_ref_idx').on(table.paymentReference),
    index('orders_delivery_status_idx').on(table.deliveryStatus),
    index('orders_status_idx').on(table.restaurantId, table.status),
    index('orders_restaurant_created_idx').on(table.restaurantId, table.createdAt),
    uniqueIndex('orders_idempotency_idx').on(table.restaurantId, table.idempotencyKey),
    uniqueIndex('orders_status_token_idx').on(table.statusToken)
  ]
);

// ---------------------------------------------------------------------------
// 7b. Cinema Carts Table (Persistent Cinema Order Context & Session - Task 10)
// ---------------------------------------------------------------------------
export const cinemaCarts = pgTable(
  'cinema_carts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    cartToken: varchar('cart_token', { length: 64 }).notNull().unique(),
    theatreId: text('theatre_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    screenId: text('screen_id').references(() => cinemaScreens.id, {
      onDelete: 'set null'
    }),
    showId: text('show_id').references(() => cinemaShows.id, {
      onDelete: 'set null'
    }),
    seatRow: varchar('seat_row', { length: 50 }),
    seatNumber: varchar('seat_number', { length: 50 }),
    items: jsonb('items')
      .$type<Array<{ productId: string; quantity: number; notes?: string }>>()
      .default([])
      .notNull(),
    customerName: varchar('customer_name', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 50 }),
    specialInstructions: text('special_instructions'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('cinema_carts_token_idx').on(table.cartToken),
    index('cinema_carts_theatre_idx').on(table.theatreId),
    index('cinema_carts_screen_idx').on(table.screenId),
    index('cinema_carts_show_idx').on(table.showId),
    index('cinema_carts_updated_idx').on(table.updatedAt)
  ]
);

// ---------------------------------------------------------------------------
// 8. Order Items Table (Snapshots with prices in integer paise)
// ---------------------------------------------------------------------------
export const orderItems = pgTable(
  'order_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id').references(() => products.id, {
      onDelete: 'set null' // preserving order history if product is deleted
    }),
    productName: varchar('product_name', { length: 255 }).notNull(),
    quantity: integer('quantity').default(1).notNull(),
    unitPrice: integer('unit_price').notNull(), // snapshot in integer paise
    subtotal: integer('subtotal').notNull(), // snapshot in integer paise
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('order_items_order_idx').on(table.orderId),
    index('order_items_product_idx').on(table.productId)
  ]
);

// ---------------------------------------------------------------------------
// 9. Order Status History Table (Audit Trail)
// ---------------------------------------------------------------------------
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 50 }).notNull(),
    toStatus: varchar('to_status', { length: 50 }).notNull(),
    changedByUserId: text('changed_by_user_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    changedByRole: varchar('changed_by_role', { length: 50 }).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('order_status_history_order_idx').on(table.orderId),
    index('order_status_history_created_idx').on(table.createdAt)
  ]
);

// ---------------------------------------------------------------------------
// Drizzle Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(user, ({ many }) => ({
  memberships: many(restaurantMembers),
  sessions: many(session),
  accounts: many(account)
}));

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  members: many(restaurantMembers),
  invitations: many(restaurantInvitations),
  categories: many(categories),
  products: many(products),
  tables: many(restaurantTables),
  orders: many(orders),
  cinemaProfile: one(cinemaProfiles, {
    fields: [restaurants.id],
    references: [cinemaProfiles.theatreId]
  }),
  screens: many(cinemaScreens),
  rows: many(cinemaRows),
  seats: many(cinemaSeats),
  movies: many(cinemaMovies),
  shows: many(cinemaShows),
  cinemaQrCodes: many(cinemaQrCodes),
  cinemaPaymentAccounts: many(cinemaPaymentAccounts),
  cinemaPaymentTransactions: many(cinemaPaymentTransactions),
  cinemaRefunds: many(cinemaRefunds)
}));

export const cinemaMoviesRelations = relations(cinemaMovies, ({ one, many }) => ({
  theatre: one(restaurants, {
    fields: [cinemaMovies.theatreId],
    references: [restaurants.id]
  }),
  shows: many(cinemaShows)
}));

export const cinemaProfilesRelations = relations(cinemaProfiles, ({ one }) => ({
  theatre: one(restaurants, {
    fields: [cinemaProfiles.theatreId],
    references: [restaurants.id]
  })
}));

export const cinemaScreensRelations = relations(cinemaScreens, ({ one, many }) => ({
  theatre: one(restaurants, {
    fields: [cinemaScreens.theatreId],
    references: [restaurants.id]
  }),
  rows: many(cinemaRows),
  seats: many(cinemaSeats),
  shows: many(cinemaShows),
  cinemaQrCodes: many(cinemaQrCodes)
}));

export const cinemaShowsRelations = relations(cinemaShows, ({ one }) => ({
  theatre: one(restaurants, {
    fields: [cinemaShows.theatreId],
    references: [restaurants.id]
  }),
  screen: one(cinemaScreens, {
    fields: [cinemaShows.screenId],
    references: [cinemaScreens.id]
  }),
  movie: one(cinemaMovies, {
    fields: [cinemaShows.movieId],
    references: [cinemaMovies.id]
  }),
  createdByUser: one(user, {
    fields: [cinemaShows.createdByUserId],
    references: [user.id]
  })
}));

export const cinemaRowsRelations = relations(cinemaRows, ({ one, many }) => ({
  theatre: one(restaurants, {
    fields: [cinemaRows.theatreId],
    references: [restaurants.id]
  }),
  screen: one(cinemaScreens, {
    fields: [cinemaRows.screenId],
    references: [cinemaScreens.id]
  }),
  seats: many(cinemaSeats)
}));

export const cinemaSeatsRelations = relations(cinemaSeats, ({ one }) => ({
  theatre: one(restaurants, {
    fields: [cinemaSeats.theatreId],
    references: [restaurants.id]
  }),
  screen: one(cinemaScreens, {
    fields: [cinemaSeats.screenId],
    references: [cinemaScreens.id]
  }),
  row: one(cinemaRows, {
    fields: [cinemaSeats.rowId],
    references: [cinemaRows.id]
  })
}));

export const cinemaQrCodesRelations = relations(cinemaQrCodes, ({ one }) => ({
  theatre: one(restaurants, {
    fields: [cinemaQrCodes.theatreId],
    references: [restaurants.id]
  }),
  screen: one(cinemaScreens, {
    fields: [cinemaQrCodes.screenId],
    references: [cinemaScreens.id]
  }),
  revokedByUser: one(user, {
    fields: [cinemaQrCodes.revokedByUserId],
    references: [user.id]
  })
}));

export const restaurantInvitationsRelations = relations(restaurantInvitations, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantInvitations.restaurantId],
    references: [restaurants.id]
  }),
  invitedBy: one(user, {
    fields: [restaurantInvitations.invitedByUserId],
    references: [user.id]
  })
}));

export const restaurantMembersRelations = relations(restaurantMembers, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantMembers.restaurantId],
    references: [restaurants.id]
  }),
  user: one(user, {
    fields: [restaurantMembers.userId],
    references: [user.id]
  })
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [categories.restaurantId],
    references: [restaurants.id]
  }),
  products: many(products)
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [products.restaurantId],
    references: [restaurants.id]
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  orderItems: many(orderItems)
}));

export const restaurantTablesRelations = relations(restaurantTables, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantTables.restaurantId],
    references: [restaurants.id]
  }),
  sessions: many(tableSessions),
  orders: many(orders)
}));

export const tableSessionsRelations = relations(tableSessions, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [tableSessions.restaurantId],
    references: [restaurants.id]
  }),
  table: one(restaurantTables, {
    fields: [tableSessions.tableId],
    references: [restaurantTables.id]
  }),
  orders: many(orders),
  closedBy: one(user, {
    fields: [tableSessions.closedByUserId],
    references: [user.id]
  })
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id]
  }),
  table: one(restaurantTables, {
    fields: [orders.tableId],
    references: [restaurantTables.id]
  }),
  session: one(tableSessions, {
    fields: [orders.tableSessionId],
    references: [tableSessions.id]
  }),
  screen: one(cinemaScreens, {
    fields: [orders.screenId],
    references: [cinemaScreens.id]
  }),
  show: one(cinemaShows, {
    fields: [orders.showId],
    references: [cinemaShows.id]
  }),
  movie: one(cinemaMovies, {
    fields: [orders.movieId],
    references: [cinemaMovies.id]
  }),
  items: many(orderItems),
  paymentTransactions: many(cinemaPaymentTransactions),
  refunds: many(cinemaRefunds)
}));

export const cinemaPaymentAccountsRelations = relations(cinemaPaymentAccounts, ({ one, many }) => ({
  theatre: one(restaurants, {
    fields: [cinemaPaymentAccounts.theatreId],
    references: [restaurants.id]
  }),
  transactions: many(cinemaPaymentTransactions)
}));

export const cinemaPaymentTransactionsRelations = relations(cinemaPaymentTransactions, ({ one, many }) => ({
  theatre: one(restaurants, {
    fields: [cinemaPaymentTransactions.theatreId],
    references: [restaurants.id]
  }),
  order: one(orders, {
    fields: [cinemaPaymentTransactions.orderId],
    references: [orders.id]
  }),
  account: one(cinemaPaymentAccounts, {
    fields: [cinemaPaymentTransactions.paymentAccountId],
    references: [cinemaPaymentAccounts.id]
  }),
  refunds: many(cinemaRefunds)
}));

export const cinemaRefundsRelations = relations(cinemaRefunds, ({ one }) => ({
  theatre: one(restaurants, {
    fields: [cinemaRefunds.theatreId],
    references: [restaurants.id]
  }),
  transaction: one(cinemaPaymentTransactions, {
    fields: [cinemaRefunds.transactionId],
    references: [cinemaPaymentTransactions.id]
  }),
  order: one(orders, {
    fields: [cinemaRefunds.orderId],
    references: [orders.id]
  })
}));

export const cinemaCartsRelations = relations(cinemaCarts, ({ one }) => ({
  theatre: one(restaurants, {
    fields: [cinemaCarts.theatreId],
    references: [restaurants.id]
  }),
  screen: one(cinemaScreens, {
    fields: [cinemaCarts.screenId],
    references: [cinemaScreens.id]
  }),
  show: one(cinemaShows, {
    fields: [cinemaCarts.showId],
    references: [cinemaShows.id]
  })
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id]
  })
}));
