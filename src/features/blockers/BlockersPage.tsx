/**
 * Blockers Page — /blockers
 * Centralized blocker monitoring: severity levels, aging, status tracking, resolution notes.
 * Sorted High → Med → Low, then Open first.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Clock, Plus, X, ChevronDown, Loader2,
  CheckCircle2, Circle, AlertCircle, FileDown, ChevronRight, Check,
  Pencil, Trash2,
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
      if (isManager) return data
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
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
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
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
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
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
      days > 3 ? 'bg-red-100 text-red-700 font-bold' : 'bg-muted text-muted-foreground',
    )}>
      <Clock className="h-3 w-3" />
      {days}d
    </span>
  )
}

// ─── HTML Report Generator ────────────────────────────────────────────────────

function generateBlockersHTML(selected: Blocker[]): string {
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const severityColor = (s: Blocker['severity']) =>
    s === 'High' ? '#dc2626' : s === 'Med' ? '#d97706' : '#2563eb'
  const statusColor = (s: Blocker['status']) =>
    s === 'Open' ? '#dc2626' : s === 'In Progress' ? '#d97706' : '#16a34a'

  const cards = selected.map(b => {
    const clientName = (b.clients as unknown as { name: string } | undefined)?.name ?? '—'
    const ownerName  = (b.profiles as unknown as { full_name: string } | undefined)?.full_name ?? '—'
    const days = daysAgoEST(b.created_date)

    return `
    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:20px;
                ${b.severity === 'High' && b.status !== 'Resolved' ? 'border-left:4px solid #dc2626;' : ''}
                ${days > 3 && b.status !== 'Resolved' ? 'background:#fff8f8;' : 'background:#fff;'}">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <span style="background:${severityColor(b.severity)}22;color:${severityColor(b.severity)};
                     padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;">
          ${b.severity === 'High' ? '⚠ ' : b.severity === 'Med' ? '● ' : '○ '}${b.severity}
        </span>
        <span style="background:${statusColor(b.status)}18;color:${statusColor(b.status)};
                     padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;">
          ${b.status}
        </span>
        <span style="background:${days > 3 ? '#fef2f2' : '#f3f4f6'};color:${days > 3 ? '#dc2626' : '#6b7280'};
                     padding:3px 10px;border-radius:99px;font-size:12px;font-weight:${days > 3 ? '700' : '500'};">
          ⏱ ${days}d old
        </span>
        <span style="margin-left:auto;color:#9ca3af;font-size:12px;">
          Created ${formatDateEST(b.created_date)}
        </span>
      </div>

      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 14px;">${b.description}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:13px;color:#374151;margin-bottom:${b.resolution_notes ? '14px' : '0'};">
        <div><span style="color:#9ca3af;font-weight:500;">Client:</span> ${clientName}</div>
        <div><span style="color:#9ca3af;font-weight:500;">Workstream:</span> ${b.workstream ?? '—'}</div>
        <div><span style="color:#9ca3af;font-weight:500;">Owner:</span> ${ownerName}</div>
        <div><span style="color:#9ca3af;font-weight:500;">Due:</span> ${b.due_date ? formatDateEST(b.due_date) : '—'}</div>
      </div>

      ${b.resolution_notes ? `
      <div style="background:#f9fafb;border-radius:6px;padding:10px 14px;font-size:13px;color:#374151;margin-top:4px;">
        <span style="font-weight:600;color:#6b7280;">Resolution Notes: </span>${b.resolution_notes}
      </div>` : ''}
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Blocker Report — JZ Smart Media</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827; padding: 40px 24px; }
    .page { max-width: 860px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
    h1 { font-size: 24px; font-weight: 700; color: #111827; }
    .subtitle { color: #6b7280; font-size: 14px; margin-top: 4px; margin-bottom: 32px; }
    .summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
    .chip { padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
    @media print { body { padding: 0; background: #fff; } .page { box-shadow: none; padding: 24px; } }
  </style>
</head>
<body>
<div class="page">
  <h1>🚧 Blocker Report</h1>
  <p class="subtitle">JZ Smart Media · Generated ${now} · ${selected.length} blocker${selected.length !== 1 ? 's' : ''}</p>

  <div class="summary">
    <span class="chip" style="background:#fef2f2;color:#dc2626;">
      ⚠ High: ${selected.filter(b => b.severity === 'High').length}
    </span>
    <span class="chip" style="background:#fffbeb;color:#d97706;">
      ● Med: ${selected.filter(b => b.severity === 'Med').length}
    </span>
    <span class="chip" style="background:#eff6ff;color:#2563eb;">
      ○ Low: ${selected.filter(b => b.severity === 'Low').length}
    </span>
    <span class="chip" style="background:#f3f4f6;color:#374151;">
      Open: ${selected.filter(b => b.status === 'Open').length}
    </span>
    <span class="chip" style="background:#fffbeb;color:#d97706;">
      In Progress: ${selected.filter(b => b.status === 'In Progress').length}
    </span>
    <span class="chip" style="background:#f0fdf4;color:#16a34a;">
      Resolved: ${selected.filter(b => b.status === 'Resolved').length}
    </span>
  </div>

  ${cards}
</div>
</body>
</html>`
}

function downloadBlockersReport(selected: Blocker[]) {
  const html = generateBlockersHTML(selected)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Blockers-Report-${todayDateEST()}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Generate Report Modal ────────────────────────────────────────────────────

function GenerateReportModal({ blockers, onClose }: { blockers: Blocker[]; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(blockers.map(b => b.id)))

  const allChecked = selected.size === blockers.length
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(blockers.map(b => b.id)))
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleDownload = () => {
    const toExport = blockers.filter(b => selected.has(b.id))
    if (toExport.length === 0) return
    downloadBlockersReport(toExport)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Generate Blockers Report</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select which blockers to include in the download</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Select All */}
        <div className="px-5 py-3 border-b border-border/50 shrink-0">
          <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium">
            <span
              onClick={toggleAll}
              className={cn(
                'h-4 w-4 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0',
                allChecked ? 'bg-primary border-primary' : 'border-input bg-background',
              )}
            >
              {allChecked && <Check className="h-3 w-3 text-primary-foreground" />}
            </span>
            Select All ({blockers.length} blockers)
            <span className="ml-auto text-xs text-muted-foreground font-normal">{selected.size} selected</span>
          </label>
        </div>

        {/* Blocker list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {blockers.map(b => {
            const clientName = (b.clients as unknown as { name: string } | undefined)?.name ?? '—'
            const checked = selected.has(b.id)
            return (
              <label
                key={b.id}
                className={cn(
                  'flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors',
                  checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent/40',
                )}
              >
                <span
                  onClick={() => toggle(b.id)}
                  className={cn(
                    'h-4 w-4 mt-0.5 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0',
                    checked ? 'bg-primary border-primary' : 'border-input bg-background',
                  )}
                >
                  {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <SeverityBadge severity={b.severity} />
                    <StatusBadge status={b.status} />
                    <span className="text-xs text-muted-foreground">{clientName}</span>
                  </div>
                  <p className="text-sm font-medium line-clamp-2">{b.description}</p>
                </div>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Download ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Blocker Card ─────────────────────────────────────────────────────────────

function BlockerCard({ blocker, canEdit }: { blocker: Blocker; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(blocker.resolution_notes ?? '')
  // Edit blocker fields
  const [editingBlocker, setEditingBlocker] = useState(false)
  const [editDesc, setEditDesc]             = useState(blocker.description)
  const [editSeverity, setEditSeverity]     = useState(blocker.severity)
  const [editDueDate, setEditDueDate]       = useState(blocker.due_date ?? '')
  // Delete confirmation
  const [confirmDelete, setConfirmDelete]   = useState(false)

  const updateStatus = useMutation({
    mutationFn: async (status: Blocker['status']) => {
      const { error } = await supabase.from('blockers').update({ status } as never).eq('id', blocker.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blockers-page'] }),
  })

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('blockers').update({ resolution_notes: notes } as never).eq('id', blocker.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers-page'] })
      setEditingNotes(false)
    },
  })

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editDesc.trim()) throw new Error('Description is required.')
      const { error } = await supabase.from('blockers').update({
        description: editDesc.trim(),
        severity:    editSeverity,
        due_date:    editDueDate || null,
      } as never).eq('id', blocker.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers-page'] })
      setEditingBlocker(false)
    },
  })

  const deleteBlocker = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('blockers').delete().eq('id', blocker.id)
      if (error) throw error
      // If this blocker was linked to a task, unblock it
      if (blocker.task_id) {
        await supabase.from('delivery_tasks')
          .update({ status: 'In Progress', blocker_text: null } as never)
          .eq('id', blocker.task_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockers-page'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['client-detail'] })
    },
  })

  const clientName = (blocker.clients as unknown as { name: string } | undefined)?.name ?? '—'
  const ownerName  = (blocker.profiles as unknown as { full_name: string } | undefined)?.full_name ?? blocker.owner_id ?? '—'
  const isAging    = daysAgoEST(blocker.created_date) > 3

  return (
    <div className={cn(
      'rounded-lg border bg-card shadow-sm transition-all',
      blocker.severity === 'High' && blocker.status !== 'Resolved' && 'border-l-4 border-l-red-700 border-red-900/30',
      isAging && blocker.status !== 'Resolved' && 'ring-1 ring-red-800/50',
    )}>
      {/* ── Collapsed summary row ── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-accent/30 transition-colors rounded-lg"
      >
        <ChevronRight className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-90')} />
        <SeverityBadge severity={blocker.severity} />
        <StatusBadge   status={blocker.status} />
        <AgingBadge    createdDate={blocker.created_date} />
        <span className="flex-1 min-w-0 text-sm font-medium truncate ml-1">{blocker.description}</span>
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{clientName}</span>
      </button>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">

          {/* ── Edit form ── */}
          {editingBlocker ? (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/60">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Blocker</p>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description *</label>
                <textarea
                  autoFocus
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Severity</label>
                  <div className="mt-1 flex gap-1.5">
                    {(['High', 'Med', 'Low'] as Blocker['severity'][]).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditSeverity(s)}
                        className={cn(
                          'flex-1 rounded border py-1 text-xs font-medium transition-colors',
                          editSeverity === s
                            ? s === 'High' ? 'bg-red-100 border-red-400 text-red-700'
                              : s === 'Med' ? 'bg-amber-100 border-amber-400 text-amber-700'
                              : 'bg-blue-100 border-blue-400 text-blue-700'
                            : 'bg-background border-input text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {saveEdit.isError && (
                <p className="text-xs text-destructive">{(saveEdit.error as Error).message}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit.mutate()}
                  disabled={saveEdit.isPending || !editDesc.trim()}
                  className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saveEdit.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditDesc(blocker.description)
                    setEditSeverity(blocker.severity)
                    setEditDueDate(blocker.due_date ?? '')
                    setEditingBlocker(false)
                  }}
                  className="rounded border px-3 py-1 text-xs hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                <div><span className="font-medium text-foreground/70">Client:</span> {clientName}</div>
                <div><span className="font-medium text-foreground/70">Workstream:</span> {blocker.workstream}</div>
                <div><span className="font-medium text-foreground/70">Owner:</span> {ownerName}</div>
                <div><span className="font-medium text-foreground/70">Due:</span> {blocker.due_date ? formatDateEST(blocker.due_date) : '—'}</div>
                <div className="col-span-2 sm:col-span-4">
                  <span className="font-medium text-foreground/70">Created:</span> {formatDateEST(blocker.created_date)}
                </div>
              </div>

              {/* Full description */}
              <p className="text-sm leading-relaxed">{blocker.description}</p>
            </>
          )}

          {/* Resolution notes */}
          {!editingBlocker && (
            editingNotes ? (
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
                  <button onClick={() => setEditingNotes(true)} className="ml-2 text-primary underline">
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
            ) : null
          )}

          {/* ── Action row: status + edit + delete ── */}
          {!editingBlocker && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/30">
              {/* Status actions */}
              {canEdit && blocker.status !== 'Resolved' && (
                <>
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
                </>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Edit */}
              {canEdit && (
                <button
                  onClick={() => setEditingBlocker(true)}
                  className="inline-flex items-center gap-1 rounded border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}

              {/* Delete */}
              {canEdit && (
                confirmDelete ? (
                  <div className="inline-flex items-center gap-1">
                    <span className="text-xs text-destructive font-medium">Delete?</span>
                    <button
                      onClick={() => deleteBlocker.mutate()}
                      disabled={deleteBlocker.isPending}
                      className="inline-flex items-center gap-1 rounded bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {deleteBlocker.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded border px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1 rounded border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                )
              )}
            </div>
          )}
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
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm hover:bg-muted">
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
  const [showReport, setShowReport] = useState(false)
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

  const openCount     = blockers.filter(b => b.status !== 'Resolved').length
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
              <span className="ml-2 text-red-600 font-medium">· {criticalCount} critical</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReport(true)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded border border-input px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-40"
          >
            <FileDown className="h-4 w-4" />
            Export Report
          </button>
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
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="space-y-2">
          {filtered.map(b => (
            <BlockerCard key={b.id} blocker={b} canEdit={canEdit} />
          ))}
        </div>
      )}

      {showAdd && <AddBlockerDialog clients={clients} onClose={() => setShowAdd(false)} />}

      {showReport && (
        <GenerateReportModal blockers={filtered} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
