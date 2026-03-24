/**
 * SOP Page — /instructions/sops
 * Full Client Onboarding & Delivery SOP: 6 phases, 16 steps (Day 0 → Week 6+).
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  step: number
  name: string
  timeline: string
  phase: string
  trigger: string
  actions: string[]
  requiredOutput: string
  qaGate: string
}

const PHASES = [
  'Phase 0: Client Activation',
  'Phase 1: Onboarding',
  'Phase 2: Foundation',
  'Phase 3: Visibility Build',
  'Phase 4: Growth Activation',
  'Phase 5: Social & Content',
  'Phase 6: Optimization & Scale',
]

const PHASE_STYLES: Record<string, { accent: string; badge: string; dot: string }> = {
  'Phase 0: Client Activation':   { accent: 'border-t-slate-400',   badge: 'bg-slate-500/15 text-slate-300 border border-slate-500/20',   dot: 'bg-slate-400' },
  'Phase 1: Onboarding':          { accent: 'border-t-blue-500',    badge: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',    dot: 'bg-blue-400' },
  'Phase 2: Foundation':          { accent: 'border-t-indigo-500',  badge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20',  dot: 'bg-indigo-400' },
  'Phase 3: Visibility Build':    { accent: 'border-t-purple-500',  badge: 'bg-purple-500/15 text-purple-300 border border-purple-500/20',  dot: 'bg-purple-400' },
  'Phase 4: Growth Activation':   { accent: 'border-t-orange-500',  badge: 'bg-orange-500/15 text-orange-300 border border-orange-500/20',  dot: 'bg-orange-400' },
  'Phase 5: Social & Content':    { accent: 'border-t-pink-500',    badge: 'bg-pink-500/15 text-pink-300 border border-pink-500/20',    dot: 'bg-pink-400' },
  'Phase 6: Optimization & Scale':{ accent: 'border-t-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20', dot: 'bg-emerald-400' },
}

const STEPS: Step[] = [
  {
    step: 0, name: 'Client Signs', timeline: 'Day 0', phase: PHASES[0],
    trigger: 'Contract signed and deposit received.',
    actions: [
      'Confirm deposit and contract signatures',
      'Set up client folder in Google Drive (standard structure)',
      'Create client record in Operations Hub',
      'Assign PM and Account Manager',
      'Send Welcome Packet to client',
    ],
    requiredOutput: 'Client record created in system with all fields populated.',
    qaGate: 'PM must confirm deposit and contract before any work begins.',
  },
  {
    step: 1, name: 'Payment + Welcome', timeline: 'Day 1', phase: PHASES[1],
    trigger: 'Day 0 complete. Deposit confirmed.',
    actions: [
      'Process first payment or confirm recurring billing setup',
      'Send Welcome Email with onboarding timeline',
      'Schedule Kickoff Call (within 48 hours)',
      'Invite client to shared Notion/Drive workspace',
    ],
    requiredOutput: 'Welcome email sent. Kickoff call scheduled.',
    qaGate: 'Welcome email must be sent before proceeding to Kickoff.',
  },
  {
    step: 2, name: 'Kickoff Call', timeline: 'Day 1', phase: PHASES[1],
    trigger: 'Welcome email sent. Call scheduled.',
    actions: [
      'Conduct Kickoff Call (PM + AM + client)',
      'Review service scope and deliverables',
      'Collect access credentials checklist',
      'Set expectations for onboarding timeline',
      'Record recap and share meeting notes',
    ],
    requiredOutput: 'Kickoff recap logged. Credentials request sent.',
    qaGate: 'Kickoff recap must be shared within 24 hours of the call.',
  },
  {
    step: 3, name: 'Access & Assets', timeline: 'Day 2', phase: PHASES[1],
    trigger: 'Kickoff call complete.',
    actions: [
      'Collect all access credentials (GA4, GSC, GBP, Ad accounts, website admin)',
      'Verify access and permissions for each tool',
      'Log credentials in Credentials Google Sheet',
      'Document any missing accesses as blockers',
    ],
    requiredOutput: 'All required credentials verified and logged in Credentials Sheet.',
    qaGate: 'Cannot proceed to Foundation phase until all critical accesses are verified.',
  },
  {
    step: 4, name: 'Tracking Verified', timeline: 'Week 1', phase: PHASES[2],
    trigger: 'Access & assets complete.',
    actions: [
      'Verify GA4 tracking is firing correctly',
      'Confirm Google Search Console verified',
      'Check CallRail or call tracking setup',
      'Verify conversion tracking in Google Ads (if applicable)',
      'Document baseline traffic and conversion data',
    ],
    requiredOutput: 'Tracking verification report. GA4 + GSC confirmed active.',
    qaGate: 'All tracking must be verified before running paid campaigns.',
  },
  {
    step: 5, name: 'Strategy + Competitors', timeline: 'Week 1', phase: PHASES[2],
    trigger: 'Tracking verified.',
    actions: [
      'Conduct competitor analysis (top 3-5 local competitors)',
      'Identify target keywords and service areas',
      'Develop initial SEO strategy document',
      'Define PPC target keywords and budgets',
      'Document strategy in client Google Drive folder',
    ],
    requiredOutput: 'Strategy document saved to Google Drive. Competitor analysis complete.',
    qaGate: 'Strategy doc must be reviewed by PM before implementation begins.',
  },
  {
    step: 6, name: 'Website SEO Foundation', timeline: 'Week 1', phase: PHASES[2],
    trigger: 'Strategy approved.',
    actions: [
      'Audit existing website for SEO issues',
      'Implement meta titles and descriptions for all key pages',
      'Optimize heading structure (H1/H2/H3)',
      'Add schema markup (LocalBusiness, Service, FAQ)',
      'Optimize images (alt text, compression)',
      'Ensure mobile responsiveness and page speed targets',
    ],
    requiredOutput: 'SEO foundation checklist complete. Changes documented in Drive.',
    qaGate: 'All on-page changes must be documented with before/after screenshots.',
  },
  {
    step: 7, name: 'Baseline Report', timeline: 'Week 2', phase: PHASES[3],
    trigger: 'SEO foundation complete.',
    actions: [
      'Generate baseline report from GA4 and GSC data',
      'Document current organic rankings for target keywords',
      'Capture Local Falcon ranking grid baseline',
      'Record current GBP performance metrics',
      'Share report with client and PM',
    ],
    requiredOutput: 'Baseline report shared with client. Saved to Drive.',
    qaGate: 'Baseline must be established before any ranking comparisons can be made.',
  },
  {
    step: 8, name: 'Citations', timeline: 'Week 3', phase: PHASES[3],
    trigger: 'Baseline report complete.',
    actions: [
      'Submit business to top 50+ citation directories',
      'Ensure NAP consistency across all listings',
      'Claim and verify existing duplicate listings',
      'Track citation submissions in tracking sheet',
    ],
    requiredOutput: 'Citation submission report. NAP consistency confirmed.',
    qaGate: 'All major directories must be submitted before marking complete.',
  },
  {
    step: 9, name: 'City Pages', timeline: 'Week 3', phase: PHASES[3],
    trigger: 'Citations in progress.',
    actions: [
      'Create or optimize city/service area pages',
      'Target 2-3 primary service areas',
      'Include local signals (landmarks, neighborhoods, service areas)',
      'Add structured data for service areas',
      'Internal link from homepage and services pages',
    ],
    requiredOutput: 'City pages live on website. Internal linking complete.',
    qaGate: 'All city pages must be reviewed for duplicate content before publishing.',
  },
  {
    step: 10, name: 'GBP Optimization', timeline: 'Week 3', phase: PHASES[3],
    trigger: 'Citations and city pages in progress.',
    actions: [
      'Fully optimize Google Business Profile',
      'Add all services and products with descriptions',
      'Upload 20+ high-quality business photos',
      'Set up GBP posts schedule (1-2 per week)',
      'Enable messaging and respond to existing reviews',
      'Add Q&A section content',
    ],
    requiredOutput: 'GBP score 90%+. All sections complete. Photo upload confirmed.',
    qaGate: 'GBP must score 90%+ on completeness before moving to Reviews step.',
  },
  {
    step: 11, name: 'Reviews + Lead Platforms', timeline: 'Week 3', phase: PHASES[3],
    trigger: 'GBP optimization complete.',
    actions: [
      'Set up review request automation (SMS/email)',
      'Create review funnel landing page or link',
      'Register on Yelp, Angi, HomeAdvisor, Thumbtack (as applicable)',
      'Optimize profiles on lead platforms',
      'Document platform logins in Credentials Sheet',
    ],
    requiredOutput: 'Review automation active. Lead platform profiles complete.',
    qaGate: 'Review automation must be tested with at least 1 test request.',
  },
  {
    step: 12, name: 'CRO Improvements', timeline: 'Week 4', phase: PHASES[4],
    trigger: 'Visibility build complete.',
    actions: [
      'Audit website conversion paths',
      'Add/optimize CTAs on all key pages',
      'Implement click-to-call on mobile',
      'Add trust signals (reviews, certifications, photos)',
      'A/B test landing page headlines (if applicable)',
      'Document all changes with screenshots',
    ],
    requiredOutput: 'CRO audit report. All changes documented.',
    qaGate: 'Landing page changes must be reviewed by PM before going live.',
  },
  {
    step: 13, name: 'Google Ads + LSA Launch', timeline: 'Week 4', phase: PHASES[4],
    trigger: 'Tracking verified. CRO complete.',
    actions: [
      'Build Google Ads campaign structure',
      'Set up ad groups by service type',
      'Write ad copy (3 headlines, 2 descriptions per ad)',
      'Configure location targeting and bid strategy',
      'Set up Local Services Ads (LSA) if eligible',
      'Launch campaigns with initial budget',
      'Set up conversion tracking in Google Ads',
    ],
    requiredOutput: 'Campaigns live. Conversion tracking confirmed firing.',
    qaGate: 'PM must approve campaign structure before launch. Tracking must be verified.',
  },
  {
    step: 14, name: 'Social Setup + Content', timeline: 'Week 5', phase: PHASES[5],
    trigger: 'Core services active.',
    actions: [
      'Set up or optimize all social profiles (FB/IG/YouTube/LinkedIn)',
      'Ensure brand consistency (logo, cover, bio)',
      'Create 1-month content calendar',
      'Design and schedule first 2 weeks of posts',
      'Repurpose job photos for local proof content',
      'Set up social scheduling tool access',
    ],
    requiredOutput: 'All social profiles complete. First 2 weeks of content scheduled.',
    qaGate: 'Content calendar must be approved by PM before scheduling.',
  },
  {
    step: 15, name: 'Optimization & Scale', timeline: 'Week 6+', phase: PHASES[6],
    trigger: 'All foundation work complete.',
    actions: [
      'Weekly performance review of all active channels',
      'Bi-weekly client meetings (Mid-Month + End-of-Month)',
      'Weekly report compilation and delivery',
      'Monthly report with full performance summary',
      'Continuous optimization based on data',
      'Identify upsell opportunities based on results',
      'Expand to new service areas or keywords as appropriate',
    ],
    requiredOutput: 'Weekly reports sent every Friday. Monthly reports sent last Friday of month.',
    qaGate: 'All reports must be sent on time. SLA: within 24 hours of meeting.',
  },
]

function StepCard({ step }: { step: Step }) {
  const style = PHASE_STYLES[step.phase]
  return (
    <div id={`step-${step.step}`} className={cn(
      'rounded-xl border border-border/60 bg-card overflow-hidden shadow-md border-t-2',
      style.accent,
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/40 bg-muted/20">
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2',
          'bg-card',
          style.dot === 'bg-blue-400'    && 'ring-blue-500/40 text-blue-400',
          style.dot === 'bg-indigo-400'  && 'ring-indigo-500/40 text-indigo-400',
          style.dot === 'bg-purple-400'  && 'ring-purple-500/40 text-purple-400',
          style.dot === 'bg-orange-400'  && 'ring-orange-500/40 text-orange-400',
          style.dot === 'bg-pink-400'    && 'ring-pink-500/40 text-pink-400',
          style.dot === 'bg-emerald-400' && 'ring-emerald-500/40 text-emerald-400',
          style.dot === 'bg-slate-400'   && 'ring-slate-500/40 text-slate-400',
        )}>
          {step.step}
        </div>
        <div>
          <h3 className="font-semibold text-base">{step.name}</h3>
          <p className="text-xs text-muted-foreground">{step.timeline} · {step.phase}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Trigger */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trigger</p>
          <p className="text-sm">{step.trigger}</p>
        </div>

        {/* Actions */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actions</p>
          <ul className="space-y-1.5">
            {step.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
                {a}
              </li>
            ))}
          </ul>
        </div>

        {/* Required Output */}
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
          <p className="text-xs font-semibold text-blue-400 mb-0.5 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Required Output
          </p>
          <p className="text-sm text-blue-300/90">{step.requiredOutput}</p>
        </div>

        {/* QA Gate */}
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-400 mb-0.5 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> QA Gate
          </p>
          <p className="text-sm text-amber-300/90">{step.qaGate}</p>
        </div>
      </div>
    </div>
  )
}

export default function SOPPage() {
  const phaseGroups = PHASES.map(phase => ({
    phase,
    steps: STEPS.filter(s => s.phase === phase),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/instructions" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Onboarding & Delivery SOP</h1>
          <p className="text-sm text-muted-foreground mt-0.5">16 steps · Day 0 through Week 6+</p>
        </div>
      </div>

      {/* QA Gate Rule */}
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <span className="font-semibold text-amber-400">QA Gate Rule:</span> If a step's A/R output isn't completed and logged,
        the next step does not start. Every step requires the "A/R output logged" checkbox before downstream steps can proceed.
      </div>

      {/* Jump nav */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map(s => {
          const style = PHASE_STYLES[s.phase]
          return (
            <a
              key={s.step}
              href={`#step-${s.step}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                'border-border/50 hover:border-border bg-card/50 hover:bg-muted/40',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', style.dot)} />
              {s.step}: {s.name}
            </a>
          )
        })}
      </div>

      {/* Steps by phase */}
      {phaseGroups.filter(g => g.steps.length > 0).map(group => {
        const style = PHASE_STYLES[group.phase]
        return (
          <section key={group.phase} className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full shrink-0', style.dot)} />
              <h2 className={cn('text-sm font-bold px-3 py-1 rounded-full', style.badge)}>
                {group.phase}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              {group.steps.map(s => <StepCard key={s.step} step={s} />)}
            </div>
          </section>
        )
      })}

      {/* Continuous Delivery note */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-5">
        <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Beyond Week 8: Continuous Delivery Loop
        </h3>
        <ul className="space-y-1.5 text-sm text-emerald-300/80">
          <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" /> Weekly performance review and report</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" /> Bi-weekly client meetings (Mid-Month + End-of-Month)</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" /> Monthly comprehensive report (last Friday of month)</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" /> Continuous SEO improvements and content creation</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" /> Quarterly strategy reviews and roadmap updates</li>
        </ul>
      </div>
    </div>
  )
}
