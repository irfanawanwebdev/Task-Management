/**
 * Owner / Executive Dashboard — JZ Operations Hub
 * High-level performance summary: KPIs, bonus conditions, client health, aging blockers.
 */

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, CheckCircle2, AlertTriangle, Loader2, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, DeliveryTask, Blocker, Meeting, Report } from '@/lib/types'
import { isOverdueEST, daysAgoEST, formatDateEST, todayDateEST } from '@/lib/timezone'
import { getCompletionClass } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Data Hooks ───────────────────────────────────────────────────────────────

function useOwnerData() {
  return useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: async () => {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      const [clientsRes, tasksRes, blockersRes, meetingsRes, reportsRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('delivery_tasks').select('*'),
        supabase.from('blockers').select('*, clients(name)').neq('status', 'Resolved').order('created_date'),
        supabase.from('meetings').select('client_id, status, date')
          .gte('date', monthStart).lte('date', monthEnd),
        supabase.from('reports').select('client_id, status, due_date')
          .gte('due_date', monthStart).lte('due_date', monthEnd),
      ])
      return {
        clients:  (clientsRes.data  ?? []) as unknown as Client[],
        tasks:    (tasksRes.data    ?? []) as unknown as DeliveryTask[],
        blockers: (blockersRes.data ?? []) as unknown as Blocker[],
        meetings: (meetingsRes.data ?? []) as Pick<Meeting, 'client_id' | 'status' | 'date'>[],
        reports:  (reportsRes.data  ?? []) as Pick<Report, 'client_id' | 'status' | 'due_date'>[],
      }
    },
  })
}

// ─── Bonus Conditions ─────────────────────────────────────────────────────────

const BONUS_CONDITIONS = [
  { label: 'Global task completion ≥ 90%',         key: 'completion' },
  { label: 'Zero high-severity blockers older 3d',  key: 'blockers' },
  { label: 'All clients with meetings this month',  key: 'meetings' },
  { label: 'All weekly reports sent on time',       key: 'reports' },
  { label: 'No clients in Red health > 2 weeks',   key: 'health' },
]

interface BonusConditionProps {
  label: string
  met: boolean
}

function BonusCondition({ label, met }: BonusConditionProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
      {met
        ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
        : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
      }
      <p className={cn('text-sm', !met && 'text-muted-foreground')}>{label}</p>
    </div>
  )
}

// ─── Client Health Table ──────────────────────────────────────────────────────

interface ClientHealthRowProps {
  client: Client
  tasks: DeliveryTask[]
}

function ClientHealthRow({ client, tasks }: ClientHealthRowProps) {
  const clientTasks = tasks.filter(t => t.client_id === client.id)
  const withDue     = clientTasks.filter(t => t.due_date)
  const done        = withDue.filter(t => t.status === 'Done').length
  const overdue     = withDue.filter(t => isOverdueEST(t.due_date!) && t.status !== 'Done').length
  const blocked     = clientTasks.filter(t => t.status === 'Blocked').length
  const completion  = withDue.length > 0 ? Math.round((done / withDue.length) * 100) : 100

  const healthClass = client.health === 'Green' ? 'health-green'
    : client.health === 'Yellow' ? 'health-yellow'
    : 'health-red'

  const statusClass = client.status === 'Active' ? 'status-in-progress'
    : client.status === 'Onboarding' ? 'status-not-started'
    : client.status === 'At Risk' ? 'status-blocked'
    : 'status-not-started'

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium">{client.name}</td>
      <td className="px-4 py-3"><span className={statusClass}>{client.status}</span></td>
      <td className="px-4 py-3"><span className={healthClass}>{client.health}</span></td>
      <td className="px-4 py-3 font-mono text-sm">
        <span className={getCompletionClass(completion)}>{completion}%</span>
      </td>
      <td className="px-4 py-3 text-sm">
        {overdue > 0 ? <span className="text-destructive font-medium">{overdue}</span> : <span className="text-muted-foreground">0</span>}
      </td>
      <td className="px-4 py-3 text-sm">
        {blocked > 0 ? <span className="text-[hsl(var(--warning))] font-medium">{blocked}</span> : <span className="text-muted-foreground">0</span>}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatDateEST(client.start_date)}
      </td>
    </tr>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { data, isLoading, error } = useOwnerData()

  const tasks    = data?.tasks    ?? []
  const clients  = data?.clients  ?? []
  const blockers = data?.blockers ?? []
  const meetings = data?.meetings ?? []
  const reports  = data?.reports  ?? []

  // KPI computations
  const allWithDue   = tasks.filter(t => t.due_date)
  const done         = allWithDue.filter(t => t.status === 'Done').length
  const overdue      = allWithDue.filter(t => isOverdueEST(t.due_date!) && t.status !== 'Done').length
  const blocked      = tasks.filter(t => t.status === 'Blocked').length
  const completion   = allWithDue.length > 0 ? Math.round((done / allWithDue.length) * 100) : 0
  const greenClients = clients.filter(c => c.health === 'Green').length
  const redClients   = clients.filter(c => c.health === 'Red').length

  // Bonus condition 3: all active clients have at least one completed meeting this month
  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'Onboarding')
  const clientsWithMeetingThisMonth = new Set(
    meetings.filter(m => m.status === 'Completed').map(m => m.client_id)
  )
  const allClientsHaveMeetings = activeClients.length > 0 &&
    activeClients.every(c => clientsWithMeetingThisMonth.has(c.id))

  // Bonus condition 4: all reports this month are Sent (no overdue/pending)
  const allReportsSentOnTime = reports.length > 0 &&
    reports.every(r => r.status === 'Sent')

  // Bonus conditions
  const highCriticalBlockers = blockers.filter(b => b.severity === 'High' && daysAgoEST(b.created_date) > 3)
  const bonusMet = [
    completion >= 90,
    highCriticalBlockers.length === 0,
    allClientsHaveMeetings,
    allReportsSentOnTime,
    redClients === 0,
  ]

  const agingBlockers = blockers.filter(b => daysAgoEST(b.created_date) > 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDateEST(todayDateEST())} · Agency Performance Overview
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {/* KPIs */}
      <section>
        <p className="section-header">Agency KPIs</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="metric-card">
            <p className="metric-label">Completion Rate</p>
            <p className={cn('metric-value', getCompletionClass(completion))}>{completion}%</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Active Clients</p>
            <p className="metric-value">{clients.filter(c => c.status === 'Active').length}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Overdue Tasks</p>
            <p className={cn('metric-value', overdue > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]')}>{overdue}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Blocked Tasks</p>
            <p className={cn('metric-value', blocked > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]')}>{blocked}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Client Health</p>
            <p className="metric-value">
              <span className="text-[hsl(var(--health-green))]">{greenClients}</span>
              <span className="text-muted-foreground text-base mx-1">/</span>
              <span className="text-[hsl(var(--health-red))] text-base">{redClients} ⚠</span>
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">

          {/* Client Health Table */}
          <section>
            <p className="section-header">Client Health Summary</p>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Health</th>
                      <th>Completion</th>
                      <th>Overdue</th>
                      <th>Blocked</th>
                      <th>Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                          No clients yet.
                        </td>
                      </tr>
                    ) : (
                      clients.map(c => (
                        <ClientHealthRow key={c.id} client={c} tasks={tasks} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">

          {/* Bonus Conditions */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-muted-foreground" />
              <p className="section-header mb-0">Bonus Conditions</p>
              <span className="ml-auto text-xs text-muted-foreground">
                {bonusMet.filter(Boolean).length}/{BONUS_CONDITIONS.length}
              </span>
            </div>
            <div className="space-y-2">
              {BONUS_CONDITIONS.map((c, i) => (
                <BonusCondition key={c.key} label={c.label} met={bonusMet[i]} />
              ))}
            </div>
          </section>

          {/* Aging Blockers */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
              <p className="section-header mb-0">Aging Blockers (&gt;3 days)</p>
            </div>
            {agingBlockers.length === 0 ? (
              <div className="metric-card text-center py-4">
                <TrendingUp className="h-6 w-6 text-[hsl(var(--success))] mx-auto mb-1" />
                <p className="text-sm text-muted-foreground">No critical blockers.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agingBlockers.map(b => (
                  <div key={b.id} className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={b.severity === 'High' ? 'severity-high' : 'severity-med'}>
                        {b.severity}
                      </span>
                      <span className="aging-critical">{daysAgoEST(b.created_date)}d</span>
                    </div>
                    <p className="text-xs">{b.description}</p>
                    {b.clients && (
                      <p className="text-xs text-muted-foreground mt-0.5">{b.clients.name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
