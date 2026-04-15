/**
 * Time Tracking Page — /time-tracking
 * Shows weekly active-time breakdown per user.
 * PM/Owner: see all users. Specialist: sees only own data.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, ChevronLeft, ChevronRight, User, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { todayDateEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionRow {
  user_id: string
  session_date: string
  duration_minutes: number
}

interface Profile {
  user_id: string
  full_name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekRange(anchor: Date): { start: Date; end: Date } {
  const start = startOfWeek(anchor, { weekStartsOn: 1 }) // Monday
  const end   = endOfWeek(anchor,   { weekStartsOn: 1 }) // Sunday
  return { start, end }
}

function formatHM(minutes: number): string {
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function dayLabel(date: Date): string {
  return format(date, 'EEE d') // "Mon 14"
}

// Width for the time bar, capped at 8h as max
function barWidth(minutes: number): number {
  return Math.min(100, (minutes / 480) * 100)
}

// ─── Week days array ──────────────────────────────────────────────────────────

function weekDays(anchor: Date): Date[] {
  const { start } = weekRange(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useSessions(weekAnchor: Date, userId: string | undefined, isPMOrOwner: boolean) {
  const { start, end } = weekRange(weekAnchor)
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr   = format(end,   'yyyy-MM-dd')

  return useQuery<SessionRow[]>({
    queryKey: ['sessions', startStr, endStr, userId],
    queryFn: async () => {
      let q = supabase
        .from('user_sessions')
        .select('user_id, session_date, duration_minutes')
        .gte('session_date', startStr)
        .lte('session_date', endStr)

      if (!isPMOrOwner && userId) q = q.eq('user_id', userId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as SessionRow[]
    },
    enabled: !!userId,
  })
}

function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_active', true)
      return (data ?? []) as Profile[]
    },
  })
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  profile,
  sessions,
  days,
}: {
  profile: Profile
  sessions: SessionRow[]
  days: Date[]
}) {
  const [expanded, setExpanded] = useState(false)

  // Build day → minutes map for this user
  const dayMap: Record<string, number> = {}
  for (const s of sessions) {
    if (s.user_id !== profile.user_id) continue
    const key = s.session_date
    dayMap[key] = (dayMap[key] ?? 0) + s.duration_minutes
  }

  const totalMins = Object.values(dayMap).reduce((a, b) => a + b, 0)
  const today     = todayDateEST()

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* User header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors text-left"
      >
        <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-primary font-semibold text-sm">
            {profile.full_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total this week: <span className="font-mono font-medium text-foreground">{formatHM(totalMins)}</span>
          </p>
        </div>
        {/* Mini day bars */}
        <div className="hidden sm:flex items-end gap-1.5 h-8">
          {days.map(d => {
            const key  = format(d, 'yyyy-MM-dd')
            const mins = dayMap[key] ?? 0
            const isToday = key === today
            return (
              <div key={key} className="flex flex-col items-center gap-0.5" title={`${dayLabel(d)}: ${formatHM(mins)}`}>
                <div
                  className={cn(
                    'w-5 rounded-sm transition-all',
                    mins > 0
                      ? isToday ? 'bg-primary' : 'bg-primary/50'
                      : 'bg-border',
                  )}
                  style={{ height: `${Math.max(4, barWidth(mins) * 0.28)}px` }}
                />
              </div>
            )
          })}
        </div>
        <div className="ml-2">
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>

      {/* Expanded day breakdown */}
      {expanded && (
        <div className="border-t border-border px-5 py-4">
          <div className="grid grid-cols-7 gap-2">
            {days.map(d => {
              const key   = format(d, 'yyyy-MM-dd')
              const mins  = dayMap[key] ?? 0
              const isTd  = key === today
              const isFuture = key > today
              return (
                <div key={key} className={cn(
                  'rounded-lg p-3 text-center border',
                  isTd
                    ? 'bg-primary/10 border-primary/30'
                    : isFuture
                      ? 'border-border/40 opacity-50'
                      : mins > 0
                        ? 'bg-accent border-border'
                        : 'border-border',
                )}>
                  <p className={cn('text-xs font-medium mb-1', isTd ? 'text-primary' : 'text-muted-foreground')}>
                    {dayLabel(d)}
                  </p>
                  <p className="text-sm font-mono font-semibold">{formatHM(mins)}</p>
                  {mins > 0 && (
                    <div className="mt-1.5 h-1 w-full bg-border rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', isTd ? 'bg-primary' : 'bg-primary/50')}
                        style={{ width: `${barWidth(mins)}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-right">
            Bar fills at 8h = 100%. Data updates every 5 minutes while active.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimeTrackingPage() {
  const { role, profile } = useAuth()
  const isPMOrOwner = role === 'owner' || role === 'project_manager'

  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date())
  const { start, end } = weekRange(weekAnchor)

  const { data: sessions = [], isLoading } = useSessions(weekAnchor, profile?.user_id, isPMOrOwner)
  const { data: profiles = [] }            = useProfiles()

  // Which profiles to show
  const visibleProfiles = isPMOrOwner
    ? profiles
    : profiles.filter(p => p.user_id === profile?.user_id)

  const days = weekDays(weekAnchor)

  // Total hours across all visible users this week
  const grandTotal = sessions.reduce((sum, s) => sum + s.duration_minutes, 0)

  // Per-user total map (for sorting)
  const userTotals: Record<string, number> = {}
  for (const s of sessions) userTotals[s.user_id] = (userTotals[s.user_id] ?? 0) + s.duration_minutes
  const sorted = [...visibleProfiles].sort((a, b) => (userTotals[b.user_id] ?? 0) - (userTotals[a.user_id] ?? 0))

  const weekLabel = `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  const isCurrentWeek = format(weekAnchor, 'yyyy-ww') === format(new Date(), 'yyyy-ww')

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Time Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">Weekly active-time by user</p>
        </div>
        {isPMOrOwner && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Team total: <span className="font-mono text-primary">{formatHM(grandTotal)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekAnchor(d => subWeeks(d, 1))}
          className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium min-w-[200px] text-center">{weekLabel}</span>
        <button
          onClick={() => setWeekAnchor(d => addWeeks(d, 1))}
          disabled={isCurrentWeek}
          className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {!isCurrentWeek && (
          <button
            onClick={() => setWeekAnchor(new Date())}
            className="text-xs text-primary hover:underline"
          >
            This week
          </button>
        )}
      </div>

      {/* Column headers for days */}
      <div className="grid grid-cols-7 gap-2 px-5">
        {days.map(d => {
          const isToday = format(d, 'yyyy-MM-dd') === todayDateEST()
          return (
            <div key={d.toISOString()} className="text-center">
              <p className={cn('text-xs font-semibold', isToday ? 'text-primary' : 'text-muted-foreground')}>
                {dayLabel(d)}
              </p>
              {isToday && <div className="mx-auto mt-1 h-1 w-4 rounded-full bg-primary" />}
            </div>
          )
        })}
      </div>

      {/* User rows */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Clock className="h-4 w-4 animate-pulse" /> Loading sessions…
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No active users found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(p => (
            <UserRow
              key={p.user_id}
              profile={p}
              sessions={sessions}
              days={days}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-primary" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-primary/50" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-border" />
          <span>No activity</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Tracks while tab is open (foreground or background) · updates every minute</span>
        </div>
      </div>
    </div>
  )
}
