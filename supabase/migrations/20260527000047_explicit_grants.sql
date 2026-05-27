-- Migration 47: Explicit table grants for Supabase Data API compatibility.
-- Required before October 30, 2026 when Supabase stops auto-exposing public
-- schema tables to PostgREST/supabase-js.
--
-- anon  role = unauthenticated visitors (login page only — read-only where needed)
-- authenticated role = any logged-in user (RLS policies still control row-level access)

-- ── Core user tables ────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE         ON TABLE public.profiles           TO authenticated;
GRANT SELECT                          ON TABLE public.profiles           TO anon;

GRANT SELECT, INSERT, DELETE          ON TABLE public.user_roles         TO authenticated;

-- ── Clients & delivery ────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.clients            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.delivery_tasks     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.task_assignments   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.blockers           TO authenticated;

-- ── Meetings, reports, reviews ───────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.meetings           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.weekly_reviews     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.reports            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.sops               TO authenticated;

-- ── Notifications ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE          ON TABLE public.notifications      TO authenticated;

-- ── Settings & connectors ─────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.connector_tokens   TO authenticated;
GRANT SELECT, INSERT, UPDATE          ON TABLE public.app_settings       TO authenticated;

-- ── Health & history ─────────────────────────────────────────────────────
GRANT SELECT, INSERT                  ON TABLE public.client_health_snapshots TO authenticated;
GRANT SELECT, INSERT                  ON TABLE public.task_edit_history  TO authenticated;

-- ── Opportunities ────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.opportunities      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.opportunity_tasks  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.opportunity_notes  TO authenticated;

-- ── Personal tasks ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.personal_tasks     TO authenticated;

-- ── Time tracking ────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE public.user_sessions      TO authenticated;

-- Note: RLS policies on every table above remain fully in force.
-- These GRANTs only allow the Data API to reach the table at all —
-- what each user can actually read/write is still controlled by RLS.
