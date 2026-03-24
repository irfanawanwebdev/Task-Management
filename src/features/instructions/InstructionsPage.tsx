/**
 * Internal Workspace — /instructions
 * §13: Client SOP Library — grid of client cards.
 * Each card opens a client-specific operational plan.
 * Reference docs (SOPs, Social, Reports) accessible via quick links.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, Share2, FileText, Loader2, Search,
  ChevronRight, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Data Hook ────────────────────────────────────────────────────────────────

function useActiveClients() {
  return useQuery<Client[]>({
    queryKey: ['sop-library-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .in('status', ['Active', 'Onboarding'])
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Client[]
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      status === 'Active'     && 'bg-green-100 text-green-700',
      status === 'Onboarding' && 'bg-blue-100 text-blue-700',
    )}>
      {status}
    </span>
  )
}

// ─── Client SOP Card ─────────────────────────────────────────────────────────

function ClientCard({ client }: { client: Client }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/instructions/clients/${client.id}`)}
      className="group text-left flex flex-col rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors leading-tight">
          {client.name}
        </h3>
        <StatusBadge status={client.status} />
      </div>

      <div className="space-y-1 flex-1">
        {client.owner_pm && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">PM:</span> {client.owner_pm}
          </p>
        )}
        {client.account_manager_name && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">AM:</span> {client.account_manager_name}
          </p>
        )}
        {(client.primary_workstreams ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(client.primary_workstreams ?? []).slice(0, 4).map(ws => (
              <span key={ws} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">
                {ws}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {client.drive_folder_url ? (
          <a
            href={client.drive_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Drive
          </a>
        ) : <span />}
        <span className="flex items-center gap-0.5 text-xs font-medium text-primary">
          View Plan <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InstructionsPage() {
  const { data: clients = [], isLoading } = useActiveClients()
  const [search, setSearch] = useState('')

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.owner_pm ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.account_manager_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Internal Workspace
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Client SOP Library — click any client to view their operational plan
          </p>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients, PM, AM…"
            className="pl-8 pr-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring w-52 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Reference Doc Quick Links — dark connector-style cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: '16-Step SOP',
            href: '/instructions/sops',
            icon: BookOpen,
            accent: 'border-t-primary',
            iconBg: 'bg-primary/10 ring-1 ring-primary/20',
            iconColor: 'text-primary',
            desc: 'Full client delivery lifecycle — steps 0 through 15 with RACI assignments.',
          },
          {
            label: 'Social Guidelines',
            href: '/instructions/social',
            icon: Share2,
            accent: 'border-t-purple-500',
            iconBg: 'bg-purple-500/10 ring-1 ring-purple-500/20',
            iconColor: 'text-purple-400',
            desc: 'Brand voice, platform rules, and content standards for all social channels.',
          },
          {
            label: 'Report Checklist',
            href: '/instructions/reports',
            icon: FileText,
            accent: 'border-t-amber-500',
            iconBg: 'bg-amber-500/10 ring-1 ring-amber-500/20',
            iconColor: 'text-amber-400',
            desc: 'Weekly & monthly report quality checklist — items to verify before sending.',
          },
        ].map(doc => (
          <Link
            key={doc.href}
            to={doc.href}
            className={cn(
              'group flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden',
              'border-t-2 shadow-md transition-all duration-200',
              'hover:border-border hover:shadow-lg hover:-translate-y-0.5',
              doc.accent,
            )}
          >
            <div className="flex items-center gap-3 p-4 pb-2">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', doc.iconBg)}>
                <doc.icon className={cn('h-4.5 w-4.5', doc.iconColor)} />
              </div>
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {doc.label}
              </span>
            </div>
            <p className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed">{doc.desc}</p>
            <div className="border-t border-border/40 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Reference</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {/* Client Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 rounded-lg border border-dashed text-muted-foreground">
          <BookOpen className="h-8 w-8 opacity-30" />
          <p className="text-sm">
            {search ? 'No clients match your search.' : 'No active or onboarding clients.'}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {filtered.length} Client{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
