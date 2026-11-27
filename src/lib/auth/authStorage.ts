// Centralized Auth Storage Manager for AgencyOS
// Authoritatively manages authentication tokens and active session persistence.

export const TOKEN_KEY = 'paa_x_db_token';
export const LEGACY_TOKEN_KEY = 'paa_x_jwt_token';
export const SESSION_KEY = 'paa_x_session';
export const MUST_CHANGE_KEY = 'paa_x_must_change';

/**
 * Retrieves the active JWT authentication token.
 * Checks localStorage and sessionStorage, transparently migrating legacy keys if found.
 */
export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';

  let token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    // Check legacy key for backward compatibility and migrate
    token = localStorage.getItem(LEGACY_TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  }
  return token || '';
}

/**
 * Stores the authentication token in persistent (remember) or session storage.
 */
export function setAuthToken(token: string, remember = false): void {
  if (typeof window === 'undefined') return;
  // Clear any existing tokens first
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);

  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Clears the authentication token from all browser storage.
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * Returns standard Authorization headers with Bearer token.
 */
export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Returns stored session data ({ userId: string }).
 */
export function getAuthSession(): { userId: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Stores active session user ID.
 */
export function setAuthSession(userId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
}

/**
 * Clears all user session and token information.
 */
export function clearSession(): void {
  clearAuthToken();
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(MUST_CHANGE_KEY);
  sessionStorage.removeItem('paa_x_db_autologin');
}
