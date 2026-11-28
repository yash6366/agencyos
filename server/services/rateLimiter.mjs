// server/services/rateLimiter.mjs
// Distributed & Multi-Instance Rate Limiter for AgencyOS
// Supports both PostgreSQL distributed backing (multi-instance/serverless) and in-memory cache fallback.

import crypto from 'crypto';

/**
 * Extracts and sanitizes the true client IP from standard reverse proxy headers
 * @param {import('express').Request} req
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    // Only trust the leftmost IP if proxy count is controlled, or fallback to direct remoteAddress
    const ips = forwarded.split(',').map((s) => s.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

const memoryFallback = new Map();

/**
 * Creates an Express middleware for rate limiting backed by PostgreSQL (or memory fallback)
 * @param {import('pg').Pool} pool
 * @param {object} options
 * @param {number} [options.limit=120] Max requests allowed per window
 * @param {number} [options.windowMs=60000] Sliding window in milliseconds
 * @param {string} [options.prefix='api'] Metric key prefix
 */
export function createDistributedRateLimiter(pool, options = {}) {
  const limit = options.limit || 120;
  const windowMs = options.windowMs || 60000;
  const prefix = options.prefix || 'api';

  return async (req, res, next) => {
    const ip = getClientIp(req);
    const key = `${prefix}:${ip}:${req.path}`;
    const now = Date.now();
    const windowStart = new Date(now - windowMs);

    let count = 0;
    let resetTime = Math.ceil((now + windowMs) / 1000);

    try {
      if (pool) {
        // Distributed counter in PostgreSQL: ensure table exists (idempotent)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS public.rate_limit_events (
            id bigserial PRIMARY KEY,
            key text NOT NULL,
            at timestamptz NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS rate_limit_events_key_at_idx ON public.rate_limit_events (key, at);
        `).catch(() => {});

        // Insert event and count in window
        const [insertRes, countRes] = await Promise.all([
          pool.query('INSERT INTO public.rate_limit_events (key, at) VALUES ($1, now())', [key]).catch(() => {}),
          pool.query('SELECT count(*)::int n FROM public.rate_limit_events WHERE key=$1 AND at > $2', [key, windowStart]),
        ]);

        count = countRes?.rows[0]?.n || 1;

        // Opportunistic asynchronous cleanup of old events (older than 10 minutes)
        if (Math.random() < 0.05) {
          pool.query("DELETE FROM public.rate_limit_events WHERE at < now() - interval '10 minutes'").catch(() => {});
        }
      } else {
        throw new Error('Pool unavailable');
      }
    } catch {
      // Memory fallback if DB is temporarily unreachable or during early boot
      const mem = memoryFallback.get(key) || { count: 0, resetAt: now + windowMs };
      if (now > mem.resetAt) {
        mem.count = 0;
        mem.resetAt = now + windowMs;
      }
      mem.count++;
      memoryFallback.set(key, mem);
      count = mem.count;
      resetTime = Math.ceil(mem.resetAt / 1000);
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (count > limit) {
      return res.status(429).json({
        error: 'Too many requests. Please slow down and try again later.',
        retryAfter: resetTime,
      });
    }

    next();
  };
}
