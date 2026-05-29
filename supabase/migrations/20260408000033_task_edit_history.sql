-- Migration 33: task_edit_history
-- Tracks changes to sensitive task fields (task_name, due_date, workstream, impact_level)
-- made by any user. Only PM/Owner can view the full history log.

CREATE TABLE IF NOT EXISTS task_edit_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES delivery_tasks(id) ON DELETE CASCADE,
  changed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name  TEXT        NOT NULL,  -- 'task_name' | 'due_date' | 'workstream' | 'impact_level'
  old_value   TEXT,
  new_value   TEXT
);

CREATE INDEX IF NOT EXISTS task_edit_history_task_id_idx  ON task_edit_history (task_id);
CREATE INDEX IF NOT EXISTS task_edit_history_changed_at_idx ON task_edit_history (changed_at DESC);

ALTER TABLE task_edit_history ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own history entries
DROP POLICY IF EXISTS "task_edit_history_insert" ON task_edit_history;
CREATE POLICY "task_edit_history_insert"
  ON task_edit_history FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- PM/Owner can read all history (audit log)
DROP POLICY IF EXISTS "task_edit_history_select_pm_owner" ON task_edit_history;
CREATE POLICY "task_edit_history_select_pm_owner"
  ON task_edit_history FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );
