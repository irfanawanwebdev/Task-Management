/**
 * zoom-auth  (Server-to-Server OAuth)
 * Always returns HTTP 200 — errors are in the JSON body { error, detail }.
 * This lets the Supabase client surface the actual error message to the frontend.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Identify the calling user from their JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) {
      return ok({ error: 'Session expired. Please sign out and back in.' })
    }

    const accountId    = Deno.env.get('ZOOM_ACCOUNT_ID')
    const clientId     = Deno.env.get('ZOOM_CLIENT_ID')
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')

    if (!accountId || !clientId || !clientSecret) {
      return ok({ error: 'Zoom secrets missing. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET in Supabase.' })
    }

    // Exchange account credentials for access token (S2S OAuth)
    const basicAuth = btoa(`${clientId}:${clientSecret}`)
    const tokenRes  = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}` },
      }
    )

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error) {
      console.error('Zoom S2S token error:', tokenData)
      return ok({ error: `Zoom rejected the credentials: ${tokenData.reason ?? tokenData.error ?? 'unknown'}` })
    }

    // Fetch account email for display
    let accountEmail: string | null = null
    try {
      const meRes = await fetch('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const me = await meRes.json()
      accountEmail = me.email ?? null
    } catch (_) { /* non-critical */ }

    // Store token in connector_tokens
    const { error: upsertErr } = await supabase
      .from('connector_tokens')
      .upsert({
        user_id:       user.id,
        connector_id:  'zoom',
        access_token:  tokenData.access_token,
        refresh_token: null,
        expires_at:    new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
        account_email: accountEmail,
        last_sync:     null,
      }, { onConflict: 'user_id,connector_id' })

    if (upsertErr) {
      console.error('DB upsert error:', upsertErr)
      return ok({ error: `Database error: ${upsertErr.message}` })
    }

    return ok({ success: true, email: accountEmail })

  } catch (err) {
    console.error('zoom-auth error:', err)
    return ok({ error: `Unexpected error: ${String(err)}` })
  }
})
