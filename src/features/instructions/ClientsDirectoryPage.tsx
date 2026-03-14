/**
 * Active Clients Directory — /instructions/clients
 * Lists all clients with Drive folder + Credentials links.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, FolderOpen, KeyRound, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/lib/types'
import { cn } from '@/lib/utils'

function useActiveClients() {
  return useQuery<Client[]>({
    queryKey: ['active-clients-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, status, health, primary_workstreams, drive_folder_url, credentials_sheet_url, website_url')
        .in('status', ['Active', 'Onboarding'])
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Client[]
    },
  })
}

export default function ClientsDirectoryPage() {
  const { data: clients = [], isLoading } = useActiveClients()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/instructions" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Active Clients Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quick access to Google Drive folders and Credentials sheets
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
          <p className="text-sm">No active clients found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(c => (
            <div key={c.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
              {/* Client name + badges */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-sm">{c.name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      c.status === 'Active'     && 'bg-green-50 text-green-700',
                      c.status === 'Onboarding' && 'bg-blue-50 text-blue-700',
                    )}>
                      {c.status}
                    </span>
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      c.health === 'Green'  && 'bg-green-100 text-green-700',
                      c.health === 'Yellow' && 'bg-amber-100 text-amber-700',
                      c.health === 'Red'    && 'bg-red-100 text-red-700',
                    )}>
                      {c.health}
                    </span>
                  </div>
                </div>
                <Link
                  to={`/clients/${c.id}`}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  View Hub →
                </Link>
              </div>

              {/* Workstreams */}
              {c.primary_workstreams && c.primary_workstreams.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.primary_workstreams.slice(0, 4).map(w => (
                    <span key={w} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {w}
                    </span>
                  ))}
                  {c.primary_workstreams.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{c.primary_workstreams.length - 4} more</span>
                  )}
                </div>
              )}

              {/* Links */}
              <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
                {c.drive_folder_url ? (
                  <a
                    href={c.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open Google Drive Folder
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Drive folder not set
                  </span>
                )}

                {c.credentials_sheet_url ? (
                  <a
                    href={c.credentials_sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Open Credentials Sheet
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    Credentials sheet not set
                  </span>
                )}

                {c.website_url && (
                  <a
                    href={c.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
