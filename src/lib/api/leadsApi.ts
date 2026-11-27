// Leads API Client for AgencyOS
import { apiClient, ApiResponse } from './apiClient';

export interface ConvertLeadOptions {
  clientId?: string;
  clientCode?: string;
  projectId?: string;
  projectCode?: string;
  invoiceId?: string;
  invoiceNumber?: string;
}

export interface ConvertLeadResult {
  ok: boolean;
  client: any;
  project: any;
  invoice?: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export const leadsApi = {
  convertLead: (leadId: string, options?: ConvertLeadOptions): Promise<ApiResponse<ConvertLeadResult>> =>
    apiClient.post<ConvertLeadResult>(`/leads/${leadId}/convert`, options || {}),

  getLeads: (cursor?: string, limit = 25): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set('cursor', cursor);
    return apiClient.get<PaginatedResponse<any>>(`/leads?${q.toString()}`);
  },
};
