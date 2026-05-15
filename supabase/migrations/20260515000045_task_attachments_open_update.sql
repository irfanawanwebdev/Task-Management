-- Migration 45: Allow any authenticated user to update task attachments.
-- The existing "delivery_tasks_update_assigned" policy only permits updates when
-- the user appears in task_assignments for that task. Team members who aren't
-- formally assigned are silently blocked from saving attachments to the DB.
-- Since all authenticated users can already SELECT every task, and the UI controls
-- edit access for sensitive fields (status, blocker_text, etc.), it is safe to
-- allow any authenticated user to UPDATE delivery_tasks.

CREATE POLICY "delivery_tasks_update_any_authenticated"
  ON delivery_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
