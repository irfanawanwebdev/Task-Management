/**
 * database.types.ts — JZ Operations Hub
 *
 * Stub that satisfies TypeScript until the Supabase CLI generates the real types:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
 *
 * Compatible with @supabase/supabase-js v2.45+
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableDef<TRow extends Record<string, unknown>> = {
  Row: TRow
  Insert: Partial<TRow>
  Update: Partial<TRow>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<{
        id: string
        user_id: string
        full_name: string
        department: string | null
        is_active: boolean
        page_access: string[]
        can_create_users: boolean
        created_at: string
        updated_at: string
      }>
      user_roles: TableDef<{
        id: string
        user_id: string
        role: string
      }>
      clients: TableDef<{
        id: string
        name: string
        status: string
        health: string
        start_date: string
        owner_pm: string | null
        account_manager_id: string | null
        primary_workstreams: string[]
        notes: string | null
        account_manager_name: string | null
        drive_folder_url: string | null
        credentials_sheet_url: string | null
        website_url: string | null
        gbp_url: string | null
        ad_accounts_url: string | null
        created_at: string
        updated_at: string
      }>
      delivery_tasks: TableDef<{
        id: string
        client_id: string
        step: number
        step_name: string
        timeline: string
        workstream: string
        task_name: string
        description: string | null
        status: string
        impact_level: string
        ar_output_logged: boolean
        output_link: string | null
        due_date: string | null
        completed_date: string | null
        blocker_text: string | null
        recurrence: string
        recurrence_group_id: string | null
        recurrence_anchor_date: string | null
        created_at: string
        updated_at: string
      }>
      task_assignments: TableDef<{
        id: string
        task_id: string
        user_id: string | null
        workstream: string | null
        role_type: string
      }>
      blockers: TableDef<{
        id: string
        client_id: string
        task_id: string | null
        workstream: string
        description: string
        owner_id: string | null
        severity: string
        status: string
        due_date: string | null
        created_date: string
        resolution_notes: string | null
        created_at: string
        updated_at: string
      }>
      meetings: TableDef<{
        id: string
        client_id: string
        type: string
        date: string
        time: string | null
        agenda: string | null
        recap: string | null
        recap_link: string | null
        report_link: string | null
        meeting_link: string | null
        calendar_event_link: string | null
        deliverable_link: string | null
        status: string
        owner_approval_required: boolean
        sla_hours: number
        sla_due: string | null
        sla_met: boolean | null
        calendar_source: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }>
      weekly_reviews: TableDef<{
        id: string
        client_id: string
        week_number: number
        review_date: string
        sentiment_observed: string
        engagement_level: string
        confidence_in_retention: string
        hidden_risk_signals: string | null
        strategic_notes: string | null
        adjustment_score: number
        created_at: string
      }>
      reports: TableDef<{
        id: string
        client_id: string
        report_type: string
        report_name: string
        due_date: string
        status: string
        generated_content: Json | null
        pdf_url: string | null
        sent_at: string | null
        created_at: string
        updated_at: string
      }>
      client_health_snapshots: TableDef<{
        id: string
        client_id: string
        period_start: string
        period_end: string
        delivery_score: number
        sentiment_score: number
        performance_score: number
        visibility_score: number
        weekly_strategic_adjustment: number
        final_risk_score: number
        classification: string
        created_at: string
      }>
      connector_tokens: TableDef<{
        id: string
        user_id: string
        connector_id: string
        access_token: string
        refresh_token: string | null
        expires_at: string | null
        account_email: string | null
        last_sync: string | null
        created_at: string
      }>
    }
    Views: Record<string, never>
    Functions: {
      get_user_role:        { Args: { _user_id: string }; Returns: string }
      has_role:             { Args: { _user_id: string; _role: string }; Returns: boolean }
      setup_first_admin:    { Args: { _user_id: string; _name: string }; Returns: void }
      get_team_workload:    { Args: Record<string, never>; Returns: unknown[] }
      calculate_risk_score: { Args: { _client_id: string }; Returns: Json }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
