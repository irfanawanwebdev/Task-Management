-- Migration 41: Allow owner and project_manager to update/delete any user's sessions
-- Previously they could only SELECT other users' sessions, not correct them

CREATE POLICY "pm_owner_update_all_sessions" ON user_sessions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'project_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'project_manager')
    )
  );

CREATE POLICY "pm_owner_delete_all_sessions" ON user_sessions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'project_manager')
    )
  );

CREATE POLICY "pm_owner_insert_sessions" ON user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'project_manager')
    )
  );
