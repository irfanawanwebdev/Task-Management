/**
 * zoom-auth
 * Returns the Zoom OAuth consent URL for the calling user.
 * Frontend navigates to the returned URL → Zoom redirects to zoom-callback.
 */

// @ts-types="https://esm.sh/@supabase/supabase-js@2/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const SCOPES = 'meeting:read:list_meetings meeting:write:meeting user:read:email'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    let userId: string | null = null

    // 1. Try JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) userId = user.id
    }

    // 2. Fall back to ?user_id query param
    if (!userId) userId = url.searchParams.get('user_id')

    // Use APP_URL proxy so the redirect URI is on your own verified domain
    // e.g. https://ops.jzsmartmedia.com/functions/zoom-callback
    const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('SUPABASE_URL')
    const redirectUri = `${appUrl}/functions/zoom-callback`
    const state = btoa(JSON.stringify({ user_id: userId, ts: Date.now() }))

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: Deno.env.get('ZOOM_CLIENT_ID')!,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
    })

    const authUrl = `https://zoom.us/oauth/authorize?${params}`

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
