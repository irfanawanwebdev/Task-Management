/**
 * Time Tracking Page — /time-tracking
 * Shows weekly active-time breakdown per user.
 * PM/Owner: see all users + can edit/correct any day's total.
 * Specialist: sees only own data (read-only).
 */

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, ChevronLeft, ChevronRight, User, Pencil, Trash2, Check, X, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { todayDateEST } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
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
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  const end   = endOfWeek(anchor,   { weekStartsOn: 1 })
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
  return format(date, 'EEE d')
}

function barWidth(minutes: number): number {
  return Math.min(100, (minutes / 480) * 100)
}

function weekDays(anchor: Date): Date[] {
  const { start } = weekRange(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// Parse "2h 30m", "90m", "2h", "2.5" (hours), "150" (minutes) → minutes
function parseTimeInput(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null

  // "2h 30m" or "2h30m"
  const hm = s.match(/^(\d+)h\s*(\d+)m$/)
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2])

  // "2h"
  const h = s.match(/^(\d+)h$/)
  if (h) return parseInt(h[1]) * 60

  // "30m"
  const m = s.match(/^(\d+)m$/)
  if (m) return parseInt(m[1])

  // "2.5" → treat as hours
  const dec = s.match(/^(\d+\.\d+)$/)
  if (dec) return Math.round(parseFloat(dec[1]) * 60)

  // plain number → minutes
  const num = s.match(/^(\d+)$/)
  if (num) return parseInt(num[1])

  return null
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useSessions(weekAnchor: Date, userId: string | undefined, isPMOrOwner: boolean) {
  const { start, end } = weekRange(weekAnchor)
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr   = format(end,   'yyyy-MM-dd')

  return useQuery<SessionRow[]>({
    queryKey: ['sessions', startStr, endStr, userId],
    queryFn: async () => {
      let q = supabase
        .from('user_sessions')
        .select('id, user_id, session_date, duration_minutes')
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

// ─── Day Edit Cell ─────────────────────────────────────────────────────────────

function DayCell({
  date,
  minutes,
  sessions,
  isToday,
  isFuture,
  canEdit,
  onSave,
  onDelete,
}: {
  date: Date
  minutes: number
  sessions: SessionRow[]
  isToday: boolean
  isFuture: boolean
  canEdit: boolean
  onSave: (newMinutes: number) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setInput(minutes > 0 ? formatHM(minutes) : '')
      setError(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [editing, minutes])

  async function handleSave() {
    const parsed = parseTimeInput(input)
    if (parsed === null || parsed < 0) { setError(true); return }
    setSaving(true)
    await onSave(parsed)
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    setSaving(true)
    await onDelete()
    setSaving(false)
    setEditing(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl p-2 text-center border-2 border-primary bg-primary/10 flex flex-col gap-1.5">
        {/* Day label */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
            {format(date, 'EEE')}
          </p>
          <p className="text-sm font-bold text-primary leading-none">{format(date, 'd')}</p>
        </div>
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setError(false) }}
          onKeyDown={handleKey}
          placeholder="2h 30m"
          className={cn(
            'w-full text-center text-xs bg-background border rounded-md px-1 py-1 font-mono',
            error ? 'border-destructive' : 'border-border',
          )}
        />
        {error && <p className="text-[9px] text-destructive">Invalid</p>}
        <div className="flex items-center justify-center gap-1">
          <button onClick={handleSave} disabled={saving}
            className="p-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors" title="Save">
            <Check className="h-3 w-3" />
          </button>
          {sessions.length > 0 && (
            <button onClick={handleDelete} disabled={saving}
              className="p-1 rounded-md bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors" title="Delete">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => setEditing(false)}
            className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground" title="Cancel">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  const pct = barWidth(minutes)

  return (
    <div
      className={cn(
        'rounded-xl text-center border group relative flex flex-col overflow-hidden',
        isToday
          ? 'border-primary/50 bg-primary/5 shadow-sm shadow-primary/10'
          : isFuture
            ? 'border-border/30 opacity-40'
            : minutes > 0
              ? 'border-border bg-accent/40'
              : 'border-border/50',
        canEdit && !isFuture && 'cursor-pointer hover:border-primary/50 hover:bg-accent/60 transition-colors',
      )}
      onClick={() => canEdit && !isFuture && setEditing(true)}
      title={canEdit && !isFuture ? 'Click to edit' : undefined}
    >
      {/* Filled bar background — grows from bottom */}
      {minutes > 0 && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 transition-all',
            isToday ? 'bg-primary/15' : 'bg-primary/8',
          )}
          style={{ height: `${pct}%` }}
        />
      )}

      <div className="relative z-10 p-2 flex flex-col items-center gap-0.5">
        {/* Day name */}
        <p className={cn(
          'text-[10px] font-bold uppercase tracking-wider leading-none',
          isToday ? 'text-primary' : 'text-muted-foreground/70',
        )}>
          {format(date, 'EEE')}
        </p>
        {/* Date number */}
        <p className={cn(
          'text-sm font-bold leading-none',
          isToday ? 'text-primary' : 'text-foreground/80',
        )}>
          {format(date, 'd')}
        </p>
        {/* Divider */}
        <div className={cn('w-4 h-px my-0.5', isToday ? 'bg-primary/40' : 'bg-border')} />
        {/* Time value */}
        <p className={cn(
          'text-xs font-mono font-semibold leading-none',
          minutes > 0
            ? isToday ? 'text-primary' : 'text-foreground'
            : 'text-muted-foreground/40',
        )}>
          {formatHM(minutes)}
        </p>
      </div>

      {/* Edit indicator */}
      {canEdit && !isFuture && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil className="h-2 w-2 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  profile,
  sessions,
  days,
  canEdit,
  weekStartStr,
  weekEndStr,
}: {
  profile: Profile
  sessions: SessionRow[]
  days: Date[]
  canEdit: boolean
  weekStartStr: string
  weekEndStr: string
}) {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()

  const userSessions = sessions.filter(s => s.user_id === profile.user_id)

  // day → sessions map
  const daySessionsMap: Record<string, SessionRow[]> = {}
  for (const s of userSessions) {
    if (!daySessionsMap[s.session_date]) daySessionsMap[s.session_date] = []
    daySessionsMap[s.session_date].push(s)
  }

  // day → total minutes
  const dayMap: Record<string, number> = {}
  for (const [date, ss] of Object.entries(daySessionsMap)) {
    dayMap[date] = ss.reduce((a, s) => a + s.duration_minutes, 0)
  }

  const totalMins = Object.values(dayMap).reduce((a, b) => a + b, 0)
  const today     = todayDateEST()

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['sessions', weekStartStr, weekEndStr] })
  }

  async function handleSave(dateKey: string, newMinutes: number) {
    const daySessions = daySessionsMap[dateKey] ?? []

    if (daySessions.length === 0) {
      // No existing session — insert one
      await supabase.from('user_sessions').insert({
        user_id: profile.user_id,
        session_date: dateKey,
        duration_minutes: newMinutes,
      } as never)
    } else {
      // Update the first session to the new total, delete the rest
      const [first, ...rest] = daySessions
      await supabase
        .from('user_sessions')
        .update({ duration_minutes: newMinutes } as never)
        .eq('id', first.id)
      if (rest.length > 0) {
        await supabase
          .from('user_sessions')
          .delete()
          .in('id', rest.map(s => s.id))
      }
    }
    await invalidate()
  }

  async function handleDelete(dateKey: string) {
    const ids = (daySessionsMap[dateKey] ?? []).map(s => s.id)
    if (ids.length > 0) {
      await supabase.from('user_sessions').delete().in('id', ids)
    }
    await invalidate()
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
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
                    mins > 0 ? isToday ? 'bg-primary' : 'bg-primary/50' : 'bg-border',
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

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          {canEdit && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Pencil className="h-3 w-3 shrink-0" />
              Tap any past day to edit or remove its time
            </p>
          )}
          <div className="grid grid-cols-7 gap-1.5">
            {days.map(d => {
              const key      = format(d, 'yyyy-MM-dd')
              const mins     = dayMap[key] ?? 0
              const isTd     = key === today
              const isFuture = key > today
              return (
                <DayCell
                  key={key}
                  date={d}
                  minutes={mins}
                  sessions={daySessionsMap[key] ?? []}
                  isToday={isTd}
                  isFuture={isFuture}
                  canEdit={canEdit}
                  onSave={(newMins) => handleSave(key, newMins)}
                  onDelete={() => handleDelete(key)}
                />
              )
            })}
          </div>
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
  const weekStartStr = format(start, 'yyyy-MM-dd')
  const weekEndStr   = format(end,   'yyyy-MM-dd')

  const { data: sessions = [], isLoading } = useSessions(weekAnchor, profile?.user_id, isPMOrOwner)
  const { data: profiles = [] }            = useProfiles()

  const visibleProfiles = isPMOrOwner
    ? profiles
    : profiles.filter(p => p.user_id === profile?.user_id)

  const days = weekDays(weekAnchor)

  const grandTotal = sessions.reduce((sum, s) => sum + s.duration_minutes, 0)

  const userTotals: Record<string, number> = {}
  for (const s of sessions) userTotals[s.user_id] = (userTotals[s.user_id] ?? 0) + s.duration_minutes
  const sorted = [...visibleProfiles].sort((a, b) => (userTotals[b.user_id] ?? 0) - (userTotals[a.user_id] ?? 0))

  const weekLabel     = `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  const isCurrentWeek = format(weekAnchor, 'yyyy-ww') === format(new Date(), 'yyyy-ww')

  return (
    <div className="space-y-6 max-w-5xl">
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
              canEdit={isPMOrOwner}
              weekStartStr={weekStartStr}
              weekEndStr={weekEndStr}
            />
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-border space-y-2">
        {/* Colour legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary shrink-0" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary/50 shrink-0" />
            <span>Active day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm border border-border/60 shrink-0" />
            <span>No activity</span>
          </div>
          {isPMOrOwner && (
            <div className="flex items-center gap-1.5">
              <Pencil className="h-3 w-3 shrink-0" />
              <span>Tap a day (expanded) to edit</span>
            </div>
          )}
        </div>
        {/* Info note */}
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground/60">
          <Info className="h-3 w-3 shrink-0 mt-0.5" />
          <span>Bar height fills at 8h = 100%. Idle time (&gt;15 min) and sleep/hibernate are not counted.</span>
        </div>
      </div>
    </div>
  )
}
