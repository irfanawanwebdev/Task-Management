/**
 * Internal Workspace — /instructions
 * Reference hub: 4 section cards linking to SOPs, Social, Reports checklist, Active Clients.
 */

import { Link } from 'react-router-dom'
import { BookOpen, Share2, FileText, Users, ChevronRight } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Client Onboarding & Delivery SOP',
    description: 'Full 16-step delivery process from Day 0 (Client Signs) through Week 6+ (Optimization & Scale). Includes triggers, required outputs, and QA gate rules for each step.',
    icon: <BookOpen className="h-6 w-6 text-primary" />,
    href: '/instructions/sops',
    badge: '16 Steps',
  },
  {
    title: 'Social Media Scope & Instructions',
    description: 'Content system, posting cadence (2–4/week), platform setup guide (FB/IG/YouTube/LinkedIn), and brand consistency requirements.',
    icon: <Share2 className="h-6 w-6 text-purple-500" />,
    href: '/instructions/social',
    badge: '3 Sections',
  },
  {
    title: 'Report Requirements Checklist',
    description: '12 required elements for every client report — CallRail, social activity, GBP posts, LSA, citations, SEO, website traffic, Local Falcon, and more.',
    icon: <FileText className="h-6 w-6 text-amber-500" />,
    href: '/instructions/reports',
    badge: '12 Items',
  },
  {
    title: 'Active Clients Directory',
    description: 'All active clients with quick links to their Google Drive folders and Credentials Google Sheets.',
    icon: <Users className="h-6 w-6 text-green-500" />,
    href: '/instructions/clients',
    badge: 'Live Data',
  },
]

export default function InstructionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Internal Workspace
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          SOPs, reference guides, and team resources
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(s => (
          <Link
            key={s.href}
            to={s.href}
            className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="rounded-lg bg-muted p-2">{s.icon}</div>
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {s.badge}
              </span>
            </div>
            <h2 className="text-base font-semibold group-hover:text-primary transition-colors">
              {s.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed flex-1">
              {s.description}
            </p>
            <div className="mt-4 flex items-center text-xs font-medium text-primary">
              Open <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
