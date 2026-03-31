-- Migration 27: Add personal_task_due and task_deadline_approaching notification types
-- personal_task_due        → user's own personal task is overdue or due today/tomorrow
-- task_deadline_approaching → a company delivery task assigned to the user is due today/tomorrow

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'personal_task_due';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_deadline_approaching';
