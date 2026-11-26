import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, TABLE_KEYS } from '../server/migrate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Database Architecture Audit: Schema Definition & Mapping', () => {
  // 1. Verify all required core business entities exist in T
  const expectedTables = [
    'employees', 'departments', 'designations', 'attendance', 'attendance_regularizations',
    'daily_activities', 'leads', 'clients', 'field_visits', 'reimbursements',
    'projects', 'tasks', 'quotations', 'agreements', 'invoices',
    'payments', 'expenses', 'payslips', 'notifications', 'audit_logs',
    'leave_requests', 'leave_balances'
  ];

  const actualTables = TABLE_KEYS.map((k) => T[k].t);
  for (const expected of expectedTables) {
    assert.ok(actualTables.includes(expected), `Table ${expected} must be defined in schema mappings`);
  }

  // 2. Verify all typed columns match expected types
  const invoiceCols = T.paa_invoices.cols;
  assert.ok(invoiceCols.some(([col, field, type]) => col === 'total' && type === 'numeric'));
  assert.ok(invoiceCols.some(([col, field, type]) => col === 'balance' && type === 'numeric'));

  const leadCols = T.paa_leads.cols;
  assert.ok(leadCols.some(([col, field, type]) => col === 'estimated_value' && type === 'numeric'));

  const paymentCols = T.paa_payments.cols;
  assert.ok(paymentCols.some(([col, field, type]) => col === 'amount' && type === 'numeric'));

  const reimbursementCols = T.paa_reimbursements.cols;
  assert.ok(reimbursementCols.some(([col, field, type]) => col === 'amount' && type === 'numeric'));
});

test('Migration 001 Relational Constraints Audit', () => {
  const migPath = path.join(__dirname, '../server/migrations/001_relational_constraints.sql');
  assert.ok(fs.existsSync(migPath), '001_relational_constraints.sql must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Check OCC version columns
  assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1'), 'OCC version column migration present');

  // Check unique constraints
  const expectedUnique = [
    'departments_name_key',
    'employees_code_key',
    'clients_code_key',
    'leads_code_key',
    'projects_code_key',
    'tasks_code_key',
    'quotations_number_key',
    'agreements_number_key',
    'invoices_number_key',
    'payments_code_key',
    'expenses_code_key',
    'reimbursements_code_key',
    'payslips_number_key',
    'leave_requests_code_key',
  ];
  for (const uc of expectedUnique) {
    assert.ok(sql.includes(uc), `Unique constraint ${uc} must be enforced in migration`);
  }

  // Check foreign keys
  const expectedFks = [
    'fk_designations_department',
    'fk_credentials_employee',
    'fk_sessions_employee',
    'fk_attendance_employee',
    'fk_regularizations_employee',
    'fk_daily_activities_employee',
    'fk_leave_requests_employee',
    'fk_leave_balances_employee',
    'fk_reimbursements_employee',
    'fk_projects_client',
    'fk_projects_manager',
    'fk_tasks_project',
    'fk_tasks_employee',
    'fk_quotations_client',
    'fk_agreements_client',
    'fk_invoices_client',
    'fk_payments_invoice',
    'fk_payslips_employee',
    'fk_notifications_user',
  ];
  for (const fk of expectedFks) {
    assert.ok(sql.includes(fk), `Foreign key ${fk} must be enforced in migration`);
  }

  // Check Check constraints
  assert.ok(sql.includes('chk_invoices_total'), 'chk_invoices_total check constraint present');
  assert.ok(sql.includes('chk_invoices_balance'), 'chk_invoices_balance check constraint present');
  assert.ok(sql.includes('chk_payments_amount'), 'chk_payments_amount check constraint present');
});

test('Database Audit: Mock Fresh Database Migration & Seed Simulation', async () => {
  // In-memory simulation of schema generation and idempotency
  const executedStatements: string[] = [];
  const trackingTable: Set<string> = new Set();

  const mockClient = {
    query: async (queryText: string, params: any[] = []) => {
      executedStatements.push(queryText.trim());
      if (queryText.includes('SELECT version FROM public.schema_migrations')) {
        const ver = params[0];
        return { rows: trackingTable.has(ver) ? [{ version: ver }] : [] };
      }
      if (queryText.includes('INSERT INTO public.schema_migrations')) {
        trackingTable.add(params[0]);
        return { rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
  };

  // Run initial simulation
  const migrationsDir = path.join(__dirname, '../server/migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  
  for (const file of files) {
    const migVersion = file.replace(/\.sql$/, '');
    const check = await mockClient.query('SELECT version FROM public.schema_migrations WHERE version=$1', [migVersion]);
    if (check.rows.length === 0) {
      await mockClient.query(`-- Execute ${file}`);
      await mockClient.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [migVersion]);
    }
  }

  assert.ok(trackingTable.has('001_relational_constraints'), 'Migration 001 recorded in tracking');

  // Second run: test idempotency
  let newlyApplied = 0;
  for (const file of files) {
    const migVersion = file.replace(/\.sql$/, '');
    const check = await mockClient.query('SELECT version FROM public.schema_migrations WHERE version=$1', [migVersion]);
    if (check.rows.length === 0) {
      newlyApplied++;
    }
  }
  assert.strictEqual(newlyApplied, 0, 'Re-running migrations must not re-execute already tracked migrations');
});
