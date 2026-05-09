/**
 * ZoomCallbackPage — /zoom-callback
 * Zoom redirects here after OAuth consent with ?code=...&state=...
 * Calls the zoom-callback edge function, then navigates to /settings.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function ZoomCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const called = useRef(false)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code       = searchParams.get('code')
    const state      = searchParams.get('state')
    const oauthError = searchParams.get('error')

    if (oauthError) {
      setStatus('error')
      setMessage('Zoom authorization was denied.')
      setTimeout(() => navigate('/settings?error=oauth_denied'), 2500)
      return
    }

    if (!code || !state) {
      setStatus('error')
      setMessage('Missing OAuth parameters.')
      setTimeout(() => navigate('/settings?error=missing_params'), 2500)
      return
    }

    async function exchange() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string
        const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

        const res = await fetch(
          `${supabaseUrl}/functions/v1/zoom-callback?code=${encodeURIComponent(code!)}&state=${encodeURIComponent(state!)}`,
          {
            headers: {
              'Authorization': `Bearer ${session?.access_token ?? supabaseAnon}`,
              'apikey': supabaseAnon,
            },
          }
        )

        const json = await res.json() as { success?: boolean; error?: string }

        if (!res.ok || json.error) {
          setStatus('error')
          setMessage('Failed to connect Zoom. Please try again.')
          setTimeout(() => navigate('/settings?error=zoom_failed'), 2500)
        } else {
          setStatus('success')
          setMessage('Zoom connected!')
          setTimeout(() => navigate('/settings?connected=zoom'), 1500)
        }
      } catch {
        setStatus('error')
        setMessage('Unexpected error. Please try again.')
        setTimeout(() => navigate('/settings?error=unexpected'), 2500)
      }
    }

    exchange()
  }, []) // intentionally empty — runs once on mount

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Connecting your Zoom account…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm text-emerald-500 font-medium">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecting to Settings…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecting back…</p>
          </>
        )}
      </div>
    </div>
  )
}
