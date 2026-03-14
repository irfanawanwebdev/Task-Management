/**
 * Settings & Connectors — /settings
 * UI-ready integration cards: Google Calendar, Meet, Zoom, Calendly, Drive, Notion.
 * OAuth flows are pending backend implementation.
 */

import { useState } from 'react'
import {
  Settings, ExternalLink, RefreshCw, Check, X, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Connector definitions ────────────────────────────────────────────────────

interface Connector {
  id: string
  name: string
  category: 'Calendar' | 'Communication' | 'Storage' | 'Productivity'
  description: string
  docsUrl: string
  color: string
  iconText: string
}

const CONNECTORS: Connector[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'Calendar',
    description: 'Sync client meetings, detect calendar changes, and auto-update meeting records in the hub.',
    docsUrl: 'https://developers.google.com/calendar',
    color: 'bg-blue-50 border-blue-200',
    iconText: 'GCal',
  },
  {
    id: 'google-meet',
    name: 'Google Meet',
    category: 'Communication',
    description: 'Automatically capture Google Meet links from calendar events and attach them to meeting records.',
    docsUrl: 'https://developers.google.com/meet',
    color: 'bg-green-50 border-green-200',
    iconText: 'Meet',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'Communication',
    description: 'Detect Zoom meeting links from calendar events and display them on meeting records.',
    docsUrl: 'https://developers.zoom.us',
    color: 'bg-blue-50 border-blue-300',
    iconText: 'Zoom',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    category: 'Calendar',
    description: 'Import client-booked meetings from Calendly and automatically create meeting records.',
    docsUrl: 'https://developer.calendly.com',
    color: 'bg-teal-50 border-teal-200',
    iconText: 'Cly',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Storage',
    description: 'Attach documents, link agendas and reports from Google Drive to meeting and task records.',
    docsUrl: 'https://developers.google.com/drive',
    color: 'bg-yellow-50 border-yellow-200',
    iconText: 'GDrv',
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: 'Sync Notion databases and import task lists into the Operations Hub task engine.',
    docsUrl: 'https://developers.notion.com',
    color: 'bg-gray-50 border-gray-200',
    iconText: 'Ntn',
  },
]

const CATEGORY_COLORS: Record<string, string> = {
  Calendar:      'bg-blue-100 text-blue-700',
  Communication: 'bg-green-100 text-green-700',
  Storage:       'bg-yellow-100 text-yellow-700',
  Productivity:  'bg-purple-100 text-purple-700',
}

// ─── Connector Card ───────────────────────────────────────────────────────────

function ConnectorCard({ connector }: { connector: Connector }) {
  const [connecting, setConnecting] = useState(false)

  function handleConnect() {
    setConnecting(true)
    // OAuth flow would be triggered here.
    // After 1.5s, show a placeholder message.
    setTimeout(() => setConnecting(false), 1500)
    alert(`OAuth flow for ${connector.name} is not yet implemented.\n\nTo connect:\n1. Create OAuth credentials in ${connector.name} developer console\n2. Store client ID and secret as backend secrets\n3. Implement OAuth redirect flow in Supabase Edge Function\n4. Store access/refresh tokens in connector_tokens table`)
  }

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', connector.color)}>
      {/* Header */}
      <div className="flex items-start justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border shadow-sm text-xs font-bold text-gray-600">
            {connector.iconText}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{connector.name}</h3>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              CATEGORY_COLORS[connector.category],
            )}>
              {connector.category}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <X className="h-3 w-3" /> Not Connected
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pb-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{connector.description}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {connecting ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
        <a
          href={connector.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          API Docs
        </a>
      </div>
    </div>
  )
}

// ─── Developer Guide ──────────────────────────────────────────────────────────

function DeveloperGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Developer Integration Guide</span>
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          <ol className="space-y-3">
            {[
              {
                step: 1,
                title: 'Create OAuth Credentials',
                desc: 'In the respective developer console (Google Cloud, Zoom Marketplace, Calendly, Notion), create an OAuth 2.0 app. Set the redirect URI to your Supabase Edge Function URL.',
              },
              {
                step: 2,
                title: 'Store Secrets Securely',
                desc: 'Add the client ID and client secret to Supabase project secrets (Settings → Edge Functions → Secrets). Never commit secrets to git.',
              },
              {
                step: 3,
                title: 'Implement OAuth Redirect Flow',
                desc: 'Create a Supabase Edge Function that handles the OAuth redirect, exchanges the auth code for tokens, and stores them in the connector_tokens table (one row per user per connector).',
              },
              {
                step: 4,
                title: 'Store Tokens in connector_tokens',
                desc: 'Schema: { user_id, connector, access_token, refresh_token, expires_at, scopes }. Use row-level security so users only see their own tokens.',
              },
              {
                step: 5,
                title: 'Create Sync Functions',
                desc: 'Edge Functions (or Trigger.dev jobs) that use the stored tokens to poll for new calendar events, meetings, or documents, and sync them to the hub.',
              },
              {
                step: 6,
                title: 'Update handleConnect',
                desc: 'Wire the Connect button to call the OAuth initiation Edge Function, which redirects the user to the provider\'s consent screen.',
              },
            ].map(s => (
              <li key={s.step} className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
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
  const categories = ['All', 'Calendar', 'Communication', 'Storage', 'Productivity'] as const
  const [activeCategory, setActiveCategory] = useState<typeof categories[number]>('All')

  const filtered = CONNECTORS.filter(
    c => activeCategory === 'All' || c.category === activeCategory,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Settings & Connectors
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          External service integrations — OAuth flows pending backend implementation
        </p>
      </div>

      {/* Status banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="font-semibold">Implementation Status:</span> All connector UIs are ready.
        OAuth authentication flows require backend Edge Functions to be implemented.
        See the Developer Integration Guide below for implementation steps.
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeCategory === c
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Connector cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c => <ConnectorCard key={c.id} connector={c} />)}
      </div>

      {/* Currently connected (placeholder) */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Check className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Connected Integrations</h2>
        </div>
        <div className="flex h-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
          No integrations connected yet
        </div>
      </div>

      {/* Developer guide */}
      <DeveloperGuide />
    </div>
  )
}
