/**
 * Team Workload Page — /workload
 * Shows each team member's active task count, due-this-week, overdue, blocked,
 * and overall workload status (Healthy / Busy / Overloaded).
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, Loader2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Profile, DeliveryTask, TeamWorkloadRow } from '@/lib/types'
import { getWorkloadStatus } from '@/lib/types'
import { todayDateEST, isOverdueEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'

// ─── Data Hooks ───────────────────────────────────────────────────────────────

function useWorkload(): { data: TeamWorkloadRow[]; isLoading: boolean } {
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery<Profile[]>({
    queryKey: ['profiles-workload'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return (data ?? []) as unknown as Profile[]
    },
  })

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<{
    user_id: string | null
    delivery_tasks: DeliveryTask | null
  }[]>({
    queryKey: ['task-assignments-workload'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_assignments')
        .select('user_id, delivery_tasks(*)')
        .not('user_id', 'is', null)
      if (error) throw error
      return (data ?? []) as unknown as { user_id: string | null; delivery_tasks: DeliveryTask | null }[]
    },
  })

  if (loadingProfiles || loadingAssignments) {
    return { data: [], isLoading: true }
  }

  const today = todayDateEST()
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const nextWeekStr = nextWeek.toISOString().slice(0, 10)

  const rows: TeamWorkloadRow[] = profiles.map(profile => {
    const myAssignments = assignments.filter(a => a.user_id === profile.user_id)
    const myTasks = myAssignments
      .map(a => a.delivery_tasks)
      .filter((t): t is DeliveryTask => t !== null)

    const active    = myTasks.filter(t => t.status !== 'Done')
    const overdue   = myTasks.filter(t => t.status !== 'Done' && t.due_date && isOverdueEST(t.due_date))
    const blocked   = myTasks.filter(t => t.status === 'Blocked')
    const dueWeek   = myTasks.filter(t =>
      t.status !== 'Done' && t.due_date && t.due_date >= today && t.due_date <= nextWeekStr,
    )
    const completed = myTasks.filter(t => t.status === 'Done')

    return {
      user_id:         profile.user_id,
      full_name:       profile.full_name,
      department:      profile.department,
      active_tasks:    active.length,
      due_this_week:   dueWeek.length,
      overdue_tasks:   overdue.length,
      blocked_tasks:   blocked.length,
      completed_total: completed.length,
      workload_status: getWorkloadStatus(active.length),
    }
  })

  return { data: rows, isLoading: false }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function WorkloadBadge({ status }: { status: TeamWorkloadRow['workload_status'] }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
      status === 'Healthy'    && 'bg-green-100 text-green-700',
      status === 'Busy'       && 'bg-amber-100 text-amber-700',
      status === 'Overloaded' && 'bg-red-100 text-red-700',
    )}>
      {status}
    </span>
  )
}

function DepartmentLabel({ dept }: { dept: Profile['department'] }) {
  if (!dept) return <span className="text-muted-foreground text-xs">—</span>
  const labels: Record<string, string> = {
    operations: 'Operations',
    web_dev: 'Web/Dev',
    seo: 'SEO',
    ads: 'Ads/PPC',
    social: 'Social',
    account_management: 'Account Mgmt',
    executive: 'Executive',
  }
  return <span className="text-xs text-muted-foreground">{labels[dept] ?? dept}</span>
}

function StatCell({ value, alert }: { value: number; alert?: boolean }) {
  return (
    <td className={cn(
      'px-4 py-3 text-sm font-medium text-center',
      alert && value > 0 ? 'text-red-600' : 'text-foreground',
    )}>
      {value}
    </td>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent }: {
  label: string; value: number; accent?: 'green' | 'amber' | 'red'
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn(
        'mt-1 text-2xl font-bold',
        accent === 'green' && 'text-green-600',
        accent === 'amber' && 'text-amber-600',
        accent === 'red'   && 'text-red-600',
        !accent            && 'text-foreground',
      )}>
        {value}
      </p>
    </div>
  )
}

// ─── Department Summary ───────────────────────────────────────────────────────

const DEPT_LABELS: Record<string, string> = {
  operations: 'Operations',
  web_dev: 'Web/Dev',
  seo: 'SEO',
  ads: 'Ads/PPC',
  social: 'Social',
  account_management: 'Account Mgmt',
  executive: 'Executive',
}

function DeptSummaryTable({ rows }: { rows: TeamWorkloadRow[] }) {
  const depts = Array.from(new Set(rows.map(r => r.department).filter(Boolean))) as string[]

  const deptStats = depts.map(dept => {
    const members = rows.filter(r => r.department === dept)
    return {
      dept,
      members: members.length,
      active: members.reduce((s, m) => s + m.active_tasks, 0),
      overdue: members.reduce((s, m) => s + m.overdue_tasks, 0),
      blocked: members.reduce((s, m) => s + m.blocked_tasks, 0),
      overloaded: members.filter(m => m.workload_status === 'Overloaded').length,
    }
  })

  if (deptStats.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-lg border shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Department</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Members</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Active Tasks</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Overdue</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Blocked</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Overloaded</th>
          </tr>
        </thead>
        <tbody>
          {deptStats.map(d => (
            <tr key={d.dept} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium text-sm">{DEPT_LABELS[d.dept] ?? d.dept}</td>
              <td className="px-4 py-2.5 text-center text-sm">{d.members}</td>
              <td className="px-4 py-2.5 text-center text-sm">{d.active}</td>
              <td className={cn('px-4 py-2.5 text-center text-sm font-medium', d.overdue > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {d.overdue}
              </td>
              <td className={cn('px-4 py-2.5 text-center text-sm font-medium', d.blocked > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                {d.blocked}
              </td>
              <td className={cn('px-4 py-2.5 text-center text-sm font-medium', d.overloaded > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {d.overloaded}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkloadPage() {
  const { data: rows, isLoading } = useWorkload()
  const [deptFilter, setDeptFilter] = useState('all')

  const allDepts = Array.from(new Set(rows.map(r => r.department).filter(Boolean))) as string[]
  const filteredRows = deptFilter === 'all' ? rows : rows.filter(r => r.department === deptFilter)

  const healthy    = filteredRows.filter(r => r.workload_status === 'Healthy').length
  const busy       = filteredRows.filter(r => r.workload_status === 'Busy').length
  const overloaded = filteredRows.filter(r => r.workload_status === 'Overloaded').length
  const totalActive = filteredRows.reduce((sum, r) => sum + r.active_tasks, 0)
  const totalOverdue = filteredRows.reduce((sum, r) => sum + r.overdue_tasks, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            Team Workload
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Active task distribution across all team members
          </p>
        </div>
        {/* Department filter */}
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Departments</option>
          {allDepts.map(d => (
            <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Total Members" value={filteredRows.length} />
        <SummaryCard label="Healthy"    value={healthy}    accent="green" />
        <SummaryCard label="Busy"       value={busy}       accent="amber" />
        <SummaryCard label="Overloaded" value={overloaded} accent="red" />
        <SummaryCard label="Total Active Tasks" value={totalActive} />
      </div>

      {/* Alert banner */}
      {(overloaded > 0 || totalOverdue > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {overloaded > 0 && (
            <span className="font-medium">{overloaded} team member{overloaded > 1 ? 's' : ''} overloaded.</span>
          )}
          {totalOverdue > 0 && (
            <span className="ml-2">{totalOverdue} overdue task{totalOverdue > 1 ? 's' : ''} across the team.</span>
          )}
          <span className="ml-1">Consider rebalancing assignments.</span>
        </div>
      )}

      {/* Department Summary (only shown when "All Departments" selected) */}
      {!isLoading && deptFilter === 'all' && rows.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Department Summary
          </p>
          <DeptSummaryTable rows={rows} />
        </div>
      )}

      {/* Workload Table */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
          <Users className="h-8 w-8" />
          <p className="text-sm">No active team members found</p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Individual Workload
          </p>
          <div className="overflow-x-auto rounded-lg border shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Team Member</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Department</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Active</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Due This Week</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Overdue</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Blocked</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Completed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr
                    key={row.user_id}
                    className={cn(
                      'border-b transition-colors',
                      row.workload_status === 'Overloaded' && 'bg-red-50/30',
                      row.workload_status === 'Busy'       && 'bg-amber-50/20',
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{row.full_name}</td>
                    <td className="px-4 py-3"><DepartmentLabel dept={row.department} /></td>
                    <StatCell value={row.active_tasks} />
                    <StatCell value={row.due_this_week} alert />
                    <StatCell value={row.overdue_tasks} alert />
                    <StatCell value={row.blocked_tasks} alert />
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground">
                      {row.completed_total}
                    </td>
                    <td className="px-4 py-3">
                      <WorkloadBadge status={row.workload_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          Healthy: ≤8 active tasks
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
          Busy: 9–14 active tasks
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          Overloaded: 15+ active tasks
        </div>
      </div>
    </div>
  )
}
