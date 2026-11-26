-- AgencyOS Migration 001: Relational Integrity, Foreign Keys, Unique Business Numbers, Check Constraints, and OCC Versioning
-- Target Database: PostgreSQL 15+ / Supabase PostgreSQL

-- 1. Optimistic Concurrency Control (OCC) - Add version column to all relational tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'departments', 'designations', 'employees', 'user_credentials', 'sessions',
    'clients', 'leads', 'projects', 'tasks', 'quotations', 'agreements',
    'invoices', 'payments', 'attendance', 'attendance_regularizations',
    'daily_activities', 'field_visits', 'reimbursements', 'expenses',
    'payslips', 'leave_requests', 'leave_balances', 'notifications',
    'app_records', 'app_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;', tbl);
    END IF;
  END LOOP;
END $$;

-- 2. Unique Business Codes & Number Constraints
DO $$
BEGIN
  -- departments(name)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_name_key') THEN
    ALTER TABLE public.departments ADD CONSTRAINT departments_name_key UNIQUE (name);
  END IF;

  -- employees(employee_code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_code_key') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_code_key UNIQUE (employee_code);
  END IF;

  -- clients(client_code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_code_key') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_code_key UNIQUE (client_code);
  END IF;

  -- leads(lead_code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_code_key') THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_code_key UNIQUE (lead_code);
  END IF;

  -- projects(project_code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_code_key') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_code_key UNIQUE (project_code);
  END IF;

  -- tasks(task_code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_code_key') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_code_key UNIQUE (task_code);
  END IF;

  -- quotations(number)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_number_key') THEN
    ALTER TABLE public.quotations ADD CONSTRAINT quotations_number_key UNIQUE (number);
  END IF;

  -- agreements(number)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agreements_number_key') THEN
    ALTER TABLE public.agreements ADD CONSTRAINT agreements_number_key UNIQUE (number);
  END IF;

  -- invoices(number)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_number_key') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_number_key UNIQUE (number);
  END IF;

  -- payments(code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_code_key') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_code_key UNIQUE (code);
  END IF;

  -- expenses(code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_code_key') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_code_key UNIQUE (code);
  END IF;

  -- reimbursements(code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reimbursements_code_key') THEN
    ALTER TABLE public.reimbursements ADD CONSTRAINT reimbursements_code_key UNIQUE (code);
  END IF;

  -- payslips(number)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payslips_number_key') THEN
    ALTER TABLE public.payslips ADD CONSTRAINT payslips_number_key UNIQUE (number);
  END IF;

  -- leave_requests(code)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_code_key') THEN
    ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_code_key UNIQUE (code);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: unique constraint check skipped: %', SQLERRM;
END $$;

-- 3. Check Constraints for Financial & Quantitative Integrity
DO $$
BEGIN
  -- invoices: total >= 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_total') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT chk_invoices_total CHECK (total >= 0);
  END IF;

  -- invoices: balance >= 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_balance') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT chk_invoices_balance CHECK (balance >= 0);
  END IF;

  -- quotations: total >= 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotations_total') THEN
    ALTER TABLE public.quotations ADD CONSTRAINT chk_quotations_total CHECK (total >= 0);
  END IF;

  -- payments: amount > 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_amount') THEN
    ALTER TABLE public.payments ADD CONSTRAINT chk_payments_amount CHECK (amount > 0);
  END IF;

  -- expenses: amount >= 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_expenses_amount') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT chk_expenses_amount CHECK (amount >= 0);
  END IF;

  -- reimbursements: amount > 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reimbursements_amount') THEN
    ALTER TABLE public.reimbursements ADD CONSTRAINT chk_reimbursements_amount CHECK (amount > 0);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: check constraint skipped: %', SQLERRM;
END $$;

-- 4. Foreign Key Constraints & Cascade/Restrict Rules
DO $$
BEGIN
  -- designations -> departments
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_designations_department') THEN
    ALTER TABLE public.designations ADD CONSTRAINT fk_designations_department 
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;

  -- user_credentials -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_credentials_employee') THEN
    ALTER TABLE public.user_credentials ADD CONSTRAINT fk_credentials_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- sessions -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sessions_employee') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT fk_sessions_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- attendance -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_employee') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT fk_attendance_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- attendance_regularizations -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_regularizations_employee') THEN
    ALTER TABLE public.attendance_regularizations ADD CONSTRAINT fk_regularizations_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- daily_activities -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_daily_activities_employee') THEN
    ALTER TABLE public.daily_activities ADD CONSTRAINT fk_daily_activities_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- leave_requests -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leave_requests_employee') THEN
    ALTER TABLE public.leave_requests ADD CONSTRAINT fk_leave_requests_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- leave_balances -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leave_balances_employee') THEN
    ALTER TABLE public.leave_balances ADD CONSTRAINT fk_leave_balances_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- reimbursements -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reimbursements_employee') THEN
    ALTER TABLE public.reimbursements ADD CONSTRAINT fk_reimbursements_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- projects -> clients (RESTRICT delete on client if active project exists)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_client') THEN
    ALTER TABLE public.projects ADD CONSTRAINT fk_projects_client 
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
  END IF;

  -- projects -> employees (project manager)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_manager') THEN
    ALTER TABLE public.projects ADD CONSTRAINT fk_projects_manager 
      FOREIGN KEY (project_manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;

  -- tasks -> projects (CASCADE delete on project)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_project') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_project 
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;

  -- tasks -> employees (assigned assignee)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_employee') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_employee 
      FOREIGN KEY (assigned_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;

  -- quotations -> clients
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_quotations_client') THEN
    ALTER TABLE public.quotations ADD CONSTRAINT fk_quotations_client 
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
  END IF;

  -- agreements -> clients
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_agreements_client') THEN
    ALTER TABLE public.agreements ADD CONSTRAINT fk_agreements_client 
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
  END IF;

  -- invoices -> clients
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_client') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT fk_invoices_client 
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
  END IF;

  -- payments -> invoices
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_invoice') THEN
    ALTER TABLE public.payments ADD CONSTRAINT fk_payments_invoice 
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;
  END IF;

  -- payslips -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payslips_employee') THEN
    ALTER TABLE public.payslips ADD CONSTRAINT fk_payslips_employee 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;
  END IF;

  -- notifications -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_user 
      FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: foreign key constraint skipped: %', SQLERRM;
END $$;
