/**
 * Client Detail Page — JZ Operations Hub
 * Complete client hub with 8-tab interface:
 * Onboarding / Overdue / Blockers / Credentials / Reports / Meetings / Upsell / Risk Log
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Loader2, CheckCircle2, AlertTriangle,
  Calendar, KeyRound, FileText, Star, BarChart2, ExternalLink, Pencil, X, ChevronRight,
  Save, Link2, Trash2, Eye, EyeOff,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type {
  Client, DeliveryTask, Blocker, Meeting, Report, WeeklyReview, LandingPage,
} from '@/lib/types'
import { isOverdueEST, formatDateEST, daysAgoEST, todayDateEST } from '@/lib/timezone'
import { calcRiskScore } from '@/lib/riskEngine'
import { getCompletionClass } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog'
import { useAuth } from '@/features/auth/AuthContext'
import { HelpPopover } from '@/components/HelpPopover'

// ─── Data Hook ────────────────────────────────────────────────────────────────

function useClientDetail(id: string) {
  return useQuery({
    queryKey: ['client-detail', id],
    queryFn: async () => {
      const [clientRes, tasksRes, blockersRes, meetingsRes, reportsRes, reviewsRes] =
        await Promise.all([
          supabase.from('clients').select('*').eq('id', id).single(),
          supabase.from('delivery_tasks').select('*, task_assignments(*)').eq('client_id', id).order('step'),
          supabase.from('blockers').select('*, profiles(full_name)').eq('client_id', id).order('created_date'),
          supabase.from('meetings').select('*').eq('client_id', id).order('date', { ascending: false }),
          supabase.from('reports').select('*').eq('client_id', id).order('due_date', { ascending: false }),
          supabase.from('weekly_reviews').select('*').eq('client_id', id).order('review_date', { ascending: false }).limit(10),
        ])

      if (clientRes.error) throw clientRes.error
      const client = clientRes.data as Client

      // Fetch children (for parent) or parent info (for child)
      const [childrenRes, parentRes] = await Promise.all([
        supabase.from('clients').select('id, name, location_name, status, health').eq('parent_client_id', id),
        client.parent_client_id
          ? supabase.from('clients').select('id, name').eq('id', client.parent_client_id).single()
          : Promise.resolve({ data: null, error: null }),
      ])

      return {
        client,
        tasks:    (tasksRes.data    ?? []) as unknown as DeliveryTask[],
        blockers: (blockersRes.data ?? []) as unknown as Blocker[],
        meetings: (meetingsRes.data ?? []) as unknown as Meeting[],
        reports:  (reportsRes.data  ?? []) as unknown as Report[],
        reviews:  (reviewsRes.data  ?? []) as WeeklyReview[],
        children: (childrenRes.data ?? []) as unknown as { id: string; name: string; location_name: string | null; status: string; health: string }[],
        parentClient: parentRes.data as { id: string; name: string } | null,
      }
    },
  })
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'onboarding',  label: 'Onboarding',  icon: CheckCircle2, help: 'The 16-step delivery lifecycle for this client. Tasks are grouped by step. Complete each step in order — the QA Gate rule means A/R output must be logged before the next step begins.' },
  { id: 'overdue',     label: 'Overdue',     icon: AlertTriangle, help: 'All tasks for this client that are past their due date and not yet done. Resolve these first to avoid impacting the client\'s risk score.' },
  { id: 'blockers',    label: 'Blockers',    icon: AlertTriangle, help: 'Active blockers for this client. A blocker is anything preventing a task from being completed. Log blockers early — don\'t wait until a deadline is missed.' },
  { id: 'credentials', label: 'Credentials', icon: KeyRound,     help: 'Important links for this client: website, Google Drive folder, ad accounts, GBP listing, and social profiles. These are read-only reference links.' },
  { id: 'reports',     label: 'Reports',     icon: FileText,     help: 'Weekly and monthly reports sent to this client. Weekly reports are due every Friday; the last Friday of the month is the Monthly Report.' },
  { id: 'meetings',    label: 'Meetings',    icon: Calendar,     help: 'Client meetings log. Each active client requires 2 meetings per month: a Mid-Month Review (~14th) and an End-of-Month Review (~27th).' },
  { id: 'upsell',      label: 'Upsell',      icon: Star,         help: 'Suggested upsell opportunities for this client — additional services that could benefit them based on their current workstreams and performance.' },
  { id: 'risk',        label: 'Risk Log',    icon: BarChart2,    help: 'Client health score (0–100) across 4 pillars: Delivery (30 pts), Sentiment (25 pts), Performance (25 pts), Visibility (20 pts). Green < 26, Yellow 26–45, Red 46+.' },
] as const

type TabId = typeof TABS[number]['id']

// ─── Onboarding Tab ───────────────────────────────────────────────────────────

function OnboardingTab({ tasks, onClickTask }: { tasks: DeliveryTask[]; onClickTask: (t: DeliveryTask) => void }) {
  const onboardingTasks = tasks.filter(t => t.step <= 3)
  return (
    <div className="space-y-2">
      {onboardingTasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No onboarding tasks.</p>
      )}
      {onboardingTasks.map(t => (
        <div
          key={t.id}
          onClick={() => onClickTask(t)}
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
        >
          <div className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
            t.status === 'Done' ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' :
            t.status === 'In Progress' ? 'bg-info/20 text-info' :
            t.status === 'Blocked' ? 'bg-destructive/20 text-destructive' :
            'bg-muted text-muted-foreground'
          )}>
            {t.step}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t.task_name}</p>
            {t.timeline && <p className="text-xs text-muted-foreground">{t.timeline}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {t.ar_output_logged && (
              <span className="text-xs text-[hsl(var(--success))]">✓ A/R logged</span>
            )}
            <span className={cn(
              t.status === 'Done' ? 'status-done' :
              t.status === 'In Progress' ? 'status-in-progress' :
              t.status === 'Blocked' ? 'status-blocked' : 'status-not-started'
            )}>
              {t.status}
            </span>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Overdue Tab ──────────────────────────────────────────────────────────────

function OverdueTab({ tasks, onClickTask }: { tasks: DeliveryTask[]; onClickTask: (t: DeliveryTask) => void }) {
  const overdue = tasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done')
  return (
    <div className="space-y-2">
      {overdue.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))] mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No overdue tasks. Great work!</p>
        </div>
      ) : (
        overdue.map(t => (
          <div
            key={t.id}
            onClick={() => onClickTask(t)}
            className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t.task_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Step {t.step}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-destructive font-medium">
                  Due {t.due_date && formatDateEST(t.due_date)}
                </span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Blockers Tab ─────────────────────────────────────────────────────────────

function BlockersTab({ blockers }: { blockers: Blocker[] }) {
  const open = blockers.filter(b => b.status !== 'Resolved')
  return (
    <div className="space-y-2">
      {open.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))] mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No active blockers.</p>
        </div>
      ) : (
        open.map(b => {
          const age = daysAgoEST(b.created_date)
          return (
            <div key={b.id} className={cn(
              'p-3 rounded-lg border',
              age > 3 ? 'bg-destructive/5 border-destructive/30' : 'bg-card border-border'
            )}>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={b.severity === 'High' ? 'severity-high' : b.severity === 'Med' ? 'severity-med' : 'severity-low'}>
                  {b.severity}
                </span>
                <span className={b.status === 'Open' ? 'status-blocked' : 'status-in-progress'}>
                  {b.status}
                </span>
                <span className={age > 3 ? 'aging-critical' : 'aging-normal'}>{age}d</span>
              </div>
              <p className="text-sm">{b.description}</p>
              {b.profiles && (
                <p className="text-xs text-muted-foreground mt-1">Owner: {b.profiles.full_name}</p>
              )}
              {b.resolution_notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{b.resolution_notes}</p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Credentials Tab ─────────────────────────────────────────────────────────

function CredLink({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-accent transition-colors">
      <ExternalLink className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
    </a>
  )
}

const BLANK_LP: Omit<LandingPage, 'id'> = { name: '', url: '', username: null, password: null, notes: null }

function LandingPageRow({ page, onEdit, onDelete }: {
  page: LandingPage
  onEdit: (p: LandingPage) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        <span className="text-sm font-medium flex-1 truncate">{page.name || 'Unnamed Page'}</span>
        {page.url && (
          <a href={page.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-primary hover:underline text-xs flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Open
          </a>
        )}
        <button onClick={e => { e.stopPropagation(); onEdit(page) }}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(page.id) }}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-border bg-muted/20 space-y-2 text-sm">
          {page.url && (
            <div>
              <span className="text-xs text-muted-foreground">URL</span>
              <p className="break-all text-xs">{page.url}</p>
            </div>
          )}
          {page.username && (
            <div>
              <span className="text-xs text-muted-foreground">Username / Email</span>
              <p className="font-mono text-xs">{page.username}</p>
            </div>
          )}
          {page.password && (
            <div>
              <span className="text-xs text-muted-foreground">Password</span>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs flex-1">{showPw ? page.password : '••••••••'}</p>
                <button onClick={() => setShowPw(v => !v)} className="text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}
          {page.notes && (
            <div>
              <span className="text-xs text-muted-foreground">Notes</span>
              <p className="text-xs whitespace-pre-wrap">{page.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LandingPageForm({ initial, onSave, onCancel, saveError, saving }: {
  initial: Omit<LandingPage, 'id'>
  onSave: (data: Omit<LandingPage, 'id'>) => void
  onCancel: () => void
  saveError?: string | null
  saving?: boolean
}) {
  const [form, setForm] = useState(initial)
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value || null }))

  function handleSave() {
    setTouched(true)
    if (!form.name.trim()) return
    onSave(form)
  }

  const nameInvalid = touched && !form.name.trim()

  return (
    <div className="border border-primary/40 rounded-lg p-3 space-y-3 bg-primary/5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Page Name <span className="text-destructive">*</span></label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Homepage"
            className={cn(
              'w-full mt-1 px-2 py-1.5 bg-background border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary',
              nameInvalid ? 'border-destructive' : 'border-input',
            )} />
          {nameInvalid && <p className="text-xs text-destructive mt-0.5">Page name is required</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">URL</label>
          <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
            placeholder="https://…"
            className="w-full mt-1 px-2 py-1.5 bg-background border border-input rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Username / Email</label>
          <input value={form.username ?? ''} onChange={f('username')}
            className="w-full mt-1 px-2 py-1.5 bg-background border border-input rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Password</label>
          <div className="flex gap-1 mt-1">
            <input type={showPw ? 'text' : 'password'} value={form.password ?? ''} onChange={f('password')}
              className="flex-1 px-2 py-1.5 bg-background border border-input rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="px-2 border border-input rounded text-muted-foreground hover:text-foreground bg-background">
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <textarea value={form.notes ?? ''} onChange={f('notes')} rows={2}
          className="w-full mt-1 px-2 py-1.5 bg-background border border-input rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      {saveError && (
        <p className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">{saveError}</p>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={saving}
          className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1">
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  )
}

function CredentialsTab({ client }: { client: Client }) {
  const qc = useQueryClient()
  const [addingLP, setAddingLP] = useState(false)
  const [editingLP, setEditingLP] = useState<LandingPage | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const pages = client.landing_pages ?? []

  const saveLandingPages = useMutation({
    mutationFn: async (updated: LandingPage[]) => {
      const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
        'update_client_landing_pages',
        { _client_id: client.id, _pages: updated },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-detail', client.id] }),
  })

  const lpError = saveLandingPages.isError ? (saveLandingPages.error as Error).message : null

  function handleAdd(data: Omit<LandingPage, 'id'>) {
    const newPage: LandingPage = { ...data, id: crypto.randomUUID() }
    saveLandingPages.mutate([...pages, newPage], {
      onSuccess: () => setAddingLP(false),
    })
  }

  function handleEdit(data: Omit<LandingPage, 'id'>) {
    if (!editingLP) return
    const target = editingLP
    saveLandingPages.mutate(pages.map(p => p.id === target.id ? { ...data, id: p.id } : p), {
      onSuccess: () => setEditingLP(null),
    })
  }

  function handleDelete(id: string) {
    saveLandingPages.mutate(pages.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  const links = [
    client.credentials_sheet_url && { href: client.credentials_sheet_url, label: 'Credentials Sheet', sub: 'Google Sheets · Client credentials' },
    client.drive_folder_url      && { href: client.drive_folder_url,      label: 'Google Drive Folder', sub: 'Client files and documents' },
    client.website_url           && { href: client.website_url,           label: 'Website', sub: client.website_url },
    client.gbp_url               && { href: client.gbp_url,               label: 'Google Business Profile', sub: 'GBP listing' },
    client.ad_accounts_url       && { href: client.ad_accounts_url,       label: 'Ad Accounts', sub: 'Advertising dashboard' },
    client.facebook_url          && { href: client.facebook_url,          label: 'Facebook', sub: 'Facebook page / profile' },
    client.instagram_url         && { href: client.instagram_url,         label: 'Instagram', sub: 'Instagram profile' },
    client.linkedin_url          && { href: client.linkedin_url,          label: 'LinkedIn', sub: 'LinkedIn page' },
    client.youtube_url           && { href: client.youtube_url,           label: 'YouTube', sub: 'YouTube channel' },
  ].filter(Boolean) as { href: string; label: string; sub: string }[]

  return (
    <div className="space-y-6">
      {/* Account Links */}
      {links.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Links</p>
          {links.map(l => <CredLink key={l.label} {...l} />)}
        </div>
      )}

      {/* Landing Pages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Landing Pages</p>
          {!addingLP && !editingLP && (
            <button onClick={() => setAddingLP(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors">
              <Plus className="h-3 w-3" /> Add Page
            </button>
          )}
        </div>

        {addingLP && (
          <LandingPageForm
            initial={{ ...BLANK_LP }}
            onSave={handleAdd}
            onCancel={() => { setAddingLP(false); saveLandingPages.reset() }}
            saveError={lpError}
            saving={saveLandingPages.isPending}
          />
        )}

        {pages.length === 0 && !addingLP && (
          <p className="text-sm text-muted-foreground">No landing pages added yet.</p>
        )}

        {pages.map(page => (
          <div key={page.id}>
            {confirmDeleteId === page.id ? (
              <div className="border border-destructive/40 rounded-lg p-3 flex items-center justify-between gap-3 bg-destructive/5">
                <p className="text-sm text-destructive">Delete &quot;{page.name}&quot;?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteId(null)}
                    className="px-2.5 py-1 text-xs rounded border border-border text-muted-foreground hover:bg-accent">Cancel</button>
                  <button onClick={() => handleDelete(page.id)}
                    className="px-2.5 py-1 text-xs rounded bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90">Delete</button>
                </div>
              </div>
            ) : editingLP?.id === page.id ? (
              <LandingPageForm
                initial={{ name: page.name, url: page.url, username: page.username, password: page.password, notes: page.notes }}
                onSave={handleEdit}
                onCancel={() => { setEditingLP(null); saveLandingPages.reset() }}
                saveError={lpError}
                saving={saveLandingPages.isPending}
              />
            ) : (
              <LandingPageRow
                page={page}
                onEdit={p => setEditingLP(p)}
                onDelete={id => setConfirmDeleteId(id)}
              />
            )}
          </div>
        ))}

      </div>

      {links.length === 0 && pages.length === 0 && !addingLP && (
        <p className="text-sm text-muted-foreground">No credentials or links added yet.</p>
      )}
    </div>
  )
}

// ─── Edit Client Dialog ───────────────────────────────────────────────────────

import type { ClientStatus } from '@/lib/types'

function EditClientDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:                  client.name,
    status:                client.status as ClientStatus,
    start_date:            client.start_date,
    notes:                 client.notes ?? '',
    website_url:           client.website_url ?? '',
    drive_folder_url:      client.drive_folder_url ?? '',
    credentials_sheet_url: client.credentials_sheet_url ?? '',
    gbp_url:               client.gbp_url ?? '',
    ad_accounts_url:       client.ad_accounts_url ?? '',
    facebook_url:          client.facebook_url ?? '',
    instagram_url:         client.instagram_url ?? '',
    linkedin_url:          client.linkedin_url ?? '',
    youtube_url:           client.youtube_url ?? '',
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('clients').update({
        name:                  form.name.trim(),
        status:                form.status,
        start_date:            form.start_date,
        notes:                 form.notes.trim() || null,
        website_url:           form.website_url.trim() || null,
        drive_folder_url:      form.drive_folder_url.trim() || null,
        credentials_sheet_url: form.credentials_sheet_url.trim() || null,
        gbp_url:               form.gbp_url.trim() || null,
        ad_accounts_url:       form.ad_accounts_url.trim() || null,
        facebook_url:          form.facebook_url.trim() || null,
        instagram_url:         form.instagram_url.trim() || null,
        linkedin_url:          form.linkedin_url.trim() || null,
        youtube_url:           form.youtube_url.trim() || null,
      } as never).eq('id', client.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-detail', client.id] })
      qc.invalidateQueries({ queryKey: ['clients-page'] })
      onClose()
    },
  })

  function field(key: keyof typeof form, label: string, type: 'text' | 'url' | 'date' = 'text') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <input
          type={type}
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    )
  }

  const STATUS_OPTIONS: ClientStatus[] = ['Active', 'Onboarding', 'At Risk', 'Paused', 'Offboarding']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Edit Client — {client.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</p>
            {field('name', 'Client Name')}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as ClientStatus }))}
                  className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {field('start_date', 'Start Date', 'date')}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Links</p>
            {field('website_url', 'Website URL', 'url')}
            {field('drive_folder_url', 'Google Drive Folder URL', 'url')}
            {field('credentials_sheet_url', 'Credentials Sheet URL', 'url')}
            {field('gbp_url', 'Google Business Profile URL', 'url')}
            {field('ad_accounts_url', 'Ad Accounts URL', 'url')}
          </div>

          {/* Social */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Media</p>
            {field('facebook_url', 'Facebook URL', 'url')}
            {field('instagram_url', 'Instagram URL', 'url')}
            {field('linkedin_url', 'LinkedIn URL', 'url')}
            {field('youtube_url', 'YouTube URL', 'url')}
          </div>

          {mutation.isError && (
            <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex gap-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Changes
          </button>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border/60 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ reports }: { reports: Report[] }) {
  return (
    <div className="space-y-2">
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports yet.</p>
      ) : (
        reports.map(r => (
          <div key={r.id} className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{r.report_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.report_type} · Due {formatDateEST(r.due_date)}</p>
              </div>
              <span className={cn(
                r.status === 'Sent' ? 'status-done' :
                r.status === 'In Progress' ? 'status-in-progress' :
                'status-not-started'
              )}>
                {r.status}
              </span>
            </div>
            {r.sent_at && (
              <p className="text-xs text-muted-foreground mt-1">Sent {formatDateEST(r.sent_at)}</p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Meetings Tab ─────────────────────────────────────────────────────────────

function MeetingsTab({ meetings }: { meetings: Meeting[] }) {
  return (
    <div className="space-y-2">
      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meetings yet.</p>
      ) : (
        meetings.map(m => (
          <div key={m.id} className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium">{m.type}</p>
              <span className={cn(
                m.status === 'Completed' ? 'status-done' :
                m.status === 'Scheduled' ? 'status-in-progress' :
                m.status === 'Overdue' ? 'status-blocked' : 'status-not-started'
              )}>
                {m.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateEST(m.date)}</p>
            <div className="flex gap-3 mt-2 flex-wrap">
              {m.meeting_link && (
                <a href={m.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">Meeting Link</a>
              )}
              {m.recap_link && (
                <a href={m.recap_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">Recap</a>
              )}
              {m.report_link && (
                <a href={m.report_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">Report</a>
              )}
            </div>
            {m.sla_due && (
              <p className="text-xs text-muted-foreground mt-1">
                Recap SLA: {formatDateEST(m.sla_due)}
                {m.sla_met === true && <span className="text-[hsl(var(--success))] ml-1">✓ Met</span>}
                {m.sla_met === false && <span className="text-destructive ml-1">✗ Missed</span>}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Upsell Tab ───────────────────────────────────────────────────────────────

function UpsellTab({ client, tasks }: { client: Client; tasks: DeliveryTask[] }) {
  const allWorkstreams = ['SEO', 'PPC', 'Web/Dev', 'Local/GBP', 'Social'] as const
  const active = new Set(client.primary_workstreams)
  const withDue = tasks.filter(t => t.due_date)
  const done = withDue.filter(t => t.status === 'Done').length
  const completion = withDue.length > 0 ? Math.round((done / withDue.length) * 100) : 0

  const opportunities = allWorkstreams
    .filter(ws => !active.has(ws))
    .map(ws => ({
      workstream: ws,
      reason: ws === 'PPC' ? 'Drive immediate leads while SEO builds momentum'
        : ws === 'Social' ? 'Build brand presence and local trust signals'
        : ws === 'Local/GBP' ? 'Maximize GBP visibility for local search dominance'
        : ws === 'Web/Dev' ? 'Improve CRO and site speed for better conversions'
        : 'Strengthen organic visibility for long-term growth',
    }))

  return (
    <div className="space-y-3">
      {completion < 70 && (
        <div className="qa-gate-warning">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
          <p className="text-sm">Complete current deliverables (current: {completion}%) before pitching upsells.</p>
        </div>
      )}
      {opportunities.length === 0 ? (
        <div className="text-center py-6">
          <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Client is already on all workstreams.</p>
        </div>
      ) : (
        opportunities.map(op => (
          <div key={op.workstream} className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-[hsl(var(--warning))]" />
              <p className="text-sm font-medium">{op.workstream}</p>
            </div>
            <p className="text-xs text-muted-foreground">{op.reason}</p>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Risk Log Tab ─────────────────────────────────────────────────────────────

function RiskLogTab({
  reviews, tasks, meetings, clientId,
}: {
  reviews: WeeklyReview[]
  tasks: DeliveryTask[]
  meetings: Meeting[]
  clientId: string
}) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    review_date: new Date().toISOString().slice(0, 10),
    week_number: Math.ceil((new Date().getDate()) / 7),
    sentiment_observed: 'Neutral' as WeeklyReview['sentiment_observed'],
    engagement_level: 'Medium' as WeeklyReview['engagement_level'],
    confidence_in_retention: 'Moderate' as WeeklyReview['confidence_in_retention'],
    hidden_risk_signals: '',
    strategic_notes: '',
    adjustment_score: 0,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const addReview = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('weekly_reviews').insert({
        client_id: clientId,
        review_date: form.review_date,
        week_number: form.week_number,
        sentiment_observed: form.sentiment_observed,
        engagement_level: form.engagement_level,
        confidence_in_retention: form.confidence_in_retention,
        hidden_risk_signals: form.hidden_risk_signals.trim() || null,
        strategic_notes: form.strategic_notes.trim() || null,
        adjustment_score: form.adjustment_score,
      } as never)
      if (error) throw new Error(error.message)

      // Compute snapshot and persist — health is always derived, never manual
      const newReview: WeeklyReview = {
        id: '',
        client_id: clientId,
        review_date: form.review_date,
        week_number: form.week_number,
        sentiment_observed: form.sentiment_observed,
        engagement_level: form.engagement_level,
        confidence_in_retention: form.confidence_in_retention,
        hidden_risk_signals: form.hidden_risk_signals.trim() || null,
        strategic_notes: form.strategic_notes.trim() || null,
        adjustment_score: form.adjustment_score,
        created_at: new Date().toISOString(),
      }
      const score = calcRiskScore(tasks, [...reviews, newReview], meetings)
      const today = todayDateEST()
      await supabase.from('client_health_snapshots').insert({
        client_id:                  clientId,
        period_start:               today,
        period_end:                 today,
        delivery_score:             score.delivery,
        sentiment_score:            score.sentiment,
        performance_score:          score.performance,
        visibility_score:           score.visibility,
        weekly_strategic_adjustment: score.adjustment,
        final_risk_score:           score.final_score,
        classification:             score.health,
      } as never)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-detail', clientId] })
      setShowForm(false)
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const sentimentColor = (s: string) =>
    s === 'Positive' ? 'text-[hsl(var(--success))]' :
    s === 'Neutral'  ? 'text-muted-foreground' :
    s === 'Concerned'? 'text-[hsl(var(--warning))]' : 'text-destructive'

  const retentionColor = (r: string) =>
    r === 'Strong'   ? 'text-[hsl(var(--success))]' :
    r === 'Moderate' ? 'text-muted-foreground' :
    r === 'At Risk'  ? 'text-[hsl(var(--warning))]' : 'text-destructive'

  return (
    <div className="space-y-3">
      {/* Add Review toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Weekly Reviews ({reviews.length})
        </p>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          {showForm ? 'Cancel' : 'Add Review'}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Review Date</label>
              <input
                type="date"
                value={form.review_date}
                onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Week #</label>
              <input
                type="number"
                min={1}
                max={52}
                value={form.week_number}
                onChange={e => setForm(f => ({ ...f, week_number: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Sentiment</label>
              <select
                value={form.sentiment_observed}
                onChange={e => setForm(f => ({ ...f, sentiment_observed: e.target.value as WeeklyReview['sentiment_observed'] }))}
                className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['Positive', 'Neutral', 'Concerned', 'Negative'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Engagement</label>
              <select
                value={form.engagement_level}
                onChange={e => setForm(f => ({ ...f, engagement_level: e.target.value as WeeklyReview['engagement_level'] }))}
                className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['High', 'Medium', 'Low', 'Disengaged'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Retention</label>
              <select
                value={form.confidence_in_retention}
                onChange={e => setForm(f => ({ ...f, confidence_in_retention: e.target.value as WeeklyReview['confidence_in_retention'] }))}
                className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['Strong', 'Moderate', 'At Risk', 'Critical'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Risk Signals</label>
            <input
              value={form.hidden_risk_signals}
              onChange={e => setForm(f => ({ ...f, hidden_risk_signals: e.target.value }))}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Any hidden risk signals?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Strategic Notes</label>
            <textarea
              value={form.strategic_notes}
              onChange={e => setForm(f => ({ ...f, strategic_notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Notes, observations…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Score Adjustment</label>
            <input
              type="number"
              value={form.adjustment_score}
              onChange={e => setForm(f => ({ ...f, adjustment_score: parseInt(e.target.value) || 0 }))}
              className="w-32 px-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0"
            />
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-md text-xs border border-input hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => addReview.mutate()}
              disabled={addReview.isPending}
              className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {addReview.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Review
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">No weekly reviews yet.</p>
      ) : (
        reviews.map(r => (
          <div key={r.id} className="p-3 bg-card border border-border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Week {r.week_number}</p>
              <p className="text-xs text-muted-foreground">{formatDateEST(r.review_date)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Sentiment</p>
                <p className={cn('font-medium', sentimentColor(r.sentiment_observed))}>
                  {r.sentiment_observed}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Engagement</p>
                <p className="font-medium">{r.engagement_level}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Retention</p>
                <p className={cn('font-medium', retentionColor(r.confidence_in_retention))}>
                  {r.confidence_in_retention}
                </p>
              </div>
            </div>
            {r.hidden_risk_signals && (
              <p className="text-xs text-muted-foreground">⚠ {r.hidden_risk_signals}</p>
            )}
            {r.adjustment_score !== 0 && (
              <p className="text-xs">
                Score adjustment: <span className={r.adjustment_score > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]'}>
                  {r.adjustment_score > 0 ? '+' : ''}{r.adjustment_score}
                </span>
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Client Task Edit Drawer ─────────────────────────────────────────────────

function ClientTaskEditDrawer({
  task,
  clientId,
  onClose,
}: {
  task: DeliveryTask
  clientId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [status, setStatus]         = useState(task.status)
  const [dueDate, setDueDate]       = useState(task.due_date ?? '')
  const [notes, setNotes]           = useState(task.notes ?? '')
  const [links, setLinks]           = useState<{ label: string; url: string }[]>(
    Array.isArray(task.links) ? task.links : []
  )
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl]     = useState('')
  const [saving, setSaving]             = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['client-detail', clientId] })

  const saveField = async (patch: Record<string, unknown>) => {
    setSaving(true)
    await supabase.from('delivery_tasks').update(patch as never).eq('id', task.id)
    await invalidate()
    setSaving(false)
  }

  const handleStatusChange = async (val: string) => {
    setStatus(val as DeliveryTask['status'])
    await saveField({ status: val })
  }

  const handleDueDateBlur = async () => {
    await saveField({ due_date: dueDate || null })
  }

  const saveNotes = async () => {
    await saveField({ notes: notes.trim() || null })
  }

  const addLink = async () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return
    const updated = [...links, { label: newLinkLabel.trim(), url: newLinkUrl.trim() }]
    setLinks(updated)
    setNewLinkLabel('')
    setNewLinkUrl('')
    await saveField({ links: updated })
  }

  const removeLink = async (idx: number) => {
    const updated = links.filter((_, i) => i !== idx)
    setLinks(updated)
    await saveField({ links: updated })
  }

  const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Done', 'Blocked']

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-card border-l border-border shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Step {task.step} · {task.workstream}</p>
            <h3 className="font-semibold text-sm truncate">{task.task_name}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              onBlur={handleDueDateBlur}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={5}
              placeholder="Add notes, context, output documentation…"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">Auto-saves on blur</p>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Links</label>
            {links.length > 0 && (
              <div className="space-y-1">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                    <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-primary hover:underline truncate"
                    >
                      {link.label}
                    </a>
                    <button
                      onClick={() => removeLink(i)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                placeholder="Label"
                value={newLinkLabel}
                onChange={e => setNewLinkLabel(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                placeholder="https://…"
                value={newLinkUrl}
                onChange={e => setNewLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addLink() }}
                className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={addLink}
                disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
                className="shrink-0 px-2 py-1.5 bg-primary text-primary-foreground rounded-md text-xs disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                <Save className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab]     = useState<TabId>('onboarding')
  const [showNewTask, setShowNewTask] = useState(false)
  const [showEdit, setShowEdit]       = useState(false)
  const [selectedTask, setSelectedTask] = useState<DeliveryTask | null>(null)
  const { data, isLoading, error }    = useClientDetail(clientId!)
  const { role, profile } = useAuth()
  // Show Edit to PM/Owner roles, OR any user explicitly granted clients page access
  const canEdit = role === 'owner' || role === 'project_manager'
    || (profile?.page_access?.includes('clients') ?? false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
        {error ? (error as Error).message : 'Client not found.'}
      </div>
    )
  }

  const { client, tasks, blockers, meetings, reports, reviews, children, parentClient } = data

  // Quick stats
  const withDue   = tasks.filter(t => t.due_date)
  const done      = withDue.filter(t => t.status === 'Done').length
  const overdue   = withDue.filter(t => isOverdueEST(t.due_date!) && t.status !== 'Done').length
  const blocked   = tasks.filter(t => t.status === 'Blocked').length
  const comp      = withDue.length > 0 ? Math.round((done / withDue.length) * 100) : 100
  const openBlockers = blockers.filter(b => b.status !== 'Resolved').length
  const nextMeeting  = meetings
    .filter(m => m.status === 'Scheduled')
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const highImpactOpen = tasks.filter(t => t.impact_level === 'High' && t.status !== 'Done').length

  const healthClass = client.health === 'Green' ? 'health-green'
    : client.health === 'Yellow' ? 'health-yellow' : 'health-red'
  const statusClass = client.status === 'Active' ? 'status-in-progress'
    : client.status === 'At Risk' ? 'status-blocked' : 'status-not-started'

  return (
    <div className="space-y-5">
      <CreateTaskDialog
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        presetClientId={clientId}
      />
      {showEdit && (
        <EditClientDialog client={client} onClose={() => setShowEdit(false)} />
      )}
      {selectedTask && (
        <ClientTaskEditDrawer
          task={selectedTask}
          clientId={clientId!}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/clients')}
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          {/* Breadcrumb for child clients */}
          {client.parent_client_id && parentClient && (
            <button
              onClick={() => navigate(`/clients/${client.parent_client_id}`)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              {parentClient.name}
            </button>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <span className={healthClass}>{client.health}</span>
            <span className={statusClass}>{client.status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Since {formatDateEST(client.start_date)}
            {client.primary_workstreams?.length > 0 && (
              <> · {client.primary_workstreams.join(', ')}</>
            )}
          </p>

          {/* Locations grid for parent clients */}
          {children.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Locations</p>
              <div className="flex flex-wrap gap-2">
                {children.map(child => {
                  const hClass = child.health === 'Green' ? 'health-green'
                    : child.health === 'Yellow' ? 'health-yellow' : 'health-red'
                  return (
                    <button
                      key={child.id}
                      onClick={() => navigate(`/clients/${child.id}`)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-accent text-sm transition-colors"
                    >
                      <span className={hClass}>{child.health}</span>
                      <span className="font-medium">{child.location_name ?? child.name}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-border/60 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="metric-card">
          <p className="metric-label">Completion</p>
          <p className={cn('metric-value text-lg', getCompletionClass(comp))}>{comp}%</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Overdue</p>
          <p className={cn('metric-value text-lg', overdue > 0 ? 'text-destructive' : '')}>{overdue}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Blocked</p>
          <p className={cn('metric-value text-lg', blocked > 0 ? 'text-[hsl(var(--warning))]' : '')}>{blocked}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Blockers</p>
          <p className={cn('metric-value text-lg', openBlockers > 0 ? 'text-destructive' : '')}>{openBlockers}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Next Meeting</p>
          <p className="text-sm font-semibold mt-1">
            {nextMeeting ? formatDateEST(nextMeeting.date) : 'None'}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Tasks Done</p>
          <p className="metric-value text-lg">{done}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">High Impact Open</p>
          <p className={cn('metric-value text-lg', highImpactOpen > 0 ? 'text-[hsl(var(--warning))]' : '')}>{highImpactOpen}</p>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 flex-wrap border-b border-border pb-2">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(activeTab === tab.id ? 'view-tab-active' : 'view-tab', 'flex items-center gap-1.5')}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                <HelpPopover title={tab.label} content={tab.help} side="bottom" align="left" />
                {/* Badges */}
                {tab.id === 'overdue'  && overdue > 0 && (
                  <span className="ml-1 px-1 bg-destructive/20 text-destructive text-xs rounded-full">{overdue}</span>
                )}
                {tab.id === 'blockers' && openBlockers > 0 && (
                  <span className="ml-1 px-1 bg-destructive/20 text-destructive text-xs rounded-full">{openBlockers}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          {activeTab === 'onboarding'  && <OnboardingTab  tasks={tasks} onClickTask={setSelectedTask} />}
          {activeTab === 'overdue'     && <OverdueTab     tasks={tasks} onClickTask={setSelectedTask} />}
          {activeTab === 'blockers'    && <BlockersTab    blockers={blockers} />}
          {activeTab === 'credentials' && <CredentialsTab client={client} />}
          {activeTab === 'reports'     && <ReportsTab     reports={reports} />}
          {activeTab === 'meetings'    && <MeetingsTab    meetings={meetings} />}
          {activeTab === 'upsell'      && <UpsellTab      client={client} tasks={tasks} />}
          {activeTab === 'risk'        && <RiskLogTab     reviews={reviews} tasks={tasks} meetings={meetings} clientId={clientId!} />}
        </div>
      </div>
    </div>
  )
}
