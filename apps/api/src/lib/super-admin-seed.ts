import { auth } from './auth';
import { restaurantDb, qrosDb, user } from '@menugo/database';
import { eq } from 'drizzle-orm';

/**
 * Ensures the platform super admin account exists in the primary database and QROS master database.
 * If not present, it auto-provisions it using Better Auth with a default or configured password.
 * Also verifies that existing super admin accounts have role = 'super_admin' and tenantType = 'platform'.
 */
export async function ensureSuperAdminExists(): Promise<void> {
  try {
    const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      console.warn('[SUPER ADMIN] SUPER_ADMIN_EMAILS is not configured; skipping auto-provisioning.');
      return;
    }

    const primaryEmail = adminEmails[0];
    if (!primaryEmail) return;
    const initialPassword = process.env.SUPER_ADMIN_PASSWORD;

    const existingUsers = await restaurantDb
      .select({
        id: user.id,
        email: user.email,
        role: user.role
      })
      .from(user)
      .where(eq(user.email, primaryEmail))
      .limit(1);

    if (existingUsers.length === 0) {
      if (!initialPassword) {
        console.warn('[SUPER ADMIN] SUPER_ADMIN_PASSWORD is not configured; skipping auto-provisioning.');
        return;
      }
      console.log(`[SUPER ADMIN] Auto-provisioning initial super admin: ${primaryEmail}`);
      try {
        await auth.api.signUpEmail({
          body: {
            name: 'Platform Super Admin',
            email: primaryEmail,
            password: initialPassword
          }
        });

        await Promise.allSettled([
          restaurantDb
            .update(user)
            .set({
              role: 'super_admin',
              tenantType: 'platform',
              emailVerified: true
            })
            .where(eq(user.email, primaryEmail)),
          qrosDb
            .update(user)
            .set({
              role: 'super_admin',
              tenantType: 'platform',
              emailVerified: true
            })
            .where(eq(user.email, primaryEmail))
        ]);

        console.log(`[SUPER ADMIN] Initial super admin created successfully: ${primaryEmail}`);
      } catch (signupErr: any) {
        if (!signupErr?.message?.includes('already exists')) {
          console.error('[SUPER ADMIN] Error during auto-signup:', signupErr?.message || signupErr);
        }
      }
    } else {
      const existing = existingUsers[0];
      if (existing && existing.role !== 'super_admin') {
        await Promise.allSettled([
          restaurantDb
            .update(user)
            .set({
              role: 'super_admin',
              tenantType: 'platform',
              emailVerified: true
            })
            .where(eq(user.email, primaryEmail)),
          qrosDb
            .update(user)
            .set({
              role: 'super_admin',
              tenantType: 'platform',
              emailVerified: true
            })
            .where(eq(user.email, primaryEmail))
        ]);
        console.log(`[SUPER ADMIN] Upgraded role to super_admin for: ${primaryEmail}`);
      }
    }
  } catch (error: any) {
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
      return; // Handled gracefully if seeded concurrently
    }
    console.error('[SUPER ADMIN] Failed to initialize super admin user:', error?.message || error);
  }
}
