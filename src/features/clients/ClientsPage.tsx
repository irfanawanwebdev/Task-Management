/**
 * Clients CRM Page — JZ Operations Hub
 * Full client directory table with health, risk scores, completion rates,
 * overdue counts, and workstream chips.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, DeliveryTask, Meeting } from '@/lib/types'
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.filter(c => c.status === 'Active').length} active clients
          </p>
        </div>
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
