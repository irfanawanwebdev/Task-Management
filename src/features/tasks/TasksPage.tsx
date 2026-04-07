/**
 * Tasks Page — JZ Operations Hub
 * Master task database with 6 view tabs, client filter, and grouped tables.
 * Opens Task Detail Dialog on row click.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertTriangle, CheckCircle2, X, ExternalLink, Plus, Copy, Trash2,
  Link2, FileText, Save,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, DeliveryTask } from '@/lib/types'
import { isOverdueEST, formatDateEST, isDateTodayEST, todayDateEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { CreateTaskDialog } from './CreateTaskDialog'
import { useAuth } from '@/features/auth/AuthContext'
import { HelpPopover } from '@/components/HelpPopover'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewTab = 'timeline' | 'workstream' | 'qa-gate' | 'blocked' | 'overdue' | 'done'

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
  const [newLinkLabel, setNewLinkLabel]   = useState('')
  const [newLinkUrl, setNewLinkUrl]       = useState('')
  const [savingLinks, setSavingLinks]     = useState(false)

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
    mutationFn: async (status: DeliveryTask['status']) => {
      const upd: Record<string, unknown> = { status }
      if (status === 'Done') upd['completed_date'] = todayDateEST()
      const { error } = await supabase.from('delivery_tasks').update(upd as never).eq('id', task.id)
      if (error) throw error
    },
    onMutate: (status) => {
      setCurrentStatus(status) // optimistic — update button highlight immediately
    },
    onError: () => {
      setCurrentStatus(task.status) // revert on failure
    },
    onSuccess: () => {
      setQaWarning(false)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['client-detail'] })
    },
  })

  /** True if this task has A/R assignments and output is not yet logged */
  const hasARAssignment = (task.task_assignments ?? []).some(
    a => a.role_type === 'R' || a.role_type === 'A',
  )
  const needsQAGate = hasARAssignment && !arLogged

  function handleMarkDone() {
    if (currentStatus === 'Done') return // already done
    if (needsQAGate) {
      setQaWarning(true)
    } else {
      updateStatus.mutate('Done')
    }
  }

  const saveOutputUrl = async () => {
    const trimmed = outputUrl.trim()
    setSavingUrl(true)
    // Saving a non-empty URL automatically satisfies the QA Gate (ar_output_logged = true).
    // Clearing the URL reverts the gate.
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
            </div>
          </div>

          {/* Assignees */}
          {task.task_assignments && task.task_assignments.length > 0 && (
            <div>
              <p className="section-header">Assignees</p>
              <div className="flex flex-wrap gap-2">
                {task.task_assignments.map((a, i) => {
                  const name = (a.user_id ? profilesList.find(p => p.user_id === a.user_id)?.full_name : null) ?? a.workstream ?? '—'
                  return (
                    <span key={i} className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                      {name}
                    </span>
                  )
                })}
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
            <p className="section-header flex items-center gap-1.5">
              A/R Output URL
              <HelpPopover
                title="What is the A/R Output URL?"
                side="bottom"
                align="left"
                content={
                  <div className="space-y-2">
                    <p>This is the <strong>QA Gate</strong> — proof that the task was completed. If you are <strong>Accountable (A)</strong> or <strong>Responsible (R)</strong> for this task, you must paste a URL here before marking it Done.</p>
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
                <a href={outputUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {savingUrl && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="section-header flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Notes
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={4}
              placeholder="Add notes, output documentation, or context…"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
            />
            {savingNotes && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Save className="h-3 w-3 animate-pulse" /> Saving…
              </p>
            )}
          </div>

          {/* Links */}
          <div>
            <p className="section-header flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Links
            </p>
            {links.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-primary hover:underline flex-1 min-w-0 truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {l.label}
                    </a>
                    <button
                      onClick={() => removeLink(i)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newLinkLabel}
                onChange={e => setNewLinkLabel(e.target.value)}
                placeholder="Label (optional)"
                className="w-32 px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                value={newLinkUrl}
                onChange={e => setNewLinkUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                className="flex-1 px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={addLink}
                disabled={!newLinkUrl.trim() || savingLinks}
                className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20
                           text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                {savingLinks ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Duplicate / Move */}
          <div className="flex items-center justify-between">
            <p className="section-header mb-0">Actions</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDuplicate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Copy className="h-3 w-3" />
                Duplicate / Move
              </button>
              {canDelete && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              )}
              {canDelete && confirmDelete && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-destructive">Confirm?</span>
                  <button
                    onClick={() => deleteTask.mutate()}
                    disabled={deleteTask.isPending}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteTask.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, Delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              )}
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
                  disabled={updateStatus.isPending || currentStatus === s}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    currentStatus === s
                      ? 'border-primary/50 bg-primary/10 text-primary cursor-default'
                      : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30'
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={handleMarkDone}
                disabled={updateStatus.isPending || currentStatus === 'Done'}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  currentStatus === 'Done'
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

      {showDuplicate && (
        <DuplicateTaskDialog
          task={task}
          clients={clients}
          onClose={() => setShowDuplicate(false)}
        />
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

  const rAssign = task.task_assignments?.filter(a => a.role_type === 'R').map(resolveName).join(', ')
  const aAssign = task.task_assignments?.filter(a => a.role_type === 'A').map(resolveName).join(', ')

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
  const [activeView, setActiveView]       = useState<ViewTab>('timeline')
  const [clientFilter, setClientFilter]   = useState('all')
  const [dateFilter, setDateFilter]       = useState<'all' | 'today' | '7' | '14' | '30'>('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [selectedTask, setSelectedTask]   = useState<DeliveryTask | null>(null)
  const [showCreate, setShowCreate]       = useState(false)

  const { role, profile } = useAuth()
  const isPMOrOwner = role === 'owner' || role === 'project_manager'
  const canDelete = role === 'owner' || role === 'project_manager' || role === 'account_manager'

  const { data: tasks = [], isLoading, isError } = useTasks(
    clientFilter,
    isPMOrOwner ? undefined : profile?.user_id,
  )
  const { data: clients = [] } = useClientList()
  const { data: profilesList = [] } = useQuery<{ user_id: string; full_name: string }[]>({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_active', true)
      return (data ?? []) as { user_id: string; full_name: string }[]
    },
  })

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

  // ── Employee filtering (PM/Owner only) ──────────────────────────────────────
  const employeeTasks = (() => {
    if (!isPMOrOwner || employeeFilter === 'all') return dateTasks
    return dateTasks.filter(t =>
      (t.task_assignments ?? []).some(a => a.user_id === employeeFilter)
    )
  })()

  // ── View filtering ──────────────────────────────────────────────────────────
  const visibleTasks = (() => {
    switch (activeView) {
      case 'qa-gate':
        return employeeTasks.filter(t => !t.ar_output_logged && t.status !== 'Not Started')
      case 'blocked':
        return employeeTasks.filter(t => t.status === 'Blocked')
      case 'overdue':
        return employeeTasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done')
      case 'done':
        return employeeTasks.filter(t => t.status === 'Done')
      default:
        return employeeTasks
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

  const VIEWS: { id: ViewTab; label: string; help: string }[] = [
    { id: 'timeline',   label: 'Timeline',      help: 'All tasks ordered by delivery step and due date. The default view for tracking overall client delivery progress.' },
    { id: 'workstream', label: 'By Workstream', help: 'Tasks grouped by department (SEO, PPC, Web, Social, etc.). Use this to see what each team is working on.' },
    { id: 'qa-gate',    label: 'QA Gate',       help: 'Tasks that are in progress but the A/R output URL hasn\'t been logged yet. The next delivery step is locked until these are cleared.' },
    { id: 'blocked',    label: 'Blocked',       help: 'Tasks with status "Blocked". Each should have a matching blocker logged on the Blockers page. Resolve or escalate promptly.' },
    { id: 'overdue',    label: 'Overdue',       help: 'Tasks past their due date that aren\'t done. Prioritize these — they directly affect the client\'s risk score.' },
    { id: 'done',       label: 'Done',          help: 'All completed tasks. Use this to review what has been delivered for each client.' },
  ]

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
              <HelpPopover title={v.label} content={v.help} side="bottom" align="left" />
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
        <div className="flex gap-1 ml-auto">
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
          className="px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Employee Filter — PM/Owner only */}
        {isPMOrOwner && (
          <select
            value={employeeFilter}
            onChange={e => setEmployeeFilter(e.target.value)}
            className="px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Employees</option>
            {profilesList.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
            ))}
          </select>
        )}
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
                    <th>R</th>
                    <th>A</th>
                    <th>Status</th>
                    <th>A/R</th>
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
