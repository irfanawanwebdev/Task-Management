/**
 * Settings & Connectors — /settings
 * Dark-themed integration cards with SVG brand icons.
 */

import { useState, useEffect } from 'react'
import { Settings, ExternalLink, RefreshCw, Check, Zap, CheckCircle2, AlertCircle, Unplug, Plus, Trash2, Pencil, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/utils'

// ─── OAuth error message map ──────────────────────────────────────────────────
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied:   'You denied access. Click Connect to try again.',
  token_exchange: 'Failed to exchange auth code. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Supabase secrets.',
  missing_params: 'OAuth callback missing required parameters. Check that the redirect URI in Google Console matches exactly.',
  db_error:       'Token storage failed. Check the Supabase service role key.',
  unexpected:     'Unexpected server error. Check edge function logs in Supabase dashboard.',
}

// ─── Fallback checklist for non-negotiables ───────────────────────────────────
const FALLBACK_NON_NEGOTIABLES = [
  'Check overdue tasks and follow up with team',
  'Review and clear blocked items',
  'Send pending weekly/monthly reports',
  'Log new risks or blockers identified',
]

// ─── Brand SVG Icons ──────────────────────────────────────────────────────────

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="36" height="36" rx="4" fill="white"/>
      <rect x="6" y="6" width="36" height="36" rx="4" stroke="#DADCE0" strokeWidth="1"/>
      <rect x="6" y="14" width="36" height="6" fill="#1A73E8"/>
      <rect x="6" y="6" width="36" height="8" rx="4" fill="#1A73E8"/>
      <rect x="6" y="10" width="36" height="4" fill="#1A73E8"/>
      <circle cx="16" cy="10" r="2.5" fill="white"/>
      <circle cx="32" cy="10" r="2.5" fill="white"/>
      <text x="24" y="35" textAnchor="middle" fill="#1A73E8" fontSize="14" fontWeight="700" fontFamily="sans-serif">31</text>
    </svg>
  )
}

function GoogleMeetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#00897B"/>
      <path d="M8 17C8 15.343 9.343 14 11 14H27C28.657 14 30 15.343 30 17V31C30 32.657 28.657 34 27 34H11C9.343 34 8 32.657 8 31V17Z" fill="white"/>
      <path d="M32 20.5L40 16V32L32 27.5V20.5Z" fill="white"/>
      <rect x="13" y="19" width="12" height="2" rx="1" fill="#00897B"/>
      <rect x="13" y="23" width="8" height="2" rx="1" fill="#00897B"/>
    </svg>
  )
}

function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#2D8CFF"/>
      <path d="M10 17.5C10 16.119 11.119 15 12.5 15H26C27.381 15 28.5 16.119 28.5 17.5V30.5C28.5 31.881 27.381 33 26 33H12.5C11.119 33 10 31.881 10 30.5V17.5Z" fill="white"/>
      <path d="M30.5 21L38 17V31L30.5 27V21Z" fill="white"/>
    </svg>
  )
}

function CalendlyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#006BFF"/>
      <circle cx="24" cy="24" r="13" fill="white"/>
      <path d="M24 13C18.477 13 14 17.477 14 23C14 28.523 18.477 33 24 33" stroke="#006BFF" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M28 17.5C30.5 19 32 21.3 32 24C32 28.418 28.418 32 24 32" stroke="#006BFF" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="24" cy="24" r="2.5" fill="#006BFF"/>
      <line x1="24" y1="16" x2="24" y2="22" stroke="#006BFF" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="24" x2="28" y2="24" stroke="#006BFF" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.5 8L6 26H17L27.5 8H16.5Z" fill="#0F9D58"/>
      <path d="M27.5 8L17 26H39L42 20L27.5 8Z" fill="#FBBC04"/>
      <path d="M6 26L11 34.5H37L42 26H6Z" fill="#4285F4"/>
      <path d="M17 26H6L11 34.5H17L17 26Z" fill="#1976D2" fillOpacity="0.3"/>
      <path d="M27.5 8H39L42 26H27.5V8Z" fill="#F57F17" fillOpacity="0.3"/>
    </svg>
  )
}

function NotionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#191919"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M13 12.5C13 11.119 14.119 10 15.5 10H34.5C35.881 10 37 11.119 37 12.5V35.5C37 36.881 35.881 38 34.5 38H15.5C14.119 38 13 36.881 13 35.5V12.5Z" fill="white"/>
      <rect x="17" y="15" width="14" height="2.5" rx="1.25" fill="#191919"/>
      <rect x="17" y="20" width="10" height="2" rx="1" fill="#555"/>
      <rect x="17" y="24" width="12" height="2" rx="1" fill="#555"/>
      <rect x="17" y="28" width="8" height="2" rx="1" fill="#555"/>
      <path d="M33 14L30 18H36L33 14Z" fill="#191919"/>
    </svg>
  )
}

// ─── Connector definitions ────────────────────────────────────────────────────

interface Connector {
  id: string
  name: string
  category: 'Calendar' | 'Communication' | 'Storage' | 'Productivity'
  description: string
  docsUrl: string
  accentColor: string
  iconBg: string
  Icon: React.ComponentType<{ className?: string }>
}

// Google OAuth connectors that share a single token (google-calendar row)
const GOOGLE_OAUTH_IDS = new Set(['google-calendar', 'google-meet', 'google-drive'])

const CONNECTORS: Connector[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'Calendar',
    description: 'Sync client meetings, detect calendar changes, and auto-update meeting records in the hub.',
    docsUrl: 'https://developers.google.com/calendar',
    accentColor: 'border-t-blue-500',
    iconBg: 'bg-white/5 ring-1 ring-blue-500/20',
    Icon: GoogleCalendarIcon,
  },
  {
    id: 'google-meet',
    name: 'Google Meet',
    category: 'Communication',
    description: 'Automatically capture Google Meet links from calendar events and attach them to meeting records.',
    docsUrl: 'https://developers.google.com/meet',
    accentColor: 'border-t-emerald-500',
    iconBg: 'bg-white/5 ring-1 ring-emerald-500/20',
    Icon: GoogleMeetIcon,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Communication',
    description: 'Attach documents, link agendas and reports from Google Drive to meeting and task records.',
    docsUrl: 'https://developers.google.com/drive',
    accentColor: 'border-t-amber-500',
    iconBg: 'bg-white/5 ring-1 ring-amber-500/20',
    Icon: GoogleDriveIcon,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'Communication',
    description: 'Detect Zoom meeting links from calendar events and display them on meeting records. Clicking Connect redirects you to Zoom\'s consent screen directly — no Marketplace setup needed.',
    docsUrl: 'https://developers.zoom.us',
    accentColor: 'border-t-sky-500',
    iconBg: 'bg-white/5 ring-1 ring-sky-500/20',
    Icon: ZoomIcon,
  },
  {
    id: 'calendly',
    name: 'Calendly',
    category: 'Calendar',
    description: 'Import client-booked meetings from Calendly and automatically create meeting records.',
    docsUrl: 'https://developer.calendly.com',
    accentColor: 'border-t-blue-400',
    iconBg: 'bg-white/5 ring-1 ring-blue-400/20',
    Icon: CalendlyIcon,
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: 'Sync Notion databases and import task lists into the Operations Hub task engine.',
    docsUrl: 'https://developers.notion.com',
    accentColor: 'border-t-violet-500',
    iconBg: 'bg-white/5 ring-1 ring-violet-500/20',
    Icon: NotionIcon,
  },
]

const CATEGORY_COLORS: Record<string, string> = {
  Calendar:      'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
  Communication: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  Productivity:  'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20',
}

// ─── Connector Card ───────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  connectedEmail,
  userId,
  onDisconnect,
}: {
  connector: Connector
  connectedEmail?: string | null
  userId?: string
  onDisconnect?: () => void
}) {
  const [connecting, setConnecting] = useState(false)
  const [notice, setNotice]         = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const { Icon } = connector
  const isConnected = connectedEmail !== undefined

  async function handleConnect() {
    setConnectError(null)
    // Google Calendar, Meet, and Drive all share the same Google OAuth flow
    if (GOOGLE_OAUTH_IDS.has(connector.id)) {
      setConnecting(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setConnectError('Session expired. Please sign out and sign back in.')
          setConnecting(false)
          return
        }
        const res = await supabase.functions.invoke('google-calendar-auth', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.error) {
          setConnectError(res.error.message ?? 'Edge function error. Check Supabase logs.')
          setConnecting(false)
          return
        }
        if (res.data?.url) {
          window.location.href = res.data.url
        } else {
          setConnectError('Edge function returned no redirect URL. Ensure GOOGLE_CLIENT_ID secret is set in Supabase.')
          setConnecting(false)
        }
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : 'Unexpected error. Check edge function is deployed.')
        setConnecting(false)
      }
      return
    }

    // Zoom OAuth flow
    if (connector.id === 'zoom') {
      setConnecting(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setConnectError('Session expired. Please sign out and sign back in.')
          setConnecting(false)
          return
        }
        const res = await supabase.functions.invoke('zoom-auth', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.error) {
          setConnectError(res.error.message ?? 'Edge function error. Check Supabase logs.')
          setConnecting(false)
          return
        }
        if (res.data?.url) {
          window.location.href = res.data.url
        } else {
          setConnectError('Edge function returned no redirect URL. Ensure ZOOM_CLIENT_ID secret is set in Supabase.')
          setConnecting(false)
        }
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : 'Unexpected error.')
        setConnecting(false)
      }
      return
    }

    // Other connectors — not yet implemented
    setConnecting(true)
    setTimeout(() => {
      setConnecting(false)
      setNotice(true)
      setTimeout(() => setNotice(false), 4000)
    }, 800)
  }

  async function handleDisconnect() {
    if (!userId) return
    // All Google connectors share one token row keyed to 'google-calendar'
    const tokenId = GOOGLE_OAUTH_IDS.has(connector.id) ? 'google-calendar' : connector.id
    await supabase
      .from('connector_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('connector_id', tokenId)
    onDisconnect?.()
  }

  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden',
      'border-t-2 shadow-lg transition-all duration-200',
      'hover:border-border hover:shadow-xl hover:-translate-y-0.5',
      connector.accentColor,
    )}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl shrink-0 p-2',
            connector.iconBg,
          )}>
            <Icon className="h-full w-full" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">{connector.name}</h3>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-0.5',
              CATEGORY_COLORS[connector.category],
            )}>
              {connector.category}
            </span>
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400 ring-1 ring-emerald-500/20 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            Not Connected
          </div>
        )}
      </div>

      {/* Description + connected email */}
      <div className="px-4 pb-4 flex-1">
        <p className="text-xs text-muted-foreground leading-relaxed">{connector.description}</p>
        {isConnected && connectedEmail && (
          <p className="text-xs text-emerald-400/80 mt-1.5 font-medium">{connectedEmail}</p>
        )}
      </div>

      {notice && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-300 leading-relaxed">
          OAuth backend not yet wired up. See the <span className="font-semibold">Developer Integration Guide</span> below to implement this connector.
        </div>
      )}

      {connectError && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive leading-relaxed">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">{connectError}</span>
          <button onClick={() => setConnectError(null)} className="shrink-0 hover:opacity-70">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="border-t border-border/40" />

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3">
        {isConnected ? (
          <>
            <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <Check className="h-3 w-3" />
              Connected
            </div>
            {GOOGLE_OAUTH_IDS.has(connector.id) && (
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Unplug className="h-3 w-3" />
                Disconnect
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all"
          >
            {connecting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        )}
        <a
          href={connector.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          API Docs
        </a>
      </div>
    </div>
  )
}


// ─── Weekly Non-Negotiables ───────────────────────────────────────────────────

function WeeklyNonNegotiables() {
  const { role } = useAuth()
  const qc = useQueryClient()
  const isManager = role === 'owner' || role === 'project_manager'

  const { data: items = FALLBACK_NON_NEGOTIABLES } = useQuery<string[]>({
    queryKey: ['app-settings', 'weekly_non_negotiables'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'weekly_non_negotiables')
        .single()
      return ((data as unknown as { value: string[] } | null)?.value) ?? FALLBACK_NON_NEGOTIABLES
    },
  })

  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<string[]>([])
  const [newItem, setNewItem] = useState('')

  function startEdit() {
    setDraft([...items])
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setNewItem('')
  }

  const saveMutation = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'weekly_non_negotiables', value: next } as never, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-settings', 'weekly_non_negotiables'] })
      setEditing(false)
      setNewItem('')
    },
  })

  function addItem() {
    const t = newItem.trim()
    if (!t) return
    setDraft(d => [...d, t])
    setNewItem('')
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">Weekly Non-Negotiables</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tasks shown on the PM Dashboard daily checklist</p>
        </div>
        {isManager && !editing && (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <ul className="space-y-1.5">
            {draft.map((item, i) => (
              <li key={i} className="flex items-center gap-2 group">
                <span className="flex-1 text-sm text-foreground">{item}</span>
                <button
                  onClick={() => setDraft(d => d.filter((_, idx) => idx !== i))}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
              placeholder="Add new item…"
              className="flex-1 px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={addItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-xs font-medium hover:bg-accent transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          {saveMutation.isError && (
            <p className="text-xs text-destructive">{(saveMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => saveMutation.mutate(draft)}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {saveMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-1.5 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Developer Guide ──────────────────────────────────────────────────────────

function DeveloperGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Developer Integration Guide</span>
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <ol className="space-y-3">
            {[
              { step: 1, title: 'Create OAuth Credentials', desc: 'In the respective developer console (Google Cloud, Zoom Marketplace, Calendly, Notion), create an OAuth 2.0 app. Set the redirect URI to your Supabase Edge Function URL.' },
              { step: 2, title: 'Store Secrets Securely', desc: 'Add the client ID and client secret to Supabase project secrets (Settings → Edge Functions → Secrets). Never commit secrets to git.' },
              { step: 3, title: 'Implement OAuth Redirect Flow', desc: 'Create a Supabase Edge Function that handles the OAuth redirect, exchanges the auth code for tokens, and stores them in the connector_tokens table.' },
              { step: 4, title: 'Store Tokens in connector_tokens', desc: 'Schema: { user_id, connector, access_token, refresh_token, expires_at, scopes }. Use row-level security so users only see their own tokens.' },
              { step: 5, title: 'Create Sync Functions', desc: 'Edge Functions that use the stored tokens to poll for new calendar events, meetings, or documents, and sync them to the hub.' },
              { step: 6, title: 'Update handleConnect', desc: "Wire the Connect button to call the OAuth initiation Edge Function, which redirects the user to the provider's consent screen." },
            ].map(s => (
              <li key={s.step} className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold ring-1 ring-primary/20">
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const categories = ['All', 'Calendar', 'Communication', 'Productivity'] as const
  const [activeCategory, setActiveCategory] = useState<typeof categories[number]>('All')
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const qc = useQueryClient()

  // Handle redirect back from OAuth callback
  const connectedParam = searchParams.get('connected')
  const errorParam    = searchParams.get('error')
  useEffect(() => {
    if (connectedParam || errorParam) {
      if (connectedParam) qc.invalidateQueries({ queryKey: ['connector-tokens'] })
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 4000)
      return () => clearTimeout(t)
    }
  }, [connectedParam, errorParam, qc, setSearchParams])

  // Fetch connected tokens for this user
  const { data: tokens = [] } = useQuery({
    queryKey: ['connector-tokens', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('connector_tokens')
        .select('connector_id, account_email')
        .eq('user_id', user!.id)
      return (data ?? []) as { connector_id: string; account_email: string | null }[]
    },
    enabled: !!user,
  })

  const tokenMap = Object.fromEntries(tokens.map(t => [t.connector_id, t.account_email]))
  // Google Calendar, Meet, and Drive share one OAuth token — if Calendar is connected, all three are
  if ('google-calendar' in tokenMap) {
    tokenMap['google-meet']  = tokenMap['google-calendar']
    tokenMap['google-drive'] = tokenMap['google-calendar']
  }

  const filtered = CONNECTORS.filter(
    c => activeCategory === 'All' || c.category === activeCategory,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Settings & Connectors
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          External service integrations — connect your tools to the Operations Hub
        </p>
      </div>

      {connectedParam && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span><span className="font-semibold capitalize">{connectedParam.replace('-', ' ')}</span> connected successfully.</span>
        </div>
      )}
      {errorParam && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{OAUTH_ERROR_MESSAGES[errorParam] ?? `Connection failed: ${errorParam}`}</span>
        </div>
      )}

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-300">
        <span className="font-semibold text-amber-200">Implementation Status:</span>{' '}
        Google Calendar, Meet &amp; Drive share one Google OAuth connection. Zoom is live. Calendly and Notion pending.
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-all',
              activeCategory === c
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30'
                : 'border-border/60 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c => (
          <ConnectorCard
            key={c.id}
            connector={c}
            connectedEmail={tokenMap[c.id]}
            userId={user?.id}
            onDisconnect={() => qc.invalidateQueries({ queryKey: ['connector-tokens'] })}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Check className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Connected Integrations</h2>
        </div>
        <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border/50 text-muted-foreground text-sm">
          No integrations connected yet
        </div>
      </div>

      <WeeklyNonNegotiables />

      <DeveloperGuide />
    </div>
  )
}
