import { restaurantInternalRouter } from '../routes/internal/restaurant-internal.routes';
import { cinemaInternalRouter } from '../routes/internal/cinema-internal.routes';
import { qrosInternalRouter } from '../routes/internal/qros-internal.routes';
import type { Router, Request, Response, NextFunction } from 'express';

const SERVICE_KEY =
  process.env.INTERNAL_SERVICE_KEY ||
  process.env.SUPER_ADMIN_KEY ||
  'qros-internal-service-secret-2026';

function getBaseUrl(): string {
  const port = process.env.PORT || '5001';
  return process.env.INTERNAL_API_URL || process.env.API_URL || `http://127.0.0.1:${port}`;
}

/**
 * In-memory dispatcher fallback for running inside test environments
 * where a live TCP port may not be bound.
 */
function dispatchInMemory(router: Router, method: string, subPath: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req: any = {
      method: method.toUpperCase(),
      url: subPath,
      path: subPath,
      headers: {
        'x-internal-service-key': SERVICE_KEY,
        'content-type': 'application/json'
      },
      body: body || {},
      params: {},
      query: {}
    };

    let statusCode = 200;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        if (statusCode >= 400) {
          return reject(new Error(data?.error || data?.message || `Request failed with status ${statusCode}`));
        }
        return resolve(data);
      },
      send(data: any) {
        return resolve(data);
      },
      end() {
        return resolve(null);
      }
    };

    const next: NextFunction = (err?: any) => {
      if (err) return reject(err);
      reject(new Error(`Route not handled: ${method} ${subPath}`));
    };

    router(req as Request, res as Response, next);
  });
}

/**
 * Unified Internal HTTP Client that dispatches via network HTTP with in-memory fallback.
 */
async function callInternalApi(
  targetRouter: Router,
  domainPrefix: 'restaurant' | 'cinema' | 'qros',
  subPath: string,
  options: {
    method?: string;
    body?: any;
  } = {}
): Promise<any> {
  const method = options.method || 'GET';
  const fullEndpoint = `/api/internal/${domainPrefix}${subPath}`;
  const url = `${getBaseUrl()}${fullEndpoint}`;

  // 1. Try real HTTP network call first
  try {
    const fetchResponse = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': SERVICE_KEY
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(4000)
    });

    if (fetchResponse.ok) {
      return await fetchResponse.json();
    }
    
    // If route returns 4xx/5xx from live server, parse and throw
    const errorJson = await fetchResponse.json().catch(() => ({}));
    throw new Error(errorJson?.error || errorJson?.message || `HTTP ${fetchResponse.status}`);
  } catch (networkErr: any) {
    // If network connection failed (e.g. offline unit test), fallback to in-memory router dispatch
    if (
      networkErr?.cause?.code === 'ECONNREFUSED' ||
      networkErr?.name === 'TimeoutError' ||
      networkErr?.message?.includes('fetch failed') ||
      networkErr?.message?.includes('ECONNREFUSED')
    ) {
      return dispatchInMemory(targetRouter, method, subPath, options.body);
    }
    throw networkErr;
  }
}

// ===========================================================================
// RESTAURANT DOMAIN CLIENT (Calls Restaurant Backend APIs)
// ===========================================================================
export const restaurantApiClient = {
  async getMetrics() {
    return callInternalApi(restaurantInternalRouter, 'restaurant', '/metrics', { method: 'GET' });
  },

  async getTenants() {
    return callInternalApi(restaurantInternalRouter, 'restaurant', '/tenants', { method: 'GET' });
  },

  async updateTenantStatus(restaurantId: string, isActive: boolean) {
    return callInternalApi(restaurantInternalRouter, 'restaurant', `/tenants/${restaurantId}/status`, {
      method: 'PATCH',
      body: { isActive }
    });
  },

  async assignTenantPlan(restaurantId: string, planData: { planId: string; billingCycle?: string; status?: string }) {
    return callInternalApi(restaurantInternalRouter, 'restaurant', `/tenants/${restaurantId}/plan`, {
      method: 'POST',
      body: planData
    });
  },

  async syncPlan(planData: any) {
    return callInternalApi(restaurantInternalRouter, 'restaurant', '/plans/sync', {
      method: 'POST',
      body: planData
    });
  },

  async deactivatePlan(planId: string) {
    return callInternalApi(restaurantInternalRouter, 'restaurant', `/plans/${planId}`, {
      method: 'DELETE'
    });
  },

  async getSyncExport() {
    return callInternalApi(restaurantInternalRouter, 'restaurant', '/sync-export', { method: 'GET' });
  }
};

// ===========================================================================
// CINEMA DOMAIN CLIENT (Calls Cinema Backend APIs)
// ===========================================================================
export const cinemaApiClient = {
  async getMetrics() {
    return callInternalApi(cinemaInternalRouter, 'cinema', '/metrics', { method: 'GET' });
  },

  async getTenants() {
    return callInternalApi(cinemaInternalRouter, 'cinema', '/tenants', { method: 'GET' });
  },

  async updateTenantStatus(theatreId: string, isActive: boolean) {
    return callInternalApi(cinemaInternalRouter, 'cinema', `/tenants/${theatreId}/status`, {
      method: 'PATCH',
      body: { isActive }
    });
  },

  async assignTenantPlan(theatreId: string, planData: { planId: string; billingCycle?: string; status?: string }) {
    return callInternalApi(cinemaInternalRouter, 'cinema', `/tenants/${theatreId}/plan`, {
      method: 'POST',
      body: planData
    });
  },

  async syncPlan(planData: any) {
    return callInternalApi(cinemaInternalRouter, 'cinema', '/plans/sync', {
      method: 'POST',
      body: planData
    });
  },

  async deactivatePlan(planId: string) {
    return callInternalApi(cinemaInternalRouter, 'cinema', `/plans/${planId}`, {
      method: 'DELETE'
    });
  },

  async getSyncExport() {
    return callInternalApi(cinemaInternalRouter, 'cinema', '/sync-export', { method: 'GET' });
  },

  async getTheatreBySlug(slug: string) {
    return callInternalApi(cinemaInternalRouter, 'cinema', `/theatres/by-slug/${slug}`, { method: 'GET' });
  },

  async trackOrderByToken(statusToken: string) {
    return callInternalApi(cinemaInternalRouter, 'cinema', `/orders/track/${statusToken}`, { method: 'GET' });
  }
};

// ===========================================================================
// QROS PLATFORM CLIENT (Calls QROS Master DB Backend APIs)
// ===========================================================================
export const qrosApiClient = {
  async registerVenue(venue: any, profile?: any) {
    return callInternalApi(qrosInternalRouter, 'qros', '/venues/register', {
      method: 'POST',
      body: { venue, profile }
    });
  },

  async syncSubscription(subscription: any, payment?: any) {
    return callInternalApi(qrosInternalRouter, 'qros', '/subscriptions/sync', {
      method: 'POST',
      body: { subscription, payment }
    });
  },

  async getPlans() {
    return callInternalApi(qrosInternalRouter, 'qros', '/plans', { method: 'GET' });
  }
};
