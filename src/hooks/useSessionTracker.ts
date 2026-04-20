/**
 * useSessionTracker — records ACTIVE time in user_sessions.
 *
 * "Active" means the user interacted with the app (mouse/key/scroll/touch)
 * within the last IDLE_TIMEOUT_MS and the machine was not sleeping.
 *
 * Counting method: each heartbeat tick that passes both checks increments
 * activeMinutes by 1. Wall-clock elapsed time is NOT used — this prevents
 * hibernate/sleep/forgotten-tab from inflating the count.
 *
 * Sleep detection: if the interval fires much later than expected (gap >
 * SLEEP_GAP_MS), the machine was suspended — that tick is skipped.
 *
 * Multi-tab: leader election via localStorage ensures only one tab tracks
 * per user at a time. Lock TTL = 90 s; a crashed tab's lock expires safely.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayDateEST } from '@/lib/timezone'

const HEARTBEAT_MS   = 60 * 1000        // check every 1 minute
const IDLE_TIMEOUT_MS = 15 * 60 * 1000  // 15 min no interaction = idle
const SLEEP_GAP_MS   = 90 * 1000        // heartbeat gap > 90 s = machine slept
const LOCK_TTL_MS    = 90 * 1000        // leader lock TTL

// ── Leader election ──────────────────────────────────────────────────────────

function leaderKey(userId: string) { return `tracker_leader_${userId}` }
interface LockEntry { tabId: string; claimedAt: number }

function claimLeader(userId: string, tabId: string) {
  localStorage.setItem(leaderKey(userId), JSON.stringify({ tabId, claimedAt: Date.now() } satisfies LockEntry))
}

function tryClaimOrSkip(userId: string, tabId: string): boolean {
  try {
    const raw = localStorage.getItem(leaderKey(userId))
    if (!raw) { claimLeader(userId, tabId); return true }
    const lock: LockEntry = JSON.parse(raw)
    if (lock.tabId === tabId) { claimLeader(userId, tabId); return true }
    if (Date.now() - lock.claimedAt > LOCK_TTL_MS) { claimLeader(userId, tabId); return true }
    return false
  } catch { claimLeader(userId, tabId); return true }
}

function releaseLeader(userId: string, tabId: string) {
  try {
    const raw = localStorage.getItem(leaderKey(userId))
    if (!raw) return
    const lock: LockEntry = JSON.parse(raw)
    if (lock.tabId === tabId) localStorage.removeItem(leaderKey(userId))
  } catch { /* ignore */ }
}

const TAB_ID = Math.random().toString(36).slice(2)

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSessionTracker(userId: string | undefined | null) {
  const sessionIdRef      = useRef<string | null>(null)
  const activeMinutesRef  = useRef(0)
  const lastActivityRef   = useRef(Date.now())
  const lastHeartbeatRef  = useRef(Date.now())

  useEffect(() => {
    if (!userId) return

    const today = todayDateEST()

    if (!tryClaimOrSkip(userId, TAB_ID)) return

    // ── Track user activity ────────────────────────────────────────────────────
    const onActivity = () => { lastActivityRef.current = Date.now() }
    const opts = { passive: true } as const
    window.addEventListener('mousemove', onActivity, opts)
    window.addEventListener('keydown',   onActivity, opts)
    window.addEventListener('click',     onActivity, opts)
    window.addEventListener('scroll',    onActivity, opts)
    window.addEventListener('touchstart',onActivity, opts)

    // ── Start session ──────────────────────────────────────────────────────────
    supabase
      .from('user_sessions')
      .insert({ user_id: userId, session_date: today } as never)
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) sessionIdRef.current = (data as { id: string }).id
      })

    // ── Heartbeat every 1 minute ───────────────────────────────────────────────
    const heartbeat = setInterval(async () => {
      if (!tryClaimOrSkip(userId, TAB_ID)) return

      const now = Date.now()
      const gap = now - lastHeartbeatRef.current
      lastHeartbeatRef.current = now

      // Machine was sleeping — gap much larger than expected interval
      if (gap > SLEEP_GAP_MS) return

      // User has been idle too long
      if (now - lastActivityRef.current > IDLE_TIMEOUT_MS) return

      const id = sessionIdRef.current
      if (!id) return

      activeMinutesRef.current += 1

      await supabase
        .from('user_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          duration_minutes: activeMinutesRef.current,
        } as never)
        .eq('id', id)
    }, HEARTBEAT_MS)

    // ── End session on tab close ───────────────────────────────────────────────
    const handleUnload = () => {
      releaseLeader(userId, TAB_ID)
      const id = sessionIdRef.current
      if (!id) return
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${id}`
      navigator.sendBeacon(
        url,
        JSON.stringify({ ended_at: new Date().toISOString(), duration_minutes: activeMinutesRef.current }),
      )
    }
    window.addEventListener('beforeunload', handleUnload)

    // ── Cleanup ────────────────────────────────────────────────────────────────
    return () => {
      clearInterval(heartbeat)
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('mousemove',  onActivity)
      window.removeEventListener('keydown',    onActivity)
      window.removeEventListener('click',      onActivity)
      window.removeEventListener('scroll',     onActivity)
      window.removeEventListener('touchstart', onActivity)
      releaseLeader(userId, TAB_ID)
      const id = sessionIdRef.current
      if (id) {
        supabase
          .from('user_sessions')
          .update({ ended_at: new Date().toISOString(), duration_minutes: activeMinutesRef.current } as never)
          .eq('id', id)
      }
    }
  }, [userId])
}
