import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, CheckSquare, StickyNote, Info, Plus, Check, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/utils'
import type { Opportunity, OppTask, OppNote, OpportunityStage } from './types'
import { STAGE_LIST, STAGE_TASKS as ST, SOURCE_LABELS } from './types'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// ── Info Tab ───────────────────────────────────────────────────────────────

function InfoTab({
  opp, profiles, onSave, onDelete,
}: {
  opp: Opportunity
  profiles: { user_id: string; full_name: string }[]
  onSave: (updates: Partial<Opportunity>) => void
  onDelete: () => void
}) {
  const [form, setForm] = useState({
    business_name: opp.business_name,
    contact_name: opp.contact_name ?? '',
    contact_email: opp.contact_email ?? '',
    contact_phone: opp.contact_phone ?? '',
    source: opp.source,
    pipeline_stage: opp.pipeline_stage,
    assigned_to: opp.assigned_to ?? '',
  })
  const [dirty, setDirty] = useState(false)

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-muted-foreground mb-1">Business Name *</label>
          <input
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.business_name}
            onChange={e => set('business_name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Contact Name</label>
          <input
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.contact_name}
            onChange={e => set('contact_name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Source</label>
          <select
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.source}
            onChange={e => set('source', e.target.value)}
          >
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Email</label>
          <input
            type="email"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.contact_email}
            onChange={e => set('contact_email', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Phone</label>
          <input
            type="tel"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.contact_phone}
            onChange={e => set('contact_phone', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Pipeline Stage</label>
          <select
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.pipeline_stage}
            onChange={e => set('pipeline_stage', e.target.value)}
          >
            {STAGE_LIST.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Assigned To</label>
          <select
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.assigned_to}
            onChange={e => set('assigned_to', e.target.value)}
          >
            <option value="">Unassigned</option>
            {profiles.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete opportunity
        </button>
        {dirty && (
          <button
            onClick={() => { onSave(form); setDirty(false) }}
            disabled={!form.business_name.trim()}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Save Changes
          </button>
        )}
      </div>
    </div>
  )
}

// ── Tasks Tab ──────────────────────────────────────────────────────────────

function TasksTab({ oppId, stage }: { oppId: string; stage: OpportunityStage }) {
  const qc = useQueryClient()
  const [newTitle, setNewTitle] = useState('')

  const { data: tasks = [] } = useQuery({
    queryKey: ['opp_tasks', oppId],
    queryFn: async () => {
      const { data } = await supabase
        .from('opportunity_tasks')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('created_at')
      return (data ?? []) as OppTask[]
    },
  })

  const invalidateTasks = () => {
    qc.invalidateQueries({ queryKey: ['opp_tasks', oppId] })
    qc.invalidateQueries({ queryKey: ['opp_task_counts', oppId] })
  }

  const toggleStatus = useMutation({
    mutationFn: async (task: OppTask) => {
      const next: OppTask['status'] = task.status === 'done' ? 'pending' : 'done'
      await supabase.from('opportunity_tasks').update({ status: next } as never).eq('id', task.id)
    },
    onSuccess: invalidateTasks,
  })

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      await supabase.from('opportunity_tasks').insert({
        opportunity_id: oppId,
        title,
        stage,
        status: 'pending',
      } as never)
    },
    onSuccess: () => {
      invalidateTasks()
      qc.invalidateQueries({ queryKey: ['opportunities'] })
      setNewTitle('')
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('opportunity_tasks').delete().eq('id', id)
    },
    onSuccess: () => {
      invalidateTasks()
      qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
  })

  const byStage = STAGE_LIST.reduce<Record<string, OppTask[]>>((acc, s) => {
    acc[s.key] = tasks.filter(t => t.stage === s.key)
    return acc
  }, {})

  const stagesToShow = STAGE_LIST.filter(s => byStage[s.key].length > 0)
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <div className="space-y-4">
      {tasks.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {done}/{tasks.length} tasks complete
        </div>
      )}

      {stagesToShow.map(s => (
        <div key={s.key}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{s.label}</p>
          <div className="space-y-1">
            {byStage[s.key].map(task => (
              <div key={task.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleStatus.mutate(task)}
                  className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    task.status === 'done'
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border hover:border-primary',
                  )}
                >
                  {task.status === 'done' && <Check className="h-2.5 w-2.5" />}
                </button>
                <span className={cn(
                  'text-sm flex-1',
                  task.status === 'done' && 'line-through text-muted-foreground',
                )}>
                  {task.title}
                </span>
                <button
                  onClick={() => deleteTask.mutate(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No tasks yet. Tasks are auto-created when you advance the pipeline stage.
        </p>
      )}

      {/* Add custom task */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <input
          className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Add a task…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newTitle.trim()) addTask.mutate(newTitle.trim())
          }}
        />
        <button
          onClick={() => { if (newTitle.trim()) addTask.mutate(newTitle.trim()) }}
          disabled={!newTitle.trim() || addTask.isPending}
          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Notes Tab ──────────────────────────────────────────────────────────────

function NotesTab({ oppId }: { oppId: string }) {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [text, setText] = useState('')

  const { data: notes = [] } = useQuery({
    queryKey: ['opp_notes', oppId],
    queryFn: async () => {
      const { data } = await supabase
        .from('opportunity_notes')
        .select('*, author:created_by(full_name)')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as OppNote[]
    },
  })

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      await supabase.from('opportunity_notes').insert({
        opportunity_id: oppId,
        content,
        created_by: profile?.user_id ?? null,
      } as never)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opp_notes', oppId] })
      setText('')
    },
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('opportunity_notes').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opp_notes', oppId] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <textarea
          className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          rows={2}
          placeholder="Log a call, email, or meeting note…"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button
          onClick={() => { if (text.trim()) addNote.mutate(text.trim()) }}
          disabled={!text.trim() || addNote.isPending}
          className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 self-end"
        >
          {addNote.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
        </button>
      </div>

      <div className="space-y-3">
        {notes.map(note => (
          <div key={note.id} className="group flex gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <button
                  onClick={() => deleteNote.mutate(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {note.author?.full_name ?? 'Team'} · {fmtDate(note.created_at)}
              </p>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>
        )}
      </div>
    </div>
  )
}

// ── Main Dialog ────────────────────────────────────────────────────────────

type Tab = 'info' | 'tasks' | 'notes'

export function OpportunityDetailDialog({
  oppId,
  onClose,
}: {
  oppId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('info')

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').order('full_name')
      return (data ?? []) as { user_id: string; full_name: string }[]
    },
    staleTime: 60_000,
  })

  const { data: opp, isLoading } = useQuery({
    queryKey: ['opportunity', oppId],
    queryFn: async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('*, assignee:assigned_to(full_name)')
        .eq('id', oppId)
        .single()
      return data as unknown as Opportunity
    },
  })

  const save = useMutation({
    mutationFn: async (updates: Partial<Opportunity> & { pipeline_stage?: OpportunityStage }) => {
      const oldStage = opp?.pipeline_stage
      const newStage = updates.pipeline_stage

      // Clean up null-able fields
      const payload: Record<string, unknown> = { ...updates }
      if (payload.assigned_to === '') payload.assigned_to = null
      if (payload.contact_name === '') payload.contact_name = null
      if (payload.contact_email === '') payload.contact_email = null
      if (payload.contact_phone === '') payload.contact_phone = null

      await supabase.from('opportunities').update(payload as never).eq('id', oppId)

      // Auto-create stage tasks when advancing to a new stage
      if (newStage && newStage !== oldStage) {
        const stageTasks = ST[newStage as keyof typeof ST] ?? []
        if (stageTasks.length > 0) {
          // Check if tasks for this stage already exist
          const { data: existing } = await supabase
            .from('opportunity_tasks')
            .select('id')
            .eq('opportunity_id', oppId)
            .eq('stage', newStage)
          const existingList = (existing ?? []) as unknown as { id: string }[]
          if (existingList.length === 0) {
            await supabase.from('opportunity_tasks').insert(
              stageTasks.map((title: string) => ({
                opportunity_id: oppId,
                title,
                stage: newStage,
                status: 'pending',
              })) as never[]
            )
          }
        }
        qc.invalidateQueries({ queryKey: ['opp_tasks', oppId] })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity', oppId] })
      qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
  })

  const del = useMutation({
    mutationFn: async () => {
      await supabase.from('opportunities').delete().eq('id', oppId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities'] })
      onClose()
    },
  })

  // Task counts for badge (separate key so it doesn't collide with TasksTab's array result)
  const { data: taskCounts } = useQuery({
    queryKey: ['opp_task_counts', oppId],
    queryFn: async () => {
      const { data } = await supabase.from('opportunity_tasks').select('status').eq('opportunity_id', oppId)
      const all = data ?? []
      return { total: all.length, done: all.filter((t: { status: string }) => t.status === 'done').length }
    },
  })

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'info', label: 'Info', icon: Info },
    { key: 'tasks', label: `Tasks${taskCounts?.total ? ` (${taskCounts.done}/${taskCounts.total})` : ''}`, icon: CheckSquare },
    { key: 'notes', label: 'Notes', icon: StickyNote },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div className="min-w-0">
            {isLoading ? (
              <div className="h-5 w-48 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <h2 className="text-lg font-semibold truncate">{opp?.business_name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StageBadge stage={opp?.pipeline_stage ?? 'new_lead'} />
                  {opp?.contact_name && (
                    <span className="text-xs text-muted-foreground">{opp.contact_name}</span>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors',
                  tab === t.key
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : opp ? (
            <>
              {tab === 'info' && (
                <InfoTab
                  opp={opp}
                  profiles={profiles}
                  onSave={updates => save.mutate(updates)}
                  onDelete={() => del.mutate()}
                />
              )}
              {tab === 'tasks' && <TasksTab oppId={oppId} stage={opp.pipeline_stage} />}
              {tab === 'notes' && <NotesTab oppId={oppId} />}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Exported helper badge ──────────────────────────────────────────────────

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  const s = STAGE_LIST.find(s => s.key === stage)
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', s?.badgeCls ?? 'bg-muted text-muted-foreground')}>
      {s?.label ?? stage}
    </span>
  )
}
