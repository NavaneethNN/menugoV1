import { createAuthClient } from 'better-auth/react';
import { getApiBaseUrl } from './api';

const resolvedBaseUrl =
  getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001');

export const authClient = createAuthClient({
  baseURL: resolvedBaseUrl
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession
} = authClient;
