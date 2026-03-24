/**
 * Client SOP Plan Page — /instructions/clients/:clientId
 * §13.1: Shows a client's specific operational plan:
 * deliverables, deadlines, milestones, links, and assigned owners.
 */

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, BookOpen, ExternalLink, Loader2,
  CheckCircle2, Clock, AlertTriangle, Circle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, DeliveryTask, TaskAssignment, Profile } from '@/lib/types'
import { DELIVERY_STEPS } from '@/lib/types'
import { formatDateEST, isOverdueEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'

// ─── Data Hook ────────────────────────────────────────────────────────────────

interface ClientPlanData {
  client: Client
  tasks: (DeliveryTask & { assignments: (TaskAssignment & { profiles?: Pick<Profile, 'full_name'> })[] })[]
}

function useClientPlan(clientId: string) {
  return useQuery<ClientPlanData>({
    queryKey: ['client-sop-plan', clientId],
    queryFn: async () => {
      const [clientRes, tasksRes, profilesRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase
          .from('delivery_tasks')
          .select('*, task_assignments(id, task_id, user_id, workstream, role_type)')
          .eq('client_id', clientId)
          .order('step')
          .order('due_date'),
        supabase.from('profiles').select('user_id, full_name').eq('is_active', true),
      ])
      if (clientRes.error) throw clientRes.error
      if (tasksRes.error) throw tasksRes.error

      const client = clientRes.data as unknown as Client
      const profileMap = new Map<string, string>(
        (profilesRes.data ?? []).map(p => [p.user_id as string, p.full_name as string])
      )

      const tasks = (tasksRes.data ?? []).map(t => ({
        ...(t as unknown as DeliveryTask),
        assignments: ((t as unknown as { task_assignments: unknown[] }).task_assignments ?? []).map(
          (a: unknown) => {
            const aTyped = a as TaskAssignment
            return {
              ...aTyped,
              profiles: aTyped.user_id
                ? { full_name: profileMap.get(aTyped.user_id) ?? '' }
                : undefined,
            } as TaskAssignment & { profiles?: Pick<Profile, 'full_name'> }
          }
        ),
      }))
      return { client, tasks }
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'Done')        return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
  if (status === 'In Progress') return <Clock className="h-4 w-4 text-blue-500 shrink-0" />
  if (status === 'Blocked')     return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────

function MilestoneProgress({ tasks }: { tasks: ClientPlanData['tasks'] }) {
  const doneSteps = new Set(tasks.filter(t => t.status === 'Done').map(t => t.step))
  const maxStep   = tasks.reduce((m, t) => Math.max(m, t.step), 0)
  const pct = DELIVERY_STEPS.length > 1
    ? Math.round((doneSteps.size / DELIVERY_STEPS.length) * 100)
    : 0

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Delivery Progress</p>
        <span className="text-xs text-muted-foreground">
          Step {maxStep} / {DELIVERY_STEPS.length - 1}
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {DELIVERY_STEPS.map(s => {
          const done    = doneSteps.has(s.step)
          const current = !done && s.step === maxStep
          return (
            <span
              key={s.step}
              title={`Step ${s.step}: ${s.name}`}
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                done    && 'bg-primary',
                current && 'bg-amber-400',
                !done && !current && 'bg-muted',
              )}
            />
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{pct}% complete</p>
    </div>
  )
}

// ─── Links Card ──────────────────────────────────────────────────────────────

function LinksCard({ client }: { client: Client }) {
  const links = [
    { label: 'Google Drive',      url: client.drive_folder_url },
    { label: 'Credentials Sheet', url: client.credentials_sheet_url },
    { label: 'Website',           url: client.website_url },
    { label: 'GBP',               url: client.gbp_url },
    { label: 'Ad Accounts',       url: client.ad_accounts_url },
  ].filter(l => l.url)

  if (links.length === 0) return null
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <p className="text-sm font-semibold">Links</p>
      {links.map(l => (
        <a
          key={l.label}
          href={l.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {l.label}
        </a>
      ))}
    </div>
  )
}

// ─── Deliverables Table ───────────────────────────────────────────────────────

function DeliverablesTable({ tasks }: { tasks: ClientPlanData['tasks'] }) {
  const active = tasks.filter(t => t.status !== 'Done')
  const done   = tasks.filter(t => t.status === 'Done')

  const renderRow = (t: ClientPlanData['tasks'][0]) => {
    const assignees = t.assignments
      .filter(a => a.profiles?.full_name)
      .map(a => a.profiles!.full_name)
    const overdue = t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done'

    return (
      <tr key={t.id} className="border-b last:border-0">
        <td className="px-3 py-2.5">
          <div className="flex items-start gap-2">
            <TaskStatusIcon status={t.status} />
            <div>
              <p className="text-sm font-medium leading-tight">{t.task_name}</p>
              <p className="text-xs text-muted-foreground">{t.workstream}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs">
          {t.due_date ? (
            <span className={cn(overdue && 'text-red-600 font-medium')}>
              {formatDateEST(t.due_date)}
              {overdue && ' (overdue)'}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">
          {assignees.length > 0 ? assignees.join(', ') : <span className="italic">Unassigned</span>}
        </td>
        <td className="px-3 py-2.5">
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
            t.impact_level === 'High'   && 'bg-red-100 text-red-700',
            t.impact_level === 'Medium' && 'bg-amber-100 text-amber-700',
            t.impact_level === 'Low'    && 'bg-blue-100 text-blue-700',
          )}>
            {t.impact_level}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Task</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Due Date</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Assigned To</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Impact</th>
          </tr>
        </thead>
        <tbody>
          {active.length > 0 && active.map(renderRow)}
          {active.length === 0 && done.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                No tasks for this client yet.
              </td>
            </tr>
          )}
          {done.length > 0 && (
            <>
              <tr className="bg-muted/30">
                <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Completed ({done.length})
                </td>
              </tr>
              {done.map(renderRow)}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientSOPPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const { data, isLoading, error } = useClientPlan(clientId!)

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
        Failed to load client plan: {(error as Error)?.message ?? 'Unknown error'}
      </div>
    )
  }

  const { client, tasks } = data
  const overdueCount = tasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done').length

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/instructions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to SOP Library
      </Link>

      {/* Client header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            {client.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              client.status === 'Active'     && 'bg-green-100 text-green-700',
              client.status === 'Onboarding' && 'bg-blue-100 text-blue-700',
            )}>
              {client.status}
            </span>
            {client.owner_pm && <span>PM: <strong>{client.owner_pm}</strong></span>}
            {client.account_manager_name && <span>AM: <strong>{client.account_manager_name}</strong></span>}
            {overdueCount > 0 && (
              <span className="text-red-600 font-medium">{overdueCount} overdue</span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout: main + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
        {/* Main: deliverables table */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Deliverables
          </p>
          <DeliverablesTable tasks={tasks} />
        </div>

        {/* Sidebar: milestones + links */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Milestones
            </p>
            <MilestoneProgress tasks={tasks} />
          </div>
          <LinksCard client={client} />
          {client.notes && (
            <div className="rounded-lg border bg-card p-4 space-y-1">
              <p className="text-sm font-semibold">Notes</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
