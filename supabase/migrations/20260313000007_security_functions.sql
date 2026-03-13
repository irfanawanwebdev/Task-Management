-- Migration 7: Security-definer helper functions
-- These run with elevated privileges to safely check roles without exposing tables.

-- ─── get_user_role ───────────────────────────────────────────────────────────
-- Returns the single highest-priority role for a user.
-- Priority: owner > project_manager > account_manager > specialists > viewer

CREATE OR REPLACE FUNCTION get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'owner'           THEN 1
      WHEN 'project_manager' THEN 2
      WHEN 'account_manager' THEN 3
      WHEN 'web_developer'   THEN 4
      WHEN 'seo'             THEN 5
      WHEN 'ads_manager'     THEN 6
      WHEN 'social_media'    THEN 7
      WHEN 'viewer'          THEN 8
    END
  LIMIT 1;
$$;

-- ─── has_role ────────────────────────────────────────────────────────────────
-- Returns true if the given user holds the specified role.
-- Used in RLS policies on domain tables.

CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- ─── setup_first_admin ───────────────────────────────────────────────────────
-- One-time bootstrap: creates the first owner account.
-- Fails silently (raises exception) if any roles already exist,
-- preventing privilege escalation by later callers.

CREATE OR REPLACE FUNCTION setup_first_admin(_user_id UUID, _name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: only runs when the platform has zero roles assigned
  IF (SELECT COUNT(*) FROM user_roles) > 0 THEN
    RAISE EXCEPTION 'setup_first_admin: an admin already exists. Use /admin to manage users.';
  END IF;

  -- Upsert profile
  INSERT INTO profiles (user_id, full_name, department, is_active)
  VALUES (_user_id, _name, 'operations', true)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name  = EXCLUDED.full_name,
        updated_at = now();

  -- Assign owner + project_manager roles (owner gets PM access too)
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'project_manager')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
