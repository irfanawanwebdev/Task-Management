/**
 * reset-user-password - Supabase Edge Function
 *
 * Lets an authorized admin set a new password for any team member directly,
 * without requiring an email reset flow.
 * Caller must be authenticated and have owner or project_manager role,
 * or belong to the operations department.
 *
 * POST body: { user_id: string, password: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Caller client — verifies JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401)

    // Admin client — service role, bypasses RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller has permission
    const [{ data: callerProfile }, { data: callerRoles }] = await Promise.all([
      adminClient.from('profiles').select('department').eq('user_id', caller.id).single(),
      adminClient.from('user_roles').select('role').eq('user_id', caller.id),
    ])

    const roles = ((callerRoles ?? []) as { role: string }[]).map(r => r.role)
    const hasPermission =
      roles.includes('owner') ||
      roles.includes('project_manager') ||
      (callerProfile as { department?: string } | null)?.department === 'operations'

    if (!hasPermission) return json({ error: 'Insufficient permissions' }, 403)

    const { user_id, password } = await req.json() as { user_id?: string; password?: string }
    if (!user_id)  return json({ error: 'user_id is required' }, 400)
    if (!password) return json({ error: 'password is required' }, 400)
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, { password })
    if (updateErr) throw updateErr

    return json({ success: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
