/**
 * Blockers Page — /blockers
 * Centralized blocker monitoring: severity levels, aging, status tracking, resolution notes.
 * Sorted High → Med → Low, then Open first.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Clock, Plus, X, ChevronDown, Loader2,
  CheckCircle2, Circle, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Blocker, Client } from '@/lib/types'
import { WORKSTREAMS } from '@/lib/types'
import { formatDateEST, daysAgoEST, todayDateEST } from '@/lib/timezone'
import { useAuth } from '@/features/auth/AuthContext'
import { isPMOrOwner } from '@/lib/permissions'
import { useNavigationGuard } from '@/lib/useNavigationGuard'
import { cn } from '@/lib/utils'
import { HelpPopover } from '@/components/HelpPopover'

// ─── Data Hooks ───────────────────────────────────────────────────────────────

function useBlockers() {
  const { profile, role } = useAuth()
  const isManager = role ? isPMOrOwner(role) : false

  // For non-managers: fetch user's assigned task IDs to scope visibility (§6.2)
  const { data: myTaskIds = [] } = useQuery<string[]>({
    queryKey: ['my-task-ids', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return []
      const { data, error } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', profile.user_id)
      if (error) return []
      return (data ?? []).map((r: { task_id: string }) => r.task_id)
    },
    enabled: !isManager && !!profile?.user_id,
  })

  return useQuery<Blocker[]>({
    queryKey: ['blockers-page'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blockers')
        .select('*, clients(name), profiles(full_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Blocker[]
    },
    select: (data) => {
      // PM/Owner: see all blockers
      if (isManager) return data
      // Specialists: see only blockers where they are the owner OR the blocker's task is assigned to them
      return data.filter(b =>
        b.owner_id === profile?.id ||
        (b.task_id && myTaskIds.includes(b.task_id))
      )
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = { High: 0, Med: 1, Low: 2 } as const
const STATUS_ORDER = { Open: 0, 'In Progress': 1, Resolved: 2 } as const

function sortBlockers(blockers: Blocker[]): Blocker[] {
  return [...blockers].sort((a, b) => {
    const sv = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sv !== 0) return sv
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  })
}

function SeverityBadge({ severity }: { severity: Blocker['severity'] }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
      severity === 'High' && 'bg-red-100 text-red-700',
      severity === 'Med'  && 'bg-amber-100 text-amber-700',
      severity === 'Low'  && 'bg-blue-100 text-blue-700',
    )}>
      {severity === 'High' && <AlertTriangle className="h-3 w-3" />}
      {severity === 'Med'  && <AlertCircle  className="h-3 w-3" />}
      {severity === 'Low'  && <Circle       className="h-3 w-3" />}
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: Blocker['status'] }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      status === 'Open'        && 'bg-red-50 text-red-600',
      status === 'In Progress' && 'bg-amber-50 text-amber-600',
      status === 'Resolved'    && 'bg-green-50 text-green-700',
    )}>
      {status}
    </span>
  )
}

function AgingBadge({ createdDate }: { createdDate: string }) {
  const days = daysAgoEST(createdDate)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      days > 3 ? 'bg-red-100 text-red-700 font-bold' : 'bg-muted text-muted-foreground',
    )}>
      <Clock className="h-3 w-3" />
      {days}d
    </span>
  )
}

// ─── Blocker Card ─────────────────────────────────────────────────────────────

function BlockerCard({ blocker, canEdit }: { blocker: Blocker; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(blocker.resolution_notes ?? '')

  const updateStatus = useMutation({
    mutationFn: async (status: Blocker['status']) => {
      const { error } = await supabase
        .from('blockers')
        .update({ status } as never)
        .eq('id', blocker.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blockers-page'] }),
  })

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('blockers')
        .update({ resolution_notes: notes } as never)
        .eq('id', blocker.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers-page'] })
      setEditingNotes(false)
    },
  })

  const clientName = (blocker.clients as unknown as { name: string } | undefined)?.name ?? '—'
  const ownerName  = (blocker.profiles as unknown as { full_name: string } | undefined)?.full_name ?? blocker.owner_id ?? '—'

  return (
    <div className={cn(
      'rounded-lg border bg-card p-4 shadow-sm space-y-3',
      blocker.severity === 'High' && blocker.status !== 'Resolved' && 'border-red-200',
      daysAgoEST(blocker.created_date) > 3 && blocker.status !== 'Resolved' && 'ring-1 ring-red-400',
    )}>
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2">
        <SeverityBadge severity={blocker.severity} />
        <StatusBadge   status={blocker.status} />
        <AgingBadge    createdDate={blocker.created_date} />
        <span className="ml-auto text-xs text-muted-foreground">
          Created {formatDateEST(blocker.created_date)}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm font-medium leading-snug">{blocker.description}</p>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
        <div><span className="font-medium text-foreground/70">Client:</span> {clientName}</div>
        <div><span className="font-medium text-foreground/70">Workstream:</span> {blocker.workstream}</div>
        <div><span className="font-medium text-foreground/70">Owner:</span> {ownerName}</div>
        <div><span className="font-medium text-foreground/70">Due:</span> {blocker.due_date ? formatDateEST(blocker.due_date) : '—'}</div>
      </div>

      {/* Resolution notes */}
      {editingNotes ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Resolution notes…"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveNotes.mutate()}
              disabled={saveNotes.isPending}
              className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {saveNotes.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </button>
            <button
              onClick={() => { setEditingNotes(false); setNotes(blocker.resolution_notes ?? '') }}
              className="inline-flex items-center rounded border px-3 py-1 text-xs hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : blocker.resolution_notes ? (
        <div className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Notes:</span> {blocker.resolution_notes}
          {canEdit && (
            <button
              onClick={() => setEditingNotes(true)}
              className="ml-2 text-primary underline"
            >
              Edit
            </button>
          )}
        </div>
      ) : canEdit ? (
        <button
          onClick={() => setEditingNotes(true)}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          + Add resolution notes
        </button>
      ) : null}

      {/* Status actions */}
      {canEdit && blocker.status !== 'Resolved' && (
        <div className="flex gap-2 pt-1">
          {blocker.status === 'Open' && (
            <button
              onClick={() => updateStatus.mutate('In Progress')}
              disabled={updateStatus.isPending}
              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              {updateStatus.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Mark In Progress
            </button>
          )}
          <button
            onClick={() => updateStatus.mutate('Resolved')}
            disabled={updateStatus.isPending}
            className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            {updateStatus.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            <CheckCircle2 className="h-3 w-3" />
            Mark Resolved
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Add Blocker Dialog ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  client_id: '',
  workstream: WORKSTREAMS[0] as Blocker['workstream'],
  description: '',
  severity: 'High' as Blocker['severity'],
  due_date: '',
}

function AddBlockerDialog({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  useNavigationGuard(true)

  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const add = useMutation({
    mutationFn: async () => {
      if (!form.client_id || !form.description.trim()) {
        setError('Client and description are required.')
        return
      }
      const { error } = await supabase.from('blockers').insert({
        client_id:    form.client_id,
        workstream:   form.workstream,
        description:  form.description.trim(),
        severity:     form.severity,
        status:       'Open',
        due_date:     form.due_date || null,
        created_date: todayDateEST(),
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers-page'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-card border shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Blocker</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-3">
          {/* Client */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Client *</label>
            <select
              value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Workstream */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Workstream</label>
            <select
              value={form.workstream}
              onChange={e => setForm(f => ({ ...f, workstream: e.target.value as Blocker['workstream'] }))}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            >
              {WORKSTREAMS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Severity</label>
            <div className="mt-1 flex gap-2">
              {(['High', 'Med', 'Low'] as Blocker['severity'][]).map(s => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, severity: s }))}
                  className={cn(
                    'flex-1 rounded border py-1.5 text-xs font-medium',
                    form.severity === s
                      ? s === 'High' ? 'bg-red-100 border-red-400 text-red-700'
                        : s === 'Med' ? 'bg-amber-100 border-amber-400 text-amber-700'
                        : 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'bg-muted border-input text-muted-foreground hover:bg-muted/70',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Describe the blocker…"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="inline-flex items-center gap-1 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Blocker
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterStatus = 'All' | 'Open' | 'In Progress' | 'Resolved'

export default function BlockersPage() {
  const { role } = useAuth()
  const canEdit = isPMOrOwner(role!)
  const [showAdd, setShowAdd] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All')
  const [filterSeverity, setFilterSeverity] = useState<'All' | 'High' | 'Med' | 'Low'>('All')
  const [filterClient, setFilterClient] = useState<string>('All')

  const { data: blockers = [], isLoading } = useBlockers()
  const { data: clients = [] }             = useClientList()

  const filtered = sortBlockers(
    blockers.filter(b =>
      (filterStatus   === 'All' || b.status      === filterStatus) &&
      (filterSeverity === 'All' || b.severity    === filterSeverity) &&
      (filterClient   === 'All' || b.client_id   === filterClient),
    ),
  )

  const openCount = blockers.filter(b => b.status !== 'Resolved').length
  const criticalCount = blockers.filter(b => b.severity === 'High' && b.status !== 'Resolved').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Blockers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {openCount} open blocker{openCount !== 1 ? 's' : ''}
            {criticalCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · {criticalCount} critical
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Blocker
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FilterStatus)}
            className="appearance-none rounded border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Severity filter */}
        <div className="relative">
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value as 'All' | 'High' | 'Med' | 'Low')}
            className="appearance-none rounded border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="All">All Severities</option>
            <option value="High">High</option>
            <option value="Med">Med</option>
            <option value="Low">Low</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Client / company filter */}
        <div className="relative">
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="appearance-none rounded border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="All">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        <HelpPopover
          title="Severity & Status Guide"
          side="bottom"
          align="left"
          content={
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Severity Levels</p>
              <p><span className="text-red-400 font-medium">High</span> — Blocks delivery entirely. Client is at risk. Escalate immediately.</p>
              <p><span className="text-amber-400 font-medium">Med</span> — Delays a step, but a workaround exists. Resolve within 48 hours.</p>
              <p><span className="text-green-400 font-medium">Low</span> — Minor delay, no immediate client impact. Resolve this week.</p>
              <p className="font-semibold text-foreground pt-1">Statuses</p>
              <p><strong>Open</strong> — Just logged, not yet being worked on.</p>
              <p><strong>In Progress</strong> — Actively being resolved.</p>
              <p><strong>Resolved</strong> — Fixed. Add resolution notes so the team can learn from it.</p>
            </div>
          }
        />

        {filtered.length !== blockers.length && (
          <button
            onClick={() => { setFilterStatus('All'); setFilterSeverity('All'); setFilterClient('All') }}
            className="inline-flex items-center gap-1 rounded border border-input px-3 py-2 text-xs hover:bg-muted"
          >
            <X className="h-3 w-3" /> Clear filters ({filtered.length}/{blockers.length})
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
          <CheckCircle2 className="h-8 w-8" />
          <p className="text-sm">No blockers match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map(b => (
            <BlockerCard key={b.id} blocker={b} canEdit={canEdit} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddBlockerDialog clients={clients} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}
