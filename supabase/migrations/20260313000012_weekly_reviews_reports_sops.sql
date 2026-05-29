-- Migration 12: weekly_reviews, reports, and sops tables + RLS

-- ─── weekly_reviews ──────────────────────────────────────────────────────────
-- PM logs a sentiment assessment for each client every week.
-- adjustment_score feeds into the Sentiment pillar of the 4-pillar risk score (-10 to +20).

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id                     UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              UUID                 NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_number            SMALLINT             NOT NULL,  -- ISO week number
  review_date            DATE                 NOT NULL,
  sentiment_observed     sentiment_type       NOT NULL,
  engagement_level       engagement_level     NOT NULL,
  confidence_in_retention retention_confidence NOT NULL,
  hidden_risk_signals    TEXT,
  strategic_notes        TEXT,
  adjustment_score       SMALLINT             NOT NULL DEFAULT 0
                           CHECK (adjustment_score >= -10 AND adjustment_score <= 20),
  created_at             TIMESTAMPTZ          NOT NULL DEFAULT now(),

  CONSTRAINT weekly_reviews_client_week_unique UNIQUE (client_id, week_number, review_date)
);

CREATE INDEX IF NOT EXISTS weekly_reviews_client_id_idx   ON weekly_reviews (client_id);
CREATE INDEX IF NOT EXISTS weekly_reviews_review_date_idx ON weekly_reviews (review_date);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_reviews_select_authenticated"
  ON weekly_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "weekly_reviews_all_pm_owner"
  ON weekly_reviews FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );

-- ─── reports ─────────────────────────────────────────────────────────────────
-- Weekly report every Friday; last Friday of month becomes the Monthly Report.
-- generated_content: JSONB blob with all report sections for PDF rendering.

CREATE TABLE IF NOT EXISTS reports (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_type       report_type   NOT NULL,
  report_name       TEXT          NOT NULL,
  due_date          DATE          NOT NULL,
  status            report_status NOT NULL DEFAULT 'Pending',
  generated_content JSONB,
  pdf_url           TEXT,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_client_id_idx ON reports (client_id);
CREATE INDEX IF NOT EXISTS reports_due_date_idx  ON reports (due_date);
CREATE INDEX IF NOT EXISTS reports_status_idx    ON reports (status);

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_authenticated"
  ON reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reports_all_pm_owner"
  ON reports FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );

-- ─── sops ────────────────────────────────────────────────────────────────────
-- Standard Operating Procedures: internal reference documents for the team.

CREATE TABLE IF NOT EXISTS sops (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT         NOT NULL,
  category     sop_category NOT NULL,
  workstream   workstream_type,
  owner        TEXT,               -- free-text team owner label (e.g. "Ops/PM")
  last_updated DATE,
  link         TEXT,               -- external doc URL (Google Doc, Notion, etc.)
  status       sop_status   NOT NULL DEFAULT 'Active',
  related_step SMALLINT     CHECK (related_step >= 0 AND related_step <= 15),
  notes        TEXT,
  content      TEXT[],             -- ordered checklist items
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sops_category_idx  ON sops (category);
CREATE INDEX IF NOT EXISTS sops_status_idx    ON sops (status);

CREATE TRIGGER sops_updated_at
  BEFORE UPDATE ON sops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE sops ENABLE ROW LEVEL SECURITY;

-- All authenticated can read SOPs
CREATE POLICY "sops_select_authenticated"
  ON sops FOR SELECT
  TO authenticated
  USING (true);

-- PM/Owner: full CRUD
CREATE POLICY "sops_all_pm_owner"
  ON sops FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );
