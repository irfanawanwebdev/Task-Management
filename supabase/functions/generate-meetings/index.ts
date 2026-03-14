/**
 * generate-meetings — Supabase Edge Function
 *
 * Creates the two required monthly meetings for every active client:
 *   - Mid-Month Review  (~14th of the month)
 *   - End-of-Month Review (~27th of the month)
 *
 * Idempotent: skips any client+type+month combination that already has a meeting.
 * Called on the 1st of each month by pg_cron, or manually via POST.
 *
 * POST body (all optional):
 *   { month?: number (1-12), year?: number }
 *   Defaults to the current month/year.
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Verify caller ─────────────────────────────────────────────────────
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

    // Determine target month/year (default: current)
    const now = new Date()
    const year  = body.year  ?? now.getFullYear()
    const month = body.month ?? (now.getMonth() + 1) // 1-indexed

    // ── Fetch all active + onboarding clients ─────────────────────────────
    const { data: clients, error: clientsError } = await admin
      .from('clients')
      .select('id, name')
      .in('status', ['Active', 'Onboarding'])

    if (clientsError) return json({ error: clientsError.message }, 500)
    if (!clients || clients.length === 0) return json({ success: true, created: 0 }, 200)

    // Meeting dates for the month: 14th (Mid-Month) and 27th (End-of-Month)
    const mid = `${year}-${String(month).padStart(2, '0')}-14`
    const eom = `${year}-${String(month).padStart(2, '0')}-27`

    // ── Check which meetings already exist for this month ─────────────────
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd   = `${year}-${String(month).padStart(2, '0')}-31`

    const { data: existing } = await admin
      .from('meetings')
      .select('client_id, type, date')
      .gte('date', monthStart)
      .lte('date', monthEnd)

    const existingSet = new Set(
      (existing ?? []).map((m: { client_id: string; type: string }) => `${m.client_id}:${m.type}`)
    )

    // ── Build meeting rows to insert ──────────────────────────────────────
    const toInsert = []
    for (const client of clients) {
      const midKey = `${client.id}:Mid-Month Review`
      const eomKey = `${client.id}:End-of-Month Review`

      if (!existingSet.has(midKey)) {
        toInsert.push({
          client_id: client.id,
          type:      'Mid-Month Review',
          date:      mid,
          status:    'Scheduled',
          notes:     `Auto-generated mid-month review for ${client.name}`,
        })
      }
      if (!existingSet.has(eomKey)) {
        toInsert.push({
          client_id: client.id,
          type:      'End-of-Month Review',
          date:      eom,
          status:    'Scheduled',
          notes:     `Auto-generated end-of-month review for ${client.name}`,
        })
      }
    }

    if (toInsert.length === 0) {
      return json({
        success: true,
        created: 0,
        message: `All meetings already exist for ${year}-${month}`,
      }, 200)
    }

    const { error: insertError } = await admin.from('meetings').insert(toInsert)
    if (insertError) return json({ error: insertError.message }, 500)

    // ── Notify PM/owner users ─────────────────────────────────────────────
    const { data: pmUsers } = await admin.rpc('get_pm_owner_user_ids')
    if (pmUsers && pmUsers.length > 0) {
      const notifications = (pmUsers as { user_id: string }[]).map(u => ({
        user_id: u.user_id,
        type:    'meeting_generated',
        title:   `Meetings generated for ${monthName(month)} ${year}`,
        message: `${toInsert.length} meeting records created for ${clients.length} active clients.`,
        link:    '/meetings',
      }))
      await admin.from('notifications').insert(notifications)
    }

    return json({
      success: true,
      created: toInsert.length,
      month:   `${year}-${month}`,
      skipped: (clients.length * 2) - toInsert.length,
    }, 200)

  } catch (err) {
    console.error('generate-meetings error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
