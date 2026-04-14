-- Migration 38: User session time tracking
-- Records when users are online/active. UI shows weekly breakdown per user.

CREATE TABLE IF NOT EXISTS user_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date    date        NOT NULL,          -- YYYY-MM-DD in EST (set by app)
  started_at      timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  -- Computed duration in minutes (updated when session ends or heartbeat fires)
  duration_minutes integer    NOT NULL DEFAULT 0
);

-- Index for the weekly report query (by user + date range)
CREATE INDEX IF NOT EXISTS user_sessions_user_date
  ON user_sessions (user_id, session_date);

-- RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can insert/update their own sessions; owners/PMs can read all
CREATE POLICY "users_own_sessions" ON user_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pm_owner_read_all_sessions" ON user_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'project_manager')
    )
  );
