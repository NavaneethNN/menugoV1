/**
 * Resolves the authoritative API base URL across browser and SSR execution contexts.
 * - If NEXT_PUBLIC_API_URL is explicitly set (including empty string "" for relative reverse-proxy), it is honored.
 * - In browser execution without explicit variable, uses relative "" (same domain proxy).
 * - In Node/SSR execution without explicit variable, defaults to port 5001.
 */
export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? '' : 'http://localhost:5001';
}

interface RequestOptions extends RequestInit {
  restaurantId?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { restaurantId, params, headers, ...rest } = options;

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

  if (restaurantId) {
    customHeaders['x-restaurant-id'] = restaurantId;
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

