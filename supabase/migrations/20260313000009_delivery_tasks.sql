-- Migration 9: delivery_tasks + task_assignments tables + RLS
-- delivery_tasks: the 16-step client lifecycle tasks (Steps 0–15).
-- task_assignments: RACI role assignments per task (R/A/C/I).

-- ─── delivery_tasks ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_tasks (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  step             SMALLINT      NOT NULL CHECK (step >= 0 AND step <= 15),
  step_name        TEXT          NOT NULL,
  timeline         TEXT          NOT NULL,  -- e.g. "Day 0", "Week 1", "Week 2+", "Ongoing"
  workstream       workstream_type NOT NULL,
  task_name        TEXT          NOT NULL,
  description      TEXT,
  status           task_status   NOT NULL DEFAULT 'Not Started',
  impact_level     impact_level  NOT NULL DEFAULT 'Medium',
  ar_output_logged BOOLEAN       NOT NULL DEFAULT false,  -- QA Gate
  output_link      TEXT,
  due_date         DATE,
  completed_date   DATE,
  blocker_text     TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_tasks_client_id_idx  ON delivery_tasks (client_id);
CREATE INDEX IF NOT EXISTS delivery_tasks_status_idx     ON delivery_tasks (status);
CREATE INDEX IF NOT EXISTS delivery_tasks_step_idx       ON delivery_tasks (step);
CREATE INDEX IF NOT EXISTS delivery_tasks_workstream_idx ON delivery_tasks (workstream);
CREATE INDEX IF NOT EXISTS delivery_tasks_due_date_idx   ON delivery_tasks (due_date);

CREATE TRIGGER delivery_tasks_updated_at
  BEFORE UPDATE ON delivery_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── task_assignments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_assignments (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID           NOT NULL REFERENCES delivery_tasks(id) ON DELETE CASCADE,
  user_id    UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
  workstream workstream_type,
  role_type  raci_role_type NOT NULL,

  -- A task can assign a specific user OR a workstream (team), not necessarily both
  CONSTRAINT task_assignments_target_check
    CHECK (user_id IS NOT NULL OR workstream IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS task_assignments_task_id_idx  ON task_assignments (task_id);
CREATE INDEX IF NOT EXISTS task_assignments_user_id_idx  ON task_assignments (user_id);

-- ─── RLS: delivery_tasks ─────────────────────────────────────────────────────

ALTER TABLE delivery_tasks ENABLE ROW LEVEL SECURITY;

-- PM/Owner: full CRUD
CREATE POLICY "delivery_tasks_all_pm_owner"
  ON delivery_tasks FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );

-- All authenticated: read
CREATE POLICY "delivery_tasks_select_authenticated"
  ON delivery_tasks FOR SELECT
  TO authenticated
  USING (true);

-- Specialists: can update tasks where they are assigned (to mark status, log output)
CREATE POLICY "delivery_tasks_update_assigned"
  ON delivery_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.task_id = delivery_tasks.id
        AND ta.user_id = auth.uid()
    )
  );

-- ─── RLS: task_assignments ───────────────────────────────────────────────────

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- All authenticated: read
CREATE POLICY "task_assignments_select_authenticated"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (true);

-- PM/Owner: full CRUD
CREATE POLICY "task_assignments_all_pm_owner"
  ON task_assignments FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );
