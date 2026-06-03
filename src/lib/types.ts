/**
 * JZ Smart Media — Operations Hub
 * Shared TypeScript types aligned with the architecture blueprint database schema.
 * These mirror the Supabase PostgreSQL enums and tables exactly.
 */

// ─────────────────────────────────────────────
// Enums (match PostgreSQL enums in migrations)
// ─────────────────────────────────────────────

export type AppRole =
  | 'owner'
  | 'project_manager'
  | 'web_developer'
  | 'seo'
  | 'ads_manager'
  | 'social_media'
  | 'account_manager'
  | 'viewer'

export type AppDepartment =
  | 'operations'
  | 'web_dev'
  | 'seo'
  | 'ads'
  | 'social'
  | 'account_management'
  | 'executive'
  | 'tracking_analytics_ai'

export type Workstream =
  | 'Sales'
  | 'Ops/PM'
  | 'AM'
  | 'Tracking'
  | 'SEO'
  | 'PPC'
  | 'Web/Dev'
  | 'Local/GBP'
  | 'Social'
  | 'VA/Vendor'

export type RaciRole = 'R' | 'A' | 'A/R' | 'C' | 'I'

export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Done'

export type ImpactLevel = 'High' | 'Medium' | 'Low'

export type ClientStatus =
  | 'Active'
  | 'Onboarding'
  | 'At Risk'
  | 'Paused'
  | 'Offboarding'

export type HealthStatus = 'Green' | 'Yellow' | 'Red'

export type MeetingType =
  | 'Kickoff'
  | 'Mid-Month Review'
  | 'End-of-Month Review'
  | 'Owner Requested'

export type MeetingStatus =
  | 'Not Scheduled'
  | 'Scheduled'
  | 'Completed'
  | 'Overdue'

export type BlockerSeverity = 'High' | 'Med' | 'Low'

export type BlockerStatus = 'Open' | 'In Progress' | 'Resolved'

export type ReportType = 'Weekly Update' | 'Monthly Report'

export type ReportStatus = 'Pending' | 'In Progress' | 'Sent'

export type SentimentEnum = 'Positive' | 'Neutral' | 'Concerned' | 'Negative'

export type EngagementEnum = 'High' | 'Medium' | 'Low' | 'Disengaged'

export type RetentionEnum = 'Strong' | 'Moderate' | 'At Risk' | 'Critical'

export type WorkloadStatus = 'Healthy' | 'Busy' | 'Overloaded'

// ─────────────────────────────────────────────
// Database Row Types
// ─────────────────────────────────────────────

export interface Profile {
  id: string
  user_id: string
  full_name: string
  department: AppDepartment | null
  is_active: boolean
  page_access: string[]
  can_create_users: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface UserRole {
  id: string
  user_id: string
  role: AppRole
}

export interface Client {
  id: string
  name: string
  status: ClientStatus
  health: HealthStatus
  start_date: string
  owner_pm: string | null
  account_manager_name: string | null
  account_manager_id: string | null
  primary_workstreams: Workstream[]
  notes: string | null
  drive_folder_url: string | null
  credentials_sheet_url: string | null
  website_url: string | null
  gbp_url: string | null
  ad_accounts_url: string | null
  facebook_url: string | null
  instagram_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  landing_pages: LandingPage[] | null
  parent_client_id: string | null
  location_name: string | null
  created_at: string
  updated_at: string
}

export interface LandingPage {
  id: string        // uuid generated client-side
  name: string      // e.g. "Homepage", "Service Page"
  url: string
  username: string | null
  password: string | null
  notes: string | null
}

export interface DeliveryTask {
  id: string
  client_id: string
  step: number
  step_name: string
  timeline: string
  workstream: Workstream
  task_name: string
  description: string | null
  status: TaskStatus
  impact_level: ImpactLevel
  ar_output_logged: boolean
  output_link: string | null
  due_date: string | null
  completed_date: string | null
  blocker_text: string | null
  recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly'
  recurrence_group_id?: string | null
  recurrence_anchor_date?: string | null
  notes?: string | null
  links?: { label: string; url: string }[]
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  // Joined fields
  task_assignments?: TaskAssignment[]
  clients?: Pick<Client, 'name'>
}

export interface TaskAssignment {
  id: string
  task_id: string
  user_id: string | null
  workstream: Workstream | null
  role_type: RaciRole
  // Joined
  profiles?: Pick<Profile, 'full_name' | 'department'>
}

export interface Blocker {
  id: string
  client_id: string
  task_id: string | null
  workstream: Workstream
  description: string
  owner_id: string | null
  severity: BlockerSeverity
  status: BlockerStatus
  due_date: string | null
  created_date: string
  resolution_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  clients?: Pick<Client, 'name'>
  profiles?: Pick<Profile, 'full_name'>
}

export interface Meeting {
  id: string
  client_id: string
  type: MeetingType
  date: string
  time: string | null
  agenda: string | null
  recap: string | null
  recap_link: string | null
  report_link: string | null
  meeting_link: string | null
  calendar_event_link: string | null
  deliverable_link: string | null
  status: MeetingStatus
  owner_approval_required: boolean
  sla_hours: number
  sla_due: string | null
  sla_met: boolean | null
  calendar_source: string | null
  notes: string | null
  attendees: string | null
  source_integration: string | null
  created_at: string
  updated_at: string
  // Joined
  clients?: Pick<Client, 'name'>
}

export interface WeeklyReview {
  id: string
  client_id: string
  week_number: number
  review_date: string
  sentiment_observed: SentimentEnum
  engagement_level: EngagementEnum
  confidence_in_retention: RetentionEnum
  hidden_risk_signals: string | null
  strategic_notes: string | null
  adjustment_score: number
  created_at: string
}

export interface Report {
  id: string
  client_id: string
  report_type: ReportType
  report_name: string
  due_date: string
  status: ReportStatus
  generated_content: Record<string, unknown> | null
  pdf_url: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
  // Joined
  clients?: Pick<Client, 'name'>
}

// ─────────────────────────────────────────────
// Computed / View Types
// ─────────────────────────────────────────────

export interface RiskScore {
  delivery: number       // 0–30: high-impact overdue task penalty
  sentiment: number      // 0–25: from latest WeeklyReview.sentiment_observed (manual)
  visibility: number     // 0–20: unlogged done tasks + missing bi-weekly meetings
  performance: number    // 0–25: task completion rate
  adjustment: number     // -10 to +20: weekly strategic adjustment (manual)
  final_score: number    // sum of all pillars; 0–25=Green, 26–45=Yellow, 46+=Red
  health: HealthStatus
}

export interface ClientHealthSnapshot {
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
  classification: 'Green' | 'Yellow' | 'Red'
  created_at: string
}

export interface TeamWorkloadRow {
  user_id: string
  full_name: string
  department: AppDepartment | null
  active_tasks: number
  due_this_week: number
  overdue_tasks: number
  blocked_tasks: number
  completed_total: number
  workload_status: WorkloadStatus
}

export interface PMDashboardMetrics {
  global_completion_pct: number
  high_impact_rate_pct: number
  overdue_all: number
  overdue_ops_pm: number
  blocked_tasks: number
}

// ─────────────────────────────────────────────
// RACI Step Definitions (static reference)
// ─────────────────────────────────────────────

export interface RaciStep {
  step: number
  name: string
  timeline: string
}

export const DELIVERY_STEPS: RaciStep[] = [
  { step: 0,  name: 'Client Signs',             timeline: 'Day 0' },
  { step: 1,  name: 'Payment + Welcome',        timeline: 'Day 1' },
  { step: 2,  name: 'Kickoff Call',             timeline: 'Day 1' },
  { step: 3,  name: 'Access & Assets',          timeline: 'Day 2' },
  { step: 4,  name: 'Tracking Verified',        timeline: 'Week 1' },
  { step: 5,  name: 'Strategy + Competitors',   timeline: 'Week 1' },
  { step: 6,  name: 'Website SEO Foundation',   timeline: 'Week 1' },
  { step: 7,  name: 'Baseline Report',          timeline: 'Week 2' },
  { step: 8,  name: 'Citations',                timeline: 'Week 3' },
  { step: 9,  name: 'City Pages',               timeline: 'Week 3' },
  { step: 10, name: 'GBP Optimization',         timeline: 'Week 3' },
  { step: 11, name: 'Reviews + Lead Platforms', timeline: 'Week 3' },
  { step: 12, name: 'CRO Improvements',         timeline: 'Week 4' },
  { step: 13, name: 'Google Ads + LSA Launch',  timeline: 'Week 4' },
  { step: 14, name: 'Social Setup + Content',   timeline: 'Week 5' },
  { step: 15, name: 'Optimization + Scale',     timeline: 'Week 6' },
]

export const WORKSTREAMS: Workstream[] = [
  'Sales', 'Ops/PM', 'AM', 'Tracking',
  'SEO', 'PPC', 'Web/Dev', 'Local/GBP', 'Social', 'VA/Vendor',
]

export const ALL_ROLES: AppRole[] = [
  'owner', 'project_manager', 'web_developer',
  'seo', 'ads_manager', 'social_media', 'account_manager', 'viewer',
]

/** Returns workload status label from active task count */
export function getWorkloadStatus(activeTasks: number): WorkloadStatus {
  if (activeTasks <= 8)  return 'Healthy'
  if (activeTasks <= 14) return 'Busy'
  return 'Overloaded'
}

/** Returns CSS class for completion percentage */
export function getCompletionClass(pct: number): string {
  if (pct >= 95) return 'completion-excellent'
  if (pct >= 90) return 'completion-very-good'
  if (pct >= 85) return 'completion-acceptable'
  return 'completion-alert'
}
