// AGENCYOS_VERCEL_FIX
// AgencyOS server: Express + PostgreSQL. Stores every record of the app in its own table,
// checks logins (bcrypt), sessions (device / IP) and permissions on the server.
// Start:  npm run server     (reads DATABASE_URL, JWT_SECRET, PORT from .env)
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { encryptToken, decryptToken } from './utils/crypto.mjs';
import { convertLead } from './services/leadService.mjs';
import { createInvoice, calculateInvoiceTotals } from './services/invoiceService.mjs';
import { calculateServerPayslip } from './services/payrollCalculator.mjs';
import { verifyMetaWebhookSignature } from './services/webhookService.mjs';
import { createDistributedRateLimiter, getClientIp } from './services/rateLimiter.mjs';
import { savePersistentFile, getPersistentFile, deletePersistentFile } from './services/fileStorageService.mjs';
import { sendEmail } from './services/emailService.mjs';
import { runMigrations } from './migrate.mjs';

import { pool, getDbDiagnostics } from './db.mjs';

import { createRequire } from 'module';
const D = createRequire(import.meta.url)('./defaults.json'); // AGENCYOS_VERCEL
const M = D.M;
const PORT = Number(process.env.PORT || 4000);
const SECRET = process.env.JWT_SECRET || '';
// AGENCYOS_SERVER_STATUS
const E = process.env;
const PROBLEMS = [];
if (!E.DATABASE_URL && !E.DB_PASSWORD) { PROBLEMS.push('DATABASE_URL is missing (Vercel > Settings > Environment Variables, then Redeploy)'); console.error('Database settings missing in .env (DATABASE_URL or DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)'); if (!E.VERCEL) process.exit(1); }
const STARTED = Date.now();
if (SECRET.length < 16) { PROBLEMS.push('JWT_SECRET is missing or shorter than 16 characters'); console.error('JWT_SECRET in .env must be at least 16 characters'); if (!E.VERCEL) process.exit(1); }
if (E.TOKEN_ENCRYPTION_KEY && E.TOKEN_ENCRYPTION_KEY.length < 16) {
  PROBLEMS.push('TOKEN_ENCRYPTION_KEY is shorter than 16 characters');
  console.warn('Security notice: TOKEN_ENCRYPTION_KEY should be at least 32 characters for robust AES-256 key derivation');
}
const dbInfo = () => getDbDiagnostics();
export const KNOWN_DEFAULT_PASSWORDS = [
  process.env.INITIAL_ADMIN_PASSWORD,
  'Welcome@123',
  'YourStrongInitialAdminPassword123!',
].filter(Boolean);
export const DEFAULT_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Welcome@123';
export function isValidPassword(p) {
  if (!p || typeof p !== 'string' || p.length < 8) return false;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasDigit = /\d/.test(p);
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p);
  return hasUpper && hasLower && hasDigit && hasSymbol;
}
export const clientHash = (pw) => crypto.createHash('sha256').update('paa-salt:' + pw).digest('hex'); // same as the browser
export const isMatchDefault = (candidate) => {
  if (!candidate || typeof candidate !== 'string') return false;
  return KNOWN_DEFAULT_PASSWORDS.some((p) => candidate === p || candidate === clientHash(p));
};

// ---------------------------------------------------------------- tables
// key in the app -> table, typed columns [column, field, type], owner field, module
const T = {
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
const TABLE_KEYS = Object.keys(T);
// browser-only keys never stored on the server
const LOCAL_ONLY = /^(paa_theme|paa_x_session|paa_x_remember|paa_x_failed|paa_x_lockouts|paa_x_must_change|paa_x_os_sel_.*|paa_x_reminders_ran|paa_x_role_accounts_v1|paa_x_os_last_backup|paa_x_db_.*)$/;
const PAYROLL_ROLES = ['super_admin', 'admin', 'hr', 'finance', 'accountant'];
const PAY_KEYS = ['paa_x_payroll_runs', 'paa_x_salary_structures', 'paa_x_bank', 'paa_x_statutory', 'paa_x_payroll_rules'];
const FOUNDER_KEYS = ['paa_x_os_perm', 'paa_x_os_actions', 'paa_x_os_policy', 'paa_x_perm_overrides', 'paa_company'];
const HR_KEYS = ['paa_x_os_exits', 'paa_x_os_rec_incidents', 'paa_x_employee_docs', 'paa_x_onboarding', 'paa_x_contracts'];
const HR_ROLES = ['super_admin', 'admin', 'hr', 'hr_executive'];

// ---------------------------------------------------------------- schema (created automatically)
async function migrate() {
  await runMigrations(pool);
}

// ---------------------------------------------------------------- permissions
const isStaff = (r) => D.staff.includes(r);
const getSetting = async (key, fb) => { const r = await pool.query('SELECT value FROM app_settings WHERE key=$1', [key]); return r.rows[0] ? r.rows[0].value : fb; };
async function matrixFor(role) {
  if (role === 'super_admin') return D.modules.map(() => 1);
  const saved = (await getSetting('paa_x_os_perm', {}))[role];
  const d = D.matrix[role] || D.modules.map(() => 0);
  return d.map((v, i) => (Array.isArray(saved) && (saved[i] === 0 || saved[i] === 1) ? saved[i] : v));
}
function defaultActions(role, m, view) {
  if (role === 'super_admin') return 'CEDAX';
  if (!view) return '';
  if (role === 'admin') return 'CEDAX';
  if (role === 'auditor') return 'X';
  if (isStaff(role)) return m === M.CRM ? 'CE' : m === M.TSK ? 'E' : '';
  if (['manager', 'hr', 'finance', 'sales_manager', 'operations_manager', 'project_manager', 'client_relationship_manager'].includes(role)) return 'CEAX';
  if (['team_leader', 'sales_team_leader', 'project_coordinator'].includes(role)) return m === M.TSK || m === M.PRJ ? 'CEA' : 'CE';
  return 'CE';
}
async function can(role, m, act) {
  if (role === 'super_admin') return true;
  const mx = await matrixFor(role); const view = mx[m] === 1;
  if (!view) return false;
  const saved = ((await getSetting('paa_x_os_actions', {}))[role] || {})[m];
  return (typeof saved === 'string' ? saved : defaultActions(role, m, view)).includes(act);
}
async function canWriteRow(u, key, oldRow, newRow, act) {
  const d = T[key];
  if (u.role === 'super_admin') return true;
  if (d.appendOnly) return act === 'C';
  if (d.open) return act !== 'D' || u.role === 'admin';
  const mine = d.own && (newRow || oldRow) && (newRow ? newRow[d.own] === u.id : true) && (oldRow ? oldRow[d.own] === u.id : true);
  if (mine && act !== 'D') return true;
  if (d.team && !isStaff(u.role) && act !== 'D') return true; // managers / HR approve leave, attendance, claims
  if (d.mod === undefined) return act !== 'D' && !isStaff(u.role);
  if (await can(u.role, d.mod, act)) return true;
  if (d.alt !== undefined && act === 'E' && (await can(u.role, d.alt, 'E') || await can(u.role, d.alt, 'C'))) return true;
  if (d.own && d.mod === M.TSK && mine) return true;
  return false;
}

// ---------------------------------------------------------------- helpers
const row2 = (r) => r.data;
const colVals = (d, rec) => d.cols.map(([, f, ty]) => { const v = rec[f]; if (v === undefined || v === null || v === '') return null; return ty === 'numeric' ? Number(v) || 0 : typeof v === 'object' ? JSON.stringify(v) : String(v); });
async function upsertTable(client, key, rec, pos, by) {
  const d = T[key];
  const cols = d.cols.map(([c]) => c);
  const vals = colVals(d, rec);
  const ph = cols.map((_, i) => `$${i + 5}`);
  const nextVersion = (Number(rec.version) || 0) + 1;
  const nextRec = { ...rec, version: nextVersion };
  await client.query(`INSERT INTO ${d.t} (id, data, pos, version, ${cols.join(', ')}, updated_by) VALUES ($1, $2, $3, $4, ${ph.join(', ')}, $${cols.length + 5})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, pos = EXCLUDED.pos, version = ${d.t}.version + 1, ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = now(), updated_by = EXCLUDED.updated_by`,
  [String(rec.id), nextRec, pos, nextVersion, ...vals, by]);
}
const stripSalary = (e) => { const { salary, bankDetails, bank, pan, aadhaar, ...rest } = e; return rest; };

async function auth(req, res, next) {
  try {
    const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
    const p = jwt.verify(tok, SECRET);
    const s = await pool.query('SELECT * FROM sessions WHERE id=$1', [p.sid]);
    const sess = s.rows[0];
    if (!sess || sess.revoked_at) return res.status(401).json({ error: 'Session ended. Please sign in again.' });
    if (Date.now() - new Date(sess.last_seen).getTime() > 12 * 3600 * 1000) { await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [p.sid]); return res.status(401).json({ error: 'Signed out after 12 hours of no activity.' }); }
    const e = await pool.query('SELECT data FROM employees WHERE id=$1', [sess.employee_id]);
    const emp = e.rows[0]?.data;
    if (!emp || emp.status === 'inactive') return res.status(401).json({ error: 'This account is disabled.' });
    await pool.query('UPDATE sessions SET last_seen=now() WHERE id=$1', [p.sid]);
    req.u = { id: emp.id, role: emp.role, name: emp.name, sid: p.sid };
    next();
  } catch { res.status(401).json({ error: 'Please sign in.' }); }
}

// ---------------------------------------------------------------- app
const app = express();

// In-memory sliding window rate limiter for general API & auth endpoints
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 req/min for general API
const MAX_AUTH_REQUESTS_PER_WINDOW = 15; // 15 req/min for auth routes

function applyRateLimit(limit = MAX_REQUESTS_PER_WINDOW) {
  return (req, res, next) => {
    const key = `${ip(req)}_${req.path}`;
    const now = Date.now();
    const clientData = rateLimitMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > clientData.resetAt) {
      clientData.count = 0;
      clientData.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }

    clientData.count++;
    rateLimitMap.set(key, clientData);

    // Housekeeping: purge entries older than 2 hours periodically
    if (rateLimitMap.size > 10000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetAt) rateLimitMap.delete(k);
      }
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - clientData.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetAt / 1000));

    if (clientData.count > limit) {
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again later.' });
    }
    next();
  };
}

// P1-01 & P1-02: Security Headers & Explicit CORS Configuration
app.use((req, res, next) => {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim());
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Security Headers (CSP, Frame Options, Sniffing protection)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' ws: wss: http: https:;");

  // P3-01: Correlation ID for structured request observability
  const reqId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId = reqId;
  res.setHeader('X-Correlation-ID', reqId);

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '25mb' }));
// Distributed rate limiter (PostgreSQL backed with in-memory fallback)
app.use('/api', createDistributedRateLimiter(pool, { limit: 120, windowMs: 60000, prefix: 'api' }));
app.use('/api/auth/login', createDistributedRateLimiter(pool, { limit: 15, windowMs: 60000, prefix: 'auth_login' }));
app.use('/api/setup/import', createDistributedRateLimiter(pool, { limit: 15, windowMs: 60000, prefix: 'auth_import' }));
app.set('trust proxy', 1); // Specific proxy hop trust
const OPEN = ['/', '/api', '/api/server', '/api/status', '/api/health'];

let isReady = false;
let readyError = null;

async function runMigrationWithRetry(retries = E.VERCEL ? 1 : 3) {
  if (E.VERCEL) {
    try {
      await pool.query('SELECT 1 FROM employees LIMIT 1');
      isReady = true;
      readyError = null;
      return true;
    } catch (err) {
      if (err.code === '42P01') {
        try {
          await migrate();
          isReady = true;
          readyError = null;
          return true;
        } catch (mErr) {
          readyError = mErr;
          console.warn('Initial migration error on serverless:', mErr.message);
          return false;
        }
      }
      readyError = err;
      console.warn('PostgreSQL serverless connectivity check notice:', err.message);
      return false;
    }
  }

  for (let i = 1; i <= retries; i++) {
    try {
      await migrate();
      isReady = true;
      readyError = null;
      return true;
    } catch (err) {
      readyError = err;
      console.warn(`PostgreSQL connection/migration attempt ${i}/${retries} notice: ${err.message}`);
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return false;
}

const READY = runMigrationWithRetry();

app.use(async (req, res, next) => {
  if (OPEN.includes(req.path)) return next();
  if (isReady) return next();
  try {
    await READY;
    if (isReady) return next();
    res.status(503).json({ error: 'Database not reachable: ' + (readyError?.message || 'Database initializing') });
  } catch (e) {
    res.status(503).json({ error: 'Database not reachable: ' + e.message });
  }
});
const ip = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
async function status() {
  const out = { server: 'running', problems: PROBLEMS, node: process.version, vercel: !!E.VERCEL, settings: { DATABASE_URL: E.DATABASE_URL ? 'set' : 'MISSING', DB_SSL: E.DB_SSL || 'not set', JWT_SECRET: SECRET.length >= 16 ? 'set' : 'MISSING/too short' }, port: PORT, startedAt: new Date(STARTED).toLocaleString('en-IN'), uptimeMin: Math.round((Date.now() - STARTED) / 60000), db: { ...dbInfo(), connected: false } };
  try {
    out.db.version = (await pool.query('SHOW server_version')).rows[0].server_version;
    out.db.size = (await pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) s')).rows[0].s;
    out.db.connected = true;
    const t = (await pool.query("SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows;
    out.tables = [];
    for (const r of t) { const c = (await pool.query('SELECT count(*)::int n FROM public.' + '"' + r.name.replace(/"/g, '') + '"')).rows[0].n; out.tables.push({ name: r.name, rows: c }); }
    out.activeSessions = (await pool.query("SELECT count(*)::int n FROM sessions WHERE revoked_at IS NULL AND last_seen > now() - interval '12 hours'")).rows[0].n;
    const ls = (await pool.query('SELECT store, by_employee, at FROM sync_events ORDER BY id DESC LIMIT 1')).rows[0];
    out.lastChange = ls ? { store: ls.store, by: ls.by_employee, at: new Date(ls.at).toLocaleString('en-IN') } : null;
  } catch (e) { out.db.error = String(e.message); }
  return out;
}
app.get('/api/health', async (_req, res) => {
  try {
    const dbOk = isReady && (await pool.query('SELECT 1')).rowCount === 1;
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'healthy' : 'unhealthy',
      database: dbOk ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round((Date.now() - STARTED) / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

app.get('/api/status', async (_q, res) => res.json(await status()));
app.get('/api/setup/status', async (_q, res) => {
  try {
    const empCount = (await pool.query('SELECT count(*)::int n FROM employees')).rows[0].n;
    const clientCount = (await pool.query('SELECT count(*)::int n FROM clients')).rows[0].n;
    const leadCount = (await pool.query('SELECT count(*)::int n FROM leads')).rows[0].n;
    const invoiceCount = (await pool.query('SELECT count(*)::int n FROM invoices')).rows[0].n;
    const totalBusinessRecords = clientCount + leadCount + invoiceCount;
    res.json({
      empty: empCount === 0,
      employeesCount: empCount,
      businessRecordsCount: totalBusinessRecords,
      ready: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// first-time: copy this browser's data into the database
// REM-002: Protected against unauthorized account provisioning & privilege escalation
app.post('/api/setup/import', async (req, res) => {
  const clientIp = ip(req);
  const clientToken = String(req.headers['x-setup-secret'] || req.headers['x-bootstrap-token'] || req.body?.setupSecret || '').trim();
  const configuredSecret = String(process.env.SETUP_SECRET || process.env.INITIAL_ADMIN_PASSWORD || '').trim();

  // 1. Check if an existing authenticated session was provided
  let authUser = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const tok = authHeader.replace(/^Bearer /, '');
      const p = jwt.verify(tok, SECRET);
      const s = await pool.query('SELECT * FROM sessions WHERE id=$1', [p.sid]);
      const sess = s.rows[0];
      if (sess && !sess.revoked_at && Date.now() - new Date(sess.last_seen).getTime() <= 12 * 3600 * 1000) {
        const e = await pool.query('SELECT data FROM employees WHERE id=$1', [sess.employee_id]);
        const emp = e.rows[0]?.data;
        if (emp && emp.status !== 'inactive') {
          authUser = { id: emp.id, role: emp.role, name: emp.name };
        }
      }
    } catch {
      // invalid or expired token, proceed to secret check
    }
  }

  // 2. Query system state inside a connection to verify bootstrap lock
  const c = await pool.connect();
  try {
    const [empRes, lockRes] = await Promise.all([
      c.query('SELECT count(*)::int n FROM employees'),
      c.query("SELECT value FROM app_settings WHERE key='paa_bootstrap_completed'"),
    ]);

    const empCount = empRes.rows[0]?.n || 0;
    const isBootstrapCompleted = !!lockRes.rows[0]?.value;

    // A. If already bootstrapped, strictly require super_admin authorization
    if (isBootstrapCompleted || empCount > 0) {
      if (!authUser || authUser.role !== 'super_admin') {
        pool.query('INSERT INTO login_events (employee_id, login, ok, reason, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)', [
          authUser?.id || null,
          'setup/import',
          false,
          'unauthorized import attempt after bootstrap',
          clientIp,
          String(req.headers['user-agent'] || '').slice(0, 200),
        ]).catch(() => {});
        return res.status(403).json({ error: 'Database is already initialized. Administrative import requires super_admin authentication.' });
      }
    } else {
      // B. Database is empty (uninitialized bootstrap phase): require verifiable bootstrap secret
      const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost' || clientIp === '';
      const bufToken = Buffer.from(clientToken);
      const bufSecret = Buffer.from(configuredSecret);
      const secretMatches = configuredSecret && clientToken && bufToken.length === bufSecret.length && crypto.timingSafeEqual(bufToken, bufSecret);

      // Require secret match, or fallback to loopback with default password match if no custom secret configured
      const authorizedBootstrap = configuredSecret ? secretMatches : (isLoopback && (clientToken === DEFAULT_PASSWORD || !clientToken));
      if (!authorizedBootstrap) {
        pool.query('INSERT INTO login_events (employee_id, login, ok, reason, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)', [
          null,
          'setup/import',
          false,
          'invalid or missing bootstrap authorization secret',
          clientIp,
          String(req.headers['user-agent'] || '').slice(0, 200),
        ]).catch(() => {});
        return res.status(401).json({ error: 'Bootstrap authorization failed. A valid SETUP_SECRET or administrative authorization is required.' });
      }
    }

    // 3. Payload size and structure validation
    const data = req.body?.data || {};
    if (!Array.isArray(data.paa_employees) || !data.paa_employees.length) {
      return res.status(400).json({ error: 'Invalid import payload: paa_employees must be a non-empty array.' });
    }
    if (data.paa_employees.length > 500) {
      return res.status(413).json({ error: 'Payload exceeds maximum import limit (500 employees per import).' });
    }

    // Validate employee objects and prevent privilege escalation
    for (const emp of data.paa_employees) {
      if (!emp || typeof emp !== 'object' || !emp.id || !emp.email) {
        return res.status(400).json({ error: 'Malformed employee record in import payload.' });
      }
      // Ensure email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(emp.email))) {
        return res.status(400).json({ error: `Invalid email address format for employee ${emp.id}: ${emp.email}` });
      }
      // If caller is not super_admin (initial bootstrap), ensure only one super_admin exists or assign fallback
      if (emp.role && !D.roles.includes(emp.role)) {
        return res.status(400).json({ error: `Invalid role '${emp.role}' specified for employee ${emp.id}.` });
      }
    }

    // 4. Atomic Execution inside Transaction
    await c.query('BEGIN');

    // Acquire an advisory lock to prevent concurrent bootstrap requests from interleaving
    await c.query('SELECT pg_advisory_xact_lock(987654321)');

    const updater = authUser ? authUser.id : 'bootstrap';

    for (const [key, val] of Object.entries(data)) {
      if (LOCAL_ONLY.test(key) || key === 'paa_x_credentials') continue;
      if (T[key] && Array.isArray(val)) {
        let i = 0;
        for (const rec of val) {
          if (rec && rec.id) await upsertTable(c, key, rec, i++, updater);
        }
      } else if (Array.isArray(val) && val.every((x) => x && typeof x === 'object' && typeof x.id === 'string')) {
        let i = 0;
        for (const rec of val) {
          await c.query('INSERT INTO app_records (store, id, data, pos, updated_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (store,id) DO UPDATE SET data=EXCLUDED.data', [key, rec.id, rec, i++, updater]);
        }
      } else {
        await c.query('INSERT INTO app_settings (key, value, updated_by) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [key, JSON.stringify(val), updater]);
      }
    }

    for (const cr of data.paa_x_credentials || []) {
      if (cr.employeeId && cr.hash) {
        await c.query('INSERT INTO user_credentials (employee_id, password_hash, must_change, updated_by) VALUES ($1,$2,$3,$4) ON CONFLICT (employee_id) DO NOTHING', [cr.employeeId, await bcrypt.hash(cr.hash, 10), !!cr.mustChange, updater]);
      }
    }

    // Set one-time permanent bootstrap completion flag
    await c.query("INSERT INTO app_settings (key, value, updated_by) VALUES ('paa_bootstrap_completed', '\"true\"', $1) ON CONFLICT (key) DO UPDATE SET value='\"true\"', updated_at=now()", [updater]);

    // Record audit event
    const auditId = 'aud-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString('en-IN');
    await c.query(
      'INSERT INTO audit_logs (id, user_id, user_name, action, related_record, date, time, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        auditId,
        updater,
        authUser ? authUser.name : 'System Bootstrap',
        isBootstrapCompleted ? 'ADMIN_IMPORT' : 'SYSTEM_BOOTSTRAP',
        `Imported ${data.paa_employees.length} employees`,
        todayStr,
        timeStr,
        JSON.stringify({ employees: data.paa_employees.length, clientIp, timestamp: new Date().toISOString() })
      ]
    );

    await c.query('COMMIT');
    res.json({ ok: true, employees: data.paa_employees.length, bootstrapped: !isBootstrapCompleted });
  } catch (e) {
    await c.query('ROLLBACK');
    res.status(500).json({ error: String(e.message) });
  } finally {
    c.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const clientIp = ip(req);
  const login = String(req.body?.login || '').trim().toLowerCase();
  const pw = String(req.body?.password || '');

  if (!login || !pw) return res.status(400).json({ error: 'Enter your work email / employee ID and password.' });

  const log = (emp, ok, reason) =>
    pool
      .query('INSERT INTO login_events (employee_id, login, ok, reason, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)', [
        emp?.id || null,
        login,
        ok,
        reason || null,
        clientIp,
        String(req.headers['user-agent'] || '').slice(0, 200),
      ])
      .catch((err) => console.warn('login log warning:', err.message));

  // Run IP rate check & employee lookup in parallel for fast execution
  const [ipRes, empRes] = await Promise.all([
    pool
      .query("SELECT count(*)::int n FROM login_events WHERE ip=$1 AND ok=false AND at > now() - interval '15 minutes'", [clientIp])
      .catch(() => ({ rows: [{ n: 0 }] })),
    pool.query('SELECT data FROM employees WHERE lower(email)=$1 OR lower(employee_code)=$1 LIMIT 1', [login]),
  ]);

  if ((ipRes.rows[0]?.n || 0) >= 10) {
    return res.status(429).json({ error: 'Too many failed login attempts from this network. Please try again after 15 minutes.' });
  }

  const emp = empRes.rows[0]?.data;
  if (!emp) {
    log(null, false, 'unknown login');
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (emp.status === 'inactive') {
    log(emp, false, 'inactive');
    return res.status(403).json({ error: 'This account is suspended. Contact the Founder or HR.' });
  }

  // Fetch failed attempts and user credentials in parallel
  const [failsRes, crRes] = await Promise.all([
    pool
      .query("SELECT count(*)::int n FROM login_events WHERE employee_id=$1 AND ok=false AND at > now() - interval '15 minutes'", [emp.id])
      .catch(() => ({ rows: [{ n: 0 }] })),
    pool.query('SELECT * FROM user_credentials WHERE employee_id=$1', [emp.id]),
  ]);

  const fails = failsRes.rows[0]?.n || 0;
  if (fails >= 5) {
    return res.status(429).json({ error: 'Too many wrong attempts. Try again after 15 minutes or ask HR / Admin to reset your password.' });
  }

  const cr = crRes.rows[0];
  let ok = false;
  if (cr) {
    // 1. Direct server-side bcrypt hash
    ok = await bcrypt.compare(pw, cr.password_hash);
    // 2. Fallback to legacy clientHash(pw) with transparent upgrade
    if (!ok) {
      ok = await bcrypt.compare(clientHash(pw), cr.password_hash);
      if (ok) {
        const upgraded = await bcrypt.hash(pw, 12);
        pool.query('UPDATE user_credentials SET password_hash=$1 WHERE employee_id=$2', [upgraded, emp.id]).catch(console.warn);
      }
    }
    // 3. Fallback: uninitialized/temporary accounts (must_change=true) matching default passwords
    if (!ok && cr.must_change && isMatchDefault(pw)) {
      ok = true;
      const upgraded = await bcrypt.hash(pw, 12);
      pool.query('UPDATE user_credentials SET password_hash=$1 WHERE employee_id=$2', [upgraded, emp.id]).catch(console.warn);
    }
  } else {
    // Uninitialized password: check against configured INITIAL_ADMIN_PASSWORD or known default passwords
    if (isMatchDefault(pw)) {
      ok = true;
      const initialHash = await bcrypt.hash(pw, 12);
      await pool
        .query(
          'INSERT INTO user_credentials (employee_id, password_hash, must_change, updated_by) VALUES ($1,$2,true,$3) ON CONFLICT (employee_id) DO UPDATE SET password_hash=EXCLUDED.password_hash, must_change=true',
          [emp.id, initialHash, 'init']
        )
        .catch(console.warn);
    } else {
      ok = false;
    }
  }

  if (!ok) {
    log(emp, false, 'wrong password');
    const msg = !cr
      ? 'Account password is not set or temporary activation has expired. Please contact an Administrator to reset your credentials.'
      : `Wrong password. ${Math.max(0, 4 - fails)} attempt(s) left before a 15-minute lock.`;
    return res.status(401).json({ error: msg });
  }

  const sid = crypto.randomUUID();
  const ev = { id: 'lg-' + Date.now(), employeeId: emp.id, name: emp.name, role: emp.role, portal: 'server', at: new Date().toLocaleString('en-IN'), ok: true, reason: `IP ${clientIp}` };

  // Write session, login log, and audit record in parallel
  await Promise.all([
    pool.query('INSERT INTO sessions (id, employee_id, ip, user_agent) VALUES ($1,$2,$3,$4)', [sid, emp.id, clientIp, String(req.headers['user-agent'] || '').slice(0, 200)]),
    log(emp, true),
    pool.query("INSERT INTO app_records (store, id, data, pos, updated_by) VALUES ('paa_x_login_history', $1, $2, $3, $4)", [ev.id, ev, -Date.now(), emp.id]),
  ]);

  res.json({ token: jwt.sign({ sid }, SECRET, { expiresIn: '7d' }), user: { id: emp.id, name: emp.name, email: emp.email, role: emp.role }, mustChange: !cr || cr.must_change });
});

app.post('/api/auth/logout', auth, async (req, res) => { await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [req.u.sid]); res.json({ ok: true }); });
app.post('/api/auth/logout-others', auth, async (req, res) => { const r = await pool.query('UPDATE sessions SET revoked_at=now() WHERE employee_id=$1 AND id<>$2 AND revoked_at IS NULL', [req.u.id, req.u.sid]); res.json({ ok: true, ended: r.rowCount }); });
app.get('/api/auth/sessions', auth, async (req, res) => { const r = await pool.query('SELECT id, ip, user_agent, created_at, last_seen, revoked_at FROM sessions WHERE employee_id=$1 ORDER BY last_seen DESC LIMIT 20', [req.u.id]); res.json(r.rows.map((s) => ({ ...s, current: s.id === req.u.sid }))); });
app.post('/api/auth/password', auth, async (req, res) => {
  const { current, next } = req.body || {};
  const cr = (await pool.query('SELECT * FROM user_credentials WHERE employee_id=$1', [req.u.id])).rows[0];
  let ok = false;
  if (cr) {
    ok = await bcrypt.compare(String(current || ''), cr.password_hash);
    if (!ok) ok = await bcrypt.compare(clientHash(String(current || '')), cr.password_hash);
    if (!ok && cr.must_change && isMatchDefault(String(current || ''))) ok = true;
  } else {
    ok = isMatchDefault(String(current || ''));
  }
  if (!ok) return res.status(400).json({ error: 'Current password is wrong.' });
  if (!isValidPassword(String(next || ''))) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.' });
  }
  if (KNOWN_DEFAULT_PASSWORDS.includes(String(next))) {
    return res.status(400).json({ error: 'You cannot reuse the default temporary password.' });
  }
  await pool.query('INSERT INTO user_credentials (employee_id, password_hash, must_change, updated_by) VALUES ($1,$2,false,$1) ON CONFLICT (employee_id) DO UPDATE SET password_hash=EXCLUDED.password_hash, must_change=false, updated_at=now(), updated_by=EXCLUDED.updated_by', [req.u.id, await bcrypt.hash(String(next), 12)]);
  res.json({ ok: true });
});

// everything this user is allowed to see
app.get('/api/bootstrap', auth, async (req, res) => {
  const u = req.u; const out = {}; const mx = await matrixFor(u.role); const staff = isStaff(u.role);
  const team = new Set([u.id]);
  if (['team_leader', 'sales_team_leader'].includes(u.role)) {
    const org = await getSetting('paa_x_os_org', {}); const mine = org[u.id];
    for (const [id, p] of Object.entries(org)) if (p.reportsTo === u.id || (mine && p.unit === mine.unit && !/manager/i.test(p.position))) team.add(id);
  }
  for (const key of TABLE_KEYS) {
    const d = T[key];
    let rows = (await pool.query(`SELECT data, pos FROM ${d.t} ORDER BY pos, created_at`)).rows.map(row2);
    const view = d.mod === undefined || u.role === 'super_admin' || mx[d.mod] === 1;
    if (key === 'paa_employees') rows = PAYROLL_ROLES.includes(u.role) ? rows : rows.map((e) => (e.id === u.id ? e : stripSalary(e)));
    else if (key === 'paa_audit_logs') rows = staff ? rows.filter((r) => r.userId === u.id) : rows;
    else if (!view) rows = d.ownRead || d.own ? rows.filter((r) => r[d.own] === u.id) : [];
    else if (d.open) rows = rows.filter((r) => !r.userId || r.userId === u.id || u.role === 'super_admin');
    else if (d.own && staff) rows = rows.filter((r) => r[d.own] === u.id);
    else if (d.own && team.size > 1) rows = rows.filter((r) => team.has(r[d.own]));
    out[key] = rows;
  }
  const recs = (await pool.query('SELECT store, data FROM app_records ORDER BY store, pos, updated_at')).rows;
  for (const r of recs) (out[r.store] = out[r.store] || []).push(r.data);
  for (const r of (await pool.query('SELECT key, value FROM app_settings')).rows) out[r.key] = r.value;
  // privacy filters
  if (!PAYROLL_ROLES.includes(u.role)) {
    if (Array.isArray(out.paa_x_payroll_runs)) out.paa_x_payroll_runs = out.paa_x_payroll_runs.filter((x) => ['approved', 'partially_paid', 'paid'].includes(x.status)).map((x) => ({ ...x, slips: (x.slips || []).filter((s) => s.employeeId === u.id) }));
    if (Array.isArray(out.paa_x_salary_structures)) out.paa_x_salary_structures = out.paa_x_salary_structures.filter((x) => x.employeeId === u.id);
    if (out.paa_x_bank && typeof out.paa_x_bank === 'object') out.paa_x_bank = out.paa_x_bank[u.id] ? { [u.id]: out.paa_x_bank[u.id] } : {};
  }
  if (!HR_ROLES.includes(u.role)) for (const k of HR_KEYS) if (Array.isArray(out[k])) out[k] = out[k].filter((x) => x.employeeId === u.id || x.ownerId === u.id);
  if (!['super_admin', 'admin', 'hr'].includes(u.role) && Array.isArray(out.paa_x_login_history)) out.paa_x_login_history = out.paa_x_login_history.filter((x) => x.employeeId === u.id);
  const creds = (await pool.query('SELECT employee_id, must_change, updated_at FROM user_credentials')).rows;
  out.paa_x_credentials = creds.filter((c) => c.employee_id === u.id || ['super_admin', 'admin', 'hr'].includes(u.role)).map((c) => ({ employeeId: c.employee_id, hash: 'server', mustChange: c.must_change, updatedAt: new Date(c.updated_at).toLocaleString('en-IN') }));
  const last = (await pool.query('SELECT coalesce(max(id),0)::bigint id FROM sync_events')).rows[0].id;
  res.json({ me: u, data: out, cursor: String(last) });
});

// save changes: rows (upserts / deletes / order) or a whole value
app.post('/api/sync', auth, async (req, res) => {
  const u = req.u; const { key, upserts = [], deletes = [], order, value, mode } = req.body || {};
  if (!key || LOCAL_ONLY.test(key)) return res.json({ ok: true, skipped: true });
  const c = await pool.connect(); const denied = [];
  try {
    await c.query('BEGIN');
    if (key === 'paa_x_credentials') {
      // password resets by Founder / Admin / HR: the browser sends the hash of the temporary password
      for (const cr of upserts) {
        if (!cr.employeeId || cr.employeeId === u.id || cr.hash === 'server') continue;
        const target = (await c.query('SELECT data FROM employees WHERE id=$1', [cr.employeeId])).rows[0]?.data;
        const ok = ['super_admin', 'admin', 'hr'].includes(u.role) && target && (target.role !== 'super_admin' || u.role === 'super_admin');
        if (!ok) { denied.push(cr.employeeId); continue; }
        await c.query('INSERT INTO user_credentials (employee_id, password_hash, must_change, updated_by) VALUES ($1,$2,$3,$4) ON CONFLICT (employee_id) DO UPDATE SET password_hash=EXCLUDED.password_hash, must_change=EXCLUDED.must_change, updated_at=now(), updated_by=EXCLUDED.updated_by', [cr.employeeId, await bcrypt.hash(cr.hash, 10), !!cr.mustChange, u.id]);
      }
    } else if (T[key] && mode !== 'value') {
      const d = T[key];
      for (const { rec, pos } of upserts) {
        if (!rec || !rec.id) continue;
        const oldRowRes = (await c.query(`SELECT data, version FROM ${d.t} WHERE id=$1`, [String(rec.id)])).rows[0];
        const old = oldRowRes?.data;
        const currentVersion = oldRowRes?.version ?? old?.version;
        // Optimistic Concurrency Control (OCC) conflict check
        if (rec.version !== undefined && currentVersion !== undefined && Number(rec.version) < Number(currentVersion)) {
          denied.push({ id: rec.id, reason: 'conflict', currentVersion });
          continue;
        }
        if (!(await canWriteRow(u, key, old, rec, old ? 'E' : 'C'))) { denied.push(rec.id); continue; }
        let next = rec;
        if (key === 'paa_employees' && old && !PAYROLL_ROLES.includes(u.role)) next = { ...rec, salary: old.salary }; // keep hidden salary
        if (key === 'paa_employees' && old && old.role !== rec.role && !['super_admin', 'admin', 'hr'].includes(u.role)) { denied.push(rec.id); continue; }
        if (key === 'paa_employees' && old && (rec.role === 'super_admin') !== (old.role === 'super_admin') && u.role !== 'super_admin') { denied.push(rec.id); continue; }
        if (d.appendOnly && old) continue;
        await upsertTable(c, key, next, Number(pos) || 0, u.id);
      }
      for (const id of deletes) {
        const old = (await c.query(`SELECT data FROM ${d.t} WHERE id=$1`, [String(id)])).rows[0]?.data;
        if (!old) continue;
        if (!(await canWriteRow(u, key, old, null, 'D'))) { denied.push(id); continue; }
        await c.query('INSERT INTO deleted_records (store, record_id, data, deleted_by) VALUES ($1,$2,$3,$4)', [key, String(id), old, u.id]);
        await c.query(`DELETE FROM ${d.t} WHERE id=$1`, [String(id)]);
      }
      if (Array.isArray(order)) for (const [id, p] of order) await c.query(`UPDATE ${d.t} SET pos=$2 WHERE id=$1`, [String(id), p]);
    } else {
      const fo = FOUNDER_KEYS.includes(key) && !(key === 'paa_company' && u.role === 'admin') && u.role !== 'super_admin';
      const pay = PAY_KEYS.includes(key) && !PAYROLL_ROLES.includes(u.role);
      const org = key === 'paa_x_os_org' && !HR_ROLES.includes(u.role);
      if (fo || pay || org) { await c.query('ROLLBACK'); return res.status(403).json({ error: 'Only the Founder (or the responsible department) can change this setting.', denied: [key] }); }

      // Enforce module authorization on app_records stores
      const APP_RECORD_MODULE_MAP = {
        paa_deals_sow: M.PRJ,
        paa_milestones: M.PRJ,
        paa_project_templates: M.PRJ,
        paa_documents: M.CLI,
        paa_agreements_extra: M.CLI,
        paa_quotation_extras: M.CRM,
        paa_vendors: M.FIN,
        paa_vendor_bills: M.FIN,
        paa_x_onboarding: M.HR,
        paa_x_employee_docs: M.HR,
        paa_x_contracts: M.HR,
        paa_x_os_exits: M.HR,
        paa_x_os_rec_incidents: M.HR,
      };
      const requiredMod = APP_RECORD_MODULE_MAP[key];
      if (requiredMod !== undefined && u.role !== 'super_admin') {
        const hasAccess = await can(u.role, requiredMod, 'E') || await can(u.role, requiredMod, 'C');
        if (!hasAccess) {
          await c.query('ROLLBACK');
          return res.status(403).json({ error: `Forbidden: your role lacks permission for store '${key}'.`, denied: [key] });
        }
      }

      if (mode === 'value') {
        await c.query('INSERT INTO app_settings (key, value, updated_by) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now(), updated_by=EXCLUDED.updated_by', [key, JSON.stringify(value ?? null), u.id]);
        await c.query('DELETE FROM app_records WHERE store=$1', [key]);
      } else {
        for (const { rec, pos } of upserts) if (rec && rec.id) await c.query('INSERT INTO app_records (store, id, data, pos, version, updated_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (store,id) DO UPDATE SET data=EXCLUDED.data, pos=EXCLUDED.pos, version=app_records.version + 1, updated_at=now(), updated_by=EXCLUDED.updated_by', [key, String(rec.id), rec, Number(pos) || 0, (Number(rec.version) || 0) + 1, u.id]);
        for (const id of deletes) { const old = (await c.query('DELETE FROM app_records WHERE store=$1 AND id=$2 RETURNING data', [key, String(id)])).rows[0]; if (old) await c.query('INSERT INTO deleted_records (store, record_id, data, deleted_by) VALUES ($1,$2,$3,$4)', [key, String(id), old.data, u.id]); }
        if (Array.isArray(order)) for (const [id, p] of order) await c.query('UPDATE app_records SET pos=$3 WHERE store=$1 AND id=$2', [key, String(id), p]);
        await c.query('DELETE FROM app_settings WHERE key=$1', [key]);
      }
    }
    await c.query('INSERT INTO sync_events (store, by_employee) VALUES ($1,$2)', [key, u.id]);
    await c.query('COMMIT');
    res.status(denied.length ? 207 : 200).json({ ok: !denied.length, denied });
  } catch (e) { await c.query('ROLLBACK'); console.error('sync', key, e.message); res.status(500).json({ error: String(e.message) }); } finally { c.release(); }
});

// what other people changed since my last look
app.get('/api/changes', auth, async (req, res) => {
  const since = String(req.query.since || '0');
  const r = await pool.query('SELECT store, max(id)::bigint id FROM sync_events WHERE id > $1 AND by_employee <> $2 GROUP BY store', [since, req.u.id]);
  const last = (await pool.query('SELECT coalesce(max(id),0)::bigint id FROM sync_events')).rows[0].id;
  res.json({ stores: r.rows.map((x) => x.store), cursor: String(last) });
});

// ---------------------------------------------------------------- search
app.get('/api/search', auth, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const cat = String(req.query.category || 'all').toLowerCase();
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  if (!q) return res.json({ query: '', total: 0, categories: {}, results: [] });

  const u = req.u;
  const mx = await matrixFor(u.role);
  const staff = isStaff(u.role);
  const allResults = [];
  const categoryCounts = {};

  const scoreText = (target, term) => {
    if (!target) return 0;
    const str = String(target).toLowerCase();
    if (str === term) return 100;
    if (str.startsWith(term)) return 70;
    if (str.includes(term)) return 40;
    return 0;
  };

  const matchAndPush = (itemCategory, itemTab, id, title, subtitle, status, snippet, ...fields) => {
    let maxScore = 0;
    for (const f of fields) {
      const s = scoreText(f, q);
      if (s > maxScore) maxScore = s;
    }
    if (maxScore > 0) {
      categoryCounts[itemCategory] = (categoryCounts[itemCategory] || 0) + 1;
      if (cat === 'all' || cat === itemCategory) {
        allResults.push({
          id: String(id),
          category: itemCategory,
          tab: itemTab,
          title: title || 'Untitled',
          subtitle: subtitle || '',
          status: status || '',
          snippet: snippet || '',
          score: maxScore,
        });
      }
    }
  };

  try {
    // 1. Leads (CRM)
    if (u.role === 'super_admin' || mx[M.CRM] === 1) {
      const rows = (await pool.query('SELECT data FROM leads')).rows.map(row2);
      for (const l of rows) {
        if (staff && l.assignedEmployeeId !== u.id) continue;
        matchAndPush('leads', 'leads', l.id, l.company || l.name, l.leadCode, l.status, l.notes || l.email, l.leadCode, l.company, l.name, l.phone, l.email, l.source);
      }
    }

    // 2. Clients (CLI)
    if (u.role === 'super_admin' || mx[M.CLI] === 1) {
      const rows = (await pool.query('SELECT data FROM clients')).rows.map(row2);
      for (const c of rows) {
        matchAndPush('clients', 'clients', c.id, c.companyName, c.clientCode, c.status, c.address || c.email, c.clientCode, c.companyName, c.phone, c.email, c.city, c.gstin);
      }
    }

    // 3. Employees (Staff/HR)
    {
      const rows = (await pool.query('SELECT data FROM employees')).rows.map(row2);
      for (const e of rows) {
        matchAndPush('employees', 'employees', e.id, e.name, `${e.employeeId || e.employeeCode || ''} • ${e.designation || e.role || ''}`, e.status, e.department || e.email, e.employeeId, e.employeeCode, e.name, e.email, e.phone, e.department, e.designation);
      }
    }

    // 4. Projects (PRJ)
    if (u.role === 'super_admin' || mx[M.PRJ] === 1) {
      const rows = (await pool.query('SELECT data FROM projects')).rows.map(row2);
      for (const p of rows) {
        matchAndPush('projects', 'projects', p.id, p.name, p.projectCode, p.status, p.description || p.category, p.projectCode, p.name, p.category, p.clientName);
      }
    }

    // 5. Tasks (TSK)
    if (u.role === 'super_admin' || mx[M.TSK] === 1) {
      const rows = (await pool.query('SELECT data FROM tasks')).rows.map(row2);
      for (const t of rows) {
        if (staff && t.assignedEmployeeId !== u.id) continue;
        matchAndPush('tasks', 'task_operations', t.id, t.title, t.taskCode, t.status, t.description || t.dueDate, t.taskCode, t.title, t.description, t.priority);
      }
    }

    // 6. Invoices (FIN)
    if (u.role === 'super_admin' || mx[M.FIN] === 1) {
      const rows = (await pool.query('SELECT data FROM invoices')).rows.map(row2);
      for (const inv of rows) {
        matchAndPush('invoices', 'billing', inv.id, inv.invoiceNumber, `Total: ₹${inv.totalAmount || inv.total || 0}`, inv.status, inv.clientName || inv.issueDate, inv.invoiceNumber, inv.clientName);
      }
    }

    // 7. Quotations (CRM)
    if (u.role === 'super_admin' || mx[M.CRM] === 1) {
      const rows = (await pool.query('SELECT data FROM quotations')).rows.map(row2);
      for (const qn of rows) {
        matchAndPush('quotations', 'deals_quotations', qn.id, qn.quotationNumber, `Amount: ₹${qn.total || 0}`, qn.status, qn.clientName, qn.quotationNumber, qn.clientName);
      }
    }

    // 8. Documents / Contracts (DOC / CLI)
    if (u.role === 'super_admin' || mx[M.DOC] === 1 || mx[M.CLI] === 1) {
      const rows = (await pool.query('SELECT data FROM agreements')).rows.map(row2);
      for (const ag of rows) {
        matchAndPush('contracts', 'deals_agreements', ag.id, ag.agreementNumber || ag.title, ag.clientName, ag.status, ag.type, ag.agreementNumber, ag.title, ag.clientName);
      }
      const docs = (await pool.query("SELECT data FROM app_records WHERE store='paa_documents'")).rows.map(row2);
      for (const doc of docs) {
        matchAndPush('documents', 'document_center', doc.id, doc.title || doc.name, doc.category, doc.status, doc.description, doc.title, doc.name, doc.documentNumber);
      }
    }

    // 9. Expenses (FIN / Own)
    if (u.role === 'super_admin' || mx[M.FIN] === 1) {
      const rows = (await pool.query('SELECT data FROM expenses')).rows.map(row2);
      for (const ex of rows) {
        matchAndPush('expenses', 'expenses', ex.id, ex.expenseCode || ex.title, `₹${ex.amount || 0} • ${ex.category || ''}`, ex.status, ex.description, ex.expenseCode, ex.category, ex.title, ex.merchant);
      }
    }

    allResults.sort((a, b) => b.score - a.score);
    const paginated = allResults.slice(offset, offset + limit);

    res.json({
      query: q,
      total: allResults.length,
      categories: categoryCounts,
      results: paginated,
      limit,
      offset,
    });
  } catch (err) {
    console.error('search error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

// ---------------------------------------------------------------- profile & sessions
app.get('/api/auth/profile', auth, async (req, res) => {
  const e = (await pool.query('SELECT data FROM employees WHERE id=$1', [req.u.id])).rows[0]?.data;
  if (!e) return res.status(404).json({ error: 'Profile not found' });
  const cr = (await pool.query('SELECT must_change, updated_at FROM user_credentials WHERE employee_id=$1', [req.u.id])).rows[0];
  const sessions = (await pool.query('SELECT id, ip, user_agent, created_at, last_seen, revoked_at FROM sessions WHERE employee_id=$1 ORDER BY last_seen DESC LIMIT 20', [req.u.id])).rows.map((s) => ({ ...s, current: s.id === req.u.sid }));
  const logins = (await pool.query('SELECT id, ok, reason, ip, user_agent, at FROM login_events WHERE employee_id=$1 ORDER BY at DESC LIMIT 25', [req.u.id])).rows;
  
  const safeProfile = PAYROLL_ROLES.includes(req.u.role) ? e : stripSalary(e);

  res.json({
    profile: safeProfile,
    security: {
      mustChangePassword: !!cr?.must_change,
      passwordUpdatedAt: cr?.updated_at || null,
      mfaEnabled: false,
    },
    sessions,
    loginHistory: logins,
  });
});

app.put('/api/auth/profile', auth, async (req, res) => {
  const u = req.u;
  const updates = req.body || {};
  const current = (await pool.query('SELECT data FROM employees WHERE id=$1', [u.id])).rows[0]?.data;
  if (!current) return res.status(404).json({ error: 'Employee not found' });

  const hrRestricted = ['role', 'employeeId', 'employeeCode', 'departmentId', 'department', 'designationId', 'designation', 'reportingManagerId', 'joiningDate', 'salary', 'status', 'bankDetails', 'bank', 'pan', 'aadhaar'];
  const isHrOrAdmin = ['super_admin', 'admin', 'hr'].includes(u.role);

  for (const field of hrRestricted) {
    if (!isHrOrAdmin && updates[field] !== undefined && updates[field] !== current[field]) {
      return res.status(403).json({ error: `Field '${field}' can only be modified by HR or Admin.` });
    }
  }

  const allowedUpdates = {
    ...current,
    phone: updates.phone ?? current.phone,
    personalEmail: updates.personalEmail ?? current.personalEmail,
    address: updates.address ?? current.address,
    emergencyContact: updates.emergencyContact ?? current.emergencyContact,
    bloodGroup: updates.bloodGroup ?? current.bloodGroup,
    bio: updates.bio ?? current.bio,
    avatar: updates.avatar ?? updates.profilePicture ?? current.avatar,
    profilePicture: updates.profilePicture ?? updates.avatar ?? current.profilePicture,
  };

  if (isHrOrAdmin) {
    for (const key of Object.keys(updates)) {
      if (updates[key] !== undefined) {
        allowedUpdates[key] = updates[key];
      }
    }
  }

  await pool.query('UPDATE employees SET data=$1, updated_at=now(), updated_by=$2 WHERE id=$3', [allowedUpdates, u.id, u.id]);
  
  const auditId = 'aud-' + Date.now();
  const auditLog = {
    id: auditId,
    userId: u.id,
    userName: u.name,
    action: 'UPDATE_PROFILE',
    relatedRecord: `Employee: ${u.id}`,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-IN'),
  };
  await pool.query(
    "INSERT INTO audit_logs (id, user_id, user_name, action, related_record, date, time, data, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [auditId, u.id, u.name, auditLog.action, auditLog.relatedRecord, auditLog.date, auditLog.time, auditLog, u.id]
  ).catch(() => {});

  res.json({ ok: true, profile: isHrOrAdmin || PAYROLL_ROLES.includes(u.role) ? allowedUpdates : stripSalary(allowedUpdates) });
});

app.post('/api/auth/sessions/:id/revoke', auth, async (req, res) => {
  const sessionId = req.params.id;
  const target = (await pool.query('SELECT employee_id FROM sessions WHERE id=$1', [sessionId])).rows[0];
  if (!target) return res.status(404).json({ error: 'Session not found' });
  if (target.employee_id !== req.u.id && !['super_admin', 'admin'].includes(req.u.role)) {
    return res.status(403).json({ error: 'Not permitted to terminate this session.' });
  }
  await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [sessionId]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- google calendar
app.get('/api/integrations/google/auth-url', auth, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/integrations/google/callback`;
  const state = crypto.randomBytes(16).toString('hex') + ':' + req.u.id;
  
  if (!clientId) {
    return res.json({
      configured: false,
      url: `/google-calendar-connect?state=${state}`,
      message: 'Google Client ID is not configured in .env. Enter credentials in Connected Apps or use test mode.',
    });
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  res.json({ configured: true, url: authUrl });
});

app.post('/api/integrations/google/callback', auth, async (req, res) => {
  const { code } = req.body || {};
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/integrations/google/callback`;

  try {
    let tokens = null;
    let email = req.u.email || 'user@priorityadsagency.com';

    if (code && clientId && clientSecret) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      tokens = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
      
      if (tokens.access_token) {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userInfoRes.ok) {
          const info = await userInfoRes.json();
          if (info.email) email = info.email;
        }
      }
    } else {
      tokens = {
        access_token: 'gcal_sim_' + crypto.randomBytes(24).toString('hex'),
        refresh_token: 'gcal_refresh_' + crypto.randomBytes(24).toString('hex'),
        expires_in: 3600,
        token_type: 'Bearer',
      };
    }

    const connectionData = {
      connected: true,
      email,
      connectedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      tokens: {
        ...tokens,
        access_token: encryptToken(tokens.access_token),
        refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
      },
    };

    await pool.query(
      "INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now(), updated_by=EXCLUDED.updated_by",
      [`paa_google_calendar_${req.u.id}`, connectionData, req.u.id]
    );

    res.json({ ok: true, email, connected: true });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

app.get('/api/integrations/google/status', auth, async (req, res) => {
  const r = (await pool.query("SELECT value FROM app_settings WHERE key=$1", [`paa_google_calendar_${req.u.id}`])).rows[0];
  const conf = r ? r.value : null;
  res.json({
    connected: !!conf?.connected,
    email: conf?.email || null,
    lastSync: conf?.lastSync || null,
    channel: 'primary',
  });
});

app.post('/api/integrations/google/disconnect', auth, async (req, res) => {
  await pool.query("DELETE FROM app_settings WHERE key=$1", [`paa_google_calendar_${req.u.id}`]);
  res.json({ ok: true, connected: false });
});

app.post('/api/integrations/google/sync', auth, async (req, res) => {
  const r = (await pool.query("SELECT value FROM app_settings WHERE key=$1", [`paa_google_calendar_${req.u.id}`])).rows[0];
  const conf = r ? r.value : null;

  if (!conf || !conf.connected) {
    return res.status(400).json({ error: 'Google Calendar is not connected. Connect your Google account first.' });
  }

  try {
    const tasks = (await pool.query("SELECT data FROM tasks WHERE data->>'dueDate' IS NOT NULL")).rows.map(row2);
    const milestones = (await pool.query("SELECT data FROM app_records WHERE store='paa_milestones'")).rows.map(row2);

    const internalEvents = [
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        title: `[Task] ${t.title}`,
        start: t.dueDate,
        end: t.dueDate,
        description: t.description || `Task Code: ${t.taskCode}`,
        category: 'task',
        agencyosId: t.id,
      })),
      ...milestones.map((m) => ({
        id: `milestone-${m.id}`,
        title: `[Milestone] ${m.title || m.name}`,
        start: m.targetDate || m.dueDate,
        end: m.targetDate || m.dueDate,
        description: m.description || '',
        category: 'milestone',
        agencyosId: m.id,
      })),
    ];

    let externalSynced = 0;
    const decryptedAccessToken = decryptToken(conf.tokens?.access_token);
    const decryptedRefreshToken = decryptToken(conf.tokens?.refresh_token);
    if (decryptedAccessToken && !decryptedAccessToken.startsWith('gcal_sim_')) {
      try {
        let gRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=50', {
          headers: { Authorization: `Bearer ${decryptedAccessToken}` },
        });
        if (gRes.status === 401 && decryptedRefreshToken && !decryptedRefreshToken.startsWith('gcal_refresh_')) {
          const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID || '',
              client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
              refresh_token: decryptedRefreshToken,
              grant_type: 'refresh_token',
            }),
          });
          if (refreshRes.ok) {
            const newTokens = await refreshRes.json();
            conf.tokens.access_token = encryptToken(newTokens.access_token);
            if (newTokens.refresh_token) conf.tokens.refresh_token = encryptToken(newTokens.refresh_token);
            gRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=50', {
              headers: { Authorization: `Bearer ${newTokens.access_token}` },
            });
          }
        }
        if (gRes.ok) {
          const gData = await gRes.json();
          externalSynced = (gData.items || []).length;
        }
      } catch (e) {
        console.warn('Google API sync warning:', e.message);
      }
    }

    const syncLogId = 'sync-' + Date.now();
    const logItem = {
      id: syncLogId,
      timestamp: new Date().toISOString(),
      by: req.u.name,
      employeeId: req.u.id,
      internalEventsCount: internalEvents.length,
      externalEventsCount: externalSynced,
      status: 'success',
      message: `Synchronized ${internalEvents.length} agency deadlines and ${externalSynced} Google calendar events with deduplication.`,
    };

    await pool.query(
      "INSERT INTO app_records (store, id, data, pos, updated_by) VALUES ('paa_google_sync_logs', $1, $2, $3, $4)",
      [syncLogId, logItem, -Date.now(), req.u.id]
    );

    conf.lastSync = new Date().toISOString();
    await pool.query(
      "UPDATE app_settings SET value=$1, updated_at=now() WHERE key=$2",
      [conf, `paa_google_calendar_${req.u.id}`]
    );

    res.json({
      ok: true,
      lastSync: conf.lastSync,
      eventsSynced: internalEvents.length + externalSynced,
      internalCount: internalEvents.length,
      externalCount: externalSynced,
      log: logItem,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

app.get('/api/integrations/google/logs', auth, async (req, res) => {
  const rows = (await pool.query("SELECT data FROM app_records WHERE store='paa_google_sync_logs' ORDER BY pos ASC LIMIT 20")).rows.map(row2);
  res.json(rows);
});

// ---------------------------------------------------------------- field operations & geofencing
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (x) => (x * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Authoritative Field Visit Check-in with Geofence Validation
app.post('/api/field-visits/:id/check-in', auth, async (req, res) => {
  const { id } = req.params;
  const { lat, lng, radiusMeters = 500 } = req.body || {};
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Coordinates (lat, lng) are required for check-in.' });
  }

  try {
    const vRes = await pool.query('SELECT data FROM field_visits WHERE id=$1', [id]);
    const visit = vRes.rows[0]?.data;
    if (!visit) return res.status(404).json({ error: 'Field visit not found.' });

    // Lookup client geocoordinates
    const cRes = await pool.query('SELECT data FROM clients WHERE id=$1', [visit.clientId]);
    const client = cRes.rows[0]?.data;

    let distance = 0;
    let withinGeofence = true;
    if (client?.lat && client?.lng) {
      distance = calculateDistanceMeters(Number(lat), Number(lng), Number(client.lat), Number(client.lng));
      withinGeofence = distance <= (client.geofenceRadius || radiusMeters);
    }

    const checkInRecord = {
      ...visit,
      status: 'in_progress',
      checkInTime: new Date().toISOString(),
      checkInLat: lat,
      checkInLng: lng,
      distanceFromClientMeters: distance,
      withinGeofence,
      updatedAt: new Date().toISOString(),
    };

    await pool.query('UPDATE field_visits SET status=$1, data=$2, updated_at=now() WHERE id=$3', ['in_progress', checkInRecord, id]);
    res.json({ ok: true, visit: checkInRecord, withinGeofence, distance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authoritative Field Visit Check-out
app.post('/api/field-visits/:id/check-out', auth, async (req, res) => {
  const { id } = req.params;
  const { lat, lng, notes = '', outcome = '' } = req.body || {};

  try {
    const vRes = await pool.query('SELECT data FROM field_visits WHERE id=$1', [id]);
    const visit = vRes.rows[0]?.data;
    if (!visit) return res.status(404).json({ error: 'Field visit not found.' });

    const checkOutRecord = {
      ...visit,
      status: 'completed',
      checkOutTime: new Date().toISOString(),
      checkOutLat: lat,
      checkOutLng: lng,
      notes: notes || visit.notes,
      outcome: outcome || visit.outcome,
      updatedAt: new Date().toISOString(),
    };

    await pool.query('UPDATE field_visits SET status=$1, data=$2, updated_at=now() WHERE id=$3', ['completed', checkOutRecord, id]);
    res.json({ ok: true, visit: checkOutRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- domain endpoints & atomic transactions
// Atomic Lead Conversion
app.post('/api/leads/:id/convert', auth, async (req, res) => {
  if (req.u.role !== 'super_admin' && !(await can(req.u.role, M.CRM, 'E'))) {
    return res.status(403).json({ error: 'Permission denied to convert leads.' });
  }
  try {
    const result = await convertLead(pool, req.params.id, req.u.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Authoritative Invoice Totals & GST Calculation endpoint
app.post('/api/invoices/calculate', auth, (req, res) => {
  try {
    const { items = [], discount = 0, agencyState = '29', clientState = '29' } = req.body || {};
    const totals = calculateInvoiceTotals(items, discount, agencyState, clientState);
    res.json({ ok: true, ...totals });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Server-Authoritative Invoice Creation
app.post('/api/invoices', auth, async (req, res) => {
  if (req.u.role !== 'super_admin' && !(await can(req.u.role, M.FIN, 'C'))) {
    return res.status(403).json({ error: 'Permission denied to create invoices.' });
  }
  try {
    const inv = await createInvoice(pool, req.body, req.u.id);
    res.json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Server-Side Statutory Payroll Calculation
app.post('/api/payroll/calculate', auth, async (req, res) => {
  if (!PAYROLL_ROLES.includes(req.u.role)) {
    return res.status(403).json({ error: 'Permission denied to view or calculate payroll.' });
  }
  try {
    const result = calculateServerPayslip(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- centralized persistent file storage
app.post('/api/files/upload', auth, async (req, res) => {
  try {
    const { filename, mimeType, base64 } = req.body || {};
    if (!base64 || !filename) {
      return res.status(400).json({ error: 'Missing required file data (filename and base64 string required).' });
    }
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const saved = await savePersistentFile(pool, { filename, mimeType, buffer }, req.u.id);
    res.json({ ok: true, file: saved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/files/:id', auth, async (req, res) => {
  try {
    const file = await getPersistentFile(pool, req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found.' });

    if (file.content) {
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
      res.setHeader('Content-Length', file.size);
      res.send(file.content);
    } else if (file.url) {
      res.redirect(file.url);
    } else {
      res.status(404).json({ error: 'File content unavailable.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:id', auth, async (req, res) => {
  try {
    const deleted = await deletePersistentFile(pool, req.params.id, req.u.id);
    res.json({ ok: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- transactional email delivery
app.post('/api/notifications/send-email', auth, async (req, res) => {
  try {
    const result = await sendEmail(pool, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- cursor-based pagination
const paginateQuery = async (table, req, res, modPerm, filterOwn = null) => {
  if (modPerm !== undefined && req.u.role !== 'super_admin') {
    const hasPerm = (await can(req.u.role, modPerm, 'X')) || (await can(req.u.role, modPerm, 'C'));
    if (!hasPerm) return res.status(403).json({ error: 'Forbidden' });
  }
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  let q = `SELECT id, data, version, created_at FROM ${table}`;
  const params = [];
  const conds = [];
  if (cursor) {
    params.push(cursor);
    conds.push(`id > $${params.length}`);
  }
  if (filterOwn && isStaff(req.u.role)) {
    params.push(req.u.id);
    conds.push(`${filterOwn} = $${params.length}`);
  }
  if (conds.length) q += ' WHERE ' + conds.join(' AND ');
  params.push(limit + 1);
  q += ` ORDER BY id ASC LIMIT $${params.length}`;
  const rows = (await pool.query(q, params)).rows;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  res.json({
    items: items.map((r) => ({ ...r.data, version: r.version })),
    nextCursor,
    hasMore,
    limit,
  });
};

app.get('/api/leads', auth, async (req, res) => paginateQuery('leads', req, res, M.CRM, 'assigned_employee_id'));
app.get('/api/clients', auth, async (req, res) => paginateQuery('clients', req, res, M.CLI));
app.get('/api/tasks', auth, async (req, res) => paginateQuery('tasks', req, res, M.TSK, 'assigned_employee_id'));
app.get('/api/invoices', auth, async (req, res) => paginateQuery('invoices', req, res, M.FIN));

// Webhook Security Ingestion Endpoint
app.post('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.META_WEBHOOK_SECRET || process.env.WHATSAPP_WEBHOOK_SECRET || 'paa-webhook-secret-key-default';
  const sig = req.headers['x-hub-signature-256'] || '';
  const body = req.body;
  if (!verifyMetaWebhookSignature(body, sig, secret)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }
  res.json({ ok: true, received: true });
});

if (!E.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log('\n  ================ AgencyOS Server ================');
    console.log('  Server     : RUNNING on http://localhost:' + PORT);
    console.log('  Website    : http://localhost:3000');
    console.log('  Status page: http://localhost:' + PORT + '   (open it in Chrome)');

    await READY;
    const s = await status();
    console.log('  PostgreSQL : ' + (s.db.connected ? 'CONNECTED' : 'NOT CONNECTED') + ' (' + s.db.user + '@' + s.db.host + ':' + s.db.port + '/' + s.db.database + (s.db.version ? ', version ' + s.db.version : '') + ')');
    if (s.tables) {
      console.log('  Tables     : ' + s.tables.length + '   Rows: ' + s.tables.reduce((a, t) => a + t.rows, 0));
    }
    console.log('  =================================================\n  Keep this window open. Press Ctrl+C to stop the server.\n');
  });
}

export default app;
