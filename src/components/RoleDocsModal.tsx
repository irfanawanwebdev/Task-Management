import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
}

// ─── Role definitions ─────────────────────────────────────────────────────────

const ROLES = [
  {
    role: 'Owner',
    key: 'owner',
    description: 'Full control over the entire platform. Access to the Executive Dashboard with revenue, KPIs, and high-level reporting. Can do everything a Project Manager can.',
    defaultRoute: '/owner',
    pages: ['Executive Dashboard', 'PM Dashboard', 'Clients', 'Tasks', 'Meetings & Reports',
      'Blockers', 'Team Workload', 'Internal Workspace', 'User Management', 'RACI Matrix',
      'Settings', 'Opportunities', 'My Dashboard', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: true, createClients: true, manageUsers: true,
      generateReports: true, resolveBlockers: true, viewAll: true,
      executiveDashboard: true,
    },
  },
  {
    role: 'Project Manager',
    key: 'project_manager',
    description: 'Internal operations lead. Oversees all client delivery across the full 16-step process, manages tasks, workload, blockers, and team coordination. Does NOT have the Executive Dashboard.',
    defaultRoute: '/',
    pages: ['PM Dashboard', 'Clients', 'Tasks', 'Meetings & Reports', 'Blockers',
      'Team Workload', 'Internal Workspace', 'User Management', 'RACI Matrix',
      'Settings', 'Opportunities', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: true, createClients: true, manageUsers: true,
      generateReports: true, resolveBlockers: true, viewAll: true,
      executiveDashboard: false,
    },
  },
  {
    role: 'Client Account Manager',
    key: 'account_manager',
    description: 'Client-facing relationship manager. Handles client communication, attends meetings, tracks satisfaction, and manages the ongoing account relationship. NOT a social media role — focused on client retention and upsell.',
    defaultRoute: '/specialist',
    pages: ['My Dashboard', 'Tasks', 'Meetings & Reports', 'Blockers', 'Opportunities', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: false, createClients: false, manageUsers: false,
      generateReports: false, resolveBlockers: false, viewAll: false,
      executiveDashboard: false,
    },
  },
  {
    role: 'Web Developer',
    key: 'web_developer',
    description: 'Handles website builds, technical SEO setup, landing pages, and tracking implementation. Works from the My Dashboard / specialist view.',
    defaultRoute: '/specialist',
    pages: ['My Dashboard', 'Tasks', 'Meetings & Reports', 'Blockers', 'Opportunities', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: false, createClients: false, manageUsers: false,
      generateReports: false, resolveBlockers: false, viewAll: false,
      executiveDashboard: false,
    },
  },
  {
    role: 'SEO Specialist',
    key: 'seo',
    description: 'Handles on-page SEO, content, keyword research, and local SEO / Google Business Profile tasks.',
    defaultRoute: '/specialist',
    pages: ['My Dashboard', 'Tasks', 'Meetings & Reports', 'Blockers', 'Opportunities', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: false, createClients: false, manageUsers: false,
      generateReports: false, resolveBlockers: false, viewAll: false,
      executiveDashboard: false,
    },
  },
  {
    role: 'Ads Manager',
    key: 'ads_manager',
    description: 'Manages paid advertising campaigns — Google Ads, Meta Ads, and other PPC platforms.',
    defaultRoute: '/specialist',
    pages: ['My Dashboard', 'Tasks', 'Meetings & Reports', 'Blockers', 'Opportunities', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: false, createClients: false, manageUsers: false,
      generateReports: false, resolveBlockers: false, viewAll: false,
      executiveDashboard: false,
    },
  },
  {
    role: 'Social Media',
    key: 'social_media',
    description: 'Creates and schedules social media content, manages brand voice across platforms. Different from Client Account Manager — focuses on content production, not client relationship management.',
    defaultRoute: '/specialist',
    pages: ['My Dashboard', 'Tasks', 'Meetings & Reports', 'Blockers', 'Opportunities', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: false, createClients: false, manageUsers: false,
      generateReports: false, resolveBlockers: false, viewAll: false,
      executiveDashboard: false,
    },
  },
  {
    role: 'Viewer',
    key: 'viewer',
    description: 'Read-only access. Can view tasks, meetings, and blockers but cannot create or modify anything.',
    defaultRoute: '/specialist',
    pages: ['My Dashboard', 'Tasks', 'Meetings & Reports', 'Blockers', 'Opportunities', 'My Tasks', 'Claude AI'],
    capabilities: {
      createTasks: false, createClients: false, manageUsers: false,
      generateReports: false, resolveBlockers: false, viewAll: false,
      executiveDashboard: false,
    },
  },
]

const CAP_COLS: { key: keyof (typeof ROLES)[0]['capabilities']; label: string }[] = [
  { key: 'executiveDashboard', label: 'Exec Dashboard' },
  { key: 'createClients',      label: 'Create Clients' },
  { key: 'createTasks',        label: 'Create Tasks' },
  { key: 'manageUsers',        label: 'Manage Users' },
  { key: 'generateReports',    label: 'Generate Reports' },
  { key: 'resolveBlockers',    label: 'Resolve Blockers' },
  { key: 'viewAll',            label: 'All Pages' },
]

// ─── Common confusion callout ─────────────────────────────────────────────────

const CONFUSING_PAIRS = [
  {
    title: 'Project Manager vs Client Account Manager',
    body: 'A Project Manager runs internal operations — they manage the PM Dashboard, oversee all tasks, workload, and team delivery. A Client Account Manager is client-facing — they attend client meetings, manage the relationship, handle communication, and focus on retention/upsell. They are different people with different jobs.',
  },
  {
    title: 'Social Media vs Client Account Manager',
    body: 'Social Media produces content — posts, reels, captions, scheduling. Client Account Manager manages the client relationship — meetings, emails, satisfaction scores, and upselling. They are separate roles even if sometimes the same person does both; use Page Access to give them both sets of pages.',
  },
  {
    title: 'Opportunities — who sees it?',
    body: 'Opportunities (Sales Pipeline) is visible to all authenticated users by default — just like My Tasks and Claude AI. You can also explicitly include it in a user\'s Page Access list via User Management for clarity.',
  },
]

const Tick = ({ yes }: { yes: boolean }) => (
  <span className={cn('text-base font-semibold', yes ? 'text-emerald-400' : 'text-muted-foreground/40')}>
    {yes ? '✓' : '–'}
  </span>
)

// ─── Component ────────────────────────────────────────────────────────────────

export function RoleDocsModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Role & Permissions Reference</h2>
            <p className="text-xs text-muted-foreground mt-0.5">JZ Smart Media — Operations Hub</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-8">

          {/* ── Common Confusion ──────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Common Questions</h3>
            <div className="space-y-2">
              {CONFUSING_PAIRS.map(p => (
                <div key={p.title} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-semibold text-amber-400 mb-1">{p.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Role Descriptions ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Role Descriptions</h3>
            <div className="space-y-2">
              {ROLES.map(r => (
                <div key={r.key} className="flex gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-[180px] shrink-0">
                    <p className="text-xs font-semibold">{r.role}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">→ {r.defaultRoute}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Capability Matrix ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Capability Matrix</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium w-44">Role</th>
                    {CAP_COLS.map(c => (
                      <th key={c.key} className="text-center px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((r, i) => (
                    <tr key={r.key} className={cn('border-b border-border/50 last:border-0', i % 2 !== 0 && 'bg-muted/10')}>
                      <td className="px-3 py-2 font-medium">{r.role}</td>
                      {CAP_COLS.map(c => (
                        <td key={c.key} className="px-2 py-2 text-center">
                          <Tick yes={r.capabilities[c.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Page Access by Role ──────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Default Page Access by Role</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ROLES.map(r => (
                <div key={r.key} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold mb-2">{r.role}</p>
                  <div className="flex flex-wrap gap-1">
                    {r.pages.map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Notes</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
              <li>Users can hold <strong className="text-foreground">multiple roles</strong> — the highest-privilege role determines capability checks and default route.</li>
              <li><strong className="text-foreground">Page Access</strong> in User Management overrides role defaults on a per-user basis. Always-visible pages (My Dashboard, My Tasks, Claude AI, Opportunities) show regardless.</li>
              <li><strong className="text-foreground">Opportunities</strong> is visible to all authenticated users. Owner and Project Manager see it by default in the role-based nav.</li>
              <li>The <strong className="text-foreground">QA Gate Rule</strong>: A/R output must be logged before advancing a client to the next delivery step.</li>
              <li>New users can only be created by a Project Manager or Owner — there is no public signup.</li>
              <li>Login redirect: Owner → <code className="bg-muted px-1 rounded">/owner</code> · PM → <code className="bg-muted px-1 rounded">/</code> · All others → <code className="bg-muted px-1 rounded">/specialist</code></li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
