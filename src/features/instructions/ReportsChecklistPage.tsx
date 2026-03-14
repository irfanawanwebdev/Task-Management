/**
 * Reports Checklist — /instructions/reports
 * 12 required elements for every client report.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react'

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

const CATEGORIES = ['All', 'SEO', 'Local SEO', 'Paid Ads', 'Social', 'Website', 'Calls & Leads', 'Reputation']

const CATEGORY_COLORS: Record<string, string> = {
  SEO:           'bg-blue-100 text-blue-700',
  'Local SEO':   'bg-purple-100 text-purple-700',
  'Paid Ads':    'bg-orange-100 text-orange-700',
  Social:        'bg-pink-100 text-pink-700',
  Website:       'bg-teal-100 text-teal-700',
  'Calls & Leads': 'bg-green-100 text-green-700',
  Reputation:    'bg-amber-100 text-amber-700',
}

export default function ReportsChecklistPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/instructions" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Requirements Checklist</h1>
          <p className="text-sm text-muted-foreground mt-0.5">12 required elements for every client report</p>
        </div>
      </div>

      {/* Header info */}
      <div className="rounded-lg border bg-blue-50 border-blue-200 px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Report Cadence</p>
        <ul className="space-y-0.5 text-blue-700">
          <li>• <strong>Weekly Update:</strong> Every Friday, one per active client</li>
          <li>• <strong>Monthly Report:</strong> Last Friday of month — replaces that week's Weekly Update</li>
          <li>• Monthly reports include all 12 items plus a performance summary and next-month priorities</li>
        </ul>
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.filter(c => c !== 'All').map(c => (
          <span key={c} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[c] ?? 'bg-muted text-muted-foreground'}`}>
            {c}
          </span>
        ))}
      </div>

      {/* Checklist */}
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_ITEMS.map(item => (
          <div key={item.number} className="rounded-xl border bg-card shadow-sm p-4 flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
              {item.number}
            </div>
            <div className="flex-1">
              <div className="flex items-start gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[item.category] ?? 'bg-muted text-muted-foreground'}`}>
                  {item.category}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Report structure reminder */}
      <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Report Structure (Weekly)
        </h2>
        <ol className="space-y-2 text-sm">
          {[
            'Executive Summary — completed count, high-impact wins, key highlights',
            'Delivery Summary — table of completed tasks (Task, Category, Impact, Date)',
            'Performance Highlights — top results across all active channels',
            'Proof of Performance — output links and screenshots',
            'Next Week Focus — upcoming tasks and priorities',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
        <div className="border-t pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Monthly Report Additions:</p>
          <ul className="space-y-1.5 text-sm">
            {[
              'Performance Summary section (month-over-month comparisons)',
              '"Pending Items Requiring Owner Action" section',
              'Next Month Priorities and roadmap alignment',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
