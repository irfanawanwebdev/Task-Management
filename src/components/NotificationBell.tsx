/**
 * NotificationBell — in-app notification feed
 * Shows unread count badge on bell icon; click opens a dropdown list.
 * Notifications are populated by the send-reminders Edge Function (daily cron).
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, AlertTriangle, Calendar, FileText, ShieldAlert, Zap, Loader2, ListTodo, Clock, PenLine } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useNotifications, useUnreadCount, markNotificationRead, markAllRead,
  NOTIFICATIONS_KEY, type Notification, type NotificationType,
} from '@/lib/notifications'
import { cn } from '@/lib/utils'

// ─── Icon map per notification type ──────────────────────────────────────────

function NotifIcon({ type }: { type: NotificationType }) {
  const cls = 'h-3.5 w-3.5 shrink-0 mt-0.5'
  switch (type) {
    case 'overdue_task':       return <AlertTriangle className={cn(cls, 'text-destructive')} />
    case 'upcoming_meeting':   return <Calendar      className={cn(cls, 'text-blue-500')} />
    case 'report_due':         return <FileText      className={cn(cls, 'text-amber-500')} />
    case 'blocker_aged':       return <ShieldAlert   className={cn(cls, 'text-orange-500')} />
    case 'meeting_generated':         return <Zap      className={cn(cls, 'text-green-500')} />
    case 'report_compiled':           return <CheckCheck className={cn(cls, 'text-primary')} />
    case 'personal_task_due':         return <ListTodo className={cn(cls, 'text-violet-500')} />
    case 'task_deadline_approaching': return <Clock    className={cn(cls, 'text-amber-400')} />
    case 'note_edit_request':         return <PenLine  className={cn(cls, 'text-violet-400')} />
    default:                          return <Bell     className={cn(cls, 'text-muted-foreground')} />
  }
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({ notif, onRead }: { notif: Notification; onRead: () => void }) {
  const navigate   = useNavigate()
  const timeAgo    = getTimeAgo(notif.created_at)

  const handleClick = async () => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id)
      onRead()
    }
    if (notif.link) navigate(notif.link)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0',
        !notif.is_read && 'bg-primary/5',
      )}
    >
      <div className="flex gap-2.5">
        <NotifIcon type={notif.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-xs font-medium leading-snug', !notif.is_read && 'font-semibold')}>
              {notif.title}
            </p>
            {!notif.is_read && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
            {notif.message}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo}</p>
        </div>
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationBell({ placement = 'down' }: { placement?: 'down' | 'right' }) {
  const [open, setOpen]       = useState(false)
  const [marking, setMarking] = useState(false)
  const wrapRef               = useRef<HTMLDivElement>(null)
  const qc                    = useQueryClient()

  const { data: notifications = [], isLoading } = useNotifications()
  const unreadCount = useUnreadCount()

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const handleMarkAllRead = async () => {
    setMarking(true)
    await markAllRead()
    qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    setMarking(false)
  }

  const handleRead = () => {
    qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          'absolute w-80 rounded-xl border bg-card shadow-lg overflow-hidden z-50',
          placement === 'right'
            ? 'left-full bottom-0 ml-3'
            : 'top-full right-0 mt-2',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
            <span className="text-xs font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={marking}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {marking
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <CheckCheck className="h-3 w-3" />
                }
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex h-24 flex-col items-center justify-center gap-1 text-muted-foreground">
                <Bell className="h-5 w-5" />
                <p className="text-xs">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotifRow key={n.id} notif={n} onRead={handleRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}
