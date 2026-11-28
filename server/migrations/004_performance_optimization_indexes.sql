-- AgencyOS Migration 004: Performance Optimization Indexes
-- Target Database: PostgreSQL 15+ / Supabase PostgreSQL / Vercel Serverless
-- Addresses missing composite and expression indexes identified during performance audit.

DO $$
BEGIN
  -- 1. login_events: Optimize IP and employee brute force lookups in /api/auth/login
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_login_events_ip_ok_at' AND n.nspname = 'public') THEN
    CREATE INDEX idx_login_events_ip_ok_at ON public.login_events (ip, ok, at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_login_events_emp_ok_at' AND n.nspname = 'public') THEN
    CREATE INDEX idx_login_events_emp_ok_at ON public.login_events (employee_id, ok, at DESC);
  END IF;

  -- 2. sessions: Optimize session validation, expiry check and token lookup
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_sessions_emp_last_seen' AND n.nspname = 'public') THEN
    CREATE INDEX idx_sessions_emp_last_seen ON public.sessions (employee_id, last_seen DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_sessions_revoked_at' AND n.nspname = 'public') THEN
    CREATE INDEX idx_sessions_revoked_at ON public.sessions (revoked_at) WHERE revoked_at IS NULL;
  END IF;

  -- 3. employees: Fast case-insensitive lookup on email and employee_code
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_employees_lower_email' AND n.nspname = 'public') THEN
    CREATE INDEX idx_employees_lower_email ON public.employees (lower(email));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_employees_lower_code' AND n.nspname = 'public') THEN
    CREATE INDEX idx_employees_lower_code ON public.employees (lower(employee_code));
  END IF;

  -- 4. app_records: Optimize ordered scan by store and pos
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_app_records_store_pos' AND n.nspname = 'public') THEN
    CREATE INDEX idx_app_records_store_pos ON public.app_records (store, pos, updated_at);
  END IF;

  -- 5. sync_events: Optimize polling queries (id > cursor)
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_sync_events_id_by_emp' AND n.nspname = 'public') THEN
    CREATE INDEX idx_sync_events_id_by_emp ON public.sync_events (id DESC, by_employee);
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: Migration 004 index creation error: %', SQLERRM;
END $$;
