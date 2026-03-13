-- Migration 6: RLS policies for profiles
-- NOTE: Runs after user_roles table (migration 4) because profiles_update_admin
-- queries user_roles directly. has_role() is not yet defined here (comes in migration 7),
-- so a raw subquery is used intentionally.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all profiles (needed for team directory, task assignments)
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile (name, department)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner/PM can update any profile (e.g. activate/deactivate)
-- Uses a direct subquery to avoid circular dependency with has_role (not yet defined)
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'project_manager')
    )
  );

-- INSERT: handled by setup_first_admin (SECURITY DEFINER) and create-user edge function
-- (service_role bypasses RLS). We also allow a user to insert their own row so the
-- AuthContext can call upsert on first login if needed.
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy — profiles are deactivated, never deleted, to preserve audit trail
