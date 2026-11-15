export const ORDER_STATUSES = [
  'new',
  'pending',
  'confirmed',
  'accepted',
  'preparing',
  'ready',
  'assigned_for_delivery',
  'delivered',
  'served',
  'rejected',
  'cancelled'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const RESTAURANT_MEMBER_ROLES = [
  'owner',
  'admin',
  'staff',
  'kitchen'
] as const;

export type RestaurantMemberRole = (typeof RESTAURANT_MEMBER_ROLES)[number];

export const CINEMA_MEMBER_ROLES = [
  'owner',
  'admin',
  'kitchen',
  'delivery',
  'staff'
] as const;

export type CinemaMemberRole = (typeof CINEMA_MEMBER_ROLES)[number];

export const CINEMA_STAFF_ASSIGNABLE_ROLES = [
  'admin',
  'kitchen',
  'delivery',
  'staff'
] as const;

export type CinemaStaffAssignableRole = (typeof CINEMA_STAFF_ASSIGNABLE_ROLES)[number];

export const CINEMA_STAFF_STATUSES = ['active', 'inactive'] as const;
export type CinemaStaffStatus = (typeof CINEMA_STAFF_STATUSES)[number];

export const SOCKET_EVENTS = {
  // Room joining/leaving
  JOIN_RESTAURANT: 'restaurant:join',
  LEAVE_RESTAURANT: 'restaurant:leave',
  JOIN_ORDER: 'order:join',
  LEAVE_ORDER: 'order:leave',

  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:status_changed',

  // Table & Cashier Session events
  TABLE_SESSION_STARTED: 'table:session_started',
  TABLE_SESSION_CLOSED: 'table:session_closed',
  TABLE_UPDATED: 'table:updated',

  // System/Notification events
  KITCHEN_ALERT: 'kitchen:alert'
} as const;

export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_CINEMA_TIMEZONE = 'Asia/Kolkata';

export const TENANT_TYPES = ['restaurant', 'cinema'] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

export const CINEMA_ONBOARDING_STAGES = [
  'profile_completed',
  'screens_added',
  'seating_configured',
  'menu_configured',
  'payment_configured',
  'shows_scheduled',
  'qr_generated',
  'ordering_activated'
] as const;

export type CinemaOnboardingStage = (typeof CINEMA_ONBOARDING_STAGES)[number];

export const CINEMA_ONBOARDING_STAGE_INFO: Record<
  CinemaOnboardingStage,
  { step: number; title: string; description: string }
> = {
  profile_completed: {
    step: 1,
    title: 'Complete Theatre Profile',
    description: 'Basic theatre details, city, address & contact information'
  },
  screens_added: {
    step: 2,
    title: 'Add Cinema Screens',
    description: 'Auditorium count, screen names & screen specifications'
  },
  seating_configured: {
    step: 3,
    title: 'Configure Seating Arrangements',
    description: 'Row naming (A..Z) and seat numbering with category tiers'
  },
  menu_configured: {
    step: 4,
    title: 'Add Food Categories & Products',
    description: 'Popcorn, combos, snacks, beverages and concession pricing'
  },
  payment_configured: {
    step: 5,
    title: 'Configure Payment Gateway',
    description: 'Connect theatre-owned Razorpay or Paytm merchant account'
  },
  shows_scheduled: {
    step: 6,
    title: 'Create Movie Show Schedules',
    description: 'Daily showtimes, movie assignment and order cut-off times'
  },
  qr_generated: {
    step: 7,
    title: 'Generate & Download QR Codes',
    description: 'Download printable general theatre and screen-specific QR stands'
  },
  ordering_activated: {
    step: 8,
    title: 'Activate Customer Ordering',
    description: 'Go live for in-auditorium seat food and beverage delivery'
  }
};

export const SCREEN_TYPES = [
  'standard',
  'imax',
  '4dx',
  'dolby_atmos',
  'vip',
  'drive_in'
] as const;

export type ScreenType = (typeof SCREEN_TYPES)[number];

export const SCREEN_STATUSES = ['active', 'inactive', 'archived'] as const;
export type ScreenStatus = (typeof SCREEN_STATUSES)[number];

export const SEAT_CATEGORIES = [
  'regular',
  'premium',
  'recliner',
  'vip'
] as const;

export type SeatCategory = (typeof SEAT_CATEGORIES)[number];

export const SEAT_STATUSES = ['active', 'inactive', 'archived'] as const;
export type SeatStatus = (typeof SEAT_STATUSES)[number];

export const ROW_STATUSES = ['active', 'inactive', 'archived'] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

export const MOVIE_STATUSES = ['active', 'inactive', 'archived'] as const;
export type MovieStatus = (typeof MOVIE_STATUSES)[number];

export const SHOW_STATUSES = ['draft', 'published', 'cancelled', 'completed'] as const;
export type ShowStatus = (typeof SHOW_STATUSES)[number];

export const DEFAULT_TURNAROUND_BUFFER_MINUTES = 15;

export const CINEMA_LANGUAGES = [
  'Hindi',
  'English',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Other'
] as const;

export const CINEMA_FOOD_CATEGORIES = [
  'Popcorn',
  'Beverages',
  'Snacks',
  'Combos',
  'Desserts'
] as const;

export const CINEMA_PAYMENT_PROVIDERS = ['razorpay', 'paytm'] as const;
export type CinemaPaymentProvider = (typeof CINEMA_PAYMENT_PROVIDERS)[number];

export const CINEMA_PAYMENT_ENVIRONMENTS = ['test', 'live'] as const;
export type CinemaPaymentEnvironment = (typeof CINEMA_PAYMENT_ENVIRONMENTS)[number];

export const CINEMA_PAYMENT_ACCOUNT_STATUSES = [
  'connected',
  'disconnected',
  'verification_failed',
  'disabled'
] as const;
export type CinemaPaymentAccountStatus = (typeof CINEMA_PAYMENT_ACCOUNT_STATUSES)[number];

export const CINEMA_PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED'
] as const;
export type CinemaPaymentStatus = (typeof CINEMA_PAYMENT_STATUSES)[number];

export const CINEMA_REFUND_STATUSES = [
  'REFUND_PENDING',
  'REFUND_PROCESSED',
  'REFUND_FAILED'
] as const;
export type CinemaRefundStatus = (typeof CINEMA_REFUND_STATUSES)[number];






