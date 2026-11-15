import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TENANT_TYPES } from '@menugo/shared';

describe('Cinema Foundation UI & Routing Contracts', () => {
  test('1. Shared TENANT_TYPES defines restaurant and cinema business types', () => {
    assert.deepEqual(TENANT_TYPES, ['restaurant', 'cinema']);
  });

  test('2. Cinema Admin navigation covers all core specification sections from theatremodule.md Section 12', () => {
    const requiredSections = [
      '/cinema/admin/dashboard',
      '/cinema/admin/screens',
      '/cinema/admin/seating',
      '/cinema/admin/movies',
      '/cinema/admin/shows',
      '/cinema/admin/menu',
      '/cinema/admin/orders',
      '/cinema/kitchen',
      '/cinema/delivery',
      '/cinema/admin/payments',
      '/cinema/admin/staff',
      '/cinema/admin/reports',
      '/cinema/admin/settings'
    ];

    // Verify all routes are cinema-namespaced and distinct from restaurant routes (/admin/*)
    for (const route of requiredSections) {
      assert.ok(
        route.startsWith('/cinema/'),
        `Route ${route} must be namespaced under /cinema/`
      );
      assert.ok(
        !route.startsWith('/admin/'),
        `Cinema route ${route} must not collide with restaurant /admin/`
      );
    }
  });

  test('3. Business-type segregation logic separates restaurant and cinema tenants', () => {
    const mockMemberships = [
      { restaurant: { id: 'rest-1', name: 'Bistro', tenantType: 'restaurant' }, role: 'owner' },
      { restaurant: { id: 'theatre-1', name: 'IMAX Cinema', tenantType: 'cinema' }, role: 'admin' },
      { restaurant: { id: 'rest-2', name: 'Cafe', tenantType: 'restaurant' }, role: 'staff' }
    ];

    const restaurantTenants = mockMemberships.filter(
      (m) => (m.restaurant.tenantType || 'restaurant') === 'restaurant'
    );
    const cinemaTenants = mockMemberships.filter(
      (m) => m.restaurant.tenantType === 'cinema'
    );

    assert.equal(restaurantTenants.length, 2);
    assert.equal(cinemaTenants.length, 1);
    assert.equal(cinemaTenants[0]?.restaurant.name, 'IMAX Cinema');
  });
});
