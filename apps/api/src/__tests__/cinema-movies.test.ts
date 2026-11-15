import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index';
import { auth } from '../lib/auth';
import {
  db,
  pool,
  user,
  restaurants,
  restaurantMembers,
  cinemaProfiles,
  cinemaMovies,
  orders
} from '@menugo/database';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';

describe('Task 05: Cinema Movie Management', () => {
  let userCinemaAId: string;
  let userCinemaBId: string;
  let userRestaurantOwnerId: string;

  let cookieCinemaA: string;
  let cookieCinemaB: string;
  let cookieRestaurantOwner: string;

  const theatreAId = crypto.randomUUID();
  const theatreBId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();

  let movieAId: string;
  let movieBId: string;
  let movieToDeleteId: string;

  const createdTheatresToClean = [theatreAId, theatreBId, restaurantId];
  const createdUsersToClean: string[] = [];

  before(async () => {
    try {
      const timestamp = Date.now();

      // 1. Cinema Owner A
      const resA = await auth.api.signUpEmail({
        body: {
          name: 'Cinema Owner A',
          email: `movies-a-${timestamp}@test.com`,
          password: 'Password123!'
        },
        asResponse: true
      });
      cookieCinemaA = resA.headers.get('set-cookie')?.split(';')[0] || '';
      const jsonA = await resA.json();
      userCinemaAId = jsonA.user.id;
      createdUsersToClean.push(userCinemaAId);

      // 2. Cinema Owner B (for cross-tenant tests)
      const resB = await auth.api.signUpEmail({
        body: {
          name: 'Cinema Owner B',
          email: `movies-b-${timestamp}@test.com`,
          password: 'Password123!'
        },
        asResponse: true
      });
      cookieCinemaB = resB.headers.get('set-cookie')?.split(';')[0] || '';
      const jsonB = await resB.json();
      userCinemaBId = jsonB.user.id;
      createdUsersToClean.push(userCinemaBId);

      // 3. Restaurant Owner (for cross-module tests)
      const resRest = await auth.api.signUpEmail({
        body: {
          name: 'Restaurant Owner',
          email: `movies-rest-${timestamp}@test.com`,
          password: 'Password123!'
        },
        asResponse: true
      });
      cookieRestaurantOwner = resRest.headers.get('set-cookie')?.split(';')[0] || '';
      const jsonRest = await resRest.json();
      userRestaurantOwnerId = jsonRest.user.id;
      createdUsersToClean.push(userRestaurantOwnerId);

      // Seed Theatre A (cinema)
      await db.insert(restaurants).values({
        id: theatreAId,
        name: 'PVR Inox Movies Test A',
        slug: `pvr-inox-movies-a-${timestamp}`,
        currency: 'INR',
        tenantType: 'cinema',
        isActive: true
      });
      await db.insert(cinemaProfiles).values({
        id: crypto.randomUUID(),
        theatreId: theatreAId,
        theatreName: 'PVR Inox Movies Test A',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        contactNumber: '9876543210',
        contactEmail: 'inox-a@pvrtheatres.com',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        onboardingStagesCompleted: ['profile_completed', 'screens_added', 'seating_configured']
      });
      await db.insert(restaurantMembers).values({
        id: crypto.randomUUID(),
        restaurantId: theatreAId,
        userId: userCinemaAId,
        role: 'owner'
      });

      // Seed Theatre B (cinema)
      await db.insert(restaurants).values({
        id: theatreBId,
        name: 'Cinepolis Movies Test B',
        slug: `cinepolis-movies-b-${timestamp}`,
        currency: 'INR',
        tenantType: 'cinema',
        isActive: true
      });
      await db.insert(cinemaProfiles).values({
        id: crypto.randomUUID(),
        theatreId: theatreBId,
        theatreName: 'Cinepolis Movies Test B',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        contactNumber: '9876543211',
        contactEmail: 'cinepolis-b@theatres.com',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        onboardingStagesCompleted: ['profile_completed']
      });
      await db.insert(restaurantMembers).values({
        id: crypto.randomUUID(),
        restaurantId: theatreBId,
        userId: userCinemaBId,
        role: 'owner'
      });

      // Seed Restaurant (restaurant)
      await db.insert(restaurants).values({
        id: restaurantId,
        name: 'Classic Diner',
        slug: `classic-diner-movies-${timestamp}`,
        currency: 'INR',
        tenantType: 'restaurant',
        isActive: true
      });
      await db.insert(restaurantMembers).values({
        id: crypto.randomUUID(),
        restaurantId: restaurantId,
        userId: userRestaurantOwnerId,
        role: 'owner'
      });
    } catch (err) {
      console.error('=== BEFORE HOOK FAILED ===:', err);
      throw err;
    }
  });

  after(async () => {
    // Cleanup created cinema records
    await db.delete(orders).where(inArray(orders.restaurantId, createdTheatresToClean));
    await db.delete(cinemaMovies).where(inArray(cinemaMovies.theatreId, createdTheatresToClean));
    await db.delete(cinemaProfiles).where(inArray(cinemaProfiles.theatreId, createdTheatresToClean));
    await db.delete(restaurantMembers).where(inArray(restaurantMembers.restaurantId, createdTheatresToClean));
    await db.delete(restaurants).where(inArray(restaurants.id, createdTheatresToClean));
    if (createdUsersToClean.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUsersToClean));
    }
    await pool.end().catch(() => {});
  });

  test('POST /api/cinema/movies - Creates Movie A (Interstellar) in English', async () => {
    const res = await request(app)
      .post('/api/cinema/movies')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        title: 'Interstellar',
        language: 'English',
        durationMinutes: 169,
        posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
        description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
        status: 'active'
      });

    assert.equal(res.status, 201, `Failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.movie);
    assert.equal(res.body.movie.title, 'Interstellar');
    assert.equal(res.body.movie.language, 'English');
    assert.equal(res.body.movie.durationMinutes, 169);
    assert.equal(res.body.movie.status, 'active');
    assert.equal(res.body.movie.theatreId, theatreAId);

    movieAId = res.body.movie.id;
  });

  test('POST /api/cinema/movies - Creates Movie B (Kantara) in Kannada', async () => {
    const res = await request(app)
      .post('/api/cinema/movies')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        title: 'Kantara',
        language: 'Kannada',
        durationMinutes: 148,
        description: 'A human and nature conflict in coastal Karnataka.',
        status: 'active'
      });

    assert.equal(res.status, 201, `Failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.movie);
    assert.equal(res.body.movie.title, 'Kantara');
    assert.equal(res.body.movie.language, 'Kannada');
    assert.equal(res.body.movie.durationMinutes, 148);

    movieBId = res.body.movie.id;
  });

  test('POST /api/cinema/movies - Rejects duplicate movie title & language combination in same theatre', async () => {
    const res = await request(app)
      .post('/api/cinema/movies')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        title: 'Interstellar',
        language: 'English',
        durationMinutes: 170
      });

    assert.equal(res.status, 409, 'Expected 409 Conflict for duplicate movie');
  });

  test('POST /api/cinema/movies - Rejects invalid duration (<= 0 or not an integer)', async () => {
    const res = await request(app)
      .post('/api/cinema/movies')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        title: 'Zero Duration Movie',
        language: 'Hindi',
        durationMinutes: 0
      });

    assert.equal(res.status, 400, 'Expected 400 Bad Request for zero duration');
  });

  test('POST /api/cinema/movies - Rejects missing required title or language', async () => {
    const res = await request(app)
      .post('/api/cinema/movies')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        durationMinutes: 120
      });

    assert.equal(res.status, 400, 'Expected 400 Bad Request for missing fields');
  });

  test('GET /api/cinema/movies - Lists theatre movies with language and status filters', async () => {
    // 1. Fetch all
    const resAll = await request(app)
      .get('/api/cinema/movies')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(resAll.status, 200);
    assert.ok(Array.isArray(resAll.body.movies));
    assert.ok(resAll.body.movies.length >= 2);

    // 2. Filter by language Kannada
    const resKannada = await request(app)
      .get('/api/cinema/movies?language=Kannada')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(resKannada.status, 200);
    assert.equal(resKannada.body.movies.length, 1);
    assert.equal(resKannada.body.movies[0].title, 'Kantara');

    // 3. Search query
    const resSearch = await request(app)
      .get('/api/cinema/movies?search=Inter')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(resSearch.status, 200);
    assert.equal(resSearch.body.movies[0].title, 'Interstellar');
  });

  test('GET /api/cinema/movies/:movieId - Retrieves single movie details', async () => {
    const res = await request(app)
      .get(`/api/cinema/movies/${movieAId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.ok(res.body.movie);
    assert.equal(res.body.movie.id, movieAId);
    assert.equal(res.body.movie.title, 'Interstellar');
  });

  test('PATCH /api/cinema/movies/:movieId - Updates movie information', async () => {
    const res = await request(app)
      .patch(`/api/cinema/movies/${movieBId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        title: 'Kantara: A Legend',
        durationMinutes: 150
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.movie.title, 'Kantara: A Legend');
    assert.equal(res.body.movie.durationMinutes, 150);
  });

  test('PATCH /api/cinema/movies/:movieId/poster - Updates movie poster', async () => {
    const newPoster = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800';
    const res = await request(app)
      .patch(`/api/cinema/movies/${movieAId}/poster`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId)
      .send({
        posterUrl: newPoster
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.movie.posterUrl, newPoster);
  });

  test('DELETE /api/cinema/movies/:movieId - Safely archives movie by default', async () => {
    const res = await request(app)
      .delete(`/api/cinema/movies/${movieBId}`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.movie.status, 'archived');

    // Verify it is excluded from default list
    const resList = await request(app)
      .get('/api/cinema/movies')
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    const titles = resList.body.movies.map((m: any) => m.title);
    assert.ok(!titles.includes('Kantara: A Legend'), 'Archived movie should be hidden by default');
  });

  test('DELETE /api/cinema/movies/:movieId?permanent=true - Blocks hard delete when orders exist', async () => {
    // Insert dummy order for theatre A
    await db.insert(orders).values({
      orderNumber: 'ORD-TEST-CINEMA-001',
      restaurantId: theatreAId,
      status: 'completed',
      totalAmount: 45000
    });

    const res = await request(app)
      .delete(`/api/cinema/movies/${movieAId}?permanent=true`)
      .set('Cookie', cookieCinemaA)
      .set('x-theatre-id', theatreAId);

    assert.equal(res.status, 409, 'Expected 409 Conflict when historical orders exist');
  });

  test('DELETE /api/cinema/movies/:movieId?permanent=true - Allows hard delete when no orders exist', async () => {
    // Create a temporary movie on Theatre B (which has no orders)
    const createRes = await request(app)
      .post('/api/cinema/movies')
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId)
      .send({
        title: 'Temp Movie',
        language: 'Hindi',
        durationMinutes: 100
      });

    movieToDeleteId = createRes.body.movie.id;

    const delRes = await request(app)
      .delete(`/api/cinema/movies/${movieToDeleteId}?permanent=true`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.deletedId, movieToDeleteId);
  });

  test('Security: Cinema Owner B cannot access Cinema Owner A movie (Tenant Isolation)', async () => {
    const res = await request(app)
      .get(`/api/cinema/movies/${movieAId}`)
      .set('Cookie', cookieCinemaB)
      .set('x-theatre-id', theatreBId);

    assert.equal(res.status, 404, 'Expected 404 Not Found for cross-theatre movie access');
  });

  test('Security: Restaurant user cannot access cinema movie endpoints', async () => {
    const res = await request(app)
      .get('/api/cinema/movies')
      .set('Cookie', cookieRestaurantOwner)
      .set('x-restaurant-id', restaurantId);

    assert.equal(res.status, 403, 'Expected 403 Forbidden for restaurant user');
  });
});
