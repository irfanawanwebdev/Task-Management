/**
 * send-daily-report — Supabase Edge Function
 *
 * Two modes:
 *
 * MANUAL (called from frontend):
 *   POST { to, subject, html }  — sends the provided HTML as-is
 *
 * AUTO (called by pg_cron at midnight Miami):
 *   POST { auto: true }  — fetches ALL tasks updated yesterday (any status),
 *                          builds the HTML report, sends to REPORT_TO_EMAIL
 *
 * Required env vars (Supabase Dashboard → Settings → Edge Function Secrets):
 *   RESEND_API_KEY     — Resend API key (https://resend.com)
 *   FROM_EMAIL         — verified sender address (e.g. "assistant@jzsmartmedia.com")
 *   REPORT_TO_EMAIL    — recipient for auto reports (e.g. "yarden@jzsmartmedia.com")
 */

// @ts-nocheck — Deno runtime types not in project tsconfig
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estDateString(offsetDays = 0): string {
  const now = new Date()
  const estStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  if (offsetDays === 0) return estStr
  const [y, m, d] = estStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + offsetDays)
  return date.toISOString().slice(0, 10)
}

/** Returns UTC start/end bounds for a full calendar day in EST (America/New_York) */
function estDayUTCBounds(estDate: string): { from: string; to: string } {
  const [y, m, d] = estDate.split('-').map(Number)
  // Midnight EST = 05:00 UTC (UTC-5). Safe for both EST and EDT.
  const from = new Date(Date.UTC(y, m - 1, d,     5, 0, 0)).toISOString()
  const to   = new Date(Date.UTC(y, m - 1, d + 1, 5, 0, 0)).toISOString()
  return { from, to }
}

function esc(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
}

function statusColor(status: string): string {
  if (status === 'Done')        return '#16a34a'
  if (status === 'In Progress') return '#2563eb'
  if (status === 'Blocked')     return '#dc2626'
  return '#6b7280'
}

function statusBadge(status: string): string {
  const color = statusColor(status)
  const bg =
    status === 'Done'        ? '#f0fdf4' :
    status === 'In Progress' ? '#eff6ff' :
    status === 'Blocked'     ? '#fef2f2' : '#f9fafb'
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;color:${color};background:${bg};border:1px solid ${color}30">${status}</span>`
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[m - 1]} ${d}, ${y}`
}

// ─── Auto report: fetch data + build HTML ─────────────────────────────────────

async function buildAutoReportHTML(reportDate: string): Promise<string> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Fetch ALL tasks updated on reportDate (any status — Done, In Progress, Blocked)
  const { from, to } = estDayUTCBounds(reportDate)
  const { data: tasks, error: taskErr } = await admin
    .from('delivery_tasks')
    .select('*, clients(name), task_assignments(workstream, user_id)')
    .gte('updated_at', from)
    .lt('updated_at', to)
    .order('workstream')

  if (taskErr) throw new Error(`Tasks fetch failed: ${taskErr.message}`)

  // Fetch profiles for name resolution
  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id, full_name')
    .eq('is_active', true)

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.full_name]))

  function resolveName(userId: string | null, workstream: string | null): string {
    if (userId) return profileMap.get(userId) ?? 'Unknown'
    return workstream ?? 'Unassigned'
  }

  // Count by status for summary banner
  const allTasks   = tasks ?? []
  const doneTasks  = allTasks.filter(t => t.status === 'Done')
  const inProgress = allTasks.filter(t => t.status === 'In Progress')
  const blocked    = allTasks.filter(t => t.status === 'Blocked')

  const totalTasks = allTasks.length

  if (totalTasks === 0) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
      <h2>Daily Task Report — ${formatDate(reportDate)}</h2>
      <p style="color:#6b7280">No tasks were updated on ${formatDate(reportDate)}.</p>
    </body></html>`
  }

  // Group tasks by employee
  const groups = new Map<string, typeof allTasks>()
  for (const task of allTasks) {
    const assignments = task.task_assignments ?? []
    const assigned = [...new Set(
      assignments
        .filter(a => a.user_id)
        .map(a => resolveName(a.user_id, a.workstream))
    )]
    const keys = assigned.length > 0 ? assigned : [task.workstream ?? 'Unassigned']
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(task)
    }
  }

  // Build per-employee sections
  const groupsHTML = [...groups.entries()].map(([name, gtasks]) => {
    // Sort: Blocked first, then In Progress, then Done
    const sorted = [...gtasks].sort((a, b) => {
      const order = { 'Blocked': 0, 'In Progress': 1, 'Done': 2, 'Not Started': 3 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    })

    const rows = sorted.map(t => {
      const linksHTML = (t.links && t.links.length > 0)
        ? t.links.map(l => `<a href="${esc(l.url)}" style="color:#4338ca">${esc(l.label || l.url)}</a>`).join('<br/>')
        : '—'

      // Blocked reason row (shown inline under the task row)
      const blockerRow = t.status === 'Blocked' && t.blocker_text
        ? `<tr>
            <td colspan="7" style="padding:4px 12px 10px 32px;font-size:11px;background:#fef2f2;border-bottom:1px solid #fecaca">
              <span style="color:#dc2626;font-weight:700">⛔ Blocker: </span>
              <span style="color:#7f1d1d">${esc(t.blocker_text)}</span>
            </td>
          </tr>`
        : ''

      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top;font-weight:500">${esc(t.task_name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top">${esc((t.clients as any)?.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top">${esc(t.workstream)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top">${statusBadge(t.status)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#6b7280;max-width:180px;vertical-align:top">${esc(t.description)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#374151;max-width:180px;vertical-align:top">${esc(t.notes)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;max-width:140px;word-break:break-all;vertical-align:top">${linksHTML}</td>
      </tr>${blockerRow}`
    }).join('')

    // Section header color: red tint if any blocked, blue if any in progress, green if all done
    const hasBlocked    = gtasks.some(t => t.status === 'Blocked')
    const hasInProgress = gtasks.some(t => t.status === 'In Progress')
    const headerBg = hasBlocked ? 'linear-gradient(135deg,#7f1d1d,#991b1b)' :
                     hasInProgress ? 'linear-gradient(135deg,#1e3a8a,#1d4ed8)' :
                     'linear-gradient(135deg,#1e1b4b,#312e81)'

    return `<div style="margin-bottom:28px">
      <div style="background:${headerBg};color:#fff;padding:9px 14px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:700">${esc(name)}</span>
        <span style="font-size:11px;opacity:.8">${gtasks.length} task${gtasks.length !== 1 ? 's' : ''} updated</span>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none">
        <thead>
          <tr style="background:#f5f7ff">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff">Task</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff">Client</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff">Workstream</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff">Status</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff">Description</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff">Notes</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#4338ca;border-bottom:1px solid #e0e7ff">Links</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }).join('')

  // Status summary pills
  const summaryPills = [
    doneTasks.length  > 0 ? `<span style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">✅ ${doneTasks.length} Done</span>` : '',
    inProgress.length > 0 ? `<span style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">🔄 ${inProgress.length} In Progress</span>` : '',
    blocked.length    > 0 ? `<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">⛔ ${blocked.length} Blocked</span>` : '',
  ].filter(Boolean).join(' ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Daily Task Report — ${formatDate(reportDate)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#111;background:#fff;padding:32px 40px">
  <div style="border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:20px">
    <h1 style="font-size:22px;font-weight:800;color:#1e1b4b;margin:0">Daily Task Report</h1>
    <div style="font-size:12px;color:#6b7280;margin-top:6px">
      <span>📅 ${formatDate(reportDate)}</span>
      &nbsp;·&nbsp;
      <span>📋 ${totalTasks} task${totalTasks !== 1 ? 's' : ''} updated across ${groups.size} employee${groups.size !== 1 ? 's' : ''}/team${groups.size !== 1 ? 's' : ''}</span>
      &nbsp;·&nbsp;
      <span>🤖 Auto-generated at midnight Miami</span>
    </div>
  </div>

  <!-- Status summary -->
  <div style="margin-bottom:20px;display:flex;gap:8px;flex-wrap:wrap">
    ${summaryPills}
  </div>

  ${blocked.length > 0 ? `
  <!-- Blocker alert banner -->
  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-bottom:20px">
    <p style="margin:0;font-size:13px;font-weight:700;color:#991b1b">⛔ ${blocked.length} Blocked Task${blocked.length !== 1 ? 's' : ''} — Action Required</p>
    <ul style="margin:8px 0 0 0;padding-left:18px;font-size:12px;color:#7f1d1d">
      ${blocked.map(t => `<li><strong>${esc(t.task_name)}</strong> (${esc((t.clients as any)?.name ?? t.workstream)})${t.blocker_text ? ` — ${esc(t.blocker_text)}` : ''}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#92400e">
    <strong>⚠ Internal Use Only — Confidential.</strong>
    This report includes employee names and task assignments. Do not share externally.
  </div>

  ${groupsHTML}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between">
    <span>JZ Smart Media — Operations Hub</span>
    <span>Auto-generated ${formatDate(reportDate)} · Midnight Miami · Internal Only</span>
  </div>
</body>
</html>`
}

// ─── Send email via Resend ─────────────────────────────────────────────────────

async function sendViaResend(apiKey: string, from: string, to: string | string[], subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `JZ Smart Media Ops <${from}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const detail = data?.message ?? data?.name ?? JSON.stringify(data)
    throw new Error(`Resend ${res.status}: ${detail}`)
  }
  return data
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))

    const apiKey    = Deno.env.get('RESEND_API_KEY')?.trim()
    const fromEmail = (Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev').trim()

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY secret is not configured in Supabase Dashboard → Settings → Edge Function Secrets' }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── AUTO mode (called by cron) ──────────────────────────────────────────
    if (body.auto) {
      const reportDate = estDateString(-1) // yesterday in EST = day that just ended
      console.log('Auto report: building for date', reportDate)

      const html    = await buildAutoReportHTML(reportDate)
      const to      = (Deno.env.get('REPORT_TO_EMAIL') ?? 'yarden@jzsmartmedia.com').trim()
      const subject = `Daily Task Report — ${formatDate(reportDate)}`

      const result = await sendViaResend(apiKey, fromEmail, to, subject, html)
      console.log('Auto report sent:', result.id)

      return new Response(JSON.stringify({ success: true, mode: 'auto', date: reportDate, id: result.id }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── MANUAL mode (called from frontend) ─────────────────────────────────
    const { to, subject, html } = body
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    console.log('Manual report: sending to', to)
    const result = await sendViaResend(apiKey, fromEmail, to, subject, html)
    console.log('Manual report sent:', result.id)

    return new Response(JSON.stringify({ success: true, mode: 'manual', id: result.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-daily-report error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
