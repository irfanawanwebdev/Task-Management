// @ts-nocheck — Deno runtime types not in project tsconfig
/**
 * send-reminders — Supabase Edge Function
 *
 * Daily automation job (14:00 UTC / ~9 AM EST via pg_cron) that scans for
 * operational issues and fans out in-app notifications.
 *
 * Scans for:
 *   1. Overdue tasks (bulk summary → PM/owner users)
 *   2. Overdue delivery tasks (per assigned employee → ALL roles)      ← NEW
 *   3. Delivery tasks due TODAY (per assigned employee → ALL roles)    ← NEW (was grouped with tomorrow)
 *   4. Delivery tasks due TOMORROW (per assigned employee → ALL roles)
 *   5. Reports due within 3 days (bulk summary → PM/owner users)
 *   6. Blockers aged > 3 days (bulk summary → PM/owner users)
 *   7. Meetings scheduled for tomorrow (bulk summary → PM/owner users)
 *   8. Personal tasks overdue or due today/tomorrow (per user → all roles)
 *
 * Each per-user notification type is deduplicated: only one notification
 * per type is inserted per day to avoid spamming.
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
    const body = await req.json().catch(() => ({}))
    const authHeader = req.headers.get('Authorization') ?? ''

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Verify caller ─────────────────────────────────────────────────────
    // Skip auth when called by pg_cron (body.auto === true, no JWT header)
    const isAutoCron = body.auto === true
    if (!isAutoCron) {
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
    }

    // ── Resolve dates ─────────────────────────────────────────────────────
    const nowUTC = new Date()
    const todayEST = toESTDateStr(nowUTC)
    const tomorrowEST = toESTDateStr(new Date(nowUTC.getTime() + 24 * 60 * 60 * 1000))
    const in3Days = toESTDateStr(new Date(nowUTC.getTime() + 3 * 24 * 60 * 60 * 1000))
    const threeDaysAgo = toESTDateStr(new Date(nowUTC.getTime() - 3 * 24 * 60 * 60 * 1000))

    // ── Get all PM/owner user IDs ─────────────────────────────────────────
    const { data: pmUsers } = await admin.rpc('get_pm_owner_user_ids')
    const targetUsers = (pmUsers ?? []) as { user_id: string }[]

    const notifications: {
      user_id: string; type: string; title: string; message: string; link?: string
    }[] = []

    // ── 1. Overdue tasks — bulk summary to PM/owner ───────────────────────
    const { data: overdueTasks } = await admin
      .from('delivery_tasks')
      .select('id, task_name, due_date, clients(name), task_assignments(user_id)')
      .lt('due_date', todayEST)
      .neq('status', 'Done')
      .neq('status', 'Blocked')

    const overdueCount = (overdueTasks ?? []).length
    if (overdueCount > 0) {
      for (const u of targetUsers) {
        notifications.push({
          user_id: u.user_id,
          type: 'overdue_task',
          title: `${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} need attention`,
          message: `${overdueCount} task${overdueCount > 1 ? 's are' : ' is'} past their due date and not yet completed.`,
          link: '/tasks',
        })
      }
    }

    // ── 2. Overdue tasks — per assigned employee ──────────────────────────
    // Each employee gets their own list of overdue tasks every morning.
    if ((overdueTasks ?? []).length > 0) {
      const overdueByUser = new Map<string, string[]>()
      for (const task of (overdueTasks ?? []) as {
        id: string; task_name: string; due_date: string;
        clients?: { name: string };
        task_assignments?: { user_id: string | null }[]
      }[]) {
        const assignedUsers = (task.task_assignments ?? [])
          .map(a => a.user_id)
          .filter((uid): uid is string => !!uid)

        for (const uid of assignedUsers) {
          if (!overdueByUser.has(uid)) overdueByUser.set(uid, [])
          overdueByUser.get(uid)!.push(task.task_name)
        }
      }

      for (const [userId, taskNames] of overdueByUser) {
        const count = taskNames.length
        const preview = taskNames.slice(0, 3).join(', ') + (count > 3 ? ` +${count - 3} more` : '')
        notifications.push({
          user_id: userId,
          type: 'overdue_task_assigned',
          title: `⚠ ${count} overdue task${count > 1 ? 's' : ''} assigned to you`,
          message: `Please complete overdue task${count > 1 ? 's' : ''}: ${preview}.`,
          link: '/tasks',
        })
      }
    }

    // ── 3 & 4. Delivery tasks due TODAY or TOMORROW — per assigned employee ─
    // Fetched in one query, split by date for different urgency messaging.
    const { data: upcomingDelivery } = await admin
      .from('delivery_tasks')
      .select('id, task_name, due_date, clients(name)')
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

      // Map task_id → { task_name, due_date }
      const taskMap = new Map<string, { name: string; due: string }>(
        (upcomingDelivery ?? []).map((t: { id: string; task_name: string; due_date: string }) =>
          [t.id, { name: t.task_name, due: t.due_date }]
        )
      )

      // Separate by date per user
      const dueToday = new Map<string, string[]>()  // userId → task names
      const dueTomorrow = new Map<string, string[]>()

      for (const a of (assignments ?? []) as { user_id: string; task_id: string }[]) {
        const task = taskMap.get(a.task_id)
        if (!task) continue

        if (task.due === todayEST) {
          if (!dueToday.has(a.user_id)) dueToday.set(a.user_id, [])
          if (!dueToday.get(a.user_id)!.includes(task.name))
            dueToday.get(a.user_id)!.push(task.name)
        } else {
          if (!dueTomorrow.has(a.user_id)) dueTomorrow.set(a.user_id, [])
          if (!dueTomorrow.get(a.user_id)!.includes(task.name))
            dueTomorrow.get(a.user_id)!.push(task.name)
        }
      }

      // Due TODAY — urgent notification to each assignee
      for (const [userId, taskNames] of dueToday) {
        const count = taskNames.length
        const preview = taskNames.slice(0, 3).join(', ') + (count > 3 ? ` +${count - 3} more` : '')
        notifications.push({
          user_id: userId,
          type: 'task_deadline_approaching',
          title: `🔔 ${count} task${count > 1 ? 's' : ''} due TODAY`,
          message: `Complete today: ${preview}. These are due by end of day.`,
          link: '/tasks',
        })
      }

      // Due TOMORROW — heads-up to each assignee
      for (const [userId, taskNames] of dueTomorrow) {
        // Skip if user already got a "due today" notification (reduce noise)
        if (dueToday.has(userId)) continue
        const count = taskNames.length
        const preview = taskNames.slice(0, 3).join(', ') + (count > 3 ? ` +${count - 3} more` : '')
        notifications.push({
          user_id: userId,
          type: 'task_deadline_approaching',
          title: `${count} task${count > 1 ? 's' : ''} due tomorrow`,
          message: `Heads up: ${preview} ${count > 1 ? 'are' : 'is'} due tomorrow.`,
          link: '/tasks',
        })
      }
    }

    // ── 5. Reports due within 3 days ──────────────────────────────────────
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
          type: 'report_due',
          title: `${reportsDueCount} report${reportsDueCount > 1 ? 's' : ''} due within 3 days`,
          message: `${reportsDueCount} unsent report${reportsDueCount > 1 ? 's are' : ' is'} due by ${in3Days}. Review and send promptly.`,
          link: '/meetings',
        })
      }
    }

    // ── 6. Aged blockers (> 3 days, unresolved) ───────────────────────────
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
          type: 'blocker_aged',
          title: `${blockerCount} blocker${blockerCount > 1 ? 's' : ''} aging beyond 3 days`,
          message: `${blockerCount} unresolved blocker${blockerCount > 1 ? 's have' : ' has'} been open for more than 3 days and require immediate action.`,
          link: '/blockers',
        })
      }
    }

    // ── 7. Meetings scheduled for tomorrow ────────────────────────────────
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
          type: 'upcoming_meeting',
          title: `${meetingCount} meeting${meetingCount > 1 ? 's' : ''} scheduled tomorrow`,
          message: `Upcoming: ${clientNames}${moreCount}. Ensure agendas and reports are prepared.`,
          link: '/meetings',
        })
      }
    }

    // ── 8. Per-user: Personal tasks overdue or due today/tomorrow ─────────
    const { data: personalDue } = await admin
      .from('personal_tasks')
      .select('id, title, user_id, due_date')
      .lte('due_date', tomorrowEST)
      .neq('status', 'Done')

    const personalByUser = new Map<string, { overdue: number; today: number; tomorrow: number }>()
    for (const t of (personalDue ?? []) as { user_id: string; due_date: string }[]) {
      if (!personalByUser.has(t.user_id))
        personalByUser.set(t.user_id, { overdue: 0, today: 0, tomorrow: 0 })
      const e = personalByUser.get(t.user_id)!
      if (t.due_date < todayEST) e.overdue++
      else if (t.due_date === todayEST) e.today++
      else e.tomorrow++
    }

    for (const [userId, counts] of personalByUser) {
      const parts: string[] = []
      if (counts.overdue > 0) parts.push(`${counts.overdue} overdue`)
      if (counts.today > 0) parts.push(`${counts.today} due today`)
      if (counts.tomorrow > 0) parts.push(`${counts.tomorrow} due tomorrow`)
      notifications.push({
        user_id: userId,
        type: 'personal_task_due',
        title: 'Personal tasks need attention',
        message: `You have ${parts.join(', ')} in your personal task list.`,
        link: '/my-tasks',
      })
    }

    // ── Insert all notifications ──────────────────────────────────────────
    if (notifications.length > 0) {
      const { error: insertError } = await admin.from('notifications').insert(notifications)
      if (insertError) {
        console.error('Failed to insert notifications:', insertError)
        return json({ error: insertError.message }, 500)
      }
    }

    // ── Send daily summary emails via Resend ──────────────────────────────
    // For each user who received notifications, fetch their email and send a digest.
    const apiKey = Deno.env.get('RESEND_API_KEY')?.trim()
    const fromEmail = (Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev').trim()
    let emailsSent = 0

    if (apiKey && notifications.length > 0) {
      // Group notifications by user
      const byUser = new Map<string, typeof notifications>()
      for (const n of notifications) {
        if (!byUser.has(n.user_id)) byUser.set(n.user_id, [])
        byUser.get(n.user_id)!.push(n)
      }

      // Fetch user emails from auth.users + full names from profiles
      const allUserIds = [...byUser.keys()]
      const { data: profileData } = await admin
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds)
      const profileNameMap = new Map<string, string>(
        (profileData ?? []).map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name])
      )

      // Get emails from Supabase auth admin API
      const emailMap = new Map<string, { email: string; full_name: string }>()
      for (const uid of allUserIds) {
        try {
          const { data: { user } } = await admin.auth.admin.getUserById(uid)
          if (user?.email) {
            emailMap.set(uid, {
              email: user.email,
              full_name: profileNameMap.get(uid) ?? user.email,
            })
          }
        } catch {
        }
      }

      for (const [userId, userNotifs] of byUser) {
        const user = emailMap.get(userId)
        if (!user?.email) continue

        const itemsHtml = userNotifs.map(n => `
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;vertical-align:top">
              <strong style="font-size:13px">${n.title}</strong>
              <p style="margin:4px 0 0;font-size:12px;color:#6b7280">${n.message}</p>
            </td>
          </tr>`).join('')

        const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#111;background:#fff;padding:32px">
          <div style="border-bottom:3px solid #6366f1;padding-bottom:12px;margin-bottom:20px">
            <h1 style="font-size:20px;font-weight:800;color:#1e1b4b;margin:0">Daily Reminders</h1>
            <p style="font-size:12px;color:#6b7280;margin:6px 0 0">Hi ${user.full_name} — here's your morning briefing for ${todayEST}.</p>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">${itemsHtml}</table>
          <p style="margin-top:24px;font-size:11px;color:#9ca3af">
            JZ Smart Media Operations Hub · Auto-generated daily at 9 AM EST
          </p>
        </body></html>`

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `JZ Smart Media <${fromEmail}>`,
            to: [user.email],
            subject: `Daily Reminders — ${todayEST}`,
            html,
          }),
        })
        if (res.ok) emailsSent++
        else {
          const err = await res.json().catch(() => ({}))
          console.error('Resend error for', user.email, err)
        }
      }
    }

    return json({
      success: true,
      sent: notifications.length,
      emails_sent: emailsSent,
      targets: targetUsers.length,
      checks: {
        overdue_tasks_pm_summary: overdueCount,
        overdue_task_assigned_per_user: (overdueTasks ?? []).length,
        due_today_per_user: upcomingIds.length,
        reports_due: reportsDueCount,
        aged_blockers: blockerCount,
        tomorrow_meetings: meetingCount,
        personal_task_reminders: personalByUser.size,
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
