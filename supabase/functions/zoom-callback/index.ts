/**
 * zoom-callback
 * Called by the React /zoom-callback page (NOT directly by Zoom).
 * Receives the OAuth code + state, exchanges for tokens, stores in connector_tokens.
 * Returns JSON { success: true } or { error: "..." }.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const code       = url.searchParams.get('code')
  const state      = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    return new Response(JSON.stringify({ error: 'oauth_denied' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!code || !state) {
    return new Response(JSON.stringify({ error: 'missing_params' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { user_id } = JSON.parse(atob(state)) as { user_id: string }

    const appUrl      = (Deno.env.get('APP_URL') ?? 'https://jzworkspace.com').replace(/\/$/, '')
    const redirectUri = `${appUrl}/zoom-callback`
    const clientId     = Deno.env.get('ZOOM_CLIENT_ID')!
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')!
    const basicAuth    = btoa(`${clientId}:${clientSecret}`)

    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokens = await tokenRes.json()

    if (tokens.error) {
      console.error('Zoom token exchange error:', tokens)
      return new Response(JSON.stringify({ error: 'token_exchange', detail: tokens.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let accountEmail: string | null = null
    try {
      const infoRes = await fetch('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const info = await infoRes.json()
      accountEmail = info.email ?? null
    } catch (_) { /* non-critical */ }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: upsertError } = await supabase
      .from('connector_tokens')
      .upsert({
        user_id,
        connector_id:  'zoom',
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        account_email: accountEmail,
        last_sync:     null,
      }, { onConflict: 'user_id,connector_id' })

    if (upsertError) {
      console.error('DB upsert error:', upsertError)
      return new Response(JSON.stringify({ error: 'db_error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, email: accountEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Zoom callback error:', err)
    return new Response(JSON.stringify({ error: 'unexpected', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
