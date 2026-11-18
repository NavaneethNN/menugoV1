import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, isValidSlug, createRestaurantSchema } from '@menugo/shared';

describe('Restaurant Onboarding UI & Form Logic', () => {
  test('Slug generation correctly auto-populates from restaurant name', () => {
    assert.equal(slugify('Royal Biryani House'), 'royal-biryani-house');
    assert.equal(slugify('Café Paris & Bakery!'), 'caf-paris-bakery');
    assert.equal(slugify('  Spicy 99 Tacos  '), 'spicy-99-tacos');
  });

  test('Form validation rejects invalid name inputs', () => {
    // Empty name
    const empty = createRestaurantSchema.safeParse({
      name: '',
      slug: 'valid-slug'
    });
    assert.equal(empty.success, false);

    // 1 char name
    const singleChar = createRestaurantSchema.safeParse({
      name: 'A',
      slug: 'valid-slug'
    });
    assert.equal(singleChar.success, false);

    // Valid name
    const valid = createRestaurantSchema.safeParse({
      name: 'Biryani Palace',
      slug: 'biryani-palace'
    });
    assert.equal(valid.success, true);
  });

  test('Form validation validates customer URL slugs accurately', () => {
    // Valid cases
    assert.equal(isValidSlug('royal-feast'), true);
    assert.equal(isValidSlug('bistro-42'), true);
    assert.equal(isValidSlug('taste-of-india'), true);

    // Invalid cases
    assert.equal(isValidSlug('royal--feast'), false, 'Consecutive hyphens disallowed');
    assert.equal(isValidSlug('-leading'), false, 'Leading hyphen disallowed');
    assert.equal(isValidSlug('trailing-'), false, 'Trailing hyphen disallowed');
    assert.equal(isValidSlug('has spaces'), false, 'Spaces disallowed');
    assert.equal(isValidSlug('Uppercase'), false, 'Uppercase disallowed');
    assert.equal(isValidSlug('x'), false, 'Under minimum length of 2 characters');
  });

  test('Form payload builder normalizes optional empty strings to null or valid fields', () => {
    const rawFormState = {
      name: 'Spice Lounge',
      slug: 'spice-lounge',
      phone: '+91 98765 43210',
      email: '', // empty string from blank input
      address: 'Indiranagar 100ft Rd',
      currency: 'INR',
      logoUrl: '' // empty string from blank input
    };

    const parsed = createRestaurantSchema.parse({
      name: rawFormState.name.trim(),
      slug: rawFormState.slug.trim(),
      phone: rawFormState.phone.trim() || null,
      email: rawFormState.email.trim() || null,
      address: rawFormState.address.trim() || null,
      currency: rawFormState.currency,
      logoUrl: rawFormState.logoUrl.trim() || null
    });

    assert.equal(parsed.name, 'Spice Lounge');
    assert.equal(parsed.slug, 'spice-lounge');
    assert.equal(parsed.currency, 'INR');
    assert.equal(parsed.email, null);
    assert.equal(parsed.logoUrl, null);
  });

  test('Form rejects malformed contact email', () => {
    const invalidEmail = createRestaurantSchema.safeParse({
      name: 'Test Café',
      slug: 'test-cafe',
      email: 'not-an-email'
    });

    assert.equal(invalidEmail.success, false);
    if (!invalidEmail.success) {
      assert.ok(invalidEmail.error.issues.some((i) => i.path.includes('email')));
    }
  });
});

