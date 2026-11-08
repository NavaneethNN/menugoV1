import express, { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { db, restaurantMembers, restaurants, user, account } from '@menugo/database';
import { eq, and } from 'drizzle-orm';
import { staffPinLoginSchema } from '@menugo/shared';
import { AppError } from '../middleware/error-handler';
import { auth } from '../lib/auth';
import { hashPassword } from 'better-auth/crypto';

const router = Router();
router.use(express.json());

/**
 * Returns current authenticated user and session information.
 * Guaranteed 401 if not authenticated. Never leaks secrets or passwords.
 */
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userMemberships = await db
      .select({
        membershipId: restaurantMembers.id,
        role: restaurantMembers.role,
        restaurant: {
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          isActive: restaurants.isActive,
          currency: restaurants.currency
        }
      })
      .from(restaurantMembers)
      .innerJoin(restaurants, eq(restaurantMembers.restaurantId, restaurants.id))
      .where(eq(restaurantMembers.userId, req.user!.id));

    res.json({
      user: {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email,
        role: req.user!.role,
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
 * Staff 4-digit PIN + 4-digit Password Direct Login & First-Time Setup.
 */
router.post('/staff-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantSlug, restaurantId, pin, password } = staffPinLoginSchema.parse(req.body);

    // 1. Resolve restaurant
    const [restaurant] = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        isActive: restaurants.isActive
      })
      .from(restaurants)
      .where(restaurantSlug ? eq(restaurants.slug, restaurantSlug) : eq(restaurants.id, restaurantId!))
      .limit(1);

    if (!restaurant || !restaurant.isActive) {
      throw new AppError('Restaurant not found or is currently inactive', 404);
    }

    // 2. Resolve staff member by 4-digit PIN in this restaurant
    const [member] = await db
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
      throw new AppError('Invalid 4-digit PIN for this restaurant', 401);
    }

    // Resolve user account
    const [staffUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email
      })
      .from(user)
      .where(eq(user.id, member.userId))
      .limit(1);

    if (!staffUser) {
      throw new AppError('Staff account error. Please contact the restaurant manager.', 500);
    }

    const displayName = member.staffName || staffUser.name;

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
      await db
        .update(account)
        .set({ password: newHash, updatedAt: new Date() })
        .where(
          and(
            eq(account.userId, member.userId),
            eq(account.providerId, 'credential')
          )
        );

      // Mark password as set on restaurant member record
      await db
        .update(restaurantMembers)
        .set({ isPasswordSet: true, updatedAt: new Date() })
        .where(eq(restaurantMembers.id, member.id));

      // Sign in through Better Auth to generate authoritative session & cookie
      const authResponse = await auth.api.signInEmail({
        body: {
          email: staffUser.email,
          password
        },
        asResponse: true
      });

      // Forward Set-Cookie header to browser
      const setCookies = typeof authResponse.headers.getSetCookie === 'function'
        ? authResponse.headers.getSetCookie()
        : [authResponse.headers.get('set-cookie')].filter(Boolean) as string[];
      if (setCookies && setCookies.length > 0) {
        res.setHeader('Set-Cookie', setCookies);
      }

      const redirectTo =
        member.role === 'kitchen'
          ? '/kitchen'
          : member.role === 'staff'
          ? '/admin/service'
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
    // If no password provided, prompt returning staff to enter their 4-digit password
    if (!password) {
      res.status(200).json({
        firstTimeLogin: false,
        requiresPassword: true,
        staffName: displayName,
        restaurantName: restaurant.name,
        role: member.role,
        message: `Welcome back, ${displayName}! Please enter your 4-digit password.`
      });
      return;
    }

    // Verify 4-digit password using Better Auth signInEmail
    let authResponse: Response | any;
    try {
      authResponse = await auth.api.signInEmail({
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

    // Forward Set-Cookie header to browser
    const setCookies = typeof authResponse.headers.getSetCookie === 'function'
      ? authResponse.headers.getSetCookie()
      : [authResponse.headers.get('set-cookie')].filter(Boolean) as string[];
    if (setCookies && setCookies.length > 0) {
      res.setHeader('Set-Cookie', setCookies);
    }

    const redirectTo =
      member.role === 'kitchen'
        ? '/kitchen'
        : member.role === 'staff'
        ? '/admin/service'
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
