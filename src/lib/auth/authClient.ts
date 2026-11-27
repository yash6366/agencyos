// Centralized Authenticated HTTP Client for AgencyOS
import { getAuthToken, getAuthHeaders, setAuthToken, setAuthSession, clearSession } from './authStorage';
import type { LoginResult, ProfileResponse, SessionRecord } from './authTypes';

const API_BASE = '/api';

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Dispatches an authenticated request to the AgencyOS backend.
 * Automatically injects the Authorization: Bearer <token> header and handles 401 unauthenticated errors.
 */
export async function authFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') || endpoint.startsWith('/api')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = getAuthHeaders((options.headers as Record<string, string>) || {});

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // Non-JSON response (e.g., 204 or HTML status page)
    }

    if (res.status === 401) {
      // Session has expired or is invalid
      clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('paa_session_expired', { detail: { endpoint } }));
      }
      return {
        ok: false,
        status: 401,
        error: json?.error || 'Your session has ended. Please sign in again.',
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error || `Request failed with status ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: json as T,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Network error or server unreachable.',
    };
  }
}

// ----------------------------------------------------
// Core Authentication Operations
// ----------------------------------------------------

export async function loginUser(
  login: string,
  password: string,
  remember = false
): Promise<{ ok: boolean; result?: LoginResult; error?: string }> {
  const res = await authFetch<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: login.trim(), password }),
  });

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error || 'Login failed.' };
  }

  const { token, user, mustChange } = res.data;
  setAuthToken(token, remember);
  setAuthSession(user.id);

  if (mustChange && typeof window !== 'undefined') {
    sessionStorage.setItem('paa_x_must_change', '1');
  }

  return { ok: true, result: res.data };
}

export async function logoutUser(): Promise<void> {
  try {
    await authFetch('/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
  }
}

export async function logoutOtherSessions(): Promise<number> {
  const res = await authFetch<{ ok: boolean; ended: number }>('/auth/logout-others', { method: 'POST' });
  return res.ok && res.data ? res.data.ended : 0;
}

export async function changeUserPassword(current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const res = await authFetch('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ current, next }),
  });
  return { ok: res.ok, error: res.error };
}

export async function fetchUserProfile(): Promise<ProfileResponse | null> {
  const res = await authFetch<ProfileResponse>('/auth/profile');
  return res.ok && res.data ? res.data : null;
}

export async function updateUserProfile(updates: Record<string, any>): Promise<{ ok: boolean; profile?: any; error?: string }> {
  const res = await authFetch<{ ok: boolean; profile: any }>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return { ok: res.ok, profile: res.data?.profile, error: res.error };
}

export async function fetchUserSessions(): Promise<SessionRecord[]> {
  const res = await authFetch<SessionRecord[]>('/auth/sessions');
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

export async function revokeUserSession(sessionId: string): Promise<boolean> {
  const res = await authFetch(`/auth/sessions/${sessionId}/revoke`, { method: 'POST' });
  return res.ok;
}
