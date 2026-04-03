/**
 * MyTasksPage — Personal private task list for every user.
 * Tasks are visible only to the owner (RLS enforced).
 * Statuses: To Do | Done (no In Progress).
 * Assignees: up to 3 real users from profiles (internal visibility only, no workload impact).
 * Company: contextual label picked from clients list or typed freely.
 */

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/utils'
import {
  Plus, Check, Trash2, ChevronDown, Loader2, ListTodo,
  Pencil, X, Building2, User,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignee { id: string; name: string }  // id = profile.user_id

interface PersonalTask {
  id: string
  user_id: string
  title: string
  description: string | null
  status: 'To Do' | 'Done'
  priority: 'Low' | 'Medium' | 'High'
  due_date: string | null
  company: string | null
  assignees: Assignee[]
  created_at: string
}

interface ProfileOption { id: string; name: string }  // id = user_id

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  High: 'bg-red-500/10 text-red-400 border border-red-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
}

const STATUS_FILTERS = ['All', 'To Do', 'Done'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

// ─── Task Form values ─────────────────────────────────────────────────────────

interface TaskFormValues {
  title: string
  description: string
  priority: 'Low' | 'Medium' | 'High'
  due_date: string
  company: string
  assignees: Assignee[]
}

const BLANK_FORM: TaskFormValues = {
  title: '', description: '', priority: 'Medium',
  due_date: '', company: '', assignees: [],
}

// ─── Assignee multi-select picker ─────────────────────────────────────────────

function AssigneePicker({
  value,
  onChange,
  profiles,
}: {
  value: Assignee[]
  onChange: (v: Assignee[]) => void
  profiles: ProfileOption[]
}) {
  const [open, setOpen] = useState(false)

  function toggle(p: ProfileOption) {
    const isSelected = value.some(a => a.id === p.id)
    if (isSelected) {
      onChange(value.filter(a => a.id !== p.id))
    } else if (value.length < 3) {
      onChange([...value, { id: p.id, name: p.name }])
    }
  }

  return (
    <div className="relative">
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative z-20 min-h-[34px] bg-background border border-border rounded-lg',
          'px-2 py-1 cursor-pointer flex flex-wrap gap-1 items-center',
          open && 'ring-1 ring-primary border-primary',
        )}
      >
        {value.length === 0 ? (
          <span className="text-sm text-muted-foreground py-0.5">Select up to 3…</span>
        ) : (
          value.map(a => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 text-xs bg-violet-500/10 text-violet-400
                         border border-violet-500/20 rounded-md px-1.5 py-0.5"
            >
              <User className="h-2.5 w-2.5" />
              {a.name}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggle({ id: a.id, name: a.name }) }}
                className="hover:text-violet-200 ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className={cn(
          'h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 transition-transform',
          open && 'rotate-180',
        )} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border
                        rounded-lg shadow-xl z-20 max-h-44 overflow-y-auto">
          {profiles.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No users found.</p>
          ) : profiles.map(p => {
            const selected = value.some(a => a.id === p.id)
            const atMax = !selected && value.length >= 3
            return (
              <button
                key={p.id}
                type="button"
                disabled={atMax}
                onClick={() => toggle(p)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left',
                  selected ? 'text-violet-400 bg-violet-500/5 hover:bg-violet-500/10'
                    : 'hover:bg-accent',
                  atMax && 'opacity-40 cursor-not-allowed',
                )}
              >
                <div className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  selected
                    ? 'bg-violet-500 border-violet-500'
                    : 'border-muted-foreground/40',
                )}>
                  {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                {p.name}
              </button>
            )
          })}
          {value.length >= 3 && (
            <p className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
              Max 3 assignees reached
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Task Form (shared for Add + Edit) ───────────────────────────────────────

function TaskForm({
  initial,
  submitLabel,
  saving,
  profiles,
  companyOptions,
  onSubmit,
  onCancel,
}: {
  initial: TaskFormValues
  submitLabel: string
  saving: boolean
  profiles: ProfileOption[]
  companyOptions: string[]
  onSubmit: (v: TaskFormValues) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<TaskFormValues>(initial)
  const datalistId = useRef(`company-dl-${Math.random().toString(36).slice(2)}`).current

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
            list={datalistId}
            placeholder="e.g. Nike, Internal…"
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id={datalistId}>
            {companyOptions.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Assignees (optional · max 3)
          </label>
          <AssigneePicker
            value={v.assignees}
            onChange={assignees => setV(prev => ({ ...prev, assignees }))}
            profiles={profiles}
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

function AddTaskForm({
  userId,
  profiles,
  companyOptions,
  onAdded,
}: {
  userId: string
  profiles: ProfileOption[]
  companyOptions: string[]
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(v: TaskFormValues) {
    if (!v.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('personal_tasks').insert({
      user_id: userId,
      title: v.title.trim(),
      description: v.description.trim() || null,
      priority: v.priority,
      due_date: v.due_date || null,
      company: v.company.trim() || null,
      assignees: v.assignees,
      status: 'To Do',
    } as never)
    setSaving(false)
    if (error) { alert(error.message); return }
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
      profiles={profiles}
      companyOptions={companyOptions}
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
  const isDone = task.status === 'Done'
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = task.due_date && task.due_date < today && !isDone
  const assignees = Array.isArray(task.assignees) ? task.assignees : []

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
          {/* Assignee badges (purple) */}
          {assignees.map(a => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md
                         bg-violet-500/10 text-violet-400 border border-violet-500/20"
            >
              <User className="h-2.5 w-2.5" />
              {a.name}
            </span>
          ))}
          {/* Company — shown as muted arrow text */}
          {task.company && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-2.5 w-2.5" />
              {task.company}
            </span>
          )}
          {task.due_date && (
            <span className={cn('text-xs', isOverdue ? 'text-red-400 font-medium' : 'text-muted-foreground')}>
              {isOverdue ? '⚠ Overdue · ' : 'Due '}
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Edit + Delete */}
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
  profiles,
  companyOptions,
  onSave,
  onCancel,
  error,
}: {
  task: PersonalTask
  profiles: ProfileOption[]
  companyOptions: string[]
  onSave: (v: TaskFormValues) => void
  onCancel: () => void
  error: string | null
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
        {error && (
          <p className="mx-4 mt-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="p-4">
          <TaskForm
            initial={{
              title: task.title,
              description: task.description ?? '',
              priority: task.priority,
              due_date: task.due_date ?? '',
              company: task.company ?? '',
              assignees: Array.isArray(task.assignees) ? task.assignees : [],
            }}
            submitLabel="Save Changes"
            saving={saving}
            profiles={profiles}
            companyOptions={companyOptions}
            onSubmit={handleSubmit}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page  ────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')  // profile.user_id or ''
  const [editingTask, setEditing] = useState<PersonalTask | null>(null)

  // ── Data queries ──────────────────────────────────────────────────────────

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

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_active', true)
        .order('full_name')
      return (data ?? []).map(p => ({ id: p.user_id, name: p.full_name })) as ProfileOption[]
    },
  })

  const { data: companyOptions = [] } = useQuery({
    queryKey: ['client-names-options'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('name').order('name')
      return (data ?? []).map(c => c.name as string)
    },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────

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
      const { error } = await supabase.from('personal_tasks').update({
        title: v.title.trim(),
        description: v.description.trim() || null,
        priority: v.priority,
        due_date: v.due_date || null,
        company: v.company.trim() || null,
        assignees: v.assignees,
      } as never).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-tasks', user?.id] })
      setEditing(null)
    },
  })

  // ── Filtering ─────────────────────────────────────────────────────────────

  let filtered = statusFilter === 'All' ? tasks : tasks.filter(t => t.status === statusFilter)
  if (assigneeFilter) {
    filtered = filtered.filter(t =>
      Array.isArray(t.assignees) && t.assignees.some(a => a.id === assigneeFilter)
    )
  }

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'Done').length
  const pending = total - done
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const hasAnyFilter = statusFilter !== 'All' || assigneeFilter !== ''

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
          { label: 'Total', value: total, color: 'text-foreground' },
          { label: 'Pending', value: pending, color: 'text-amber-400' },
          { label: 'Completed', value: done, color: 'text-emerald-400' },
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

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Status filters */}
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              statusFilter === f
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

        {/* Assignee filter */}
        <div className="relative ml-auto">
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className={cn(
              'pl-7 pr-3 py-1.5 rounded-lg text-xs font-medium transition-colors appearance-none cursor-pointer',
              'bg-muted/40 text-muted-foreground hover:bg-muted focus:outline-none',
              assigneeFilter && 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
            )}
          >
            <option value="">All people</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Clear filters */}
        {hasAnyFilter && (
          <button
            onClick={() => { setStatusFilter('All'); setAssigneeFilter('') }}
            className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5 inline" /> Clear
          </button>
        )}
      </div>

      {/* Add task */}
      {user && (
        <AddTaskForm
          userId={user.id}
          profiles={profiles}
          companyOptions={companyOptions}
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
            {!hasAnyFilter ? 'No personal tasks yet. Add one above.' : 'No tasks match the current filters.'}
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
          profiles={profiles}
          companyOptions={companyOptions}
          onSave={v => editTask.mutate({ id: editingTask.id, v })}
          onCancel={() => setEditing(null)}
          error={editTask.error ? (editTask.error as Error).message : null}
        />
      )}
    </div>
  )
}
