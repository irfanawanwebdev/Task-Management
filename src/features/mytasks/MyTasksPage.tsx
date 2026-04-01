/**
 * MyTasksPage — Personal private task list for every user.
 * Tasks are visible only to the owner (RLS enforced).
 * Statuses: To Do | Done (no In Progress).
 * Optional Company field for context (stays private, not tied to client dashboard).
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/utils'
import {
  Plus, Check, Trash2, ChevronDown, Loader2, ListTodo,
  Pencil, X, Building2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonalTask {
  id: string
  user_id: string
  title: string
  description: string | null
  status: 'To Do' | 'Done'
  priority: 'Low' | 'Medium' | 'High'
  due_date: string | null
  company: string | null
  assignee_note: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  High:   'bg-red-500/10 text-red-400 border border-red-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Low:    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
}

const STATUS_FILTERS = ['All', 'To Do', 'Done'] as const
type Filter = typeof STATUS_FILTERS[number]

// ─── Task Form (shared for Add + Edit) ───────────────────────────────────────

interface TaskFormValues {
  title: string
  description: string
  priority: 'Low' | 'Medium' | 'High'
  due_date: string
  company: string
  assignee_note: string
}

const BLANK_FORM: TaskFormValues = {
  title: '', description: '', priority: 'Medium',
  due_date: '', company: '', assignee_note: '',
}

function TaskForm({
  initial,
  submitLabel,
  saving,
  onSubmit,
  onCancel,
}: {
  initial: TaskFormValues
  submitLabel: string
  saving: boolean
  onSubmit: (v: TaskFormValues) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<TaskFormValues>(initial)

  function field(key: keyof TaskFormValues, value: string) {
    setV(prev => ({ ...prev, [key]: value }))
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(v) }}
      className="rounded-xl border border-primary/30 bg-card p-4 space-y-3"
    >
      <input
        autoFocus
        value={v.title}
        onChange={e => field('title', e.target.value)}
        placeholder="Task title…"
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm
                   placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <textarea
        value={v.description}
        onChange={e => field('description', e.target.value)}
        placeholder="Description (optional)…"
        rows={2}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm
                   placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Priority</label>
          <select
            value={v.priority}
            onChange={e => field('priority', e.target.value)}
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
            value={v.due_date}
            onChange={e => field('due_date', e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Company (optional)</label>
          <input
            value={v.company}
            onChange={e => field('company', e.target.value)}
            placeholder="e.g. Nike, Internal…"
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Assignee note (optional)</label>
          <input
            value={v.assignee_note}
            onChange={e => field('assignee_note', e.target.value)}
            placeholder="e.g. For Yarden…"
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground
                     hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!v.title.trim() || saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground
                     text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

// ─── Add Task button / form ───────────────────────────────────────────────────

function AddTaskForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [open, setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(v: TaskFormValues) {
    if (!v.title.trim()) return
    setSaving(true)
    await supabase.from('personal_tasks').insert({
      user_id:       userId,
      title:         v.title.trim(),
      description:   v.description.trim() || null,
      priority:      v.priority,
      due_date:      v.due_date || null,
      company:       v.company.trim() || null,
      assignee_note: v.assignee_note.trim() || null,
      status:        'To Do',
    } as never)
    setSaving(false)
    setOpen(false)
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
    <TaskForm
      initial={BLANK_FORM}
      submitLabel="Add Task"
      saving={saving}
      onSubmit={handleSubmit}
      onCancel={() => setOpen(false)}
    />
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggleDone,
  onDelete,
  onEdit,
}: {
  task: PersonalTask
  onToggleDone: (id: string, done: boolean) => void
  onDelete: (id: string) => void
  onEdit: (task: PersonalTask) => void
}) {
  const isDone    = task.status === 'Done'
  const today     = new Date().toISOString().slice(0, 10)
  const isOverdue = task.due_date && task.due_date < today && !isDone

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border transition-all group',
      isDone
        ? 'border-border/30 bg-muted/10 opacity-60'
        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
    )}>
      {/* Done toggle */}
      <button
        onClick={() => onToggleDone(task.id, !isDone)}
        title={isDone ? 'Mark as To Do' : 'Mark as Done'}
        className={cn(
          'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
          isDone
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-muted-foreground/40 hover:border-primary',
        )}
      >
        {isDone && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
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
          {task.company && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md
                             bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Building2 className="h-2.5 w-2.5" />
              {task.company}
            </span>
          )}
          {task.assignee_note && (
            <span className="text-xs text-muted-foreground">→ {task.assignee_note}</span>
          )}
          {task.due_date && (
            <span className={cn('text-xs', isOverdue ? 'text-red-400 font-medium' : 'text-muted-foreground')}>
              {isOverdue ? '⚠ Overdue · ' : 'Due '}
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Edit + Delete (show on hover) */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(task)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Edit task"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Edit Overlay ─────────────────────────────────────────────────────────────

function EditTaskOverlay({
  task,
  onSave,
  onCancel,
}: {
  task: PersonalTask
  onSave: (v: TaskFormValues) => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleSubmit(v: TaskFormValues) {
    setSaving(true)
    await onSave(v)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">Edit Task</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <TaskForm
            initial={{
              title:         task.title,
              description:   task.description ?? '',
              priority:      task.priority,
              due_date:      task.due_date ?? '',
              company:       task.company ?? '',
              assignee_note: task.assignee_note ?? '',
            }}
            submitLabel="Save Changes"
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { user } = useAuth()
  const qc       = useQueryClient()
  const [filter, setFilter]       = useState<Filter>('All')
  const [editingTask, setEditing] = useState<PersonalTask | null>(null)

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

  const toggleDone = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      await supabase
        .from('personal_tasks')
        .update({ status: done ? 'Done' : 'To Do' } as never)
        .eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tasks', user?.id] }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('personal_tasks').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tasks', user?.id] }),
  })

  const editTask = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: TaskFormValues }) => {
      await supabase.from('personal_tasks').update({
        title:         v.title.trim(),
        description:   v.description.trim() || null,
        priority:      v.priority,
        due_date:      v.due_date || null,
        company:       v.company.trim() || null,
        assignee_note: v.assignee_note.trim() || null,
      } as never).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-tasks', user?.id] })
      setEditing(null)
    },
  })

  const filtered = filter === 'All' ? tasks : tasks.filter(t => t.status === filter)

  const total   = tasks.length
  const done    = tasks.filter(t => t.status === 'Done').length
  const pending = total - done
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0

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
          { label: 'Total',     value: total,   color: 'text-foreground' },
          { label: 'Pending',   value: pending, color: 'text-amber-400' },
          { label: 'Completed', value: done,    color: 'text-emerald-400' },
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
            {filter === 'All' ? 'No personal tasks yet. Add one above.' : `No "${filter}" tasks.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleDone={(id, done) => toggleDone.mutate({ id, done })}
              onDelete={id => deleteTask.mutate(id)}
              onEdit={t => setEditing(t)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pb-2">
        These tasks are private to you and count toward your personal completion stats.
      </p>

      {/* Edit overlay */}
      {editingTask && (
        <EditTaskOverlay
          task={editingTask}
          onSave={v => editTask.mutate({ id: editingTask.id, v })}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
