import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  assignTenantSubscriptionSchema,
  updateTenantStatusSchema,
  formatPaise
} from '@menugo/shared';

describe('Super Admin & Subscription Domain Logic', () => {
  it('1. Formats monthly and annual subscription plan prices accurately without float drift', () => {
    assert.strictEqual(formatPaise(99900), '₹999');
    assert.strictEqual(formatPaise(249900), '₹2,499');
    assert.strictEqual(formatPaise(699900), '₹6,999');
    assert.strictEqual(formatPaise(1499900), '₹14,999');
  });

  it('2. Validates subscription plan creation with required fields', () => {
    const validPlan = {
      name: 'Restaurant Pro Plus',
      slug: 'restaurant-pro-plus',
      tenantType: 'restaurant' as const,
      priceMonthlyPaise: 299900,
      priceAnnualPaise: 2999000,
      maxTables: 50,
      features: ['Table QR Ordering', 'Multi-KDS Support', 'Audible Pings']
    };

    const result = createSubscriptionPlanSchema.safeParse(validPlan);
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.name, 'Restaurant Pro Plus');
      assert.strictEqual(result.data.slug, 'restaurant-pro-plus');
      assert.strictEqual(result.data.maxTables, 50);
      assert.strictEqual(result.data.features.length, 3);
    }
  });

  it('3. Rejects negative subscription pricing in plan creation', () => {
    const invalidPlan = {
      name: 'Broken Plan',
      slug: 'broken-plan',
      tenantType: 'restaurant' as const,
      priceMonthlyPaise: -500,
      priceAnnualPaise: 100000
    };

    const result = createSubscriptionPlanSchema.safeParse(invalidPlan);
    assert.strictEqual(result.success, false);
  });

  it('4. Validates tenant status update payload (suspension and reactivation)', () => {
    const activatePayload = { isActive: true };
    const suspendPayload = { isActive: false };

    assert.strictEqual(updateTenantStatusSchema.safeParse(activatePayload).success, true);
    assert.strictEqual(updateTenantStatusSchema.safeParse(suspendPayload).success, true);
    assert.strictEqual(updateTenantStatusSchema.safeParse({ isActive: 'invalid' }).success, false);
  });

  it('5. Validates subscription assignment payload', () => {
    const assignPayload = {
      planId: 'plan-12345',
      billingCycle: 'annual' as const,
      status: 'active' as const
    };

    const result = assignTenantSubscriptionSchema.safeParse(assignPayload);
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.planId, 'plan-12345');
      assert.strictEqual(result.data.billingCycle, 'annual');
    }
  });

  it('6. Filters plans according to active tenant type selection', () => {
    const samplePlans = [
      { id: '1', name: 'R1', tenantType: 'restaurant' as const, isActive: true },
      { id: '2', name: 'C1', tenantType: 'cinema' as const, isActive: true },
      { id: '3', name: 'A1', tenantType: 'all' as const, isActive: true },
      { id: '4', name: 'R2_archived', tenantType: 'restaurant' as const, isActive: false }
    ];

    const restaurantFiltered = samplePlans.filter(
      (p) => p.isActive && (p.tenantType === 'restaurant' || p.tenantType === 'all')
    );
    assert.strictEqual(restaurantFiltered.length, 2);
    assert.strictEqual(restaurantFiltered.map((p) => p.id).join(','), '1,3');

    const cinemaFiltered = samplePlans.filter(
      (p) => p.isActive && (p.tenantType === 'cinema' || p.tenantType === 'all')
    );
    assert.strictEqual(cinemaFiltered.length, 2);
    assert.strictEqual(cinemaFiltered.map((p) => p.id).join(','), '2,3');
  });
});
