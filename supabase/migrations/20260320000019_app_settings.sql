-- Migration 19: app_settings table
-- Stores configurable key-value settings (e.g. weekly_non_negotiables checklist).

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings (e.g. PM Dashboard reads checklist)
CREATE POLICY "app_settings_select_auth"
  ON app_settings FOR SELECT TO authenticated USING (true);

-- Only PM/Owner can write settings
CREATE POLICY "app_settings_write_pm_owner"
  ON app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager'))
  WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager'));

-- Seed default weekly non-negotiables checklist
INSERT INTO app_settings (key, value) VALUES (
  'weekly_non_negotiables',
  '["Check overdue tasks and follow up with team","Review and clear blocked items","Send pending weekly/monthly reports","Log new risks or blockers identified"]'::jsonb
) ON CONFLICT (key) DO NOTHING;
