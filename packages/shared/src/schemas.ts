import { z } from 'zod';
import { ORDER_STATUSES, RESTAURANT_MEMBER_ROLES } from './constants';

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


