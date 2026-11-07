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
    isActive: boolean('is_active').default(true).notNull(),
    settings: jsonb('settings').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('restaurant_slug_idx').on(table.slug),
    index('restaurant_created_at_idx').on(table.createdAt)
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
    role: varchar('role', { length: 50 }).default('staff').notNull(), // 'owner' | 'admin' | 'staff' | 'kitchen'
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
    tableId: text('table_id').references(() => restaurantTables.id, {
      onDelete: 'set null'
    }),
    tableSessionId: text('table_session_id').references(() => tableSessions.id, {
      onDelete: 'set null'
    }),
    status: varchar('status', { length: 50 }).default('new').notNull(),
    totalAmount: integer('total_amount').default(0).notNull(), // stored in integer paise
    specialInstructions: text('special_instructions'),
    customerName: varchar('customer_name', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 50 }),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    statusToken: varchar('status_token', { length: 100 })
      .$defaultFn(() => crypto.randomBytes(16).toString('hex')),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('orders_restaurant_idx').on(table.restaurantId),
    index('orders_table_idx').on(table.tableId),
    index('orders_table_session_idx').on(table.tableSessionId),
    index('orders_status_idx').on(table.restaurantId, table.status),
    index('orders_restaurant_created_idx').on(table.restaurantId, table.createdAt),
    uniqueIndex('orders_idempotency_idx').on(table.restaurantId, table.idempotencyKey),
    uniqueIndex('orders_status_token_idx').on(table.statusToken)
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

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  members: many(restaurantMembers),
  invitations: many(restaurantInvitations),
  categories: many(categories),
  products: many(products),
  tables: many(restaurantTables),
  orders: many(orders)
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
  items: many(orderItems)
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
