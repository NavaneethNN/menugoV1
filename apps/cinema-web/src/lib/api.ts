/**
 * Resolves the authoritative API base URL across browser and SSR execution contexts.
 * - If NEXT_PUBLIC_API_URL is explicitly set (including empty string "" for relative reverse-proxy), it is honored.
 * - In browser execution without explicit variable, uses relative "" (same domain proxy).
 * - In Node/SSR execution without explicit variable, defaults to port 5001.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // In browser execution:
    // If NEXT_PUBLIC_API_URL is explicitly set to an external domain, honor it.
    // If it points to localhost/127.0.0.1 but the browser is on an external device (e.g. phone scanning QR on Wi-Fi),
    // use relative path "" so Next.js rewrites proxy the request to the local backend.
    if (process.env.NEXT_PUBLIC_API_URL) {
      const configured = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
      const isConfiguredLocal = configured.includes('localhost') || configured.includes('127.0.0.1');
      const isClientLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isConfiguredLocal && !isClientLocal) {
        return '';
      }
      return configured;
    }
    return '';
  }
  return process.env.INTERNAL_API_URL || process.env.API_URL || 'http://localhost:5001';
}

interface RequestOptions extends RequestInit {
  restaurantId?: string;
  theatreId?: string;
  tenantId?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { restaurantId, theatreId, tenantId, params, headers, ...rest } = options;

  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>)
  };

  let resolvedTenantId = theatreId || tenantId || restaurantId;
  const isCinemaContext = Boolean(theatreId || path.includes('/cinema/'));

  if (!resolvedTenantId && typeof window !== 'undefined') {
    try {
      if (isCinemaContext) {
        resolvedTenantId = localStorage.getItem('active_theatre_id') || undefined;
      }
      if (!resolvedTenantId) {
        resolvedTenantId =
          localStorage.getItem('active_theatre_id') ||
          localStorage.getItem('active_restaurant_id') ||
          undefined;
      }
    } catch {
      // Ignore localStorage read errors in private browsing
    }
  }

  if (resolvedTenantId) {
    customHeaders['x-restaurant-id'] = resolvedTenantId;
    customHeaders['x-theatre-id'] = resolvedTenantId;
    customHeaders['x-tenant-id'] = resolvedTenantId;
  }

  const res = await fetch(url, {
    credentials: 'include',
    headers: customHeaders,
    ...rest
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.message ||
      data.error ||
      (Array.isArray(data.details) ? data.details.map((d: any) => d.message).join(', ') : null) ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

