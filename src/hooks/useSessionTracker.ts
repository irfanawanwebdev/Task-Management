/**
 * useSessionTracker — records active time in user_sessions.
 *
 * On mount:    inserts a new session row with today's EST date.
 * Every 1 min: updates last_active_at + duration_minutes.
 *              Runs as long as the tab is open — foreground or background.
 * On unload:   fires a synchronous beacon to write the final duration.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayDateEST } from '@/lib/timezone'

const HEARTBEAT_MS = 60 * 1000   // 1 minute

export function useSessionTracker(userId: string | undefined | null) {
  const sessionIdRef  = useRef<string | null>(null)
  const startedAtRef  = useRef<Date>(new Date())

  useEffect(() => {
    if (!userId) return

    const today = todayDateEST()

    // ── Start session ──────────────────────────────────────────────────────────
    supabase
      .from('user_sessions')
      .insert({ user_id: userId, session_date: today } as never)
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) sessionIdRef.current = (data as { id: string }).id
      })

    // ── Heartbeat every 1 minute (runs whether tab is focused or in background) ─
    const heartbeat = setInterval(async () => {
      const id = sessionIdRef.current
      if (!id) return
      const mins = Math.floor((Date.now() - startedAtRef.current.getTime()) / 60000)
      await supabase
        .from('user_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          duration_minutes: mins,
        } as never)
        .eq('id', id)
    }, HEARTBEAT_MS)

    // ── End session on tab close ───────────────────────────────────────────────
    const handleUnload = () => {
      const id = sessionIdRef.current
      if (!id) return
      const mins = Math.floor((Date.now() - startedAtRef.current.getTime()) / 60000)
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${id}`
      navigator.sendBeacon(
        url,
        JSON.stringify({ ended_at: new Date().toISOString(), duration_minutes: mins }),
      )
    }
    window.addEventListener('beforeunload', handleUnload)

    // ── Cleanup on logout / unmount ────────────────────────────────────────────
    return () => {
      clearInterval(heartbeat)
      window.removeEventListener('beforeunload', handleUnload)
      const id = sessionIdRef.current
      if (id) {
        const mins = Math.floor((Date.now() - startedAtRef.current.getTime()) / 60000)
        supabase
          .from('user_sessions')
          .update({ ended_at: new Date().toISOString(), duration_minutes: mins } as never)
          .eq('id', id)
      }
    }
  }, [userId])
}
