/**
 * Resolves the authoritative API base URL across browser and SSR execution contexts.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
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
  superAdminKey?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { superAdminKey, params, headers, ...rest } = options;

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

  // Support super admin master key
  if (superAdminKey) {
    customHeaders['x-super-admin-key'] = superAdminKey;
  } else if (typeof window !== 'undefined') {
    try {
      const storedKey = localStorage.getItem('menugo_super_admin_key');
      if (storedKey) {
        customHeaders['x-super-admin-key'] = storedKey;
      }
    } catch {}
  }

  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      headers: customHeaders,
      ...rest
    });
  } catch (netErr: any) {
    if (netErr?.name === 'TypeError' || netErr?.message?.includes('fetch')) {
      throw new Error(
        `Unable to connect to The QROS API at ${baseUrl || 'http://localhost:5001'}. Please verify the backend service is running.`
      );
    }
    throw netErr;
  }

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
