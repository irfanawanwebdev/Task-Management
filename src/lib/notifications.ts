/**
 * Notification types and React Query hooks for the in-app notification feed.
 * The notifications table is populated by the send-reminders Edge Function.
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type NotificationType =
  | 'overdue_task'
  | 'upcoming_meeting'
  | 'report_due'
  | 'blocker_aged'
  | 'meeting_generated'
  | 'report_compiled'
  | 'personal_task_due'
  | 'task_deadline_approaching'
  | 'note_edit_request'

export interface Notification {
  id:         string
  user_id:    string
  type:       NotificationType
  title:      string
  message:    string
  link?:      string | null
  is_read:    boolean
  created_at: string
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const NOTIFICATIONS_KEY = ['notifications'] as const

// ─── Fetch hook ───────────────────────────────────────────────────────────────

export function useNotifications() {
  const qc = useQueryClient()

  const query = useQuery<Notification[]>({
    queryKey: NOTIFICATIONS_KEY,
    queryFn:  async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []) as Notification[]
    },
  })

  // ── Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => { qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [qc])

  return query
}

// ─── Unread count hook ────────────────────────────────────────────────────────

export function useUnreadCount() {
  const { data = [] } = useNotifications()
  return data.filter(n => !n.is_read).length
}

// ─── Mark as read ─────────────────────────────────────────────────────────────

export async function markNotificationRead(id: string) {
  await supabase
    .from('notifications')
    .update({ is_read: true } as never)
    .eq('id', id)
}

export async function markAllRead() {
  await supabase
    .from('notifications')
    .update({ is_read: true } as never)
    .eq('is_read', false)
}
