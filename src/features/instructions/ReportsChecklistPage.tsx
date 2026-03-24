/**
 * Reports Checklist — /instructions/reports
 * 12 required elements for every client report.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const REPORT_ITEMS = [
  {
    number: 1,
    title: 'CallRail Data',
    description: 'Total calls, call duration, call recording links, missed call rate, and top call sources.',
    category: 'Calls & Leads',
  },
  {
    number: 2,
    title: 'Social Media Activity',
    description: 'Post count, reach, engagement (likes/comments/shares), follower growth, and top-performing posts.',
    category: 'Social',
  },
  {
    number: 3,
    title: 'Locations/Pages Created',
    description: 'New city pages, service area pages, or landing pages created this period.',
    category: 'SEO',
  },
  {
    number: 4,
    title: 'GBP Posts',
    description: 'Number of Google Business Profile posts published, views, and clicks to website/call.',
    category: 'Local SEO',
  },
  {
    number: 5,
    title: 'LSA Status',
    description: 'Local Services Ads: leads received, cost per lead, LSA verification status, and budget spend.',
    category: 'Paid Ads',
  },
  {
    number: 6,
    title: 'Yelp Ads Data',
    description: 'Impressions, clicks, leads from Yelp Ads (if active), and cost per lead.',
    category: 'Paid Ads',
  },
  {
    number: 7,
    title: 'Advertising Campaigns',
    description: 'Google Ads: impressions, clicks, CTR, conversions, cost per conversion, total spend, and ROAS.',
    category: 'Paid Ads',
  },
  {
    number: 8,
    title: 'Citations',
    description: 'New citations submitted this period, total citation count, and NAP consistency status.',
    category: 'Local SEO',
  },
  {
    number: 9,
    title: 'SEO & Backlinks',
    description: 'Keyword ranking changes, new backlinks acquired, domain authority trend, and GSC impressions/clicks.',
    category: 'SEO',
  },
  {
    number: 10,
    title: 'Purchased Followers/Reviews',
    description: 'Status of any purchased review or follower campaigns, count added, and platform breakdown.',
    category: 'Reputation',
  },
  {
    number: 11,
    title: 'Website Traffic (Microsoft Clarity / GA4)',
    description: 'Sessions, users, bounce rate, average session duration, top pages, and conversion events from GA4 or Clarity heatmaps.',
    category: 'Website',
  },
  {
    number: 12,
    title: 'Local Falcon Results',
    description: 'Local ranking grid screenshot, average position, improvement vs. prior period, and top competitive gaps.',
    category: 'Local SEO',
  },
]

const CATEGORY_COLORS: Record<string, { badge: string; dot: string; accent: string }> = {
  SEO:             { badge: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',    dot: 'bg-blue-400',    accent: 'ring-blue-500/20' },
  'Local SEO':     { badge: 'bg-purple-500/15 text-purple-300 border border-purple-500/20', dot: 'bg-purple-400', accent: 'ring-purple-500/20' },
  'Paid Ads':      { badge: 'bg-orange-500/15 text-orange-300 border border-orange-500/20', dot: 'bg-orange-400', accent: 'ring-orange-500/20' },
  Social:          { badge: 'bg-pink-500/15 text-pink-300 border border-pink-500/20',    dot: 'bg-pink-400',    accent: 'ring-pink-500/20' },
  Website:         { badge: 'bg-teal-500/15 text-teal-300 border border-teal-500/20',    dot: 'bg-teal-400',    accent: 'ring-teal-500/20' },
  'Calls & Leads': { badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20', dot: 'bg-emerald-400', accent: 'ring-emerald-500/20' },
  Reputation:      { badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/20', dot: 'bg-amber-400',   accent: 'ring-amber-500/20' },
}

export default function ReportsChecklistPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/instructions" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Requirements Checklist</h1>
          <p className="text-sm text-muted-foreground mt-0.5">12 required elements for every client report</p>
        </div>
      </div>

      {/* Report Cadence banner */}
      <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm">
        <p className="font-semibold text-blue-400 mb-1">Report Cadence</p>
        <ul className="space-y-0.5 text-blue-300/80">
          <li>• <strong className="text-blue-300">Weekly Update:</strong> Every Friday, one per active client</li>
          <li>• <strong className="text-blue-300">Monthly Report:</strong> Last Friday of month — replaces that week's Weekly Update</li>
          <li>• Monthly reports include all 12 items plus a performance summary and next-month priorities</li>
        </ul>
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORY_COLORS).map(([cat, style]) => (
          <span key={cat} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', style.badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
            {cat}
          </span>
        ))}
      </div>

      {/* Checklist */}
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_ITEMS.map(item => {
          const style = CATEGORY_COLORS[item.category]
          return (
            <div
              key={item.number}
              className={cn(
                'rounded-xl border border-border/60 bg-card shadow-sm p-4 flex gap-3',
                'hover:border-border transition-colors',
              )}
            >
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card ring-2 text-sm font-bold',
                style?.accent ?? 'ring-primary/20',
                style?.dot === 'bg-blue-400'    && 'text-blue-400',
                style?.dot === 'bg-purple-400'  && 'text-purple-400',
                style?.dot === 'bg-orange-400'  && 'text-orange-400',
                style?.dot === 'bg-pink-400'    && 'text-pink-400',
                style?.dot === 'bg-teal-400'    && 'text-teal-400',
                style?.dot === 'bg-emerald-400' && 'text-emerald-400',
                style?.dot === 'bg-amber-400'   && 'text-amber-400',
              )}>
                {item.number}
              </div>
              <div className="flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', style?.badge ?? 'bg-muted text-muted-foreground')}>
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Report structure */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden border-t-2 border-t-primary shadow-md">
        <div className="flex items-center gap-3 p-4 border-b border-border/40 bg-muted/20">
          <div className="rounded-lg bg-primary/10 ring-1 ring-primary/20 p-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Report Structure (Weekly)</h2>
            <p className="text-xs text-muted-foreground">5 required sections in every report</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <ol className="space-y-2.5 text-sm">
            {[
              'Executive Summary — completed count, high-impact wins, key highlights',
              'Delivery Summary — table of completed tasks (Task, Category, Impact, Date)',
              'Performance Highlights — top results across all active channels',
              'Proof of Performance — output links and screenshots',
              'Next Week Focus — upcoming tasks and priorities',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold ring-1 ring-primary/20">
                  {i + 1}
                </span>
                <span className="text-foreground/80 pt-0.5">{item}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 p-4">
            <p className="text-xs font-semibold text-amber-400 mb-2">Monthly Report Additions:</p>
            <ul className="space-y-1.5 text-sm text-amber-300/80">
              {[
                'Performance Summary section (month-over-month comparisons)',
                '"Pending Items Requiring Owner Action" section',
                'Next Month Priorities and roadmap alignment',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
