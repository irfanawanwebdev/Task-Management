-- Migration 2: Custom enum types
-- All domain enums used across the JZ Operations Hub schema

-- ─── Auth / User enums ──────────────────────────────────────────────────────

CREATE TYPE app_role AS ENUM (
  'owner',
  'project_manager',
  'web_developer',
  'seo',
  'ads_manager',
  'social_media',
  'account_manager',
  'viewer'
);

CREATE TYPE app_department AS ENUM (
  'operations',
  'web_dev',
  'seo',
  'ads',
  'social',
  'account_management',
  'executive'
);

-- ─── Client enums ────────────────────────────────────────────────────────────

CREATE TYPE client_status AS ENUM (
  'Active',
  'Onboarding',
  'At Risk',
  'Paused',
  'Offboarding'
);

CREATE TYPE client_health AS ENUM (
  'Green',
  'Yellow',
  'Red'
);

-- ─── Task / RACI enums ───────────────────────────────────────────────────────

CREATE TYPE task_status AS ENUM (
  'Not Started',
  'In Progress',
  'Blocked',
  'Done'
);

CREATE TYPE impact_level AS ENUM (
  'High',
  'Medium',
  'Low'
);

CREATE TYPE raci_role_type AS ENUM (
  'R',   -- Responsible
  'A',   -- Accountable
  'C',   -- Consulted
  'I',   -- Informed
  'AR'   -- Accountable + Responsible
);

CREATE TYPE workstream_type AS ENUM (
  'Sales',
  'Ops/PM',
  'AM',
  'Tracking',
  'SEO',
  'PPC',
  'Web/Dev',
  'Local/GBP',
  'Social',
  'VA/Vendor'
);

-- ─── Blocker enums ───────────────────────────────────────────────────────────

CREATE TYPE blocker_severity AS ENUM (
  'High',
  'Med',
  'Low'
);

CREATE TYPE blocker_status AS ENUM (
  'Open',
  'In Progress',
  'Resolved'
);

-- ─── Meeting enums ───────────────────────────────────────────────────────────

CREATE TYPE meeting_type AS ENUM (
  'Kickoff',
  'Mid-Month Review',
  'End-of-Month Review',
  'Owner Requested'
);

CREATE TYPE meeting_status AS ENUM (
  'Not Scheduled',
  'Scheduled',
  'Completed',
  'Overdue'
);

CREATE TYPE calendar_source AS ENUM (
  'Google',
  'Calendly',
  'Zoom',
  'Manual'
);

-- ─── Weekly review enums ─────────────────────────────────────────────────────

CREATE TYPE sentiment_type AS ENUM (
  'Positive',
  'Neutral',
  'Concerned',
  'Negative'
);

CREATE TYPE engagement_level AS ENUM (
  'High',
  'Medium',
  'Low',
  'Disengaged'
);

CREATE TYPE retention_confidence AS ENUM (
  'Strong',
  'Moderate',
  'At Risk',
  'Critical'
);

-- ─── Report enums ────────────────────────────────────────────────────────────

CREATE TYPE report_type AS ENUM (
  'Weekly Update',
  'Monthly Report'
);

CREATE TYPE report_status AS ENUM (
  'Pending',
  'In Progress',
  'Sent'
);

-- ─── SOP enums ───────────────────────────────────────────────────────────────

CREATE TYPE sop_category AS ENUM (
  'Onboarding',
  'Local/GBP',
  'PPC/LSA',
  'Web/Dev',
  'SEO',
  'Social',
  'Reporting',
  'Operations'
);

CREATE TYPE sop_status AS ENUM (
  'Draft',
  'Active',
  'Needs Review'
);
