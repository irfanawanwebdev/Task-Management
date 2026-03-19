/**
 * Meetings & Reports Page — /meetings
 * Bi-weekly coordination hub: metrics, meeting views, owner dependency tracking,
 * kickoff reminders, and report task views.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, CheckCircle2, AlertTriangle, Plus, X, ExternalLink,
  ChevronDown, Loader2, FileText, Users, Zap, Bell, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Meeting, Report, DeliveryTask, Client, Blocker } from '@/lib/types'
import {
  formatDateEST, todayDateEST, isOverdueEST, isSlaBrokenEST,
} from '@/lib/timezone'
import { useAuth } from '@/features/auth/AuthContext'
import { isPMOrOwner } from '@/lib/permissions'
import { useNavigationGuard } from '@/lib/useNavigationGuard'
import { cn } from '@/lib/utils'

// ─── Edge Function caller ─────────────────────────────────────────────────────

async function callEdgeFunction(name: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Data Hooks ───────────────────────────────────────────────────────────────

function useMeetings() {
  const { profile, role } = useAuth()
  const isManager = role ? isPMOrOwner(role) : false

  // For non-managers: get client IDs where user has task assignments (§6.1)
  const { data: myClientIds = [] } = useQuery<string[]>({
    queryKey: ['my-client-ids', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return []
      const { data, error } = await supabase
        .from('task_assignments')
        .select('task_id, delivery_tasks(client_id)')
        .eq('user_id', profile.user_id)
      if (error) return []
      type Row = { task_id: string; delivery_tasks: { client_id: string } | null }
      const ids = (data as unknown as Row[])
        .map(r => r.delivery_tasks?.client_id)
        .filter((id): id is string => Boolean(id))
      return [...new Set(ids)]
    },
    enabled: !isManager && !!profile?.user_id,
  })

  return useQuery<Meeting[]>({
    queryKey: ['meetings-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*, clients(name)')
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Meeting[]
    },
    select: (data) => {
      // PM/Owner: see all meetings
      if (isManager) return data
      // Specialists: see only meetings for clients where they have task assignments
      return data.filter(m => myClientIds.includes(m.client_id))
    },
  })
}

function useClients() {
  return useQuery<Client[]>({
    queryKey: ['client-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, status').order('name')
      if (error) throw error
      return (data ?? []) as unknown as Client[]
    },
  })
}

function useReports() {
  return useQuery<Report[]>({
    queryKey: ['reports-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*, clients(name)')
        .order('due_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Report[]
    },
  })
}

function useAllTasks() {
  return useQuery<DeliveryTask[]>({
    queryKey: ['tasks-meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*, clients(name), task_assignments(role_type, workstream)')
        .order('due_date')
      if (error) throw error
      return (data ?? []) as unknown as DeliveryTask[]
    },
  })
}

function useOpenBlockers() {
  return useQuery<Blocker[]>({
    queryKey: ['blockers-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blockers')
        .select('id, status')
        .neq('status', 'Resolved')
      if (error) throw error
      return (data ?? []) as unknown as Blocker[]
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientName(meeting: Meeting): string {
  return (meeting.clients as unknown as { name: string } | undefined)?.name ?? '—'
}

function getReportClientName(report: Report): string {
  return (report.clients as unknown as { name: string } | undefined)?.name ?? '—'
}

function getTaskClientName(task: DeliveryTask): string {
  return (task.clients as unknown as { name: string } | undefined)?.name ?? '—'
}

function StatusBadge({ status }: { status: Meeting['status'] }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      status === 'Completed'     && 'bg-green-50 text-green-700',
      status === 'Scheduled'     && 'bg-blue-50 text-blue-700',
      status === 'Not Scheduled' && 'bg-muted text-muted-foreground',
      status === 'Overdue'       && 'bg-red-50 text-red-600',
    )}>
      {status}
    </span>
  )
}

function MeetingTypeBadge({ type }: { type: Meeting['type'] }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      type === 'Kickoff'              && 'bg-purple-100 text-purple-700',
      type === 'Mid-Month Review'     && 'bg-blue-100 text-blue-700',
      type === 'End-of-Month Review'  && 'bg-indigo-100 text-indigo-700',
      type === 'Owner Requested'      && 'bg-amber-100 text-amber-700',
    )}>
      {type}
    </span>
  )
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, accent,
}: { label: string; value: string | number; sub?: string; accent?: 'green' | 'amber' | 'red' | 'blue' }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn(
        'mt-1 text-2xl font-bold',
        accent === 'green' && 'text-green-600',
        accent === 'amber' && 'text-amber-600',
        accent === 'red'   && 'text-red-600',
        accent === 'blue'  && 'text-blue-600',
        !accent            && 'text-foreground',
      )}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Meeting Table Row ────────────────────────────────────────────────────────

function MeetingRow({ meeting, canEdit }: { meeting: Meeting; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const slaStatus = meeting.sla_due
    ? isSlaBrokenEST(meeting.sla_due) && !meeting.sla_met ? 'broken' : meeting.sla_met ? 'met' : 'pending'
    : null

  const markComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('meetings')
        .update({ status: 'Completed' } as never)
        .eq('id', meeting.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings-all'] }),
  })

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDateEST(meeting.date)}</td>
      <td className="px-4 py-3 text-sm font-medium">{getClientName(meeting)}</td>
      <td className="px-4 py-3"><MeetingTypeBadge type={meeting.type} /></td>
      <td className="px-4 py-3"><StatusBadge status={meeting.status} /></td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
        {meeting.agenda ?? '—'}
      </td>
      <td className="px-4 py-3">
        {slaStatus === 'met' && <span className="text-xs text-green-600 font-medium">SLA ✓</span>}
        {slaStatus === 'broken' && <span className="text-xs text-red-600 font-medium">SLA ✗</span>}
        {slaStatus === 'pending' && <span className="text-xs text-muted-foreground">Pending</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {meeting.meeting_link && (
            <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-muted">
              <ExternalLink className="h-3 w-3" /> Join
            </a>
          )}
          {meeting.recap_link && (
            <a href={meeting.recap_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-muted">
              <FileText className="h-3 w-3" /> Recap
            </a>
          )}
          {canEdit && meeting.status === 'Scheduled' && (
            <button
              onClick={() => markComplete.mutate()}
              disabled={markComplete.isPending}
              className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-700 hover:bg-green-100"
            >
              {markComplete.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Done
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Add Meeting Dialog ───────────────────────────────────────────────────────

const MEETING_TYPES: Meeting['type'][] = [
  'Kickoff', 'Mid-Month Review', 'End-of-Month Review', 'Owner Requested',
]

function AddMeetingDialog({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  useNavigationGuard(true)

  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    client_id: '',
    type: 'Mid-Month Review' as Meeting['type'],
    date: '',
    time: '',
    agenda: '',
    meeting_link: '',
  })
  const [error, setError] = useState('')

  const add = useMutation({
    mutationFn: async () => {
      if (!form.client_id || !form.date) {
        setError('Client and date are required.')
        return
      }
      const { error } = await supabase.from('meetings').insert({
        client_id:   form.client_id,
        type:        form.type,
        date:        form.date,
        time:        form.time || null,
        agenda:      form.agenda || null,
        meeting_link: form.meeting_link || null,
        status:      'Scheduled',
        owner_approval_required: false,
        sla_hours:   24,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-all'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-card border shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Schedule Meeting</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Client *</label>
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm">
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Meeting Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Meeting['type'] }))}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm">
              {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Time</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Agenda</label>
            <textarea value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
              rows={2} className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Meeting Link (Zoom/Meet)</label>
            <input type="url" value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))}
              placeholder="https://…"
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button onClick={() => add.mutate()} disabled={add.isPending}
            className="inline-flex items-center gap-1 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Report Task Row ──────────────────────────────────────────────────────────

function ReportTaskRow({ report }: { report: Report }) {
  const queryClient = useQueryClient()
  const markSent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'Sent', sent_at: new Date().toISOString() } as never)
        .eq('id', report.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports-all'] }),
  })

  return (
    <tr className="border-b hover:bg-muted/30">
      <td className="px-4 py-3 text-sm font-medium">{getReportClientName(report)}</td>
      <td className="px-4 py-3 text-sm">{report.report_name}</td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          report.report_type === 'Monthly Report' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
        )}>
          {report.report_type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">{formatDateEST(report.due_date)}</td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          report.status === 'Sent'        && 'bg-green-50 text-green-700',
          report.status === 'In Progress' && 'bg-amber-50 text-amber-600',
          report.status === 'Pending'     && 'bg-muted text-muted-foreground',
        )}>
          {report.status}
        </span>
      </td>
      <td className="px-4 py-3">
        {report.pdf_url && (
          <a href={report.pdf_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-muted">
            <ExternalLink className="h-3 w-3" /> Open
          </a>
        )}
        {report.status !== 'Sent' && (
          <button onClick={() => markSent.mutate()} disabled={markSent.isPending}
            className="ml-2 inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-700 hover:bg-green-100">
            {markSent.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Mark Sent
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MeetingTab =
  | 'scheduled' | 'by-client' | 'this-week' | 'last-14' | 'this-month'
  | 'biweekly-done' | 'owner-requested'

type ReportTab = 'weekly-done' | 'done-7' | 'done-14' | 'monthly-done' | 'blocked-risk' | 'by-client'

const MEETING_TABS: { id: MeetingTab; label: string }[] = [
  { id: 'scheduled',       label: 'Scheduled' },
  { id: 'by-client',       label: 'By Client' },
  { id: 'this-week',       label: 'This Week' },
  { id: 'last-14',         label: 'Last 14 Days' },
  { id: 'this-month',      label: 'This Month' },
  { id: 'biweekly-done',   label: 'Bi-Weekly Done' },
  { id: 'owner-requested', label: 'Owner Requested' },
]

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: 'weekly-done',   label: 'Weekly Done' },
  { id: 'done-7',        label: 'Done in 7 Days' },
  { id: 'done-14',       label: 'Done in 14 Days' },
  { id: 'monthly-done',  label: 'Monthly Done' },
  { id: 'blocked-risk',  label: 'Blocked / Risk' },
  { id: 'by-client',     label: 'By Client' },
]

// ─── Bi-Weekly Compliance Grid ────────────────────────────────────────────────

function BiweeklyComplianceGrid({ meetings, clients }: { meetings: Meeting[]; clients: Client[] }) {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'Onboarding')

  if (activeClients.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Bi-Weekly Completion by Client — This Month
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {activeClients.map(client => {
          const biweekly = meetings.filter(m =>
            m.client_id === client.id &&
            (m.type === 'Mid-Month Review' || m.type === 'End-of-Month Review') &&
            m.date >= monthStart,
          )
          const completed = biweekly.filter(m => m.status === 'Completed').length
          const colorClass = completed >= 2
            ? 'text-[hsl(var(--success))]'
            : completed === 1
            ? 'text-[hsl(var(--warning))]'
            : 'text-destructive'
          return (
            <div key={client.id} className="text-center p-2 bg-background rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground truncate mb-1">{client.name}</p>
              <p className={cn('text-lg font-bold tabular-nums', colorClass)}>{completed}/2</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Weekly Strategic Review Section ─────────────────────────────────────────

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function WeeklyStrategicReviewSection({ clients }: { clients: Client[] }) {
  const { role } = useAuth()
  const qc = useQueryClient()
  if (role !== 'owner' && role !== 'project_manager') return null

  const todayEST = todayDateEST()
  const todayJS  = new Date(todayEST + 'T12:00:00')
  const isFriday = todayJS.getDay() === 5
  const weekNumber = getISOWeek(todayJS)
  const yearNumber = todayJS.getFullYear()

  const [selectedClientId, setSelectedClientId] = useState('')
  const [sentiment, setSentiment]               = useState('Neutral')
  const [adjustment, setAdjustment]             = useState(0)
  const [engagement, setEngagement]             = useState('High')
  const [retention, setRetention]               = useState('Strong')
  const [notes, setNotes]                       = useState('')
  const [submitting, setSubmitting]             = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [justSubmitted, setJustSubmitted]       = useState(false)

  const { data: existingReview, isLoading: checkLoading } = useQuery({
    queryKey: ['weekly-review-check', selectedClientId, yearNumber, weekNumber],
    queryFn: async () => {
      if (!selectedClientId) return null
      const { data } = await supabase
        .from('weekly_reviews')
        .select('id')
        .eq('client_id', selectedClientId)
        .eq('year_number', yearNumber)
        .eq('week_number', weekNumber)
        .maybeSingle()
      return data
    },
    enabled: !!selectedClientId,
  })
  const alreadySubmitted = !!existingReview || justSubmitted

  async function handleSubmit() {
    if (!selectedClientId) return
    setSubmitting(true); setError(null)
    const { error: err } = await supabase.from('weekly_reviews').insert({
      client_id:                selectedClientId,
      review_date:              todayEST,
      week_number:              weekNumber,
      year_number:              yearNumber,
      sentiment_observed:       sentiment,
      engagement_level:         engagement,
      confidence_in_retention:  retention,
      adjustment_score:         adjustment,
      strategic_notes:          notes.trim() || null,
    } as never)
    if (err) { setError(err.message); setSubmitting(false); return }
    qc.invalidateQueries({ queryKey: ['weekly-review-check'] })
    qc.invalidateQueries({ queryKey: ['weekly-reviews-risk'] })
    setJustSubmitted(true)
    setSubmitting(false)
    setNotes(''); setAdjustment(0)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Weekly Strategic Review</p>
          <p className="text-xs text-muted-foreground mt-0.5">Friday-only · once per client per week · feeds into health scores</p>
        </div>
        {!isFriday && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
            Fridays only
          </span>
        )}
      </div>

      {!isFriday ? (
        <p className="text-sm text-muted-foreground">
          Reviews can only be submitted on Fridays. Today is {formatDateEST(todayEST)}.
        </p>
      ) : (
        <div className="space-y-4">
          <select
            value={selectedClientId}
            onChange={e => { setSelectedClientId(e.target.value); setJustSubmitted(false) }}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a client…</option>
            {clients.filter(c => c.status === 'Active' || c.status === 'Onboarding').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {selectedClientId && (
            checkLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
              </div>
            ) : alreadySubmitted ? (
              <div className="p-3 bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30 rounded-lg text-sm text-[hsl(var(--success))]">
                <CheckCircle2 className="h-4 w-4 inline mr-1.5" />
                Review submitted for this client this week. Locked until next Friday.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Sentiment</label>
                    <select value={sentiment} onChange={e => setSentiment(e.target.value)}
                      className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {['Positive', 'Neutral', 'Concerned', 'Negative'].map(v =>
                        <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Engagement</label>
                    <select value={engagement} onChange={e => setEngagement(e.target.value)}
                      className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {['High', 'Medium', 'Low', 'Disengaged'].map(v =>
                        <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Retention Confidence</label>
                    <select value={retention} onChange={e => setRetention(e.target.value)}
                      className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {['Strong', 'Moderate', 'At Risk', 'Critical'].map(v =>
                        <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Adj. Score (−10 to +20)</label>
                    <input type="number" min={-10} max={20} value={adjustment}
                      onChange={e => setAdjustment(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Strategic Notes (optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    rows={2} className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button onClick={handleSubmit} disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit Review
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { role } = useAuth()
  const canEdit = isPMOrOwner(role!)

  const [meetingTab, setMeetingTab]   = useState<MeetingTab>('scheduled')
  const [reportTab, setReportTab]     = useState<ReportTab>('weekly-done')
  const [clientFilter, setClientFilter] = useState('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [actionMsg, setActionMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const qcMeetings = useQueryClient()

  const showMsg = (ok: boolean, text: string) => {
    setActionMsg({ ok, text })
    setTimeout(() => setActionMsg(null), 5000)
  }

  const generateMeetingsMut = useMutation({
    mutationFn: () => callEdgeFunction('generate-meetings'),
    onSuccess:  (d) => {
      qcMeetings.invalidateQueries({ queryKey: ['meetings-all'] })
      showMsg(true, `Generated ${d.created ?? 0} meeting records for this month.`)
    },
    onError: (e: Error) => showMsg(false, `Generate meetings failed: ${e.message}`),
  })

  const compileReportsMut = useMutation({
    mutationFn: () => callEdgeFunction('compile-report', { batch: true }),
    onSuccess:  (d) => {
      qcMeetings.invalidateQueries({ queryKey: ['reports-all'] })
      showMsg(true, `Compiled ${d.compiled ?? 0} reports from completed tasks.`)
    },
    onError: (e: Error) => showMsg(false, `Compile reports failed: ${e.message}`),
  })

  const sendRemindersMut = useMutation({
    mutationFn: () => callEdgeFunction('send-reminders'),
    onSuccess:  (d) => showMsg(true, `Sent ${d.sent ?? 0} notifications to ${d.targets ?? 0} staff.`),
    onError:    (e: Error) => showMsg(false, `Reminders failed: ${e.message}`),
  })

  const { data: meetings = [], isLoading: loadingMeetings } = useMeetings()
  const { data: clients  = [] }  = useClients()
  const { data: reports  = [] }  = useReports()
  const { data: tasks    = [] }  = useAllTasks()
  const { data: openBlockers = [] } = useOpenBlockers()

  // ── Metrics Calculations ──────────────────────────────────────────────────

  const today = todayDateEST()
  const now = new Date()

  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const biweeklyMeetings = meetings.filter(m =>
    m.type === 'Mid-Month Review' || m.type === 'End-of-Month Review',
  )

  const biweeklyScheduled = biweeklyMeetings.filter(m =>
    m.status === 'Scheduled' || m.status === 'Completed',
  ).length

  const biweeklyCompleted = biweeklyMeetings.filter(m => m.status === 'Completed').length

  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'Onboarding')
  const expectedMeetings = activeClients.length * 2
  const compliancePct = expectedMeetings > 0
    ? Math.round((biweeklyCompleted / expectedMeetings) * 100)
    : 0

  const ownerRequested = meetings.filter(m => m.type === 'Owner Requested').length

  const blockedRiskCount = openBlockers.length + tasks.filter(t => t.status === 'Blocked').length

  // ── Meeting tab filtering ─────────────────────────────────────────────────

  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const weekEndStr   = weekEnd.toISOString().slice(0, 10)

  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 14)
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10)

  function filterMeetings(tab: MeetingTab): Meeting[] {
    let base = clientFilter === 'all'
      ? meetings
      : meetings.filter(m => m.client_id === clientFilter)

    switch (tab) {
      case 'scheduled':
        return base.filter(m => m.status === 'Scheduled')
      case 'by-client':
        return base.sort((a, b) => getClientName(a).localeCompare(getClientName(b)))
      case 'this-week':
        return base.filter(m => m.date >= weekStartStr && m.date <= weekEndStr)
      case 'last-14':
        return base.filter(m => m.date >= fourteenDaysAgoStr && m.date <= today)
      case 'this-month':
        return base.filter(m => m.date >= thisMonthStart)
      case 'biweekly-done':
        return base.filter(m =>
          m.status === 'Completed' &&
          (m.type === 'Mid-Month Review' || m.type === 'End-of-Month Review'),
        )
      case 'owner-requested':
        return base.filter(m => m.type === 'Owner Requested')
    }
  }

  // ── Report tab filtering ──────────────────────────────────────────────────

  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

  function filterReports(tab: ReportTab): Report[] {
    switch (tab) {
      case 'weekly-done':
        return reports.filter(r => r.report_type === 'Weekly Update' && r.status === 'Sent')
      case 'done-7':
        return reports.filter(r => r.status === 'Sent' && r.sent_at && r.sent_at >= sevenDaysAgoStr)
      case 'done-14':
        return reports.filter(r => r.status === 'Sent' && r.sent_at && r.sent_at >= fourteenDaysAgoStr)
      case 'monthly-done':
        return reports.filter(r => r.report_type === 'Monthly Report' && r.status === 'Sent' && r.due_date >= thisMonthStart)
      case 'blocked-risk':
        return reports.filter(r => r.status === 'Pending' || r.status === 'In Progress')
      case 'by-client': {
        const thisMonth = reports.filter(r => r.status === 'Sent' && r.due_date >= thisMonthStart)
        return [...thisMonth].sort((a, b) => getReportClientName(a).localeCompare(getReportClientName(b)))
      }
    }
  }

  // ── Kickoff reminders — Kickoff meetings where status is Scheduled ────────
  const kickoffReminders = meetings.filter(m =>
    m.type === 'Kickoff' && m.status === 'Scheduled' && m.date >= today,
  )

  // ── Owner dependency tasks ────────────────────────────────────────────────
  const ownerDepTasks = tasks.filter(t => {
    const assignments = t.task_assignments ?? []
    return assignments.some(a => a.workstream === 'Ops/PM' && (a.role_type === 'A' || a.role_type === 'R'))
      && t.status !== 'Done'
  }).slice(0, 10)

  const filteredMeetings = filterMeetings(meetingTab)
  const filteredReports  = filterReports(reportTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Meetings & Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bi-weekly coordination hub — meeting compliance and report delivery
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Automation actions */}
            <button
              onClick={() => generateMeetingsMut.mutate()}
              disabled={generateMeetingsMut.isPending}
              title="Auto-create mid-month and end-of-month meeting records for all active clients"
              className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {generateMeetingsMut.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Zap className="h-3.5 w-3.5" />
              }
              Generate Meetings
            </button>
            <button
              onClick={() => compileReportsMut.mutate()}
              disabled={compileReportsMut.isPending}
              title="Auto-compile weekly reports from completed tasks for all active clients"
              className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {compileReportsMut.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
              Compile Reports
            </button>
            <button
              onClick={() => sendRemindersMut.mutate()}
              disabled={sendRemindersMut.isPending}
              title="Trigger the daily reminder scan and notify PM/owner users of overdue items"
              className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {sendRemindersMut.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Bell className="h-3.5 w-3.5" />
              }
              Run Reminders
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Schedule Meeting
            </button>
          </div>
        )}
      </div>

      {/* Action feedback banner */}
      {actionMsg && (
        <div className={cn(
          'rounded-lg border px-4 py-2.5 text-sm flex items-center justify-between gap-3',
          actionMsg.ok
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-destructive/5 border-destructive/30 text-destructive',
        )}>
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="shrink-0 hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 6 Top Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label="Bi-Weekly Scheduled"
          value={biweeklyScheduled}
          accent="blue"
        />
        <MetricCard
          label="Bi-Weekly Completed"
          value={biweeklyCompleted}
          sub={`of ${expectedMeetings} expected`}
          accent={compliancePct >= 80 ? 'green' : compliancePct >= 50 ? 'amber' : 'red'}
        />
        <MetricCard
          label="Completion Rate"
          value={`${compliancePct}%`}
          accent={compliancePct >= 80 ? 'green' : compliancePct >= 50 ? 'amber' : 'red'}
        />
        <MetricCard
          label="Meeting Compliance"
          value={`${compliancePct}%`}
          sub="completed ÷ expected"
          accent={compliancePct >= 80 ? 'green' : 'amber'}
        />
        <MetricCard
          label="Owner Requested"
          value={ownerRequested}
          sub="not in compliance calc"
          accent="amber"
        />
        <MetricCard
          label="Blocked / Risk Items"
          value={blockedRiskCount}
          sub="blockers + blocked tasks"
          accent={blockedRiskCount > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Client Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Filter by client:</label>
        <div className="relative">
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="appearance-none rounded border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Bi-Weekly Compliance Grid (PM/Owner only) */}
      {canEdit && (
        <BiweeklyComplianceGrid meetings={meetings} clients={clients} />
      )}

      {/* Weekly Strategic Review (PM/Owner only) */}
      {canEdit && (
        <WeeklyStrategicReviewSection clients={clients} />
      )}

      {/* Kickoff Reminders */}
      {kickoffReminders.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-700 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Kickoff Planning Reminders
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {kickoffReminders.map(m => (
              <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-800">{getClientName(m)}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Kickoff: {formatDateEST(m.date)} — verify Day 0 tasks started
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Meetings Section ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Meetings
        </h2>

        {/* Meeting Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {MEETING_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setMeetingTab(tab.id)}
              className={cn(
                'flex-shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                meetingTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Meeting Table */}
        {loadingMeetings ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
            No meetings in this view
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Agenda</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">SLA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeetings.map(m => (
                  <MeetingRow key={m.id} meeting={m} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Owner Dependency Table ────────────────────────────────────────────── */}
      {ownerDepTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Owner Dependency Items
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Workstream</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Impact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Depends On</th>
                </tr>
              </thead>
              <tbody>
                {ownerDepTasks.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">{getTaskClientName(t)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{t.task_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.workstream}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        t.impact_level === 'High'   && 'bg-red-50 text-red-600',
                        t.impact_level === 'Medium' && 'bg-amber-50 text-amber-600',
                        t.impact_level === 'Low'    && 'bg-blue-50 text-blue-600',
                      )}>
                        {t.impact_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs',
                        t.status === 'Blocked'     && 'bg-red-100 text-red-700',
                        t.status === 'In Progress' && 'bg-blue-100 text-blue-700',
                        t.status === 'Not Started' && 'bg-muted text-muted-foreground',
                      )}>
                        {t.status}
                      </span>
                    </td>
                    <td className={cn('px-4 py-3 text-sm', t.due_date && isOverdueEST(t.due_date) ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                      {t.due_date ? formatDateEST(t.due_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
                        Depends On: Owner
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reports Section ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Reports
        </h2>

        {/* Report Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {REPORT_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setReportTab(tab.id)}
              className={cn(
                'flex-shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                reportTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reports Table */}
        {filteredReports.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
            No reports in this view
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Report</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => (
                  <ReportTaskRow key={r.id} report={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Meeting Dialog */}
      {showAdd && <AddMeetingDialog clients={clients} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
