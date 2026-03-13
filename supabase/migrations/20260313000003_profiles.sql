-- Migration 3: profiles table
-- Stores extended user data linked to Supabase auth.users

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL,
  department  app_department,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_user_id_unique UNIQUE (user_id)
);

-- Index for fast lookups by user_id (used in every auth check)
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles (user_id);

-- ─── updated_at trigger (reused by all tables with updated_at) ───────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
