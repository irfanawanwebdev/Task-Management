-- Migration 14: notifications table + pg_cron automation jobs
-- Requires: pg_net extension (for HTTP calls from cron), pg_cron extension

-- ─── Enable required extensions ──────────────────────────────────────────────
-- pg_net and pg_cron are available on Supabase Pro plans.
-- On free tier, Edge Functions must be triggered manually or via external cron.

CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ─── notification_type enum ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'overdue_task',
    'upcoming_meeting',
    'report_due',
    'blocker_aged',
    'meeting_generated',
    'report_compiled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── notifications ────────────────────────────────────────────────────────────
-- In-app notification feed for PM/owner users.
-- Populated by the send-reminders Edge Function (daily 08:00 EST).

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT              NOT NULL,
  message     TEXT              NOT NULL,
  link        TEXT,                        -- optional deep-link path (/tasks, /meetings, etc.)
  is_read     BOOLEAN           NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx    ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role inserts (from Edge Functions using service_role key)
DROP POLICY IF EXISTS "notifications_insert_service" ON notifications;
CREATE POLICY "notifications_insert_service"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── Helper: get_pm_owner_user_ids() ─────────────────────────────────────────
-- Returns all user_ids that have PM or owner role, used by send-reminders
-- to fan-out notifications to all relevant staff.

CREATE OR REPLACE FUNCTION get_pm_owner_user_ids()
RETURNS TABLE (user_id UUID)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT DISTINCT ur.user_id
  FROM   user_roles ur
  WHERE  ur.role IN ('owner', 'project_manager');
$$;

-- ─── pg_cron jobs ─────────────────────────────────────────────────────────────
-- These require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set as
-- app.settings in the Supabase dashboard (Settings → Database → App settings).
--
-- Enable via Supabase dashboard: Settings → Extensions → pg_cron
-- Then run this migration. The cron user requires the pg_cron extension to
-- be in the search_path for net.http_post to resolve.

-- Daily 08:00 EST (13:00 UTC): send-reminders
SELECT cron.schedule(
  'daily-reminders',
  '0 13 * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.settings.supabase_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- 1st of each month 07:00 EST (12:00 UTC): generate-meetings for new month
SELECT cron.schedule(
  'monthly-generate-meetings',
  '0 12 1 * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.settings.supabase_url') || '/functions/v1/generate-meetings',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Every Friday 09:00 EST (14:00 UTC): compile weekly reports for each active client
SELECT cron.schedule(
  'weekly-compile-reports',
  '0 14 * * 5',
  $$
    SELECT net.http_post(
      url     := current_setting('app.settings.supabase_url') || '/functions/v1/compile-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body    := '{"batch": true}'::jsonb
    );
  $$
);
