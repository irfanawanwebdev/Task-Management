import { PublicLayout, Section } from './PublicLayout'

export default function DocsPage() {
  return (
    <PublicLayout title="Documentation" updated="April 1, 2026">
      <Section title="Overview">
        <p>
          The JZ Smart Media Operations Hub is an internal platform for managing client delivery,
          team coordination, meetings, and reporting across all active accounts. It is used exclusively
          by JZ Smart Media employees.
        </p>
      </Section>

      <Section title="User Roles">
        <p>Access is role-based. Each user is assigned one or more of the following roles:</p>
        <ul>
          <li><strong>Owner</strong> — Full access including executive dashboard and user management.</li>
          <li><strong>Project Manager</strong> — Full access to client delivery, tasks, meetings, and reports.</li>
          <li><strong>Web Developer / SEO / Ads Manager / Social Media</strong> — Access to their assigned tasks and personal workspace.</li>
          <li><strong>Account Manager</strong> — Client-facing coordination and meeting tracking.</li>
          <li><strong>Viewer</strong> — Read-only access to assigned areas.</li>
        </ul>
      </Section>

      <Section title="Core Features">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-foreground">Client Delivery Tracking</p>
            <p>16-step client lifecycle from onboarding to optimization. Each step has RACI assignments,
              due dates, and a QA gate that must be logged before the next step begins.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Task Management</p>
            <p>All delivery tasks across clients with 6 views: All, By Client, By Status, Overdue, By Workstream, and Kanban.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">My Tasks</p>
            <p>A private personal task list for each user — not tied to any client. Useful for internal action items
              and personal follow-ups. Accessible to all roles.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Meetings & Reports</p>
            <p>Two meetings per client per month (Mid-Month ~14th, End-of-Month ~27th). Weekly reports every Friday.
              Meeting compliance is tracked as completed ÷ expected.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Risk Scoring</p>
            <p>4-pillar risk score (0–100) per client: Delivery (30 pts), Sentiment (25 pts), Performance (25 pts),
              Visibility (20 pts). Green = 0–25, Yellow = 26–45, Red = 46–100.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Blockers</p>
            <p>Log and track operational blockers per client. Unresolved blockers older than 3 days trigger notifications.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Notifications</p>
            <p>Daily automated reminders at 8 AM EST for: overdue tasks, reports due within 3 days,
              aged blockers, tomorrow's meetings, personal task deadlines, and assigned task deadlines.</p>
          </div>
        </div>
      </Section>

      <Section title="Zoom Integration">
        <p>
          The app integrates with Zoom to create and manage client meetings directly from the Meetings page.
          Each user can connect their Zoom account via Settings → Integrations → Zoom → Connect.
          The following Zoom API scopes are used:
        </p>
        <ul>
          <li><code>meeting:read:list_meetings</code> — list existing meetings</li>
          <li><code>meeting:write:meeting</code> — create meetings</li>
          <li><code>user:read:email</code> — identify the connected account</li>
        </ul>
      </Section>

      <Section title="Data & Security">
        <p>
          All data is stored in Supabase (PostgreSQL on AWS). Row-level security (RLS) enforces that
          users can only read and write data within their permission scope. OAuth tokens are stored
          per-user and never shared. The application is hosted on Vercel with HTTPS enforced.
        </p>
      </Section>

      <Section title="Support">
        <p>
          For access issues, bug reports, or feature requests contact:{' '}
          <a href="mailto:yarden@jzsmartmedia.com" className="text-primary hover:underline">
            yarden@jzsmartmedia.com
          </a>
          {' '}or visit the{' '}
          <a href="/support" className="text-primary hover:underline">Support page</a>.
        </p>
      </Section>
    </PublicLayout>
  )
}
