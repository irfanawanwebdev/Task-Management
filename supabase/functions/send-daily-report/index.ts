/**
 * send-daily-report — Supabase Edge Function
 *
 * Two modes:
 *
 * MANUAL (called from frontend):
 *   POST { to, subject, html }  — sends the provided HTML as-is
 *
 * AUTO (called by pg_cron at midnight Miami):
 *   POST { auto: true }  — fetches yesterday's completed tasks from DB,
 *                          builds the HTML report, sends to REPORT_TO_EMAIL
 *
 * Required env vars (Supabase Dashboard → Settings → Edge Function Secrets):
 *   RESEND_API_KEY     — Resend API key (https://resend.com)
 *   FROM_EMAIL         — verified sender address (e.g. "assistant@jzsmartmedia.com")
 *   REPORT_TO_EMAIL    — recipient for auto reports (e.g. "yarden@jzsmartmedia.com")
 */

// @ts-nocheck — Deno runtime types not in project tsconfig
import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
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
  }).format(now)                        // "YYYY-MM-DD" in EST
  if (offsetDays === 0) return estStr
  const [y, m, d] = estStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + offsetDays)
  return date.toISOString().slice(0, 10)
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

  // Fetch tasks completed on reportDate
  const { data: tasks, error: taskErr } = await admin
    .from('delivery_tasks')
    .select('*, clients(name), task_assignments(role_type, workstream, user_id)')
    .eq('completed_date', reportDate)
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

  // Group tasks by employee
  const groups = new Map<string, typeof tasks>()
  for (const task of tasks ?? []) {
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

  const totalTasks = (tasks ?? []).length

  if (totalTasks === 0) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
      <h2>Daily Task Report — ${formatDate(reportDate)}</h2>
      <p style="color:#6b7280">No tasks were completed on ${formatDate(reportDate)}.</p>
    </body></html>`
  }

  const groupsHTML = [...groups.entries()].map(([name, gtasks]) => {
    const rows = gtasks.map(t => {
      const linksHTML = (t.links && t.links.length > 0)
        ? t.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" style="color:#4338ca">${esc(l.label || l.url)}</a>`).join('<br/>')
        : '—'
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top">${esc(t.task_name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc((t.clients as any)?.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(t.workstream)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:${statusColor(t.status)};font-weight:600">${t.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#6b7280;max-width:200px">${esc(t.description)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#6b7280;max-width:200px">${esc(t.notes)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;max-width:160px;word-break:break-all">${linksHTML}</td>
      </tr>`
    }).join('')

    return `<div style="margin-bottom:28px">
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;padding:9px 14px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:700">${esc(name)}</span>
        <span style="font-size:11px;opacity:.75">${gtasks.length} task${gtasks.length !== 1 ? 's' : ''}</span>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Daily Task Report — ${formatDate(reportDate)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#111;background:#fff;padding:32px 40px">
  <div style="border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:28px">
    <h1 style="font-size:22px;font-weight:800;color:#1e1b4b;margin:0">Daily Task Report</h1>
    <div style="font-size:12px;color:#6b7280;margin-top:6px;display:flex;gap:20px;flex-wrap:wrap">
      <span>✅ Completed: <strong>${formatDate(reportDate)}</strong></span>
      <span>📋 ${totalTasks} task${totalTasks !== 1 ? 's' : ''} across ${groups.size} employee${groups.size !== 1 ? 's' : ''}/team${groups.size !== 1 ? 's' : ''}</span>
      <span>🤖 Auto-generated at midnight Miami</span>
    </div>
  </div>
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))

    const apiKey    = Deno.env.get('RESEND_API_KEY')?.trim()
    const fromEmail = (Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev').trim()

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
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
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
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
    // Return 200 with error so frontend can display the message
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
