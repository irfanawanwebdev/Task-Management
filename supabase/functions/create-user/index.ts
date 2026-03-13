/**
 * create-user — Supabase Edge Function
 *
 * Creates a new team member: Supabase Auth user + profile row + role assignments.
 * Caller must be authenticated as owner or project_manager.
 * Uses the service_role key to bypass RLS for the inserts.
 *
 * POST body: { email, password, full_name, department?, roles: string[] }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Verify caller is authenticated ─────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── 2. Verify caller is owner or project_manager ───────────────────────
    const { data: callerRoles, error: rolesError } = await callerClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)

    if (rolesError) {
      return json({ error: 'Failed to verify caller role' }, 500)
    }

    const allowed = ['owner', 'project_manager']
    const hasPermission = (callerRoles ?? []).some((r: { role: string }) =>
      allowed.includes(r.role)
    )

    if (!hasPermission) {
      return json({ error: 'Insufficient permissions. Requires owner or project_manager role.' }, 403)
    }

    // ── 3. Parse and validate request body ────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const { email, password, full_name, department = null, roles } = body

    if (!email || !password || !full_name) {
      return json({ error: 'Missing required fields: email, password, full_name' }, 400)
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      return json({ error: 'roles must be a non-empty array' }, 400)
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // ── 4. Create auth user via Admin API (service_role) ──────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user: newUser }, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,  // skip email verification for internal users
      })

    if (createError || !newUser) {
      return json({ error: createError?.message ?? 'Failed to create auth user' }, 400)
    }

    // ── 5. Insert profile ─────────────────────────────────────────────────
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id:    newUser.id,
        full_name,
        department: department ?? null,
        is_active:  true,
      })

    if (profileError) {
      // Rollback: delete the auth user so we don't leave orphaned accounts
      await adminClient.auth.admin.deleteUser(newUser.id)
      return json({ error: `Failed to create profile: ${profileError.message}` }, 500)
    }

    // ── 6. Insert roles ───────────────────────────────────────────────────
    const roleRows = roles.map((role: string) => ({ user_id: newUser.id, role }))

    const { error: rolesInsertError } = await adminClient
      .from('user_roles')
      .insert(roleRows)

    if (rolesInsertError) {
      // Rollback
      await adminClient.auth.admin.deleteUser(newUser.id)
      return json({ error: `Failed to assign roles: ${rolesInsertError.message}` }, 500)
    }

    // ── 7. Return success ─────────────────────────────────────────────────
    return json({ success: true, user_id: newUser.id }, 200)

  } catch (err) {
    console.error('create-user error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
