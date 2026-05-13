/**
 * zoom-delete-meeting
 * Deletes a Zoom meeting by ID using the stored S2S access token.
 * Called when a meeting is deleted from the app.
 * Always returns HTTP 200 with { success } or { error } in the body.
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
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) return ok({ error: 'Unauthorized' })

    const { meetingId } = await req.json() as { meetingId: string }
    if (!meetingId) return ok({ error: 'meetingId is required' })

    // Get stored Zoom token
    const { data: tokenRow } = await supabase
      .from('connector_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('connector_id', 'zoom')
      .maybeSingle()

    if (!tokenRow?.access_token) {
      return ok({ error: 'Zoom not connected' })
    }

    const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenRow.access_token}` },
    })

    // 204 = deleted, 404 = already gone — both are fine
    if (res.status === 204 || res.status === 404) {
      return ok({ success: true })
    }

    const body = await res.json().catch(() => ({}))
    return ok({ error: `Zoom API error: ${(body as { message?: string }).message ?? res.status}` })

  } catch (err) {
    console.error('zoom-delete-meeting error:', err)
    return ok({ error: String(err) })
  }
})
