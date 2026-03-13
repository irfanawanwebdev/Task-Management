-- Migration 13: connector_tokens table + utility functions + RLS
-- connector_tokens: OAuth tokens for Google Calendar, Zoom, Calendly, Drive, Notion.
-- get_team_workload(): workload stats per user (used on PM Dashboard).
-- calculate_risk_score(): 4-pillar risk score per client (Delivery/Sentiment/Performance/Visibility).

-- ─── connector_tokens ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id  TEXT        NOT NULL,  -- 'google-calendar', 'zoom', 'calendly', 'google-drive', 'notion'
  access_token  TEXT        NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  account_email TEXT,
  last_sync     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT connector_tokens_user_connector_unique UNIQUE (user_id, connector_id)
);

CREATE INDEX IF NOT EXISTS connector_tokens_user_id_idx ON connector_tokens (user_id);

ALTER TABLE connector_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "connector_tokens_own"
  ON connector_tokens FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── get_team_workload ───────────────────────────────────────────────────────
-- Returns task counts per assigned user for the PM Dashboard workload view.

CREATE OR REPLACE FUNCTION get_team_workload()
RETURNS TABLE (
  user_id       UUID,
  full_name     TEXT,
  department    TEXT,
  total_tasks   BIGINT,
  in_progress   BIGINT,
  overdue       BIGINT,
  blocked       BIGINT,
  done_this_week BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.department::text,
    COUNT(dt.id)                                                  AS total_tasks,
    COUNT(dt.id) FILTER (WHERE dt.status = 'In Progress')         AS in_progress,
    COUNT(dt.id) FILTER (
      WHERE dt.due_date < CURRENT_DATE
        AND dt.status NOT IN ('Done')
    )                                                             AS overdue,
    COUNT(dt.id) FILTER (WHERE dt.status = 'Blocked')             AS blocked,
    COUNT(dt.id) FILTER (
      WHERE dt.status = 'Done'
        AND dt.completed_date >= date_trunc('week', CURRENT_DATE)
    )                                                             AS done_this_week
  FROM profiles p
  LEFT JOIN task_assignments ta ON ta.user_id = p.user_id
  LEFT JOIN delivery_tasks dt   ON dt.id = ta.task_id
  WHERE p.is_active = true
  GROUP BY p.user_id, p.full_name, p.department
  ORDER BY total_tasks DESC;
$$;

-- ─── calculate_risk_score ────────────────────────────────────────────────────
-- 4-pillar risk score (0–100, lower = healthier).
--
--   Delivery   (0–30): task incompletion + overdue + blocked penalties
--   Sentiment  (0–25): latest weekly_review sentiment + adjustment_score
--   Performance (0–25): placeholder — no external metrics yet, defaults to 0
--   Visibility  (0–20): meeting compliance + report delivery rate
--
--   Health thresholds:  0–25 = Green | 26–45 = Yellow | 46–100 = Red

CREATE OR REPLACE FUNCTION calculate_risk_score(_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tasks      INTEGER;
  v_done_tasks       INTEGER;
  v_overdue_tasks    INTEGER;
  v_blocked_tasks    INTEGER;
  v_delivery_score   NUMERIC;

  v_latest_sentiment TEXT;
  v_adj_score        INTEGER;
  v_sentiment_score  NUMERIC;

  v_performance_score NUMERIC := 0;

  v_meetings_expected  INTEGER;
  v_meetings_completed INTEGER;
  v_reports_total      INTEGER;
  v_reports_sent       INTEGER;
  v_visibility_score   NUMERIC;

  v_total_score      NUMERIC;
  v_health           TEXT;
BEGIN
  -- ── Delivery pillar (0–30) ──────────────────────────────────────────────
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE status = 'Done')::integer,
    COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status <> 'Done')::integer,
    COUNT(*) FILTER (WHERE status = 'Blocked')::integer
  INTO v_total_tasks, v_done_tasks, v_overdue_tasks, v_blocked_tasks
  FROM delivery_tasks
  WHERE client_id = _client_id;

  IF v_total_tasks = 0 THEN
    v_delivery_score := 0;
  ELSE
    v_delivery_score := LEAST(30,
      -- Incompletion: up to 15 pts
      (1.0 - v_done_tasks::numeric / v_total_tasks) * 15
      -- Overdue: 3 pts each, capped at 9
      + LEAST(9, v_overdue_tasks * 3)
      -- Blocked: 2 pts each, capped at 6
      + LEAST(6, v_blocked_tasks * 2)
    );
  END IF;

  -- ── Sentiment pillar (0–25) ─────────────────────────────────────────────
  SELECT sentiment_observed::text, adjustment_score
  INTO v_latest_sentiment, v_adj_score
  FROM weekly_reviews
  WHERE client_id = _client_id
  ORDER BY review_date DESC
  LIMIT 1;

  v_sentiment_score := CASE v_latest_sentiment
    WHEN 'Positive'  THEN 0
    WHEN 'Neutral'   THEN 5
    WHEN 'Concerned' THEN 15
    WHEN 'Negative'  THEN 25
    ELSE 0
  END;
  -- Apply PM adjustment (negative adj_score increases risk, positive reduces it)
  v_sentiment_score := GREATEST(0, LEAST(25, v_sentiment_score - COALESCE(v_adj_score, 0) * 0.5));

  -- ── Performance pillar (0–25) ───────────────────────────────────────────
  -- No external metrics integrated yet; PM can set manually via weekly_reviews.
  v_performance_score := 0;

  -- ── Visibility pillar (0–20) ────────────────────────────────────────────
  -- Meeting compliance: completed ÷ expected (2 per month) → up to 12 pts
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE status = 'Completed')::integer
  INTO v_meetings_expected, v_meetings_completed
  FROM meetings
  WHERE client_id = _client_id
    AND date >= date_trunc('month', CURRENT_DATE)
    AND date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  -- Reports: sent ÷ total → up to 8 pts
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE status = 'Sent')::integer
  INTO v_reports_total, v_reports_sent
  FROM reports
  WHERE client_id = _client_id
    AND due_date >= CURRENT_DATE - INTERVAL '30 days';

  v_visibility_score :=
    -- Meeting non-compliance (0–12)
    CASE WHEN v_meetings_expected = 0 THEN 0
         ELSE LEAST(12, (1.0 - v_meetings_completed::numeric / GREATEST(v_meetings_expected, 2)) * 12)
    END
    -- Report non-delivery (0–8)
    + CASE WHEN v_reports_total = 0 THEN 0
           ELSE LEAST(8, (1.0 - v_reports_sent::numeric / v_reports_total) * 8)
      END;

  -- ── Total + health ──────────────────────────────────────────────────────
  v_total_score := ROUND(v_delivery_score + v_sentiment_score + v_performance_score + v_visibility_score);

  v_health := CASE
    WHEN v_total_score <= 25 THEN 'Green'
    WHEN v_total_score <= 45 THEN 'Yellow'
    ELSE                          'Red'
  END;

  RETURN jsonb_build_object(
    'total',       v_total_score,
    'health',      v_health,
    'pillars', jsonb_build_object(
      'delivery',    ROUND(v_delivery_score),
      'sentiment',   ROUND(v_sentiment_score),
      'performance', ROUND(v_performance_score),
      'visibility',  ROUND(v_visibility_score)
    ),
    'detail', jsonb_build_object(
      'total_tasks',          v_total_tasks,
      'done_tasks',           v_done_tasks,
      'overdue_tasks',        v_overdue_tasks,
      'blocked_tasks',        v_blocked_tasks,
      'latest_sentiment',     COALESCE(v_latest_sentiment, 'None'),
      'meetings_expected',    v_meetings_expected,
      'meetings_completed',   v_meetings_completed,
      'reports_total',        v_reports_total,
      'reports_sent',         v_reports_sent
    )
  );
END;
$$;
