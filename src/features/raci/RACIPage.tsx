/**
 * RACI Matrix Page — JZ Operations Hub
 * Static visual matrix: 16 delivery steps × 10 workstreams.
 * Shows A/R, A, R, C, I responsibility assignments.
 */

import { DELIVERY_STEPS, WORKSTREAMS } from '@/lib/types'
import type { Workstream } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── RACI Data (static, based on product documentation) ──────────────────────

type RaciValue = 'A/R' | 'A' | 'R' | 'C' | 'I' | ''

// Matrix: step index → workstream → raci role
// Workstreams: Sales, Ops/PM, AM, Tracking, SEO, PPC, Web/Dev, Local/GBP, Social, VA/Vendor
const RACI_MATRIX: Record<number, Partial<Record<Workstream, RaciValue>>> = {
  0:  { Sales: 'A/R', 'Ops/PM': 'I', AM: 'C' },
  1:  { 'Ops/PM': 'A/R', AM: 'R', Sales: 'I' },
  2:  { 'Ops/PM': 'A/R', AM: 'R', Sales: 'I', SEO: 'C' },
  3:  { 'Ops/PM': 'A', AM: 'R', Tracking: 'R', 'Web/Dev': 'C' },
  4:  { Tracking: 'A/R', 'Ops/PM': 'A', 'Web/Dev': 'R', SEO: 'I' },
  5:  { SEO: 'A/R', 'Ops/PM': 'A', PPC: 'C', 'Local/GBP': 'C' },
  6:  { SEO: 'A/R', 'Ops/PM': 'A', 'Web/Dev': 'R', Tracking: 'C' },
  7:  { 'Ops/PM': 'A/R', SEO: 'R', Tracking: 'C', AM: 'I' },
  8:  { 'Local/GBP': 'A/R', SEO: 'R', 'Ops/PM': 'A', 'VA/Vendor': 'C' },
  9:  { 'Web/Dev': 'A/R', SEO: 'R', 'Ops/PM': 'A', 'Local/GBP': 'C' },
  10: { 'Local/GBP': 'A/R', 'Ops/PM': 'A', SEO: 'C', AM: 'I' },
  11: { 'Local/GBP': 'A/R', AM: 'R', 'Ops/PM': 'A', 'VA/Vendor': 'C' },
  12: { 'Web/Dev': 'A/R', 'Ops/PM': 'A', SEO: 'C', Tracking: 'R' },
  13: { PPC: 'A/R', 'Ops/PM': 'A', Tracking: 'R', AM: 'I' },
  14: { Social: 'A/R', 'Ops/PM': 'A', AM: 'C', 'VA/Vendor': 'R' },
  15: { 'Ops/PM': 'A/R', SEO: 'R', PPC: 'R', 'Web/Dev': 'R', Social: 'R', 'Local/GBP': 'R', AM: 'I' },
}

// ─── Cell styles ──────────────────────────────────────────────────────────────

const CELL_STYLES: Record<RaciValue, string> = {
  'A/R': 'bg-primary/20 text-primary font-bold border-primary/30',
  'A':   'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] font-semibold border-[hsl(var(--info))]/20',
  'R':   'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] font-semibold border-[hsl(var(--success))]/20',
  'C':   'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]/80 border-[hsl(var(--warning))]/20',
  'I':   'bg-muted text-muted-foreground border-border',
  '':    'text-muted-foreground/20 border-border/30',
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const LEGEND = [
  { role: 'A/R', label: 'Accountable + Responsible', desc: 'Primary owner' },
  { role: 'A',   label: 'Accountable', desc: 'Approver / decision maker' },
  { role: 'R',   label: 'Responsible', desc: 'Does the work' },
  { role: 'C',   label: 'Consulted', desc: 'Input required' },
  { role: 'I',   label: 'Informed', desc: 'Kept in loop' },
] as const

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RACIPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">RACI Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Responsibility assignments for all 16 delivery steps across 10 workstreams.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND.map(l => (
          <div key={l.role} className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center justify-center h-6 w-8 rounded border text-xs',
              CELL_STYLES[l.role as RaciValue]
            )}>
              {l.role}
            </span>
            <div>
              <span className="text-xs font-medium">{l.label}</span>
              <span className="text-xs text-muted-foreground ml-1">— {l.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* QA Gate callout */}
      <div className="qa-gate-warning">
        <div>
          <p className="font-semibold text-sm">QA Gate Rule</p>
          <p className="text-sm mt-0.5">
            If a step's A/R output isn't completed and logged, the next step does not start.
            Every task requires the "A/R output logged" checkbox before downstream steps proceed.
          </p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sticky left-0 bg-card min-w-52 border-r border-border">
                  Step
                </th>
                {WORKSTREAMS.map(ws => (
                  <th key={ws} className="px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-20 whitespace-nowrap">
                    {ws}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DELIVERY_STEPS.map((step, idx) => {
                const row = RACI_MATRIX[step.step] ?? {}
                return (
                  <tr
                    key={step.step}
                    className={cn('border-b border-border/50 hover:bg-accent/30 transition-colors', idx % 2 === 0 ? '' : 'bg-background/20')}
                  >
                    {/* Step cell */}
                    <td className="px-3 py-2.5 sticky left-0 bg-card border-r border-border">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                          {step.step}
                        </span>
                        <div>
                          <p className="text-xs font-medium leading-tight">{step.name}</p>
                          <p className="text-xs text-muted-foreground">{step.timeline}</p>
                        </div>
                      </div>
                    </td>

                    {/* Workstream cells */}
                    {WORKSTREAMS.map(ws => {
                      const value: RaciValue = row[ws] ?? ''
                      return (
                        <td key={ws} className="px-2 py-2 text-center">
                          {value ? (
                            <span className={cn(
                              'inline-flex items-center justify-center h-6 min-w-8 px-1.5 rounded border text-xs',
                              CELL_STYLES[value]
                            )}>
                              {value}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/20 text-xs">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workstream key */}
      <div>
        <p className="section-header">Workstream Key</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {WORKSTREAMS.map(ws => (
            <div key={ws} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span className="text-xs text-muted-foreground">{ws}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
