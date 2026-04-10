/**
 * send-daily-report — Supabase Edge Function
 *
 * Accepts a prebuilt HTML report string and sends it as an email
 * to the specified recipient(s) via Resend.
 *
 * Required env vars (set in Supabase Dashboard → Settings → Edge Functions):
 *   RESEND_API_KEY   — Resend API key (https://resend.com)
 *   FROM_EMAIL       — verified sender address (e.g. "ops@jzsmartmedia.com")
 *
 * POST body (JSON):
 *   {
 *     to:       string | string[]   // recipient email(s)
 *     subject:  string              // email subject
 *     html:     string              // full HTML report content
 *   }
 */

// @ts-nocheck — Deno runtime types are not available in the project tsconfig
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const { to, subject, html } = await req.json() as {
      to: string | string[]
      subject: string
      html: string
    }

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')?.trim()
    const fromEmail = (Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev').trim()

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    console.log('Sending via Resend from:', fromEmail, 'to:', to)
    console.log('API key prefix:', apiKey.slice(0, 8) + '…')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `JZ Smart Media Ops <${fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error status:', res.status)
      console.error('Resend error body:', JSON.stringify(data))
      // Return the full Resend error so it's visible in the UI
      const detail = data?.message ?? data?.name ?? JSON.stringify(data)
      return new Response(JSON.stringify({ error: `Resend ${res.status}: ${detail}` }), {
        status: 200, // return 200 so the frontend can read the error message
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-daily-report error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
