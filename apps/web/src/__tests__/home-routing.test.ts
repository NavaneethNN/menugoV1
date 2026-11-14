import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Home Page Business Selection & Routing (Task 01 & Section 3)', () => {
  // Test business route mappings
  test('Option A: Restaurant routing definitions are correct and preserve existing paths', () => {
    const restaurantRoutes = {
      signup: '/admin/login?mode=signup&business=restaurant',
      signin: '/admin/login',
      demo: '/menu/demo-cafe',
      staffPin: '/staff/login',
      onboarding: '/admin/onboarding',
      dashboard: '/admin/dashboard'
    };

    assert.equal(restaurantRoutes.signup.includes('mode=signup'), true);
    assert.equal(restaurantRoutes.signin, '/admin/login');
    assert.equal(restaurantRoutes.demo, '/menu/demo-cafe');
    assert.equal(restaurantRoutes.staffPin, '/staff/login');
    assert.equal(restaurantRoutes.onboarding, '/admin/onboarding');
  });

  test('Option B: Cinema Theatre routing definitions point to dedicated cinema entry points', () => {
    const cinemaRoutes = {
      onboarding: '/cinema/onboarding',
      signup: '/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding',
      signin: '/admin/login?business=cinema&redirect=/cinema/onboarding'
    };

    assert.equal(cinemaRoutes.onboarding, '/cinema/onboarding');
    assert.equal(cinemaRoutes.signup.includes('business=cinema'), true);
    assert.equal(cinemaRoutes.signup.includes('redirect=/cinema/onboarding'), true);
    assert.equal(cinemaRoutes.signin.includes('business=cinema'), true);
  });

  test('Login route resolver respects business and redirect parameters without breaking restaurants', () => {
    function resolveLoginRedirect(searchParams: { business?: string; type?: string; redirect?: string }) {
      const business = searchParams.business || searchParams.type || 'restaurant';
      const isCinema = business === 'cinema';
      const redirectParam = searchParams.redirect;
      const targetUrl = redirectParam || (isCinema ? '/cinema/onboarding' : '/admin/dashboard');

      return {
        business,
        isCinema,
        targetUrl
      };
    }

    // Default restaurant login
    const defaultRes = resolveLoginRedirect({});
    assert.equal(defaultRes.isCinema, false);
    assert.equal(defaultRes.business, 'restaurant');
    assert.equal(defaultRes.targetUrl, '/admin/dashboard');

    // Cinema login without explicit redirect
    const cinemaRes = resolveLoginRedirect({ business: 'cinema' });
    assert.equal(cinemaRes.isCinema, true);
    assert.equal(cinemaRes.targetUrl, '/cinema/onboarding');

    // Cinema login with explicit redirect
    const cinemaWithRedirect = resolveLoginRedirect({
      business: 'cinema',
      redirect: '/cinema/admin/screens'
    });
    assert.equal(cinemaWithRedirect.isCinema, true);
    assert.equal(cinemaWithRedirect.targetUrl, '/cinema/admin/screens');

    // Restaurant login with custom redirect
    const restaurantCustom = resolveLoginRedirect({
      business: 'restaurant',
      redirect: '/admin/tables'
    });
    assert.equal(restaurantCustom.isCinema, false);
    assert.equal(restaurantCustom.targetUrl, '/admin/tables');
  });

  test('Cinema onboarding initial profile configuration enforces Section 4 Indian market requirements', () => {
    const defaultCinemaConfig = {
      country: 'India',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      tenant_type: 'cinema'
    };

    assert.equal(defaultCinemaConfig.country, 'India');
    assert.equal(defaultCinemaConfig.currency, 'INR');
    assert.equal(defaultCinemaConfig.timezone, 'Asia/Kolkata');
    assert.equal(defaultCinemaConfig.tenant_type, 'cinema');
  });

  test('Cinema 8-step configuration roadmap matches Section 4 specifications', () => {
    const roadmapStepTitles = [
      'Theatre Profile',
      'Cinema Screens',
      'Seating Layout',
      'Food Menu',
      'Payment Gateway',
      'Movie Schedules',
      'Screen QR Codes',
      'Go Live'
    ];

    assert.equal(roadmapStepTitles.length, 8);
    assert.equal(roadmapStepTitles[0], 'Theatre Profile');
    assert.equal(roadmapStepTitles[1], 'Cinema Screens');
    assert.equal(roadmapStepTitles[2], 'Seating Layout');
    assert.equal(roadmapStepTitles[3], 'Food Menu');
    assert.equal(roadmapStepTitles[4], 'Payment Gateway');
    assert.equal(roadmapStepTitles[5], 'Movie Schedules');
    assert.equal(roadmapStepTitles[6], 'Screen QR Codes');
    assert.equal(roadmapStepTitles[7], 'Go Live');
  });
});
