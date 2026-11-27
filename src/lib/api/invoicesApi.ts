// Invoices API Client for AgencyOS
import { apiClient, ApiResponse } from './apiClient';
import type { PaginatedResponse } from './leadsApi';

export interface CreateInvoicePayload {
  clientId: string;
  projectId?: string;
  issueDate?: string;
  dueDate?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
  discount?: number;
  notes?: string;
  clientState?: string;
}

export const invoicesApi = {
  createInvoice: (data: CreateInvoicePayload): Promise<ApiResponse<any>> =>
    apiClient.post('/invoices', data),

  getInvoices: (cursor?: string, limit = 25): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set('cursor', cursor);
    return apiClient.get<PaginatedResponse<any>>(`/invoices?${q.toString()}`);
  },
};
