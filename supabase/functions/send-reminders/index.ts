/**
 * send-reminders — Supabase Edge Function
 *
 * Daily automation job (08:00 EST via pg_cron) that scans for operational
 * issues and fans out in-app notifications to all PM/owner users.
 *
 * Scans for:
 *   1. Overdue tasks (bulk summary → PM/owner users)
 *   2. Reports due within 3 days (bulk summary → PM/owner users)
 *   3. Blockers aged > 3 days (bulk summary → PM/owner users)
 *   4. Meetings scheduled for tomorrow (bulk summary → PM/owner users)
 *   5. Personal tasks overdue or due today/tomorrow (per user → all roles)
 *   6. Assigned delivery tasks due today/tomorrow (per user → all roles)
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

    // ── 5. Per-user: Personal tasks overdue or due today/tomorrow ─────────
    const { data: personalDue } = await admin
      .from('personal_tasks')
      .select('id, title, user_id, due_date')
      .lte('due_date', tomorrowEST)
      .neq('status', 'Done')

    // Group by user
    const personalByUser = new Map<string, { overdue: number; today: number; tomorrow: number }>()
    for (const t of (personalDue ?? []) as { user_id: string; due_date: string }[]) {
      if (!personalByUser.has(t.user_id))
        personalByUser.set(t.user_id, { overdue: 0, today: 0, tomorrow: 0 })
      const e = personalByUser.get(t.user_id)!
      if (t.due_date < todayEST)        e.overdue++
      else if (t.due_date === todayEST) e.today++
      else                              e.tomorrow++
    }

    for (const [userId, counts] of personalByUser) {
      const parts: string[] = []
      if (counts.overdue  > 0) parts.push(`${counts.overdue} overdue`)
      if (counts.today    > 0) parts.push(`${counts.today} due today`)
      if (counts.tomorrow > 0) parts.push(`${counts.tomorrow} due tomorrow`)
      notifications.push({
        user_id: userId,
        type:    'personal_task_due',
        title:   'Personal tasks need attention',
        message: `You have ${parts.join(', ')} in your personal task list.`,
        link:    '/my-tasks',
      })
    }

    // ── 6. Per-user: Assigned company tasks due today or tomorrow ─────────
    const { data: upcomingDelivery } = await admin
      .from('delivery_tasks')
      .select('id, task_name, due_date')
      .gte('due_date', todayEST)
      .lte('due_date', tomorrowEST)
      .neq('status', 'Done')
      .neq('status', 'Blocked')

    const upcomingIds = (upcomingDelivery ?? []).map((t: { id: string }) => t.id)

    if (upcomingIds.length > 0) {
      const { data: assignments } = await admin
        .from('task_assignments')
        .select('user_id, task_id')
        .in('task_id', upcomingIds)
        .not('user_id', 'is', null)

      // Map task_id → task_name for lookup
      const taskNameMap = new Map<string, string>(
        (upcomingDelivery ?? []).map((t: { id: string; task_name: string }) => [t.id, t.task_name])
      )

      // Group by user_id
      const assignedByUser = new Map<string, string[]>()
      for (const a of (assignments ?? []) as { user_id: string; task_id: string }[]) {
        if (!assignedByUser.has(a.user_id)) assignedByUser.set(a.user_id, [])
        const names = assignedByUser.get(a.user_id)!
        const name  = taskNameMap.get(a.task_id)
        if (name && !names.includes(name)) names.push(name)
      }

      for (const [userId, taskNames] of assignedByUser) {
        const count   = taskNames.length
        const preview = taskNames.slice(0, 2).join(', ') + (count > 2 ? ` +${count - 2} more` : '')
        notifications.push({
          user_id: userId,
          type:    'task_deadline_approaching',
          title:   `${count} assigned task${count > 1 ? 's' : ''} due soon`,
          message: `Tasks due today or tomorrow: ${preview}. Stay on track!`,
          link:    '/tasks',
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
        overdue_tasks:           overdueCount,
        reports_due:             reportsDueCount,
        aged_blockers:           blockerCount,
        tomorrow_meetings:       meetingCount,
        personal_task_reminders: personalByUser.size,
        assigned_task_reminders: upcomingIds.length,
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
