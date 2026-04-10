-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 35: Schedule automated daily task report email at midnight Miami
--
-- Midnight Miami (EST) = 05:00 UTC  (06:00 UTC in summer EDT, ~1hr drift)
-- The edge function fetches yesterday's completed tasks and emails Jordan.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove any existing schedule with this name (safe to re-run)
SELECT cron.unschedule('daily-task-report-midnight') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-task-report-midnight'
);

-- Schedule at 05:00 UTC daily (= midnight EST / 00:00 Miami)
SELECT cron.schedule(
  'daily-task-report-midnight',
  '0 5 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://nydtevgxpqwtvtcxuqjh.supabase.co/functions/v1/send-daily-report',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{"auto": true}'::jsonb
    );
  $$
);
