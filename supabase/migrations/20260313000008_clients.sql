-- Migration 8: clients table + RLS
-- Core CRM entity. Every delivery task, blocker, meeting, and report links to a client.

CREATE TABLE IF NOT EXISTS clients (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT          NOT NULL,
  status                client_status NOT NULL DEFAULT 'Onboarding',
  health                client_health NOT NULL DEFAULT 'Green',
  start_date            DATE          NOT NULL,
  owner_pm              UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  account_manager_id    UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  primary_workstreams   TEXT[]        NOT NULL DEFAULT '{}',
  notes                 TEXT,
  drive_folder_url      TEXT,
  credentials_sheet_url TEXT,
  website_url           TEXT,
  gbp_url               TEXT,
  ad_accounts_url       TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_status_idx ON clients (status);
CREATE INDEX IF NOT EXISTS clients_health_idx ON clients (health);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- PM and Owner: full access
CREATE POLICY "clients_all_pm_owner"
  ON clients FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );

-- Specialists + viewers: read-only (all clients; workstream filtering done in app layer)
CREATE POLICY "clients_select_specialists"
  ON clients FOR SELECT
  TO authenticated
  USING (true);
