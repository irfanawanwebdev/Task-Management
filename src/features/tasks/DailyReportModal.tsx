/**
 * DailyReportModal — Task daily report grouped by employee.
 *
 * Rules:
 *  - Shows employee names (responsible / accountable) — DAILY only.
 *  - Weekly / Monthly reports remain anonymous (handled in MeetingsPage).
 *  - Status filter: All | Done | In Progress | Not Started | Blocked.
 *  - Download generates a self-contained HTML file.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, Loader2, FileText, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { DeliveryTask } from '@/lib/types'
import { formatDateEST, todayDateEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'Done' | 'In Progress' | 'Not Started' | 'Blocked'

interface Profile { user_id: string; full_name: string }

interface EmployeeGroup {
  name: string
  tasks: EnrichedTask[]
}

interface EnrichedTask extends DeliveryTask {
  clientName: string
  responsibles: string[]
  accountables: string[]
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useAllTasksForReport() {
  return useQuery<DeliveryTask[]>({
    queryKey: ['tasks-daily-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*, clients(name), task_assignments(role_type, workstream, user_id)')
        .order('step')
        .order('due_date')
      if (error) throw error
      return (data ?? []) as unknown as DeliveryTask[]
    },
    staleTime: 60_000,
  })
}

function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_active', true)
      return (data ?? []) as Profile[]
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveName(userId: string | null | undefined, workstream: string | null | undefined, profiles: Profile[]) {
  if (userId) return profiles.find(p => p.user_id === userId)?.full_name ?? 'Unknown'
  return workstream ?? 'Unassigned'
}

function buildEmployeeGroups(
  tasks: DeliveryTask[],
  profiles: Profile[],
  statusFilter: StatusFilter,
): EmployeeGroup[] {
  const filtered = statusFilter === 'all'
    ? tasks
    : tasks.filter(t => t.status === statusFilter)

  // Map: employee name → tasks
  const map = new Map<string, EnrichedTask[]>()

  for (const task of filtered) {
    const assignments = task.task_assignments ?? []
    const rUsers = assignments.filter(a => a.role_type === 'R')
    const aUsers = assignments.filter(a => a.role_type === 'A')

    const responsibles = rUsers.map(a => resolveName(a.user_id, a.workstream, profiles))
    const accountables = aUsers.map(a => resolveName(a.user_id, a.workstream, profiles))

    const enriched: EnrichedTask = {
      ...task,
      clientName: (task.clients as { name: string } | null)?.name ?? '—',
      responsibles,
      accountables,
    }

    // Collect all assigned employees (R + A)
    const assigned = assignments
      .filter(a => a.user_id)
      .map(a => resolveName(a.user_id, a.workstream, profiles))

    const uniqueAssigned = [...new Set(assigned)]

    if (uniqueAssigned.length === 0) {
      // Unassigned task — bucket under workstream
      const key = task.workstream ?? 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(enriched)
    } else {
      for (const name of uniqueAssigned) {
        if (!map.has(name)) map.set(name, [])
        map.get(name)!.push(enriched)
      }
    }
  }

  // Sort: named employees first (alphabetically), then workstreams
  const entries = [...map.entries()]
  const isPersonName = (n: string) => profiles.some(p => p.full_name === n)
  entries.sort(([a], [b]) => {
    const aIsP = isPersonName(a)
    const bIsP = isPersonName(b)
    if (aIsP && !bIsP) return -1
    if (!aIsP && bIsP) return 1
    return a.localeCompare(b)
  })

  return entries.map(([name, tasks]) => ({ name, tasks }))
}

// ─── HTML Download ────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  if (status === 'Done')        return '#16a34a'
  if (status === 'In Progress') return '#2563eb'
  if (status === 'Blocked')     return '#dc2626'
  return '#6b7280'
}

function buildReportHTML(groups: EmployeeGroup[], statusFilter: StatusFilter, date: string): string {
  const label = statusFilter === 'all' ? 'All Statuses' : statusFilter
  const totalTasks = groups.reduce((n, g) => n + g.tasks.length, 0)

  const groupsHTML = groups.map(g => {
    const rows = g.tasks.map(t => `
      <tr>
        <td>${t.task_name}</td>
        <td>${t.clientName}</td>
        <td>${t.workstream}</td>
        <td style="color:${statusColor(t.status)};font-weight:600">${t.status}</td>
        <td>${t.due_date ? formatDateEST(t.due_date) : '—'}</td>
        <td>${t.responsibles.join(', ') || '—'}</td>
      </tr>`).join('')

    return `
      <div class="group">
        <div class="group-header">
          <span class="group-name">${g.name}</span>
          <span class="group-count">${g.tasks.length} task${g.tasks.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Task</th><th>Client</th><th>Workstream</th>
              <th>Status</th><th>Due Date</th><th>Responsible</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Daily Task Report — ${date}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;
    color:#111;background:#fff;padding:32px 40px}
  .header{border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:28px}
  .header h1{font-size:22px;font-weight:800;color:#1e1b4b}
  .header .meta{font-size:12px;color:#6b7280;margin-top:6px;display:flex;gap:20px}
  .header .meta span{display:flex;align-items:center;gap:4px}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600}
  .badge-purple{background:#ede9fe;color:#5b21b6}
  .group{margin-bottom:28px;page-break-inside:avoid}
  .group-header{display:flex;align-items:center;justify-content:space-between;
    background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;
    padding:9px 14px;border-radius:8px 8px 0 0}
  .group-name{font-size:13px;font-weight:700}
  .group-count{font-size:11px;opacity:.75}
  table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;
    border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
  thead th{background:#f5f7ff;padding:8px 12px;text-align:left;
    font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff}
  tbody tr:nth-child(even){background:#fafaff}
  tbody td{padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top;color:#374151}
  tbody tr:last-child td{border-bottom:none}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;
    font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
  .disclaimer{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;
    padding:10px 14px;margin-bottom:20px;font-size:12px;color:#92400e}
  .disclaimer strong{display:block;margin-bottom:2px}
  @media print{body{padding:20px 24px}.group{page-break-inside:avoid}}
</style>
</head>
<body>
  <div class="header">
    <h1>Daily Task Report</h1>
    <div class="meta">
      <span>📅 ${date}</span>
      <span>🔍 Filter: <span class="badge badge-purple">${label}</span></span>
      <span>📋 ${totalTasks} total tasks across ${groups.length} employees/teams</span>
    </div>
  </div>
  <div class="disclaimer">
    <strong>⚠ Internal Use Only — Confidential</strong>
    This daily report includes employee names and task assignments. Do not share externally.
    Weekly and monthly client reports are sent without employee attribution.
  </div>
  ${groupsHTML}
  <div class="footer">
    <span>JZ Smart Media — Operations Hub</span>
    <span>Generated ${date} · Daily Report · Internal Only</span>
  </div>
</body>
</html>`
}

function downloadDailyReport(groups: EmployeeGroup[], statusFilter: StatusFilter, date: string) {
  const html = buildReportHTML(groups, statusFilter, date)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Daily-Task-Report-${date}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Status Filter Tabs ────────────────────────────────────────────────────────

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all',          label: 'All Tasks'    },
  { id: 'Done',         label: 'Done'         },
  { id: 'In Progress',  label: 'In Progress'  },
  { id: 'Not Started',  label: 'Not Started'  },
  { id: 'Blocked',      label: 'Blocked'      },
]

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface DailyReportModalProps {
  open: boolean
  onClose: () => void
}

export function DailyReportModal({ open, onClose }: DailyReportModalProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const today = todayDateEST()

  const { data: tasks = [], isLoading } = useAllTasksForReport()
  const { data: profiles = [] } = useProfiles()

  const groups = buildEmployeeGroups(tasks, profiles, statusFilter)
  const totalTasks = groups.reduce((n, g) => n + g.tasks.length, 0)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between gap-4 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Daily Task Report</h2>
              <p className="text-xs text-muted-foreground">{today} · Tasks grouped by employee</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadDailyReport(groups, statusFilter, today)}
              disabled={groups.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download HTML
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Status Filter ── */}
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Show:</span>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  statusFilter === f.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground bg-background',
                )}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''} · {groups.length} employee{groups.length !== 1 ? 's' : ''}/team{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Notice ── */}
        <div className="px-5 pt-3">
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <span className="text-amber-500 text-xs mt-0.5">⚠</span>
            <p className="text-xs text-amber-500/90">
              <strong>Internal only</strong> — This daily report includes employee names and responsibilities.
              Weekly and monthly client-facing reports do <em>not</em> show employee attribution.
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <FileText className="h-6 w-6 opacity-30" />
              <p className="text-sm">No tasks match the selected filter.</p>
            </div>
          )}

          {!isLoading && groups.map(group => (
            <EmployeeSection key={group.name} group={group} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Employee Section ─────────────────────────────────────────────────────────

function EmployeeSection({ group }: { group: EmployeeGroup }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-border">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold text-primary">{group.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tasks table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Task</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Client</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Workstream</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Due Date</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Responsible</th>
            </tr>
          </thead>
          <tbody>
            {group.tasks.map(task => (
              <DailyTaskRow key={task.id} task={task} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function DailyTaskRow({ task }: { task: EnrichedTask }) {
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-2.5">
        <p className="font-medium text-foreground line-clamp-1">{task.task_name}</p>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{task.clientName}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{task.workstream}</td>
      <td className="px-4 py-2.5">
        <span className={cn(
          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
          task.status === 'Done'        ? 'bg-green-500/15 text-green-400' :
          task.status === 'In Progress' ? 'bg-blue-500/15 text-blue-400' :
          task.status === 'Blocked'     ? 'bg-red-500/15 text-red-400' :
          'bg-muted text-muted-foreground'
        )}>
          {task.status}
        </span>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {task.due_date ? formatDateEST(task.due_date) : '—'}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {task.responsibles.length > 0 ? task.responsibles.join(', ') : '—'}
      </td>
    </tr>
  )
}
