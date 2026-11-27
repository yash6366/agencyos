// server/reset-admin-password.mjs
// AgencyOS Emergency Admin Credential Reset Utility
// Usage:
//   node server/reset-admin-password.mjs [new_password] [admin_email]
// Example:
//   node server/reset-admin-password.mjs Welcome@123 rajesh.sharma@priorityadsagency.com

import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const E = process.env;
const USE_SSL = /^(1|true|yes|require)$/i.test(E.DB_SSL || '') || /supabase/i.test((E.DATABASE_URL || '') + (E.DB_HOST || ''));
const SSL = USE_SSL ? { rejectUnauthorized: false } : undefined;
const DB = {
  host: E.DB_HOST || 'localhost',
  port: Number(E.DB_PORT || 5432),
  user: E.DB_USER || 'postgres',
  password: E.DB_PASSWORD || '',
  database: E.DB_NAME || 'agencyos'
};

if (!E.DATABASE_URL && !E.DB_PASSWORD) {
  console.error('Error: Database connection settings missing in .env (DATABASE_URL or DB_* credentials required).');
  process.exit(1);
}

const pool = new pg.Pool(
  E.DATABASE_URL && !E.DB_PASSWORD
    ? { connectionString: E.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, ''), ssl: SSL, max: 2 }
    : { ...DB, ssl: SSL, max: 2 }
);

const targetPassword = process.argv[2] || process.env.INITIAL_ADMIN_PASSWORD || 'Welcome@123';
const targetEmail = (process.argv[3] || process.env.INITIAL_ADMIN_EMAIL || 'rajesh.sharma@priorityadsagency.com').trim().toLowerCase();

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n[AgencyOS] Resetting Administrator Credentials...');
    
    // Find employee
    const res = await client.query(
      'SELECT id, data FROM employees WHERE lower(email)=$1 OR lower(employee_code)=$1 OR role=$2 ORDER BY pos LIMIT 1',
      [targetEmail, 'super_admin']
    );

    if (res.rows.length === 0) {
      console.error(`Error: No employee found matching "${targetEmail}" or role "super_admin".`);
      process.exit(1);
    }

    const emp = res.rows[0].data;
    const empId = res.rows[0].id;
    const email = emp.email || targetEmail;

    // Hash password
    const hash = await bcrypt.hash(targetPassword, 12);

    // Upsert into user_credentials
    await client.query(
      `INSERT INTO user_credentials (employee_id, password_hash, must_change, updated_at, updated_by)
       VALUES ($1, $2, true, now(), 'cli-reset')
       ON CONFLICT (employee_id)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change = true, updated_at = now(), updated_by = 'cli-reset'`,
      [empId, hash]
    );

    // Clear failed login attempts / lockouts
    await client.query(
      "DELETE FROM login_events WHERE employee_id=$1 AND ok=false",
      [empId]
    );

    console.log('----------------------------------------------------');
    console.log('✓ Admin credentials reset successfully!');
    console.log(`  Account Name : ${emp.name}`);
    console.log(`  Work Email   : ${email}`);
    console.log(`  Employee ID  : ${emp.employeeId || empId}`);
    console.log(`  Role         : ${emp.role}`);
    console.log(`  Password     : ${targetPassword}`);
    console.log('  Status       : Must change password upon next sign in');
    console.log('----------------------------------------------------\n');
  } catch (err) {
    console.error('Failed to reset credentials:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
