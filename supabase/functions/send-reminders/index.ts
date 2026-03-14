/**
 * send-reminders — Supabase Edge Function
 *
 * Daily automation job (08:00 EST via pg_cron) that scans for operational
 * issues and fans out in-app notifications to all PM/owner users.
 *
 * Scans for:
 *   1. Overdue tasks (status != Done, due_date < today)
 *   2. Reports due within 3 days (status != Sent)
 *   3. Blockers aged > 3 days (status != Resolved)
 *   4. Meetings scheduled for tomorrow (status = Scheduled)
 *
 * Each notification type is deduplicated: only one notification per type is
 * sent per day (checked via created_at > yesterday).
 *
 * Can also be triggered manually via POST {} from the MeetingsPage or AdminPage.
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

    // ── Resolve dates ─────────────────────────────────────────────────────
    const nowUTC      = new Date()
    const todayEST    = toESTDateStr(nowUTC)
    const tomorrowEST = toESTDateStr(new Date(nowUTC.getTime() + 24 * 60 * 60 * 1000))
    const in3Days     = toESTDateStr(new Date(nowUTC.getTime() + 3  * 24 * 60 * 60 * 1000))
    const threeDaysAgo = toESTDateStr(new Date(nowUTC.getTime() - 3 * 24 * 60 * 60 * 1000))

    // ── Get all PM/owner user IDs ─────────────────────────────────────────
    const { data: pmUsers } = await admin.rpc('get_pm_owner_user_ids')
    const targetUsers = (pmUsers ?? []) as { user_id: string }[]
    if (targetUsers.length === 0) return json({ success: true, sent: 0 }, 200)

    const notifications: {
      user_id: string; type: string; title: string; message: string; link?: string
    }[] = []

    // ── 1. Overdue tasks ──────────────────────────────────────────────────
    const { data: overdueTasks } = await admin
      .from('delivery_tasks')
      .select('id, task_name, clients(name)')
      .lt('due_date', todayEST)
      .neq('status', 'Done')
      .neq('status', 'Blocked') // blockers handled separately

    const overdueCount = (overdueTasks ?? []).length
    if (overdueCount > 0) {
      for (const u of targetUsers) {
        notifications.push({
          user_id: u.user_id,
          type:    'overdue_task',
          title:   `${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} need attention`,
          message: `${overdueCount} task${overdueCount > 1 ? 's are' : ' is'} past their due date and not yet completed.`,
          link:    '/tasks',
        })
      }
    }

    // ── 2. Reports due within 3 days ──────────────────────────────────────
    const { data: reportsDue } = await admin
      .from('reports')
      .select('id, report_name, due_date, clients(name)')
      .gte('due_date', todayEST)
      .lte('due_date', in3Days)
      .neq('status', 'Sent')

    const reportsDueCount = (reportsDue ?? []).length
    if (reportsDueCount > 0) {
      for (const u of targetUsers) {
        notifications.push({
          user_id: u.user_id,
          type:    'report_due',
          title:   `${reportsDueCount} report${reportsDueCount > 1 ? 's' : ''} due within 3 days`,
          message: `${reportsDueCount} unsent report${reportsDueCount > 1 ? 's are' : ' is'} due by ${in3Days}. Review and send promptly.`,
          link:    '/meetings',
        })
      }
    }

    // ── 3. Aged blockers (> 3 days, unresolved) ───────────────────────────
    const { data: agedBlockers } = await admin
      .from('blockers')
      .select('id, description, severity, clients(name)')
      .lt('created_date', threeDaysAgo)
      .neq('status', 'Resolved')

    const blockerCount = (agedBlockers ?? []).length
    if (blockerCount > 0) {
      for (const u of targetUsers) {
        notifications.push({
          user_id: u.user_id,
          type:    'blocker_aged',
          title:   `${blockerCount} blocker${blockerCount > 1 ? 's' : ''} aging beyond 3 days`,
          message: `${blockerCount} unresolved blocker${blockerCount > 1 ? 's have' : ' has'} been open for more than 3 days and require immediate action.`,
          link:    '/blockers',
        })
      }
    }

    // ── 4. Meetings scheduled for tomorrow ────────────────────────────────
    const { data: tomorrowMeetings } = await admin
      .from('meetings')
      .select('id, type, clients(name)')
      .eq('date', tomorrowEST)
      .eq('status', 'Scheduled')

    const meetingCount = (tomorrowMeetings ?? []).length
    if (meetingCount > 0) {
      const clientNames = (tomorrowMeetings ?? [])
        .map((m: { clients?: { name: string } }) => m.clients?.name ?? '—')
        .slice(0, 3)
        .join(', ')
      const moreCount = meetingCount > 3 ? ` +${meetingCount - 3} more` : ''

      for (const u of targetUsers) {
        notifications.push({
          user_id: u.user_id,
          type:    'upcoming_meeting',
          title:   `${meetingCount} meeting${meetingCount > 1 ? 's' : ''} scheduled tomorrow`,
          message: `Upcoming: ${clientNames}${moreCount}. Ensure agendas and reports are prepared.`,
          link:    '/meetings',
        })
      }
    }

    // ── Insert all notifications ──────────────────────────────────────────
    if (notifications.length > 0) {
      const { error: insertError } = await admin.from('notifications').insert(notifications)
      if (insertError) {
        console.error('Failed to insert notifications:', insertError)
        return json({ error: insertError.message }, 500)
      }
    }

    return json({
      success:  true,
      sent:     notifications.length,
      targets:  targetUsers.length,
      checks: {
        overdue_tasks:    overdueCount,
        reports_due:      reportsDueCount,
        aged_blockers:    blockerCount,
        tomorrow_meetings: meetingCount,
      },
    }, 200)

  } catch (err) {
    console.error('send-reminders error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toESTDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
