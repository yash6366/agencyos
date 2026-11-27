-- AgencyOS Migration 002: Extended Relational Integrity & Security Hardening
-- Adds unique constraints on employee email, foreign keys on expenses, field visits, and leads.

DO $$
BEGIN
  -- 1. Unique constraint on employees(lower(email))
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_employees_email_lower') THEN
    -- Check if duplicate emails exist before applying constraint
    IF NOT EXISTS (
      SELECT lower(email) FROM public.employees GROUP BY lower(email) HAVING count(*) > 1
    ) THEN
      -- Create unique index if constraint not directly supported on expressions
      IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_employees_email_lower_unique' AND n.nspname = 'public') THEN
        CREATE UNIQUE INDEX idx_employees_email_lower_unique ON public.employees (lower(email));
      END IF;
    END IF;
  END IF;

  -- 2. Foreign key on expenses.employee_id -> employees.id (ON DELETE SET NULL to preserve audit trail)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_employee') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
      ALTER TABLE public.expenses ADD CONSTRAINT fk_expenses_employee
        FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- 3. Foreign key on field_visits.employee_id -> employees.id (ON DELETE SET NULL)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_visits_employee') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'field_visits') THEN
      ALTER TABLE public.field_visits ADD CONSTRAINT fk_field_visits_employee
        FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- 4. Foreign key on field_visits.client_id -> clients.id (ON DELETE SET NULL)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_visits_client') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'field_visits') THEN
      ALTER TABLE public.field_visits ADD CONSTRAINT fk_field_visits_client
        FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- 5. Foreign key on leads.assigned_employee_id -> employees.id (ON DELETE SET NULL)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leads_assigned_employee') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
      ALTER TABLE public.leads ADD CONSTRAINT fk_leads_assigned_employee
        FOREIGN KEY (assigned_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: migration 002 constraint skipped: %', SQLERRM;
END $$;
