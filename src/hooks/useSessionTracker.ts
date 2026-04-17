/**
 * useSessionTracker — records active time in user_sessions.
 *
 * On mount:    inserts a new session row with today's EST date.
 * Every 1 min: updates last_active_at + duration_minutes.
 *              Only the "leader" tab tracks — other tabs with the same user
 *              skip heartbeats to prevent double-counting when the app is
 *              open in multiple browsers/tabs simultaneously.
 * On unload:   fires a synchronous beacon to write the final duration.
 *
 * Leader election uses localStorage with a 90-second expiry lock.
 * If the leader tab closes without releasing the lock, the next heartbeat
 * from any remaining tab will reclaim it after 90 s.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayDateEST } from '@/lib/timezone'

const HEARTBEAT_MS  = 60 * 1000   // 1 minute
const LOCK_TTL_MS   = 90 * 1000   // lock expires after 90 s (1.5 × heartbeat)

function leaderKey(userId: string) { return `tracker_leader_${userId}` }

interface LockEntry { tabId: string; claimedAt: number }

function isLeader(userId: string, tabId: string): boolean {
  try {
    const raw = localStorage.getItem(leaderKey(userId))
    if (!raw) return false
    const lock: LockEntry = JSON.parse(raw)
    return lock.tabId === tabId
  } catch { return false }
}

function claimLeader(userId: string, tabId: string) {
  const entry: LockEntry = { tabId, claimedAt: Date.now() }
  localStorage.setItem(leaderKey(userId), JSON.stringify(entry))
}

function tryClaimOrSkip(userId: string, tabId: string): boolean {
  try {
    const raw = localStorage.getItem(leaderKey(userId))
    if (!raw) { claimLeader(userId, tabId); return true }
    const lock: LockEntry = JSON.parse(raw)
    // Already the leader — refresh timestamp
    if (lock.tabId === tabId) { claimLeader(userId, tabId); return true }
    // Another tab holds the lock; take over only if it's stale
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

// Stable per-tab ID (survives re-renders, cleared on tab close)
const TAB_ID = Math.random().toString(36).slice(2)

const HEARTBEAT_MS_EXPORT = HEARTBEAT_MS

export function useSessionTracker(userId: string | undefined | null) {
  const sessionIdRef  = useRef<string | null>(null)
  const startedAtRef  = useRef<Date>(new Date())

  useEffect(() => {
    if (!userId) return

    const today = todayDateEST()

    // Try to become the leader before starting a session
    const amLeader = tryClaimOrSkip(userId, TAB_ID)
    if (!amLeader) return   // another tab is already tracking this user

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
      // Re-check leadership each tick (another tab could have stolen it)
      if (!tryClaimOrSkip(userId, TAB_ID)) return
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
    }, HEARTBEAT_MS_EXPORT)

    // ── End session on tab close ───────────────────────────────────────────────
    const handleUnload = () => {
      releaseLeader(userId, TAB_ID)
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
      releaseLeader(userId, TAB_ID)
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
