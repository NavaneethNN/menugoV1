import { headers } from 'next/headers';
import { getApiBaseUrl } from './api';

const API_URL = getApiBaseUrl() || 'http://localhost:5001';

export interface ServerSessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
  emailVerified: boolean;
}

export interface ServerSessionData {
  user: ServerSessionUser;
  session: {
    id: string;
    expiresAt: string;
  };
  memberships: Array<{
    membershipId: string;
    role: string;
    restaurant: {
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
      currency: string;
    };
  }>;
}

/**
 * Server-side session verification for Next.js App Router Server Components & Actions.
 * Forwards cookie headers to the Express Better Auth backend.
 */
export async function getServerSession(): Promise<ServerSessionData | null> {
  try {
    const incomingHeaders = headers();
    const cookie = incomingHeaders.get('cookie') || '';

    if (!cookie) {
      return null;
    }

    const res = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        cookie,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data as ServerSessionData;
  } catch (error) {
    console.error('[getServerSession] Failed to retrieve server session:', error);
    return null;
  }
}

