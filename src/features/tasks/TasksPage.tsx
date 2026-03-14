/**
 * Tasks Page — JZ Operations Hub
 * Master task database with 6 view tabs, client filter, and grouped tables.
 * Opens Task Detail Dialog on row click.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertTriangle, CheckCircle2, X, ExternalLink, Plus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, DeliveryTask } from '@/lib/types'
import { isOverdueEST, formatDateEST, isDateTodayEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { CreateTaskDialog } from './CreateTaskDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewTab = 'timeline' | 'workstream' | 'qa-gate' | 'blocked' | 'overdue' | 'next-ready'

// ─── Data Hooks ───────────────────────────────────────────────────────────────

function useTasks(clientFilter: string) {
  return useQuery<DeliveryTask[]>({
    queryKey: ['tasks', clientFilter],
    queryFn: async () => {
      let q = supabase
        .from('delivery_tasks')
        .select('*, clients(name), task_assignments(role_type, workstream, user_id, profiles(full_name))')
        .order('step')
        .order('due_date')

      if (clientFilter !== 'all') q = q.eq('client_id', clientFilter)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as DeliveryTask[]
    },
  })
}

function useClientList() {
  return useQuery<Client[]>({
    queryKey: ['client-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return (data ?? []) as unknown as Client[]
    },
  })
}

// ─── Task Detail Dialog ───────────────────────────────────────────────────────

function TaskDetailDialog({ task, onClose }: { task: DeliveryTask; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [qaWarning, setQaWarning] = useState(false)
  const [outputUrl, setOutputUrl] = useState(task.output_link ?? '')
  const [savingUrl, setSavingUrl] = useState(false)

  const updateStatus = useMutation({
    mutationFn: async (status: DeliveryTask['status']) => {
      const upd: Record<string, unknown> = { status }
      if (status === 'Done') upd['completed_date'] = new Date().toISOString().slice(0, 10)
      const { error } = await supabase.from('delivery_tasks').update(upd as never).eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => {
      setQaWarning(false)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  /** True if this task has A/R assignments and output is not yet logged */
  const hasARAssignment = (task.task_assignments ?? []).some(
    a => a.role_type === 'R' || a.role_type === 'A',
  )
  const needsQAGate = hasARAssignment && !task.ar_output_logged

  function handleMarkDone() {
    if (needsQAGate) {
      setQaWarning(true)
    } else {
      updateStatus.mutate('Done')
    }
  }

  const toggleAR = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('delivery_tasks')
        .update({ ar_output_logged: !task.ar_output_logged } as never)
        .eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const saveOutputUrl = async () => {
    setSavingUrl(true)
    await supabase.from('delivery_tasks').update({ output_link: outputUrl.trim() || null } as never).eq('id', task.id)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    setSavingUrl(false)
  }

  const raciR = task.task_assignments?.filter(a => a.role_type === 'R') ?? []
  const raciA = task.task_assignments?.filter(a => a.role_type === 'A') ?? []
  const raciC = task.task_assignments?.filter(a => a.role_type === 'C') ?? []
  const raciI = task.task_assignments?.filter(a => a.role_type === 'I') ?? []

  const isOverdue = task.due_date && isOverdueEST(task.due_date) && task.status !== 'Done'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn(
                task.status === 'Done'        ? 'status-done' :
                task.status === 'In Progress' ? 'status-in-progress' :
                task.status === 'Blocked'     ? 'status-blocked' : 'status-not-started'
              )}>
                {task.status}
              </span>
              <span className={
                task.impact_level === 'High' ? 'severity-high' :
                task.impact_level === 'Medium' ? 'severity-med' : 'severity-low'
              }>
                {task.impact_level}
              </span>
              {isOverdue && <span className="status-badge bg-destructive/20 text-destructive">Overdue</span>}
            </div>
            <h2 className="text-lg font-semibold">{task.task_name}</h2>
            {task.clients && (
              <p className="text-sm text-muted-foreground mt-0.5">{task.clients.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Description */}
          {task.description && (
            <div>
              <p className="section-header">Description</p>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}

          {/* Task Details Grid */}
          <div>
            <p className="section-header">Task Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Workstream</span>
                <span className="font-medium">{task.workstream}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Timeline</span>
                <span className="font-medium">{task.timeline}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Step</span>
                <span className="font-medium">{task.step} — {task.step_name}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Impact</span>
                <span className="font-medium">{task.impact_level}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Due Date</span>
                <span className={cn('font-medium', isOverdue ? 'text-destructive' : '')}>
                  {task.due_date ? formatDateEST(task.due_date) : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium">
                  {task.completed_date ? formatDateEST(task.completed_date) : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5 col-span-2">
                <span className="text-muted-foreground">A/R Output Logged</span>
                <button
                  onClick={() => toggleAR.mutate()}
                  disabled={toggleAR.isPending}
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded transition-colors',
                    task.ar_output_logged
                      ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                >
                  {task.ar_output_logged ? '✓ Logged' : '✗ Not Logged — Click to log'}
                </button>
              </div>
            </div>
          </div>

          {/* RACI */}
          {task.task_assignments && task.task_assignments.length > 0 && (
            <div>
              <p className="section-header">RACI Assignments</p>
              <div className="grid grid-cols-4 gap-3">
                {([['R', raciR], ['A', raciA], ['C', raciC], ['I', raciI]] as const).map(([role, members]) => (
                  <div key={role} className="bg-background/50 rounded-lg p-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">{role}</p>
                    {members.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50">—</p>
                    ) : (
                      members.map((m, i) => (
                        <p key={i} className="text-xs">
                          {m.profiles?.full_name ?? m.workstream ?? '—'}
                        </p>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocker Details */}
          {task.blocker_text && (
            <div className="qa-gate-warning">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Blocker</p>
                <p className="text-sm mt-0.5">{task.blocker_text}</p>
              </div>
            </div>
          )}

          {/* Output Link */}
          <div>
            <p className="section-header">A/R Output URL</p>
            <div className="flex gap-2 items-center">
              <input
                value={outputUrl}
                onChange={e => setOutputUrl(e.target.value)}
                onBlur={saveOutputUrl}
                placeholder="https://… (paste output link)"
                className="flex-1 px-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {outputUrl && (
                <a href={outputUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {savingUrl && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* Status Update */}
          <div>
            <p className="section-header">Update Status</p>

            {/* QA Gate confirmation */}
            {qaWarning && (
              <div className="qa-gate-warning mb-3">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">QA Gate: A/R Output Not Logged</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    This task has Accountable/Responsible assignments and the output has not been logged yet.
                    Log the output before marking Done, or override to proceed anyway.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => { toggleAR.mutate(); setQaWarning(false) }}
                      disabled={toggleAR.isPending}
                      className="px-3 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Log Output First
                    </button>
                    <button
                      onClick={() => updateStatus.mutate('Done')}
                      disabled={updateStatus.isPending}
                      className="px-3 py-1 rounded text-xs font-medium border border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      Override — Mark Done Anyway
                    </button>
                    <button
                      onClick={() => setQaWarning(false)}
                      className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {(['Not Started', 'In Progress', 'Blocked'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus.mutate(s)}
                  disabled={updateStatus.isPending || task.status === s}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    task.status === s
                      ? 'border-primary/50 bg-primary/10 text-primary cursor-default'
                      : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30'
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={handleMarkDone}
                disabled={updateStatus.isPending || task.status === 'Done'}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  task.status === 'Done'
                    ? 'border-primary/50 bg-primary/10 text-primary cursor-default'
                    : needsQAGate
                    ? 'border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/20'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30'
                )}
              >
                Done {needsQAGate && '⚠'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onClick }: { task: DeliveryTask; onClick: () => void }) {
  const isOverdue = task.due_date && isOverdueEST(task.due_date) && task.status !== 'Done'
  const isToday   = task.due_date && isDateTodayEST(task.due_date)

  const rAssign = task.task_assignments?.filter(a => a.role_type === 'R')
    .map(a => a.profiles?.full_name ?? a.workstream ?? '—').join(', ')
  const aAssign = task.task_assignments?.filter(a => a.role_type === 'A')
    .map(a => a.profiles?.full_name ?? a.workstream ?? '—').join(', ')

  return (
    <tr onClick={onClick} className={cn(isOverdue && 'bg-destructive/5')}>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium">{task.clients?.name ?? '—'}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{task.timeline}</td>
      <td className="px-4 py-3 text-xs">{task.workstream}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium line-clamp-1">{task.task_name}</p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-24 truncate">{rAssign ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-24 truncate">{aAssign ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={cn(
          task.status === 'Done'        ? 'status-done' :
          task.status === 'In Progress' ? 'status-in-progress' :
          task.status === 'Blocked'     ? 'status-blocked' : 'status-not-started'
        )}>
          {task.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={task.ar_output_logged
          ? 'text-[hsl(var(--success))] text-xs font-medium'
          : 'text-muted-foreground text-xs'
        }>
          {task.ar_output_logged ? '✓' : '✗'}
        </span>
      </td>
      <td className="px-4 py-3">
        {task.due_date ? (
          <span className={cn(
            'text-xs font-medium',
            isOverdue ? 'text-destructive' :
            isToday   ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'
          )}>
            {formatDateEST(task.due_date)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [activeView, setActiveView]     = useState<ViewTab>('timeline')
  const [clientFilter, setClientFilter] = useState('all')
  const [selectedTask, setSelectedTask] = useState<DeliveryTask | null>(null)
  const [showCreate, setShowCreate]     = useState(false)

  const { data: tasks = [], isLoading } = useTasks(clientFilter)
  const { data: clients = [] }          = useClientList()

  // ── View filtering ──────────────────────────────────────────────────────────
  const visibleTasks = (() => {
    switch (activeView) {
      case 'qa-gate':
        return tasks.filter(t => !t.ar_output_logged && t.status !== 'Not Started')
      case 'blocked':
        return tasks.filter(t => t.status === 'Blocked')
      case 'overdue':
        return tasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done')
      case 'next-ready':
        return tasks.filter(t => t.ar_output_logged && t.status === 'Done')
      default:
        return tasks
    }
  })()

  // ── Grouping ────────────────────────────────────────────────────────────────
  const grouped = (() => {
    if (activeView === 'workstream') {
      return Object.entries(
        visibleTasks.reduce<Record<string, DeliveryTask[]>>((acc, t) => {
          const k = t.workstream
          acc[k] = acc[k] ?? []
          acc[k].push(t)
          return acc
        }, {})
      )
    }
    // Default: group by step_name (timeline)
    return Object.entries(
      visibleTasks.reduce<Record<string, DeliveryTask[]>>((acc, t) => {
        const k = `Step ${t.step} — ${t.step_name}`
        acc[k] = acc[k] ?? []
        acc[k].push(t)
        return acc
      }, {})
    )
  })()

  const VIEWS: { id: ViewTab; label: string }[] = [
    { id: 'timeline',    label: 'Timeline' },
    { id: 'workstream',  label: 'By Workstream' },
    { id: 'qa-gate',     label: 'QA Gate' },
    { id: 'blocked',     label: 'Blocked' },
    { id: 'overdue',     label: 'Overdue' },
    { id: 'next-ready',  label: 'Next Ready' },
  ]

  const blockedCount = tasks.filter(t => t.status === 'Blocked').length
  const overdueCount = tasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done').length
  const qaCount      = tasks.filter(t => !t.ar_output_logged && t.status !== 'Not Started' && t.status !== 'Done').length

  return (
    <div className="space-y-5">
      <CreateTaskDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        clients={clients}
        presetClientId={clientFilter !== 'all' ? clientFilter : undefined}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">Master delivery task database</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View Tabs */}
        <div className="flex gap-1 flex-wrap">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={cn('view-tab flex items-center gap-1', activeView === v.id && 'view-tab-active')}
            >
              {v.label}
              {v.id === 'blocked' && blockedCount > 0 && (
                <span className="px-1 bg-destructive/20 text-destructive text-xs rounded-full">{blockedCount}</span>
              )}
              {v.id === 'overdue' && overdueCount > 0 && (
                <span className="px-1 bg-destructive/20 text-destructive text-xs rounded-full">{overdueCount}</span>
              )}
              {v.id === 'qa-gate' && qaCount > 0 && (
                <span className="px-1 bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] text-xs rounded-full">{qaCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Client Filter */}
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="ml-auto px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* QA Gate Banner */}
      {activeView === 'qa-gate' && (
        <div className="qa-gate-warning">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
          <p className="text-sm">
            These tasks have outputs not yet logged. Next steps are blocked until A/R output is confirmed.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
        </div>
      )}

      {/* Grouped Table */}
      {!isLoading && grouped.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))] opacity-50" />
          <p className="text-sm text-muted-foreground">No tasks in this view.</p>
        </div>
      )}

      {!isLoading && grouped.map(([groupKey, groupTasks]) => (
        <div key={groupKey} className="space-y-1">
          <div className="flex items-center gap-2 px-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {groupKey}
            </p>
            <span className="text-xs text-muted-foreground/60">({groupTasks.length})</span>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Timeline</th>
                    <th>Workstream</th>
                    <th>Task</th>
                    <th>R</th>
                    <th>A</th>
                    <th>Status</th>
                    <th>A/R</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {groupTasks.map(t => (
                    <TaskRow key={t.id} task={t} onClick={() => setSelectedTask(t)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {/* Task Detail Dialog */}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
