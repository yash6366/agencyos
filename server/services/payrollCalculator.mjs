// Server-side Payroll & Statutory Calculation Engine for AgencyOS
// Implements Indian Statutory Compliance (PF, ESI, Professional Tax, TDS)

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export const DEFAULT_STATUTORY_SETTINGS = {
  pfEnabled: true,
  pfRate: 12, // Employee 12%
  pfEmployerRate: 12, // Employer 12% (3.67% PF + 8.33% EPS)
  pfWageCeiling: 15000,
  pfApplyCeiling: true,

  esiEnabled: true,
  esiEmployeeRate: 0.75, // Employee 0.75%
  esiEmployerRate: 3.25, // Employer 3.25%
  esiWageLimit: 21000, // ESI applicability threshold

  ptEnabled: true,
  ptSlabs: [
    { min: 0, max: 15000, amount: 0 },
    { min: 15001, max: null, amount: 200, febAmount: 300 }, // Standard slab
  ],
  tdsEnabled: true,
};

/**
 * Calculates a complete server-authoritative monthly payslip for an employee.
 * @param {object} input
 * @returns {object}
 */
export function calculateServerPayslip(input) {
  const {
    month = new Date().getMonth() + 1,
    lines = [],
    workingDays = 30,
    payableDays = 30,
    statutory = DEFAULT_STATUTORY_SETTINGS,
    employee = { pfApplicable: true, esiApplicable: false, ptApplicable: true, monthlyTds: 0, hasBank: true },
    adjustments = [],
  } = input;

  const exceptions = [];
  const safeWorkingDays = Math.max(0, Number(workingDays) || 0);
  const safePayableDays = Math.max(0, Math.min(safeWorkingDays, Number(payableDays) || 0));
  const ratio = safeWorkingDays > 0 ? safePayableDays / safeWorkingDays : 0;

  const basicLine = lines.find((l) => l.code === 'BASIC');
  if (!basicLine) {
    exceptions.push('Salary structure has no BASIC component');
  }

  const monthlyBasic = Number(basicLine?.value || 0);
  const monthlyOf = (l) => (l.calc === 'percent_of_basic' ? (monthlyBasic * Number(l.value || 0)) / 100 : Number(l.value || 0));

  const outLines = [];
  let fullGross = 0;
  let earnedBasic = 0;

  // Process earnings
  for (const l of lines.filter((x) => x.kind === 'earning')) {
    const monthly = monthlyOf(l);
    fullGross += monthly;
    const amt = round2(l.prorate ? (monthly / (safeWorkingDays || 1)) * safePayableDays : monthly);
    if (l.code === 'BASIC') earnedBasic = amt;
    outLines.push({
      code: l.code,
      name: l.name,
      kind: 'earning',
      amount: safeWorkingDays ? amt : 0,
    });
  }

  // Add custom earning adjustments
  for (const a of adjustments.filter((x) => x.kind === 'earning')) {
    outLines.push({
      code: 'ADJ',
      name: a.name || 'Adjustment',
      kind: 'earning',
      amount: round2(Number(a.amount) || 0),
    });
  }

  const earnedStructure = outLines.reduce((s, l) => s + l.amount, 0);
  const gross = round2(earnedStructure);

  // Statutory Calculations
  let employerPf = 0;
  let employerEsi = 0;

  // 1. Provident Fund (PF)
  if (statutory.pfEnabled && employee.pfApplicable) {
    const pfWage = statutory.pfApplyCeiling ? Math.min(earnedBasic, statutory.pfWageCeiling) : earnedBasic;
    const pf = Math.round((pfWage * (Number(statutory.pfRate) || 12)) / 100);
    employerPf = Math.round((pfWage * (Number(statutory.pfEmployerRate) || 12)) / 100);
    if (pf > 0) {
      outLines.push({ code: 'PF', name: 'Provident Fund (PF)', kind: 'deduction', amount: pf });
    }
  }

  // 2. Employee State Insurance (ESI)
  if (statutory.esiEnabled && employee.esiApplicable && fullGross <= statutory.esiWageLimit) {
    const esi = Math.ceil((gross * (Number(statutory.esiEmployeeRate) || 0.75)) / 100);
    employerEsi = Math.ceil((gross * (Number(statutory.esiEmployerRate) || 3.25)) / 100);
    if (esi > 0) {
      outLines.push({ code: 'ESI', name: 'Employees State Insurance (ESI)', kind: 'deduction', amount: esi });
    }
  }

  // 3. Professional Tax (PT)
  if (statutory.ptEnabled && employee.ptApplicable && Array.isArray(statutory.ptSlabs)) {
    const slab = statutory.ptSlabs.find((p) => gross >= p.min && (p.max === null || gross <= p.max));
    if (slab) {
      const pt = month === 2 && slab.febAmount !== undefined ? slab.febAmount : slab.amount;
      if (pt > 0) {
        outLines.push({ code: 'PT', name: 'Professional Tax (PT)', kind: 'deduction', amount: pt });
      }
    }
  }

  // 4. Income Tax (TDS)
  const tdsAmt = Number(employee.monthlyTds) || 0;
  if (statutory.tdsEnabled && tdsAmt > 0) {
    outLines.push({ code: 'TDS', name: 'Income Tax (TDS)', kind: 'deduction', amount: round2(tdsAmt) });
  }

  // Custom deduction components from salary structure
  for (const l of lines.filter((x) => x.kind === 'deduction')) {
    const amt = round2(l.prorate ? monthlyOf(l) * ratio : monthlyOf(l));
    if (amt > 0) outLines.push({ code: l.code, name: l.name, kind: 'deduction', amount: amt });
  }

  // Custom deduction adjustments
  for (const a of adjustments.filter((x) => x.kind === 'deduction')) {
    outLines.push({
      code: 'ADJ',
      name: a.name || 'Deduction Adjustment',
      kind: 'deduction',
      amount: round2(Number(a.amount) || 0),
    });
  }

  const totalDeductions = round2(
    outLines.filter((l) => l.kind === 'deduction').reduce((t, l) => t + l.amount, 0)
  );
  const net = round2(gross - totalDeductions);

  if (net < 0) exceptions.push('Net pay cannot be negative');
  if (!employee.hasBank) exceptions.push('Bank account details missing');

  return {
    lines: outLines,
    gross,
    totalDeductions,
    net,
    employerPf,
    employerEsi,
    lossOfPay: round2(fullGross - gross),
    exceptions,
  };
}
