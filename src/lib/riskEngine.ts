/**
 * 4-Pillar Risk Score Engine — JZ Operations Hub
 * Calculates client health risk across four pillars:
 *   Delivery   (0–30 pts): task completion, overdue, blocked
 *   Sentiment  (0–25 pts): weekly review sentiment/engagement/retention
 *   Performance(0–25 pts): high-impact task completion + on-time rate
 *   Visibility (0–20 pts): meeting compliance + report delivery
 *
 * Health: 0–25 = Green | 26–45 = Yellow | 46–100 = Red
 */

import type { DeliveryTask, WeeklyReview, Meeting, Report, RiskScore } from './types'
import { isOverdueEST, todayDateEST } from './timezone'

// ── Pillar 1: Delivery (0–30 pts) ─────────────────────────────────────────────
function calcDelivery(tasks: DeliveryTask[]): number {
  const withDue       = tasks.filter(t => t.due_date)
  const done          = withDue.filter(t => t.status === 'Done').length
  const total         = withDue.length
  const overdue       = tasks.filter(t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done').length
  const blocked       = tasks.filter(t => t.status === 'Blocked').length
  const completionRate = total > 0 ? done / total : 1
  return Math.min(30, Math.round((1 - completionRate) * 15 + overdue * 3 + blocked * 5))
}

// ── Pillar 2: Sentiment (0–25 pts) ────────────────────────────────────────────
const SENTIMENT_PTS: Record<string, number> = {
  Positive: 0, Neutral: 8, Concerned: 16, Negative: 25,
}
const ENGAGEMENT_PTS: Record<string, number> = {
  High: 0, Medium: 4, Low: 10, Disengaged: 20,
}
const RETENTION_PTS: Record<string, number> = {
  Strong: 0, Moderate: 5, 'At Risk': 12, Critical: 20,
}

function calcSentiment(reviews: WeeklyReview[]): number {
  if (reviews.length === 0) return 10 // unknown = moderate risk
  const latest = reviews.reduce((a, b) => (a.review_date > b.review_date ? a : b))
  const base = Math.round(
    ((SENTIMENT_PTS[latest.sentiment_observed] ?? 8) * 0.5 +
     (ENGAGEMENT_PTS[latest.engagement_level]  ?? 5) * 0.3 +
     (RETENTION_PTS[latest.confidence_in_retention] ?? 5) * 0.2),
  )
  return Math.min(25, Math.max(0, base))
}

// ── Pillar 3: Performance (0–25 pts) ──────────────────────────────────────────
// Proxy: high-impact task completion rate + on-time rate for completed tasks
function calcPerformance(tasks: DeliveryTask[]): number {
  const highImpact = tasks.filter(t => t.impact_level === 'High')
  if (highImpact.length === 0) {
    // Fall back to overall completion as proxy
    const done  = tasks.filter(t => t.status === 'Done').length
    const total = tasks.length
    const rate  = total > 0 ? done / total : 1
    return Math.min(25, Math.round((1 - rate) * 25))
  }
  const hiDone    = highImpact.filter(t => t.status === 'Done').length
  const hiRate    = hiDone / highImpact.length
  const hiOverdue = highImpact.filter(
    t => t.due_date && isOverdueEST(t.due_date) && t.status !== 'Done',
  ).length
  return Math.min(25, Math.round((1 - hiRate) * 15 + hiOverdue * 5))
}

// ── Pillar 4: Visibility (0–20 pts) ───────────────────────────────────────────
// Meeting compliance: 2 bi-weekly per month expected
// Report compliance: pending/overdue reports
function calcVisibility(meetings: Meeting[], reports: Report[]): number {
  const today          = todayDateEST()
  const thisMonthStart = today.slice(0, 7) + '-01'

  const biweekly = meetings.filter(
    m => m.type === 'Mid-Month Review' || m.type === 'End-of-Month Review',
  )
  const doneThisMonth = biweekly.filter(
    m => m.status === 'Completed' && m.date >= thisMonthStart,
  ).length
  const meetingGap  = Math.max(0, 2 - doneThisMonth) // 0, 1, or 2
  const meetingRisk = Math.min(10, meetingGap * 5)   // 0, 5, or 10

  const overdueReports = reports.filter(r => r.status !== 'Sent' && r.due_date < today).length
  const reportRisk     = Math.min(10, overdueReports * 3)

  return meetingRisk + reportRisk
}

// ── Health mapping ─────────────────────────────────────────────────────────────
export function scoreToHealth(score: number): 'Green' | 'Yellow' | 'Red' {
  if (score <= 25) return 'Green'
  if (score <= 45) return 'Yellow'
  return 'Red'
}

// ── Main calculation ───────────────────────────────────────────────────────────
export function calcRiskScore(
  tasks:    DeliveryTask[],
  reviews:  WeeklyReview[],
  meetings: Meeting[],
  reports:  Report[],
): RiskScore {
  const delivery    = calcDelivery(tasks)
  const sentiment   = calcSentiment(reviews)
  const performance = calcPerformance(tasks)
  const visibility  = calcVisibility(meetings, reports)
  const adjustment  = reviews.length > 0
    ? (reviews.reduce((a, b) => (a.review_date > b.review_date ? a : b)).adjustment_score ?? 0)
    : 0

  const systemScore = delivery + sentiment + performance + visibility
  const final_score = Math.min(100, Math.max(0, systemScore + adjustment))

  return {
    delivery,
    sentiment,
    performance,
    visibility,
    adjustment,
    final_score,
    health: scoreToHealth(final_score),
  }
}
