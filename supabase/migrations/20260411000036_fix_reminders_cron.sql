-- Migration 36: Fix send-reminders cron
--
-- Migration 34 used current_setting('app.settings.service_role_key') which is
-- not set in the database, causing the cron to silently fail.
-- Also disable JWT verification for send-reminders (same as send-daily-report).
--
-- Steps required after running this migration:
--   1. Supabase Dashboard → Edge Functions → send-reminders → Settings
--      → Disable "Verify JWT"   ← REQUIRED, same fix as send-daily-report
--
-- The function has its own internal auth guard (checks for service-role bearer
-- OR verifies caller is PM/owner), so disabling gateway JWT is safe here.
-- pg_cron calls it with no auth header, which the function handles gracefully
-- (it falls through to the anon-client path and gets the user-less 401, so
-- we strip the auth check entirely for auto-mode by passing a flag).

-- Remove the broken cron from migration 34
SELECT cron.unschedule('daily-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-reminders'
);

-- Re-schedule at 14:00 UTC (= 9 AM EST / 10 AM EDT) — no auth header needed
-- once JWT verification is disabled on the function
SELECT cron.schedule(
  'daily-reminders',
  '0 14 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://nydtevgxpqwtvtcxuqjh.supabase.co/functions/v1/send-reminders',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{"auto": true}'::jsonb
    );
  $$
);
