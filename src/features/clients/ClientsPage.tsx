/**
 * Clients CRM Page — JZ Operations Hub
 * Full client directory table with health, risk scores, completion rates,
 * overdue counts, and workstream chips.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Loader2, Search, Plus, X, ChevronRight, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import type { Client, DeliveryTask, Meeting, ClientStatus } from '@/lib/types'
import { isOverdueEST, formatDateEST } from '@/lib/timezone'
import { getCompletionClass } from '@/lib/types'
import { useNavigationGuard } from '@/lib/useNavigationGuard'
import { cn } from '@/lib/utils'

// ─── Data Hook ────────────────────────────────────────────────────────────────

function useClientsPageData() {
  return useQuery({
    queryKey: ['clients-page'],
    queryFn: async () => {
      const [clientsRes, tasksRes, meetingsRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('delivery_tasks').select('id, client_id, status, due_date, impact_level, workstream'),
        supabase
          .from('meetings')
          .select('client_id, date, type, status')
          .gte('date', new Date().toISOString().slice(0, 10))
          .order('date')
          .limit(200),
      ])
      return {
        clients:  (clientsRes.data  ?? []) as Client[],
        tasks:    (tasksRes.data    ?? []) as Partial<DeliveryTask>[],
        meetings: (meetingsRes.data ?? []) as Partial<Meeting>[],
      }
    },
  })
}

// ─── Add Client Dialog ────────────────────────────────────────────────────────
// Health is NEVER set here — it is always computed from the risk score engine.

interface AddClientForm {
  name: string
  status: ClientStatus
  start_date: string
  website_url: string
  drive_folder_url: string
  credentials_sheet_url: string
  notes: string
  facebook_url: string
  instagram_url: string
  linkedin_url: string
  youtube_url: string
  location_count: 0 | 1 | 2 | 3
  location_names: [string, string, string]
}

const BLANK_FORM: AddClientForm = {
  name: '',
  status: 'Onboarding',
  start_date: new Date().toISOString().slice(0, 10),
  website_url: '',
  drive_folder_url: '',
  credentials_sheet_url: '',
  notes: '',
  facebook_url: '',
  instagram_url: '',
  linkedin_url: '',
  youtube_url: '',
  location_count: 0,
  location_names: ['', '', ''],
}

function AddClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useNavigationGuard(open)

  const qc = useQueryClient()
  const [form, setForm] = useState<AddClientForm>(BLANK_FORM)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (data: AddClientForm) => {
      // 1. Insert parent client
      const { data: parent, error } = await supabase.from('clients').insert({
        name:                  data.name.trim(),
        status:                data.status,
        start_date:            data.start_date,
        website_url:           data.website_url.trim() || null,
        drive_folder_url:      data.drive_folder_url.trim() || null,
        credentials_sheet_url: data.credentials_sheet_url.trim() || null,
        notes:                 data.notes.trim() || null,
        facebook_url:          data.facebook_url.trim() || null,
        instagram_url:         data.instagram_url.trim() || null,
        linkedin_url:          data.linkedin_url.trim() || null,
        youtube_url:           data.youtube_url.trim() || null,
        parent_client_id:      null,
        location_name:         null,
        // health is NOT accepted as user input — DB defaults to 'Green'
      } as never).select('id').single()
      if (error) throw new Error(error.message)

      // 2. Insert child location clients if any
      if (data.location_count > 0 && parent) {
        const children = data.location_names
          .slice(0, data.location_count)
          .filter(n => n.trim())
          .map(locationName => ({
            name:             `${data.name.trim()} ${locationName.trim()}`,
            status:           data.status,
            start_date:       data.start_date,
            parent_client_id: parent.id,
            location_name:    locationName.trim(),
          }))
        if (children.length > 0) {
          const { error: childErr } = await supabase.from('clients').insert(children as never)
          if (childErr) throw new Error(childErr.message)
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-page'] })
      setForm(BLANK_FORM)
      setError(null)
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())                  { setError('Client name is required.'); return }
    if (!form.status)                       { setError('Status is required.'); return }
    if (!form.start_date)                   { setError('Start date is required.'); return }
    if (!form.website_url.trim())           { setError('Website URL is required.'); return }
    if (!form.drive_folder_url.trim())      { setError('Drive Folder URL is required.'); return }
    if (!form.credentials_sheet_url.trim()) { setError('Credentials Sheet URL is required.'); return }
    if (!form.notes.trim())                 { setError('Notes is required.'); return }
    setError(null)
    mutation.mutate(form)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Add Client</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1">Client Name <span className="text-destructive">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Acme Corp"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium mb-1">Status <span className="text-destructive">*</span></label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as ClientStatus }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(['Active', 'Onboarding', 'At Risk', 'Paused', 'Offboarding'] as ClientStatus[]).map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium mb-1">Start Date <span className="text-destructive">*</span></label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* URLs */}
          <div className="space-y-3">
            {([
              ['website_url',           'Website URL'],
              ['drive_folder_url',      'Drive Folder URL'],
              ['credentials_sheet_url', 'Credentials Sheet URL'],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-medium mb-1">{label} <span className="text-destructive">*</span></label>
                <input
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="https://…"
                />
              </div>
            ))}
          </div>

          {/* Social Media (optional) */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground select-none">
              Social Media URLs (optional) <span className="group-open:hidden">▼</span><span className="hidden group-open:inline">▲</span>
            </summary>
            <div className="mt-3 space-y-3">
              {([
                ['facebook_url',  'Facebook URL'],
                ['instagram_url', 'Instagram URL'],
                ['linkedin_url',  'LinkedIn URL'],
                ['youtube_url',   'YouTube URL'],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1">{label}</label>
                  <input
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="https://…"
                  />
                </div>
              ))}
            </div>
          </details>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1">Notes <span className="text-destructive">*</span></label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Brief context about this client…"
            />
          </div>

          {/* Locations (optional) */}
          <div className="space-y-2">
            <label className="block text-xs font-medium">Locations (optional)</label>
            <select
              value={form.location_count}
              onChange={e => setForm(f => ({ ...f, location_count: Number(e.target.value) as 0|1|2|3 }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={0}>No locations (single office)</option>
              <option value={1}>1 location</option>
              <option value={2}>2 locations</option>
              <option value={3}>3 locations</option>
            </select>
            {form.location_count > 0 && Array.from({ length: form.location_count }).map((_, i) => (
              <input
                key={i}
                placeholder={`Location ${i + 1} name (e.g. "Los Angeles")`}
                value={form.location_names[i] ?? ''}
                onChange={e => setForm(f => {
                  const names = [...f.location_names] as [string, string, string]
                  names[i] = e.target.value
                  return { ...f, location_names: names }
                })}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
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
            Add Client
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Workstream Chips ─────────────────────────────────────────────────────────

function WorkstreamChips({ streams }: { streams: string[] }) {
  const first3 = streams.slice(0, 3)
  const extra  = streams.length - 3
  return (
    <div className="flex flex-wrap gap-1">
      {first3.map(s => (
        <span key={s} className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">
          {s}
        </span>
      ))}
      {extra > 0 && (
        <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">+{extra}</span>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { role } = useAuth()
  const canDelete = role === 'owner' || role === 'project_manager' || role === 'account_manager'

  const { data, isLoading, error } = useClientsPageData()
  const [search, setSearch] = useState('')
  const [filterHealth, setFilterHealth] = useState<string>('All')
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-page'] })
      setConfirmDeleteId(null)
    },
  })

  const clients  = data?.clients  ?? []
  const tasks    = data?.tasks    ?? []
  const meetings = data?.meetings ?? []

  // Separate parents (no parent_client_id) and children (has parent_client_id)
  const parentClients = clients.filter(c => !c.parent_client_id)
  const childrenByParent = clients.reduce<Record<string, Client[]>>((acc, c) => {
    if (c.parent_client_id) {
      acc[c.parent_client_id] = acc[c.parent_client_id] ?? []
      acc[c.parent_client_id].push(c)
    }
    return acc
  }, {})

  const filtered = parentClients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchHealth = filterHealth === 'All' || c.health === filterHealth
    return matchSearch && matchHealth
  })

  // Per-client computed values
  const clientStats = (client: Client) => {
    const ct    = tasks.filter(t => t.client_id === client.id)
    const withDue = ct.filter(t => t.due_date)
    const done  = withDue.filter(t => t.status === 'Done').length
    const over  = withDue.filter(t => isOverdueEST(t.due_date!) && t.status !== 'Done').length
    const blk   = ct.filter(t => t.status === 'Blocked').length
    const comp  = withDue.length > 0 ? Math.round((done / withDue.length) * 100) : 100
    const next  = meetings
      .filter(m => m.client_id === client.id && m.status !== 'Completed')
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]
    return { done, over, blk, comp, next }
  }

  return (
    <div className="space-y-5">
      <AddClientDialog open={showAdd} onClose={() => setShowAdd(false)} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.filter(c => c.status === 'Active').length} active clients
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="pl-8 pr-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground w-52"
          />
        </div>
        {(['All', 'Green', 'Yellow', 'Red'] as const).map(h => (
          <button
            key={h}
            onClick={() => setFilterHealth(h)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              filterHealth === h
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {h}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading clients…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Completion</th>
                  <th>Overdue</th>
                  <th>Blocked</th>
                  <th>Next Meeting</th>
                  <th>Workstreams</th>
                  {canDelete && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canDelete ? 9 : 8} className="text-center py-12">
                      <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search ? 'No clients match your search.' : 'No clients yet.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.flatMap(c => {
                    const { over, blk, comp, next } = clientStats(c)
                    const healthClass = c.health === 'Green' ? 'health-green'
                      : c.health === 'Yellow' ? 'health-yellow' : 'health-red'
                    const statusClass = c.status === 'Active' ? 'status-in-progress'
                      : c.status === 'At Risk' ? 'status-blocked'
                      : 'status-not-started'
                    const children = childrenByParent[c.id] ?? []
                    const rows = [
                      <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                        <td className="px-4 py-3">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium">{c.name}</p>
                              {children.length > 0 && (
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                  {children.length} loc
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">Since {formatDateEST(c.start_date)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={statusClass}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={healthClass}>{c.health}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full min-w-12 max-w-20 overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${comp}%` }} />
                            </div>
                            <span className={cn('text-xs font-mono font-medium', getCompletionClass(comp))}>{comp}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {over > 0 ? <span className="text-sm font-medium text-destructive">{over}</span> : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {blk > 0 ? <span className="text-sm font-medium text-[hsl(var(--warning))]">{blk}</span> : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {next ? (
                            <div>
                              <p className="text-xs font-medium">{formatDateEST(next.date!)}</p>
                              <p className="text-xs text-muted-foreground">{next.type}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not scheduled</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <WorkstreamChips streams={c.primary_workstreams ?? []} />
                        </td>
                        {canDelete && (
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            {confirmDeleteId === c.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => deleteClient.mutate(c.id)}
                                  disabled={deleteClient.isPending}
                                  className="px-2 py-0.5 rounded text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteClient.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(c.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete client"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>,
                      // Child location rows
                      ...children.map(child => {
                        const childHealth = child.health === 'Green' ? 'health-green'
                          : child.health === 'Yellow' ? 'health-yellow' : 'health-red'
                        return (
                          <tr key={child.id} onClick={() => navigate(`/clients/${child.id}`)}
                            className="bg-muted/20">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2 pl-4 border-l-2 border-border/50">
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">{child.location_name ?? child.name}</p>
                                  <p className="text-xs text-muted-foreground">{child.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={child.status === 'Active' ? 'status-in-progress' : 'status-not-started'}>{child.status}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={childHealth}>{child.health}</span>
                            </td>
                            <td colSpan={canDelete ? 6 : 5} className="px-4 py-2.5 text-xs text-muted-foreground">
                              View location dashboard →
                            </td>
                          </tr>
                        )
                      }),
                    ]
                    return rows
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
