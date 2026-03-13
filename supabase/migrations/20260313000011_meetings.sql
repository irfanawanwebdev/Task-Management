-- Migration 11: meetings table + RLS
-- Exactly 2 meetings per client per month: Mid-Month (~14th) + End-of-Month (~27th).
-- SLA: recap must be filed within 24 hours of meeting completion.

CREATE TABLE IF NOT EXISTS meetings (
  id                     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              UUID            NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type                   meeting_type    NOT NULL,
  date                   DATE            NOT NULL,
  time                   TIME,
  agenda                 TEXT,
  recap                  TEXT,
  recap_link             TEXT,
  report_link            TEXT,
  meeting_link           TEXT,           -- video call URL (Zoom / Meet)
  calendar_event_link    TEXT,
  deliverable_link       TEXT,
  status                 meeting_status  NOT NULL DEFAULT 'Not Scheduled',
  owner_approval_required BOOLEAN        NOT NULL DEFAULT false,
  sla_hours              SMALLINT        NOT NULL DEFAULT 24,
  sla_due                TIMESTAMPTZ,
  sla_met                BOOLEAN,
  calendar_source        calendar_source,
  notes                  TEXT,
  created_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_client_id_idx ON meetings (client_id);
CREATE INDEX IF NOT EXISTS meetings_date_idx      ON meetings (date);
CREATE INDEX IF NOT EXISTS meetings_status_idx    ON meetings (status);

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- All authenticated: read
CREATE POLICY "meetings_select_authenticated"
  ON meetings FOR SELECT
  TO authenticated
  USING (true);

-- PM/Owner: full CRUD
CREATE POLICY "meetings_all_pm_owner"
  ON meetings FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );
