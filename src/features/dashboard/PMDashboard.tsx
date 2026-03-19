/**
 * PM Dashboard — Operations Control Tower
 * Primary operational view for Project Managers.
 * Shows 5 executive metrics, client risk scores, high-impact tasks today,
 * overdue split view, blocker monitor, upcoming meetings, and reports due.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2, Clock, TrendingUp, ShieldAlert,
  Calendar, ChevronDown, ChevronRight, Loader2, ClipboardList,
  FileText, CheckSquare, Square,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type {
  DeliveryTask, Blocker, Meeting, Report, Client, WeeklyReview,
} from '@/lib/types'
import {
  todayDateEST, isOverdueEST, formatDateEST, daysAgoEST, isDateTodayEST,
} from '@/lib/timezone'
import { getCompletionClass } from '@/lib/types'
import { calcRiskScore } from '@/lib/riskEngine'
import { cn } from '@/lib/utils'

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useAllTasks() {
  return useQuery<DeliveryTask[]>({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*, clients(name)')
      if (error) throw error
      return (data ?? []) as unknown as DeliveryTask[]
    },
  })
}

function useAllBlockers() {
  return useQuery<Blocker[]>({
    queryKey: ['all-blockers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blockers')
        .select('*, clients(name)')
        .neq('status', 'Resolved')
        .order('created_date')
      if (error) throw error
      return (data ?? []) as unknown as Blocker[]
    },
  })
}

function useUpcomingMeetings() {
  return useQuery<Meeting[]>({
    queryKey: ['upcoming-meetings'],
    queryFn: async () => {
      const today = todayDateEST()
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekStr = nextWeek.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('meetings')
        .select('*, clients(name)')
        .gte('date', today)
        .lte('date', nextWeekStr)
        .order('date')
        .limit(8)
      if (error) throw error
      return (data ?? []) as unknown as Meeting[]
    },
  })
}

function useAllMeetingsForRisk() {
  return useQuery<Meeting[]>({
    queryKey: ['all-meetings-risk'],
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id, client_id, type, status, date')
        .order('date', { ascending: false })
      return (data ?? []) as unknown as Meeting[]
    },
  })
}


function useWeeklyReviews() {
  return useQuery<WeeklyReview[]>({
    queryKey: ['weekly-reviews-risk'],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_reviews')
        .select('*')
        .order('review_date', { ascending: false })
      return (data ?? []) as unknown as WeeklyReview[]
    },
  })
}

function useReportsDue() {
  return useQuery<(Report & { clients?: { name: string } })[]>({
    queryKey: ['reports-due'],
    queryFn: async () => {
      // Reports due this week (Mon–Sun)
      const today = new Date()
      const mon = new Date(today)
      mon.setDate(today.getDate() - today.getDay() + 1)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)

      const { data, error } = await supabase
        .from('reports')
        .select('*, clients(name)')
        .gte('due_date', mon.toISOString().slice(0, 10))
        .lte('due_date', sun.toISOString().slice(0, 10))
        .neq('status', 'Sent')
        .order('due_date')
      if (error) throw error
      return (data ?? []) as unknown as (Report & { clients?: { name: string } })[]
    },
  })
}

function useClients() {
  return useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'Active')
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Client[]
    },
  })
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: number | string
  threshold?: 'excellent' | 'alert' | 'warning' | 'destructive' | 'default'
  icon?: React.ReactNode
  suffix?: string
}

function MetricCard({ label, value, threshold = 'default', icon, suffix }: MetricCardProps) {
  const colorMap = {
    excellent:   'text-[hsl(var(--success))]',
    alert:       'text-destructive',
    warning:     'text-[hsl(var(--warning))]',
    destructive: 'text-destructive',
    default:     'text-foreground',
  }

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-2">
        <p className="metric-label">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn('metric-value', colorMap[threshold])}>
        {value}{suffix}
      </p>
    </div>
  )
}

// ─── Risk Score Card ──────────────────────────────────────────────────────────

interface RiskCardProps {
  client:   Client
  tasks:    DeliveryTask[]
  reviews:  WeeklyReview[]
  meetings: Meeting[]
}

function RiskCard({ client, tasks, reviews, meetings }: RiskCardProps) {
  const [expanded, setExpanded] = useState(false)

  const clientTasks    = tasks.filter(t => t.client_id === client.id)
  const clientReviews  = reviews.filter(r => r.client_id === client.id)
  const clientMeetings = meetings.filter(m => m.client_id === client.id)

  const risk = calcRiskScore(clientTasks, clientReviews, clientMeetings)

  const overdue = clientTasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done').length
  const blocked = clientTasks.filter(t => t.status === 'Blocked').length

  const healthClass = risk.health === 'Green' ? 'health-green'
    : risk.health === 'Yellow' ? 'health-yellow'
    : 'health-red'


  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={healthClass}>{risk.health}</span>
          <span className="text-sm font-medium truncate">{client.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-sm">
          <span className={cn(
            'text-xs font-bold tabular-nums',
            risk.health === 'Red' ? 'text-destructive' : risk.health === 'Yellow' ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--success))]'
          )}>
            {risk.final_score}/100
          </span>
          {overdue > 0 && <span className="text-xs text-destructive font-medium">{overdue} overdue</span>}
          {blocked > 0 && <span className="text-xs text-[hsl(var(--warning))] font-medium">{blocked} blocked</span>}
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-3 bg-background/30 space-y-3">
          {/* System Risk Breakdown label */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Risk Breakdown</p>

          {/* 4-Pillar progress bars */}
          <div className="space-y-2.5">
            {([
              { label: 'Delivery',    score: risk.delivery,    max: 30 },
              { label: 'Sentiment',   score: risk.sentiment,   max: 25 },
              { label: 'Performance', score: risk.performance, max: 25 },
              { label: 'Visibility',  score: risk.visibility,  max: 20 },
            ] as const).map(({ label, score, max }) => {
              const pct = max > 0 ? (score / max) * 100 : 0
              const barColor = pct <= 30 ? 'bg-[hsl(var(--success))]'
                : pct <= 60 ? 'bg-[hsl(var(--warning))]'
                : 'bg-destructive'
              return (
                <div key={label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">
                      {score}<span className="text-muted-foreground font-normal">/{max}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary row */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
            <span className="text-muted-foreground">
              System: <span className="font-semibold text-foreground">{risk.delivery + risk.sentiment + risk.performance + risk.visibility}</span>
            </span>
            <span className="text-muted-foreground">
              Adj: <span className={cn('font-semibold',
                risk.adjustment > 0 ? 'text-destructive' :
                risk.adjustment < 0 ? 'text-[hsl(var(--success))]' :
                'text-foreground'
              )}>
                {risk.adjustment > 0 ? '+' : ''}{risk.adjustment}
              </span>
            </span>
            <span className="text-muted-foreground">
              Final: <span className={cn('font-bold',
                risk.health === 'Red'    ? 'text-destructive' :
                risk.health === 'Yellow' ? 'text-[hsl(var(--warning))]' :
                'text-[hsl(var(--success))]'
              )}>
                {risk.final_score}
              </span>
            </span>
          </div>

          {/* Weekly review note — shown if no reviews logged yet */}
          {clientReviews.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Weekly strategic reviews will appear here once logged.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Blocker Row ──────────────────────────────────────────────────────────────

function BlockerRow({ blocker }: { blocker: Blocker }) {
  const age = daysAgoEST(blocker.created_date)
  const isCritical = age > 3

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      isCritical ? 'bg-destructive/5 border-destructive/30' : 'bg-card border-border'
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={blocker.severity === 'High' ? 'severity-high' : blocker.severity === 'Med' ? 'severity-med' : 'severity-low'}>
            {blocker.severity}
          </span>
          {blocker.clients && (
            <span className="text-xs text-muted-foreground">{blocker.clients.name}</span>
          )}
          <span className="text-xs text-muted-foreground">· {blocker.workstream}</span>
        </div>
        <p className="text-sm mt-1 line-clamp-2">{blocker.description}</p>
        {blocker.profiles && (
          <p className="text-xs text-muted-foreground mt-0.5">Owner: {blocker.profiles.full_name}</p>
        )}
      </div>
      <span className={isCritical ? 'aging-critical' : 'aging-normal'}>{age}d</span>
    </div>
  )
}

// ─── PM Checklist ─────────────────────────────────────────────────────────────

const FALLBACK_CHECKLIST = [
  'Check overdue tasks and follow up with team',
  'Review and clear blocked items',
  'Send pending weekly/monthly reports',
  'Log new risks or blockers identified',
]

function useNonNegotiables() {
  return useQuery<string[]>({
    queryKey: ['app-settings', 'weekly_non_negotiables'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'weekly_non_negotiables')
        .single()
      return ((data as unknown as { value: string[] } | null)?.value) ?? FALLBACK_CHECKLIST
    },
    placeholderData: FALLBACK_CHECKLIST,
  })
}

function DailyChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false))

  const toggle = (i: number) => {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  const done = checked.filter(Boolean).length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="section-header">Daily PM Checklist</p>
        <span className="text-xs text-muted-foreground">{done}/{items.length}</span>
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => toggle(i)}
          className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left"
        >
          {checked[i]
            ? <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          }
          <span className={cn('text-sm', checked[i] && 'line-through text-muted-foreground')}>
            {item}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function PMDashboard() {
  const { data: tasks,       isLoading: tasksLoading }       = useAllTasks()
  const { data: blockers,    isLoading: blockersLoading }    = useAllBlockers()
  const { data: meetings,    isLoading: meetingsLoading }    = useUpcomingMeetings()
  const { data: reports,     isLoading: reportsLoading }     = useReportsDue()
  const { data: clients,     isLoading: clientsLoading }     = useClients()
  const { data: allMeetings  = [], isLoading: riskMtgLoading }  = useAllMeetingsForRisk()
  const { data: allReviews   = [], isLoading: riskRevLoading }  = useWeeklyReviews()
  const { data: checklistItems = FALLBACK_CHECKLIST }        = useNonNegotiables()

  const today = todayDateEST()

  // ── Computed metrics ────────────────────────────────────────────────────────
  const tasksWithDue     = tasks?.filter(t => t.due_date) ?? []
  const doneTasks        = tasksWithDue.filter(t => t.status === 'Done')
  const highImpactAll    = tasksWithDue.filter(t => t.impact_level === 'High')
  const highImpactDone   = highImpactAll.filter(t => t.status === 'Done')
  const overdueTasks     = tasksWithDue.filter(t => isOverdueEST(t.due_date!) && t.status !== 'Done')
  const overdueOpsPM     = overdueTasks.filter(t => t.workstream === 'Ops/PM' || t.workstream === 'AM')
  const blockedCount     = tasks?.filter(t => t.status === 'Blocked').length ?? 0
  const highImpactToday  = tasks?.filter(t =>
    t.due_date && isDateTodayEST(t.due_date) && t.impact_level === 'High' && t.status !== 'Done'
  ) ?? []

  const globalCompletion = tasksWithDue.length > 0
    ? Math.round((doneTasks.length / tasksWithDue.length) * 100) : 0
  const highImpactRate   = highImpactAll.length > 0
    ? Math.round((highImpactDone.length / highImpactAll.length) * 100) : 0

  const isLoading = tasksLoading || blockersLoading || meetingsLoading || reportsLoading
    || clientsLoading || riskMtgLoading || riskRevLoading

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">PM Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">{formatDateEST(today)} · Operations Control Tower</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard data…
        </div>
      )}

      {/* ── 5 Executive Metrics ── */}
      <section>
        <p className="section-header">Executive Control Panel</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <MetricCard
            label="Global Completion"
            value={globalCompletion}
            suffix="%"
            threshold={globalCompletion >= 95 ? 'excellent' : globalCompletion >= 85 ? 'default' : 'alert'}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            label="High-Impact Rate"
            value={highImpactRate}
            suffix="%"
            threshold={highImpactRate >= 90 ? 'excellent' : highImpactRate >= 80 ? 'default' : 'alert'}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <MetricCard
            label="Overdue (All)"
            value={overdueTasks.length}
            threshold={overdueTasks.length > 0 ? 'alert' : 'excellent'}
            icon={<Clock className="h-4 w-4" />}
          />
          <MetricCard
            label="Overdue (Ops/PM)"
            value={overdueOpsPM.length}
            threshold={overdueOpsPM.length > 0 ? 'alert' : 'excellent'}
            icon={<Clock className="h-4 w-4" />}
          />
          <MetricCard
            label="Blocked Tasks"
            value={blockedCount}
            threshold={blockedCount > 0 ? 'destructive' : 'excellent'}
            icon={<ShieldAlert className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Client Risk Scores */}
          {clients && clients.length > 0 && (
            <section>
              <p className="section-header">Client Risk Scores</p>
              <div className="space-y-2">
                {clients.map(c => (
                  <RiskCard
                    key={c.id}
                    client={c}
                    tasks={tasks ?? []}
                    reviews={allReviews}
                    meetings={allMeetings}
                  />
                ))}
              </div>
            </section>
          )}

          {/* High-Impact Tasks Today */}
          <section>
            <p className="section-header">High-Impact Tasks Today</p>
            {highImpactToday.length === 0 ? (
              <div className="metric-card text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))] mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No high-impact tasks due today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {highImpactToday.map(t => (
                  <div key={t.id} className="metric-card flex items-center gap-3">
                    <span className="severity-high shrink-0">High</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t.task_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.clients?.name} · {t.workstream} · Step {t.step}
                      </p>
                    </div>
                    <span className={cn('status-badge shrink-0',
                      t.status === 'Blocked' ? 'status-blocked' : 'status-in-progress'
                    )}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Overdue Split View */}
          <section>
            <p className="section-header">Overdue Tasks</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* All departments */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">All Departments ({overdueTasks.length})</p>
                {overdueTasks.length === 0 ? (
                  <div className="metric-card py-4 text-center text-sm text-muted-foreground">
                    All clear!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {overdueTasks.slice(0, 8).map(t => (
                      <div key={t.id} className="metric-card py-2 px-3">
                        <p className="text-xs font-medium">{t.task_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.clients?.name} · {t.due_date && formatDateEST(t.due_date)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ops/PM only */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Ops/PM Only ({overdueOpsPM.length})</p>
                {overdueOpsPM.length === 0 ? (
                  <div className="metric-card py-4 text-center text-sm text-muted-foreground">
                    All clear!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {overdueOpsPM.slice(0, 8).map(t => (
                      <div key={t.id} className="metric-card py-2 px-3">
                        <p className="text-xs font-medium">{t.task_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.clients?.name} · {t.due_date && formatDateEST(t.due_date)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Blocker Monitor */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="section-header mb-0">
                Blocker Monitor
                {(blockers?.length ?? 0) > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-destructive/20 text-destructive text-xs rounded-full normal-case font-semibold">
                    {blockers!.length} open
                  </span>
                )}
              </p>
            </div>
            {!blockers || blockers.length === 0 ? (
              <div className="metric-card py-6 text-center">
                <CheckCircle2 className="h-7 w-7 text-[hsl(var(--success))] mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active blockers.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {blockers.map(b => <BlockerRow key={b.id} blocker={b} />)}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">

          {/* Daily PM Checklist */}
          <div className="metric-card">
            <DailyChecklist items={checklistItems} />
          </div>

          {/* Client Meetings This Week */}
          <section>
            <p className="section-header">Meetings This Week</p>
            {!meetings || meetings.length === 0 ? (
              <div className="metric-card py-4 text-center text-sm text-muted-foreground">
                No meetings scheduled this week.
              </div>
            ) : (
              <div className="space-y-2">
                {meetings.map(m => (
                  <div key={m.id} className="metric-card py-2 px-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">{m.clients?.name ?? '—'}</p>
                      <span className={cn('status-badge shrink-0',
                        m.status === 'Completed' ? 'status-done' :
                        m.status === 'Scheduled' ? 'status-in-progress' :
                        'status-not-started'
                      )}>
                        {m.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {formatDateEST(m.date)} · {m.type}
                      </p>
                    </div>
                    {m.calendar_event_link && (
                      <a
                        href={m.calendar_event_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        Open in Calendar →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Reports Due This Week */}
          <section>
            <p className="section-header">Reports Due This Week</p>
            {!reports || reports.length === 0 ? (
              <div className="metric-card py-4 text-center text-sm text-muted-foreground">
                No pending reports this week.
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="metric-card py-2 px-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="text-xs font-medium truncate">{r.clients?.name ?? r.report_name}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{r.report_type}</p>
                      <span className={cn('status-badge',
                        r.status === 'Sent' ? 'status-done' :
                        r.status === 'In Progress' ? 'status-in-progress' :
                        'status-not-started'
                      )}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {formatDateEST(r.due_date)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick stats for PM */}
          <div className="metric-card space-y-3">
            <p className="section-header mb-0">
              <ClipboardList className="inline h-3.5 w-3.5 mr-1.5" />
              Quick Stats
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tasks</span>
                <span className="font-medium">{tasks?.length ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Done</span>
                <span className={cn('font-medium', getCompletionClass(globalCompletion))}>
                  {doneTasks.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Clients</span>
                <span className="font-medium">{clients?.length ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
