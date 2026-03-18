-- Migration 17: Client Health Snapshots
-- Stores computed risk score snapshots per client per week.
-- Health is derived (never manually set) from these snapshots.

CREATE TABLE IF NOT EXISTS client_health_snapshots (
  id                           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                    UUID         NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start                 DATE         NOT NULL,
  period_end                   DATE         NOT NULL,
  delivery_score               SMALLINT     NOT NULL DEFAULT 0,
  sentiment_score              SMALLINT     NOT NULL DEFAULT 0,
  performance_score            SMALLINT     NOT NULL DEFAULT 0,
  visibility_score             SMALLINT     NOT NULL DEFAULT 0,
  weekly_strategic_adjustment  SMALLINT     NOT NULL DEFAULT 0,
  final_risk_score             SMALLINT     NOT NULL DEFAULT 0,
  classification               TEXT         NOT NULL DEFAULT 'Green'
                                            CHECK (classification IN ('Green', 'Yellow', 'Red')),
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ON client_health_snapshots (client_id, period_start DESC);

ALTER TABLE client_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read snapshots"
  ON client_health_snapshots FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "pm insert snapshots"
  ON client_health_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'project_manager')
  );
