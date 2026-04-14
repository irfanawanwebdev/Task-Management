/**
 * compile-report — Supabase Edge Function
 *
 * Generates a Report record from completed delivery_tasks for a client/period.
 * Supports two modes:
 *   - Single: POST { client_id, period_start, period_end, report_type? }
 *   - Batch:  POST { batch: true } — compiles weekly reports for ALL active clients
 *
 * The generated_content JSONB field stores structured report data for PDF rendering.
 * pdf_url is set to null until a PDF is generated (future: generate-pdf function).
 *
 * Called manually from MeetingsPage "Compile Report" button, or weekly by pg_cron.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''

    // ── Admin client (service_role) for all DB operations ─────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Verify caller (skip for internal cron calls using service_role) ───
    const callerIsService = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'NONE')
    if (!callerIsService) {
      const caller = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user }, error } = await caller.auth.getUser()
      if (error || !user) return json({ error: 'Unauthorized' }, 401)

      const { data: roles } = await caller.from('user_roles').select('role').eq('user_id', user.id)
      const allowed = (roles ?? []).some((r: { role: string }) =>
        ['owner', 'project_manager'].includes(r.role)
      )
      if (!allowed) return json({ error: 'Requires owner or project_manager role' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const { batch = false, client_id, period_start, period_end, report_type } = body

    if (batch) {
      return await compileBatch(admin)
    }

    if (!client_id || !period_start || !period_end) {
      return json({ error: 'Missing required fields: client_id, period_start, period_end' }, 400)
    }

    const result = await compileSingle(admin, { client_id, period_start, period_end, report_type })
    return json(result, 200)

  } catch (err) {
    console.error('compile-report error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

// ─── Compile single report ────────────────────────────────────────────────────

async function compileSingle(
  admin: ReturnType<typeof createClient>,
  opts: { client_id: string; period_start: string; period_end: string; report_type?: string }
) {
  const { client_id, period_start, period_end } = opts

  // 1. Get client name
  const { data: client } = await admin
    .from('clients')
    .select('name')
    .eq('id', client_id)
    .single()

  if (!client) return { error: 'Client not found' }

  // 2. Get completed tasks in period (full details)
  const { data: tasks } = await admin
    .from('delivery_tasks')
    .select('id, task_name, workstream, step, impact_level, status, due_date, ar_output_logged, ar_output_url, description, notes, links')
    .eq('client_id', client_id)
    .eq('status', 'Done')
    .gte('due_date', period_start)
    .lte('due_date', period_end)
    .order('step', { ascending: true })

  const doneTasks = tasks ?? []

  // 3. Get all tasks in period (for completion rate)
  const { data: allTasks } = await admin
    .from('delivery_tasks')
    .select('id, status, impact_level')
    .eq('client_id', client_id)
    .gte('due_date', period_start)
    .lte('due_date', period_end)

  const totalTasks = (allTasks ?? []).length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0
  const highImpactDone = doneTasks.filter((t: { impact_level: string }) => t.impact_level === 'High').length
  const highImpactAll  = (allTasks ?? []).filter((t: { impact_level: string }) => t.impact_level === 'High').length

  // 4. Get recent blockers for this client
  const { data: blockers } = await admin
    .from('blockers')
    .select('description, severity, status, workstream')
    .eq('client_id', client_id)
    .in('status', ['Open', 'In Progress'])
    .order('created_date', { ascending: false })
    .limit(5)

  // 5. Determine report type and name
  const endDate = new Date(period_end)
  const isFriday = endDate.getDay() === 5
  const isLastFridayOfMonth = isFriday && (endDate.getDate() + 7 > new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate())
  const resolvedType = opts.report_type ?? (isLastFridayOfMonth ? 'Monthly' : 'Weekly')
  const reportName = `${client.name} — ${resolvedType} Report (${formatDate(period_end)})`

  // 6. Build generated_content
  const generated_content = {
    compiled_at: new Date().toISOString(),
    period: { start: period_start, end: period_end },
    client_name: client.name,
    report_type: resolvedType,
    summary: {
      total_tasks: totalTasks,
      completed_tasks: doneTasks.length,
      completion_rate: completionRate,
      high_impact_done: highImpactDone,
      high_impact_total: highImpactAll,
    },
    completed_tasks: doneTasks.map((t: {
      task_name: string; workstream: string; step: number
      impact_level: string; due_date: string; ar_output_url?: string
      description?: string; notes?: string
      links?: { label: string; url: string }[]
    }) => ({
      task_name:    t.task_name,
      workstream:   t.workstream,
      step:         t.step,
      impact_level: t.impact_level,
      due_date:     t.due_date,
      proof_url:    t.ar_output_url ?? null,
      description:  t.description ?? null,
      notes:        t.notes ?? null,
      links:        t.links ?? [],
    })),
    active_blockers: (blockers ?? []).map((b: {
      description: string; severity: string; status: string; workstream: string
    }) => ({
      description: b.description,
      severity:    b.severity,
      status:      b.status,
      workstream:  b.workstream,
    })),
    sections: buildReportSections(doneTasks, resolvedType),
  }

  // 7. Upsert Report record
  const due_date = period_end

  const { data: existing } = await admin
    .from('reports')
    .select('id')
    .eq('client_id', client_id)
    .eq('due_date', due_date)
    .maybeSingle()

  if (existing) {
    await admin
      .from('reports')
      .update({ generated_content, report_name: reportName, status: 'In Progress', updated_at: new Date().toISOString() } as never)
      .eq('id', existing.id)
    return { success: true, report_id: existing.id, action: 'updated', report_name: reportName }
  }

  const { data: inserted, error: insertError } = await admin
    .from('reports')
    .insert({
      client_id,
      report_type:       resolvedType,
      report_name:       reportName,
      due_date,
      status:            'In Progress',
      generated_content,
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }
  return { success: true, report_id: inserted.id, action: 'created', report_name: reportName }
}

// ─── Batch compile for all active clients ────────────────────────────────────

async function compileBatch(admin: ReturnType<typeof createClient>) {
  const { data: clients } = await admin
    .from('clients')
    .select('id, name')
    .in('status', ['Active', 'Onboarding'])

  if (!clients || clients.length === 0) return json({ success: true, compiled: 0 }, 200)

  const today = new Date()
  const period_end   = toDateStr(today)
  const period_start = toDateStr(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000))

  const results = []
  for (const client of clients) {
    const r = await compileSingle(admin, { client_id: client.id, period_start, period_end })
    results.push({ client_id: client.id, client_name: client.name, ...r })
  }

  return json({ success: true, compiled: results.length, results }, 200)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReportSections(tasks: { task_name: string; workstream: string; step: number; impact_level: string }[], type: string) {
  const sections: Record<string, string[]> = {}
  for (const t of tasks) {
    if (!sections[t.workstream]) sections[t.workstream] = []
    sections[t.workstream].push(`Step ${t.step}: ${t.task_name} [${t.impact_level}]`)
  }
  const result: { workstream: string; items: string[] }[] = []
  for (const [ws, items] of Object.entries(sections)) {
    result.push({ workstream: ws, items })
  }
  if (type === 'Monthly') {
    result.push({
      workstream: 'Next Month Priorities',
      items: ['[PM to fill in]'],
    })
    result.push({
      workstream: 'Pending Items Requiring Owner Action',
      items: ['[PM to fill in]'],
    })
  }
  return result
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  })
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
