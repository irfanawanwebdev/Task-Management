/**
 * MyTasksPage — Personal private task list for every user.
 * Tasks are visible only to the owner (RLS enforced).
 * Completed personal tasks count toward the user's overall completion stats.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/utils'
import { Plus, Check, Trash2, ChevronDown, Circle, Loader2, ListTodo } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonalTask {
  id: string
  user_id: string
  title: string
  description: string | null
  status: 'To Do' | 'In Progress' | 'Done'
  priority: 'Low' | 'Medium' | 'High'
  due_date: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  High:   'bg-red-500/10 text-red-400 border border-red-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Low:    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
}

const STATUS_FILTERS = ['All', 'To Do', 'In Progress', 'Done'] as const
type Filter = typeof STATUS_FILTERS[number]

// ─── Add Task Form ────────────────────────────────────────────────────────────

function AddTaskForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium')
  const [dueDate, setDueDate]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [open, setOpen]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await supabase.from('personal_tasks').insert({
      user_id:     userId,
      title:       title.trim(),
      description: description.trim() || null,
      priority,
      due_date:    dueDate || null,
      status:      'To Do',
    } as never)
    setTitle('')
    setDesc('')
    setPriority('Medium')
    setDueDate('')
    setOpen(false)
    setSaving(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border
                   text-sm text-muted-foreground hover:text-foreground hover:border-primary/50
                   hover:bg-primary/5 transition-all w-full"
      >
        <Plus className="h-4 w-4" />
        Add personal task…
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title…"
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm
                   placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <textarea
        value={description}
        onChange={e => setDesc(e.target.value)}
        placeholder="Description (optional)…"
        rows={2}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm
                   placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as 'Low' | 'Medium' | 'High')}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Due date (optional)</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground
                     hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground
                     text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add Task
        </button>
      </div>
    </form>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onStatusChange,
  onDelete,
}: {
  task: PersonalTask
  onStatusChange: (id: string, status: PersonalTask['status']) => void
  onDelete: (id: string) => void
}) {
  const isDone = task.status === 'Done'
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && !isDone

  function cycleStatus() {
    const next: Record<PersonalTask['status'], PersonalTask['status']> = {
      'To Do': 'In Progress',
      'In Progress': 'Done',
      'Done': 'To Do',
    }
    onStatusChange(task.id, next[task.status])
  }

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border transition-all group',
      isDone
        ? 'border-border/30 bg-muted/10 opacity-60'
        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
    )}>
      {/* Status toggle */}
      <button
        onClick={cycleStatus}
        title={`Mark as ${task.status === 'Done' ? 'To Do' : task.status === 'To Do' ? 'In Progress' : 'Done'}`}
        className={cn(
          'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
          isDone
            ? 'bg-emerald-500 border-emerald-500'
            : task.status === 'In Progress'
            ? 'border-blue-400 bg-blue-400/10'
            : 'border-muted-foreground/40 hover:border-primary',
        )}
      >
        {isDone && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        {task.status === 'In Progress' && <Circle className="h-2 w-2 fill-blue-400 text-blue-400" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', isDone && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', PRIORITY_STYLES[task.priority])}>
            {task.priority}
          </span>
          {task.status !== 'Done' && task.status !== 'To Do' && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              In Progress
            </span>
          )}
          {task.due_date && (
            <span className={cn(
              'text-xs',
              isOverdue ? 'text-red-400 font-medium' : 'text-muted-foreground',
            )}>
              {isOverdue ? '⚠ Overdue · ' : 'Due '}
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded
                   text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('All')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['personal-tasks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_tasks')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      return (data ?? []) as PersonalTask[]
    },
    enabled: !!user,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PersonalTask['status'] }) => {
      await supabase.from('personal_tasks').update({ status } as never).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tasks', user?.id] }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('personal_tasks').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tasks', user?.id] }),
  })

  const filtered = filter === 'All' ? tasks : tasks.filter(t => t.status === filter)

  const total    = tasks.length
  const done     = tasks.filter(t => t.status === 'Done').length
  const inProg   = tasks.filter(t => t.status === 'In Progress').length
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
          <ListTodo className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">My Tasks</h1>
          <p className="text-sm text-muted-foreground">Personal tasks — only visible to you</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',       value: total,  color: 'text-foreground' },
          { label: 'In Progress', value: inProg,  color: 'text-blue-400' },
          { label: 'Completed',   value: done,    color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Completion</span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {f}
            {f !== 'All' && (
              <span className="ml-1.5 opacity-60">
                {tasks.filter(t => t.status === f).length}
              </span>
            )}
          </button>
        ))}
        {filter !== 'All' && (
          <button
            onClick={() => setFilter('All')}
            className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-90 inline" /> Clear
          </button>
        )}
      </div>

      {/* Add task */}
      {user && (
        <AddTaskForm
          userId={user.id}
          onAdded={() => qc.invalidateQueries({ queryKey: ['personal-tasks', user.id] })}
        />
      )}

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ListTodo className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {filter === 'All' ? 'No personal tasks yet. Add one above.' : `No tasks with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
              onDelete={id => deleteTask.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Privacy note */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        These tasks are private to you and count toward your personal completion stats.
      </p>
    </div>
  )
}
