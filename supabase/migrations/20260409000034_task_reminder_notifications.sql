-- Migration 34: Per-employee task reminders (due today + overdue)
-- Adds notification type + updates cron to fire at 9 AM EST (14:00 UTC)

-- New notification type for overdue delivery tasks sent to the assigned employee
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'overdue_task_assigned';

-- Update cron: reschedule daily-reminders to 14:00 UTC (9 AM EST / 10 AM EDT)
-- This ensures employees get notified at ~9 AM Miami time year-round.
SELECT cron.unschedule('daily-reminders');

SELECT cron.schedule(
  'daily-reminders',
  '0 14 * * *',
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
