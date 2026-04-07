/**
 * Timezone utilities — JZ Operations Hub
 * All DB timestamps are UTC. UI displays EST (America/New_York).
 * This is the SINGLE location where timezone conversions happen.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { format, parseISO, isBefore, addHours } from 'date-fns'

export const EST = 'America/New_York'

// ─── Display Formatting ───────────────────────────────────────────────────

/** "Mar 14, 2026"
 *
 * Date-only strings ("YYYY-MM-DD") are treated as local calendar dates and
 * formatted WITHOUT timezone conversion — "2026-04-07" always shows Apr 7.
 * Full ISO timestamps (with T/Z) are converted to EST before formatting.
 */
export function formatDateEST(utcOrDateStr: string | Date): string {
  if (typeof utcOrDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(utcOrDateStr)) {
    // Parse as local date to avoid UTC→EST shift (e.g. Apr 7 00:00 UTC → Apr 6 EST)
    const [year, month, day] = utcOrDateStr.split('-').map(Number)
    return format(new Date(year, month - 1, day), 'MMM d, yyyy')
  }
  const d = typeof utcOrDateStr === 'string' ? parseISO(utcOrDateStr) : utcOrDateStr
  return formatInTimeZone(d, EST, 'MMM d, yyyy')
}

/** "Mar 14, 2026 at 2:30 PM" */
export function formatDateTimeEST(utcOrDateStr: string | Date): string {
  const d = typeof utcOrDateStr === 'string' ? parseISO(utcOrDateStr) : utcOrDateStr
  return formatInTimeZone(d, EST, "MMM d, yyyy 'at' h:mm a")
}

/** "2:30 PM" */
export function formatTimeEST(utcOrDateStr: string | Date): string {
  const d = typeof utcOrDateStr === 'string' ? parseISO(utcOrDateStr) : utcOrDateStr
  return formatInTimeZone(d, EST, 'h:mm a')
}

/** "March 2026" */
export function formatMonthYearEST(utcOrDateStr: string | Date): string {
  const d = typeof utcOrDateStr === 'string' ? parseISO(utcOrDateStr) : utcOrDateStr
  return formatInTimeZone(d, EST, 'MMMM yyyy')
}

// ─── Today / Now in EST ───────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" string in EST timezone */
export function todayDateEST(): string {
  return formatInTimeZone(new Date(), EST, 'yyyy-MM-dd')
}

/** Returns the current Date object shifted to EST zone */
export function nowInEST(): Date {
  return toZonedTime(new Date(), EST)
}

// ─── Date Comparisons (use DATE strings, not timestamps) ──────────────────

/** Is a YYYY-MM-DD date string today in EST? */
export function isDateTodayEST(dateStr: string): boolean {
  return dateStr === todayDateEST()
}

/** Is a YYYY-MM-DD date string past today in EST? */
export function isOverdueEST(dateStr: string): boolean {
  return dateStr < todayDateEST()
}

/** Days elapsed since a given date string (for blocker aging) */
export function daysAgoEST(dateStr: string): number {
  const diff = parseISO(todayDateEST()).getTime() - parseISO(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ─── SLA Calculations ─────────────────────────────────────────────────────

/**
 * Given a meeting date (YYYY-MM-DD in EST) and sla_hours (default 24),
 * returns the UTC timestamp to store as sla_due in the database.
 */
export function buildSlaDueUTC(meetingDateEST: string, slaHours = 24): string {
  const estMidnight = fromZonedTime(`${meetingDateEST}T00:00:00`, EST)
  const slaDue = addHours(estMidnight, slaHours)
  return slaDue.toISOString()
}

/**
 * Returns true if current time (EST) has passed the sla_due timestamp.
 */
export function isSlaBrokenEST(slaDueUTC: string): boolean {
  return isBefore(parseISO(slaDueUTC), new Date())
}

// ─── Report Cadence Helpers ───────────────────────────────────────────────

/**
 * Is today the last Friday of the current month in EST?
 * (If yes → generate Monthly Report instead of Weekly Update)
 */
export function isLastFridayOfMonthEST(): boolean {
  const today = nowInEST()
  if (today.getDay() !== 5) return false // Not a Friday

  const nextFriday = new Date(today)
  nextFriday.setDate(today.getDate() + 7)
  return nextFriday.getMonth() !== today.getMonth()
}

/** Returns the next Friday date string in EST for report scheduling */
export function nextFridayEST(): string {
  const today = nowInEST()
  const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7
  const nextFri = new Date(today)
  nextFri.setDate(today.getDate() + daysUntilFriday)
  return format(nextFri, 'yyyy-MM-dd')
}
