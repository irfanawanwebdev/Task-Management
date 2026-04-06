/**
 * UserGuideModal — Global how-to guide for regular users (specialists, viewers).
 * Accessible from the sidebar footer (BookOpen icon).
 */

import { X, BookOpen, LayoutDashboard, ListTodo, CheckSquare, Target, AlertTriangle, Calendar, ChevronRight } from 'lucide-react'

interface UserGuideModalProps {
  open: boolean
  onClose: () => void
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2 pl-9 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  )
}

// ─── Callout box (tip / warning) ─────────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground leading-relaxed">
      <span className="font-semibold text-primary">Tip: </span>{children}
    </div>
  )
}

function Important({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-foreground leading-relaxed">
      <span className="font-semibold text-amber-500">Important: </span>{children}
    </div>
  )
}

// ─── Step list item ───────────────────────────────────────────────────────────

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </div>
  )
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function TableRow({ label, desc }: { label: string; desc: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-1.5 pr-4 font-medium text-foreground text-xs whitespace-nowrap align-top">{label}</td>
      <td className="py-1.5 text-xs text-muted-foreground align-top">{desc}</td>
    </tr>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function UserGuideModal({ open, onClose }: UserGuideModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">

        {/* ── Sticky header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">User Guide</h2>
              <p className="text-xs text-muted-foreground">How to use the Operations Hub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto p-6 space-y-8 flex-1">

          {/* ── Day 1 checklist ── */}
          <Section icon={ChevronRight} title="Getting Started — Day 1 Checklist">
            <Step n={1}>Open <strong>My Dashboard</strong> from the sidebar — this is your personal workspace showing today's tasks and upcoming meetings.</Step>
            <Step n={2}>Check <strong>My Tasks</strong> to see all tasks assigned to you across all clients.</Step>
            <Step n={3}>If anything is preventing your work, go to <strong>Blockers</strong> and log it immediately.</Step>
            <Step n={4}>Check <strong>Meetings</strong> to see if any client calls are scheduled for today or this week.</Step>
            <Tip>Keep your task statuses up to date daily — project managers use this to track delivery health for every client.</Tip>
          </Section>

          {/* ── My Dashboard ── */}
          <Section icon={LayoutDashboard} title="My Dashboard  (/specialist)">
            <p>Your personal workspace. Everything here is filtered to <em>your</em> tasks only.</p>
            <div className="space-y-1.5">
              <p><strong className="text-foreground">Stat cards at the top:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 pl-2">
                <li><strong className="text-foreground">My Tasks</strong> — total tasks assigned to you</li>
                <li><strong className="text-foreground">Due This Week</strong> — tasks with a due date in the next 7 days</li>
                <li><strong className="text-foreground">Blocked</strong> — your tasks currently marked as Blocked</li>
                <li><strong className="text-foreground">Meetings</strong> — scheduled meetings this week</li>
              </ul>
            </div>
            <p><strong className="text-foreground">Task lists:</strong> Tasks are grouped into <em>Due Today</em>, <em>Overdue</em>, and <em>All My Tasks</em>. Click any task row to open the detail panel and update its status.</p>
            <Important>Overdue tasks (red section) need your attention first. Update the status or log a blocker if you're stuck.</Important>
          </Section>

          {/* ── My Tasks ── */}
          <Section icon={ListTodo} title="My Tasks  (/my-tasks)">
            <p>A flat list of every task currently assigned to you, across all clients. Use this to:</p>
            <ul className="list-disc list-inside space-y-0.5 pl-2">
              <li>See everything you're responsible for in one place</li>
              <li>Quickly filter by client or date range</li>
              <li>Click a row to open Task Details and update status or add an output URL</li>
            </ul>
            <Tip>Use the date filter (7 / 14 / 30 days) to focus on what's coming up soon.</Tip>
          </Section>

          {/* ── Tasks page ── */}
          <Section icon={CheckSquare} title="Tasks  (/tasks)">
            <p>The master task database. This shows tasks across all clients (or just yours, depending on your role). There are <strong>6 views</strong> — switch with the tab buttons at the top:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left mt-1">
                <tbody>
                  <TableRow label="Timeline" desc="All tasks ordered by step number and due date. The default view for seeing overall delivery progress." />
                  <TableRow label="By Workstream" desc="Tasks grouped by department (SEO, PPC, Web, Social, etc.). Use this to see what your team is working on." />
                  <TableRow label="QA Gate" desc="Tasks that have been started but the A/R output hasn't been logged yet. These are blocking the next step from beginning." />
                  <TableRow label="Blocked" desc="Tasks with status 'Blocked'. Each blocked task should have a matching blocker entry on the Blockers page." />
                  <TableRow label="Overdue" desc="Tasks past their due date that aren't done yet. Prioritize these." />
                  <TableRow label="Next Ready" desc="Tasks where all prerequisites are met and the work can begin immediately." />
                </tbody>
              </table>
            </div>
            <p>Click any task row to open the <strong>Task Detail panel</strong> where you can update status, add an A/R output URL, or add links.</p>
            <Important>
              When you complete a task and it requires an A/R output (shown by the gate icon), paste the output URL before marking it Done. The next delivery step cannot begin until this is logged.
            </Important>
          </Section>

          {/* ── Opportunities ── */}
          <Section icon={Target} title="Opportunities  (/opportunities)">
            <p>The sales pipeline shown as a <strong>Kanban board</strong>. Each card represents a lead moving through 8 stages:</p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['New Lead','Contacted','Qualified','Demo Scheduled','Proposal','Negotiation','Closed Won','Closed Lost'].map((s, i) => (
                <span key={s} className={`px-2 py-0.5 rounded-full border font-medium ${
                  s === 'Closed Won' ? 'border-green-500/40 bg-green-500/10 text-green-400' :
                  s === 'Closed Lost' ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                  'border-border bg-muted/50 text-foreground'
                }`}>
                  {i + 1}. {s}
                </span>
              ))}
            </div>
            <div className="space-y-1">
              <p><strong className="text-foreground">To move a lead:</strong> Drag the card to another column, or click the <strong>→</strong> button on the card to advance it one stage.</p>
              <p><strong className="text-foreground">To view details:</strong> Click anywhere on a card (not the → button) to open the detail panel with Info, Tasks, and Notes tabs.</p>
              <p><strong className="text-foreground">To add a lead:</strong> Click <strong>Add Lead</strong> in the top right.</p>
            </div>
            <Tip>Use the Tasks tab inside a lead's detail panel to track stage-specific actions (e.g., "Send proposal", "Follow up call").</Tip>
          </Section>

          {/* ── Blockers ── */}
          <Section icon={AlertTriangle} title="Blockers  (/blockers)">
            <p>Log anything that is preventing a task from being completed. A blocker should be created as soon as you hit an obstacle — don't wait.</p>
            <div className="space-y-1.5">
              <p><strong className="text-foreground">Severity levels:</strong></p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody>
                    <TableRow label="🔴 High" desc="Blocks delivery entirely — client is at risk. Escalate to your manager immediately." />
                    <TableRow label="🟡 Med" desc="Delays a step but a workaround exists. Aim to resolve within 48 hours." />
                    <TableRow label="🟢 Low" desc="Minor delay, no immediate client impact. Resolve within the week." />
                  </tbody>
                </table>
              </div>
              <p><strong className="text-foreground">Statuses:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 pl-2">
                <li><strong className="text-foreground">Open</strong> — just logged, not yet being worked on</li>
                <li><strong className="text-foreground">In Progress</strong> — someone is actively resolving it</li>
                <li><strong className="text-foreground">Resolved</strong> — fixed, add resolution notes</li>
              </ul>
            </div>
            <Tip>Always add resolution notes when marking a blocker Resolved. This helps the team learn from recurring issues.</Tip>
          </Section>

          {/* ── Meetings ── */}
          <Section icon={Calendar} title="Meetings & Reports  (/meetings)">
            <p>Tracks all client meetings and weekly/monthly reports. There are two sections — <strong>Meetings</strong> and <strong>Reports</strong> — each with filter tabs.</p>
            <div className="space-y-1.5">
              <p><strong className="text-foreground">Meeting cadence:</strong> Each active client requires exactly <strong>2 meetings per month</strong>:</p>
              <ul className="list-disc list-inside space-y-0.5 pl-2">
                <li><strong>Mid-Month Review</strong> — around the 14th</li>
                <li><strong>End-of-Month Review</strong> — around the 27th</li>
              </ul>
              <p><strong className="text-foreground">Reports:</strong> A weekly update is due every Friday per active client. The last Friday of the month becomes the Monthly Report.</p>
              <p><strong className="text-foreground">Bi-Weekly Done tab:</strong> Shows a compliance grid — which clients have had 0, 1, or 2 of their required meetings this month. Green = 2 done, Yellow = 1, Red = 0.</p>
            </div>
            <Important>
              If a client shows Red (0 meetings) near the end of the month, flag it to your manager immediately.
            </Important>
          </Section>

          {/* ── Key concepts ── */}
          <Section icon={BookOpen} title="Key Concepts">
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground mb-1">Delivery Steps (0–15)</p>
                <p>Every client goes through 16 steps from "Client Signs" (Day 0) to "Optimization & Scale" (Week 6+). Tasks are numbered by step. Completion of each step unlocks the next.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">RACI Roles</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <TableRow label="A/R" desc="Accountable + Responsible — you own this task and must log an output URL when done." />
                      <TableRow label="A" desc="Accountable — you're responsible for the outcome but someone else does the work." />
                      <TableRow label="R" desc="Responsible — you do the work, but someone else is accountable for the result." />
                      <TableRow label="C" desc="Consulted — you provide input or review before the task is completed." />
                      <TableRow label="I" desc="Informed — you're notified when this task is done, no action needed." />
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">A/R Output (QA Gate)</p>
                <p>For tasks where you are A/R, you must paste a URL proving the work was done (e.g., a Google Drive link, a live page URL, a report link). Until this is logged, the next delivery step is locked.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Client Health Score (Risk)</p>
                <p>Each client has a risk score from 0–100 based on 4 pillars: Delivery, Sentiment, Performance, and Visibility.</p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 font-medium">Green: 0–25</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">Yellow: 26–45</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-medium">Red: 46–100</span>
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Task Statuses</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <TableRow label="Not Started" desc="Task hasn't begun yet." />
                      <TableRow label="In Progress" desc="Actively being worked on." />
                      <TableRow label="Blocked" desc="Can't proceed — log a blocker on the Blockers page." />
                      <TableRow label="Done" desc="Completed. If A/R role, output URL must be logged." />
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Section>

        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">JZ Smart Media — Operations Hub</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  )
}
