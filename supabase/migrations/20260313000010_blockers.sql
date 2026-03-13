-- Migration 10: blockers table + RLS
-- Tracks impediments to task delivery. Age > 3 days = critical highlight in UI.

CREATE TABLE IF NOT EXISTS blockers (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID            NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  task_id          UUID            REFERENCES delivery_tasks(id) ON DELETE SET NULL,
  workstream       workstream_type NOT NULL,
  description      TEXT            NOT NULL,
  owner_id         UUID            REFERENCES profiles(id) ON DELETE SET NULL,
  severity         blocker_severity NOT NULL DEFAULT 'Med',
  status           blocker_status   NOT NULL DEFAULT 'Open',
  due_date         DATE,
  created_date     DATE            NOT NULL DEFAULT CURRENT_DATE,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blockers_client_id_idx  ON blockers (client_id);
CREATE INDEX IF NOT EXISTS blockers_status_idx     ON blockers (status);
CREATE INDEX IF NOT EXISTS blockers_severity_idx   ON blockers (severity);
CREATE INDEX IF NOT EXISTS blockers_created_date_idx ON blockers (created_date);

CREATE TRIGGER blockers_updated_at
  BEFORE UPDATE ON blockers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;

-- All authenticated: read
CREATE POLICY "blockers_select_authenticated"
  ON blockers FOR SELECT
  TO authenticated
  USING (true);

-- PM/Owner: full CRUD
CREATE POLICY "blockers_all_pm_owner"
  ON blockers FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );

-- Blocker owner: can update their own blocker (add resolution notes, change status)
CREATE POLICY "blockers_update_owner"
  ON blockers FOR UPDATE
  TO authenticated
  USING (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );
