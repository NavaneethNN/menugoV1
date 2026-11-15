import { z } from 'zod';
import {
  ORDER_STATUSES,
  RESTAURANT_MEMBER_ROLES,
  TENANT_TYPES,
  CINEMA_ONBOARDING_STAGES,
  DEFAULT_CINEMA_TIMEZONE,
  SCREEN_TYPES,
  SCREEN_STATUSES,
  SEAT_CATEGORIES,
  SEAT_STATUSES,
  ROW_STATUSES,
  MOVIE_STATUSES,
  SHOW_STATUSES,
  DEFAULT_TURNAROUND_BUFFER_MINUTES,
  CINEMA_PAYMENT_PROVIDERS,
  CINEMA_PAYMENT_ENVIRONMENTS,
  CINEMA_PAYMENT_ACCOUNT_STATUSES,
  CINEMA_PAYMENT_STATUSES,
  CINEMA_REFUND_STATUSES,
  CINEMA_MEMBER_ROLES,
  CINEMA_STAFF_ASSIGNABLE_ROLES,
  CINEMA_STAFF_STATUSES
} from './constants';

// ---------------------------------------------------------------------------
// Currency / Money Utilities (Integer Paise)
// ---------------------------------------------------------------------------
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatPaise(paise: number, currency = 'INR'): string {
  if (isNaN(paise) || paise === null || paise === undefined) return '₹0';
  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const wholeRupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  if (currency === 'INR') {
    const formattedRupees = wholeRupees.toLocaleString('en-IN');
    const decimal = remainderPaise > 0 ? `.${remainderPaise.toString().padStart(2, '0')}` : '';
    return `${isNegative ? '-' : ''}₹${formattedRupees}${decimal}`;
  }

  const rupees = wholeRupees + remainderPaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(isNegative ? -rupees : rupees);
}

// ---------------------------------------------------------------------------
// Common Schemas
// ---------------------------------------------------------------------------
export const idSchema = z.string().min(1, 'ID is required');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional()
});

// ---------------------------------------------------------------------------
// Slug Utilities & Validation
// ---------------------------------------------------------------------------
export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length >= 2 && slug.length <= 100 && slugRegex.test(slug);
}

export const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug cannot exceed 100 characters')
  .regex(
    slugRegex,
    'Slug must start and end with a letter or number, and can only contain lowercase letters, numbers, and single hyphens'
  );

// ---------------------------------------------------------------------------
// Restaurant Schemas
// ---------------------------------------------------------------------------
export const createRestaurantSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters').max(255),
  slug: slugSchema,
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  logoKey: z.string().optional().nullable(),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable().or(z.literal('')),
  coverImageKey: z.string().optional().nullable(),
  coverImageUrl: z.string().url('Invalid cover URL').optional().nullable().or(z.literal('')),
  currency: z.string().length(3).default('INR'),
  tenantType: z.enum(TENANT_TYPES).default('restaurant'),
  isActive: z.boolean().default(true),
  settings: z
    .object({
      taxRate: z.number().min(0).max(100).default(0),
      serviceChargeRate: z.number().min(0).max(100).default(0),
      allowSpecialInstructions: z.boolean().default(true),
      autoAcceptOrders: z.boolean().default(false)
    })
    .default({})
});

export const updateRestaurantSchema = createRestaurantSchema.partial();

export const restaurantSchema = createRestaurantSchema.extend({
  id: z.string(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Category Schemas
// ---------------------------------------------------------------------------
export const createCategorySchema = z.object({
  restaurantId: z.string().min(1, 'Restaurant ID is required'),
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Category name cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  sortOrder: z.number().int().min(0, 'Sort order must be non-negative').default(0),
  isActive: z.boolean().default(true)
});

export const updateCategorySchema = createCategorySchema.omit({ restaurantId: true }).partial();

export const reorderCategoriesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1, 'Category ID is required'),
      sortOrder: z.number().int().min(0, 'Sort order must be non-negative')
    })
  ).min(1, 'At least one category is required to reorder')
});

export const categorySchema = createCategorySchema.extend({
  id: z.string(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Product / Menu Item Schemas (Price in integer paise)
// ---------------------------------------------------------------------------
export const createProductSchema = z.object({
  restaurantId: z.string().min(1, 'Restaurant ID is required'),
  categoryId: z.string().optional().nullable().or(z.literal('')),
  name: z.string().trim().min(1, 'Product name is required').max(255, 'Product name cannot exceed 255 characters'),
  description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
  price: z.number({ invalid_type_error: 'Price must be a valid number of paise' })
    .int('Price must be an integer number of paise (no floating point)')
    .min(0, 'Price must be a non-negative integer in paise'),
  imageKey: z.string().optional().nullable().or(z.literal('')),
  imageUrl: z.string().url('Invalid image URL').optional().nullable().or(z.literal('')),
  isAvailable: z.boolean().default(true),
  isVegetarian: z.boolean().default(true),
  sortOrder: z.number().int().min(0, 'Sort order must be non-negative').default(0)
});

export const updateProductSchema = createProductSchema.omit({ restaurantId: true }).partial();

export const reorderProductsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1, 'Product ID is required'),
      sortOrder: z.number().int().min(0, 'Sort order must be non-negative')
    })
  ).min(1, 'At least one product is required to reorder')
});

export const productSchema = createProductSchema.extend({
  id: z.string(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Restaurant Table Schemas & QR Token Utilities
// ---------------------------------------------------------------------------
export function generateTableToken(bytes = 24): string {
  // Generates unguessable, high-entropy cryptographic token
  // 24 bytes = 48 hex characters = 192 bits of cryptographic entropy
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for Node environments where globalThis.crypto is node:crypto
  const nodeCrypto = require('crypto');
  return nodeCrypto.randomBytes(bytes).toString('hex');
}

export function buildCustomerTableUrl(
  appUrl: string,
  restaurantSlug: string,
  tableToken: string
): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/menu/${restaurantSlug}?table=${tableToken}`;
}

export function isValidTableTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  // Validates hex string of at least 32 characters (128+ bits of entropy)
  return /^[a-f0-9]{32,64}$/i.test(token.trim());
}

export const createTableSchema = z.object({
  restaurantId: z.string().min(1, 'Restaurant ID is required'),
  tableNumber: z.string().trim().min(1, 'Table number/name is required').max(50, 'Table number cannot exceed 50 characters'),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1 guest').default(4),
  isActive: z.boolean().default(true)
});

export const updateTableSchema = createTableSchema.omit({ restaurantId: true }).partial();

export const restaurantTableSchema = createTableSchema.extend({
  id: z.string(),
  tableToken: z.string(),
  qrCodeUrl: z.string().optional().nullable(),
  qrCodeData: z.string().optional().nullable(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Order & Order Item Schemas (Amounts in integer paise)
// ---------------------------------------------------------------------------
export const publicOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a valid integer' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99 per item'),
  notes: z
    .string()
    .trim()
    .max(140, 'Item cooking note cannot exceed 140 characters')
    .optional()
    .nullable()
});

export const publicCreateOrderSchema = z.object({
  restaurantSlug: z.string().trim().min(1, 'Restaurant slug is required'),
  tableToken: z.string().trim().min(1, 'Table QR token is required'),
  items: z
    .array(publicOrderItemSchema)
    .min(1, 'Order must contain at least one item')
    .max(50, 'Order cannot exceed 50 distinct items'),
  customerName: z
    .string()
    .trim()
    .max(100, 'Customer name cannot exceed 100 characters')
    .optional()
    .nullable(),
  customerPhone: z
    .string()
    .trim()
    .max(20, 'Customer phone cannot exceed 20 characters')
    .optional()
    .nullable(),
  specialInstructions: z
    .string()
    .trim()
    .max(500, 'Special instructions cannot exceed 500 characters')
    .optional()
    .nullable(),
  idempotencyKey: z
    .string()
    .trim()
    .max(100, 'Idempotency key cannot exceed 100 characters')
    .optional()
    .nullable()
});

export const createOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a valid integer' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99 per item'),
  notes: z
    .string()
    .trim()
    .max(140, 'Item cooking note cannot exceed 140 characters')
    .optional()
    .nullable()
});

export const createOrderSchema = z.object({
  restaurantId: z.string().optional(),
  restaurantSlug: z.string().optional(),
  tableId: z.string().optional(),
  tableToken: z.string().optional(),
  tableSessionToken: z.string().optional(),
  customerName: z.string().max(100).optional().nullable(),
  customerPhone: z.string().max(20).optional().nullable(),
  specialInstructions: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().max(100).optional().nullable(),
  items: z
    .array(createOrderItemSchema)
    .min(1, 'Order must contain at least one item')
    .max(50, 'Order cannot exceed 50 distinct items')
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    errorMap: () => ({ message: 'Invalid order status' })
  }),
  expectedCurrentStatus: z.enum(ORDER_STATUSES).optional(),
  reason: z.string().trim().max(255).optional().nullable()
});

export const orderStatusHistorySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  fromStatus: z.enum(ORDER_STATUSES),
  toStatus: z.enum(ORDER_STATUSES),
  changedByUserId: z.string().optional().nullable(),
  changedByRole: z.string(),
  reason: z.string().optional().nullable(),
  createdAt: z.date().or(z.string())
});

export const orderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string().nullable().optional(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int(), // in integer paise
  subtotal: z.number().int(), // in integer paise
  notes: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string().or(z.number()),
  restaurantId: z.string(),
  tableId: z.string().nullable().optional(),
  status: z.enum(ORDER_STATUSES),
  totalAmount: z.number().int(), // in integer paise
  specialInstructions: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  items: z.array(orderItemSchema).optional(),
  table: restaurantTableSchema.optional().nullable()
});

// ---------------------------------------------------------------------------
// Member Schemas (Task 18 Staff Administration)
// ---------------------------------------------------------------------------
export const STAFF_ASSIGNABLE_ROLES = ['admin', 'staff', 'kitchen'] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

export const addMemberSchema = z.object({
  restaurantId: z.string().min(1, 'Restaurant ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(RESTAURANT_MEMBER_ROLES)
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(RESTAURANT_MEMBER_ROLES)
});

export const inviteStaffSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  role: z.enum(STAFF_ASSIGNABLE_ROLES, {
    errorMap: () => ({ message: 'Role must be admin, staff, or kitchen' })
  }),
  canCashier: z.boolean().default(false).optional()
});

export const addStaffSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  role: z.enum(STAFF_ASSIGNABLE_ROLES, {
    errorMap: () => ({ message: 'Role must be admin, staff, or kitchen' })
  }),
  canCashier: z.boolean().default(false).optional()
});

export const updateStaffRoleSchema = z.object({
  role: z.enum(STAFF_ASSIGNABLE_ROLES, {
    errorMap: () => ({ message: 'Role must be admin, staff, or kitchen' })
  })
});

export const updateStaffCashierPermissionSchema = z.object({
  canCashier: z.boolean()
});

export const transferOwnershipSchema = z.object({
  targetMemberId: z.string().min(1, 'Target member ID is required').optional(),
  targetUserId: z.string().min(1, 'Target user ID is required').optional()
}).refine((data) => data.targetMemberId || data.targetUserId, {
  message: 'Either targetMemberId or targetUserId must be provided'
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16, 'Valid invitation token is required').trim()
});

export const restaurantMemberSchema = addMemberSchema.extend({
  id: z.string(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

export const restaurantInvitationSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  email: z.string().email(),
  role: z.enum(STAFF_ASSIGNABLE_ROLES),
  token: z.string(),
  invitedByUserId: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expiresAt: z.date().or(z.string()),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// PIN-Based Staff Management & Authentication Schemas
// ---------------------------------------------------------------------------

export const createStaffWithPinSchema = z.object({
  name: z.string().min(1, 'Staff name is required').max(100, 'Name must be 100 characters or fewer').trim(),
  role: z.enum(STAFF_ASSIGNABLE_ROLES, {
    errorMap: () => ({ message: 'Role must be admin, staff, or kitchen' })
  }),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits (0-9)'),
  canCashier: z.boolean().default(false).optional()
});

export const staffPinLoginSchema = z.object({
  restaurantSlug: z.string().min(1, 'Restaurant slug or ID is required').optional(),
  restaurantId: z.string().min(1, 'Restaurant ID is required').optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits (0-9)'),
  password: z.string().regex(/^\d{4}$/, 'Password must be exactly 4 numeric digits (0-9)').optional(),
  checkOnly: z.boolean().optional()
}).refine((data) => Boolean(data.restaurantSlug || data.restaurantId), {
  message: 'Either restaurantSlug or restaurantId must be provided'
});

export const staffPinCheckSchema = z.object({
  restaurantSlug: z.string().min(1, 'Restaurant slug or ID is required').optional(),
  restaurantId: z.string().min(1, 'Restaurant ID is required').optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits (0-9)')
}).refine((data) => Boolean(data.restaurantSlug || data.restaurantId), {
  message: 'Either restaurantSlug or restaurantId must be provided'
});

export const staffSetPasswordSchema = z.object({
  restaurantSlug: z.string().min(1, 'Restaurant slug or ID is required').optional(),
  restaurantId: z.string().min(1, 'Restaurant ID is required').optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits (0-9)'),
  password: z.string().regex(/^\d{4}$/, 'Password must be exactly 4 numeric digits (0-9)')
}).refine((data) => Boolean(data.restaurantSlug || data.restaurantId), {
  message: 'Either restaurantSlug or restaurantId must be provided'
});

export const updateStaffPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits (0-9)')
});

// ---------------------------------------------------------------------------
// Cashier & Table Session Schemas
// ---------------------------------------------------------------------------

export const openTableSessionSchema = z.object({
  customerName: z.string().max(100).optional().nullable(),
  customerPhone: z.string().max(20).optional().nullable()
});

export const closeTableSessionSchema = z.object({
  reason: z.string().max(255).optional().nullable(),
  forceClose: z.boolean().default(false).optional()
});

// ---------------------------------------------------------------------------
// Cinema Theatre Profile & Onboarding Schemas
// ---------------------------------------------------------------------------

export const createCinemaProfileSchema = z.object({
  theatreName: z.string().trim().min(2, 'Theatre name must be at least 2 characters').max(255),
  slug: slugSchema.optional(),
  chainOrBrand: z.string().trim().max(255).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  country: z.string().trim().min(1, 'Country is required').default('India'),
  contactNumber: z.string().trim().min(8, 'Contact number is required').max(50),
  contactEmail: z.string().trim().email('Valid contact email is required'),
  businessDetails: z.string().trim().max(1000).optional().nullable(),
  timezone: z.string().trim().default(DEFAULT_CINEMA_TIMEZONE),
  currency: z.string().trim().length(3).default('INR'),
  logoKey: z.string().optional().nullable(),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable().or(z.literal(''))
});

export const updateCinemaProfileSchema = createCinemaProfileSchema.partial();

export const updateCinemaOnboardingStageSchema = z.object({
  stage: z.enum(CINEMA_ONBOARDING_STAGES),
  completed: z.boolean().default(true)
});

export const cinemaProfileSchema = createCinemaProfileSchema.extend({
  id: z.string(),
  theatreId: z.string(),
  onboardingStage: z.enum(CINEMA_ONBOARDING_STAGES),
  onboardingCompleted: z.boolean(),
  onboardingStagesCompleted: z.array(z.string()),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Cinema Screen Schemas (Task 03)
// ---------------------------------------------------------------------------

export const createCinemaScreenSchema = z.object({
  screenName: z
    .string()
    .trim()
    .min(1, 'Screen name is required')
    .max(100, 'Screen name cannot exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  screenType: z.enum(SCREEN_TYPES).default('standard'),
  status: z.enum(['active', 'inactive']).default('active')
});

export const updateCinemaScreenSchema = z.object({
  screenName: z
    .string()
    .trim()
    .min(1, 'Screen name cannot be empty')
    .max(100, 'Screen name cannot exceed 100 characters')
    .optional(),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  screenType: z.enum(SCREEN_TYPES).optional(),
  status: z.enum(SCREEN_STATUSES).optional()
});

export const cinemaScreenSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  screenName: z.string(),
  description: z.string().nullable().optional(),
  screenType: z.enum(SCREEN_TYPES),
  status: z.enum(SCREEN_STATUSES),
  totalRows: z.number().int().nonnegative().default(0),
  totalSeats: z.number().int().nonnegative().default(0),
  seatingConfigured: z.boolean().default(false),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Cinema Seating Configuration Schemas (Task 04)
// ---------------------------------------------------------------------------

export const createCinemaRowSchema = z
  .object({
    rowIdentifier: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Row identifier is required')
      .max(10, 'Row identifier cannot exceed 10 characters')
      .regex(/^[A-Z0-9-]+$/, 'Row identifier can only contain uppercase letters, numbers and hyphens'),
    startSeatNumber: z.number().int().min(1, 'Starting seat number must be at least 1').default(1),
    endSeatNumber: z.number().int().min(1, 'Ending seat number must be at least 1'),
    seatCategory: z.enum(SEAT_CATEGORIES).default('regular'),
    status: z.enum(['active', 'inactive']).default('active'),
    sortOrder: z.number().int().optional()
  })
  .refine((data) => data.endSeatNumber >= data.startSeatNumber, {
    message: 'Ending seat number must be greater than or equal to starting seat number',
    path: ['endSeatNumber']
  });

export const updateCinemaRowSchema = z.object({
  rowIdentifier: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Row identifier cannot be empty')
    .max(10, 'Row identifier cannot exceed 10 characters')
    .regex(/^[A-Z0-9-]+$/, 'Row identifier can only contain uppercase letters, numbers and hyphens')
    .optional(),
  seatCategory: z.enum(SEAT_CATEGORIES).optional(),
  status: z.enum(ROW_STATUSES).optional(),
  sortOrder: z.number().int().optional()
});

export const createCinemaSeatSchema = z.object({
  rowId: z.string().min(1, 'Row ID is required'),
  seatNumber: z.number().int().min(1, 'Seat number must be at least 1'),
  seatCategory: z.enum(SEAT_CATEGORIES).default('regular'),
  status: z.enum(['active', 'inactive']).default('active')
});

export const updateCinemaSeatSchema = z.object({
  seatCategory: z.enum(SEAT_CATEGORIES).optional(),
  status: z.enum(SEAT_STATUSES).optional()
});

export const batchCreateCinemaRowsSchema = z.object({
  rows: z.array(createCinemaRowSchema).min(1, 'At least one row configuration is required')
});

export const cinemaRowSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  screenId: z.string(),
  rowIdentifier: z.string(),
  sortOrder: z.number().int(),
  startSeatNumber: z.number().int(),
  endSeatNumber: z.number().int(),
  totalSeats: z.number().int(),
  seatCategory: z.enum(SEAT_CATEGORIES),
  status: z.enum(ROW_STATUSES),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

export const cinemaSeatSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  screenId: z.string(),
  rowId: z.string(),
  rowIdentifier: z.string(),
  seatNumber: z.number().int(),
  seatIdentifier: z.string(),
  seatCategory: z.enum(SEAT_CATEGORIES),
  status: z.enum(SEAT_STATUSES),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Cinema Movie Management Schemas (Task 05)
// ---------------------------------------------------------------------------

export const createCinemaMovieSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Movie title is required')
    .max(255, 'Movie title cannot exceed 255 characters'),
  posterUrl: z
    .string()
    .trim()
    .url('Poster must be a valid URL')
    .optional()
    .or(z.literal(''))
    .nullable(),
  posterKey: z.string().trim().optional().nullable(),
  language: z
    .string()
    .trim()
    .min(1, 'Language is required')
    .max(100, 'Language cannot exceed 100 characters'),
  durationMinutes: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be an integer')
    .positive('Duration must be greater than 0 minutes')
    .max(600, 'Duration cannot exceed 600 minutes (10 hours)'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional()
    .or(z.literal(''))
    .nullable(),
  status: z.enum(MOVIE_STATUSES).default('active')
});

export const updateCinemaMovieSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Movie title cannot be empty')
    .max(255, 'Movie title cannot exceed 255 characters')
    .optional(),
  posterUrl: z
    .string()
    .trim()
    .url('Poster must be a valid URL')
    .optional()
    .or(z.literal(''))
    .nullable(),
  posterKey: z.string().trim().optional().nullable(),
  language: z
    .string()
    .trim()
    .min(1, 'Language cannot be empty')
    .max(100, 'Language cannot exceed 100 characters')
    .optional(),
  durationMinutes: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be an integer')
    .positive('Duration must be greater than 0 minutes')
    .max(600, 'Duration cannot exceed 600 minutes (10 hours)')
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional()
    .or(z.literal(''))
    .nullable(),
  status: z.enum(MOVIE_STATUSES).optional()
});

export const updateCinemaMoviePosterSchema = z.object({
  posterUrl: z.string().trim().url('Valid poster URL is required'),
  posterKey: z.string().trim().optional().nullable()
});

export const cinemaMovieSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  title: z.string(),
  posterUrl: z.string().nullable().optional(),
  posterKey: z.string().nullable().optional(),
  language: z.string(),
  durationMinutes: z.number().int(),
  description: z.string().nullable().optional(),
  status: z.enum(MOVIE_STATUSES),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Daily Show Scheduling Schemas (Task 06)
// ---------------------------------------------------------------------------

export const createCinemaShowSchema = z
  .object({
    screenId: z.string().min(1, 'Screen ID is required'),
    movieId: z.string().min(1, 'Movie ID is required'),
    showDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Show date must be in YYYY-MM-DD format'),
    startTime: z.string().min(1, 'Start time is required'),
    expectedEndTime: z.string().min(1, 'Expected end time is required'),
    orderingStartTime: z.string().min(1, 'Ordering start time is required'),
    orderingEndTime: z.string().min(1, 'Ordering closing time is required'),
    turnaroundBufferMinutes: z
      .number()
      .int('Buffer must be an integer')
      .min(0, 'Turnaround buffer cannot be negative')
      .max(120, 'Turnaround buffer cannot exceed 120 minutes')
      .default(DEFAULT_TURNAROUND_BUFFER_MINUTES),
    status: z.enum(SHOW_STATUSES).default('draft')
  })
  .refine(
    (data) => new Date(data.expectedEndTime).getTime() > new Date(data.startTime).getTime(),
    {
      message: 'Expected end time must be after show start time',
      path: ['expectedEndTime']
    }
  )
  .refine(
    (data) =>
      new Date(data.orderingEndTime).getTime() >= new Date(data.orderingStartTime).getTime(),
    {
      message: 'Ordering closing time must be after or equal to ordering start time',
      path: ['orderingEndTime']
    }
  );

export const updateCinemaShowSchema = z
  .object({
    screenId: z.string().min(1, 'Screen ID is required').optional(),
    movieId: z.string().min(1, 'Movie ID is required').optional(),
    showDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Show date must be in YYYY-MM-DD format')
      .optional(),
    startTime: z.string().min(1, 'Start time is required').optional(),
    expectedEndTime: z.string().min(1, 'Expected end time is required').optional(),
    orderingStartTime: z.string().min(1, 'Ordering start time is required').optional(),
    orderingEndTime: z.string().min(1, 'Ordering closing time is required').optional(),
    turnaroundBufferMinutes: z
      .number()
      .int()
      .min(0)
      .max(120)
      .optional(),
    status: z.enum(SHOW_STATUSES).optional(),
    cancellationReason: z.string().max(500).optional().nullable()
  })
  .refine(
    (data) => {
      if (data.startTime && data.expectedEndTime) {
        return new Date(data.expectedEndTime).getTime() > new Date(data.startTime).getTime();
      }
      return true;
    },
    {
      message: 'Expected end time must be after show start time',
      path: ['expectedEndTime']
    }
  )
  .refine(
    (data) => {
      if (data.orderingStartTime && data.orderingEndTime) {
        return (
          new Date(data.orderingEndTime).getTime() >= new Date(data.orderingStartTime).getTime()
        );
      }
      return true;
    },
    {
      message: 'Ordering closing time must be after or equal to ordering start time',
      path: ['orderingEndTime']
    }
  );

export const cancelCinemaShowSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .min(1, 'Cancellation reason is required')
    .max(500, 'Reason cannot exceed 500 characters')
});

export const copyCinemaScheduleSchema = z
  .object({
    sourceDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Source date must be in YYYY-MM-DD format'),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be in YYYY-MM-DD format'),
    screenId: z.string().optional()
  })
  .refine((data) => data.sourceDate !== data.targetDate, {
    message: 'Target date must be different from source date',
    path: ['targetDate']
  });

export const cinemaShowSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  screenId: z.string(),
  movieId: z.string(),
  showDate: z.string(),
  startTime: z.date().or(z.string()),
  expectedEndTime: z.date().or(z.string()),
  orderingStartTime: z.date().or(z.string()),
  orderingEndTime: z.date().or(z.string()),
  turnaroundBufferMinutes: z.number().int(),
  status: z.enum(SHOW_STATUSES),
  cancellationReason: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Cinema QR Code Schemas & Cryptographic Token Utilities (Task 08)
// ---------------------------------------------------------------------------

export function generateCinemaQrToken(bytes = 24): string {
  // Generates unguessable, high-entropy cryptographic token
  // 24 bytes = 48 hex characters = 192 bits of cryptographic entropy
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for Node environments
  const nodeCrypto = require('crypto');
  return nodeCrypto.randomBytes(bytes).toString('hex');
}

export function buildCinemaTheatreQrUrl(appUrl: string, theatreToken: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/cinema/${theatreToken}`;
}

export function buildCinemaScreenQrUrl(
  appUrl: string,
  theatreToken: string,
  screenToken: string
): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/cinema/${theatreToken}/${screenToken}`;
}

export function isValidCinemaQrTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  // Validates hex string of at least 32 characters (128+ bits of entropy)
  return /^[a-f0-9]{32,64}$/i.test(token.trim());
}

export const generateCinemaScreenQrSchema = z.object({
  screenId: z.string().min(1, 'Screen ID is required')
});

export const revokeCinemaQrSchema = z.object({
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional()
});

export const cinemaQrCodeSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  screenId: z.string().nullable().optional(),
  qrType: z.enum(['theatre', 'screen']),
  qrName: z.string(),
  token: z.string(),
  theatreToken: z.string().nullable().optional(),
  screenToken: z.string().nullable().optional(),
  targetUrl: z.string(),
  qrCodeData: z.string(),
  status: z.enum(['active', 'revoked', 'replaced']),
  revokedAt: z.date().or(z.string()).nullable().optional(),
  revokedByUserId: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});

// ---------------------------------------------------------------------------
// Cinema Cart & Checkout Schemas (Task 10)
// ---------------------------------------------------------------------------

export const cinemaCartItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a valid integer' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99 per item'),
  notes: z
    .string()
    .trim()
    .max(140, 'Special item notes cannot exceed 140 characters')
    .optional()
    .nullable()
});

export const cinemaCartContextSchema = z.object({
  theatreToken: z.string().min(1, 'Theatre QR token is required'),
  screenId: z.string().min(1, 'Screen ID is required'),
  showId: z.string().min(1, 'Show ID is required'),
  seatRow: z.string().trim().min(1, 'Row identifier is required'),
  seatNumber: z.string().trim().min(1, 'Seat identifier is required'),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  specialInstructions: z.string().trim().max(500).optional().nullable()
});

export const addCinemaCartItemSchema = cinemaCartContextSchema.extend({
  cartToken: z.string().optional().nullable(),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a valid integer' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99 per item')
    .default(1),
  notes: z
    .string()
    .trim()
    .max(140, 'Special item notes cannot exceed 140 characters')
    .optional()
    .nullable()
});

export const updateCinemaCartItemQuantitySchema = z.object({
  quantity: z
    .number({ invalid_type_error: 'Quantity must be an integer' })
    .int('Quantity must be an integer')
    .min(0, 'Quantity cannot be negative')
    .max(99, 'Quantity cannot exceed 99 per item'),
  notes: z
    .string()
    .trim()
    .max(140, 'Special item notes cannot exceed 140 characters')
    .optional()
    .nullable()
});

export const calculateCinemaCheckoutSchema = cinemaCartContextSchema.extend({
  items: z
    .array(cinemaCartItemSchema)
    .min(1, 'Order must contain at least one concessions item')
    .max(50, 'Order cannot exceed 50 distinct items')
});

export const prepareCinemaOrderSchema = calculateCinemaCheckoutSchema.extend({
  idempotencyKey: z
    .string()
    .trim()
    .max(100, 'Idempotency key cannot exceed 100 characters')
    .optional()
    .nullable()
});

// ---------------------------------------------------------------------------
// 10. Cinema Payment Gateway Architecture Schemas (Task 11)
// ---------------------------------------------------------------------------
export const configurePaymentProviderSchema = z.object({
  provider: z.enum(CINEMA_PAYMENT_PROVIDERS, {
    errorMap: () => ({ message: 'Payment provider must be either "razorpay" or "paytm"' })
  }),
  environment: z.enum(CINEMA_PAYMENT_ENVIRONMENTS).default('test'),
  keyId: z
    .string({ required_error: 'Key ID or Merchant ID is required' })
    .trim()
    .min(3, 'Key ID / Merchant ID must be at least 3 characters')
    .max(255, 'Key ID cannot exceed 255 characters'),
  keySecret: z
    .string({ required_error: 'Key Secret is required' })
    .trim()
    .min(4, 'Key Secret must be at least 4 characters')
    .max(500, 'Key Secret cannot exceed 500 characters'),
  webhookSecret: z
    .string()
    .trim()
    .max(500, 'Webhook secret cannot exceed 500 characters')
    .optional()
    .nullable(),
  settings: z.record(z.unknown()).optional().default({})
});

export const updatePaymentCredentialsSchema = z.object({
  environment: z.enum(CINEMA_PAYMENT_ENVIRONMENTS).optional(),
  keyId: z
    .string()
    .trim()
    .min(3, 'Key ID / Merchant ID must be at least 3 characters')
    .max(255, 'Key ID cannot exceed 255 characters')
    .optional(),
  keySecret: z
    .string()
    .trim()
    .min(4, 'Key Secret must be at least 4 characters')
    .max(500, 'Key Secret cannot exceed 500 characters')
    .optional(),
  webhookSecret: z
    .string()
    .trim()
    .max(500, 'Webhook secret cannot exceed 500 characters')
    .optional()
    .nullable(),
  settings: z.record(z.unknown()).optional()
});

export const cinemaPaymentAccountSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  provider: z.enum(CINEMA_PAYMENT_PROVIDERS),
  environment: z.enum(CINEMA_PAYMENT_ENVIRONMENTS),
  keyId: z.string(),
  maskedKeySecret: z.string(),
  hasWebhookSecret: z.boolean(),
  status: z.enum(CINEMA_PAYMENT_ACCOUNT_STATUSES),
  isVerified: z.boolean(),
  verifiedAt: z.string().nullable().optional(),
  lastVerificationError: z.string().nullable().optional(),
  settings: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const cinemaPaymentTransactionSchema = z.object({
  id: z.string(),
  theatreId: z.string(),
  orderId: z.string().nullable().optional(),
  paymentAccountId: z.string().nullable().optional(),
  provider: z.enum(CINEMA_PAYMENT_PROVIDERS),
  providerPaymentId: z.string().nullable().optional(),
  providerOrderId: z.string().nullable().optional(),
  amount: z.number().int(),
  currency: z.string().default('INR'),
  status: z.enum(CINEMA_PAYMENT_STATUSES),
  refundStatus: z.string().nullable().optional(),
  refundAmount: z.number().int().default(0),
  metadata: z.record(z.unknown()).optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const initiateCinemaRefundSchema = z.object({
  transactionId: z.string({ required_error: 'Transaction ID is required' }).min(1),
  amount: z
    .number({ required_error: 'Refund amount is required' })
    .int('Refund amount must be an integer in paise')
    .positive('Refund amount must be greater than 0'),
  reason: z
    .string()
    .trim()
    .max(500, 'Refund reason cannot exceed 500 characters')
    .optional()
    .nullable()
});

export const createCinemaPaymentOrderSchema = z.object({
  orderId: z.string({ required_error: 'Order ID is required' }).min(1),
  statusToken: z.string({ required_error: 'Order status token is required' }).min(1),
  provider: z.enum(CINEMA_PAYMENT_PROVIDERS, {
    errorMap: () => ({ message: 'Payment provider must be either "razorpay" or "paytm"' })
  })
});

export const verifyCinemaPaymentSchema = z.object({
  orderId: z.string({ required_error: 'Order ID is required' }).min(1),
  statusToken: z.string({ required_error: 'Order status token is required' }).min(1),
  transactionId: z.string({ required_error: 'Transaction ID is required' }).min(1),
  provider: z.enum(CINEMA_PAYMENT_PROVIDERS),
  providerPaymentId: z.string().optional().nullable(),
  providerOrderId: z.string().optional().nullable(),
  providerSignature: z.string().optional().nullable(),
  responsePayload: z.record(z.unknown()).optional().default({})
});

// ---------------------------------------------------------------------------
// Cinema Staff Schemas (Task 19)
// ---------------------------------------------------------------------------
export const addCinemaStaffSchema = z.object({
  name: z.string({ required_error: 'Staff name is required' }).min(1, 'Staff name is required').max(100, 'Name must be 100 characters or fewer').trim(),
  email: z.string({ required_error: 'Email address is required' }).email('Valid email address is required').trim().toLowerCase(),
  role: z.enum(CINEMA_STAFF_ASSIGNABLE_ROLES, {
    errorMap: () => ({ message: 'Role must be admin, kitchen, delivery, or staff' })
  }),
  phone: z.string().max(50, 'Phone must be 50 characters or fewer').optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional()
});

export type AddCinemaStaffInput = z.infer<typeof addCinemaStaffSchema>;

export const updateCinemaStaffSchema = z.object({
  staffName: z.string().min(1, 'Staff name is required').max(100).trim().optional(),
  phone: z.string().max(50).optional().nullable(),
  role: z.enum(CINEMA_STAFF_ASSIGNABLE_ROLES, {
    errorMap: () => ({ message: 'Role must be admin, kitchen, delivery, or staff' })
  }).optional(),
  status: z.enum(CINEMA_STAFF_STATUSES, {
    errorMap: () => ({ message: 'Status must be active or inactive' })
  }).optional()
});

export type UpdateCinemaStaffInput = z.infer<typeof updateCinemaStaffSchema>;

export const assignCinemaRoleSchema = z.object({
  role: z.enum(CINEMA_STAFF_ASSIGNABLE_ROLES, {
    errorMap: () => ({ message: 'Role must be admin, kitchen, delivery, or staff' })
  })
});

export type AssignCinemaRoleInput = z.infer<typeof assignCinemaRoleSchema>;









