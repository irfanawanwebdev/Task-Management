/**
 * CreateTaskDialog — reusable modal for creating a new delivery task.
 * Used from TasksPage (global "Add Task") and ClientDetailPage ("New Task").
 * §8.3: Tasks always within a client; Assignee (person name) required.
 */

import { useState } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, Profile, Workstream } from '@/lib/types'
import { WORKSTREAMS } from '@/lib/types'
import { useNavigationGuard } from '@/lib/useNavigationGuard'
import { cn } from '@/lib/utils'

interface CreateTaskForm {
  task_name: string
  client_id: string
  assignee_user_ids: string[]   // supports multiple assignees
  due_date: string
  impact_level: string
  workstream: Workstream
  description: string
  blocker_text: string
  client_facing_risk: boolean
  recurrence: 'none' | 'weekly' | 'biweekly' | 'monthly'
  // Web/Dev asset fields (conditional)
  asset_which: string
  asset_format: string
  asset_destination: string
  asset_client_contact: string
  asset_client_deadline: string
}

const BLANK: CreateTaskForm = {
  task_name: '', client_id: '', assignee_user_ids: [], due_date: '',
  impact_level: 'Medium', workstream: 'Ops/PM',
  description: '', blocker_text: '', client_facing_risk: false,
  recurrence: 'none',
  asset_which: '', asset_format: '', asset_destination: '',
  asset_client_contact: '', asset_client_deadline: '',
}

/** Compute the next due date for a recurring task. */
function calcNextDueDate(dueDate: string, recurrence: 'weekly' | 'biweekly' | 'monthly'): string {
  const d = new Date(dueDate + 'T12:00:00')
  if (recurrence === 'weekly') {
    d.setDate(d.getDate() + 7)
  } else if (recurrence === 'biweekly') {
    d.setDate(d.getDate() + 14)
  } else {
    const day = d.getDate()
    d.setMonth(d.getMonth() + 1)
    // If month rollover (e.g. Jan 31 → Mar), clamp to last day of intended month
    if (d.getDate() !== day) d.setDate(0)
  }
  return d.toISOString().split('T')[0]
}

interface Props {
  open: boolean
  onClose: () => void
  presetClientId?: string
  clients?: Client[]
}

export function CreateTaskDialog({ open, onClose, presetClientId, clients = [] }: Props) {
  useNavigationGuard(open)

  const qc = useQueryClient()
  const [form, setForm] = useState<CreateTaskForm>({
    ...BLANK, client_id: presetClientId ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  // Fetch active team members for assignee dropdown
  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, department, is_active, page_access, can_create_users, created_at, updated_at')
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return (data ?? []) as unknown as Profile[]
    },
    enabled: open,
  })

  // Show asset fields when workstream is Web/Dev AND "asset" in task name
  const showAssetFields = form.workstream === 'Web/Dev' &&
    form.task_name.toLowerCase().includes('asset')

  const mutation = useMutation({
    mutationFn: async (data: CreateTaskForm) => {
      // Build description — append asset details if present
      let descriptionText = data.description.trim() || null
      if (showAssetFields && data.asset_which.trim()) {
        const assetLines = [
          data.description.trim(),
          '',
          '--- Asset Request Details ---',
          data.asset_which.trim()     && `Assets needed: ${data.asset_which.trim()}`,
          data.asset_format.trim()    && `Format/Resolution: ${data.asset_format.trim()}`,
          data.asset_destination.trim() && `Deliver to: ${data.asset_destination.trim()}`,
          data.asset_client_contact.trim() && `Client contact: ${data.asset_client_contact.trim()}`,
          data.asset_client_deadline.trim() && `Client deadline: ${data.asset_client_deadline.trim()}`,
        ].filter(Boolean).join('\n')
        descriptionText = assetLines || null
      }

      // 1. Insert the task
      const { data: inserted, error: taskErr } = await supabase
        .from('delivery_tasks')
        .insert({
          task_name: data.task_name.trim(),
          client_id: data.client_id,
          due_date: data.due_date || null,
          impact_level: data.impact_level,
          workstream: data.workstream,
          description: descriptionText,
          blocker_text: data.blocker_text.trim() || null,
          status: 'Not Started',
          step: 0,
          step_name: 'Ad-hoc',
          timeline: 'TBD',
          ar_output_logged: false,
        } as never)
        .select('id')
        .single()

      if (taskErr) throw new Error(taskErr.message)

      // 2. Insert task assignments for all assignees
      if (data.assignee_user_ids.length > 0 && inserted?.id) {
        const rows = data.assignee_user_ids.map(uid => ({
          task_id: inserted.id, user_id: uid, role_type: 'R',
        }))
        const { error: assignErr } = await supabase
          .from('task_assignments')
          .insert(rows as never)
        if (assignErr) throw new Error(assignErr.message)
      }

      // 3. If recurring, patch initial task + create next occurrence
      if (data.recurrence !== 'none' && data.due_date && inserted?.id) {
        const groupId = crypto.randomUUID()
        await supabase
          .from('delivery_tasks')
          .update({
            recurrence: data.recurrence,
            recurrence_group_id: groupId,
            recurrence_anchor_date: data.due_date,
          } as never)
          .eq('id', inserted.id)

        const nextDue = calcNextDueDate(data.due_date, data.recurrence)
        const { data: nextTask, error: nextErr } = await supabase
          .from('delivery_tasks')
          .insert({
            task_name:            data.task_name.trim(),
            client_id:            data.client_id,
            due_date:             nextDue,
            impact_level:         data.impact_level,
            workstream:           data.workstream,
            description:          descriptionText,
            blocker_text:         data.blocker_text.trim() || null,
            status:               'Not Started',
            step:                 0,
            step_name:            'Ad-hoc',
            timeline:             'TBD',
            ar_output_logged:     false,
            recurrence:           data.recurrence,
            recurrence_group_id:  groupId,
            recurrence_anchor_date: data.due_date,
          } as never)
          .select('id')
          .single()

        if (nextErr) throw new Error(nextErr.message)

        if (nextTask?.id && data.assignee_user_ids.length > 0) {
          const nextRows = data.assignee_user_ids.map(uid => ({
            task_id: nextTask.id, user_id: uid, role_type: 'R',
          }))
          const { error: nextAssignErr } = await supabase
            .from('task_assignments')
            .insert(nextRows as never)
          if (nextAssignErr) throw new Error(nextAssignErr.message)
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['client-detail'] })
      qc.invalidateQueries({ queryKey: ['task-assignments-workload'] })
      setForm({ ...BLANK, client_id: presetClientId ?? '' })
      setError(null)
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.task_name.trim()) { setError('Task name is required.'); return }
    if (!form.client_id) { setError('Client is required.'); return }
    if (form.assignee_user_ids.length === 0) { setError('At least one assignee is required.'); return }
    if (!form.due_date) { setError('Due date is required.'); return }
    setError(null)
    mutation.mutate(form)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Create Task</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Task Name <span className="text-destructive">*</span>
            </label>
            <input
              value={form.task_name}
              onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Complete SEO audit"
            />
          </div>

          {/* Client (hidden when preset) */}
          {!presetClientId && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Client <span className="text-destructive">*</span>
              </label>
              <select
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Assignees — multi-select checkboxes */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              Assignees <span className="text-destructive">*</span>
              {form.assignee_user_ids.length > 0 && (
                <span className="ml-1.5 text-primary font-normal">({form.assignee_user_ids.length} selected)</span>
              )}
            </label>
            <div className="max-h-36 overflow-y-auto rounded-md border border-input bg-background divide-y divide-border/40">
              {profiles.map(p => {
                const checked = form.assignee_user_ids.includes(p.user_id)
                return (
                  <label
                    key={p.user_id}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm hover:bg-accent/50 transition-colors',
                      checked && 'bg-primary/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setForm(f => ({
                          ...f,
                          assignee_user_ids: checked
                            ? f.assignee_user_ids.filter(id => id !== p.user_id)
                            : [...f.assignee_user_ids, p.user_id],
                        }))
                      }}
                      className="rounded border-input accent-primary"
                    />
                    <span className={cn('flex-1', checked && 'font-medium text-foreground')}>{p.full_name}</span>
                  </label>
                )
              })}
              {profiles.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No team members found.</p>
              )}
            </div>
          </div>

          {/* Due Date + Impact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Due Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Impact Level <span className="text-destructive">*</span>
              </label>
              <select
                value={form.impact_level}
                onChange={e => setForm(f => ({ ...f, impact_level: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['High', 'Medium', 'Low'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Repeat */}
          <div>
            <label className="block text-xs font-medium mb-1">Repeat</label>
            <select
              value={form.recurrence}
              onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as CreateTaskForm['recurrence'] }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="none">No Repeat</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly (every 2 weeks)</option>
              <option value="monthly">Monthly</option>
            </select>
            {form.recurrence !== 'none' && form.due_date && (
              <p className="text-xs text-muted-foreground mt-1">
                Next occurrence: {calcNextDueDate(form.due_date, form.recurrence)}
              </p>
            )}
          </div>

          {/* Workstream */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Department / Workstream <span className="text-destructive">*</span>
            </label>
            <select
              value={form.workstream}
              onChange={e => setForm(f => ({ ...f, workstream: e.target.value as Workstream }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {WORKSTREAMS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>

          {/* Definition of Done */}
          <div>
            <label className="block text-xs font-medium mb-1">Definition of Done</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="What does completion look like?"
            />
          </div>

          {/* Dependencies / Blockers */}
          <div>
            <label className="block text-xs font-medium mb-1">Dependencies / Blockers</label>
            <input
              value={form.blocker_text}
              onChange={e => setForm(f => ({ ...f, blocker_text: e.target.value }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Any blockers or dependencies?"
            />
          </div>

          {/* Client-facing risk */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.client_facing_risk}
              onChange={e => setForm(f => ({ ...f, client_facing_risk: e.target.checked }))}
              className={cn('rounded')}
            />
            <span className="text-xs font-medium">Client-facing risk</span>
          </label>

          {/* Web/Dev Asset Request fields (conditional §8.3) */}
          {showAssetFields && (
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Asset Request Details
              </p>
              {[
                { field: 'asset_which' as const,          label: 'Which assets exactly?' },
                { field: 'asset_format' as const,         label: 'Format / Resolution requirements' },
                { field: 'asset_destination' as const,    label: 'Where to send completed assets?' },
                { field: 'asset_client_contact' as const, label: 'Client contact for assets' },
                { field: 'asset_client_deadline' as const,label: 'Client deadline for providing assets' },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1">{label}</label>
                  <input
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Task
          </button>
        </div>
      </div>
    </div>
  )
}
