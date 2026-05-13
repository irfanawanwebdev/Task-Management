// Edge Function: create-calendar-event
// Creates a Google Calendar event with a Google Meet link for a scheduled meeting.
// Reads the PM's access token from connector_tokens, refreshes if expired.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Request body ──────────────────────────────────────────────────────────
    const { title, date, time, agenda, timezone = 'America/New_York', meetingLink } = await req.json()
    if (!title || !date) {
      return new Response(JSON.stringify({ error: 'title and date are required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Get Google token from connector_tokens ────────────────────────────────
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('connector_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('connector_id', 'google-calendar')
      .single()

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: 'Google Calendar not connected' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Refresh token if expired ──────────────────────────────────────────────
    let accessToken = tokenRow.access_token
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) <= new Date()) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: tokenRow.refresh_token,
          grant_type:    'refresh_token',
        }),
      })
      const refreshData = await refreshRes.json()
      if (!refreshRes.ok || !refreshData.access_token) {
        return new Response(JSON.stringify({ error: 'Failed to refresh Google token. Please reconnect Google Calendar.' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      accessToken = refreshData.access_token
      // Persist refreshed token
      await supabase
        .from('connector_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        } as never)
        .eq('user_id', user.id)
        .eq('connector_id', 'google-calendar')
    }

    // ── Build calendar event ──────────────────────────────────────────────────
    const startTime = time || '09:00'
    const startDateTime = `${date}T${startTime}:00`
    // Default 1-hour duration
    const [h, m] = startTime.split(':').map(Number)
    const endHour = String(h + 1).padStart(2, '0')
    const endDateTime = `${date}T${endHour}:${String(m).padStart(2, '0')}:00`

    // If a Zoom link is supplied, embed it as a conference entry instead of generating Meet
    const event = meetingLink ? {
      summary: title,
      description: `${agenda || ''}\n\nJoin Zoom: ${meetingLink}`.trim(),
      start: { dateTime: startDateTime, timeZone: timezone },
      end:   { dateTime: endDateTime,   timeZone: timezone },
      location: meetingLink,
    } : {
      summary: title,
      description: agenda || '',
      start: { dateTime: startDateTime, timeZone: timezone },
      end:   { dateTime: endDateTime,   timeZone: timezone },
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }

    // ── Create event in Google Calendar ──────────────────────────────────────
    const calendarUrl = meetingLink
      ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1'

    const calRes = await fetch(calendarUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    const calData = await calRes.json()
    if (!calRes.ok) {
      return new Response(JSON.stringify({ error: calData.error?.message || 'Failed to create calendar event' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // For Zoom events, return the passed-in link; for Google Meet, extract from conference data
    const generatedMeetLink = meetingLink ?? (calData.conferenceData?.entryPoints?.find(
      (e: { entryPointType: string; uri: string }) => e.entryPointType === 'video'
    )?.uri ?? null)

    return new Response(
      JSON.stringify({
        calendarEventId:   calData.id,
        calendarEventLink: calData.htmlLink,
        meetLink:          generatedMeetLink,
      }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
