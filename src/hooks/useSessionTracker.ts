/**
 * useSessionTracker — records active (visible) time in user_sessions.
 *
 * On mount:      inserts a new session row with today's EST date.
 * Every 1 min:   updates last_active_at + duration_minutes — only counts
 *                time while the browser tab is VISIBLE (Page Visibility API).
 *                If you switch tabs or minimise the browser, the clock pauses.
 * On unload:     fires a synchronous beacon to write the final duration.
 *
 * Note: when the tab is fully closed (not just hidden) tracking stops.
 * This is a browser constraint — JavaScript cannot run without an open tab.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayDateEST } from '@/lib/timezone'

const HEARTBEAT_MS = 60 * 1000   // 1 minute

export function useSessionTracker(userId: string | undefined | null) {
  const sessionIdRef    = useRef<string | null>(null)
  // Total active minutes accumulated so far
  const activeMinsRef   = useRef<number>(0)
  // Timestamp when the tab last became visible (null = currently hidden)
  const visibleSinceRef = useRef<Date | null>(null)

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

    // Start counting immediately if the tab is visible on mount
    if (!document.hidden) {
      visibleSinceRef.current = new Date()
    }

    // ── Page Visibility: pause/resume clock ───────────────────────────────────
    const handleVisibility = () => {
      if (document.hidden) {
        // Tab went into background — bank accumulated minutes
        if (visibleSinceRef.current) {
          const elapsed = Math.floor((Date.now() - visibleSinceRef.current.getTime()) / 60000)
          activeMinsRef.current += elapsed
          visibleSinceRef.current = null
        }
      } else {
        // Tab came back into view — restart the visible timer
        visibleSinceRef.current = new Date()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // ── Helper: current total active minutes ──────────────────────────────────
    const totalActiveMins = () => {
      let total = activeMinsRef.current
      if (visibleSinceRef.current) {
        total += Math.floor((Date.now() - visibleSinceRef.current.getTime()) / 60000)
      }
      return total
    }

    // ── Heartbeat every 1 minute ──────────────────────────────────────────────
    const heartbeat = setInterval(async () => {
      const id = sessionIdRef.current
      if (!id) return
      await supabase
        .from('user_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          duration_minutes: totalActiveMins(),
        } as never)
        .eq('id', id)
    }, HEARTBEAT_MS)

    // ── End session on tab close ───────────────────────────────────────────────
    const handleUnload = () => {
      const id = sessionIdRef.current
      if (!id) return
      // Bank any remaining visible time
      if (visibleSinceRef.current) {
        const elapsed = Math.floor((Date.now() - visibleSinceRef.current.getTime()) / 60000)
        activeMinsRef.current += elapsed
        visibleSinceRef.current = null
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${id}`
      navigator.sendBeacon(
        url,
        JSON.stringify({
          ended_at: new Date().toISOString(),
          duration_minutes: activeMinsRef.current,
        }),
      )
    }
    window.addEventListener('beforeunload', handleUnload)

    // ── Cleanup on logout / component unmount ─────────────────────────────────
    return () => {
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleUnload)
      const id = sessionIdRef.current
      if (id) {
        if (visibleSinceRef.current) {
          const elapsed = Math.floor((Date.now() - visibleSinceRef.current.getTime()) / 60000)
          activeMinsRef.current += elapsed
        }
        supabase
          .from('user_sessions')
          .update({
            ended_at: new Date().toISOString(),
            duration_minutes: activeMinsRef.current,
          } as never)
          .eq('id', id)
      }
    }
  }, [userId])
}
