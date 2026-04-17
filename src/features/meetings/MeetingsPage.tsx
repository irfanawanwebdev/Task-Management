/**
 * Meetings & Reports Page — /meetings
 * Bi-weekly coordination hub: metrics, meeting views, owner dependency tracking,
 * kickoff reminders, and report task views.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, CheckCircle2, AlertTriangle, Plus, X, ExternalLink,
  ChevronDown, Loader2, FileText, Users, Zap, Bell, RefreshCw, Save,
  Eye, Copy, Download,
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
import { HelpPopover } from '@/components/HelpPopover'

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
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, status, parent_client_id, location_name')
        .order('name')
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
  const [createGoogleEvent, setCreateGoogleEvent] = useState(true)
  const [guests, setGuests] = useState<{ name: string; email: string }[]>([])
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [error, setError] = useState('')

  const addGuest = () => {
    if (!guestEmail.trim()) return
    setGuests(g => [...g, { name: guestName.trim(), email: guestEmail.trim() }])
    setGuestName('')
    setGuestEmail('')
  }

  // Check if the current user has Google Calendar connected
  const { data: isGoogleConnected } = useQuery({
    queryKey: ['google-connected'],
    queryFn: async () => {
      const { data } = await supabase
        .from('connector_tokens')
        .select('id')
        .eq('connector_id', 'google-calendar')
        .maybeSingle()
      return !!data
    },
  })

  const add = useMutation({
    mutationFn: async () => {
      if (!form.client_id || !form.date) {
        setError('Client and date are required.')
        return
      }

      let meetLink = form.meeting_link || null
      let calendarEventId: string | null = null
      let calendarEventLink: string | null = null

      // Auto-create Google Calendar event + Meet link if connected
      if (isGoogleConnected && createGoogleEvent) {
        const clientName = clients.find(c => c.id === form.client_id)?.name ?? 'Client'
        try {
          const result = await callEdgeFunction('create-calendar-event', {
            title:  `${clientName} — ${form.type}`,
            date:   form.date,
            time:   form.time || undefined,
            agenda: form.agenda || undefined,
          })
          meetLink          = result.meetLink          ?? meetLink
          calendarEventId   = result.calendarEventId   ?? null
          calendarEventLink = result.calendarEventLink ?? null
        } catch (calErr) {
          setError(`Google Calendar: ${(calErr as Error).message}. Meeting saved without calendar event.`)
          // Fall through — save meeting without calendar data
        }
      }

      const { data: insertedMeeting, error } = await supabase.from('meetings').insert({
        client_id:          form.client_id,
        type:               form.type,
        date:               form.date,
        time:               form.time || null,
        agenda:             form.agenda || null,
        meeting_link:       meetLink,
        calendar_event_link: calendarEventLink,
        google_event_id:    calendarEventId,
        calendar_source:    calendarEventId ? 'Google' : null,
        status:             'Scheduled',
        owner_approval_required: false,
        sla_hours:          24,
        guests:             guests,
      } as never).select('id').single()
      if (error) throw error

      // Send invite emails to guests
      if (guests.length > 0 && insertedMeeting) {
        const clientName = clients.find(c => c.id === form.client_id)?.name ?? 'Client'
        const dateStr    = form.date
        const timeStr    = form.time ? ` at ${form.time}` : ''
        const agendaHtml = form.agenda
          ? `<p style="margin-top:12px"><strong>Agenda:</strong><br>${form.agenda.replace(/\n/g,'<br>')}</p>`
          : ''
        const linkHtml   = meetLink
          ? `<p style="margin-top:12px"><a href="${meetLink}" style="color:#6366f1">Join Meeting</a></p>`
          : ''
        for (const g of guests) {
          const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:32px;color:#111">
            <h2 style="color:#1e1b4b">Meeting Invitation</h2>
            <p>Hi ${g.name || 'there'},</p>
            <p>You have been invited to a <strong>${form.type}</strong> meeting for <strong>${clientName}</strong>.</p>
            <p><strong>Date:</strong> ${dateStr}${timeStr}</p>
            ${agendaHtml}${linkHtml}
            <p style="margin-top:20px;font-size:12px;color:#6b7280">JZ Smart Media — Operations Hub</p>
          </body></html>`
          await supabase.functions.invoke('send-daily-report', {
            body: { to: g.email, subject: `Meeting Invitation: ${clientName} — ${form.type} (${dateStr})`, html },
          })
        }
      }
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

          {/* Google Calendar auto-create toggle */}
          {isGoogleConnected ? (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={createGoogleEvent}
                onChange={e => setCreateGoogleEvent(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary" />
              <span className="text-sm text-muted-foreground">
                Create Google Calendar event + Meet link automatically
              </span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Connect Google Calendar in Settings to auto-generate Meet links.
            </p>
          )}

          {/* Manual link — shown when not auto-creating or Google not connected */}
          {(!isGoogleConnected || !createGoogleEvent) && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Meeting Link (Zoom/Meet)</label>
              <input type="url" value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))}
                placeholder="https://…"
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}

          {/* Guests */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Guests (invitations sent by email)</label>
            {guests.length > 0 && (
              <div className="mt-1 mb-2 flex flex-wrap gap-1.5">
                {guests.map((g, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-xs">
                    {g.name ? `${g.name} <${g.email}>` : g.email}
                    <button onClick={() => setGuests(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Name (optional)"
                className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-xs"
              />
              <input
                type="email"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest() } }}
                placeholder="Email address"
                className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={addGuest}
                disabled={!guestEmail.trim()}
                className="px-2 py-1.5 bg-secondary text-foreground border border-border rounded text-xs hover:bg-accent disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
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

// ─── Report content builder ───────────────────────────────────────────────────

interface GeneratedContent {
  tasks_completed?: number
  high_impact?: number
  delivery_summary?: {
    task: string
    workstream: string
    impact: string
    completed_date: string | null
    output_link: string | null
    description?: string | null
    notes?: string | null
    links?: { label: string; url: string }[]
    location?: string | null
  }[]
}

function buildReportText(report: Report, clientName: string): string {
  const gc = report.generated_content as GeneratedContent | null
  const lines: string[] = []

  lines.push('=' .repeat(60))
  lines.push(`JZ SMART MEDIA — ${report.report_type.toUpperCase()}`)
  lines.push('=' .repeat(60))
  lines.push(`Client  : ${clientName}`)
  lines.push(`Period  : ${formatDateEST(report.due_date)}`)
  lines.push(`Status  : ${report.status}`)
  if (report.sent_at) lines.push(`Sent    : ${formatDateEST(report.sent_at)}`)
  lines.push('')

  if (gc) {
    lines.push('─'.repeat(60))
    lines.push('EXECUTIVE SUMMARY')
    lines.push('─'.repeat(60))
    lines.push(`Tasks Completed  : ${gc.tasks_completed ?? 0}`)
    lines.push(`High-Impact Done : ${gc.high_impact ?? 0}`)
    lines.push('')

    if (gc.delivery_summary && gc.delivery_summary.length > 0) {
      lines.push('─'.repeat(60))
      lines.push('DELIVERY SUMMARY')
      lines.push('─'.repeat(60))
      gc.delivery_summary.forEach((t, i) => {
        lines.push(`${i + 1}. ${t.task}`)
        lines.push(`   Workstream  : ${t.workstream}`)
        lines.push(`   Impact      : ${t.impact}`)
        lines.push(`   Completed   : ${t.completed_date ? formatDateEST(t.completed_date) : '—'}`)
        if (t.location)    lines.push(`   Location    : ${t.location}`)
        if (t.description) lines.push(`   Description : ${t.description}`)
        if (t.notes)       lines.push(`   Notes       : ${t.notes}`)
        if (t.output_link) lines.push(`   Output      : ${t.output_link}`)
        if (t.links && t.links.length > 0) {
          t.links.forEach(l => lines.push(`   Link        : ${l.label || l.url} — ${l.url}`))
        }
        lines.push('')
      })
    }
  } else {
    lines.push('(Manual report — no auto-generated content)')
    lines.push('')
  }

  if (report.pdf_url) {
    lines.push('─'.repeat(60))
    lines.push(`Report Link: ${report.pdf_url}`)
    lines.push('')
  }

  lines.push('=' .repeat(60))
  lines.push('Generated by JZ Smart Media — Operations Hub')
  lines.push('=' .repeat(60))
  return lines.join('\n')
}

// ─── Report Viewer Dialog ─────────────────────────────────────────────────────

function ReportViewerDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const qc = useQueryClient()
  const clientName = getReportClientName(report)
  const gc = report.generated_content as GeneratedContent | null
  const reportText = buildReportText(report, clientName)

  const markSent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'Sent', sent_at: new Date().toISOString() } as never)
        .eq('id', report.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports-all'] }),
  })

  function handleCopy() {
    navigator.clipboard.writeText(reportText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleExportTxt() {
    const blob = new Blob([reportText], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${clientName.replace(/\s+/g, '_')}_${report.report_type.replace(/\s+/g, '_')}_${report.due_date}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportPdf() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
<title>${report.report_name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 40px; max-width: 780px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .05em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 24px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 20px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-weekly { background: #dbeafe; color: #1d4ed8; }
  .badge-monthly { background: #ede9fe; color: #7c3aed; }
  .badge-sent { background: #dcfce7; color: #166534; }
  .badge-pending { background: #f3f4f6; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
  td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .stat-label { font-size: 11px; color: #6b7280; }
  .stat-value { font-size: 24px; font-weight: 700; color: #111; }
  .impact-high { color: #b91c1c; font-weight: 600; }
  .impact-med  { color: #d97706; }
  .impact-low  { color: #2563eb; }
  a { color: #2563eb; }
  footer { margin-top: 40px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
<h1>${report.report_name}</h1>
<div class="meta">
  <span class="badge ${report.report_type === 'Monthly Report' ? 'badge-monthly' : 'badge-weekly'}">${report.report_type}</span>&nbsp;
  <span class="badge ${report.status === 'Sent' ? 'badge-sent' : 'badge-pending'}">${report.status}</span>&nbsp;&nbsp;
  Period: ${formatDateEST(report.due_date)}&nbsp;&nbsp;|&nbsp;&nbsp;Client: <strong>${clientName}</strong>
  ${report.sent_at ? `&nbsp;&nbsp;|&nbsp;&nbsp;Sent: ${formatDateEST(report.sent_at)}` : ''}
</div>
${gc ? `
<h2>Executive Summary</h2>
<div class="stat-grid">
  <div class="stat-card"><div class="stat-label">Tasks Completed</div><div class="stat-value">${gc.tasks_completed ?? 0}</div></div>
  <div class="stat-card"><div class="stat-label">High-Impact Done</div><div class="stat-value">${gc.high_impact ?? 0}</div></div>
</div>
${gc.delivery_summary && gc.delivery_summary.length > 0 ? `
<h2>Delivery Summary</h2>
<table>
  <thead><tr><th>#</th><th>Task</th><th>Workstream</th><th>Impact</th><th>Completed</th><th>Description</th><th>Notes</th><th>Output / Links</th></tr></thead>
  <tbody>
    ${gc.delivery_summary.map((t, i) => {
      const linksHtml = [
        t.output_link ? `<a href="${t.output_link}" target="_blank">Output</a>` : '',
        ...(t.links ?? []).map(l => `<a href="${l.url}" target="_blank">${l.label || l.url}</a>`),
      ].filter(Boolean).join('<br/>')
      return `
    <tr>
      <td>${i + 1}</td>
      <td>${t.task}</td>
      <td>${t.workstream}</td>
      <td class="${t.impact === 'High' ? 'impact-high' : t.impact === 'Medium' ? 'impact-med' : 'impact-low'}">${t.impact}</td>
      <td>${t.completed_date ? formatDateEST(t.completed_date) : '—'}</td>
      <td style="font-size:11px;color:#555;white-space:pre-wrap;max-width:200px">${t.description ?? '—'}</td>
      <td style="font-size:11px;color:#555;white-space:pre-wrap;max-width:200px">${t.notes ?? '—'}</td>
      <td>${linksHtml || '—'}</td>
    </tr>`
    }).join('')}
  </tbody>
</table>` : ''}
` : '<p style="color:#6b7280;font-style:italic;">Manual report — no auto-generated content.</p>'}
${report.pdf_url ? `<h2>Report Link</h2><p><a href="${report.pdf_url}" target="_blank">${report.pdf_url}</a></p>` : ''}
<footer>Generated by JZ Smart Media — Operations Hub</footer>
</body></html>`)
    win.document.close()
    setTimeout(() => { win.print() }, 400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold truncate max-w-xs">{report.report_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleExportTxt}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Download className="h-3 w-3" />
              TXT
            </button>
            <button onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-primary/40 text-xs text-primary hover:bg-primary/10 transition-colors">
              <Download className="h-3 w-3" />
              PDF
            </button>
            {report.status !== 'Sent' && (
              <button onClick={() => markSent.mutate()} disabled={markSent.isPending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-green-300 bg-green-50 text-xs text-green-700 hover:bg-green-100 transition-colors">
                {markSent.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Mark Sent
              </button>
            )}
            <button onClick={onClose} className="ml-1 p-1 rounded hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Report body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              report.report_type === 'Monthly Report' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
            )}>{report.report_type}</span>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              report.status === 'Sent' ? 'bg-green-50 text-green-700' :
              report.status === 'In Progress' ? 'bg-amber-50 text-amber-600' : 'bg-muted text-muted-foreground',
            )}>{report.status}</span>
            <span className="text-muted-foreground text-xs">Client: <strong className="text-foreground">{clientName}</strong></span>
            <span className="text-muted-foreground text-xs">Period: {formatDateEST(report.due_date)}</span>
            {report.sent_at && <span className="text-muted-foreground text-xs">Sent: {formatDateEST(report.sent_at)}</span>}
          </div>

          {gc ? (
            <>
              {/* Executive Summary */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Executive Summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Tasks Completed</p>
                    <p className="text-2xl font-bold mt-0.5">{gc.tasks_completed ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">High-Impact Done</p>
                    <p className="text-2xl font-bold mt-0.5 text-red-600">{gc.high_impact ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Summary */}
              {gc.delivery_summary && gc.delivery_summary.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Delivery Summary</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Task</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Workstream</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Impact</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Completed</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Output</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gc.delivery_summary.map((t, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">{t.task}</td>
                            <td className="px-3 py-2 text-muted-foreground">{t.workstream}</td>
                            <td className="px-3 py-2">
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                t.impact === 'High'   ? 'bg-red-100 text-red-700' :
                                t.impact === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700',
                              )}>{t.impact}</span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {t.completed_date ? formatDateEST(t.completed_date) : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {t.output_link ? (
                                <a href={t.output_link} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> View
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Manual report — no auto-generated content.</p>
          )}

          {/* External link */}
          {report.pdf_url && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Report Link</p>
              <a href={report.pdf_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" />
                {report.pdf_url}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Report Task Row ──────────────────────────────────────────────────────────

function ReportTaskRow({ report, onView }: { report: Report; onView: () => void }) {
  return (
    <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={onView}>
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
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={onView}
          className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-muted"
        >
          <Eye className="h-3 w-3" /> View
        </button>
      </td>
    </tr>
  )
}

// ─── Create Report Dialog ─────────────────────────────────────────────────────

type ReportMode = 'auto' | 'manual'

function CreateReportDialog({
  clients,
  onClose,
}: {
  clients: Client[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [mode, setMode]             = useState<ReportMode>('auto')
  const [clientId, setClientId]     = useState('')
  const [reportType, setReportType] = useState<'Weekly Update' | 'Monthly Report'>('Weekly Update')
  const [reportName, setReportName] = useState('')
  const [dueDate, setDueDate]       = useState(todayDateEST())
  const [status, setStatus]         = useState<'Pending' | 'In Progress' | 'Sent'>('Pending')
  const [pdfUrl, setPdfUrl]         = useState('')
  const [rangeDays, setRangeDays]   = useState<7 | 14 | 30>(7)
  const [error, setError]           = useState<string | null>(null)

  // Separate parent/child clients
  const parentClients   = clients.filter(c => !c.parent_client_id)
  const childLocations  = clientId ? clients.filter(c => c.parent_client_id === clientId) : []
  const allLocationIds  = clientId ? [clientId, ...childLocations.map(c => c.id)] : []
  const hasMultiLocations = childLocations.length > 0

  // Load completed tasks for auto mode — includes all child locations when parent is selected
  const { data: completedTasks = [], isFetching: loadingTasks } = useQuery<DeliveryTask[]>({
    queryKey: ['report-tasks', allLocationIds, rangeDays],
    queryFn: async () => {
      if (!clientId || allLocationIds.length === 0) return []
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - rangeDays)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('id, task_name, workstream, step_name, completed_date, output_link, impact_level, description, notes, links, client_id, clients(name, location_name)')
        .in('client_id', allLocationIds)
        .eq('status', 'Done')
        .gte('completed_date', cutoffStr)
        .order('completed_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DeliveryTask[]
    },
    enabled: mode === 'auto' && !!clientId,
  })

  const selectedClient = clients.find(c => c.id === clientId)

  // Auto-fill report name when client/type/date changes
  const autoName = selectedClient
    ? `${selectedClient.name} — ${reportType} — ${dueDate}`
    : ''

  const saveReport = useMutation({
    mutationFn: async () => {
      const name = reportName.trim() || autoName
      if (!clientId) throw new Error('Select a client.')
      if (!name)     throw new Error('Report name is required.')

      const generatedContent = mode === 'auto' && completedTasks.length > 0
        ? {
            tasks_completed: completedTasks.length,
            high_impact:     completedTasks.filter(t => t.impact_level === 'High').length,
            delivery_summary: completedTasks.map(t => {
              const taskClient = (t as unknown as { clients?: { name: string; location_name?: string | null } }).clients
              const location = hasMultiLocations
                ? (taskClient?.location_name ?? (t.client_id !== clientId ? (taskClient?.name ?? null) : null))
                : null
              return {
                task:           t.task_name,
                workstream:     t.workstream,
                impact:         t.impact_level,
                completed_date: t.completed_date,
                output_link:    t.output_link ?? null,
                description:    (t as unknown as { description?: string }).description ?? null,
                notes:          (t as unknown as { notes?: string }).notes ?? null,
                links:          (t as unknown as { links?: { label: string; url: string }[] }).links ?? [],
                location,
              }
            }),
          }
        : null

      const { error } = await supabase.from('reports').insert({
        client_id:         clientId,
        report_type:       reportType,
        report_name:       name,
        due_date:          dueDate,
        status,
        pdf_url:           pdfUrl.trim() || null,
        generated_content: generatedContent,
        sent_at:           status === 'Sent' ? new Date().toISOString() : null,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports-all'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Create Report</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['auto', 'manual'] as ReportMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  mode === m
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'auto' ? 'Auto (from completed tasks)' : 'Manual entry'}
              </button>
            ))}
          </div>

          {/* Core fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Client <span className="text-destructive">*</span></label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select company…</option>
                {parentClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {hasMultiLocations && (
                <p className="mt-1 text-xs text-primary/80">
                  Includes {childLocations.length} location{childLocations.length !== 1 ? 's' : ''}: {childLocations.map(c => c.location_name ?? c.name).join(', ')}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value as typeof reportType)}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option>Weekly Update</option>
                <option>Monthly Report</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as typeof status)}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option>Pending</option>
                <option>In Progress</option>
                <option>Sent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Report Name</label>
            <input
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder={autoName || 'e.g. Acme Corp — Weekly Update — 2026-03-24'}
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Report / PDF URL (optional)</label>
            <input
              value={pdfUrl}
              onChange={e => setPdfUrl(e.target.value)}
              placeholder="https://docs.google.com/…"
              className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Auto mode: task preview */}
          {mode === 'auto' && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium">Include tasks completed in last</label>
                {([7, 14, 30] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setRangeDays(d)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                      rangeDays === d
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >{d} days</button>
                ))}
              </div>

              {clientId && (
                <div className="rounded-lg border border-border bg-background overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-medium">
                      Completed Tasks {loadingTasks && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{completedTasks.length} tasks</span>
                  </div>
                  {completedTasks.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      {loadingTasks ? 'Loading…' : `No completed tasks in the last ${rangeDays} days for this client.`}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/20">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Task</th>
                            {hasMultiLocations && <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Location</th>}
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Workstream</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Impact</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Completed</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Description</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedTasks.map(t => {
                            const taskClient = (t as unknown as { clients?: { name: string; location_name?: string | null } }).clients
                            const locationLabel = taskClient?.location_name ?? (t.client_id !== clientId ? (taskClient?.name ?? '—') : null)
                            return (
                              <tr key={t.id} className="border-t border-border/50">
                                <td className="px-3 py-1.5 font-medium">{t.task_name}</td>
                                {hasMultiLocations && (
                                  <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                                    {locationLabel
                                      ? <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">{locationLabel}</span>
                                      : <span className="text-muted-foreground/40">Main</span>
                                    }
                                  </td>
                                )}
                                <td className="px-3 py-1.5 text-muted-foreground">{t.workstream}</td>
                                <td className="px-3 py-1.5">
                                  <span className={cn(
                                    'px-1.5 py-0.5 rounded text-xs',
                                    t.impact_level === 'High'   ? 'bg-red-100 text-red-700' :
                                    t.impact_level === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
                                  )}>{t.impact_level}</span>
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground">{t.completed_date ? formatDateEST(t.completed_date) : '—'}</td>
                                <td className="px-3 py-1.5 text-muted-foreground text-xs max-w-[150px] truncate">
                                  {(t as unknown as { description?: string }).description || '—'}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground text-xs max-w-[150px] truncate">
                                  {(t as unknown as { notes?: string }).notes || '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            onClick={() => saveReport.mutate()}
            disabled={saveReport.isPending || !clientId}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saveReport.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Report
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MeetingTab =
  | 'scheduled' | 'by-client' | 'this-week' | 'last-14' | 'this-month'
  | 'biweekly-done' | 'owner-requested'

type ReportTab = 'all' | 'weekly-done' | 'done-7' | 'done-14' | 'monthly-done' | 'blocked-risk' | 'by-client'

const MEETING_TABS: { id: MeetingTab; label: string; help: string }[] = [
  { id: 'scheduled',       label: 'Scheduled',       help: 'All upcoming meetings that haven\'t happened yet, ordered by date.' },
  { id: 'by-client',       label: 'By Client',       help: 'Meetings grouped by client. Use this to see all past and future meetings for a specific client.' },
  { id: 'this-week',       label: 'This Week',       help: 'Meetings scheduled for the current week (Mon–Sun). Good for daily prep.' },
  { id: 'last-14',         label: 'Last 14 Days',    help: 'Meetings from the past 14 days. Use this to review what was recently discussed.' },
  { id: 'this-month',      label: 'This Month',      help: 'All meetings within the current calendar month.' },
  { id: 'biweekly-done',   label: 'Bi-Weekly Done',  help: 'Compliance grid: each active client needs 2 meetings per month (Mid-Month ~14th, End-of-Month ~27th). Green = 2 done, Yellow = 1, Red = 0.' },
  { id: 'owner-requested', label: 'Owner Requested', help: 'Special meetings requested by the owner/leadership, outside the standard bi-monthly cadence.' },
]

const REPORT_TABS: { id: ReportTab; label: string; help: string }[] = [
  { id: 'all',          label: 'All Reports',      help: 'Every report across all clients and time periods.' },
  { id: 'weekly-done',  label: 'Weekly Done',      help: 'Completed weekly reports. A weekly update is due every Friday for each active client.' },
  { id: 'done-7',       label: 'Done in 7 Days',   help: 'Reports completed in the last 7 days.' },
  { id: 'done-14',      label: 'Done in 14 Days',  help: 'Reports completed in the last 14 days.' },
  { id: 'monthly-done', label: 'Monthly Done',     help: 'Completed monthly reports. The last Friday of each month\'s weekly report becomes the Monthly Report.' },
  { id: 'blocked-risk', label: 'Blocked / Risk',   help: 'Reports that are blocked or flagged as at risk of not being delivered on time.' },
  { id: 'by-client',    label: 'By Client',        help: 'Reports grouped by client. Use this to audit a specific client\'s report history.' },
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

  const [meetingTab, setMeetingTab]         = useState<MeetingTab>('scheduled')
  const [reportTab, setReportTab]           = useState<ReportTab>('all')
  const [clientFilter, setClientFilter]     = useState('all')
  const [showAdd, setShowAdd]               = useState(false)
  const [showCreateReport, setShowCreateReport] = useState(false)
  const [viewingReport, setViewingReport]       = useState<Report | null>(null)
  const [actionMsg, setActionMsg]           = useState<{ ok: boolean; text: string } | null>(null)

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
      case 'all':
        return [...reports].sort((a, b) => b.due_date.localeCompare(a.due_date))
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
      {showCreateReport && (
        <CreateReportDialog clients={clients} onClose={() => setShowCreateReport(false)} />
      )}
      {viewingReport && (
        <ReportViewerDialog report={viewingReport} onClose={() => setViewingReport(null)} />
      )}

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
              onClick={() => setShowCreateReport(true)}
              className="inline-flex items-center gap-2 rounded border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              + Create Report
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
                'flex-shrink-0 flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                meetingTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <HelpPopover title={tab.label} content={tab.help} side="bottom" align="left" />
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
                'flex-shrink-0 flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                reportTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <HelpPopover title={tab.label} content={tab.help} side="bottom" align="left" />
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
                  <ReportTaskRow key={r.id} report={r} onView={() => setViewingReport(r)} />
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
