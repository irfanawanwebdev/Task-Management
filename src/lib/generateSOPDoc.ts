/**
 * generateSOPDoc.ts
 * Builds a self-contained HTML SOP / User Guide and triggers a browser download.
 * No external dependencies required.
 */

function buildHTML(): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>JZ Smart Media — Operations Hub User Guide</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1a1a2e;
    background: #ffffff;
    padding: 0;
  }

  /* ── Cover page ── */
  .cover {
    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 60%, #0d1b4b 100%);
    color: #fff;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 60px 40px;
    page-break-after: always;
  }
  .cover-logo {
    width: 72px; height: 72px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 18px;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 900; color: #fff;
    margin-bottom: 32px;
    letter-spacing: -1px;
  }
  .cover h1 { font-size: 36px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
  .cover h2 { font-size: 18px; font-weight: 400; color: #a5b4fc; margin-bottom: 48px; }
  .cover-meta { font-size: 13px; color: #6b7280; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px; }
  .cover-meta span { margin: 0 16px; }

  /* ── Layout ── */
  .doc { max-width: 860px; margin: 0 auto; padding: 56px 48px; }

  /* ── Table of Contents ── */
  .toc { background: #f8f9ff; border: 1px solid #e0e7ff; border-radius: 12px; padding: 28px 32px; margin-bottom: 56px; }
  .toc h2 { font-size: 16px; font-weight: 700; color: #4338ca; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
  .toc ol { padding-left: 20px; }
  .toc li { padding: 4px 0; color: #374151; }
  .toc li a { color: #4338ca; text-decoration: none; }
  .toc li a:hover { text-decoration: underline; }

  /* ── Section headings ── */
  .section { margin-bottom: 64px; page-break-inside: avoid; }
  .section-number {
    display: inline-block;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 20px;
    margin-bottom: 10px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h1.section-title {
    font-size: 26px;
    font-weight: 800;
    color: #111827;
    border-bottom: 3px solid #6366f1;
    padding-bottom: 10px;
    margin-bottom: 24px;
  }
  h2.sub-title {
    font-size: 17px;
    font-weight: 700;
    color: #1e1b4b;
    margin-top: 28px;
    margin-bottom: 12px;
  }
  h3.sub-sub-title {
    font-size: 14px;
    font-weight: 700;
    color: #4338ca;
    margin-top: 20px;
    margin-bottom: 8px;
  }

  p { margin-bottom: 12px; color: #374151; }

  /* ── Steps ── */
  .steps { counter-reset: step; list-style: none; padding: 0; margin: 16px 0 0; }
  .steps li {
    counter-increment: step;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .steps li::before {
    content: counter(step);
    flex-shrink: 0;
    width: 26px; height: 26px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .steps li span { padding-top: 3px; color: #374151; }

  /* ── Bullets ── */
  .bullets { list-style: none; padding: 0; margin: 12px 0; }
  .bullets li {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 4px 0; color: #374151;
  }
  .bullets li::before { content: "▸"; color: #6366f1; font-size: 12px; padding-top: 2px; flex-shrink: 0; }

  /* ── Callout boxes ── */
  .callout {
    border-left: 4px solid #6366f1;
    background: #eef2ff;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin: 16px 0;
    font-size: 13px;
    color: #3730a3;
  }
  .callout.warn {
    border-color: #f59e0b;
    background: #fffbeb;
    color: #92400e;
  }
  .callout.tip {
    border-color: #10b981;
    background: #ecfdf5;
    color: #065f46;
  }
  .callout strong { display: block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  thead th {
    background: #1e1b4b;
    color: #fff;
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.03em;
  }
  tbody tr:nth-child(even) { background: #f5f7ff; }
  tbody td { padding: 9px 14px; color: #374151; border-bottom: 1px solid #e5e7eb; vertical-align: top; }

  /* ── View cards ── */
  .view-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .view-card {
    border: 1px solid #e0e7ff;
    border-radius: 10px;
    padding: 14px 16px;
    background: #fafaff;
  }
  .view-card .view-name { font-weight: 700; color: #4338ca; font-size: 13px; margin-bottom: 4px; }
  .view-card .view-desc { font-size: 12px; color: #6b7280; line-height: 1.5; }

  /* ── Pill badges ── */
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    margin-right: 4px;
  }
  .badge-green  { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-red    { background: #fee2e2; color: #991b1b; }
  .badge-blue   { background: #dbeafe; color: #1e40af; }
  .badge-purple { background: #ede9fe; color: #5b21b6; }

  /* ── Print ── */
  @media print {
    .cover { min-height: auto; padding: 80px 60px; }
    .doc { padding: 40px; }
    .view-grid { grid-template-columns: 1fr 1fr; }
  }

  @media (max-width: 640px) {
    .doc { padding: 32px 20px; }
    .view-grid { grid-template-columns: 1fr; }
    h1.section-title { font-size: 20px; }
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════ COVER ═══════════════════════════════════════ -->
<div class="cover">
  <div class="cover-logo">JZ</div>
  <h1>Operations Hub</h1>
  <h2>Internal User Guide &amp; SOP</h2>
  <div class="cover-meta">
    <span>JZ Smart Media</span>
    <span>|</span>
    <span>Version 1.0</span>
    <span>|</span>
    <span>${today}</span>
    <span>|</span>
    <span>Confidential — Internal Use Only</span>
  </div>
</div>

<!-- ═══════════════════════════════════════ BODY ═══════════════════════════════════════ -->
<div class="doc">

  <!-- ── Table of Contents ── -->
  <div class="toc">
    <h2>Table of Contents</h2>
    <ol>
      <li><a href="#s1">Getting Started</a></li>
      <li><a href="#s2">PM Dashboard — Operations Control Tower</a></li>
      <li><a href="#s3">Owner Dashboard — Executive Performance Hub</a></li>
      <li><a href="#s4">Clients Page — CRM Directory</a></li>
      <li><a href="#s5">Tasks Page — Master Delivery Database</a></li>
      <li><a href="#s6">Opportunities — Sales Pipeline</a></li>
      <li><a href="#s7">Blockers Page</a></li>
      <li><a href="#s8">Meetings &amp; Reports</a></li>
      <li><a href="#s9">Key Concepts &amp; Terminology</a></li>
    </ol>
  </div>


  <!-- ═══════════ SECTION 1 — GETTING STARTED ═══════════ -->
  <div class="section" id="s1">
    <div class="section-number">Section 1</div>
    <h1 class="section-title">Getting Started</h1>

    <h2 class="sub-title">Logging In</h2>
    <ol class="steps">
      <li><span>Open the Operations Hub URL in your browser (Chrome or Edge recommended).</span></li>
      <li><span>Enter your email address and password provided by your admin.</span></li>
      <li><span>Click <strong>Sign In</strong>. You will be taken to your role-specific dashboard automatically.</span></li>
    </ol>

    <h2 class="sub-title">What You See Depends on Your Role</h2>
    <table>
      <thead><tr><th>Role</th><th>Default Landing Page</th><th>Access</th></tr></thead>
      <tbody>
        <tr><td><span class="badge badge-purple">Owner</span></td><td>Executive Dashboard</td><td>Full access — all pages</td></tr>
        <tr><td><span class="badge badge-blue">Project Manager</span></td><td>PM Dashboard</td><td>All pages except Owner Dashboard</td></tr>
        <tr><td><span class="badge badge-green">Specialist</span><br/>(SEO, PPC, Web, Social, etc.)</td><td>My Dashboard</td><td>My Tasks, Blockers, Meetings, Opportunities</td></tr>
        <tr><td><span class="badge badge-yellow">Account Manager</span></td><td>My Dashboard</td><td>Clients, Tasks, Meetings, Blockers, Opportunities</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">Navigating the App</h2>
    <p>The <strong>sidebar</strong> on the left contains all your navigation links. The pages visible depend on your role. At the bottom of the sidebar you will find:</p>
    <ul class="bullets">
      <li>Your name and role</li>
      <li>Notification bell (alert count)</li>
      <li>User guide download (this document)</li>
      <li>Sign out button</li>
    </ul>

    <div class="callout tip"><strong>Tip</strong>Your role is assigned by the admin. If you cannot see a page you need, contact your manager to request access.</div>
  </div>


  <!-- ═══════════ SECTION 2 — PM DASHBOARD ═══════════ -->
  <div class="section" id="s2">
    <div class="section-number">Section 2</div>
    <h1 class="section-title">PM Dashboard — Operations Control Tower</h1>
    <p>The PM Dashboard is the daily command center for Project Managers. It surfaces everything that needs attention in one place.</p>

    <h2 class="sub-title">Agency KPI Cards (top row)</h2>
    <table>
      <thead><tr><th>Card</th><th>What It Means</th></tr></thead>
      <tbody>
        <tr><td><strong>Global Completion %</strong></td><td>Percentage of all delivery tasks marked Done across all active clients</td></tr>
        <tr><td><strong>High-Impact Rate %</strong></td><td>Percentage of high-impact tasks that are completed on time</td></tr>
        <tr><td><strong>Overdue (All)</strong></td><td>Total tasks past their due date and not Done</td></tr>
        <tr><td><strong>Overdue (Ops/PM)</strong></td><td>Overdue tasks specifically in the Ops &amp; PM workstream</td></tr>
        <tr><td><strong>Blocked</strong></td><td>Total tasks with status Blocked across all clients</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">Client Risk Scores</h2>
    <p>Each active client has a risk card showing their current health status and score (0–100). Click on a client card to expand the <strong>4-Pillar breakdown</strong>:</p>
    <ul class="bullets">
      <li><strong>Delivery (0–30 pts):</strong> Task completion rate, overdue count, blocked count</li>
      <li><strong>Sentiment (0–25 pts):</strong> Weekly review scores from the client</li>
      <li><strong>Performance (0–25 pts):</strong> Campaign and SEO metrics</li>
      <li><strong>Visibility (0–20 pts):</strong> Meeting compliance and report delivery rate</li>
    </ul>
    <div class="callout warn"><strong>Note</strong>A score of 46 or higher puts a client in Red (critical) health. Address red clients first each day.</div>

    <h2 class="sub-title">Other Dashboard Panels</h2>
    <ul class="bullets">
      <li><strong>High-Impact Tasks Today:</strong> Tasks marked High impact that are due today</li>
      <li><strong>Overdue Tasks:</strong> Side-by-side grid — all departments vs Ops/PM only</li>
      <li><strong>Blocker Monitor:</strong> Active blockers with severity (High / Med / Low), client, workstream, and age in days</li>
      <li><strong>Meetings This Week:</strong> Next 8 scheduled meetings with date, type, and calendar link</li>
      <li><strong>Reports Due This Week:</strong> Pending weekly and monthly reports</li>
      <li><strong>Daily PM Checklist:</strong> Toggleable items to track your daily routine — check each off as you complete it</li>
    </ul>

    <div class="callout tip"><strong>Daily Routine</strong>Start your day by reviewing the Risk Scores → Overdue Tasks → Blocker Monitor → Checklist, in that order.</div>
  </div>


  <!-- ═══════════ SECTION 3 — OWNER DASHBOARD ═══════════ -->
  <div class="section" id="s3">
    <div class="section-number">Section 3</div>
    <h1 class="section-title">Owner Dashboard — Executive Performance Hub</h1>
    <p>The Owner Dashboard provides a high-level view of agency-wide performance metrics and client health.</p>

    <h2 class="sub-title">Agency KPI Cards</h2>
    <table>
      <thead><tr><th>Metric</th><th>What It Shows</th></tr></thead>
      <tbody>
        <tr><td>Completion Rate %</td><td>Overall task completion across all clients</td></tr>
        <tr><td>Active Clients</td><td>Number of clients currently in Active or Onboarding status</td></tr>
        <tr><td>Overdue Tasks</td><td>Total overdue tasks across the agency</td></tr>
        <tr><td>Blocked Tasks</td><td>Total blocked tasks across the agency</td></tr>
        <tr><td>Client Health</td><td>Count of Green clients vs Red clients</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">Client Health Summary Table</h2>
    <p>A full table listing every client with:</p>
    <ul class="bullets">
      <li>Client name and current status (Active, Onboarding, At Risk, Paused, Offboarding)</li>
      <li>Health color: <span class="badge badge-green">Green</span> <span class="badge badge-yellow">Yellow</span> <span class="badge badge-red">Red</span></li>
      <li>Task completion %, overdue count, blocked count, and start date</li>
    </ul>

    <h2 class="sub-title">Bonus Conditions</h2>
    <p>Five team bonus targets with a real-time pass/fail indicator:</p>
    <ol class="steps">
      <li><span>Global task completion ≥ 90%</span></li>
      <li><span>Zero high-severity blockers older than 3 days</span></li>
      <li><span>All active clients have had a meeting this month</span></li>
      <li><span>All weekly reports sent on time</span></li>
      <li><span>No clients in Red health for more than 2 consecutive weeks</span></li>
    </ol>

    <h2 class="sub-title">Aging Blockers (&gt;3 days)</h2>
    <p>Cards highlighting blockers that have been open for more than 3 days — these directly affect the bonus condition above and require immediate escalation.</p>
  </div>


  <!-- ═══════════ SECTION 4 — CLIENTS ═══════════ -->
  <div class="section" id="s4">
    <div class="section-number">Section 4</div>
    <h1 class="section-title">Clients Page — CRM Directory</h1>
    <p>The Clients page is the central CRM. Every client you manage appears here with their current health, task progress, and next meeting.</p>

    <h2 class="sub-title">Understanding the Client Table</h2>
    <table>
      <thead><tr><th>Column</th><th>What It Shows</th></tr></thead>
      <tbody>
        <tr><td>Client Name</td><td>Company name. A badge shows the number of child locations if multi-location.</td></tr>
        <tr><td>Status</td><td>Active / Onboarding / At Risk / Paused / Offboarding</td></tr>
        <tr><td>Health</td><td><span class="badge badge-green">Green</span> <span class="badge badge-yellow">Yellow</span> <span class="badge badge-red">Red</span> — based on the 4-pillar risk score</td></tr>
        <tr><td>Completion %</td><td>Percentage of delivery tasks Done. Visual progress bar.</td></tr>
        <tr><td>Overdue</td><td>Count of past-due tasks</td></tr>
        <tr><td>Blocked</td><td>Count of blocked tasks</td></tr>
        <tr><td>Next Meeting</td><td>Date and type of the next scheduled meeting, or "Not scheduled"</td></tr>
        <tr><td>Workstreams</td><td>The first 3 active workstreams for this client (+X more if applicable)</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">How to Add a New Client</h2>
    <ol class="steps">
      <li><span>Click the <strong>"Add Client"</strong> button in the top-right corner of the Clients page.</span></li>
      <li><span>Enter the <strong>Client Name</strong> (required).</span></li>
      <li><span>Set the <strong>Status</strong> (default: Active) and <strong>Start Date</strong> (required).</span></li>
      <li><span>Enter the <strong>Website URL</strong>, <strong>Google Drive Folder URL</strong>, and <strong>Credentials Sheet URL</strong> (required — these are used for reporting and access).</span></li>
      <li><span>Add any <strong>Notes</strong> about this client (account context, special instructions, etc.).</span></li>
      <li><span><em>Optional:</em> Click <strong>"Social Media URLs"</strong> to expand and add Facebook, Instagram, LinkedIn, Twitter, TikTok, GMB, and YouTube links.</span></li>
      <li><span><em>Optional:</em> Add up to <strong>3 child locations</strong> (for multi-location clients — each gets its own dashboard).</span></li>
      <li><span>Click <strong>"Add Client"</strong> to save. The client will appear in the table immediately.</span></li>
    </ol>

    <h2 class="sub-title">Opening a Client's Detail Hub</h2>
    <p>Click anywhere on a client row to open their <strong>Client Detail Hub</strong>. This is a full 8-tab workspace for that client:</p>
    <table>
      <thead><tr><th>Tab</th><th>What You'll Find</th></tr></thead>
      <tbody>
        <tr><td>Overview</td><td>Risk score, KPIs, and quick links</td></tr>
        <tr><td>Delivery</td><td>All 16 delivery steps with task status</td></tr>
        <tr><td>Tasks</td><td>All tasks for this client — add, edit, update status</td></tr>
        <tr><td>Meetings</td><td>Scheduled and past meetings</td></tr>
        <tr><td>Reports</td><td>Weekly and monthly reports</td></tr>
        <tr><td>RACI</td><td>Responsibility matrix for this client</td></tr>
        <tr><td>Risk Log</td><td>Weekly review entries and sentiment history</td></tr>
        <tr><td>Files</td><td>Links to Drive, credentials, and other resources</td></tr>
      </tbody>
    </table>
  </div>


  <!-- ═══════════ SECTION 5 — TASKS ═══════════ -->
  <div class="section" id="s5">
    <div class="section-number">Section 5</div>
    <h1 class="section-title">Tasks Page — Master Delivery Database</h1>
    <p>The Tasks page is the central hub for all delivery work. It shows every task across every client, with 6 intelligent views to focus on what matters most right now.</p>

    <h2 class="sub-title">The 6 Views</h2>
    <div class="view-grid">
      <div class="view-card">
        <div class="view-name">Timeline</div>
        <div class="view-desc">All tasks ordered by delivery step (0–15) and due date. The default view — best for a full overview.</div>
      </div>
      <div class="view-card">
        <div class="view-name">By Workstream</div>
        <div class="view-desc">Tasks grouped by department: SEO, PPC, Web/Dev, Social, AM, Ops/PM, etc. Use to see your team's workload.</div>
      </div>
      <div class="view-card">
        <div class="view-name">QA Gate</div>
        <div class="view-desc">In-progress tasks that are missing their A/R Output URL. These are blocking the next delivery step and need attention now.</div>
      </div>
      <div class="view-card">
        <div class="view-name">Blocked</div>
        <div class="view-desc">All tasks currently marked as Blocked. Each should have a matching blocker record explaining why.</div>
      </div>
      <div class="view-card">
        <div class="view-name">Overdue</div>
        <div class="view-desc">Tasks past their due date and not Done. These directly hurt the client's risk score.</div>
      </div>
      <div class="view-card">
        <div class="view-name">Next Ready</div>
        <div class="view-desc">Tasks where all prerequisites are met and work can begin. Great for planning the team's next sprint.</div>
      </div>
    </div>

    <h2 class="sub-title">Filters</h2>
    <ul class="bullets">
      <li><strong>Date pills (All Time / Last 7d / 14d / 30d):</strong> Restrict the view to tasks due within a time range</li>
      <li><strong>Client dropdown:</strong> Narrow the list to a single client's tasks</li>
    </ul>

    <h2 class="sub-title">How to Add a New Task</h2>
    <ol class="steps">
      <li><span>Click the <strong>"Add Task"</strong> button in the top-right corner.</span></li>
      <li><span>Select the <strong>Client</strong> this task belongs to.</span></li>
      <li><span>Enter the <strong>Task Name</strong> (be specific, e.g., "Write Meta Descriptions — June Batch").</span></li>
      <li><span>Select the <strong>Workstream</strong> (e.g., SEO, PPC, Social, Web/Dev).</span></li>
      <li><span>Set the <strong>Due Date</strong>.</span></li>
      <li><span>Assign the <strong>Responsible (R)</strong> team member — the person doing the work.</span></li>
      <li><span>Assign the <strong>Accountable (A)</strong> team member — the person who owns the outcome.</span></li>
      <li><span>Set the <strong>Impact</strong> level: High (critical path) or Normal.</span></li>
      <li><span>Click <strong>Save</strong>. The task will appear in the Timeline view immediately.</span></li>
    </ol>

    <h2 class="sub-title">How to Update a Task (Task Detail Panel)</h2>
    <p>Click any task row to open its detail panel on the right side of the screen.</p>
    <ol class="steps">
      <li><span>Use the <strong>Status buttons</strong> at the top to change status: Not Started → In Progress → Blocked → Done. The active button highlights immediately.</span></li>
      <li><span>Paste the <strong>A/R Output URL</strong> — the link to the deliverable (Google Doc, report, Drive file, etc.). Saving this URL automatically clears the QA Gate for this task.</span></li>
      <li><span>Add <strong>Notes</strong> in the text area — auto-saved when you click away.</span></li>
      <li><span>If the task is Blocked, add a description of the blocker in the <strong>Blocker</strong> field.</span></li>
    </ol>

    <h2 class="sub-title">Understanding the QA Gate</h2>
    <div class="callout warn">
      <strong>Important — QA Gate Rule</strong>
      If a task has an Accountable (A) or Responsible (R) role assigned, the output must be logged before the next delivery step can begin. Failing to log the output will lock progress for that client.
    </div>
    <ul class="bullets">
      <li>The <strong>QA Gate view</strong> shows every task currently blocking progress</li>
      <li>To resolve: Open the task → paste the deliverable URL into <strong>"A/R Output URL"</strong> → the gate clears automatically</li>
      <li>The ✓ / ✗ icon in the A/R column of the task table shows at a glance whether a task's output is logged</li>
    </ul>
  </div>


  <!-- ═══════════ SECTION 6 — OPPORTUNITIES ═══════════ -->
  <div class="section" id="s6">
    <div class="section-number">Section 6</div>
    <h1 class="section-title">Opportunities — Sales Pipeline</h1>
    <p>The Opportunities page is a Kanban-style sales pipeline. Each card represents a lead or prospect moving through the sales process.</p>

    <h2 class="sub-title">Pipeline Stages (left to right)</h2>
    <table>
      <thead><tr><th>Stage</th><th>What It Means</th></tr></thead>
      <tbody>
        <tr><td>New Lead</td><td>Initial contact or referral — not yet qualified</td></tr>
        <tr><td>Qualified</td><td>Lead meets basic criteria (budget, fit, need)</td></tr>
        <tr><td>Discovery Call</td><td>Initial call scheduled or completed</td></tr>
        <tr><td>Proposal Sent</td><td>Proposal document or deck delivered to prospect</td></tr>
        <tr><td>Negotiation</td><td>Pricing and scope discussion in progress</td></tr>
        <tr><td>Contract Sent</td><td>Agreement sent, awaiting signature</td></tr>
        <tr><td>Closed Won</td><td>Deal signed — ready to become a client</td></tr>
        <tr><td>Closed Lost</td><td>Deal did not proceed</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">How to Move a Lead</h2>
    <ul class="bullets">
      <li><strong>Drag the card</strong> to another column to move it to any stage</li>
      <li>Click the <strong>→ button</strong> on the card to advance it one stage forward</li>
    </ul>

    <h2 class="sub-title">How to Add a New Lead</h2>
    <ol class="steps">
      <li><span>Click <strong>"Add Lead"</strong> in the top-right corner.</span></li>
      <li><span>Enter the company name, contact name, and estimated value.</span></li>
      <li><span>Select the initial stage (usually New Lead).</span></li>
      <li><span>Click Save. The card will appear in the chosen column.</span></li>
    </ol>

    <h2 class="sub-title">Lead Detail</h2>
    <p>Click the <strong>card body</strong> (not the → button) to open the lead detail with 3 tabs:</p>
    <ul class="bullets">
      <li><strong>Info:</strong> Contact details, value, source, notes</li>
      <li><strong>Tasks:</strong> Action items for moving this lead forward</li>
      <li><strong>Notes:</strong> Free-form notes and updates</li>
    </ul>

    <div class="callout"><strong>Note</strong>Closed Won and Closed Lost cards cannot be advanced further. To reactivate a Closed Lost lead, drag it back to an earlier stage.</div>
  </div>


  <!-- ═══════════ SECTION 7 — BLOCKERS ═══════════ -->
  <div class="section" id="s7">
    <div class="section-number">Section 7</div>
    <h1 class="section-title">Blockers Page</h1>
    <p>The Blockers page shows all active impediments across every client. A blocker is anything preventing a task from being completed.</p>

    <h2 class="sub-title">Severity Levels</h2>
    <table>
      <thead><tr><th>Severity</th><th>Definition</th><th>Response Time</th></tr></thead>
      <tbody>
        <tr><td><span class="badge badge-red">High</span></td><td>Blocking critical path work; client delivery at risk</td><td>Resolve within 24 hours</td></tr>
        <tr><td><span class="badge badge-yellow">Med</span></td><td>Slowing progress but not immediately critical</td><td>Resolve within 3 days</td></tr>
        <tr><td><span class="badge badge-blue">Low</span></td><td>Minor impediment with a workaround available</td><td>Resolve within the week</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">Blocker Statuses</h2>
    <ul class="bullets">
      <li><strong>Open:</strong> Blocker identified, not yet being worked</li>
      <li><strong>In Progress:</strong> Actively being resolved</li>
      <li><strong>Resolved:</strong> Blocker cleared — task can continue</li>
    </ul>

    <h2 class="sub-title">Filtering</h2>
    <p>Use the <strong>Severity filter</strong> dropdown to view only High, Med, or Low blockers. The default shows all active blockers.</p>

    <div class="callout warn"><strong>Escalation Rule</strong>Any High-severity blocker older than 3 days will appear in the Owner Dashboard's "Aging Blockers" panel and will trigger the bonus condition failure. Resolve or escalate immediately.</div>
  </div>


  <!-- ═══════════ SECTION 8 — MEETINGS ═══════════ -->
  <div class="section" id="s8">
    <div class="section-number">Section 8</div>
    <h1 class="section-title">Meetings &amp; Reports</h1>
    <p>The Meetings page manages the agency's client meeting schedule and report delivery cadence.</p>

    <h2 class="sub-title">Meeting Schedule</h2>
    <p>Every active client has exactly <strong>2 meetings per month</strong>:</p>
    <ul class="bullets">
      <li><strong>Mid-Month Meeting:</strong> Around the 14th of the month</li>
      <li><strong>End-of-Month Meeting:</strong> Around the 27th of the month</li>
    </ul>
    <p>Meeting compliance is tracked as: <em>Meetings Completed ÷ Meetings Expected</em>. This feeds the Visibility pillar of the client risk score.</p>

    <h2 class="sub-title">Reports</h2>
    <ul class="bullets">
      <li><strong>Weekly Update:</strong> Generated every Friday for each active client</li>
      <li><strong>Monthly Report:</strong> The last Friday of the month — replaces the Weekly Update for that week</li>
    </ul>

    <div class="callout tip"><strong>Report Status</strong>Reports move through: Pending → In Progress → Sent. Mark a report as Sent only after the client has received and confirmed receipt.</div>
  </div>


  <!-- ═══════════ SECTION 9 — KEY CONCEPTS ═══════════ -->
  <div class="section" id="s9">
    <div class="section-number">Section 9</div>
    <h1 class="section-title">Key Concepts &amp; Terminology</h1>

    <h2 class="sub-title">The 16 Delivery Steps (Steps 0–15)</h2>
    <p>Every client moves through 16 steps from signing to full optimization. Tasks are mapped to specific steps, ensuring nothing is skipped.</p>
    <table>
      <thead><tr><th>Steps</th><th>Phase</th></tr></thead>
      <tbody>
        <tr><td>0–2</td><td>Onboarding (Client Signs, Account Setup, Kickoff)</td></tr>
        <tr><td>3–6</td><td>Foundation (Research, Strategy, Initial Builds)</td></tr>
        <tr><td>7–10</td><td>Launch (Go Live, Initial Optimizations)</td></tr>
        <tr><td>11–15</td><td>Optimization &amp; Scale (Weekly cadence, reporting, growth)</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">RACI Roles</h2>
    <table>
      <thead><tr><th>Role</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><span class="badge badge-purple">A/R</span></td><td><strong>Accountable + Responsible:</strong> This person does the work AND owns the outcome. Must log the deliverable URL (A/R Output) before the next step begins.</td></tr>
        <tr><td><span class="badge badge-blue">A</span></td><td><strong>Accountable only:</strong> Owns the outcome and approves the work, but delegates execution.</td></tr>
        <tr><td><span class="badge badge-green">R</span></td><td><strong>Responsible only:</strong> Does the work. Reports to the Accountable person.</td></tr>
        <tr><td>C</td><td><strong>Consulted:</strong> Asked for input. Two-way communication.</td></tr>
        <tr><td>I</td><td><strong>Informed:</strong> Kept in the loop. One-way communication.</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">Client Health Score</h2>
    <table>
      <thead><tr><th>Score Range</th><th>Health Status</th><th>Action Required</th></tr></thead>
      <tbody>
        <tr><td>0 – 25</td><td><span class="badge badge-green">Green</span> — Healthy</td><td>Routine monitoring</td></tr>
        <tr><td>26 – 45</td><td><span class="badge badge-yellow">Yellow</span> — At Risk</td><td>Investigate root cause this week</td></tr>
        <tr><td>46 – 100</td><td><span class="badge badge-red">Red</span> — Critical</td><td>Escalate immediately</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">4-Pillar Risk Score Breakdown</h2>
    <table>
      <thead><tr><th>Pillar</th><th>Max Points</th><th>Driven By</th></tr></thead>
      <tbody>
        <tr><td>Delivery</td><td>30</td><td>Task completion rate, overdue count, blocked count</td></tr>
        <tr><td>Sentiment</td><td>25</td><td>Client weekly review scores</td></tr>
        <tr><td>Performance</td><td>25</td><td>Campaign metrics (SEO, PPC, etc.)</td></tr>
        <tr><td>Visibility</td><td>20</td><td>Meeting compliance and on-time report delivery</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">Task Statuses</h2>
    <table>
      <thead><tr><th>Status</th><th>When to Use</th></tr></thead>
      <tbody>
        <tr><td><span class="badge badge-blue">Not Started</span></td><td>Task is in the backlog — work has not begun</td></tr>
        <tr><td><span class="badge badge-yellow">In Progress</span></td><td>Work is actively being done</td></tr>
        <tr><td><span class="badge badge-red">Blocked</span></td><td>Cannot proceed — a blocker must be logged explaining why</td></tr>
        <tr><td><span class="badge badge-green">Done</span></td><td>Work is complete and the A/R Output URL has been logged (if required)</td></tr>
      </tbody>
    </table>

    <h2 class="sub-title">10 Workstreams</h2>
    <ul class="bullets">
      <li><strong>Sales</strong> — Lead generation and pipeline management</li>
      <li><strong>Ops/PM</strong> — Project management and operations</li>
      <li><strong>AM</strong> — Account management and client relations</li>
      <li><strong>Tracking</strong> — Analytics setup and pixel/tag management</li>
      <li><strong>SEO</strong> — Search engine optimization</li>
      <li><strong>PPC</strong> — Paid search and Google Ads</li>
      <li><strong>Web/Dev</strong> — Website development and maintenance</li>
      <li><strong>Local/GBP</strong> — Local SEO and Google Business Profile</li>
      <li><strong>Social</strong> — Social media management</li>
      <li><strong>VA/Vendor</strong> — Virtual assistants and external vendor management</li>
    </ul>

    <div class="callout tip"><strong>Need Help?</strong>Click the <strong>?</strong> icon next to any tab or section header inside the app for contextual help. For further assistance, contact your Project Manager.</div>
  </div>

</div><!-- end .doc -->

<div style="background:#f8f9ff; border-top:1px solid #e0e7ff; text-align:center; padding:24px; font-size:12px; color:#6b7280;">
  JZ Smart Media — Operations Hub &nbsp;|&nbsp; Internal Use Only &nbsp;|&nbsp; Generated ${today}
</div>

</body>
</html>`
}

export function downloadSOPDoc(): void {
  const html = buildHTML()
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'JZ-Smart-Media-Operations-Guide.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
