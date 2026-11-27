// Centralized API Client wrapping authFetch
import { authFetch, ApiResponse } from '../auth/authClient';

export const apiClient = {
  get: <T = any>(endpoint: string, headers?: Record<string, string>) =>
    authFetch<T>(endpoint, { method: 'GET', headers }),

  post: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    authFetch<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    }),

  put: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    authFetch<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    }),

  delete: <T = any>(endpoint: string, headers?: Record<string, string>) =>
    authFetch<T>(endpoint, { method: 'DELETE', headers }),
};

export type { ApiResponse };
