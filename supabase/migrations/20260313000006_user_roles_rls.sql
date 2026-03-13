-- Migration 6: RLS policies for user_roles

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read roles
-- (needed in AuthContext to load current user's roles, and in RLS policies for other tables)
CREATE POLICY "user_roles_select_authenticated"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Only owner or project_manager can assign roles
CREATE POLICY "user_roles_insert_admin"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'project_manager')
    )
  );

-- Only owner or project_manager can remove roles
CREATE POLICY "user_roles_delete_admin"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'project_manager')
    )
  );

-- Note: setup_first_admin() and the create-user edge function both use SECURITY DEFINER
-- or service_role key, so they bypass RLS entirely for the initial bootstrap.
