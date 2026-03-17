-- Migration 15: Add per-user page access and user creation permission to profiles
-- This enables the People-First access control system defined in the Operations Hub Manual §4–5, §7

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS page_access text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS can_create_users boolean NOT NULL DEFAULT false;

-- Grant all authenticated users read access to page_access and can_create_users
-- (existing profiles RLS policies already cover SELECT for authenticated users)

COMMENT ON COLUMN profiles.page_access IS
  'Array of page keys this user can access. Empty = use role defaults. '
  'Valid values: owner_dashboard, pm_dashboard, clients, tasks, raci, meetings, blockers, workload, instructions, admin, settings';

COMMENT ON COLUMN profiles.can_create_users IS
  'Only users with this flag = true can create new team members (Jordan, Alice, Kashif per manual §7.2)';
