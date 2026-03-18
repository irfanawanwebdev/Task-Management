-- Migration 18: New department enum value + delivery_tasks recurrence columns

-- Add 'Tracking / Analytics / AI Integration' department
ALTER TYPE app_department ADD VALUE IF NOT EXISTS 'tracking_analytics_ai';

-- Add recurrence support to delivery_tasks
ALTER TABLE delivery_tasks
  ADD COLUMN IF NOT EXISTS recurrence             TEXT  NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'weekly', 'biweekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_group_id    UUID,
  ADD COLUMN IF NOT EXISTS recurrence_anchor_date DATE;
