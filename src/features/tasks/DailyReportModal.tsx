/**
 * DailyReportModal — Task daily report grouped by employee.
 *
 * Rules:
 *  - Shows employee names (responsible / accountable) — DAILY only.
 *  - Weekly / Monthly reports remain anonymous (handled in MeetingsPage).
 *  - Status filter: All | Done | In Progress | Not Started | Blocked.
 *  - Date filter: Today | Yesterday | Last 7 Days | Last 30 Days | Custom range.
 *  - Employee filter: All | one or more employees (multi-select).
 *  - Description & Notes shown in daily report only.
 *  - Download generates a self-contained HTML file.
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, Loader2, FileText, User, Users, Calendar, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { DeliveryTask } from '@/lib/types'
import { formatDateEST, todayDateEST } from '@/lib/timezone'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'Done' | 'In Progress' | 'Not Started' | 'Blocked'
type DatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'custom'

interface Profile { user_id: string; full_name: string }

interface EmployeeGroup {
  name: string
  tasks: EnrichedTask[]
}

interface EnrichedTask extends DeliveryTask {
  clientName: string
  responsibles: string[]
  accountables: string[]
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Converts a UTC ISO timestamp to an EST/EDT date string (YYYY-MM-DD). */
function utcToESTDate(utcTs: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(new Date(utcTs))
}

/** Returns the best date to use for filtering a task — updated_at in EST, falling back to completed_date. */
function taskFilterDate(task: DeliveryTask): string | null {
  if (task.updated_at) return utcToESTDate(task.updated_at)
  return task.completed_date ?? null
}

/** Offset from TODAY in Miami/EST time (not system clock). */
function offsetDate(days: number): string {
  const today = todayDateEST() // always Miami date regardless of system TZ
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return format(date, 'yyyy-MM-dd')
}

function dateRangeBounds(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  const today = todayDateEST()
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'yesterday') { const y = offsetDate(-1); return { from: y, to: y } }
  if (preset === 'last7') return { from: offsetDate(-6), to: today }
  if (preset === 'last30') return { from: offsetDate(-29), to: today }
  if (preset === 'custom') return { from: customFrom || null, to: customTo || null }
  return { from: null, to: null }
}

function dateRangeLabel(preset: DatePreset, customFrom: string, customTo: string): string {
  if (preset === 'today') return todayDateEST()
  if (preset === 'yesterday') return offsetDate(-1)
  if (preset === 'last7') return `${offsetDate(-6)} → ${todayDateEST()}`
  if (preset === 'last30') return `${offsetDate(-29)} → ${todayDateEST()}`
  if (preset === 'custom' && customFrom && customTo) return `${customFrom} → ${customTo}`
  if (preset === 'custom' && customFrom) return `From ${customFrom}`
  return 'All Dates'
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useAllTasksForReport() {
  return useQuery<DeliveryTask[]>({
    queryKey: ['tasks-daily-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*, clients(name), task_assignments(role_type, workstream, user_id)')
        .order('step')
        .order('due_date')
      if (error) throw error
      return (data ?? []) as unknown as DeliveryTask[]
    },
    staleTime: 60_000,
  })
}

function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_active', true)
      return (data ?? []) as Profile[]
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveName(userId: string | null | undefined, workstream: string | null | undefined, profiles: Profile[]) {
  if (userId) return profiles.find(p => p.user_id === userId)?.full_name ?? 'Unknown'
  return workstream ?? 'Unassigned'
}

function buildEmployeeGroups(
  tasks: DeliveryTask[],
  profiles: Profile[],
  statusFilter: StatusFilter,
  dateFrom: string | null,
  dateTo: string | null,
): EmployeeGroup[] {
  let filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter)

  // Apply date range filter on updated_at (EST) — catches Done, In Progress, and Blocked
  if (dateFrom) filtered = filtered.filter(t => { const d = taskFilterDate(t); return !!d && d >= dateFrom })
  if (dateTo)   filtered = filtered.filter(t => { const d = taskFilterDate(t); return !!d && d <= dateTo   })

  const map = new Map<string, EnrichedTask[]>()

  for (const task of filtered) {
    const assignments = task.task_assignments ?? []
    const rUsers = assignments.filter(a => a.role_type === 'R')
    const aUsers = assignments.filter(a => a.role_type === 'A')

    const responsibles = rUsers.map(a => resolveName(a.user_id, a.workstream, profiles))
    const accountables = aUsers.map(a => resolveName(a.user_id, a.workstream, profiles))

    const enriched: EnrichedTask = {
      ...task,
      clientName: (task.clients as { name: string } | null)?.name ?? '—',
      responsibles,
      accountables,
    }

    const assigned = assignments
      .filter(a => a.user_id)
      .map(a => resolveName(a.user_id, a.workstream, profiles))

    const uniqueAssigned = [...new Set(assigned)]

    if (uniqueAssigned.length === 0) {
      const key = task.workstream ?? 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(enriched)
    } else {
      for (const name of uniqueAssigned) {
        if (!map.has(name)) map.set(name, [])
        map.get(name)!.push(enriched)
      }
    }
  }

  const entries = [...map.entries()]
  const isPersonName = (n: string) => profiles.some(p => p.full_name === n)
  entries.sort(([a], [b]) => {
    const aIsP = isPersonName(a)
    const bIsP = isPersonName(b)
    if (aIsP && !bIsP) return -1
    if (!aIsP && bIsP) return 1
    return a.localeCompare(b)
  })

  return entries.map(([name, tasks]) => ({ name, tasks }))
}

// ─── HTML Download ────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  if (status === 'Done') return '#16a34a'
  if (status === 'In Progress') return '#2563eb'
  if (status === 'Blocked') return '#dc2626'
  return '#6b7280'
}

function esc(str: string | null | undefined): string {
  if (!str) return '—'
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

function buildReportHTML(
  groups: EmployeeGroup[],
  statusFilter: StatusFilter,
  selectedEmployees: string[],
  dateLabel: string,
): string {
  const statusLabel = statusFilter === 'all' ? 'All Statuses' : statusFilter
  const employeeLabel = selectedEmployees.length === 0
    ? 'All Employees'
    : selectedEmployees.length === 1
      ? selectedEmployees[0]
      : `${selectedEmployees.length} employees`
  const totalTasks = groups.reduce((n, g) => n + g.tasks.length, 0)

  const groupsHTML = groups.map(g => {
    const rows = g.tasks.map(t => {
      const linksHTML = (t.links && t.links.length > 0)
        ? t.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label || l.url)}</a>`).join('<br/>')
        : '—'
      return `
      <tr>
        <td>${esc(t.task_name)}</td>
        <td>${esc(t.clientName)}</td>
        <td>${esc(t.workstream)}</td>
        <td style="color:${statusColor(t.status)};font-weight:600">${t.status}</td>
        <td>${t.due_date ? formatDateEST(t.due_date) : '—'}</td>
        <td class="notes-cell">${esc(t.description)}</td>
        <td class="notes-cell">${esc(t.notes ?? null)}</td>
        <td class="links-cell">${linksHTML}</td>
      </tr>`
    }).join('')

    return `
      <div class="group">
        <div class="group-header">
          <span class="group-name">${esc(g.name)}</span>
          <span class="group-count">${g.tasks.length} task${g.tasks.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Task</th><th>Client</th><th>Workstream</th>
              <th>Status</th><th>Due Date</th>
              <th>Description</th><th>Notes</th><th>Links</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Daily Task Report — ${dateLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;
    color:#111;background:#fff;padding:32px 40px}
  .header{border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:28px}
  .header h1{font-size:22px;font-weight:800;color:#1e1b4b}
  .header .meta{font-size:12px;color:#6b7280;margin-top:6px;display:flex;gap:20px;flex-wrap:wrap}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600}
  .badge-purple{background:#ede9fe;color:#5b21b6}
  .badge-blue{background:#dbeafe;color:#1d4ed8}
  .badge-green{background:#dcfce7;color:#166534}
  .group{margin-bottom:28px;page-break-inside:avoid}
  .group-header{display:flex;align-items:center;justify-content:space-between;
    background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;
    padding:9px 14px;border-radius:8px 8px 0 0}
  .group-name{font-size:13px;font-weight:700}
  .group-count{font-size:11px;opacity:.75}
  table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;
    border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
  thead th{background:#f5f7ff;padding:8px 12px;text-align:left;
    font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff}
  tbody tr:nth-child(even){background:#fafaff}
  tbody td{padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top;color:#374151}
  tbody tr:last-child td{border-bottom:none}
  .notes-cell{font-size:11px;color:#6b7280;max-width:200px;white-space:pre-wrap;word-break:break-word}
  .links-cell{font-size:11px;max-width:180px;word-break:break-all}
  .links-cell a{color:#4338ca;text-decoration:underline;display:inline-block;margin-bottom:2px}
  .links-cell a:hover{color:#6366f1}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;
    font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
  .disclaimer{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;
    padding:10px 14px;margin-bottom:20px;font-size:12px;color:#92400e}
  .disclaimer strong{display:block;margin-bottom:2px}
  @media print{body{padding:20px 24px}.group{page-break-inside:avoid}}
</style>
</head>
<body>
  <div class="header">
    <h1>Daily Task Report</h1>
    <div class="meta">
      <span>📅 Updated: ${dateLabel}</span>
      <span>🔍 Status: <span class="badge badge-purple">${statusLabel}</span></span>
      <span>👤 Employees: <span class="badge badge-blue">${esc(employeeLabel)}</span></span>
      <span>📋 ${totalTasks} total tasks across ${groups.length} employees/teams</span>
    </div>
  </div>
  <div class="disclaimer">
    <strong>⚠ Internal Use Only — Confidential</strong>
    This daily report includes employee names and task assignments. Do not share externally.
    Weekly and monthly client-facing reports are sent without employee attribution.
  </div>
  ${groupsHTML}
  <div class="footer">
    <span>JZ Smart Media — Operations Hub</span>
    <span>Generated ${todayDateEST()} · Daily Report · Internal Only</span>
  </div>
</body>
</html>`
}

function downloadDailyReport(
  groups: EmployeeGroup[],
  statusFilter: StatusFilter,
  selectedEmployees: string[],
  dateLabel: string,
) {
  const html = buildReportHTML(groups, statusFilter, selectedEmployees, dateLabel)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const suffix = selectedEmployees.length === 1
    ? `-${selectedEmployees[0].replace(/\s+/g, '-')}`
    : selectedEmployees.length > 1
      ? `-${selectedEmployees.length}-employees`
      : ''
  // Sanitize dateLabel for filename (replace → and spaces)
  const datePart = dateLabel.replace(/\s*→\s*/g, '_to_').replace(/\s+/g, '-')
  a.download = `Daily-Task-Report-${datePart}${suffix}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Email Send ───────────────────────────────────────────────────────────────

const JORDAN_EMAIL = 'yarden@jzsmartmedia.com'

type SendState = 'idle' | 'sending' | 'sent' | 'error'

async function sendReportEmail(
  html: string,
  subject: string,
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('send-daily-report', {
    body: { to, subject, html },
  })
  if (error || data?.error) return { ok: false, error: error?.message ?? data?.error ?? 'Unknown error' }
  return { ok: true }
}

// ─── Countdown to midnight Miami ─────────────────────────────────────────────

function useCountdownToMidnightEST(): string {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const update = () => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
      }).formatToParts(new Date())

      const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
      const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
      const s = parseInt(parts.find(p => p.type === 'second')?.value ?? '0')

      const secondsNow = h * 3600 + m * 60 + s
      const secondsLeft = 86400 - secondsNow  // seconds until midnight

      const rh = Math.floor(secondsLeft / 3600)
      const rm = Math.floor((secondsLeft % 3600) / 60)
      setCountdown(`${rh}h ${rm < 10 ? '0' + rm : rm}m`)
    }

    update()
    const id = setInterval(update, 30_000) // refresh every 30s
    return () => clearInterval(id)
  }, [])

  return countdown
}

// ─── Status Filter Tabs ────────────────────────────────────────────────────────

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All Tasks' },
  { id: 'Done', label: 'Done' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Not Started', label: 'Not Started' },
  { id: 'Blocked', label: 'Blocked' },
]

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom' },
]

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface DailyReportModalProps {
  open: boolean
  onClose: () => void
}

export function DailyReportModal({ open, onClose }: DailyReportModalProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [sendState, setSendState] = useState<SendState>('idle')
  const [sendError, setSendError] = useState('')
  const nextReportIn = useCountdownToMidnightEST()

  const { data: tasks = [], isLoading } = useAllTasksForReport()
  const { data: profiles = [] } = useProfiles()

  const { from: dateFrom, to: dateTo } = dateRangeBounds(datePreset, customFrom, customTo)
  const dateLabel = dateRangeLabel(datePreset, customFrom, customTo)

  // Build all groups first, then apply employee filter
  const allGroups = buildEmployeeGroups(tasks, profiles, statusFilter, dateFrom, dateTo)
  const groups = selectedEmployees.length > 0
    ? allGroups.filter(g => selectedEmployees.includes(g.name))
    : allGroups

  const totalTasks = groups.reduce((n, g) => n + g.tasks.length, 0)

  const toggleEmployee = (name: string) => {
    setSelectedEmployees(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const handleSendToJordan = async () => {
    if (groups.length === 0) return
    setSendState('sending')
    setSendError('')
    const html = buildReportHTML(groups, statusFilter, selectedEmployees, dateLabel)
    const subject = `Daily Task Report — ${dateLabel}`
    const { ok, error } = await sendReportEmail(html, subject, JORDAN_EMAIL)
    if (ok) {
      setSendState('sent')
      setTimeout(() => setSendState('idle'), 4000)
    } else {
      setSendState('error')
      setSendError(error ?? 'Failed to send')
      setTimeout(() => setSendState('idle'), 5000)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between gap-4 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Daily Task Report</h2>
              <p className="text-xs text-muted-foreground">Updated: {dateLabel} · Grouped by employee</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadDailyReport(groups, statusFilter, selectedEmployees, dateLabel)}
              disabled={groups.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download HTML
            </button>

            {/* Send to Jordan — manual + auto countdown */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendToJordan}
                disabled={groups.length === 0 || sendState === 'sending'}
                title={`Send report now to ${JORDAN_EMAIL}`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50',
                  sendState === 'sent'
                    ? 'bg-green-600 text-white'
                    : sendState === 'error'
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-secondary text-foreground hover:bg-accent border border-border',
                )}
              >
                {sendState === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {sendState === 'sent' && <CheckCircle className="h-3.5 w-3.5" />}
                {sendState === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
                {sendState === 'idle' && <Send className="h-3.5 w-3.5" />}
                {sendState === 'sending' ? 'Sending…'
                  : sendState === 'sent' ? 'Sent!'
                    : sendState === 'error' ? 'Failed'
                      : 'Send to Jordan'}
              </button>
              {nextReportIn && (
                <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                  Auto in <span className="font-mono text-primary/70">{nextReportIn}</span>
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Send error toast ── */}
        {sendState === 'error' && sendError && (
          <div className="px-5 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{sendError}</p>
          </div>
        )}

        {/* ── Date Filter ── */}
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mr-1">Updated:</span>
            </div>
            {DATE_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  datePreset === p.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground bg-background',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom date range inputs */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-xs text-muted-foreground">From</span>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">To</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {(customFrom || customTo) && (
                <button
                  onClick={() => { setCustomFrom(''); setCustomTo('') }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              )}
              <span className="text-xs text-muted-foreground/60 ml-1">
                Miami today: <span className="font-mono text-primary/80">{todayDateEST()}</span>
              </span>
            </div>
          )}
        </div>

        {/* ── Status Filter ── */}
        <div className="px-5 pt-3 pb-3 border-b border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Status:</span>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  statusFilter === f.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground bg-background',
                )}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''} · {groups.length} employee{groups.length !== 1 ? 's' : ''}/team{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Employee Filter ── */}
        <div className="px-5 pt-3 pb-3 border-b border-border">
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Employees:</span>
            </div>
            {/* All button */}
            <button
              onClick={() => setSelectedEmployees([])}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                selectedEmployees.length === 0
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground bg-background',
              )}
            >
              All
            </button>
            {/* Per-employee chips */}
            {allGroups.map(g => (
              <button
                key={g.name}
                onClick={() => toggleEmployee(g.name)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  selectedEmployees.includes(g.name)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground bg-background',
                )}
              >
                {g.name}
                <span className="ml-1 opacity-60">({g.tasks.length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Notice ── */}
        <div className="px-5 pt-3">
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <span className="text-amber-500 text-xs mt-0.5">⚠</span>
            <p className="text-xs text-amber-500/90">
              <strong>Internal only</strong> — This daily report includes employee names and responsibilities.
              Weekly and monthly client-facing reports do <em>not</em> show employee attribution.
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <FileText className="h-6 w-6 opacity-30" />
              <p className="text-sm">No tasks match the selected filters.</p>
            </div>
          )}

          {!isLoading && groups.map(group => (
            <EmployeeSection key={group.name} group={group} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Employee Section ─────────────────────────────────────────────────────────

function EmployeeSection({ group }: { group: EmployeeGroup }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-border">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold text-primary">{group.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Task</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Client</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Workstream</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Due Date</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Description</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Notes</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Links</th>
            </tr>
          </thead>
          <tbody>
            {group.tasks.map(task => (
              <DailyTaskRow key={task.id} task={task} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function DailyTaskRow({ task }: { task: EnrichedTask }) {
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-2.5">
        <p className="font-medium text-foreground line-clamp-2">{task.task_name}</p>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{task.clientName}</td>
      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{task.workstream}</td>
      <td className="px-4 py-2.5">
        <span className={cn(
          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
          task.status === 'Done' ? 'bg-green-500/15 text-green-400' :
            task.status === 'In Progress' ? 'bg-blue-500/15 text-blue-400' :
              task.status === 'Blocked' ? 'bg-red-500/15 text-red-400' :
                'bg-muted text-muted-foreground'
        )}>
          {task.status}
        </span>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
        {task.due_date ? formatDateEST(task.due_date) : '—'}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground max-w-[180px]">
        {task.description
          ? <span className="line-clamp-3 whitespace-pre-wrap break-words">{task.description}</span>
          : <span className="opacity-40 italic">—</span>
        }
      </td>
      <td className="px-4 py-2.5 text-muted-foreground max-w-[180px]">
        {task.notes
          ? <span className="line-clamp-3 whitespace-pre-wrap break-words">{task.notes}</span>
          : <span className="opacity-40 italic">—</span>
        }
      </td>
      <td className="px-4 py-2.5 max-w-[160px]">
        {task.links && task.links.length > 0
          ? <div className="flex flex-col gap-1">
            {task.links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline hover:text-primary/80 truncate block"
              >
                {l.label || l.url}
              </a>
            ))}
          </div>
          : <span className="opacity-40 italic text-muted-foreground">—</span>
        }
      </td>
    </tr>
  )
}
