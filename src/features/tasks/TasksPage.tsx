/**
 * Tasks Page — JZ Operations Hub
 * Master task database with 6 view tabs, client filter, and grouped tables.
 * Opens Task Detail Dialog on row click.
 */

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertTriangle, CheckCircle2, X, ExternalLink, Plus, Copy, Trash2,
  Link2, FileText, Save, BarChart2, Pencil, Check, History, Search, Paperclip, RotateCcw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, DeliveryTask } from '@/lib/types'
import { isOverdueEST, formatDateEST, isDateTodayEST, todayDateEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { CreateTaskDialog } from './CreateTaskDialog'
import { DailyReportModal } from './DailyReportModal'
import { TaskFileUpload } from '@/components/TaskFileUpload'
import { RichTextEditor, RichTextDisplay } from '@/components/RichTextEditor'
import { useAuth } from '@/features/auth/AuthContext'
import { HelpPopover } from '@/components/HelpPopover'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewTab = 'timeline' | 'workstream' | 'pending' | 'qa-gate' | 'blocked' | 'overdue' | 'done'

// ─── Data Hooks ───────────────────────────────────────────────────────────────

/**
 * Fetches tasks. PM/Owner see all tasks with full RACI joins.
 * Other roles (specialist, viewer) see only their assigned tasks via a 2-step query.
 */
function useTasks(clientFilter: string, assignedUserId?: string) {
  return useQuery<DeliveryTask[]>({
    queryKey: ['tasks', clientFilter, assignedUserId ?? 'all'],
    queryFn: async () => {
      // Non-PM/Owner: fetch only tasks they're assigned to
      if (assignedUserId) {
        const { data: assignments, error: aErr } = await supabase
          .from('task_assignments')
          .select('task_id')
          .eq('user_id', assignedUserId)
        if (aErr) throw aErr

        const taskIds = (assignments ?? []).map(a => (a as { task_id: string }).task_id)
        if (taskIds.length === 0) return []

        const { data, error } = await supabase
          .from('delivery_tasks')
          .select('*, clients(name), task_assignments(role_type, workstream, user_id)')
          .in('id', taskIds)
          .order('step')
          .order('due_date')
        if (error) throw error
        return (data ?? []) as unknown as DeliveryTask[]
      }

      // PM/Owner: all tasks with full join
      let q = supabase
        .from('delivery_tasks')
        .select('*, clients(name), task_assignments(role_type, workstream, user_id)')
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

// ─── Duplicate Task Dialog ────────────────────────────────────────────────────

type DuplicateMode = 'same' | 'copy' | 'move'

function DuplicateTaskDialog({
  task,
  clients,
  onClose,
}: {
  task: DeliveryTask
  clients: Client[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: profilesList = [] } = useQuery<{ id: string; user_id: string; full_name: string }[]>({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .eq('is_active', true)
        .order('full_name')
      return (data ?? []) as { id: string; user_id: string; full_name: string }[]
    },
  })

  const [mode, setMode]                   = useState<DuplicateMode>('same')
  const [destClientId, setDestClientId]   = useState(task.client_id)
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [keepDueDate, setKeepDueDate]     = useState(true)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true); setError(null)
    const targetClientId = mode === 'same' ? task.client_id : destClientId

    const { data: newTask, error: insertErr } = await supabase
      .from('delivery_tasks')
      .insert({
        task_name:        task.task_name,
        client_id:        targetClientId,
        description:      task.description ?? null,
        impact_level:     task.impact_level,
        workstream:       task.workstream,
        step:             task.step,
        step_name:        task.step_name,
        timeline:         task.timeline,
        due_date:         keepDueDate ? (task.due_date ?? null) : null,
        status:           'Not Started',
        ar_output_logged: false,
        blocker_text:     task.blocker_text ?? null,
      } as never)
      .select('id')
      .single()

    if (insertErr || !newTask) {
      setError(insertErr?.message ?? 'Insert failed')
      setLoading(false)
      return
    }

    if (assigneeUserId) {
      await supabase.from('task_assignments').insert({
        task_id: newTask.id, user_id: assigneeUserId, role_type: 'R',
      } as never)
    }

    if (mode === 'move') {
      await supabase.from('delivery_tasks').delete().eq('id', task.id)
    }

    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['client-detail'] })
    onClose()
  }

  const modeLabels: Record<DuplicateMode, string> = {
    same: 'Duplicate on Same Client',
    copy: 'Copy to Another Client',
    move: 'Move to Another Client',
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Copy className="h-4 w-4 text-muted-foreground" />
            Duplicate / Move Task
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground truncate">Task: <span className="text-foreground font-medium">{task.task_name}</span></p>

          {/* Mode */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Action</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['same', 'copy', 'move'] as DuplicateMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-2 py-1.5 rounded-md border text-xs font-medium transition-colors text-center',
                    mode === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {modeLabels[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Destination client (copy/move) */}
          {mode !== 'same' && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Destination Client</label>
              <select
                value={destClientId}
                onChange={e => setDestClientId(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Assignee */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Assignee (optional)</label>
            <select
              value={assigneeUserId}
              onChange={e => setAssigneeUserId(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">No assignee</option>
              {profilesList.map(p => (
                <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Keep due date */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={keepDueDate}
              onChange={e => setKeepDueDate(e.target.checked)}
              className="rounded border-input"
            />
            Keep original due date
          </label>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {mode === 'move' && (
            <p className="text-xs text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 px-3 py-2 rounded-md">
              Move will delete the original task after creating the copy.
            </p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            {mode === 'move' ? 'Move Task' : 'Duplicate Task'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border/60 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Detail Dialog ───────────────────────────────────────────────────────

type EditHistoryRow = {
  id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changed_by: string | null
  changer_name?: string
}

function calcNextDueDate(dueDate: string, recurrence: 'weekly' | 'biweekly' | 'monthly'): string {
  const d = new Date(dueDate + 'T12:00:00')
  if (recurrence === 'weekly')        d.setDate(d.getDate() + 7)
  else if (recurrence === 'biweekly') d.setDate(d.getDate() + 14)
  else {
    const day = d.getDate()
    d.setMonth(d.getMonth() + 1)
    if (d.getDate() !== day) d.setDate(0)
  }
  return d.toISOString().split('T')[0]
}

function TaskDetailDialog({
  task,
  clients,
  profilesList,
  canDelete,
  onClose,
  onDeleted,
}: {
  task: DeliveryTask
  clients: Client[]
  profilesList: { user_id: string; full_name: string }[]
  canDelete: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const { role, profile } = useAuth()
  const isPM = role === 'owner' || role === 'project_manager'

  // ── Permission: can edit if PM/Owner OR assigned to this task ──────────────
  const canEdit = true  // any authenticated user can edit tasks

  // ── Core state ──────────────────────────────────────────────────────────────
  const [qaWarning, setQaWarning]         = useState(false)
  const [currentStatus, setCurrentStatus] = useState<DeliveryTask['status']>(task.status)
  const [outputUrl, setOutputUrl]         = useState(task.output_link ?? '')
  const [arLogged, setArLogged]           = useState(task.ar_output_logged ?? false)
  const [savingUrl, setSavingUrl]         = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notes, setNotes]                 = useState(task.notes ?? '')
  const [savingNotes, setSavingNotes]     = useState(false)
  const [links, setLinks]                 = useState<{ label: string; url: string }[]>(task.links ?? [])
  const [attachments, setAttachments]     = useState<import('@/components/TaskFileUpload').Attachment[]>(
    (task as DeliveryTask & { attachments?: import('@/components/TaskFileUpload').Attachment[] }).attachments ?? []
  )
  const [newLinkLabel, setNewLinkLabel]   = useState('')
  const [newLinkUrl, setNewLinkUrl]       = useState('')
  const [savingLinks, setSavingLinks]     = useState(false)
  const [showHistory, setShowHistory]     = useState(false)

  // ── Inline edit state ───────────────────────────────────────────────────────
  const [editingName, setEditingName]       = useState(false)
  const [nameVal, setNameVal]               = useState(task.task_name)
  const [editingDue, setEditingDue]         = useState(false)
  const [dueVal, setDueVal]                 = useState(task.due_date ?? '')
  const [editingWorkstream, setEditingWorkstream] = useState(false)
  const [workstreamVal, setWorkstreamVal]   = useState(task.workstream)
  const [editingImpact, setEditingImpact]   = useState(false)
  const [impactVal, setImpactVal]           = useState(task.impact_level)
  const [editingBlocker, setEditingBlocker]     = useState(false)
  const [blockerVal, setBlockerVal]             = useState(task.blocker_text ?? '')
  const [showBlockedReason, setShowBlockedReason] = useState(false)
  const [blockerReason, setBlockerReason]         = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionVal, setDescriptionVal]     = useState(task.description ?? '')
  const [editingAssignees, setEditingAssignees] = useState(false)
  const [addAssigneeUserId, setAddAssigneeUserId] = useState('')
  const [assigneesSaving, setAssigneesSaving]  = useState(false)
  // Local copy of assignments so edits are reflected immediately
  const [localAssignments, setLocalAssignments] = useState(task.task_assignments ?? [])

  // ── Edit history query — always fetched for PM so count stays live ──────────
  const { data: editHistory = [] } = useQuery<EditHistoryRow[]>({
    queryKey: ['task-edit-history', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_edit_history')
        .select('*')
        .eq('task_id', task.id)
        .order('changed_at', { ascending: false })
      if (error) {
        console.error('[task-edit-history] fetch error:', error.message)
        return []
      }
      const rows = (data ?? []) as EditHistoryRow[]
      return rows.map(r => ({
        ...r,
        changer_name: r.changed_by
          ? profilesList.find(p => p.user_id === r.changed_by)?.full_name ?? 'Unknown'
          : 'System',
      }))
    },
    enabled: isPM,  // always fetch for PM — not just when panel is open
  })

  // ── Log field change to history ─────────────────────────────────────────────
  const logHistory = async (field: string, oldVal: string | null, newVal: string | null) => {
    if (!profile?.user_id) return
    const { error } = await supabase.from('task_edit_history').insert({
      task_id: task.id,
      changed_by: profile.user_id,
      field_name: field,
      old_value: oldVal ?? null,
      new_value: newVal ?? null,
    } as never)
    if (error) {
      console.error('[task-edit-history] insert error:', error.message, '— run migration 33 in Supabase SQL editor')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['task-edit-history', task.id] })
  }

  // ── Save a field with optional history ──────────────────────────────────────
  const saveField = async (
    field: string,
    value: unknown,
    oldDisplay: string | null,
    newDisplay: string | null,
    trackHistory = true,
  ) => {
    const { error } = await supabase
      .from('delivery_tasks')
      .update({ [field]: value } as never)
      .eq('id', task.id)
    if (error) {
      console.error('[saveField] update error:', error.message)
      return
    }
    if (trackHistory && oldDisplay !== newDisplay) {
      await logHistory(field, oldDisplay, newDisplay)
    }
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['client-detail'] })
  }

  // ── Field save handlers ──────────────────────────────────────────────────────
  const commitName = async () => {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== task.task_name) {
      await saveField('task_name', trimmed, task.task_name, trimmed)
    } else {
      setNameVal(task.task_name)
    }
    setEditingName(false)
  }

  const commitDue = async (val: string) => {
    setDueVal(val)
    if (val !== task.due_date) {
      await saveField('due_date', val || null, task.due_date ?? null, val || null)
    }
    setEditingDue(false)
  }

  const commitWorkstream = async (val: string) => {
    setWorkstreamVal(val as DeliveryTask['workstream'])
    if (val !== task.workstream) {
      await saveField('workstream', val, task.workstream, val)
    }
    setEditingWorkstream(false)
  }

  const commitImpact = async (val: string) => {
    setImpactVal(val as DeliveryTask['impact_level'])
    if (val !== task.impact_level) {
      await saveField('impact_level', val, task.impact_level, val)
    }
    setEditingImpact(false)
  }

  const commitBlocker = async () => {
    const trimmed = blockerVal.trim()
    const changed = trimmed !== (task.blocker_text ?? '')

    if (changed) {
      if (trimmed) {
        // Save blocker text + flip status to Blocked in one update
        await supabase
          .from('delivery_tasks')
          .update({ blocker_text: trimmed, status: 'Blocked' } as never)
          .eq('id', task.id)

        // Upsert into blockers table so it shows in Blockers tab
        const { data: existing } = await supabase
          .from('blockers')
          .select('id')
          .eq('task_id', task.id)
          .in('status', ['Open', 'In Progress'])
          .maybeSingle()

        if (!existing) {
          await supabase.from('blockers').insert({
            client_id:    task.client_id,
            task_id:      task.id,
            workstream:   task.workstream,
            description:  trimmed,
            severity:     'Med',
            status:       'Open',
            created_date: new Date().toISOString().slice(0, 10),
          } as never)
        } else {
          await supabase.from('blockers').update({ description: trimmed } as never).eq('id', existing.id)
        }
      } else {
        // Blocker cleared — flip status back to In Progress and resolve blocker record
        await supabase
          .from('delivery_tasks')
          .update({ blocker_text: null, status: 'In Progress' } as never)
          .eq('id', task.id)

        await supabase
          .from('blockers')
          .update({ status: 'Resolved' } as never)
          .eq('task_id', task.id)
          .in('status', ['Open', 'In Progress'])
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['client-detail'] })
      queryClient.invalidateQueries({ queryKey: ['blockers-page'] })
      queryClient.invalidateQueries({ queryKey: ['all-blockers'] })
    }
    setEditingBlocker(false)
  }

  const commitDescription = async () => {
    const trimmed = descriptionVal.trim()
    if (trimmed !== (task.description ?? '')) {
      await saveField('description', trimmed || null, task.description ?? null, trimmed || null, false)
    }
    setEditingDescription(false)
  }

  // ── Assignment mutations ─────────────────────────────────────────────────────
  const removeAssignment = async (userId: string | null, idx: number) => {
    setAssigneesSaving(true)
    if (userId) {
      await supabase.from('task_assignments').delete()
        .eq('task_id', task.id).eq('user_id', userId)
    }
    setLocalAssignments(prev => prev.filter((_, i) => i !== idx))
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['client-detail'] })
    setAssigneesSaving(false)
  }

  const addAssignment = async () => {
    if (!addAssigneeUserId) return
    setAssigneesSaving(true)
    const { error } = await supabase.from('task_assignments').insert({
      task_id: task.id,
      user_id: addAssigneeUserId,
      role_type: 'R',
    } as never)
    if (!error) {
      setLocalAssignments(prev => [...prev, {
        id: crypto.randomUUID(),
        task_id: task.id,
        user_id: addAssigneeUserId,
        role_type: 'R',
        workstream: null,
      }])
      setAddAssigneeUserId('')
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['client-detail'] })
    }
    setAssigneesSaving(false)
  }

  // ── Existing mutations ───────────────────────────────────────────────────────
  const deleteTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('delivery_tasks').delete().eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['client-detail'] })
      onDeleted()
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: DeliveryTask['status']; reason?: string }) => {
      const upd: Record<string, unknown> = { status }
      if (status === 'Done') upd['completed_date'] = todayDateEST()
      if (status === 'Blocked' && reason) upd['blocker_text'] = reason
      if (status !== 'Blocked') upd['blocker_text'] = null
      const { error } = await supabase.from('delivery_tasks').update(upd as never).eq('id', task.id)
      if (error) throw error
    },
    onMutate: ({ status }) => {
      setCurrentStatus(status)
      if (status !== 'Blocked') setBlockerVal('')
    },
    onError:  () => { setCurrentStatus(task.status) },
    onSuccess: async (_, { status, reason }) => {
      setQaWarning(false)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['client-detail'] })
      if (status === 'Blocked') {
        const { data: existing } = await supabase
          .from('blockers')
          .select('id')
          .eq('task_id', task.id)
          .in('status', ['Open', 'In Progress'])
          .maybeSingle()
        if (!existing) {
          await supabase.from('blockers').insert({
            client_id:    task.client_id,
            task_id:      task.id,
            workstream:   task.workstream,
            description:  reason ?? `Blocked: ${task.task_name}`,
            severity:     'Med',
            status:       'Open',
            created_date: todayDateEST(),
          } as never)
          queryClient.invalidateQueries({ queryKey: ['blockers-page'] })
          queryClient.invalidateQueries({ queryKey: ['all-blockers'] })
        }
      }

      // ── Recurrence chain: when a recurring task is marked Done,
      //    create the next occurrence if no future pending task exists in the group.
      if (
        status === 'Done' &&
        task.recurrence && task.recurrence !== 'none' &&
        task.recurrence_group_id
      ) {
        const { data: future } = await supabase
          .from('delivery_tasks')
          .select('id')
          .eq('recurrence_group_id' as never, task.recurrence_group_id)
          .neq('id', task.id)
          .neq('status' as never, 'Done')
          .limit(1)

        if (!future || future.length === 0) {
          const nextDue = task.due_date
            ? calcNextDueDate(task.due_date, task.recurrence as 'weekly' | 'biweekly' | 'monthly')
            : todayDateEST()

          const { data: newTask } = await supabase
            .from('delivery_tasks')
            .insert({
              task_name:              task.task_name,
              client_id:              task.client_id,
              due_date:               nextDue,
              impact_level:           task.impact_level,
              workstream:             task.workstream,
              description:            task.description ?? null,
              blocker_text:           null,
              status:                 'Not Started',
              step:                   task.step,
              step_name:              task.step_name,
              timeline:               task.timeline,
              ar_output_logged:       false,
              recurrence:             task.recurrence,
              recurrence_group_id:    task.recurrence_group_id,
              recurrence_anchor_date: task.recurrence_anchor_date ?? task.due_date,
            } as never)
            .select('id')
            .single()

          if (newTask?.id) {
            const assignments = (task.task_assignments ?? [])
              .filter(a => a.user_id)
              .map(a => ({ task_id: newTask.id, user_id: a.user_id, role_type: a.role_type }))
            if (assignments.length > 0) {
              await supabase.from('task_assignments').insert(assignments as never)
            }
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['client-detail'] })
          }
        }
      }
    },
  })

  const hasARAssignment = (task.task_assignments ?? []).some(a => a.role_type === 'R' || a.role_type === 'A')
  const needsQAGate     = hasARAssignment && !arLogged

  function handleMarkDone() {
    if (currentStatus === 'Done') return
    if (needsQAGate) setQaWarning(true)
    else updateStatus.mutate({ status: 'Done' })
  }

  const saveOutputUrl = async () => {
    const trimmed = outputUrl.trim()
    setSavingUrl(true)
    const logged = trimmed.length > 0
    await supabase.from('delivery_tasks').update({
      output_link: trimmed || null,
      ar_output_logged: logged,
    } as never).eq('id', task.id)
    setArLogged(logged)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['client-detail'] })
    setSavingUrl(false)
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    await supabase.from('delivery_tasks').update({ notes: notes.trim() || null } as never).eq('id', task.id)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    setSavingNotes(false)
  }

  const addLink = async () => {
    const url = newLinkUrl.trim()
    if (!url) return
    const updated = [...links, { label: newLinkLabel.trim() || url, url }]
    setSavingLinks(true)
    await supabase.from('delivery_tasks').update({ links: updated } as never).eq('id', task.id)
    setLinks(updated)
    setNewLinkLabel('')
    setNewLinkUrl('')
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    setSavingLinks(false)
  }

  const removeLink = async (idx: number) => {
    const updated = links.filter((_, i) => i !== idx)
    await supabase.from('delivery_tasks').update({ links: updated } as never).eq('id', task.id)
    setLinks(updated)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const isOverdue = task.due_date && isOverdueEST(task.due_date) && task.status !== 'Done'

  const WORKSTREAMS = [
    'Sales','Ops/PM','AM','Tracking','SEO','PPC','Web/Dev','Local/GBP','Social','VA/Vendor',
  ] as const
  const IMPACTS = ['High', 'Medium', 'Low'] as const

  const fieldLabel: Record<string, string> = {
    task_name: 'Task Name', due_date: 'Due Date',
    workstream: 'Workstream', impact_level: 'Impact',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn(
                task.status === 'Done'        ? 'status-done' :
                task.status === 'In Progress' ? 'status-in-progress' :
                task.status === 'Blocked'     ? 'status-blocked' : 'status-not-started'
              )}>{task.status}</span>
              <span className={
                impactVal === 'High' ? 'severity-high' :
                impactVal === 'Medium' ? 'severity-med' : 'severity-low'
              }>{impactVal}</span>
              {isOverdue && <span className="status-badge bg-destructive/20 text-destructive">Overdue</span>}
            </div>

            {/* Editable task name */}
            {editingName && canEdit ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  autoFocus
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameVal(task.task_name); setEditingName(false) } }}
                  className="flex-1 text-lg font-semibold bg-background border border-primary rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={commitName} className="text-primary hover:text-primary/80"><Check className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h2 className="text-lg font-semibold">{nameVal}</h2>
                {canEdit && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                    title="Edit task name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {task.clients && <p className="text-sm text-muted-foreground mt-0.5">{task.clients.name}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1 p-5 space-y-5">
          {/* Description — editable for anyone who can edit */}
          {(descriptionVal || canEdit) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="section-header mb-0">Description</p>
                {canEdit && !editingDescription && (
                  <button onClick={() => setEditingDescription(true)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
              {editingDescription ? (
                <div className="space-y-1.5">
                  <RichTextEditor
                    value={descriptionVal}
                    onChange={setDescriptionVal}
                    placeholder="Add a description…"
                    minRows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={commitDescription} className="px-3 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                    <button onClick={() => { setDescriptionVal(task.description ?? ''); setEditingDescription(false) }} className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </div>
              ) : (
                <RichTextDisplay html={descriptionVal} emptyText="No description." />
              )}
            </div>
          )}

          {/* Task Details Grid — editable fields */}
          <div>
            <p className="section-header">Task Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">

              {/* Workstream */}
              <div className="flex justify-between items-center border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Workstream</span>
                {editingWorkstream && isPM ? (
                  <select
                    autoFocus
                    value={workstreamVal}
                    onChange={e => commitWorkstream(e.target.value)}
                    onBlur={() => setEditingWorkstream(false)}
                    className="text-sm bg-background border border-primary rounded px-1.5 py-0.5 focus:outline-none"
                  >
                    {WORKSTREAMS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <span className="font-medium">{workstreamVal}</span>
                    {isPM && (
                      <button onClick={() => setEditingWorkstream(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary" title="Edit workstream">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Impact */}
              <div className="flex justify-between items-center border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Impact</span>
                {editingImpact && isPM ? (
                  <select
                    autoFocus
                    value={impactVal}
                    onChange={e => commitImpact(e.target.value)}
                    onBlur={() => setEditingImpact(false)}
                    className="text-sm bg-background border border-primary rounded px-1.5 py-0.5 focus:outline-none"
                  >
                    {IMPACTS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <span className="font-medium">{impactVal}</span>
                    {isPM && (
                      <button onClick={() => setEditingImpact(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary" title="Edit impact">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div className="flex justify-between items-center border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Due Date</span>
                {editingDue && canEdit ? (
                  <input
                    autoFocus
                    type="date"
                    value={dueVal}
                    onChange={e => setDueVal(e.target.value)}
                    onBlur={e => commitDue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitDue(dueVal); if (e.key === 'Escape') setEditingDue(false) }}
                    className="text-sm bg-background border border-primary rounded px-1.5 py-0.5 focus:outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-1 group">
                    <span className={cn('font-medium', isOverdue ? 'text-destructive' : '')}>
                      {dueVal ? formatDateEST(dueVal) : '—'}
                    </span>
                    {canEdit && (
                      <button onClick={() => setEditingDue(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary" title="Edit due date">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Completed */}
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium">{task.completed_date ? formatDateEST(task.completed_date) : '—'}</span>
              </div>

              {/* Created by */}
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Created by</span>
                <span className="font-medium">
                  {task.created_by_name
                    ?? (task.created_by ? (profilesList.find(p => p.user_id === task.created_by)?.full_name ?? '—') : '—')}
                </span>
              </div>
            </div>
          </div>

          {/* Assignees — editable */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="section-header mb-0">Assignees</p>
              {canEdit && (
                <button
                  onClick={() => setEditingAssignees(e => !e)}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  {editingAssignees ? 'Done' : 'Edit'}
                </button>
              )}
            </div>

            {/* Current assignments */}
            <div className="flex flex-wrap gap-2 mb-2">
              {localAssignments.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No assignees yet.</p>
              )}
              {localAssignments.map((a, i) => {
                const name = (a.user_id ? profilesList.find(p => p.user_id === a.user_id)?.full_name : null) ?? a.workstream ?? '—'
                return (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                    {name}
                    {editingAssignees && (
                      <button
                        onClick={() => removeAssignment(a.user_id ?? null, i)}
                        className="ml-0.5 text-primary/60 hover:text-destructive"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )
              })}
            </div>

            {/* Add assignee row */}
            {editingAssignees && (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={addAssigneeUserId}
                  onChange={e => setAddAssigneeUserId(e.target.value)}
                  className="flex-1 min-w-[140px] px-2 py-1 bg-background border border-input rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select person…</option>
                  {profilesList.map(p => (
                    <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                  ))}
                </select>
                <button
                  onClick={addAssignment}
                  disabled={!addAssigneeUserId || assigneesSaving}
                  className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  {assigneesSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Blocker — editable for anyone who can edit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="section-header mb-0">Blocker / Dependency</p>
              {canEdit && !editingBlocker && (
                <button onClick={() => setEditingBlocker(true)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editingBlocker ? (
              <div className="space-y-1.5">
                <textarea
                  autoFocus
                  value={blockerVal}
                  onChange={e => setBlockerVal(e.target.value)}
                  rows={2}
                  placeholder="Describe the blocker or dependency…"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={commitBlocker} className="px-3 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                  <button onClick={() => { setBlockerVal(task.blocker_text ?? ''); setEditingBlocker(false) }} className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </div>
            ) : blockerVal ? (
              <div className="qa-gate-warning">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                <p className="text-sm">{blockerVal}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No blocker recorded.</p>
            )}
          </div>

          {/* Output Link */}
          <div>
            <p className="section-header flex items-center gap-1.5">
              Output URL
              <HelpPopover
                title="What is the Output URL?"
                side="bottom"
                align="left"
                content={
                  <div className="space-y-2">
                    <p>This is the <strong>QA Gate</strong> — proof that the task was completed. Paste a URL here before marking the task Done.</p>
                    <p className="font-semibold text-foreground">What to paste:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>A live page URL (e.g. the website you built)</li>
                      <li>A Google Drive link (doc, sheet, report)</li>
                      <li>A Loom/video recording of the work</li>
                      <li>A Google Ads / Analytics screenshot link</li>
                      <li>Any shareable URL proving the deliverable exists</li>
                    </ul>
                    <p className="text-amber-400">Without this URL, the <strong>Done ⚠</strong> button triggers a QA Gate warning and the next delivery step stays locked.</p>
                  </div>
                }
              />
            </p>
            <div className="flex gap-2 items-center">
              <input
                value={outputUrl}
                onChange={e => setOutputUrl(e.target.value)}
                onBlur={saveOutputUrl}
                placeholder="https://… (paste output link)"
                className="flex-1 px-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {outputUrl && (
                <a href={outputUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {savingUrl && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="section-header flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Notes</p>
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              onBlur={saveNotes}
              placeholder="Add notes, output documentation, or context…"
              minRows={4}
            />
            {savingNotes && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Save className="h-3 w-3 animate-pulse" /> Saving…
              </p>
            )}
          </div>

          {/* Links */}
          <div>
            <p className="section-header flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Links</p>
            {links.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm min-w-0">
                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-primary hover:underline flex-1 min-w-0 break-all">
                      <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />{l.label}
                    </a>
                    <button onClick={() => removeLink(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <input value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder="Label (optional)"
                className="w-28 min-w-0 px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://…"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                className="flex-1 min-w-[140px] px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={addLink} disabled={!newLinkUrl.trim() || savingLinks}
                className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors">
                {savingLinks ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <p className="section-header flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Attachments
            </p>
            <TaskFileUpload
              taskId={task.id}
              attachments={attachments}
              onChange={setAttachments}
            />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between">
            <p className="section-header mb-0">Actions</p>
            <div className="flex items-center gap-2">
              {/* Edit history — PM/Owner only */}
              {isPM && (
                <button
                  onClick={() => setShowHistory(h => !h)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    showHistory
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <History className="h-3 w-3" />
                  Edit History
                </button>
              )}
              <button onClick={() => setShowDuplicate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Copy className="h-3 w-3" /> Duplicate / Move
              </button>
              {canDelete && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
              {canDelete && confirmDelete && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-destructive">Confirm?</span>
                  <button onClick={() => deleteTask.mutate()} disabled={deleteTask.isPending}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleteTask.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, Delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Edit History Panel ── */}
          {isPM && showHistory && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Edit History</span>
                <span className="ml-auto text-xs text-muted-foreground">{editHistory.length} change{editHistory.length !== 1 ? 's' : ''}</span>
              </div>
              {editHistory.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">No edits recorded yet.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {editHistory.map(h => (
                    <div key={h.id} className="px-4 py-2.5 flex items-start gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{fieldLabel[h.field_name] ?? h.field_name}</span>
                        <span className="text-muted-foreground"> changed by </span>
                        <span className="font-medium text-primary">{h.changer_name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="line-through text-destructive/70 truncate max-w-32">{h.old_value ?? '—'}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-[hsl(var(--success))] truncate max-w-32">{h.new_value ?? '—'}</span>
                        </div>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-right">
                        {new Date(h.changed_at).toLocaleString('en-US', {
                          timeZone: 'America/New_York',
                          month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Update */}
          <div>
            <p className="section-header">Update Status</p>
            {qaWarning && (
              <div className="qa-gate-warning mb-3">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">QA Gate: Output URL Not Logged</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    The output URL has not been logged for this task.
                    Paste the output URL above before marking Done, or override to proceed anyway.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => updateStatus.mutate({ status: 'Done' })} disabled={updateStatus.isPending}
                      className="px-3 py-1 rounded text-xs font-medium border border-destructive/50 text-destructive hover:bg-destructive/10">
                      Override — Mark Done Anyway
                    </button>
                    <button onClick={() => setQaWarning(false)} className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Resume banner — shown when task is currently Blocked */}
            {currentStatus === 'Blocked' && (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-destructive/8 border border-destructive/25 mb-1">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-medium flex-1">This task is blocked. Remove the blocker to resume work.</p>
                <button
                  onClick={async () => {
                    await supabase.from('delivery_tasks')
                      .update({ status: 'In Progress', blocker_text: null } as never)
                      .eq('id', task.id)
                    setCurrentStatus('In Progress')
                    setBlockerVal('')
                    queryClient.invalidateQueries({ queryKey: ['tasks'] })
                    queryClient.invalidateQueries({ queryKey: ['client-detail'] })
                  }}
                  disabled={updateStatus.isPending}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded border border-destructive/40 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Resume Task
                </button>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {(['Not Started', 'In Progress'] as const).map(s => (
                <button key={s} onClick={() => updateStatus.mutate({ status: s })}
                  disabled={updateStatus.isPending || currentStatus === s}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    currentStatus === s
                      ? 'border-primary/50 bg-primary/10 text-primary cursor-default'
                      : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30'
                  )}>
                  {s}
                </button>
              ))}
              {/* Blocked — requires a reason */}
              <button
                onClick={() => { if (currentStatus !== 'Blocked') setShowBlockedReason(true) }}
                disabled={updateStatus.isPending || currentStatus === 'Blocked'}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  currentStatus === 'Blocked'
                    ? 'border-destructive/50 bg-destructive/10 text-destructive cursor-default'
                    : 'border-border bg-muted text-muted-foreground hover:text-destructive hover:border-destructive/40'
                )}>
                Blocked
              </button>
              <button onClick={handleMarkDone} disabled={updateStatus.isPending || currentStatus === 'Done'}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  currentStatus === 'Done'
                    ? 'border-primary/50 bg-primary/10 text-primary cursor-default'
                    : needsQAGate
                    ? 'border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/20'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30'
                )}>
                Done {needsQAGate && '⚠'}
              </button>
            </div>

            {/* Blocked reason panel */}
            {showBlockedReason && (
              <div className="mt-3 border border-destructive/40 bg-destructive/5 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-destructive">Why is this task blocked? <span className="font-normal text-muted-foreground">(required)</span></p>
                <textarea
                  autoFocus
                  value={blockerReason}
                  onChange={e => setBlockerReason(e.target.value)}
                  rows={2}
                  placeholder="Describe the blocker or dependency…"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!blockerReason.trim()) return
                      updateStatus.mutate({ status: 'Blocked', reason: blockerReason.trim() })
                      setBlockerVal(blockerReason.trim())
                      setShowBlockedReason(false)
                      setBlockerReason('')
                    }}
                    disabled={!blockerReason.trim() || updateStatus.isPending}
                    className="px-3 py-1 rounded text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    Confirm Blocked
                  </button>
                  <button
                    onClick={() => { setShowBlockedReason(false); setBlockerReason('') }}
                    className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDuplicate && (
        <DuplicateTaskDialog task={task} clients={clients} onClose={() => setShowDuplicate(false)} />
      )}
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, profilesList, onClick }: { task: DeliveryTask; profilesList: { user_id: string; full_name: string }[]; onClick: () => void }) {
  const isOverdue = task.due_date && isOverdueEST(task.due_date) && task.status !== 'Done'
  const isToday   = task.due_date && isDateTodayEST(task.due_date) && task.status !== 'Done'

  const resolveName = (a: { user_id?: string | null; workstream?: string | null }) =>
    (a.user_id ? profilesList.find(p => p.user_id === a.user_id)?.full_name : null) ?? a.workstream ?? '—'

  const allAssignees = task.task_assignments?.map(resolveName).join(', ')

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
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium line-clamp-1">{task.task_name}</p>
          {task.recurrence && task.recurrence !== 'none' && (
            <span title={`Repeats ${task.recurrence}`} className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-violet-500/10 text-violet-500">
              <RotateCcw className="h-2.5 w-2.5" />
              {task.recurrence === 'biweekly' ? '2wk' : task.recurrence === 'weekly' ? 'wkly' : 'mo'}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-32 truncate">{allAssignees || '—'}</td>
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
  const [activeView, setActiveView]       = useState<ViewTab>('timeline')
  const [clientFilter, setClientFilter]   = useState('all')
  const [dateFilter, setDateFilter]       = useState<'all' | 'today' | '7' | '14' | '30'>('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [searchQuery, setSearchQuery]     = useState('')
  const [selectedTask, setSelectedTask]   = useState<DeliveryTask | null>(null)
  const [showCreate, setShowCreate]       = useState(false)
  const [showDailyReport, setShowDailyReport] = useState(false)
  const [searchParams, setSearchParams]   = useSearchParams()

  const { role, profile } = useAuth()
  const isPMOrOwner = role === 'owner' || role === 'project_manager'
  const canDelete = !!role  // any authenticated user can delete tasks

  // Default employee filter to the logged-in user on first load
  const defaultFilterSet = useRef(false)
  useEffect(() => {
    if (!defaultFilterSet.current && profile?.user_id) {
      setEmployeeFilter(profile.user_id)
      defaultFilterSet.current = true
    }
  }, [profile?.user_id])

  const { data: tasks = [], isLoading, isError } = useTasks(
    clientFilter,
    undefined, // all users see all tasks
  )
  const { data: clients = [] } = useClientList()
  const { data: profilesList = [] } = useQuery<{ user_id: string; full_name: string }[]>({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_active', true)
      return (data ?? []) as { user_id: string; full_name: string }[]
    },
  })

  // ── Auto-open task from ?task=<id> query param (used by dashboards) ─────────
  useEffect(() => {
    const taskId = searchParams.get('task')
    if (!taskId || tasks.length === 0) return
    const found = tasks.find(t => t.id === taskId)
    if (found) {
      setSelectedTask(found)
      setSearchParams({}, { replace: true }) // clear param after opening
    }
  }, [tasks, searchParams, setSearchParams])

  // ── Date filtering ──────────────────────────────────────────────────────────
  const dateTasks = (() => {
    if (dateFilter === 'all') return tasks
    if (dateFilter === 'today') {
      const today = todayDateEST()
      return tasks.filter(t => t.due_date === today)
    }
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(dateFilter))
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return tasks.filter(t => t.due_date && t.due_date >= cutoffStr)
  })()

  // ── Employee filter ─────────────────────────────────────────────────────────
  const employeeTasks = (() => {
    if (employeeFilter === 'all') return dateTasks
    if (employeeFilter === 'unassigned') return dateTasks.filter(t =>
      (t.task_assignments ?? []).filter(a => a.user_id).length === 0
    )
    return dateTasks.filter(t =>
      (t.task_assignments ?? []).some(a => a.user_id === employeeFilter)
    )
  })()

  // ── Keyword search filtering ────────────────────────────────────────────────
  const searchTasks = (() => {
    if (!searchQuery.trim()) return employeeTasks
    const q = searchQuery.toLowerCase()
    return employeeTasks.filter(t =>
      t.task_name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q) ||
      t.workstream?.toLowerCase().includes(q) ||
      (t.clients as { name: string } | undefined)?.name?.toLowerCase().includes(q)
    )
  })()

  // ── View filtering ──────────────────────────────────────────────────────────
  const visibleTasks = (() => {
    switch (activeView) {
      case 'pending':
        return searchTasks.filter(t => t.status === 'Not Started' || t.status === 'In Progress')
      case 'qa-gate':
        return searchTasks.filter(t => !t.ar_output_logged && t.status !== 'Not Started')
      case 'blocked':
        return searchTasks.filter(t => t.status === 'Blocked')
      case 'overdue':
        return searchTasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done')
      case 'done':
        return searchTasks.filter(t => t.status === 'Done')
      default:
        return searchTasks
    }
  })()

  // ── Sorting: pending/in-progress by due date asc, done by completed_date desc ─
  function sortGroupTasks(arr: DeliveryTask[]): DeliveryTask[] {
    const pending = arr
      .filter(t => t.status !== 'Done')
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
      })
    const done = arr
      .filter(t => t.status === 'Done')
      .sort((a, b) => {
        const ca = (t: DeliveryTask) => t.completed_date ?? t.due_date ?? ''
        if (!ca(a) && !ca(b)) return 0
        if (!ca(a)) return 1
        if (!ca(b)) return -1
        return ca(a) > ca(b) ? -1 : ca(a) < ca(b) ? 1 : 0
      })
    return [...pending, ...done]
  }

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
      ).map(([k, v]) => [k, sortGroupTasks(v)] as [string, DeliveryTask[]])
    }
    // Default: group by step_name (timeline)
    return Object.entries(
      visibleTasks.reduce<Record<string, DeliveryTask[]>>((acc, t) => {
        const k = `Step ${t.step} — ${t.step_name}`
        acc[k] = acc[k] ?? []
        acc[k].push(t)
        return acc
      }, {})
    ).map(([k, v]) => [k, sortGroupTasks(v)] as [string, DeliveryTask[]])
  })()

  const VIEWS: { id: ViewTab; label: string; help: string }[] = [
    { id: 'timeline',   label: 'Timeline',      help: 'All tasks ordered by delivery step and due date. The default view for tracking overall client delivery progress.' },
    { id: 'workstream', label: 'By Workstream', help: 'Tasks grouped by department (SEO, PPC, Web, Social, etc.). Use this to see what each team is working on.' },
    { id: 'pending',    label: 'Pending',       help: 'All tasks with status Not Started or In Progress — everything that still needs work.' },
    { id: 'qa-gate',    label: 'QA Gate',       help: 'Tasks that are in progress but the output URL hasn\'t been logged yet. The next delivery step is locked until these are cleared.' },
    { id: 'blocked',    label: 'Blocked',       help: 'Tasks with status "Blocked". Each should have a matching blocker logged on the Blockers page. Resolve or escalate promptly.' },
    { id: 'overdue',    label: 'Overdue',       help: 'Tasks past their due date that aren\'t done. Prioritize these — they directly affect the client\'s risk score.' },
    { id: 'done',       label: 'Done',          help: 'All completed tasks. Use this to review what has been delivered for each client.' },
  ]

  const pendingCount = employeeTasks.filter(t => t.status === 'Not Started' || t.status === 'In Progress').length
  const blockedCount = employeeTasks.filter(t => t.status === 'Blocked').length
  const overdueCount = employeeTasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done').length
  const qaCount      = employeeTasks.filter(t => !t.ar_output_logged && t.status !== 'Not Started' && t.status !== 'Done').length
  const doneCount    = employeeTasks.filter(t => t.status === 'Done').length

  return (
    <div className="space-y-5">
      <CreateTaskDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        clients={clients}
        presetClientId={clientFilter !== 'all' ? clientFilter : undefined}
      />

      <DailyReportModal
        open={showDailyReport}
        onClose={() => setShowDailyReport(false)}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">Master delivery task database</p>
        </div>
        <div className="flex items-center gap-2">
          {isPMOrOwner && (
            <button
              onClick={() => setShowDailyReport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground rounded-md text-sm hover:text-foreground hover:bg-accent transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              Daily Report
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search tasks by name, description, notes, workstream…"
          className="w-full pl-9 pr-9 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View Tabs */}
        <div className="flex gap-1 flex-wrap">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={cn('view-tab flex items-center gap-1', activeView === v.id && 'view-tab-active')}
            >
              {v.label}
              <HelpPopover title={v.label} content={v.help} side="bottom" align="left" />
              {v.id === 'pending' && pendingCount > 0 && (
                <span className="px-1 bg-primary/20 text-primary text-xs rounded-full">{pendingCount}</span>
              )}
              {v.id === 'blocked' && blockedCount > 0 && (
                <span className="px-1 bg-destructive/20 text-destructive text-xs rounded-full">{blockedCount}</span>
              )}
              {v.id === 'overdue' && overdueCount > 0 && (
                <span className="px-1 bg-destructive/20 text-destructive text-xs rounded-full">{overdueCount}</span>
              )}
              {v.id === 'qa-gate' && qaCount > 0 && (
                <span className="px-1 bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] text-xs rounded-full">{qaCount}</span>
              )}
              {v.id === 'done' && doneCount > 0 && (
                <span className="px-1 bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] text-xs rounded-full">{doneCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Date Filter Pills */}
        <div className="flex gap-1 sm:ml-auto flex-wrap">
          {(['all', 'today', '7', '14', '30'] as const).map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-colors',
                dateFilter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground bg-background',
              )}
            >
              {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : `Last ${f}d`}
            </button>
          ))}
        </div>

        {/* Client Filter */}
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="flex-1 sm:flex-none min-w-0 px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Employee Filter — visible to all users */}
        <select
          value={employeeFilter}
          onChange={e => setEmployeeFilter(e.target.value)}
          className="flex-1 sm:flex-none min-w-0 px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Team Members</option>
          <option value="unassigned">Unassigned</option>
          {profilesList.map(p => (
            <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
          ))}
        </select>
      </div>

      {/* QA Gate Banner */}
      {activeView === 'qa-gate' && (
        <div className="qa-gate-warning">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
          <p className="text-sm">
            These tasks have outputs not yet logged. Next steps are blocked until the output URL is confirmed.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" /> Failed to load tasks. Please refresh.
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
                    <th>Assignees</th>
                    <th>Status</th>
                    <th>Output</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {groupTasks.map(t => (
                    <TaskRow key={t.id} task={t} profilesList={profilesList} onClick={() => setSelectedTask(t)} />
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
          clients={clients}
          profilesList={profilesList}
          canDelete={canDelete}
          onClose={() => setSelectedTask(null)}
          onDeleted={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
