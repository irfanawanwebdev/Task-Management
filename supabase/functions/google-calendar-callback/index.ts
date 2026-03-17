/**
 * google-calendar-callback
 * Receives the OAuth code from Google, exchanges it for tokens,
 * stores them in connector_tokens, then redirects back to the app.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  // User denied permission or Google returned an error
  if (oauthError) {
    return Response.redirect(`${appUrl}/settings?error=oauth_denied`, 302)
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}/settings?error=missing_params`, 302)
  }

  try {
    // Decode state to get the user_id
    const { user_id } = JSON.parse(atob(state)) as { user_id: string }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-callback`

    // Exchange auth code for access + refresh tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()

    if (tokens.error) {
      console.error('Token exchange error:', tokens)
      return Response.redirect(`${appUrl}/settings?error=token_exchange`, 302)
    }

    // Fetch the user's Google email for display
    let accountEmail: string | null = null
    try {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const info = await infoRes.json()
      accountEmail = info.email ?? null
    } catch (_) { /* non-critical */ }

    // Store tokens in connector_tokens (upsert so reconnecting overwrites old tokens)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: upsertError } = await supabase
      .from('connector_tokens')
      .upsert({
        user_id,
        connector_id:  'google-calendar',
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

    // Success — redirect back to settings with connected flag
    return Response.redirect(`${appUrl}/settings?connected=google-calendar`, 302)

  } catch (err) {
    console.error('Callback error:', err)
    return Response.redirect(`${appUrl}/settings?error=unexpected`, 302)
  }
})
