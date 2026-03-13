/**
 * Client Detail Page — JZ Operations Hub
 * Complete client hub with 8-tab interface:
 * Onboarding / Overdue / Blockers / Credentials / Reports / Meetings / Upsell / Risk Log
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Loader2, CheckCircle2, AlertTriangle,
  Calendar, KeyRound, FileText, Star, BarChart2, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type {
  Client, DeliveryTask, Blocker, Meeting, Report, WeeklyReview,
} from '@/lib/types'
import { isOverdueEST, formatDateEST, daysAgoEST } from '@/lib/timezone'
import { getCompletionClass } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Data Hook ────────────────────────────────────────────────────────────────

function useClientDetail(id: string) {
  return useQuery({
    queryKey: ['client-detail', id],
    queryFn: async () => {
      const [clientRes, tasksRes, blockersRes, meetingsRes, reportsRes, reviewsRes] =
        await Promise.all([
          supabase.from('clients').select('*').eq('id', id).single(),
          supabase.from('delivery_tasks').select('*, task_assignments(*)').eq('client_id', id).order('step'),
          supabase.from('blockers').select('*, profiles(full_name)').eq('client_id', id).order('created_date'),
          supabase.from('meetings').select('*').eq('client_id', id).order('date', { ascending: false }),
          supabase.from('reports').select('*').eq('client_id', id).order('due_date', { ascending: false }),
          supabase.from('weekly_reviews').select('*').eq('client_id', id).order('review_date', { ascending: false }).limit(10),
        ])

      if (clientRes.error) throw clientRes.error

      return {
        client:   clientRes.data as Client,
        tasks:    (tasksRes.data    ?? []) as unknown as DeliveryTask[],
        blockers: (blockersRes.data ?? []) as unknown as Blocker[],
        meetings: (meetingsRes.data ?? []) as unknown as Meeting[],
        reports:  (reportsRes.data  ?? []) as unknown as Report[],
        reviews:  (reviewsRes.data  ?? []) as WeeklyReview[],
      }
    },
  })
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'onboarding', label: 'Onboarding', icon: CheckCircle2 },
  { id: 'overdue',    label: 'Overdue',    icon: AlertTriangle },
  { id: 'blockers',   label: 'Blockers',   icon: AlertTriangle },
  { id: 'credentials',label: 'Credentials',icon: KeyRound },
  { id: 'reports',    label: 'Reports',    icon: FileText },
  { id: 'meetings',   label: 'Meetings',   icon: Calendar },
  { id: 'upsell',     label: 'Upsell',     icon: Star },
  { id: 'risk',       label: 'Risk Log',   icon: BarChart2 },
] as const

type TabId = typeof TABS[number]['id']

// ─── Onboarding Tab ───────────────────────────────────────────────────────────

function OnboardingTab({ tasks }: { tasks: DeliveryTask[] }) {
  const onboardingTasks = tasks.filter(t => t.step <= 3)
  return (
    <div className="space-y-2">
      {onboardingTasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No onboarding tasks.</p>
      )}
      {onboardingTasks.map(t => (
        <div key={t.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
          <div className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
            t.status === 'Done' ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' :
            t.status === 'In Progress' ? 'bg-info/20 text-info' :
            t.status === 'Blocked' ? 'bg-destructive/20 text-destructive' :
            'bg-muted text-muted-foreground'
          )}>
            {t.step}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t.step_name}</p>
            <p className="text-xs text-muted-foreground">{t.workstream} · {t.timeline}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {t.ar_output_logged && (
              <span className="text-xs text-[hsl(var(--success))]">✓ A/R logged</span>
            )}
            <span className={cn(
              t.status === 'Done' ? 'status-done' :
              t.status === 'In Progress' ? 'status-in-progress' :
              t.status === 'Blocked' ? 'status-blocked' : 'status-not-started'
            )}>
              {t.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Overdue Tab ──────────────────────────────────────────────────────────────

function OverdueTab({ tasks }: { tasks: DeliveryTask[] }) {
  const overdue = tasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done')
  return (
    <div className="space-y-2">
      {overdue.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))] mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No overdue tasks. Great work!</p>
        </div>
      ) : (
        overdue.map(t => (
          <div key={t.id} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t.task_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.workstream} · Step {t.step}</p>
              </div>
              <span className="text-xs text-destructive font-medium shrink-0">
                Due {t.due_date && formatDateEST(t.due_date)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Blockers Tab ─────────────────────────────────────────────────────────────

function BlockersTab({ blockers }: { blockers: Blocker[] }) {
  const open = blockers.filter(b => b.status !== 'Resolved')
  return (
    <div className="space-y-2">
      {open.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))] mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No active blockers.</p>
        </div>
      ) : (
        open.map(b => {
          const age = daysAgoEST(b.created_date)
          return (
            <div key={b.id} className={cn(
              'p-3 rounded-lg border',
              age > 3 ? 'bg-destructive/5 border-destructive/30' : 'bg-card border-border'
            )}>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={b.severity === 'High' ? 'severity-high' : b.severity === 'Med' ? 'severity-med' : 'severity-low'}>
                  {b.severity}
                </span>
                <span className={b.status === 'Open' ? 'status-blocked' : 'status-in-progress'}>
                  {b.status}
                </span>
                <span className={age > 3 ? 'aging-critical' : 'aging-normal'}>{age}d</span>
              </div>
              <p className="text-sm">{b.description}</p>
              {b.profiles && (
                <p className="text-xs text-muted-foreground mt-1">Owner: {b.profiles.full_name}</p>
              )}
              {b.resolution_notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{b.resolution_notes}</p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Credentials Tab ─────────────────────────────────────────────────────────

function CredentialsTab({ client }: { client: Client }) {
  return (
    <div className="space-y-3">
      {client.credentials_sheet_url ? (
        <a
          href={client.credentials_sheet_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <KeyRound className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Open Credentials Sheet</p>
            <p className="text-xs text-muted-foreground">Google Sheets · Client credentials</p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">No credentials sheet linked.</p>
      )}
      {client.drive_folder_url && (
        <a
          href={client.drive_folder_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Open Google Drive Folder</p>
            <p className="text-xs text-muted-foreground">Client files and documents</p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
        </a>
      )}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ reports }: { reports: Report[] }) {
  return (
    <div className="space-y-2">
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports yet.</p>
      ) : (
        reports.map(r => (
          <div key={r.id} className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{r.report_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.report_type} · Due {formatDateEST(r.due_date)}</p>
              </div>
              <span className={cn(
                r.status === 'Sent' ? 'status-done' :
                r.status === 'In Progress' ? 'status-in-progress' :
                'status-not-started'
              )}>
                {r.status}
              </span>
            </div>
            {r.sent_at && (
              <p className="text-xs text-muted-foreground mt-1">Sent {formatDateEST(r.sent_at)}</p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Meetings Tab ─────────────────────────────────────────────────────────────

function MeetingsTab({ meetings }: { meetings: Meeting[] }) {
  return (
    <div className="space-y-2">
      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meetings yet.</p>
      ) : (
        meetings.map(m => (
          <div key={m.id} className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium">{m.type}</p>
              <span className={cn(
                m.status === 'Completed' ? 'status-done' :
                m.status === 'Scheduled' ? 'status-in-progress' :
                m.status === 'Overdue' ? 'status-blocked' : 'status-not-started'
              )}>
                {m.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateEST(m.date)}</p>
            <div className="flex gap-3 mt-2 flex-wrap">
              {m.meeting_link && (
                <a href={m.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">Meeting Link</a>
              )}
              {m.recap_link && (
                <a href={m.recap_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">Recap</a>
              )}
              {m.report_link && (
                <a href={m.report_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">Report</a>
              )}
            </div>
            {m.sla_due && (
              <p className="text-xs text-muted-foreground mt-1">
                Recap SLA: {formatDateEST(m.sla_due)}
                {m.sla_met === true && <span className="text-[hsl(var(--success))] ml-1">✓ Met</span>}
                {m.sla_met === false && <span className="text-destructive ml-1">✗ Missed</span>}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Upsell Tab ───────────────────────────────────────────────────────────────

function UpsellTab({ client, tasks }: { client: Client; tasks: DeliveryTask[] }) {
  const allWorkstreams = ['SEO', 'PPC', 'Web/Dev', 'Local/GBP', 'Social'] as const
  const active = new Set(client.primary_workstreams)
  const withDue = tasks.filter(t => t.due_date)
  const done = withDue.filter(t => t.status === 'Done').length
  const completion = withDue.length > 0 ? Math.round((done / withDue.length) * 100) : 0

  const opportunities = allWorkstreams
    .filter(ws => !active.has(ws))
    .map(ws => ({
      workstream: ws,
      reason: ws === 'PPC' ? 'Drive immediate leads while SEO builds momentum'
        : ws === 'Social' ? 'Build brand presence and local trust signals'
        : ws === 'Local/GBP' ? 'Maximize GBP visibility for local search dominance'
        : ws === 'Web/Dev' ? 'Improve CRO and site speed for better conversions'
        : 'Strengthen organic visibility for long-term growth',
    }))

  return (
    <div className="space-y-3">
      {completion < 70 && (
        <div className="qa-gate-warning">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
          <p className="text-sm">Complete current deliverables (current: {completion}%) before pitching upsells.</p>
        </div>
      )}
      {opportunities.length === 0 ? (
        <div className="text-center py-6">
          <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Client is already on all workstreams.</p>
        </div>
      ) : (
        opportunities.map(op => (
          <div key={op.workstream} className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-[hsl(var(--warning))]" />
              <p className="text-sm font-medium">{op.workstream}</p>
            </div>
            <p className="text-xs text-muted-foreground">{op.reason}</p>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Risk Log Tab ─────────────────────────────────────────────────────────────

function RiskLogTab({ reviews }: { reviews: WeeklyReview[] }) {
  const sentimentColor = (s: string) =>
    s === 'Positive' ? 'text-[hsl(var(--success))]' :
    s === 'Neutral'  ? 'text-muted-foreground' :
    s === 'Concerned'? 'text-[hsl(var(--warning))]' : 'text-destructive'

  const retentionColor = (r: string) =>
    r === 'Strong'   ? 'text-[hsl(var(--success))]' :
    r === 'Moderate' ? 'text-muted-foreground' :
    r === 'At Risk'  ? 'text-[hsl(var(--warning))]' : 'text-destructive'

  return (
    <div className="space-y-3">
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No weekly reviews yet.</p>
      ) : (
        reviews.map(r => (
          <div key={r.id} className="p-3 bg-card border border-border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Week {r.week_number}</p>
              <p className="text-xs text-muted-foreground">{formatDateEST(r.review_date)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Sentiment</p>
                <p className={cn('font-medium', sentimentColor(r.sentiment_observed))}>
                  {r.sentiment_observed}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Engagement</p>
                <p className="font-medium">{r.engagement_level}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Retention</p>
                <p className={cn('font-medium', retentionColor(r.confidence_in_retention))}>
                  {r.confidence_in_retention}
                </p>
              </div>
            </div>
            {r.hidden_risk_signals && (
              <p className="text-xs text-muted-foreground">⚠ {r.hidden_risk_signals}</p>
            )}
            {r.adjustment_score !== 0 && (
              <p className="text-xs">
                Score adjustment: <span className={r.adjustment_score > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]'}>
                  {r.adjustment_score > 0 ? '+' : ''}{r.adjustment_score}
                </span>
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('onboarding')
  const { data, isLoading, error } = useClientDetail(clientId!)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
        {error ? (error as Error).message : 'Client not found.'}
      </div>
    )
  }

  const { client, tasks, blockers, meetings, reports, reviews } = data

  // Quick stats
  const withDue   = tasks.filter(t => t.due_date)
  const done      = withDue.filter(t => t.status === 'Done').length
  const overdue   = withDue.filter(t => isOverdueEST(t.due_date!) && t.status !== 'Done').length
  const blocked   = tasks.filter(t => t.status === 'Blocked').length
  const comp      = withDue.length > 0 ? Math.round((done / withDue.length) * 100) : 100
  const openBlockers = blockers.filter(b => b.status !== 'Resolved').length
  const nextMeeting  = meetings
    .filter(m => m.status === 'Scheduled')
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const highImpactOpen = tasks.filter(t => t.impact_level === 'High' && t.status !== 'Done').length

  const healthClass = client.health === 'Green' ? 'health-green'
    : client.health === 'Yellow' ? 'health-yellow' : 'health-red'
  const statusClass = client.status === 'Active' ? 'status-in-progress'
    : client.status === 'At Risk' ? 'status-blocked' : 'status-not-started'

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/clients')}
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <span className={healthClass}>{client.health}</span>
            <span className={statusClass}>{client.status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Since {formatDateEST(client.start_date)}
            {client.primary_workstreams?.length > 0 && (
              <> · {client.primary_workstreams.join(', ')}</>
            )}
          </p>
        </div>
        <button
          onClick={() => {/* TODO: open task create dialog */}}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 shrink-0"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="metric-card">
          <p className="metric-label">Completion</p>
          <p className={cn('metric-value text-lg', getCompletionClass(comp))}>{comp}%</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Overdue</p>
          <p className={cn('metric-value text-lg', overdue > 0 ? 'text-destructive' : '')}>{overdue}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Blocked</p>
          <p className={cn('metric-value text-lg', blocked > 0 ? 'text-[hsl(var(--warning))]' : '')}>{blocked}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Blockers</p>
          <p className={cn('metric-value text-lg', openBlockers > 0 ? 'text-destructive' : '')}>{openBlockers}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Next Meeting</p>
          <p className="text-sm font-semibold mt-1">
            {nextMeeting ? formatDateEST(nextMeeting.date) : 'None'}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Tasks Done</p>
          <p className="metric-value text-lg">{done}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">High Impact Open</p>
          <p className={cn('metric-value text-lg', highImpactOpen > 0 ? 'text-[hsl(var(--warning))]' : '')}>{highImpactOpen}</p>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 flex-wrap border-b border-border pb-2">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(activeTab === tab.id ? 'view-tab-active' : 'view-tab', 'flex items-center gap-1.5')}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {/* Badges */}
                {tab.id === 'overdue'  && overdue > 0 && (
                  <span className="ml-1 px-1 bg-destructive/20 text-destructive text-xs rounded-full">{overdue}</span>
                )}
                {tab.id === 'blockers' && openBlockers > 0 && (
                  <span className="ml-1 px-1 bg-destructive/20 text-destructive text-xs rounded-full">{openBlockers}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          {activeTab === 'onboarding'  && <OnboardingTab  tasks={tasks} />}
          {activeTab === 'overdue'     && <OverdueTab     tasks={tasks} />}
          {activeTab === 'blockers'    && <BlockersTab    blockers={blockers} />}
          {activeTab === 'credentials' && <CredentialsTab client={client} />}
          {activeTab === 'reports'     && <ReportsTab     reports={reports} />}
          {activeTab === 'meetings'    && <MeetingsTab    meetings={meetings} />}
          {activeTab === 'upsell'      && <UpsellTab      client={client} tasks={tasks} />}
          {activeTab === 'risk'        && <RiskLogTab     reviews={reviews} />}
        </div>
      </div>
    </div>
  )
}
