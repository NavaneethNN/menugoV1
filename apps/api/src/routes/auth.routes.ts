import express, { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { db, restaurantDb, cinemaDb, restaurantMembers, restaurants, user, account } from '@menugo/database';
import { eq, and, asc, or } from 'drizzle-orm';
import { staffPinLoginSchema, staffPinCheckSchema } from '@menugo/shared';
import { AppError } from '../middleware/error-handler';
import { auth, restaurantAuth, cinemaAuth } from '../lib/auth';
import { hashPassword } from 'better-auth/crypto';
import { staffPinRateLimiter } from '../middleware/rate-limiter';

const router = Router();
router.use(express.json());

/**
 * Returns current authenticated user and session information.
 * Guaranteed 401 if not authenticated. Never leaks secrets or passwords.
 */
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [restaurantMemberships, cinemaMemberships] = await Promise.all([
      restaurantDb
        .select({
          membershipId: restaurantMembers.id,
          role: restaurantMembers.role,
          restaurant: {
            id: restaurants.id,
            name: restaurants.name,
            slug: restaurants.slug,
            isActive: restaurants.isActive,
            currency: restaurants.currency,
            tenantType: restaurants.tenantType
          }
        })
        .from(restaurantMembers)
        .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
        .where(eq(restaurantMembers.userId, req.user!.id))
        .catch(() => []),
      cinemaDb
        .select({
          membershipId: restaurantMembers.id,
          role: restaurantMembers.role,
          restaurant: {
            id: restaurants.id,
            name: restaurants.name,
            slug: restaurants.slug,
            isActive: restaurants.isActive,
            currency: restaurants.currency,
            tenantType: restaurants.tenantType
          }
        })
        .from(restaurantMembers)
        .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
        .where(eq(restaurantMembers.userId, req.user!.id))
        .catch(() => [])
    ]);

    const userMemberships = [...restaurantMemberships, ...cinemaMemberships];

    res.json({
      user: {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email,
        role: req.user!.role,
        tenantType: req.user!.tenantType || 'restaurant',
        image: req.user!.image || null,
        emailVerified: req.user!.emailVerified
      },
      session: {
        id: req.session?.id,
        expiresAt: req.session?.expiresAt
      },
      memberships: userMemberships
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Returns the resolved tenantType ('cinema' | 'restaurant') for the logged in user.
 */
router.get('/account-type', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [dbUser] = await db
      .select({ tenantType: user.tenantType })
      .from(user)
      .where(eq(user.id, req.user!.id))
      .limit(1);

    const tenantType = dbUser?.tenantType || req.user?.tenantType || 'restaurant';

    res.json({
      userId: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      tenantType
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Stamps tenantType ('cinema' | 'restaurant') for a user after OAuth signup.
 * Guarantees that a user cannot switch tenantType once memberships exist.
 */
router.post('/set-oauth-tenant-type', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantType } = req.body;
    if (tenantType !== 'cinema' && tenantType !== 'restaurant') {
      return res.status(400).json({ error: 'Invalid tenant type' });
    }

    const existingMemberships = await db
      .select({ tenantType: restaurants.tenantType })
      .from(restaurantMembers)
      .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
      .where(eq(restaurantMembers.userId, req.user!.id))
      .limit(1);

    const firstMembership = existingMemberships[0];
    if (firstMembership) {
      const existingType = firstMembership.tenantType === 'cinema' ? 'cinema' : 'restaurant';
      if (existingType !== tenantType) {
        return res.status(403).json({
          error: `This account is already registered for ${existingType} and cannot be used for ${tenantType}.`
        });
      }
    }

    await db
      .update(user)
      .set({ tenantType })
      .where(eq(user.id, req.user!.id));

    res.json({ success: true, tenantType });
  } catch (error) {
    next(error);
  }
});

/**
 * Public endpoint to list active restaurants for staff PIN login terminal.
 */
router.get('/staff-restaurants', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const activeRestaurants = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        logoUrl: restaurants.logoUrl
      })
      .from(restaurants)
      .where(eq(restaurants.isActive, true));

    res.json(activeRestaurants);
  } catch (error) {
    next(error);
  }
});

/**
 * Public endpoint to list active cinema theatres for POS & staff login setup.
 */
router.get('/staff-theatres', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const activeTheatres = await cinemaDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        logoUrl: restaurants.logoUrl,
        address: restaurants.address
      })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.isActive, true),
          eq(restaurants.tenantType, 'cinema')
        )
      )
      .orderBy(asc(restaurants.name));

    res.json(activeTheatres);
  } catch (error) {
    next(error);
  }
});

/**
 * Public endpoint to get cinema theatre details by slug or ID for POS terminal binding.
 */
router.get('/theatre-info/:slugOrId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slugOrId = req.params.slugOrId as string;
    if (!slugOrId) {
      return res.status(400).json({ error: 'Theatre identifier is required' });
    }

    const [theatre] = await cinemaDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        logoUrl: restaurants.logoUrl,
        address: restaurants.address,
        isActive: restaurants.isActive,
        tenantType: restaurants.tenantType
      })
      .from(restaurants)
      .where(
        and(
          or(eq(restaurants.slug, slugOrId), eq(restaurants.id, slugOrId)),
          eq(restaurants.tenantType, 'cinema'),
          eq(restaurants.isActive, true)
        )
      )
      .limit(1);

    if (!theatre) {
      return res.status(404).json({ error: 'Cinema theatre not found or inactive' });
    }

    res.json(theatre);
  } catch (error) {
    next(error);
  }
});

/**
 * Helper to safely forward session cookies from Better Auth to Express response.
 * Handles both standard getSetCookie() (multiple cookies) and fallback string.
 */
export function forwardAuthCookies(authResponse: any, res: Response) {
  const getSetCookieFn = authResponse?.headers?.getSetCookie;
  if (typeof getSetCookieFn === 'function') {
    const cookies = getSetCookieFn.call(authResponse.headers);
    if (Array.isArray(cookies) && cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies);
      return;
    }
  }
  const setCookie = authResponse?.headers?.get('set-cookie');
  if (setCookie) {
    res.setHeader('Set-Cookie', setCookie);
  }
}

/**
 * Staff 4-digit PIN verification endpoint.
 * Validates PIN and informs frontend whether staff needs first-time password setup.
 */
router.post('/staff-pin-check', staffPinRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantSlug, restaurantId, pin } = staffPinCheckSchema.parse(req.body);

    // 1. Resolve restaurant/theatre across restaurantDb and cinemaDb
    let targetDb = restaurantDb;
    let [restaurant] = await targetDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        isActive: restaurants.isActive,
        tenantType: restaurants.tenantType
      })
      .from(restaurants)
      .where(restaurantSlug ? eq(restaurants.slug, restaurantSlug) : eq(restaurants.id, restaurantId!))
      .limit(1);

    if (!restaurant) {
      targetDb = cinemaDb;
      [restaurant] = await targetDb
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          isActive: restaurants.isActive,
          tenantType: restaurants.tenantType
        })
        .from(restaurants)
        .where(restaurantSlug ? eq(restaurants.slug, restaurantSlug) : eq(restaurants.id, restaurantId!))
        .limit(1);
    }

    if (!restaurant || !restaurant.isActive) {
      throw new AppError('Restaurant or cinema theatre not found or is currently inactive', 404);
    }

    // 2. Resolve staff member by 4-digit PIN in this restaurant/theatre
    const [member] = await targetDb
      .select({
        id: restaurantMembers.id,
        role: restaurantMembers.role,
        staffName: restaurantMembers.staffName,
        pin: restaurantMembers.pin,
        isPasswordSet: restaurantMembers.isPasswordSet,
        canCashier: restaurantMembers.canCashier,
        userId: restaurantMembers.userId
      })
      .from(restaurantMembers)
      .where(
        and(
          eq(restaurantMembers.restaurantId, restaurant.id),
          eq(restaurantMembers.pin, pin)
        )
      )
      .limit(1);

    if (!member) {
      throw new AppError('Invalid 4-digit PIN for this venue', 401);
    }

    // Resolve user account
    const [staffUser] = await targetDb
      .select({
        id: user.id,
        name: user.name,
        email: user.email
      })
      .from(user)
      .where(eq(user.id, member.userId))
      .limit(1);

    if (!staffUser) {
      throw new AppError('Staff account error. Please contact your manager.', 500);
    }

    const displayName = member.staffName || staffUser.name;

    res.status(200).json({
      valid: true,
      firstTimeLogin: !member.isPasswordSet,
      staffName: displayName,
      restaurantName: restaurant.name,
      role: member.role
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Staff 4-digit PIN + 4-digit Password Direct Login & First-Time Setup.
 */
router.post('/staff-login', staffPinRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantSlug, restaurantId, pin, password, checkOnly } = staffPinLoginSchema.parse(req.body);

    // 1. Resolve venue across restaurantDb and cinemaDb
    let targetDb = restaurantDb;
    let [restaurant] = await targetDb
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        isActive: restaurants.isActive,
        tenantType: restaurants.tenantType
      })
      .from(restaurants)
      .where(restaurantSlug ? eq(restaurants.slug, restaurantSlug) : eq(restaurants.id, restaurantId!))
      .limit(1);

    if (!restaurant) {
      targetDb = cinemaDb;
      [restaurant] = await targetDb
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          isActive: restaurants.isActive,
          tenantType: restaurants.tenantType
        })
        .from(restaurants)
        .where(restaurantSlug ? eq(restaurants.slug, restaurantSlug) : eq(restaurants.id, restaurantId!))
        .limit(1);
    }

    if (!restaurant || !restaurant.isActive) {
      throw new AppError('Restaurant or cinema theatre not found or is currently inactive', 404);
    }

    // 2. Resolve staff member by 4-digit PIN in this venue
    const [member] = await targetDb
      .select({
        id: restaurantMembers.id,
        role: restaurantMembers.role,
        staffName: restaurantMembers.staffName,
        pin: restaurantMembers.pin,
        isPasswordSet: restaurantMembers.isPasswordSet,
        canCashier: restaurantMembers.canCashier,
        userId: restaurantMembers.userId
      })
      .from(restaurantMembers)
      .where(
        and(
          eq(restaurantMembers.restaurantId, restaurant.id),
          eq(restaurantMembers.pin, pin)
        )
      )
      .limit(1);

    if (!member) {
      throw new AppError('Invalid 4-digit PIN for this venue', 401);
    }

    // Resolve user account
    const [staffUser] = await targetDb
      .select({
        id: user.id,
        name: user.name,
        email: user.email
      })
      .from(user)
      .where(eq(user.id, member.userId))
      .limit(1);

    if (!staffUser) {
      throw new AppError('Staff account error. Please contact your manager.', 500);
    }

    const displayName = member.staffName || staffUser.name;

    // Fast-path: Explicit probe / checkOnly mode
    if (checkOnly) {
      res.status(200).json({
        valid: true,
        firstTimeLogin: !member.isPasswordSet,
        staffName: displayName,
        restaurantName: restaurant.name,
        role: member.role
      });
      return;
    }

    const targetAuth = restaurant.tenantType === 'cinema' ? cinemaAuth : restaurantAuth;

    // 3. Case A: First-time login (Password NOT set yet)
    if (!member.isPasswordSet) {
      // If no password provided, prompt staff to create their 4-digit password
      if (!password) {
        res.status(200).json({
          firstTimeLogin: true,
          staffName: displayName,
          restaurantName: restaurant.name,
          role: member.role,
          message: `Welcome, ${displayName}! Please set your 4-digit password to complete your account setup.`
        });
        return;
      }

      // If password provided on first login, save it and log them in immediately
      const newHash = await hashPassword(password);

      // Update credential account password in database
      await targetDb
        .update(account)
        .set({ password: newHash, updatedAt: new Date() })
        .where(
          and(
            eq(account.userId, member.userId),
            eq(account.providerId, 'credential')
          )
        );

      // Mark password as set on restaurant member record
      await targetDb
        .update(restaurantMembers)
        .set({ isPasswordSet: true, updatedAt: new Date() })
        .where(eq(restaurantMembers.id, member.id));

      // Sign in through target Better Auth to generate authoritative session & cookie
      const authResponse = await targetAuth.api.signInEmail({
        body: {
          email: staffUser.email,
          password
        },
        asResponse: true
      });

      // Forward Set-Cookie headers safely to browser
      forwardAuthCookies(authResponse, res);

      const redirectTo =
        member.role === 'kitchen'
          ? '/kitchen'
          : member.role === 'staff'
          ? (restaurant.tenantType === 'cinema' ? '/admin/orders' : '/admin/service')
          : '/admin/dashboard';

      res.status(200).json({
        success: true,
        firstTimeLogin: false,
        message: 'Password set successfully. Welcome to MenuGo!',
        user: {
          id: staffUser.id,
          name: displayName,
          email: staffUser.email,
          role: member.role,
          canCashier: member.canCashier
        },
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug
        },
        redirectTo
      });
      return;
    }

    // 4. Case B: Returning staff login (Password already set)
    if (!password) {
      throw new AppError('Please enter your 4-digit password', 400);
    }

    // Verify 4-digit password using target Better Auth signInEmail
    let authResponse: Response | any;
    try {
      authResponse = await targetAuth.api.signInEmail({
        body: {
          email: staffUser.email,
          password
        },
        asResponse: true
      });
    } catch {
      throw new AppError('Invalid 4-digit password', 401);
    }

    if (authResponse.status !== 200) {
      throw new AppError('Invalid 4-digit password', 401);
    }

    // Forward Set-Cookie headers safely to browser
    forwardAuthCookies(authResponse, res);

    const redirectTo =
      member.role === 'kitchen'
        ? '/kitchen'
        : member.role === 'staff'
        ? (restaurant.tenantType === 'cinema' ? '/admin/orders' : '/admin/service')
        : '/admin/dashboard';

    res.status(200).json({
      success: true,
      user: {
        id: staffUser.id,
        name: displayName,
        email: staffUser.email,
        role: member.role,
        canCashier: member.canCashier
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug
      },
      redirectTo
    });
  } catch (error) {
    next(error);
  }
});

export default router;
