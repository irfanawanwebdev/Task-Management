/**
 * Clients CRM Page — JZ Operations Hub
 * Full client directory table with health, risk scores, completion rates,
 * overdue counts, and workstream chips.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Loader2, Search, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, DeliveryTask, Meeting, Profile, Workstream } from '@/lib/types'
import { WORKSTREAMS } from '@/lib/types'
import { isOverdueEST, formatDateEST } from '@/lib/timezone'
import { getCompletionClass } from '@/lib/types'
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

interface AddClientForm {
  name: string
  owner_pm: string
  account_manager_name: string
  status: string
  health: string
  start_date: string
  primary_workstreams: Workstream[]
  notes: string
  drive_folder_url: string
  credentials_sheet_url: string
  website_url: string
}

const BLANK_FORM: AddClientForm = {
  name: '', owner_pm: '', account_manager_name: '',
  status: 'Onboarding', health: 'Green',
  start_date: new Date().toISOString().slice(0, 10),
  primary_workstreams: [],
  notes: '', drive_folder_url: '', credentials_sheet_url: '', website_url: '',
}

function AddClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AddClientForm>(BLANK_FORM)
  const [error, setError] = useState<string | null>(null)

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('id, user_id, full_name, department, is_active, page_access, can_create_users, created_at, updated_at')
        .eq('is_active', true).order('full_name')
      if (error) throw error
      return (data ?? []) as unknown as Profile[]
    },
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async (data: AddClientForm) => {
      const { error } = await supabase.from('clients').insert({
        name: data.name.trim(),
        owner_pm: data.owner_pm.trim() || null,
        account_manager_name: data.account_manager_name.trim() || null,
        status: data.status,
        health: data.health,
        start_date: data.start_date,
        primary_workstreams: data.primary_workstreams,
        notes: data.notes.trim() || null,
        drive_folder_url: data.drive_folder_url.trim() || null,
        credentials_sheet_url: data.credentials_sheet_url.trim() || null,
        website_url: data.website_url.trim() || null,
      } as never)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-page'] })
      setForm(BLANK_FORM)
      setError(null)
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const toggleWS = (ws: Workstream) => {
    setForm(f => ({
      ...f,
      primary_workstreams: f.primary_workstreams.includes(ws)
        ? f.primary_workstreams.filter(w => w !== ws)
        : [...f.primary_workstreams, ws],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Client name is required.'); return }
    if (!form.owner_pm.trim()) { setError('Owner PM is required.'); return }
    if (!form.account_manager_name.trim()) { setError('Account Manager is required.'); return }
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

          {/* Owner PM + Account Manager */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Owner PM <span className="text-destructive">*</span></label>
              <select
                value={form.owner_pm}
                onChange={e => setForm(f => ({ ...f, owner_pm: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select person…</option>
                {profiles.map(p => <option key={p.user_id} value={p.full_name}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Account Manager <span className="text-destructive">*</span></label>
              <select
                value={form.account_manager_name}
                onChange={e => setForm(f => ({ ...f, account_manager_name: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select person…</option>
                {profiles.map(p => <option key={p.user_id} value={p.full_name}>{p.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* Status + Health */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['Active', 'Onboarding', 'At Risk', 'Paused', 'Churned'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Health</label>
              <select
                value={form.health}
                onChange={e => setForm(f => ({ ...f, health: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['Green', 'Yellow', 'Red'].map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Workstreams */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Primary Workstreams</label>
            <div className="flex flex-wrap gap-1.5">
              {WORKSTREAMS.map(ws => (
                <button
                  key={ws}
                  type="button"
                  onClick={() => toggleWS(ws)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                    form.primary_workstreams.includes(ws)
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-muted border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {ws}
                </button>
              ))}
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-3">
            {([
              ['website_url', 'Website URL'],
              ['drive_folder_url', 'Drive Folder URL'],
              ['credentials_sheet_url', 'Credentials Sheet URL'],
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

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Optional notes…"
            />
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
  const { data, isLoading, error } = useClientsPageData()
  const [search, setSearch] = useState('')
  const [filterHealth, setFilterHealth] = useState<string>('All')
  const [showAdd, setShowAdd] = useState(false)

  const clients  = data?.clients  ?? []
  const tasks    = data?.tasks    ?? []
  const meetings = data?.meetings ?? []

  const filtered = clients.filter(c => {
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
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search ? 'No clients match your search.' : 'No clients yet.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const { over, blk, comp, next } = clientStats(c)
                    const healthClass = c.health === 'Green' ? 'health-green'
                      : c.health === 'Yellow' ? 'health-yellow' : 'health-red'
                    const statusClass = c.status === 'Active' ? 'status-in-progress'
                      : c.status === 'At Risk' ? 'status-blocked'
                      : 'status-not-started'
                    return (
                      <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
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
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${comp}%` }}
                              />
                            </div>
                            <span className={cn('text-xs font-mono font-medium', getCompletionClass(comp))}>
                              {comp}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {over > 0
                            ? <span className="text-sm font-medium text-destructive">{over}</span>
                            : <span className="text-sm text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {blk > 0
                            ? <span className="text-sm font-medium text-[hsl(var(--warning))]">{blk}</span>
                            : <span className="text-sm text-muted-foreground">—</span>
                          }
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
                      </tr>
                    )
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
