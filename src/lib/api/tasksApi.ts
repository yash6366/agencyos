// Tasks API Client for AgencyOS
import { apiClient, ApiResponse } from './apiClient';
import type { PaginatedResponse } from './leadsApi';

export const tasksApi = {
  getTasks: (cursor?: string, limit = 25): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set('cursor', cursor);
    return apiClient.get<PaginatedResponse<any>>(`/tasks?${q.toString()}`);
  },
};
