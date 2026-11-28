// server/migrate.mjs
// Standalone migration runner for AgencyOS
// Ensures idempotent schema creation, migration tracking via schema_migrations, and execution of versioned migrations.

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { pool } from './db.mjs';
export { pool };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const D = require('./defaults.json');
const M = D.M;
const E = process.env;

export const T = {
  paa_employees: { t: 'employees', cols: [['employee_code', 'employeeId'], ['name', 'name'], ['email', 'email'], ['phone', 'phone'], ['role', 'role'], ['status', 'status']], mod: M.HR, alt: M.PAY },
  paa_departments: { t: 'departments', cols: [['name', 'name']], mod: M.HR },
  paa_designations: { t: 'designations', cols: [['title', 'title'], ['department_id', 'departmentId']], mod: M.HR },
  paa_attendance: { t: 'attendance', cols: [['employee_id', 'employeeId'], ['date', 'date'], ['status', 'status']], own: 'employeeId', team: true },
  paa_regularizations: { t: 'attendance_regularizations', cols: [['employee_id', 'employeeId'], ['date', 'date'], ['status', 'status']], own: 'employeeId', team: true },
  paa_daily_activities: { t: 'daily_activities', cols: [['employee_id', 'employeeId'], ['date', 'date']], own: 'employeeId', team: true },
  paa_leads: { t: 'leads', cols: [['lead_code', 'leadCode'], ['company', 'company'], ['phone', 'phone'], ['email', 'email'], ['source', 'source'], ['status', 'status'], ['assigned_employee_id', 'assignedEmployeeId'], ['estimated_value', 'estimatedValue', 'numeric']], own: 'assignedEmployeeId', mod: M.CRM },
  paa_clients: { t: 'clients', cols: [['client_code', 'clientCode'], ['company_name', 'companyName'], ['phone', 'phone'], ['email', 'email'], ['status', 'status']], mod: M.CLI },
  paa_field_visits: { t: 'field_visits', cols: [['employee_id', 'employeeId'], ['client_id', 'clientId'], ['status', 'status']], own: 'employeeId', mod: M.TSK },
  paa_reimbursements: { t: 'reimbursements', cols: [['code', 'reimbursementCode'], ['employee_id', 'employeeId'], ['date', 'date'], ['amount', 'amount', 'numeric'], ['status', 'status']], own: 'employeeId', team: true },
  paa_projects: { t: 'projects', cols: [['project_code', 'projectCode'], ['name', 'name'], ['client_id', 'clientId'], ['status', 'status'], ['project_manager_id', 'projectManagerId']], mod: M.PRJ },
  paa_tasks: { t: 'tasks', cols: [['task_code', 'taskCode'], ['title', 'title'], ['project_id', 'projectId'], ['assigned_employee_id', 'assignedEmployeeId'], ['status', 'status'], ['due_date', 'dueDate']], own: 'assignedEmployeeId', mod: M.TSK },
  paa_quotations: { t: 'quotations', cols: [['number', 'quotationNumber'], ['client_id', 'clientId'], ['total', 'total', 'numeric'], ['discount', 'discount', 'numeric'], ['status', 'status']], mod: M.CRM },
  paa_agreements: { t: 'agreements', cols: [['number', 'agreementNumber'], ['client_id', 'clientId'], ['status', 'status'], ['end_date', 'endDate']], mod: M.CLI },
  paa_invoices: { t: 'invoices', cols: [['number', 'invoiceNumber'], ['client_id', 'clientId'], ['issue_date', 'issueDate'], ['due_date', 'dueDate'], ['total', 'totalAmount', 'numeric'], ['balance', 'balanceAmount', 'numeric'], ['status', 'status']], mod: M.FIN },
  paa_payments: { t: 'payments', cols: [['code', 'paymentCode'], ['invoice_id', 'invoiceId'], ['date', 'date'], ['amount', 'amount', 'numeric']], mod: M.FIN },
  paa_expenses: { t: 'expenses', cols: [['code', 'expenseCode'], ['date', 'date'], ['category', 'category'], ['amount', 'amount', 'numeric'], ['employee_id', 'employeeId']], mod: M.FIN },
  paa_payslips: { t: 'payslips', cols: [['number', 'payslipNumber'], ['employee_id', 'employeeId'], ['pay_period', 'payPeriod']], own: 'employeeId', mod: M.PAY, ownRead: true },
  paa_notifications: { t: 'notifications', cols: [['user_id', 'userId'], ['title', 'title'], ['read', 'read']], open: true },
  paa_audit_logs: { t: 'audit_logs', cols: [['user_id', 'userId'], ['user_name', 'userName'], ['action', 'action'], ['related_record', 'relatedRecord'], ['date', 'date'], ['time', 'time']], appendOnly: true },
  paa_leave_requests: { t: 'leave_requests', cols: [['code', 'leaveCode'], ['employee_id', 'employeeId'], ['leave_type', 'leaveType'], ['start_date', 'startDate'], ['status', 'status']], own: 'employeeId', team: true },
  paa_leave_balances: { t: 'leave_balances', cols: [['employee_id', 'employeeId']], own: 'employeeId', team: true },
};

export const TABLE_KEYS = Object.keys(T);

/**
 * Runs the complete database schema initialization and all pending migration files.
 * Tracks migrations in public.schema_migrations table.
 * @param {pg.Pool} targetPool
 */
export async function runMigrations(targetPool = pool) {
  const client = await targetPool.connect();
  try {
    console.log('[AgencyOS Migration] Starting database schema verification...');

    // 1. Ensure migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        description text
      );
    `);

    // 2. Base relational tables
    for (const k of TABLE_KEYS) {
      const d = T[k];
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.${d.t} (
          id text PRIMARY KEY,
          version integer NOT NULL DEFAULT 1,
          ${d.cols.map(([c, , ty]) => `${c} ${ty || 'text'}`).join(', ')},
          data jsonb NOT NULL,
          pos double precision NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          updated_by text
        );
      `);
      await client.query(`ALTER TABLE public.${d.t} ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;`);
      for (const [c] of d.cols.filter(([c]) => /_id$|status|date|email|code|number/.test(c))) {
        await client.query(`CREATE INDEX IF NOT EXISTS ${d.t}_${c}_idx ON public.${d.t} (${c});`);
      }
    }

    // 3. Support & metadata tables
    await client.query(`CREATE TABLE IF NOT EXISTS public.app_records (store text NOT NULL, id text NOT NULL, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1, pos double precision NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text, PRIMARY KEY (store, id));`);
    await client.query(`ALTER TABLE public.app_records ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;`);
    await client.query(`CREATE TABLE IF NOT EXISTS public.app_settings (key text PRIMARY KEY, value jsonb, version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text);`);
    await client.query(`ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;`);
    await client.query(`CREATE TABLE IF NOT EXISTS public.user_credentials (employee_id text PRIMARY KEY, password_hash text NOT NULL, must_change boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text);`);
    await client.query(`CREATE TABLE IF NOT EXISTS public.sessions (id text PRIMARY KEY, employee_id text NOT NULL, ip text, user_agent text, created_at timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz);`);
    await client.query(`CREATE TABLE IF NOT EXISTS public.login_events (id bigserial PRIMARY KEY, employee_id text, login text, ok boolean NOT NULL, reason text, ip text, user_agent text, at timestamptz NOT NULL DEFAULT now());`);
    await client.query(`CREATE TABLE IF NOT EXISTS public.password_reset_tokens (id bigserial PRIMARY KEY, employee_id text NOT NULL, token_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, used_at timestamptz, created_by_ip text, user_agent text);`);
    await client.query(`CREATE INDEX IF NOT EXISTS password_reset_tokens_employee_id_idx ON public.password_reset_tokens (employee_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON public.password_reset_tokens (token_hash);`);
    await client.query(`CREATE TABLE IF NOT EXISTS public.sync_events (id bigserial PRIMARY KEY, store text NOT NULL, by_employee text, at timestamptz NOT NULL DEFAULT now());`);
    await client.query(`CREATE TABLE IF NOT EXISTS public.deleted_records (id bigserial PRIMARY KEY, store text NOT NULL, record_id text NOT NULL, data jsonb, deleted_by text, deleted_at timestamptz NOT NULL DEFAULT now());`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.rate_limit_events (
        id bigserial PRIMARY KEY,
        key text NOT NULL,
        at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS rate_limit_events_key_at_idx ON public.rate_limit_events (key, at);
    `);

    // 4. Audit immutability trigger & function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.audit_no_change() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`DROP TRIGGER IF EXISTS audit_logs_lock ON public.audit_logs;`);
    await client.query(`CREATE TRIGGER audit_logs_lock BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_no_change();`);

    // 5. Version-controlled migration scripts execution
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const migVersion = file.replace(/\.sql$/, '');
        const check = await client.query('SELECT version FROM public.schema_migrations WHERE version=$1', [migVersion]);
        if (check.rows.length === 0) {
          console.log(`[AgencyOS Migration] Applying migration: ${file}...`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query('INSERT INTO public.schema_migrations (version, description) VALUES ($1, $2)', [migVersion, `Applied file ${file}`]);
            await client.query('COMMIT');
            console.log(`[AgencyOS Migration] Applied migration: ${file} successfully.`);
          } catch (migErr) {
            await client.query('ROLLBACK');
            throw new Error(`Failed to apply migration ${file}: ${migErr.message}`);
          }
        } else {
          console.log(`[AgencyOS Migration] Migration already applied: ${file} (Skipping)`);
        }
      }
    }

    console.log('[AgencyOS Migration] Schema migration completed successfully.');
    return true;
  } finally {
    client.release();
  }
}

// Allow CLI execution: node server/migrate.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runMigrations()
    .then(() => {
      console.log('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
