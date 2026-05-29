-- Migration 30: revert personal_tasks RLS to owner-only
--
-- Migration 29 split the policy to let assignees see tasks assigned to them.
-- This is incorrect. My Tasks is a private list for the task creator only.
-- The assignees field is a personal organizational label (Alice noting who to remind),
-- not a task-sharing mechanism. Assignees never see tasks tagged with their name.

DROP POLICY IF EXISTS "personal_tasks_select" ON personal_tasks;
DROP POLICY IF EXISTS "personal_tasks_insert" ON personal_tasks;
DROP POLICY IF EXISTS "personal_tasks_update" ON personal_tasks;
DROP POLICY IF EXISTS "personal_tasks_delete" ON personal_tasks;
DROP POLICY IF EXISTS "Users manage own personal tasks" ON personal_tasks;

-- Restore original: owner manages all their own rows, nobody else sees anything
CREATE POLICY "Users manage own personal tasks"
  ON personal_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
