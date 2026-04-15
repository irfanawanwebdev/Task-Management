/**
 * Specialist Dashboard — JZ Operations Hub
 * Personal workspace for Specialists and Account Managers.
 * Shows assigned tasks, blockers, and meetings for the logged-in user.
 */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, Clock, AlertTriangle, Calendar, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import type { DeliveryTask, Meeting } from '@/lib/types'
import { isOverdueEST, formatDateEST, todayDateEST, isDateTodayEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'

// ─── Data Hooks ───────────────────────────────────────────────────────────────

function useMyTasks(userId: string | undefined) {
  return useQuery<DeliveryTask[]>({
    queryKey: ['my-tasks', userId],
    enabled: !!userId,
    queryFn: async () => {
      // Tasks assigned to me via task_assignments
      const { data: assignments, error: aErr } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', userId!)
      if (aErr) throw aErr

      const taskIds = (assignments ?? []).map(a => (a as { task_id: string }).task_id)
      if (taskIds.length === 0) return []

      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*, clients(name)')
        .in('id', taskIds)
        .neq('status', 'Done')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as unknown as DeliveryTask[]
    },
  })
}

function useMyMeetings() {
  return useQuery<Meeting[]>({
    queryKey: ['upcoming-meetings-specialist'],
    queryFn: async () => {
      const today = todayDateEST()
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 14)
      const futureStr = nextWeek.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('meetings')
        .select('*, clients(name)')
        .gte('date', today)
        .lte('date', futureStr)
        .order('date')
        .limit(10)
      if (error) throw error
      return (data ?? []) as unknown as Meeting[]
    },
  })
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SpecialistDashboard() {
  const navigate = useNavigate()
  const { profile, role } = useAuth()
  const { data: tasks,    isLoading: tasksLoading }    = useMyTasks(profile?.user_id)
  const { data: meetings, isLoading: meetingsLoading } = useMyMeetings()

  const dueToday  = tasks?.filter(t => t.due_date && isDateTodayEST(t.due_date)) ?? []
  const overdue   = tasks?.filter(t => t.due_date && isOverdueEST(t.due_date)) ?? []
  const blocked   = tasks?.filter(t => t.status === 'Blocked') ?? []
  const dueInWeek = tasks?.filter(t => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    const now = new Date()
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  }) ?? []

  const isLoading = tasksLoading || meetingsLoading

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const roleLabel = role?.replace('_', ' ') ?? ''

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">
          {roleLabel} · {formatDateEST(todayDateEST())}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your tasks…
        </div>
      )}

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <p className="metric-label">My Tasks</p>
          </div>
          <p className="metric-value">{tasks?.length ?? '—'}</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="metric-label">Due This Week</p>
          </div>
          <p className={cn('metric-value', dueInWeek.length > 0 ? 'text-[hsl(var(--warning))]' : '')}>
            {dueInWeek.length}
          </p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <p className="metric-label">Blocked</p>
          </div>
          <p className={cn('metric-value', blocked.length > 0 ? 'text-destructive' : '')}>
            {blocked.length}
          </p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="metric-label">Meetings</p>
          </div>
          <p className="metric-value">{meetings?.length ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="space-y-4">
          {/* Due today */}
          {dueToday.length > 0 && (
            <section>
              <p className="section-header">Due Today</p>
              <div className="space-y-2">
                {dueToday.map(t => <TaskRow key={t.id} task={t} onOpen={() => navigate(`/tasks?task=${t.id}`)} />)}
              </div>
            </section>
          )}

          {/* Overdue */}
          {overdue.length > 0 && (
            <section>
              <p className="section-header text-destructive">Overdue ({overdue.length})</p>
              <div className="space-y-2">
                {overdue.map(t => <TaskRow key={t.id} task={t} overdue onOpen={() => navigate(`/tasks?task=${t.id}`)} />)}
              </div>
            </section>
          )}

          {/* All upcoming */}
          <section>
            <p className="section-header">All My Tasks</p>
            {!tasks || tasks.length === 0 ? (
              <div className="metric-card text-center py-8">
                <CheckSquare className="h-8 w-8 text-[hsl(var(--success))] mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(t => <TaskRow key={t.id} task={t} overdue={!!t.due_date && isOverdueEST(t.due_date)} onOpen={() => navigate(`/tasks?task=${t.id}`)} />)}
              </div>
            )}
          </section>
        </div>

        {/* Upcoming Meetings */}
        <section>
          <p className="section-header">Upcoming Meetings</p>
          {!meetings || meetings.length === 0 ? (
            <div className="metric-card text-center py-8">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {meetings.map(m => (
                <div key={m.id} className="metric-card py-2.5 px-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{m.clients?.name ?? '—'}</p>
                    <span className={cn('status-badge shrink-0',
                      m.status === 'Completed' ? 'status-done' :
                      m.status === 'Scheduled' ? 'status-in-progress' :
                      'status-not-started'
                    )}>
                      {m.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateEST(m.date)} · {m.type}
                  </p>
                  {m.meeting_link && (
                    <a
                      href={m.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                    >
                      Join Meeting →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, overdue = false, onOpen }: { task: DeliveryTask; overdue?: boolean; onOpen?: () => void }) {
  return (
    <div
      onClick={onOpen}
      className={cn(
        'metric-card py-2.5 px-3',
        overdue && 'border-destructive/30 bg-destructive/5',
        onOpen && 'cursor-pointer hover:bg-accent/50 transition-colors',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.task_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {task.clients?.name} · {task.workstream} · Step {task.step}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn(
            'status-badge',
            task.status === 'In Progress' ? 'status-in-progress' :
            task.status === 'Blocked'     ? 'status-blocked' :
            'status-not-started'
          )}>
            {task.status}
          </span>
          {task.due_date && (
            <span className={cn('text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
              {formatDateEST(task.due_date)}
            </span>
          )}
        </div>
      </div>
      {task.impact_level === 'High' && (
        <div className="mt-1.5">
          <span className="severity-high">High Impact</span>
        </div>
      )}
    </div>
  )
}
