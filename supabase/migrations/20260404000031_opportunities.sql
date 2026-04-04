-- ── Opportunities / Sales Pipeline ────────────────────────────────────────

-- Enums
DO $$ BEGIN
  CREATE TYPE opportunity_stage AS ENUM (
    'new_lead', 'audit', 'strategy_planning', 'proposal_creation',
    'meeting_scheduling', 'follow_ups', 'closed_won', 'closed_lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_source AS ENUM ('manual', 'website', 'referral', 'social', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE opp_task_status AS ENUM ('pending', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name  text NOT NULL,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  source         opportunity_source NOT NULL DEFAULT 'manual',
  pipeline_stage opportunity_stage  NOT NULL DEFAULT 'new_lead',
  assigned_to    uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Opportunity tasks (stage-linked)
CREATE TABLE IF NOT EXISTS opportunity_tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title          text NOT NULL,
  stage          opportunity_stage NOT NULL,
  status         opp_task_status   NOT NULL DEFAULT 'pending',
  assigned_to    uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  due_date       date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Opportunity notes / interaction history
CREATE TABLE IF NOT EXISTS opportunity_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  content        text NOT NULL,
  created_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_opportunities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS opportunities_updated_at ON opportunities;
CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_opportunities_updated_at();

-- RLS
ALTER TABLE opportunities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_tasks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_notes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opp_all_auth"       ON opportunities      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "opp_tasks_all_auth" ON opportunity_tasks  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "opp_notes_all_auth" ON opportunity_notes  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
