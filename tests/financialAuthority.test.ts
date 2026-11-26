import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGstTax, calculateInvoiceTotals } from '../server/services/invoiceService.mjs';
import { calculateServerPayslip, DEFAULT_STATUTORY_SETTINGS } from '../server/services/payrollCalculator.mjs';

test('Financial Authority: Intra-state vs Inter-state GST Tax Engine', () => {
  const taxableAmount = 100000;

  // 1. Intra-State (Karnataka to Karnataka: '29' -> '29')
  const intra = calculateGstTax(taxableAmount, 18, '29', '29');
  assert.strictEqual(intra.isInterState, false);
  assert.strictEqual(intra.cgstRate, 9);
  assert.strictEqual(intra.cgstAmount, 9000);
  assert.strictEqual(intra.sgstRate, 9);
  assert.strictEqual(intra.sgstAmount, 9000);
  assert.strictEqual(intra.igstAmount, 0);
  assert.strictEqual(intra.totalTax, 18000);

  // 2. Inter-State (Karnataka to Maharashtra: '29' -> '27')
  const inter = calculateGstTax(taxableAmount, 18, '29', '27');
  assert.strictEqual(inter.isInterState, true);
  assert.strictEqual(inter.cgstAmount, 0);
  assert.strictEqual(inter.sgstAmount, 0);
  assert.strictEqual(inter.igstRate, 18);
  assert.strictEqual(inter.igstAmount, 18000);
  assert.strictEqual(inter.totalTax, 18000);
});

test('Financial Authority: Invoice Line Item Validation & Totals', () => {
  const validItems = [
    { description: 'Enterprise UI/UX Design Retainer', quantity: 1, unitPrice: 50000 },
    { description: 'Dedicated Backend Engineering (Hours)', quantity: 40, unitPrice: 1500 },
  ];

  const calculated = calculateInvoiceTotals(validItems, 5000, '29', '29');
  assert.strictEqual(calculated.subtotal, 110000); // 50,000 + 60,000
  assert.strictEqual(calculated.discount, 5000);
  assert.strictEqual(calculated.taxableSubtotal, 105000); // 110,000 - 5,000
  assert.strictEqual(calculated.tax.totalTax, 18900); // 18% of 105,000
  assert.strictEqual(calculated.total, 123900); // 105,000 + 18,900

  // Validation failures
  assert.throws(() => calculateInvoiceTotals([], 0), /Invoice must have at least one line item/);
  assert.throws(() => calculateInvoiceTotals([{ description: 'Test', quantity: 0, unitPrice: 100 }]), /invalid quantity/);
  assert.throws(() => calculateInvoiceTotals([{ description: 'Test', quantity: 1, unitPrice: -50 }]), /invalid unit price/);
});

test('Financial Authority: Server-Side Statutory Payroll (PF, PT, TDS)', () => {
  const salaryLines = [
    { code: 'BASIC', name: 'Basic Salary', kind: 'earning', value: 30000, prorate: true },
    { code: 'HRA', name: 'House Rent Allowance', kind: 'earning', value: 15000, prorate: true },
    { code: 'SPECIAL', name: 'Special Allowance', kind: 'earning', value: 15000, prorate: true },
  ];

  const fullMonth: any = calculateServerPayslip({
    month: 5,
    lines: salaryLines,
    workingDays: 30,
    payableDays: 30,
    statutory: DEFAULT_STATUTORY_SETTINGS,
    employee: { pfApplicable: true, esiApplicable: false, ptApplicable: true, monthlyTds: 2500, hasBank: true },
    adjustments: [],
  });

  assert.strictEqual(fullMonth.gross, 60000);
  // PF ceiling is 15,000. 12% of 15,000 = 1,800
  assert.strictEqual(fullMonth.lines.find((l: any) => l.code === 'PF')?.amount, 1800);
  // PT slab > 15,000 = 200
  assert.strictEqual(fullMonth.lines.find((l: any) => l.code === 'PT')?.amount, 200);
  // TDS = 2500
  assert.strictEqual(fullMonth.lines.find((l: any) => l.code === 'TDS')?.amount, 2500);

  const totalExpectedDeductions = 1800 + 200 + 2500;
  assert.strictEqual(fullMonth.totalDeductions, totalExpectedDeductions);
  assert.strictEqual(fullMonth.net, 60000 - totalExpectedDeductions);
  assert.strictEqual(fullMonth.exceptions.length, 0);

  // Prorated 15 days out of 30 days
  const halfMonth: any = calculateServerPayslip({
    month: 5,
    lines: salaryLines,
    workingDays: 30,
    payableDays: 15,
    statutory: DEFAULT_STATUTORY_SETTINGS,
    employee: { pfApplicable: true, esiApplicable: false, ptApplicable: true, monthlyTds: 0, hasBank: true },
    adjustments: [],
  });

  assert.strictEqual(halfMonth.gross, 30000); // 60,000 / 2
  // Earned basic = 15,000. 12% of 15,000 = 1,800
  assert.strictEqual(halfMonth.lines.find((l: any) => l.code === 'PF')?.amount, 1800);
});
