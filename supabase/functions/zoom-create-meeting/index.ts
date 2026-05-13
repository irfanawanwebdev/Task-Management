/**
 * zoom-create-meeting
 * Creates a Zoom meeting using the stored S2S access token.
 * Returns { joinUrl } on success.
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
    if (userErr || !user) return ok({ error: 'Session expired. Please sign in again.' })

    // Get stored Zoom token for this user
    const { data: tokenRow } = await supabase
      .from('connector_tokens')
      .select('access_token, expires_at, account_email')
      .eq('user_id', user.id)
      .eq('connector_id', 'zoom')
      .maybeSingle()

    if (!tokenRow?.access_token) {
      return ok({ error: 'Zoom not connected. Connect Zoom in Settings first.' })
    }

    // Use the account email as the host userId so the meeting appears in their Zoom dashboard
    const hostId = tokenRow.account_email ?? 'me'

    const { title, date, time, agenda } = await req.json() as {
      title?: string
      date?: string
      time?: string
      agenda?: string
    }

    // Build start_time (Zoom expects ISO 8601)
    const startTime = date
      ? `${date}T${time ?? '10:00'}:00`
      : new Date().toISOString()

    const meetingPayload = {
      topic:      title ?? 'JZ Smart Media Meeting',
      type:       2, // scheduled meeting
      start_time: startTime,
      duration:   60,
      timezone:   'America/New_York',
      agenda:     agenda ?? '',
      settings: {
        host_video:      true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry:  false,
        waiting_room:     false,
      },
    }

    const zoomRes = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostId)}/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenRow.access_token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(meetingPayload),
    })

    const zoomData = await zoomRes.json()

    if (!zoomRes.ok) {
      console.error('Zoom create meeting error:', zoomData)
      return ok({ error: `Zoom error: ${zoomData.message ?? 'Failed to create meeting'}` })
    }

    return ok({ joinUrl: zoomData.join_url, meetingId: zoomData.id })

  } catch (err) {
    console.error('zoom-create-meeting error:', err)
    return ok({ error: `Unexpected error: ${String(err)}` })
  }
})
