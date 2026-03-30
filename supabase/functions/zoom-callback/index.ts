/**
 * zoom-callback
 * Receives the OAuth code from Zoom, exchanges it for tokens,
 * stores them in connector_tokens, then redirects back to the app.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code       = url.searchParams.get('code')
  const state      = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  if (oauthError) {
    return Response.redirect(`${appUrl}/settings?error=oauth_denied`, 302)
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}/settings?error=missing_params`, 302)
  }

  try {
    const { user_id } = JSON.parse(atob(state)) as { user_id: string }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zoom-callback`
    const clientId     = Deno.env.get('ZOOM_CLIENT_ID')!
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')!

    // Zoom requires Basic auth (base64 clientId:clientSecret) for token exchange
    const basicAuth = btoa(`${clientId}:${clientSecret}`)

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
      return Response.redirect(`${appUrl}/settings?error=token_exchange`, 302)
    }

    // Fetch Zoom user info for display (email)
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
      return Response.redirect(`${appUrl}/settings?error=db_error`, 302)
    }

    return Response.redirect(`${appUrl}/settings?connected=zoom`, 302)

  } catch (err) {
    console.error('Zoom callback error:', err)
    return Response.redirect(`${appUrl}/settings?error=unexpected`, 302)
  }
})
