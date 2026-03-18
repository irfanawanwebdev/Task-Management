/**
 * 4-Pillar Risk Score Engine — JZ Operations Hub
 *
 * Final Risk Score = Delivery + Sentiment + Performance + Visibility + Weekly Strategic Adjustment
 *
 * A) Delivery   (0–30): high-impact overdue tasks × 10, capped at 30
 * B) Sentiment  (0–25): manual — from latest WeeklyReview.sentiment_observed
 * C) Performance(0–25): (1 − completionRate) × 25, where completionRate = done/tasksWithDueDate
 * D) Visibility (0–20): D1 (done tasks without A/R output logged, 5 pts each, max 15)
 *                      + D2 (missing bi-weekly meetings this month, 3 pts each, max 6)
 * E) Weekly Strategic Adjustment (-10 to +20): manual — from latest WeeklyReview.adjustment_score
 *
 * Classification: 0–25 = Green | 26–45 = Yellow | 46+ = Red
 *
 * NOTE: Health is NEVER manually set. It is always derived from this computation.
 * The only manual inputs are Sentiment (B) and Weekly Strategic Adjustment (E),
 * both captured during the Weekly Strategic Review.
 */

import type { DeliveryTask, WeeklyReview, Meeting, RiskScore } from './types'
import { isOverdueEST, todayDateEST } from './timezone'

// ── A: Delivery Score (0–30) ───────────────────────────────────────────────
// Count ONLY High Impact tasks that are overdue (dueDate < today AND status != Done)
// Score = min(count × 10, 30)
function calcDelivery(tasks: DeliveryTask[]): number {
  const count = tasks.filter(
    t =>
      t.impact_level === 'High' &&
      t.due_date != null &&
      isOverdueEST(t.due_date) &&
      t.status !== 'Done',
  ).length
  return Math.min(count * 10, 30)
}

// ── B: Sentiment Score (0–25) — MANUAL ────────────────────────────────────
// Direct map from latest WeeklyReview.sentiment_observed.
// Set during Weekly Strategic Review; not computed from tasks.
const SENTIMENT_SCORE: Record<string, number> = {
  Positive: 0,
  Neutral: 5,
  Concerned: 15,
  Negative: 25,
}

function calcSentiment(reviews: WeeklyReview[]): number {
  if (reviews.length === 0) return 0
  const latest = reviews.reduce((a, b) => (a.review_date > b.review_date ? a : b))
  return SENTIMENT_SCORE[latest.sentiment_observed] ?? 0
}

// ── C: Performance Score (0–25) ────────────────────────────────────────────
// CompletionRate = tasksCompleted / tasksWithDueDate
// PerformanceScore = (1 − CompletionRate) × 25, clamped to [0, 25]
function calcPerformance(tasks: DeliveryTask[]): number {
  const withDue = tasks.filter(t => t.due_date != null)
  if (withDue.length === 0) return 0
  const done = withDue.filter(t => t.status === 'Done').length
  const completionRate = done / withDue.length
  return Math.min(25, Math.max(0, Math.round((1 - completionRate) * 25)))
}

// ── D: Visibility Score (0–20) ─────────────────────────────────────────────
// D1: Done tasks with A/R output NOT logged (+5 each, max 15)
// D2: Missing bi-weekly meetings this month (+3 each, max 6)
function calcVisibility(tasks: DeliveryTask[], meetings: Meeting[]): number {
  // D1 — deliverables not logged
  const unlogged = tasks.filter(t => t.status === 'Done' && !t.ar_output_logged).length
  const d1 = Math.min(unlogged * 5, 15)

  // D2 — missing bi-weekly meetings this month
  const monthStart = todayDateEST().slice(0, 7) + '-01'
  const biweekly = meetings.filter(
    m => m.type === 'Mid-Month Review' || m.type === 'End-of-Month Review',
  )
  const doneThisMonth = biweekly.filter(
    m => m.status === 'Completed' && m.date >= monthStart,
  ).length
  const d2 = Math.max(0, (2 - doneThisMonth) * 3)

  return Math.min(20, d1 + d2)
}

// ── Health classification ───────────────────────────────────────────────────
export function scoreToHealth(score: number): 'Green' | 'Yellow' | 'Red' {
  if (score <= 25) return 'Green'
  if (score <= 45) return 'Yellow'
  return 'Red'
}

// ── Main calculation ────────────────────────────────────────────────────────
// E) Weekly Strategic Adjustment (-10 to +20): from latest review's adjustment_score
export function calcRiskScore(
  tasks:    DeliveryTask[],
  reviews:  WeeklyReview[],
  meetings: Meeting[],
): RiskScore {
  const delivery    = calcDelivery(tasks)
  const sentiment   = calcSentiment(reviews)
  const performance = calcPerformance(tasks)
  const visibility  = calcVisibility(tasks, meetings)
  const adjustment  =
    reviews.length > 0
      ? (reviews.reduce((a, b) => (a.review_date > b.review_date ? a : b)).adjustment_score ?? 0)
      : 0

  // Allow > 100 in edge cases (max theoretical = 30+25+25+20+20 = 120)
  const final_score = Math.max(0, delivery + sentiment + performance + visibility + adjustment)

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
