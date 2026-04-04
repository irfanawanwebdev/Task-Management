// ── Opportunity domain types ───────────────────────────────────────────────

export type OpportunityStage =
  | 'new_lead' | 'audit' | 'strategy_planning' | 'proposal_creation'
  | 'meeting_scheduling' | 'follow_ups' | 'closed_won' | 'closed_lost'

export type OpportunitySource = 'manual' | 'website' | 'referral' | 'social' | 'other'

export type OppTaskStatus = 'pending' | 'in_progress' | 'done'

export interface Opportunity {
  id: string
  business_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  source: OpportunitySource
  pipeline_stage: OpportunityStage
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  assignee?: { full_name: string } | null
  // aggregates (loaded separately)
  task_total?: number
  task_done?: number
}

export interface OppTask {
  id: string
  opportunity_id: string
  title: string
  stage: OpportunityStage
  status: OppTaskStatus
  assigned_to: string | null
  due_date: string | null
  notes: string | null
  created_at: string
}

export interface OppNote {
  id: string
  opportunity_id: string
  content: string
  created_by: string | null
  created_at: string
  author?: { full_name: string } | null
}

// ── Pipeline stage config ──────────────────────────────────────────────────

export const STAGE_LIST: {
  key: OpportunityStage
  label: string
  badgeCls: string
  colCls: string
  dot: string
}[] = [
  { key: 'new_lead',           label: 'New Lead',           badgeCls: 'bg-blue-500/20 text-blue-400',    colCls: 'border-blue-500/30',    dot: 'bg-blue-400' },
  { key: 'audit',              label: 'Audit',              badgeCls: 'bg-purple-500/20 text-purple-400', colCls: 'border-purple-500/30',  dot: 'bg-purple-400' },
  { key: 'strategy_planning',  label: 'Strategy Planning',  badgeCls: 'bg-indigo-500/20 text-indigo-400', colCls: 'border-indigo-500/30',  dot: 'bg-indigo-400' },
  { key: 'proposal_creation',  label: 'Proposal Creation',  badgeCls: 'bg-amber-500/20 text-amber-400',   colCls: 'border-amber-500/30',   dot: 'bg-amber-400' },
  { key: 'meeting_scheduling', label: 'Meeting Scheduling', badgeCls: 'bg-orange-500/20 text-orange-400', colCls: 'border-orange-500/30',  dot: 'bg-orange-400' },
  { key: 'follow_ups',         label: 'Follow-ups',         badgeCls: 'bg-yellow-500/20 text-yellow-400', colCls: 'border-yellow-500/30',  dot: 'bg-yellow-400' },
  { key: 'closed_won',         label: 'Closed Won',         badgeCls: 'bg-green-500/20 text-green-400',   colCls: 'border-green-500/30',   dot: 'bg-green-400' },
  { key: 'closed_lost',        label: 'Closed Lost',        badgeCls: 'bg-red-500/20 text-red-400',       colCls: 'border-red-500/30',     dot: 'bg-red-400' },
]

export const STAGE_LABELS: Record<OpportunityStage, string> = Object.fromEntries(
  STAGE_LIST.map(s => [s.key, s.label])
) as Record<OpportunityStage, string>

/** Tasks auto-created when an opportunity enters this stage */
export const STAGE_TASKS: Record<OpportunityStage, string[]> = {
  new_lead: [],
  audit: [
    'SEO competitor analysis',
    'CRM analysis',
    'Ads analysis',
  ],
  strategy_planning: ['Build strategy plan based on audit findings'],
  proposal_creation: ['Create pricing & scope proposal'],
  meeting_scheduling: ['Schedule presentation / pitch meeting'],
  follow_ups: ['Send follow-up #1 (message / call)'],
  closed_won: [],
  closed_lost: [],
}

export const SOURCE_LABELS: Record<OpportunitySource, string> = {
  manual:   'Manual',
  website:  'Website',
  referral: 'Referral',
  social:   'Social',
  other:    'Other',
}

export const SOURCE_BADGE: Record<OpportunitySource, string> = {
  manual:   'bg-muted text-muted-foreground',
  website:  'bg-blue-500/15 text-blue-400',
  referral: 'bg-green-500/15 text-green-400',
  social:   'bg-purple-500/15 text-purple-400',
  other:    'bg-muted text-muted-foreground',
}
