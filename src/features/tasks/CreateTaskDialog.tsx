/**
 * CreateTaskDialog — reusable modal for creating a new delivery task.
 * Used from TasksPage (global "Add Task") and ClientDetailPage ("New Task").
 */

import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, Workstream } from '@/lib/types'
import { WORKSTREAMS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CreateTaskForm {
  task_name: string
  client_id: string
  due_date: string
  impact_level: string
  workstream: Workstream
  description: string
  blocker_text: string
  client_facing_risk: boolean
}

const BLANK: CreateTaskForm = {
  task_name: '', client_id: '', due_date: '',
  impact_level: 'Medium', workstream: 'Ops/PM',
  description: '', blocker_text: '', client_facing_risk: false,
}

interface Props {
  open: boolean
  onClose: () => void
  presetClientId?: string
  clients?: Client[]
}

export function CreateTaskDialog({ open, onClose, presetClientId, clients = [] }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateTaskForm>({
    ...BLANK, client_id: presetClientId ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (data: CreateTaskForm) => {
      const { error } = await supabase.from('delivery_tasks').insert({
        task_name: data.task_name.trim(),
        client_id: data.client_id,
        due_date: data.due_date || null,
        impact_level: data.impact_level,
        workstream: data.workstream,
        description: data.description.trim() || null,
        blocker_text: data.blocker_text.trim() || null,
        status: 'Not Started',
        step: 0,
        step_name: 'Ad-hoc',
        timeline: 'TBD',
        ar_output_logged: false,
      } as never)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['client-detail'] })
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
