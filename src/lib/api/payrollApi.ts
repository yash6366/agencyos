// Payroll API Client for AgencyOS
import { apiClient, ApiResponse } from './apiClient';

export interface PayrollCalculationInput {
  month?: number;
  lines: Array<{
    code: string;
    name: string;
    kind: 'earning' | 'deduction';
    value: number;
    calc?: 'fixed' | 'percent_of_basic';
    prorate?: boolean;
  }>;
  workingDays?: number;
  payableDays?: number;
  statutory?: Record<string, any>;
  employee?: {
    pfApplicable?: boolean;
    esiApplicable?: boolean;
    ptApplicable?: boolean;
    monthlyTds?: number;
    hasBank?: boolean;
  };
  adjustments?: Array<{
    kind: 'earning' | 'deduction';
    name?: string;
    amount: number;
  }>;
}

export const payrollApi = {
  calculate: (input: PayrollCalculationInput): Promise<ApiResponse<any>> =>
    apiClient.post('/payroll/calculate', input),
};
