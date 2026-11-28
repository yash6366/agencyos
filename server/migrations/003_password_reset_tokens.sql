-- server/migrations/003_password_reset_tokens.sql
-- Migration: Create password reset tokens table with hashed single-use tokens and expiration

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id bigserial PRIMARY KEY,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by_ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_employee_id_idx ON public.password_reset_tokens (employee_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON public.password_reset_tokens (token_hash);
