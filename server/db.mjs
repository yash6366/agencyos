// server/db.mjs
// Centralized Authoritative PostgreSQL Client & Connection Pool for AgencyOS
// Implements enterprise connection pooling, serverless detection, SSL handling, and health diagnostics.

import 'dotenv/config';
import pg from 'pg';

const E = process.env;

export const DB_CONFIG = {
  host: E.DB_HOST || 'localhost',
  port: Number(E.DB_PORT || 5432),
  user: E.DB_USER || 'postgres',
  password: E.DB_PASSWORD || '',
  database: E.DB_NAME || 'agencyos',
};

export const IS_VERCEL = Boolean(E.VERCEL);
export const USE_SSL = /^(1|true|yes|require)$/i.test(E.DB_SSL || '') || /supabase/i.test((E.DATABASE_URL || '') + (E.DB_HOST || ''));
export const SSL = USE_SSL ? { rejectUnauthorized: false } : undefined;

const poolConfig = E.DATABASE_URL && !E.DB_PASSWORD
  ? { connectionString: E.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, ''), ssl: SSL, max: IS_VERCEL ? 2 : 10 }
  : { ...DB_CONFIG, ssl: SSL, max: IS_VERCEL ? 2 : 10 };

export const pool = new pg.Pool({
  ...poolConfig,
  idleTimeoutMillis: IS_VERCEL ? 1000 : 30000,
  connectionTimeoutMillis: IS_VERCEL ? 4000 : 10000,
});

// Resilient error handling preventing uncaught exception crashes on dropped idle sockets
pool.on('error', (err) => {
  console.warn('[AgencyOS Database Pool Notice]:', err.message);
});

/**
 * Diagnostic utility returning masked connection metadata
 */
export function getDbDiagnostics() {
  if (E.DATABASE_URL && !E.DB_PASSWORD) {
    try {
      const u = new URL(E.DATABASE_URL);
      return {
        configured: true,
        host: u.hostname,
        port: u.port || '5432',
        database: u.pathname.slice(1),
        user: decodeURIComponent(u.username),
        ssl: Boolean(SSL),
        isServerless: IS_VERCEL,
      };
    } catch {
      return { configured: false, error: 'Malformed DATABASE_URL' };
    }
  }
  return {
    configured: Boolean(DB_CONFIG.host && DB_CONFIG.database),
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
    user: DB_CONFIG.user,
    ssl: Boolean(SSL),
    isServerless: IS_VERCEL,
  };
}

/**
 * Health check querying the database
 */
export async function testDbConnection() {
  try {
    const res = await pool.query('SELECT 1 as healthy, current_database(), current_user, version()');
    return {
      ok: true,
      data: res.rows[0],
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
    };
  }
}
