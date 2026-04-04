import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Target, Loader2, User, GripVertical, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/utils'
import {
  STAGE_LIST, SOURCE_LABELS, SOURCE_BADGE,
  type Opportunity, type OpportunityStage, type OpportunitySource,
  STAGE_TASKS,
} from './types'
import { OpportunityDetailDialog } from './OpportunityDetailDialog'

// ── Add Opportunity Dialog ─────────────────────────────────────────────────

function AddOpportunityDialog({
  defaultStage,
  profiles,
  onClose,
}: {
  defaultStage: OpportunityStage
  profiles: { user_id: string; full_name: string }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    source: 'manual' as OpportunitySource,
    pipeline_stage: defaultStage,
    assigned_to: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!form.business_name.trim()) { setError('Business name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('opportunities').insert({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        source: form.source,
        pipeline_stage: form.pipeline_stage,
        assigned_to: form.assigned_to || null,
        created_by: profile?.user_id ?? null,
      } as never).select('id').single()

      if (err) throw err

      const newId = (data as unknown as { id: string } | null)?.id

      const stageTasks = STAGE_TASKS[form.pipeline_stage as keyof typeof STAGE_TASKS] ?? []
      if (stageTasks.length > 0 && newId) {
        await supabase.from('opportunity_tasks').insert(
          stageTasks.map((title: string) => ({
            opportunity_id: newId,
            title,
            stage: form.pipeline_stage,
            status: 'pending',
          })) as never[]
        )
      }

      qc.invalidateQueries({ queryKey: ['opportunities'] })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create opportunity')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Add Lead</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Business Name *</label>
            <input
              autoFocus
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Acme Roofing"
              value={form.business_name}
              onChange={e => set('business_name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.business_name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Lead
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Opportunity Card ───────────────────────────────────────────────────────

function OppCard({
  opp,
  onClick,
  onAdvance,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  opp: Opportunity & { task_total: number; task_done: number }
  onClick: () => void
  onAdvance: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const stageIdx = STAGE_LIST.findIndex(s => s.key === opp.pipeline_stage)
  const canAdvance = stageIdx >= 0 && stageIdx < STAGE_LIST.length - 2

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group bg-background border border-border rounded-lg p-3 cursor-pointer',
        'hover:border-primary/50 hover:shadow-md transition-all space-y-2',
        'select-none', // prevent text selection during drag
        isDragging && 'opacity-40 scale-95 cursor-grabbing',
      )}
    >
      {/* Business name row */}
      <div className="flex items-start gap-1.5">
        {/* Drag handle */}
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/70 cursor-grab mt-0.5 transition-colors" />
        <p className="text-sm font-medium leading-tight flex-1 min-w-0 truncate">{opp.business_name}</p>
        {canAdvance && (
          <button
            onClick={e => { e.stopPropagation(); onAdvance() }}
            title={`Advance to ${STAGE_LIST[stageIdx + 1]?.label}`}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Contact + source */}
      <div className="flex items-center gap-2 flex-wrap pl-5">
        {opp.contact_name && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {opp.contact_name}
          </span>
        )}
        <span className={cn(
          'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
          SOURCE_BADGE[opp.source],
        )}>
          {SOURCE_LABELS[opp.source]}
        </span>
      </div>

      {/* Footer: assignee + task progress */}
      <div className="flex items-center justify-between pl-5">
        {opp.assignee?.full_name ? (
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-[10px] font-semibold">
                {opp.assignee.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
              {opp.assignee.full_name.split(' ')[0]}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}

        {opp.task_total > 0 && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            opp.task_done === opp.task_total
              ? 'bg-green-500/15 text-green-400'
              : 'bg-muted text-muted-foreground',
          )}>
            {opp.task_done}/{opp.task_total} tasks
          </span>
        )}
      </div>
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  opps,
  onCardClick,
  onAdvance,
  onAddClick,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  draggingId,
  onCardDragStart,
}: {
  stage: typeof STAGE_LIST[0]
  opps: (Opportunity & { task_total: number; task_done: number })[]
  onCardClick: (id: string) => void
  onAdvance: (opp: Opportunity) => void
  onAddClick: () => void
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  draggingId: string | null
  onCardDragStart: (oppId: string) => void
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex flex-col shrink-0 w-64 rounded-xl border bg-card/50 transition-all',
        stage.colCls,
        isDragOver && 'ring-2 ring-primary/60 bg-primary/5 scale-[1.01]',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', stage.dot)} />
          <span className="text-xs font-semibold">{stage.label}</span>
          {opps.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {opps.length}
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={`Add to ${stage.label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div className={cn(
        'flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] transition-colors rounded-b-xl',
        isDragOver && 'bg-primary/5',
      )}>
        {opps.map(opp => (
          <OppCard
            key={opp.id}
            opp={opp}
            onClick={() => { if (!draggingId) onCardClick(opp.id) }}
            onAdvance={() => onAdvance(opp)}
            onDragStart={e => {
              e.dataTransfer.setData('text/plain', opp.id)
              e.dataTransfer.effectAllowed = 'move'
              setTimeout(() => onCardDragStart(opp.id), 0)
            }}
            onDragEnd={() => {/* handled at page level via onDragEnd on container */}}
            isDragging={draggingId === opp.id}
          />
        ))}
        {opps.length === 0 && (
          <div className={cn(
            'flex items-center justify-center h-16 rounded-lg border-2 border-dashed transition-colors',
            isDragOver ? 'border-primary/40 text-primary/60' : 'border-border/30 text-muted-foreground/40',
          )}>
            <p className="text-xs">{isDragOver ? 'Drop here' : 'Empty'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addStage, setAddStage] = useState<OpportunityStage | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').order('full_name')
      return (data ?? []) as { user_id: string; full_name: string }[]
    },
    staleTime: 60_000,
  })

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const { data: opps } = await supabase
        .from('opportunities')
        .select('*, assignee:assigned_to(full_name)')
        .order('created_at', { ascending: false })
      if (!opps || opps.length === 0) return []

      const ids = opps.map((o: { id: string }) => o.id)
      const { data: rawTasks } = await supabase
        .from('opportunity_tasks')
        .select('opportunity_id, status')
        .in('opportunity_id', ids)
      const tasks = (rawTasks ?? []) as unknown as { opportunity_id: string; status: string }[]

      const countMap: Record<string, { total: number; done: number }> = {}
      for (const t of tasks) {
        if (!countMap[t.opportunity_id]) countMap[t.opportunity_id] = { total: 0, done: 0 }
        countMap[t.opportunity_id].total++
        if (t.status === 'done') countMap[t.opportunity_id].done++
      }

      return (opps as unknown as Opportunity[]).map(o => ({
        ...o,
        task_total: countMap[o.id]?.total ?? 0,
        task_done: countMap[o.id]?.done ?? 0,
      }))
    },
  })

  // Move opportunity to any stage (drag & drop or advance button)
  const moveToStage = useMutation({
    mutationFn: async ({ opp, targetStage }: { opp: Opportunity; targetStage: string }) => {
      if (opp.pipeline_stage === targetStage) return
      await supabase.from('opportunities').update({ pipeline_stage: targetStage } as never).eq('id', opp.id)

      const stageTasks = STAGE_TASKS[targetStage as keyof typeof STAGE_TASKS] ?? []
      if (stageTasks.length > 0) {
        const { data: existing } = await supabase
          .from('opportunity_tasks').select('id')
          .eq('opportunity_id', opp.id).eq('stage', targetStage)
        if (((existing ?? []) as unknown as { id: string }[]).length === 0) {
          await supabase.from('opportunity_tasks').insert(
            stageTasks.map((title: string) => ({
              opportunity_id: opp.id, title, stage: targetStage, status: 'pending',
            })) as never[]
          )
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  })

  // Drag handlers
  const handleDragEnd = () => { setDraggingId(null); setDragOverStage(null) }

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current)
    setDragOverStage(stageKey)
  }

  const handleDragLeave = () => {
    // Debounce to avoid flicker when moving between child elements
    dragLeaveTimer.current = setTimeout(() => setDragOverStage(null), 80)
  }

  const handleDrop = (e: React.DragEvent, targetStageKey: string) => {
    e.preventDefault()
    setDragOverStage(null)
    const oppId = e.dataTransfer.getData('text/plain')
    if (!oppId) return
    const opp = (opportunities as (Opportunity & { task_total: number; task_done: number })[])
      .find(o => o.id === oppId)
    if (!opp) return
    setDraggingId(null)
    moveToStage.mutate({ opp, targetStage: targetStageKey })
  }

  // Group by stage
  const byStage = STAGE_LIST.reduce<Record<string, (Opportunity & { task_total: number; task_done: number })[]>>(
    (acc, s) => {
      acc[s.key] = (opportunities as (Opportunity & { task_total: number; task_done: number })[])
        .filter(o => o.pipeline_stage === s.key)
      return acc
    },
    {},
  )

  const total = opportunities.length
  const active = opportunities.filter(o => !['closed_won', 'closed_lost'].includes(o.pipeline_stage)).length
  const won = byStage['closed_won']?.length ?? 0
  const lost = byStage['closed_lost']?.length ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Opportunities</h1>
            <p className="text-xs text-muted-foreground">Sales pipeline · drag cards between stages</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{total} total</span>
            <span className="text-blue-400">{active} active</span>
            <span className="text-green-400">{won} won</span>
            {lost > 0 && <span className="text-red-400">{lost} lost</span>}
          </div>
          <button
            onClick={() => setAddStage('new_lead')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Drag hint bar */}
      {draggingId && (
        <div className="flex items-center justify-center py-1.5 bg-primary/10 border-b border-primary/20 text-xs text-primary shrink-0">
          Drop on any column to move
        </div>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          className={cn('flex-1 overflow-x-auto overflow-y-hidden', draggingId && 'cursor-grabbing')}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 h-full p-4 min-w-max">
            {STAGE_LIST.map(stage => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                opps={byStage[stage.key] ?? []}
                onCardClick={setSelectedId}
                onAdvance={opp => moveToStage.mutate({
                  opp,
                  targetStage: STAGE_LIST[STAGE_LIST.findIndex(s => s.key === opp.pipeline_stage) + 1]?.key ?? opp.pipeline_stage,
                })}
                onAddClick={() => setAddStage(stage.key)}
                isDragOver={dragOverStage === stage.key}
                onDragOver={e => handleDragOver(e, stage.key)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, stage.key)}
                draggingId={draggingId}
                onCardDragStart={setDraggingId}
              />
            ))}
          </div>
        </div>
      )}

      {selectedId && (
        <OpportunityDetailDialog
          oppId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {addStage && (
        <AddOpportunityDialog
          defaultStage={addStage}
          profiles={profiles}
          onClose={() => setAddStage(null)}
        />
      )}
    </div>
  )
}
