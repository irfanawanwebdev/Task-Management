/**
 * AI Assistant Edge Function
 * Powered by Claude Opus 4.6 — reads and writes to the Operations Hub database.
 *
 * Tools: query_tasks, query_clients, query_meetings, query_blockers,
 *        add_task, update_meeting, add_blocker, bulk_create_tasks
 */

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

// ── Week due-date calculator ───────────────────────────────────────────────
// Week 1 = next Wednesday from referenceDate (or +7 if already Wednesday)
// Week 2 = +7 days, Week 3 = +14 days, etc.
function getWeekDueDate(weekNum: number, referenceDate: string): string {
  const ref = new Date(referenceDate + 'T12:00:00')
  const day = ref.getDay() // 0=Sun 3=Wed 6=Sat
  const daysToNextWed = day === 3 ? 7 : (3 - day + 7) % 7
  const firstWed = new Date(ref)
  firstWed.setDate(ref.getDate() + daysToNextWed)
  const result = new Date(firstWed)
  result.setDate(firstWed.getDate() + (weekNum - 1) * 7)
  return result.toISOString().split('T')[0]
}

// ── Tool definitions ───────────────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'query_tasks',
    description: 'Query delivery tasks. Use for questions about pending tasks, overdue tasks, tasks assigned to a person, or tasks for a client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Filter by client name (partial match)' },
        assigned_to_name: { type: 'string', description: 'Filter by team member full name' },
        status: { type: 'string', enum: ['Todo', 'In Progress', 'Done', 'Blocked'] },
        step: { type: 'number', description: 'Delivery step number 0–15' },
        overdue: { type: 'boolean', description: 'If true, return only overdue tasks (due_date < today, status ≠ Done)' },
        due_within_days: { type: 'number', description: 'Tasks due within N days from today' },
        limit: { type: 'number', description: 'Max results (default 25)' },
      },
    },
  },
  {
    name: 'query_clients',
    description: 'Query clients. Use to look up client names, IDs, health status, or active/paused clients.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Search by client name (partial match)' },
        status: { type: 'string', enum: ['Active', 'Paused', 'Churned', 'Prospect'] },
        health: { type: 'string', enum: ['Green', 'Yellow', 'Red'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'query_meetings',
    description: "Query meetings. Use to answer questions about today's meetings, upcoming meetings, meetings for a client, or meetings at a specific time.",
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string' },
        date: { type: 'string', description: 'ISO date YYYY-MM-DD — meetings on this specific date' },
        after_date: { type: 'string', description: 'ISO date — meetings after this date' },
        before_date: { type: 'string', description: 'ISO date — meetings before this date' },
        meeting_type: { type: 'string', enum: ['Mid-Month', 'End-of-Month', 'Kickoff', 'Ad-Hoc'] },
        status: { type: 'string', enum: ['Scheduled', 'Completed', 'Cancelled', 'No-Show'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'query_blockers',
    description: 'Query active blockers from the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string' },
        status: { type: 'string', enum: ['Open', 'Resolved', 'Escalated'] },
        severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'add_task',
    description: 'Create a new delivery task. Always call query_clients first to verify the client exists and get its UUID. Call query_tasks to check for duplicates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'UUID from query_clients' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['Todo', 'In Progress', 'Done', 'Blocked'] },
        step: { type: 'number', description: 'Delivery step 0–15' },
        workstream: { type: 'string' },
        due_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
      },
      required: ['client_id', 'title'],
    },
  },
  {
    name: 'update_meeting',
    description: "Update a meeting — add agenda items, notes, or change status. ALWAYS call query_meetings first to find the exact meeting. If the meeting the user described doesn't exist, FLAG it and list what meetings DO exist.",
    input_schema: {
      type: 'object' as const,
      properties: {
        meeting_id: { type: 'string', description: 'UUID from query_meetings' },
        agenda: { type: 'string', description: 'Agenda content (replaces existing)' },
        notes: { type: 'string', description: 'Meeting notes (replaces existing)' },
        status: { type: 'string', enum: ['Scheduled', 'Completed', 'Cancelled', 'No-Show'] },
      },
      required: ['meeting_id'],
    },
  },
  {
    name: 'add_blocker',
    description: 'Create a blocker for a client. Call query_clients first to confirm the client exists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'UUID from query_clients' },
        task_id: { type: 'string', description: 'Optional — UUID of the related task' },
        title: { type: 'string' },
        description: { type: 'string' },
        severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
      },
      required: ['client_id', 'title'],
    },
  },
  {
    name: 'bulk_create_tasks',
    description: 'Create multiple tasks from a week-based timeline file. Calculates due dates: Week 1 = next Wednesday from reference_date, Week 2 = +7d, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'UUID from query_clients' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              week: { type: 'number', description: 'Week number (1, 2, 3…)' },
              step: { type: 'number', description: 'Delivery step 0–15 (best guess if not specified)' },
              workstream: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
            },
            required: ['title', 'week'],
          },
        },
        reference_date: { type: 'string', description: 'ISO date YYYY-MM-DD — Week 1 start (default: today)' },
      },
      required: ['client_id', 'tasks'],
    },
  },
]

// ── Tool executor ──────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function executeTool(name: string, input: Record<string, any>, supabase: any): Promise<string> {
  try {
    switch (name) {

      // ── query_tasks ────────────────────────────────────────────────────────
      case 'query_tasks': {
        const today = new Date().toISOString().split('T')[0]
        const limit = Number(input.limit ?? 25)

        // Resolve client IDs from name
        let clientIds: string[] | null = null
        if (input.client_name) {
          const { data: cs } = await supabase.from('clients').select('id').ilike('name', `%${input.client_name}%`)
          clientIds = (cs ?? []).map((c: { id: string }) => c.id)
          if (clientIds!.length === 0) return `No client found matching "${input.client_name}".`
        }

        // Resolve task IDs from assigned member name
        let taskIdsFromUser: string[] | null = null
        if (input.assigned_to_name) {
          const { data: ps } = await supabase.from('profiles').select('user_id').ilike('full_name', `%${input.assigned_to_name}%`)
          const uids = (ps ?? []).map((p: { user_id: string }) => p.user_id)
          if (uids.length === 0) return `No team member found matching "${input.assigned_to_name}".`
          const { data: as_ } = await supabase.from('task_assignments').select('task_id').in('user_id', uids)
          taskIdsFromUser = (as_ ?? []).map((a: { task_id: string }) => a.task_id)
          if (taskIdsFromUser!.length === 0) return `No tasks assigned to "${input.assigned_to_name}".`
        }

        let q = supabase
          .from('delivery_tasks')
          .select('id, title, status, step, workstream, due_date, priority, client_id, clients(name)')
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(limit)

        if (clientIds) q = q.in('client_id', clientIds)
        if (taskIdsFromUser) q = q.in('id', taskIdsFromUser)
        if (input.status) q = q.eq('status', input.status)
        if (input.step !== undefined) q = q.eq('step', Number(input.step))
        if (input.overdue) q = q.lt('due_date', today).not('status', 'eq', 'Done')
        if (input.due_within_days) {
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + Number(input.due_within_days))
          q = q.gte('due_date', today).lte('due_date', cutoff.toISOString().split('T')[0])
        }

        const { data: tasks, error } = await q
        if (error) return `Error: ${error.message}`
        if (!tasks || tasks.length === 0) return 'No tasks found matching the criteria.'

        // Resolve assignee names
        const taskIds = tasks.map((t: { id: string }) => t.id)
        const { data: assigns } = await supabase.from('task_assignments').select('task_id, user_id, workstream').in('task_id', taskIds)
        const uids = [...new Set((assigns ?? []).map((a: { user_id: string }) => a.user_id).filter(Boolean))]
        let pmap: Record<string, string> = {}
        if (uids.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uids)
          pmap = Object.fromEntries((profs ?? []).map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name]))
        }
        const amap: Record<string, string[]> = {}
        for (const a of (assigns ?? [])) {
          if (!amap[a.task_id]) amap[a.task_id] = []
          amap[a.task_id].push(a.user_id ? (pmap[a.user_id] ?? a.workstream ?? '?') : (a.workstream ?? '?'))
        }

        const rows = tasks.map((t: {
          id: string; title: string; status: string; step: number
          workstream: string; due_date: string; priority: string
          clients: { name: string } | null
        }) =>
          `• [${t.status}] "${t.title}" | Client: ${t.clients?.name ?? '?'} | Step ${t.step} | Due: ${t.due_date ?? 'None'} | Assigned: ${(amap[t.id] ?? []).join(', ') || 'Unassigned'}`
        ).join('\n')
        return `Found ${tasks.length} task(s):\n${rows}`
      }

      // ── query_clients ──────────────────────────────────────────────────────
      case 'query_clients': {
        let q = supabase.from('clients').select('id, name, status, health_status, start_date').order('name').limit(Number(input.limit ?? 30))
        if (input.name) q = q.ilike('name', `%${input.name}%`)
        if (input.status) q = q.eq('status', input.status)
        if (input.health) q = q.eq('health_status', input.health)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data || data.length === 0) return 'No clients found.'
        const rows = data.map((c: { id: string; name: string; status: string; health_status: string; start_date: string }) =>
          `• "${c.name}" | ID: ${c.id} | Status: ${c.status} | Health: ${c.health_status} | Start: ${c.start_date ?? '?'}`
        ).join('\n')
        return `Found ${data.length} client(s):\n${rows}`
      }

      // ── query_meetings ─────────────────────────────────────────────────────
      case 'query_meetings': {
        let clientIds: string[] | null = null
        if (input.client_name) {
          const { data: cs } = await supabase.from('clients').select('id').ilike('name', `%${input.client_name}%`)
          clientIds = (cs ?? []).map((c: { id: string }) => c.id)
          if (clientIds!.length === 0) return `No client found matching "${input.client_name}".`
        }
        let q = supabase
          .from('meetings')
          .select('id, title, meeting_type, status, scheduled_at, meet_link, agenda, clients(name)')
          .order('scheduled_at', { ascending: true })
          .limit(Number(input.limit ?? 20))
        if (clientIds) q = q.in('client_id', clientIds)
        if (input.meeting_type) q = q.eq('meeting_type', input.meeting_type)
        if (input.status) q = q.eq('status', input.status)
        if (input.date) q = q.gte('scheduled_at', `${input.date}T00:00:00`).lte('scheduled_at', `${input.date}T23:59:59`)
        if (input.after_date) q = q.gte('scheduled_at', `${input.after_date}T00:00:00`)
        if (input.before_date) q = q.lte('scheduled_at', `${input.before_date}T23:59:59`)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data || data.length === 0) return 'No meetings found matching the criteria.'
        const rows = data.map((m: {
          id: string; title: string; meeting_type: string; status: string
          scheduled_at: string; clients: { name: string } | null
        }) => {
          const dt = m.scheduled_at
            ? new Date(m.scheduled_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' })
            : 'TBD'
          return `• ID: ${m.id} | "${m.title}" | Client: ${m.clients?.name ?? '?'} | Type: ${m.meeting_type} | Status: ${m.status} | When: ${dt} EST`
        }).join('\n')
        return `Found ${data.length} meeting(s):\n${rows}`
      }

      // ── query_blockers ─────────────────────────────────────────────────────
      case 'query_blockers': {
        let clientIds: string[] | null = null
        if (input.client_name) {
          const { data: cs } = await supabase.from('clients').select('id').ilike('name', `%${input.client_name}%`)
          clientIds = (cs ?? []).map((c: { id: string }) => c.id)
        }
        let q = supabase.from('blockers')
          .select('id, title, severity, status, created_at, clients(name)')
          .order('created_at', { ascending: false })
          .limit(Number(input.limit ?? 20))
        if (clientIds) q = q.in('client_id', clientIds)
        if (input.status) q = q.eq('status', input.status)
        if (input.severity) q = q.eq('severity', input.severity)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data || data.length === 0) return 'No blockers found.'
        const rows = data.map((b: {
          id: string; title: string; severity: string; status: string
          created_at: string; clients: { name: string } | null
        }) =>
          `• [${b.status}] "${b.title}" | Client: ${b.clients?.name ?? '?'} | Severity: ${b.severity} | Created: ${b.created_at.split('T')[0]}`
        ).join('\n')
        return `Found ${data.length} blocker(s):\n${rows}`
      }

      // ── add_task ───────────────────────────────────────────────────────────
      case 'add_task': {
        const { data, error } = await supabase.from('delivery_tasks').insert({
          client_id: input.client_id,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? 'Todo',
          step: input.step ?? 1,
          workstream: input.workstream ?? null,
          due_date: input.due_date ?? null,
          priority: input.priority ?? 'Medium',
        }).select('id, title').single()
        if (error) return `Error creating task: ${error.message}`
        return `Task created: "${data.title}" (ID: ${data.id})`
      }

      // ── update_meeting ─────────────────────────────────────────────────────
      case 'update_meeting': {
        const updates: Record<string, string> = {}
        if (input.agenda !== undefined) updates.agenda = input.agenda
        if (input.notes !== undefined) updates.notes = input.notes
        if (input.status !== undefined) updates.status = input.status
        const { error } = await supabase.from('meetings').update(updates).eq('id', input.meeting_id)
        if (error) return `Error updating meeting: ${error.message}`
        return `Meeting updated successfully.`
      }

      // ── add_blocker ────────────────────────────────────────────────────────
      case 'add_blocker': {
        const { data, error } = await supabase.from('blockers').insert({
          client_id: input.client_id,
          task_id: input.task_id ?? null,
          title: input.title,
          description: input.description ?? null,
          severity: input.severity ?? 'Medium',
          status: 'Open',
        }).select('id, title').single()
        if (error) return `Error creating blocker: ${error.message}`
        return `Blocker created: "${data.title}" (ID: ${data.id})`
      }

      // ── bulk_create_tasks ──────────────────────────────────────────────────
      case 'bulk_create_tasks': {
        const refDate = (input.reference_date as string) ?? new Date().toISOString().split('T')[0]
        const tasks = input.tasks as Array<{
          title: string; week: number; step?: number
          workstream?: string; description?: string; priority?: string
        }>
        const rows = tasks.map(t => ({
          client_id: input.client_id,
          title: t.title,
          description: t.description ?? null,
          status: 'Todo',
          step: t.step ?? 1,
          workstream: t.workstream ?? null,
          due_date: getWeekDueDate(t.week, refDate),
          priority: t.priority ?? 'Medium',
        }))
        const { data, error } = await supabase.from('delivery_tasks').insert(rows).select('id, title, due_date')
        if (error) return `Error creating tasks: ${error.message}`
        const created = (data ?? []).map((t: { title: string; due_date: string }) =>
          `• "${t.title}" — due ${t.due_date}`
        ).join('\n')
        return `Created ${(data ?? []).length} task(s):\n${created}`
      }

      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ── System prompt ──────────────────────────────────────────────────────────
function buildSystemPrompt(today: string, userName: string, userRole: string): string {
  return `You are an AI operations assistant for JZ Smart Media — a digital marketing agency's internal Operations Hub.
You help the team manage clients, tasks, meetings, and blockers through natural language.

Today's date: ${today} (America/New_York — EST)
Current user: ${userName} (${userRole})

## What you can do:
1. QUERY — Answer questions by searching tasks, clients, meetings, and blockers
2. ADD — Create tasks or blockers; update meeting agendas and notes
3. FLAG — When something the user described doesn't exist, alert them and show what DOES exist
4. ORGANIZE — When given a task list with Week 1/Week 2/etc., use bulk_create_tasks with correct dates

## Rules:
- Always query before creating/updating to verify existence and avoid duplicates
- For "today" queries: use date filter "${today}"
- When a meeting doesn't match the user's description (e.g., "the 3pm meeting" when there's only 2pm and 4pm): FLAG it clearly and list the actual meetings
- When you find what they're looking for: show it in a clean, organized format
- Keep responses concise — use bullet points and structure
- Never guess client IDs — always use query_clients first to get the real UUID
- For file uploads with Week 1/Week 2 tasks: use bulk_create_tasks with reference_date = today (${today})`
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const messages: Anthropic.MessageParam[] = body.messages ?? []
    const userName: string = body.user_name ?? 'Team Member'
    const userRole: string = body.user_role ?? 'team member'

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const today = new Date().toISOString().split('T')[0]
    const systemPrompt = buildSystemPrompt(today, userName, userRole)
    const toolsUsed: string[] = []

    // Agentic tool loop — max 10 iterations
    const history = [...messages]
    for (let i = 0; i < 10; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: systemPrompt,
        tools: TOOLS,
        messages: history,
      })

      // Push full content (preserves thinking blocks for subsequent turns)
      history.push({ role: 'assistant', content: response.content })

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
        return new Response(
          JSON.stringify({ content: text, toolsUsed }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Execute tool calls
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (toolUseBlocks.length === 0) break

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        if (!toolsUsed.includes(block.name)) toolsUsed.push(block.name)
        const result = await executeTool(block.name, block.input as Record<string, unknown>, sb)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      history.push({ role: 'user', content: toolResults })
    }

    return new Response(
      JSON.stringify({ content: 'I was unable to complete your request. Please try again.', toolsUsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('AI assistant error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
