/**
 * create-user — Supabase Edge Function
 *
 * Creates a new team member: Supabase Auth user + profile row + role assignments.
 * Caller must be authenticated and have can_create_users = true in their profile.
 *
 * POST body: { email, password, full_name, department?, roles: string[], page_access?: string[], can_create_users?: boolean }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Extract user ID from JWT (already verified by Supabase gateway) ─
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    let callerId: string
    try {
      // JWT uses base64url — convert to standard base64 before atob
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
      const payload = JSON.parse(atob(padded))
      callerId = payload.sub
      if (!callerId) throw new Error('No sub')
    } catch {
      return json({ error: 'Invalid token' }, 401)
    }

    // ── 2. Admin client (service role bypasses RLS) ───────────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── 3. Verify caller has can_create_users permission ──────────────────
    const { data: callerProfile, error: profileCheckError } = await adminClient
      .from('profiles')
      .select('can_create_users')
      .eq('user_id', callerId)
      .single()

    if (profileCheckError) {
      return json({ error: `Permission check failed: ${profileCheckError.message}` }, 500)
    }

    if (!callerProfile?.can_create_users) {
      return json({ error: 'Insufficient permissions. User creation is not enabled for your account.' }, 403)
    }

    // ── 4. Parse and validate request body ────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'Invalid JSON body' }, 400)

    const { email, password, full_name, department = null, roles, page_access = [], can_create_users = false } = body

    if (!email || !password || !full_name) {
      return json({ error: 'Missing required fields: email, password, full_name' }, 400)
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      return json({ error: 'roles must be a non-empty array' }, 400)
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // ── 5. Create auth user ───────────────────────────────────────────────
    const { data: { user: newUser }, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (createError || !newUser) {
      return json({ error: createError?.message ?? 'Failed to create auth user' }, 400)
    }

    // ── 6. Insert profile ─────────────────────────────────────────────────
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id:          newUser.id,
        full_name,
        department:       department ?? null,
        is_active:        true,
        page_access:      Array.isArray(page_access) ? page_access : [],
        can_create_users: can_create_users === true,
      })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUser.id)
      return json({ error: `Failed to create profile: ${profileError.message}` }, 500)
    }

    // ── 7. Insert roles ───────────────────────────────────────────────────
    const roleRows = roles.map((role: string) => ({ user_id: newUser.id, role }))
    const { error: rolesInsertError } = await adminClient.from('user_roles').insert(roleRows)

    if (rolesInsertError) {
      await adminClient.auth.admin.deleteUser(newUser.id)
      return json({ error: `Failed to assign roles: ${rolesInsertError.message}` }, 500)
    }

    return json({ success: true, user_id: newUser.id }, 200)

  } catch (err) {
    console.error('create-user error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
