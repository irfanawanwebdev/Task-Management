/**
 * useSessionTracker — records active time in user_sessions.
 *
 * On mount:  inserts a new session row with today's EST date.
 * Every 5m:  updates last_active_at + duration_minutes on the row.
 * On unload: fires a synchronous beacon to set ended_at.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayDateEST } from '@/lib/timezone'

const HEARTBEAT_MS = 5 * 60 * 1000   // 5 minutes

export function useSessionTracker(userId: string | undefined | null) {
  const sessionIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<Date>(new Date())

  useEffect(() => {
    if (!userId) return

    const today = todayDateEST()

    // Start session
    supabase
      .from('user_sessions')
      .insert({ user_id: userId, session_date: today } as never)
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) sessionIdRef.current = (data as { id: string }).id
      })

    // Heartbeat: update last_active_at + duration every 5 min
    const heartbeat = setInterval(async () => {
      const id = sessionIdRef.current
      if (!id) return
      const mins = Math.floor((Date.now() - startedAtRef.current.getTime()) / 60000)
      await supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString(), duration_minutes: mins } as never)
        .eq('id', id)
    }, HEARTBEAT_MS)

    // End session on tab close / navigation away
    const handleUnload = () => {
      const id = sessionIdRef.current
      if (!id) return
      const mins = Math.floor((Date.now() - startedAtRef.current.getTime()) / 60000)
      // sendBeacon so it fires even if page is closing
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${id}`
      navigator.sendBeacon(
        url,
        JSON.stringify({ ended_at: new Date().toISOString(), duration_minutes: mins }),
      )
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(heartbeat)
      window.removeEventListener('beforeunload', handleUnload)
      // Also end the session cleanly when the component unmounts (logout)
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
