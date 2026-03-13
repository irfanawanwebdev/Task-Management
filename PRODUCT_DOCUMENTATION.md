# JZ Smart Media — Operations Hub
## Complete Product Documentation
**Version:** 1.0  
**Date:** March 2026  
**Platform:** Internal Operations Management System  
---
# 1. Project Overview
| Field | Value |
|---|---|
| **Project Name** | JZ Smart Media — Operations Hub |
| **Purpose** | Internal operations management platform for a digital marketing agency |
| **Core Problem** | Centralizes client delivery tracking, team coordination, meeting management, reporting, and risk monitoring into a single system — replacing spreadsheets, scattered docs, and manual tracking |
| **Target Users** | Internal team members of JZ Smart Media (Owner, Project Manager, Specialists, Account Managers) |
| **High-Level Concept** | A role-based operational control tower that tracks the entire client lifecycle — from onboarding (Day 0) through ongoing delivery (Week 8+) — with RACI accountability, risk scoring, blocker monitoring, automated reporting, and bi-weekly meeting governance |
### Industry Context
JZ Smart Media is a digital marketing agency serving home services businesses (roofing, chimney, locksmith, garage door, restoration, builders). Services include SEO, PPC/LSA, Local/GBP optimization, social media, web development, and conversion rate optimization.
---
# 2. Product Vision
The JZ Smart Media Operations Hub is designed to be the **single source of truth** for all operational activity within the agency. The final system should achieve:
1. **Complete Delivery Visibility** — Every client task, from Day 0 onboarding to ongoing optimization, is tracked with clear ownership (RACI), timelines, impact levels, and QA gates.
2. **Risk Prevention** — A 4-pillar risk scoring system (Delivery, Sentiment, Performance, Visibility) automatically calculates client health, catching at-risk accounts before they churn.
3. **Meeting Governance** — A strict bi-weekly meeting cadence (Mid-Month Review + End-of-Month Review) with compliance tracking ensures no client is neglected.
4. **Automated Reporting** — Weekly and monthly reports are auto-generated from completed tasks, eliminating manual report creation.
5. **Role-Based Access** — Each team member sees only what's relevant to their role, with specialists seeing only their assigned workstreams and clients.
6. **External Integration Readiness** — The platform is designed to connect with Google Calendar, Zoom, Calendly, Google Drive, and Notion when integrations are implemented.
7. **Accountability & Transparency** — QA gates enforce that every step's output must be documented before the next step begins. The system tracks blocker aging, owner-dependent items, and SLA compliance.
---
# 3. User Personas
## 3.1 Owner / Admin
- **Role:** `owner`
- **Department:** Executive
- **Goals:**
  - Monitor overall agency performance at a glance
  - Track client health and identify at-risk accounts
  - Verify bi-weekly meeting compliance
  - Monitor bonus condition fulfillment
  - Manage team members and assign roles
- **Access:** Full visibility into everything — executive dashboard, PM dashboard, all clients, RACI matrix, meetings, internal docs, user management, settings
## 3.2 Project Manager (PM)
- **Role:** `project_manager`
- **Department:** Operations
- **Goals:**
  - Manage day-to-day client delivery across all workstreams
  - Track task completion rates (target: 85–90%)
  - Monitor blockers and resolve them quickly
  - Coordinate bi-weekly meetings and ensure SLA compliance
  - Generate and send weekly/monthly reports
  - Create and assign tasks to specialists
- **Access:** PM dashboard, all clients, RACI matrix, meetings & reports, internal workspace, settings
## 3.3 Specialist (SEO, Ads Manager, Web Developer, Social Media)
- **Roles:** `web_developer`, `seo`, `ads_manager`, `social_media`
- **Departments:** `web_dev`, `seo`, `ads`, `social`
- **Goals:**
  - View and complete tasks assigned to their department
  - See only clients with active work in their workstream
  - Track their own deadlines and blockers
  - Access meeting schedules relevant to their work
- **Access:** Specialist dashboard, My Tasks, Meetings
## 3.4 Account Manager (AM)
- **Role:** `account_manager`
- **Department:** Account Management
- **Goals:**
  - Manage client relationships
  - Track client-facing deliverables
  - Coordinate between specialists and clients
  - Handle meeting scheduling and follow-ups
- **Access:** Specialist dashboard, My Tasks, Meetings
## 3.5 Viewer
- **Role:** `viewer`
- **Goals:** Read-only access to their dashboard
- **Access:** Dashboard only (no editing capabilities)
---
# 4. Core Modules
## 4.1 Authentication & User Management
Internal email/password authentication with role-based access control (RBAC). Supports multi-role assignments (e.g., one user can be both Project Manager and Social Media Manager). Includes a one-time admin bootstrap flow for initial setup.
## 4.2 PM Dashboard (Operations Control Tower)
The primary operational view for Project Managers. Displays 5 executive metrics, client risk scores, high-impact tasks, overdue/blocked items, blocker monitor, upcoming meetings, daily PM checklist, and reports due.
## 4.3 Owner/Executive Dashboard
High-level performance summary with KPIs, bonus conditions tracker, client health table, and aging blockers.
## 4.4 Specialist Dashboard
Personalized view showing assigned tasks, due dates, blockers, and meetings for the logged-in specialist.
## 4.5 Client Management (CRM)
Client directory with health scoring, risk scores, completion rates, and drill-down into individual client hubs with tabs for Onboarding, Overdue, Blockers, Credentials, Reports, Meetings, Upsell, and Risk Log.
## 4.6 Task Management
Master task database tracking all 16 delivery steps across all clients. Supports views by Timeline, Workstream, QA Gate, Blocked, Overdue, and Next Step Ready. Tasks follow RACI assignments.
## 4.7 RACI Matrix
Visual reference showing responsibility assignments (A/R, A, R, C, I) across all 10 workstreams for all 16 delivery steps.
## 4.8 Meetings & Reports
Bi-weekly meeting coordination hub with meeting scheduling, compliance tracking, automated reporting, and owner-dependency tracking. Includes report generation for Weekly Updates and Monthly Reports.
## 4.9 Blockers & Risks
Centralized blocker monitoring with severity levels (High/Med/Low), status tracking, aging indicators, and resolution notes.
## 4.10 Internal Workspace (Reference Hub)
Static reference area containing:
- Client Onboarding & Delivery SOP (Day 0 → Week 8+)
- Social Media Scope and Instructions
- Reports checklist (required elements)
- Active Clients directory with Google Drive and Credentials links
## 4.11 Settings & Connectors
Configuration page for external service integrations (Google Calendar, Meet, Zoom, Calendly, Google Drive, Notion). Currently UI-only — awaiting developer implementation of OAuth flows.
---
# 5. Detailed Feature Breakdown
## 5.1 Authentication System
### Login
- **Description:** Email/password authentication
- **User Actions:** Enter email + password → Submit
- **System Behavior:** Validates credentials against Supabase Auth, fetches profile and role, redirects to role-appropriate dashboard
- **Edge Cases:** Invalid credentials show error; deactivated users see "Account Deactivated" screen
- **Dependencies:** Supabase Auth, `profiles` table, `user_roles` table
### First-Time Admin Setup
- **Description:** One-time bootstrap flow when no users exist
- **User Actions:** Click "First time? Set up admin account" → Enter name, email, password → Submit
- **System Behavior:** Creates user via `supabase.auth.signUp`, calls `setup_first_admin` RPC which only succeeds if no roles exist yet, assigns `project_manager` role
- **Edge Cases:** If admin already exists, shows error; bootstrap gate locks permanently after first admin
- **Dependencies:** `setup_first_admin` database function
### User Creation (Admin)
- **Description:** Owner/PM can create new team members
- **User Actions:** Click "Add User" → Fill name, email, password, department, roles (multi-select) → Submit
- **System Behavior:** Calls `create-user` edge function which verifies caller has owner/PM role, creates user via admin API with email auto-confirmed, inserts profile and roles
- **Edge Cases:** Duplicate email, missing fields, unauthorized caller
- **Dependencies:** `create-user` edge function, Supabase Admin API
### Role Management
- **Description:** Add/remove roles for existing users
- **User Actions:** Click role badge to remove; use dropdown to add new role
- **System Behavior:** Inserts/deletes from `user_roles` table; user must always have at least 1 role
- **Edge Cases:** Cannot remove last role
### Account Activation/Deactivation
- **Description:** Toggle user active status
- **User Actions:** Toggle switch on user card
- **System Behavior:** Updates `is_active` on `profiles` table; deactivated users see "Account Deactivated" on login
- **Edge Cases:** Cannot deactivate self (not enforced in current version — **assumption**)
---
## 5.2 PM Dashboard
### Executive Control Panel (5 Metrics)
| Metric | Calculation | Thresholds |
|---|---|---|
| Global Completion % | (Done tasks with due dates) / (All tasks with due dates) × 100 | ≥95% Excellent, ≥90% Very Good, ≥85% Acceptable, <85% Alert |
| High-Impact Rate % | (Done high-impact tasks) / (All high-impact tasks) × 100 | Same thresholds |
| Overdue (All Depts) | Tasks where dueDate < today AND status ≠ Done | >0 = Alert |
| Overdue (Ops/PM) | Subset of above where R or A includes Ops/PM | >0 = Alert |
| Blocked Tasks | Tasks where status = Blocked | >0 = Destructive |
- **Contract target:** 85–90% completion rate
- **Note:** Meetings excluded from task completion — tracked separately
### Client Risk Scores
- **4-Pillar System:**
  - Delivery: 0–30 points (based on task completion, overdue count, blocked count)
  - Sentiment: 0–25 points (from weekly reviews)
  - Performance: 0–25 points (performance metrics)
  - Visibility: 0–20 points (meeting compliance, report delivery)
- **Scoring:** System Score + Weekly Adjustment = Final Score
- **Health Mapping:** 0–25 = Green, 26–45 = Yellow, 46–100 = Red
- **Trend:** Last 3 weeks displayed with directional arrows
- **Expandable:** Click card to see full risk breakdown
### High-Impact Tasks Today
- Tasks where `dueDate === today` AND `impactLevel === 'High'` AND `status !== 'Done'`
- Clickable to open Task Detail Dialog
### Overdue Split View
- Left panel: All departments overdue (max 8 shown)
- Right panel: Ops/PM overdue only
### Blocker Monitor
- Shows formal blockers from BLOCKERS array (with aging in days, severity badge)
- Also shows blocked tasks from ALL_TASKS
- Critical highlight for blockers older than 3 days
### Client Meetings This Week
- Next 8 upcoming scheduled meetings
- Integration badges: Google Calendar, Zoom, Gmail, Calendly (visual only)
- Shows meeting type, Google Calendar link
### Daily PM Checklist
- 4 items: Updates, Reports, Risks, Blockers
- Manual checkbox toggle (not persisted)
### Reports Due This Week
- One card per active client showing Weekly Update status
- Last Friday of month converts to Monthly Report
- Click to open Weekly Report Generator
---
## 5.3 Client Management
### Clients Page (CRM Table)
| Column | Description |
|---|---|
| Client | Name + start date |
| Status | Active, Onboarding, At Risk, Paused, Offboarding |
| Health | Green/Yellow/Red dot + label |
| Risk Score | Numeric score with health color |
| Completion | Percentage bar |
| Overdue | Count (red if >0) |
| Blocked | Count (red if >0) |
| Next Meeting | Date + type |
| Workstreams | Badge chips |
- Click row → Navigate to Client Detail Page
### Client Detail Page
**Header:** Client name, health badge, status badge, start date, workstreams, PM, AM  
**Action:** "New Task" button → opens Task Create Dialog
**Quick Stats Row (7 metrics):**
- Completion %, Overdue count, Blocked count, Risk Score, Next Meeting, Completed count, High Impact Open
**Risk Trend:** Visual trend line showing last 3 weeks with directional indicators
**Tabbed Sections:**
| Tab | Content |
|---|---|
| **Onboarding** | Checklist of foundation phase tasks (Day 0 – Week 2), sorted by step |
| **Overdue** | Tasks past due date, sorted by date |
| **Blockers** | Formal blockers with aging + blocked tasks |
| **Credentials** | Link to client's Google Sheet for credentials (KeyRound icon + "Open Credentials Sheet" button) |
| **Reports** | End-of-Month and Mid-Month review entries with status and report links |
| **Meetings** | Full meeting history with recap links and status badges |
| **Upsell** | Auto-generated upsell opportunities based on current workstreams and completion rate |
| **Risk Log** | Full risk assessment with 4-pillar breakdown, latest weekly review with sentiment/engagement/retention |
---
## 5.4 Task Management
### Task Database Views
| View | Filter |
|---|---|
| Timeline | All tasks grouped by Step Name |
| By Workstream | Grouped by workstream (SEO, PPC, etc.) |
| QA Gate | Tasks with outputs not yet logged (`arOutputLogged === false` AND status ≠ Not Started) |
| Blocked | Tasks where status = Blocked |
| Overdue | Tasks past due date AND status ≠ Done |
| Next Step Ready | Tasks where A/R output is logged AND status = Done |
**Client Filter:** Dropdown to filter by specific client or "All Clients"
**QA Gate Warning Banner:** Appears when viewing QA Gate — "These tasks have outputs not yet logged. Next steps are blocked until A/R output is confirmed."
**Table Columns:** Client, Timeline, Workstream, R, A, Status, A/R Logged (✓/✗), Due Date
### Task Detail Dialog
- Status + Impact badges
- Description
- Task Details grid (Client, Workstream, Timeline, Impact, Due Date, Completed, A/R Output Logged, Status)
- RACI Assignments (R, A, C, I)
- Blocker details (if blocked) — description, severity, owner, created date, resolution notes
- Output/Attachment links
- Related Tasks for same client (max 10, sorted by step)
### Task Create Dialog
**Required Fields:**
- Task Name
- Due Date
- Assignee (PM, AM, SEO, PPC, Web/Dev, Local/GBP, Social, Tracking, VA/Vendor)
- Impact Level (High/Medium/Low)
- Department (SEO, Ads/PPC, Social, Web/Dev, Local/GBP, Reporting, Onboarding)
**Optional Fields:**
- Definition of Done (textarea)
- Dependencies / Blockers (textarea)
- Client-facing risk if delayed? (toggle)
- Attachments / Links
**Conditional Fields (Web/Dev + "asset" in name):**
- Which assets exactly?
- Format / Resolution
- Where to send?
- Client contact for assets
- Client deadline
---
## 5.5 RACI Matrix
### 16 Delivery Steps
| Step | Name | Timeline |
|---|---|---|
| 0 | Client Signs | Day 0 |
| 1 | Payment + Welcome | Day 1 |
| 2 | Kickoff Call | Day 1 |
| 3 | Access & Assets | Day 2 |
| 4 | Tracking Verified | Week 1 |
| 5 | Strategy + Competitors | Week 1 |
| 6 | Website SEO Foundation | Week 1 |
| 7 | Baseline Report | Week 2 |
| 8 | Citations | Week 3 |
| 9 | City Pages | Week 3 |
| 10 | GBP Optimization | Week 3 |
| 11 | Reviews + Lead Platforms | Week 3 |
| 12 | CRO Improvements | Week 4 |
| 13 | Google Ads + LSA Launch | Week 4 |
| 14 | Social Setup + Content | Week 5 |
| 15 | Optimization + Scale | Week 6 |
### 10 Workstreams
Sales, Ops/PM, AM, Tracking, SEO, PPC, Web/Dev, Local/GBP, Social, VA/Vendor
### RACI Roles
- **A/R** — Accountable AND Responsible (primary owner)
- **A** — Accountable (approver)
- **R** — Responsible (doer)
- **C** — Consulted
- **I** — Informed
### QA Gate Rule
> If a step's A/R output isn't completed and logged in the PM system, the next step does not start. Every task requires the "A/R output logged" checkbox to be checked before downstream steps can proceed.
---
## 5.6 Meetings & Reports
### Meeting Governance Rules
- **Cadence:** Exactly 2 meetings per client per month (bi-weekly)
  - Mid-Month Review (~14th): Progress, blockers, adjustments, visibility
  - End-of-Month Review (~27th): Performance review, report delivery, roadmap alignment
- **Weekly meetings prohibited by default**
- **Owner Requested** meetings: Separate category, not counted in compliance
### Meeting Metrics (Reset Monthly)
| Metric | Calculation |
|---|---|
| Bi-Weekly Scheduled | Count of scheduled bi-weekly meetings |
| Bi-Weekly Completed | Completed / Expected (clients × 2) |
| Meeting Completion Rate | Completed ÷ Expected × 100 |
| Meeting Compliance % | Average of (completed/2) across all clients |
| Owner Requested | Count (not in compliance calc) |
| Blocked / Risk Items | Blocked tasks + unresolved blockers |
### Meeting Views
- Meetings Scheduled
- By Client (grouped)
- This Week
- Last 14 Days
- This Month
- Bi-Weekly Completed
- Owner Requested
### Meeting Types
| Type | Trigger |
|---|---|
| Kickoff | New client onboarding |
| Mid-Month Review | Recurring (~14th) |
| End-of-Month Review | Recurring (~27th) |
| Owner Requested | Manual, not in compliance |
### Meeting Fields
| Field | Description |
|---|---|
| id | Unique identifier |
| clientId | Linked client |
| type | Kickoff, Mid-Month, End-of-Month, Owner Requested |
| date | Meeting date |
| time | Meeting time (optional) |
| agenda | Pre-set based on type |
| recapLink | Link to recap document |
| reportLink | Link to report |
| meetingLink | Video call link |
| calendarEventLink | Google Calendar link |
| deliverableLink | Deliverable document |
| recap | Meeting notes |
| status | Not Scheduled, Scheduled, Completed, Overdue |
| ownerApprovalRequired | Boolean |
| sla | "Recap within 24 hours", etc. |
| slaDue | SLA deadline date |
| slaMet | Boolean |
| calendarSource | Google, Calendly, Zoom (optional) |
### Meeting Table Columns
Date, Client, Type, Status, Google Calendar button, Agenda preview, SLA status
### Owner Dependency Tracking
- Table showing tasks where progress depends on Owner
- Columns: Client, Task, Workstream, Impact, Status, Due, "Depends On: Owner" badge
### Kickoff Planning Reminders
- Auto-detected: Kickoff meetings where Day 0 planning tasks haven't started
- Warning cards with client name and kickoff date
### Automated Reporting (Task Views)
| View | Filter |
|---|---|
| Weekly Done | Done tasks with completedDate in last 7 days |
| Done in 7 Days | Same |
| Done in 14 Days | Done in last 14 days |
| Monthly Done | Done this calendar month |
| Blocked / Risk | Blocked or has blocker field |
| By Client | Monthly done grouped by client |
### Report Generation System
#### Weekly Report
- **Trigger:** Click on report card in PM Dashboard or Meetings page
- **Content auto-generated:**
  1. Executive Summary (completed count, high-impact count, key wins)
  2. Delivery Summary (table: Task, Category, Impact, Completed Date)
  3. Performance Highlights
  4. Proof of Performance (output links)
  5. Next Week Focus (upcoming tasks)
- **Export Options:** Export PDF, Save to Reports, Generate + Email Client
#### Monthly Report
- Same structure as weekly with additions:
  - Performance Summary section
  - "Pending Items Requiring Owner Action" section
  - Next Month Priorities
### Report Cadence Rules
- **Weekly Update:** Every Friday, one per active client
- **Monthly Report:** Last Friday of month, replaces that week's update
- **PM Dashboard:** Acts as reminder system (Pending → Sent)
- **Meetings & Reports page:** Centralized generation hub
---
## 5.7 Blockers & Risks
### Blocker Fields
| Field | Type |
|---|---|
| id | String |
| clientId | String |
| workstream | Workstream enum |
| description | String |
| owner | String (person name) |
| severity | High / Med / Low |
| status | Open / In Progress / Resolved |
| dueDate | Date string |
| createdDate | Date string |
| resolutionNotes | String |
### Blocker Page
- Sorted by severity (High → Med → Low), then by status
- Header shows count of open blockers
- Each blocker card shows: Severity badge, Status badge, Description, Client, Workstream, Owner, Due date, Resolution notes
### Blocker Aging
- System calculates days since `createdDate`
- Critical highlight when age > 3 days
- Displayed as `{n}d` badge
---
## 5.8 Internal Workspace
### SOP Page (Client Onboarding & Delivery SOP)
Full static document with 6 phases:
- **Phase 0:** Client Activation (Step 0)
- **Phase 1:** Onboarding (Steps 1–3)
- **Phase 2:** Foundation (Steps 4–6)
- **Phase 3:** Visibility Build (Steps 7–11)
- **Phase 4:** Growth Activation (Steps 12–13)
- **Phase 5:** Social & Content (Step 14)
- **Phase 6:** Optimization & Scale (Step 15)
- **Beyond Week 8:** Continuous Delivery Loop
Each step includes: Trigger/Actions, Required Output, QA gate verification
### Social Media Page
Three sections:
1. Content System (1-month calendar, repurpose job photos, posting SOP)
2. Weekly Posts (2–4/week, before/after, local proof)
3. Social Setup (FB/IG/YouTube/LinkedIn, brand consistency)
### Reports Checklist
12 required elements for every client report:
- CallRail data, social media activity, locations/pages created, GBP posts, LSA status, Yelp Ads data, advertising campaigns, citations, SEO/backlinks, purchased followers/reviews, website traffic (Clarity), Local Falcon results
### Active Clients Directory
- Lists all clients with click-through to detail page
- Each client detail shows: Google Drive folder link, Credentials Google Sheet link
---
## 5.9 Settings & Connectors
### Available Connectors (UI Ready, Integration Pending)
| Connector | Category | Description | API Docs |
|---|---|---|---|
| Google Calendar | Calendar | Sync meetings, detect changes, auto-update | developers.google.com/calendar |
| Google Meet | Communication | Capture meeting links from events | developers.google.com/meet |
| Zoom | Communication | Detect Zoom meetings, display links | developers.zoom.us |
| Calendly | Calendar | Import client-booked meetings | developer.calendly.com |
| Google Drive | Storage | Attach documents, link agendas/reports | developers.google.com/drive |
| Notion | Productivity | Sync databases, import task lists | developers.notion.com |
### Connector Card UI
- Icon + Name + Status badge (Connected / Not Connected)
- Description
- Connected account + last sync timestamp (when connected)
- Connect / Disconnect button
- Sync button (when connected)
- API docs external link
### Developer Integration Guide (In-App)
1. Create OAuth credentials in developer console
2. Store client ID and secret as backend secrets
3. Implement OAuth redirect flow in backend function
4. Store access/refresh tokens per user in `connector_tokens` table
5. Create sync functions (poll or webhook)
6. Update `handleConnect` to trigger OAuth flow
---
# 6. Complete UI Structure
## 6.1 Login Page (`/login`)
- **Purpose:** Authenticate internal team members
- **Components:** Branded header (JZ logo), email input, password input (with show/hide toggle), Login button, "First time? Set up admin account" link
- **Setup Mode:** Name, email, password → Create Admin Account
- **Navigation:** Redirects to role-appropriate dashboard on success
## 6.2 PM Dashboard (`/`)
- **Purpose:** Operations Control Tower for Project Managers
- **Access:** PM + Owner
- **Components:** Executive Control Panel (5 metrics), Client Risk Score cards (expandable), High-Impact Tasks Today, Overdue Split View, Blocker Monitor, Client Meetings (with integration badges), Daily PM Checklist, Reports Due This Week
- **Navigation:** Click client → Client Detail; Click task → Task Detail Dialog; Click report → Report Generator
## 6.3 Owner Dashboard (`/owner`)
- **Purpose:** Executive performance summary
- **Access:** Owner only
- **Components:** KPI row (5 metrics), Bonus Conditions Tracker (5 conditions), Client Health Summary table, Aging Blockers list
## 6.4 Specialist Dashboard (`/specialist`)
- **Purpose:** Personal workspace for specialists
- **Access:** All specialist roles + viewer
- **Components:** Welcome header, 4 stat cards (My Tasks, Due This Week, Blocked, Meetings), empty state placeholder
## 6.5 Tasks Page (`/tasks`)
- **Purpose:** Master task database
- **Access:** All authenticated users
- **Components:** View tabs (Timeline, Workstream, QA Gate, Blocked, Overdue, Next Ready), Client filter dropdown, grouped task tables, Task Detail Dialog
## 6.6 Clients Page (`/clients`)
- **Purpose:** Client CRM directory
- **Access:** PM + Owner
- **Components:** Full CRM table with 10 columns, clickable rows
## 6.7 Client Detail Page (`/clients/:clientId`)
- **Purpose:** Complete client hub
- **Access:** PM + Owner
- **Components:** Header with badges, Quick Stats (7 metrics), Risk Trend, 8-tab interface (Onboarding, Overdue, Blockers, Credentials, Reports, Meetings, Upsell, Risk Log), Task Create Dialog
## 6.8 RACI Matrix Page (`/raci`)
- **Purpose:** Responsibility reference
- **Access:** PM + Owner
- **Components:** Legend (A/R, A, R, C, I), scrollable matrix table, QA Gate rule callout
## 6.9 Blockers Page (`/blockers`)
- **Purpose:** Blocker oversight
- **Access:** All authenticated users
- **Components:** Open blocker count, sorted blocker cards with severity/status badges
## 6.10 Meetings & Reports Page (`/meetings`)
- **Purpose:** Bi-weekly coordination center
- **Access:** All authenticated users
- **Components:** 6 top metrics, client filter, bi-weekly completion grid, kickoff reminders, meeting views (7 tabs), meeting table, owner dependency table, task reporting views (6 tabs), report generator integration
## 6.11 Internal Workspace (`/instructions`)
- **Purpose:** Central reference hub
- **Access:** PM + Owner
- **Components:** 4 section cards linking to sub-pages
### Sub-pages:
- `/instructions/sops` — Full SOP document (16 steps)
- `/instructions/social` — Social media scope
- `/instructions/reports` — Report requirements checklist
- `/instructions/clients` — Active client directory
- `/instructions/clients/:clientId` — Client Drive + Credentials links
## 6.12 Admin / User Management (`/admin`)
- **Purpose:** Team member management
- **Access:** Owner + PM
- **Components:** "Add User" dialog, team member list with role badges, add/remove role dropdowns, active/inactive toggle
## 6.13 Settings / Connectors (`/settings`)
- **Purpose:** External integration configuration
- **Access:** Owner + PM
- **Components:** Connector cards by category, connect/disconnect/sync buttons, developer guide
## 6.14 Not Found (`*`)
- Generic 404 page
---
# 7. User Flow Diagrams (Text-Based)
## 7.1 First-Time Platform Setup
```
1. Navigate to /login
2. Click "First time? Set up admin account"
3. Enter: Full Name, Email, Password
4. Click "Create Admin Account"
5. System calls setup_first_admin RPC
6. If no roles exist → creates profile + assigns project_manager role
7. Page reloads → user is logged in → redirected to PM Dashboard
8. Navigate to /admin → Add additional team members
```
## 7.2 Creating a New Team Member
```
1. Owner/PM navigates to /admin
2. Clicks "Add User"
3. Fills: Name, Email, Temporary Password, Department, Roles (multi-select)
4. Clicks "Create User"
5. System calls create-user edge function
6. Edge function verifies caller role → creates user via Admin API → inserts profile + roles
7. New user appears in team list
8. New user can log in with temporary credentials
```
## 7.3 Client Delivery Workflow
```
1. Client signs → Step 0 task created
2. PM assigns onboarding tasks (Steps 1-3) in Client Detail
3. Each step has RACI assignments → specialists see tasks in their dashboard
4. Specialist completes task → marks as Done → checks A/R output logged
5. QA Gate: If output not logged, next step cannot proceed
6. PM monitors progress via PM Dashboard metrics
7. Blockers logged when tasks are stuck
8. Bi-weekly meetings scheduled automatically (Mid-Month + End-of-Month)
9. Weekly reports auto-generated from completed tasks
10. Risk score updates based on delivery progress, sentiment, meetings
```
## 7.4 Scheduling a Meeting
```
1. System auto-generates 2 meetings per client per month
   - Mid-Month Review (~14th)
   - End-of-Month Review (~27th)
2. PM views in Meetings & Reports page
3. Clicks Google Calendar link → creates event in Google Calendar
4. Meeting status: Not Scheduled → Scheduled → Completed
5. SLA: Recap due within 24 hours
6. Compliance tracked: Completed ÷ 2 per client
```
## 7.5 Generating a Report
```
1. PM Dashboard shows "Reports Due This Week" section
2. One card per active client (Pending status)
3. PM clicks client report card
4. Weekly Report Generator opens:
   a. Shows preview: completed tasks, high-impact count, next week focus
   b. Click "Generate Report"
   c. Report preview rendered with sections:
      - Executive Summary
      - Delivery Summary
      - Performance Highlights
      - Proof of Performance
      - Next Week Focus
5. Export options: PDF, Save to Reports, Email Client
6. Status updates to "Submitted"
```
## 7.6 Managing Clients
```
1. PM navigates to /clients
2. CRM table shows all clients with health/risk/completion metrics
3. Click client row → opens Client Detail (/clients/:id)
4. Client Detail shows:
   - Quick stats row
   - Risk trend
   - Tabbed sections (8 tabs)
5. PM can:
   - Create new tasks (via "New Task" button)
   - View onboarding progress
   - Check credentials (link to Google Sheet)
   - Review blocker status
   - Access meeting history
   - Identify upsell opportunities
   - Review risk assessment
```
## 7.7 Blocker Resolution Flow
```
1. Blocker detected (task marked as Blocked, or formal blocker created)
2. Appears in:
   - PM Dashboard → Blocker Monitor
   - Client Detail → Blockers tab
   - Blockers page
3. Shows: severity, owner, age, client, workstream
4. Age > 3 days → critical highlight (red background)
5. Owner resolves → updates status to "Resolved" → adds resolution notes
6. Blocked tasks can be moved to "In Progress" → "Done"
```
---
# 8. Database Architecture (Conceptual)
## 8.1 Current Database Schema (Supabase)
### `profiles` table
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| user_id | UUID | References auth.users |
| full_name | String | Required |
| department | Enum (app_department) | Nullable |
| is_active | Boolean | Default: true |
| created_at | Timestamp | Auto |
| updated_at | Timestamp | Auto |
### `user_roles` table
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| user_id | UUID | References auth.users |
| role | Enum (app_role) | Required |
| | | Unique constraint: (user_id, role) |
### Enums
**app_role:** `project_manager`, `web_developer`, `seo`, `ads_manager`, `social_media`, `owner`, `account_manager`, `viewer`
**app_department:** `operations`, `web_dev`, `seo`, `ads`, `social`, `account_management`, `executive`
### Database Functions
| Function | Purpose |
|---|---|
| `get_user_role(_user_id)` | Returns primary role for a user |
| `has_role(_user_id, _role)` | Checks if user has specific role (security definer) |
| `setup_first_admin(_user_id, _department?)` | One-time admin bootstrap (only works when no roles exist) |
## 8.2 Future Database Tables (Currently In-Memory)
> **Note:** The current implementation uses static in-memory data (`src/lib/data.ts`). The following tables should be created when migrating to a database-backed system.
### `clients`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | String | Required |
| status | Enum | Active, Onboarding, At Risk, Paused, Offboarding |
| start_date | Date | |
| owner_pm | UUID | FK to profiles |
| account_manager | UUID | FK to profiles |
| primary_workstreams | Array<String> | |
| health | Enum | Green, Yellow, Red |
| notes | Text | |
| drive_folder_url | String | |
| credentials_sheet_url | String | |
| website_url | String | |
| gbp_url | String | |
| ad_accounts_url | String | |
| created_at | Timestamp | |
| updated_at | Timestamp | |
### `delivery_tasks`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| client_id | UUID | FK to clients |
| timeline | Enum | Day 0 through Ongoing |
| step | Integer | 0–15 |
| step_name | String | |
| workstream | Enum | |
| responsible | Array<String> | RACI R |
| accountable | Array<String> | RACI A |
| consulted | Array<String> | RACI C |
| informed | Array<String> | RACI I |
| status | Enum | Not Started, In Progress, Blocked, Done |
| output_link | String | |
| ar_output_logged | Boolean | QA Gate |
| due_date | Date | |
| completed_date | Date | |
| description | Text | |
| blocker | Text | |
| impact_level | Enum | High, Medium, Low |
| created_at | Timestamp | |
| updated_at | Timestamp | |
### `blockers`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| client_id | UUID | FK to clients |
| workstream | Enum | |
| description | Text | |
| owner | UUID | FK to profiles |
| severity | Enum | High, Med, Low |
| status | Enum | Open, In Progress, Resolved |
| due_date | Date | |
| created_date | Date | |
| resolution_notes | Text | |
### `meetings`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| client_id | UUID | FK to clients |
| type | Enum | Kickoff, Mid-Month Review, End-of-Month Review, Owner Requested |
| date | Date | |
| time | Time | Optional |
| agenda | Text | |
| recap_link | String | |
| report_link | String | |
| meeting_link | String | Video call URL |
| calendar_event_link | String | |
| deliverable_link | String | |
| recap | Text | |
| status | Enum | Not Scheduled, Scheduled, Completed, Overdue |
| owner_approval_required | Boolean | |
| sla | Enum | |
| sla_due | Date | |
| sla_met | Boolean | |
| notes | Text | |
| calendar_source | Enum | Google, Calendly, Zoom |
### `weekly_reviews`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| client_id | UUID | FK to clients |
| week | Integer | |
| date | Date | |
| sentiment_observed | Enum | Positive, Neutral, Concerned, Negative |
| engagement_level | Enum | High, Medium, Low, Disengaged |
| confidence_in_retention | Enum | Strong, Moderate, At Risk, Critical |
| hidden_risk_signals | Text | |
| strategic_notes | Text | |
| adjustment_score | Integer | -10 to +20 |
### `sops`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | String | |
| category | Enum | Onboarding, Local/GBP, PPC/LSA, Web/Dev, SEO, Social, Reporting, Operations |
| workstream | Enum | |
| owner | String | |
| last_updated | Date | |
| link | String | |
| status | Enum | Draft, Active, Needs Review |
| related_step | Integer | Optional |
| notes | Text | |
| content | Array<String> | |
### `reports`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| client_id | UUID | FK to clients |
| report_type | Enum | Weekly Update, Monthly Report |
| report_name | String | |
| due_date | Date | |
| status | Enum | Pending, In Progress, Sent |
| generated_content | JSONB | |
| sent_at | Timestamp | |
### `connector_tokens` (Future)
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID | FK to profiles |
| connector_id | String | google-calendar, zoom, etc. |
| access_token | Text | Encrypted |
| refresh_token | Text | Encrypted |
| expires_at | Timestamp | |
| account_email | String | |
| last_sync | Timestamp | |
### Example Records
**Client:**
```json
{
  "id": "c1",
  "name": "OakTree Chimney Solutions",
  "status": "Active",
  "start_date": "2025-11-01",
  "primary_workstreams": ["SEO", "PPC", "Local/GBP"],
  "health": "Green"
}
```
**Task:**
```json
{
  "id": "t1",
  "client_id": "c1",
  "step": 4,
  "step_name": "Tracking Verified",
  "timeline": "Week 1",
  "workstream": "Tracking",
  "responsible": ["Tracking"],
  "accountable": ["Ops/PM"],
  "status": "Done",
  "impact_level": "High",
  "ar_output_logged": true
}
```
**Blocker:**
```json
{
  "id": "b1",
  "client_id": "c3",
  "description": "Client has not provided Google Ads credentials",
  "workstream": "Ops/PM",
  "severity": "High",
  "status": "Open",
  "owner": "Alice Tui Luc"
}
```
---
# 9. Permissions & Access Control
## 9.1 Role-Based Navigation
| Role | Navigation Items |
|---|---|
| **Owner** | Executive Dashboard, PM Dashboard, Clients, RACI Matrix, Meetings & Reports, Internal, User Management, Settings |
| **Project Manager** | PM Dashboard, Clients, RACI Matrix, Meetings & Reports, Internal, Settings |
| **Specialists** (Web Dev, SEO, Ads, Social, AM) | My Dashboard, My Tasks, Meetings |
| **Viewer** | Dashboard (read-only) |
## 9.2 Route Protection
| Route | Allowed Roles |
|---|---|
| `/` (PM Dashboard) | project_manager, owner |
| `/owner` | owner |
| `/specialist` | All authenticated |
| `/tasks` | All authenticated |
| `/clients` | project_manager, owner |
| `/clients/:id` | project_manager, owner |
| `/raci` | project_manager, owner |
| `/blockers` | All authenticated |
| `/meetings` | All authenticated |
| `/instructions/*` | project_manager, owner |
| `/admin` | owner, project_manager |
| `/settings` | owner, project_manager |
## 9.3 Security Model
- **Authentication:** Supabase Auth with email/password
- **Role Storage:** Separate `user_roles` table (not on profile — prevents privilege escalation)
- **Role Checking:** Server-side via `has_role` security definer function
- **Multi-Role Support:** Users can have multiple roles; permissions are aggregated
- **Deactivation:** `is_active` flag on profiles; deactivated users see "Account Deactivated"
- **User Creation:** Only via edge function with caller role verification (owner/PM)
- **No anonymous signups** — all users created by admin
## 9.4 Specialist Visibility Rules (Planned)
- Specialists see only clients with active tasks in their department
- Web Developer → only clients with Web/Dev tasks
- SEO → only clients with SEO tasks
- Ads Manager → only clients with PPC tasks
- Social Media → only clients with Social tasks
---
# 10. System Architecture Recommendation
## 10.1 Current Stack
| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui components |
| **State Management** | React hooks + TanStack React Query |
| **Routing** | React Router v6 |
| **Backend** | Supabase (Auth, Database, Edge Functions) |
| **Database** | PostgreSQL (via Supabase) |
| **Authentication** | Supabase Auth (email/password) |
| **Edge Functions** | Deno (Supabase Edge Functions) |
## 10.2 Platform-Independent Recommendation
### Frontend
- **Framework:** React, Vue, or Next.js
- **Language:** TypeScript
- **CSS:** Tailwind CSS with design system tokens
- **Components:** shadcn/ui or Radix UI primitives
- **Charts:** Recharts or Chart.js
- **State:** React Query for server state, React hooks for UI state
### Backend
- **API:** Node.js (Express/Fastify) or Next.js API routes
- **Language:** TypeScript
- **ORM:** Prisma or Drizzle
- **Authentication:** NextAuth, Clerk, or custom JWT
### Database
- **Primary:** PostgreSQL
- **ORM:** Prisma for type-safe queries
- **Migrations:** Prisma Migrate or raw SQL
### Authentication
- **Provider:** Supabase Auth, Auth0, Clerk, or NextAuth
- **Method:** Email/password with session management
- **RBAC:** Role-based with separate roles table
### File Storage
- **Provider:** AWS S3, Supabase Storage, or Google Cloud Storage
- **Use:** Report PDFs, meeting documents, client assets
### Hosting
- **Frontend:** Vercel, Netlify, or Cloudflare Pages
- **Backend:** Vercel Serverless, AWS Lambda, or Railway
- **Database:** Supabase, PlanetScale, or Neon
### External Integrations
- **Google Calendar API** — OAuth 2.0 with Calendar scope
- **Zoom API** — OAuth 2.0 with Meeting scope
- **Calendly API** — OAuth 2.0 with webhook support
- **Google Drive API** — OAuth 2.0 with Drive scope
- **Notion API** — OAuth 2.0 with database scope
---
# 11. API Design (Conceptual)
## Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Email/password login |
| POST | `/auth/logout` | End session |
| POST | `/auth/setup-admin` | First-time admin bootstrap |
| GET | `/auth/me` | Current user profile + role |
## Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List all team members (admin only) |
| POST | `/users` | Create new user (admin only) |
| PATCH | `/users/:id` | Update user profile |
| PATCH | `/users/:id/active` | Toggle active status |
| POST | `/users/:id/roles` | Add role |
| DELETE | `/users/:id/roles/:role` | Remove role |
## Clients
| Method | Endpoint | Description |
|---|---|---|
| GET | `/clients` | List all clients (with filters) |
| GET | `/clients/:id` | Client detail with stats |
| POST | `/clients` | Create client |
| PATCH | `/clients/:id` | Update client |
| GET | `/clients/:id/tasks` | Client tasks |
| GET | `/clients/:id/meetings` | Client meetings |
| GET | `/clients/:id/blockers` | Client blockers |
| GET | `/clients/:id/risk-score` | Calculated risk score |
## Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/tasks` | List all tasks (with filters: client, workstream, status, view) |
| GET | `/tasks/:id` | Task detail |
| POST | `/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task (status, output link, etc.) |
| PATCH | `/tasks/:id/ar-output` | Toggle A/R output logged |
| DELETE | `/tasks/:id` | Delete task |
## Meetings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/meetings` | List meetings (with filters: client, view, date range) |
| GET | `/meetings/:id` | Meeting detail |
| POST | `/meetings` | Create meeting |
| PATCH | `/meetings/:id` | Update meeting (status, recap, links) |
| GET | `/meetings/metrics` | Meeting compliance metrics |
| POST | `/meetings/:id/sync-calendar` | Sync with Google Calendar |
## Blockers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/blockers` | List all blockers |
| POST | `/blockers` | Create blocker |
| PATCH | `/blockers/:id` | Update blocker (status, resolution notes) |
## Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/reports/due` | Reports due this week |
| POST | `/reports/generate` | Generate report (weekly/monthly) |
| POST | `/reports/:id/export` | Export as PDF |
| POST | `/reports/:id/email` | Email to client |
| GET | `/reports/:id` | View generated report |
## Risk Scores
| Method | Endpoint | Description |
|---|---|---|
| GET | `/risk-scores` | All client risk scores |
| GET | `/risk-scores/:clientId` | Single client risk breakdown |
| POST | `/weekly-reviews` | Submit weekly review |
## RACI
| Method | Endpoint | Description |
|---|---|---|
| GET | `/raci` | Full RACI matrix |
## Connectors
| Method | Endpoint | Description |
|---|---|---|
| GET | `/connectors` | List available connectors with status |
| POST | `/connectors/:id/connect` | Initiate OAuth flow |
| POST | `/connectors/:id/disconnect` | Remove connection |
| POST | `/connectors/:id/sync` | Manual sync trigger |
---
# 12. Development Roadmap
## Phase 1 — Core System (Weeks 1–3)
- [ ] Set up project infrastructure (React + TypeScript + Tailwind + Supabase)
- [ ] Create database schema (profiles, user_roles, clients, delivery_tasks)
- [ ] Implement authentication (login, session management)
- [ ] Build first-time admin bootstrap flow
- [ ] Create user management (CRUD operations)
- [ ] Build role-based routing and navigation
- [ ] Create Client CRUD (create, read, update clients)
- [ ] Build Task CRUD with RACI assignments
- [ ] Implement QA Gate logic (A/R output logged enforcement)
- [ ] Build RACI Matrix page
- [ ] Design system setup (tokens, components, dark theme)
## Phase 2 — Dashboards & Views (Weeks 4–5)
- [ ] PM Dashboard with all 5 executive metrics
- [ ] Client Risk Score calculation engine
- [ ] Owner/Executive Dashboard
- [ ] Specialist Dashboard with role-filtered views
- [ ] Task views (Timeline, Workstream, QA Gate, Blocked, Overdue)
- [ ] Client Detail page with 8 tabs
- [ ] Blocker management system
- [ ] Task Detail Dialog
- [ ] Task Create Dialog
## Phase 3 — Meetings & Reporting (Weeks 6–7)
- [ ] Meeting auto-generation (2 per client per month)
- [ ] Meeting compliance tracking
- [ ] Meeting views (7 filter tabs)
- [ ] Bi-weekly completion grid
- [ ] Owner dependency tracking
- [ ] Kickoff planning reminders
- [ ] Weekly Report Generator (auto-generated from tasks)
- [ ] Monthly Report Generator
- [ ] Report export system (PDF, email, save)
- [ ] Report cadence rules (Friday weekly, last Friday monthly)
## Phase 4 — Internal Workspace & Polish (Week 8)
- [ ] Internal workspace hub
- [ ] SOP page (full 16-step document)
- [ ] Social Media scope page
- [ ] Reports checklist page
- [ ] Active Clients directory with Drive/Credentials links
- [ ] Settings/Connectors page (UI only)
- [ ] Mobile responsive optimization
- [ ] Error handling and loading states
- [ ] Performance optimization
## Phase 5 — External Integrations (Weeks 9–12)
- [ ] Google Calendar OAuth + sync
- [ ] Google Meet link detection
- [ ] Zoom OAuth + meeting import
- [ ] Calendly OAuth + webhook for bookings
- [ ] Google Drive file attachment
- [ ] Notion API integration
- [ ] Meeting reminder system (24h, 1h, 10min)
- [ ] Participant notification system
## Phase 6 — Advanced Features (Weeks 13+)
- [ ] Real-time notifications (Supabase Realtime)
- [ ] Activity logging / audit trail
- [ ] Client-facing portal (read-only reports)
- [ ] Advanced analytics dashboard
- [ ] Automated blocker escalation
- [ ] Email notification system
- [ ] PDF export with branding
- [ ] Data backup and export tools
---
# 13. Developer To-Do List
## Environment Setup
1. [ ] Initialize React + TypeScript project with Vite
2. [ ] Install dependencies: Tailwind CSS, shadcn/ui, React Router, TanStack Query, Supabase JS
3. [ ] Configure Tailwind with custom design tokens (see `index.css`)
4. [ ] Set up Supabase project (or equivalent PostgreSQL)
5. [ ] Configure environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
## Database
6. [ ] Create `profiles` table with trigger to auto-create on auth.users insert
7. [ ] Create `user_roles` table with unique constraint (user_id, role)
8. [ ] Create app_role and app_department enums
9. [ ] Create `has_role` security definer function
10. [ ] Create `get_user_role` function
11. [ ] Create `setup_first_admin` function
12. [ ] Enable RLS on all tables
13. [ ] Create RLS policies for profiles (users can read own, admins can read all)
14. [ ] Create RLS policies for user_roles (admins only)
15. [ ] Create `clients` table
16. [ ] Create `delivery_tasks` table
17. [ ] Create `blockers` table
18. [ ] Create `meetings` table
19. [ ] Create `weekly_reviews` table
20. [ ] Create `reports` table
21. [ ] Create `sops` table
## Authentication
22. [ ] Build LoginPage component with email/password form
23. [ ] Implement AuthContext (user, session, profile, role state)
24. [ ] Build ProtectedRoute component with role checking
25. [ ] Implement admin bootstrap flow (setup_first_admin)
26. [ ] Create `create-user` edge function for admin user creation
## Layout & Navigation
27. [ ] Build AppLayout with sidebar navigation
28. [ ] Implement role-based navigation (getNavForRole)
29. [ ] Add route-level access control (canAccessRoute)
30. [ ] Build role-appropriate default route redirects
## Design System
31. [ ] Define CSS variables in index.css (see Section 15 for full token list)
32. [ ] Create component classes: metric-card, status-badge, health-green/yellow/red, data-table, view-tab, sidebar-link, qa-gate-warning, section-header
33. [ ] Import Inter + JetBrains Mono fonts
## Pages & Components
34. [ ] Build PM Dashboard (Index.tsx) with all 8 sections
35. [ ] Build Owner Dashboard
36. [ ] Build Specialist Dashboard
37. [ ] Build Clients CRM page
38. [ ] Build Client Detail page with 8 tabs
39. [ ] Build Tasks page with 6 views
40. [ ] Build RACI Matrix page
41. [ ] Build Blockers page
42. [ ] Build Meetings & Reports page
43. [ ] Build Report Generator dialog
44. [ ] Build Weekly Report Generator dialog
45. [ ] Build Task Detail dialog
46. [ ] Build Task Create dialog
47. [ ] Build Internal workspace hub + sub-pages (SOP, Social, Reports, Clients)
48. [ ] Build Admin/User Management page
49. [ ] Build Settings/Connectors page
## Risk Score Engine
50. [ ] Implement 4-pillar calculation (Delivery 0-30, Sentiment 0-25, Performance 0-25, Visibility 0-20)
51. [ ] Implement weekly adjustment system (-10 to +20)
52. [ ] Implement health mapping (Green/Yellow/Red thresholds)
53. [ ] Implement trend tracking (last 3 weeks)
## Meeting System
54. [ ] Auto-generate bi-weekly meetings per client
55. [ ] Calculate meeting compliance metrics
56. [ ] Implement Google Calendar URL generation
57. [ ] Build meeting status tracking
58. [ ] Implement SLA tracking
## Report System
59. [ ] Build report due date calculation (every Friday)
60. [ ] Monthly report detection (last Friday of month)
61. [ ] Auto-generate report content from completed tasks
62. [ ] Implement export actions (PDF placeholder, save, email)
## Integrations (Future)
63. [ ] Set up OAuth 2.0 flows for Google, Zoom, Calendly
64. [ ] Create `connector_tokens` table
65. [ ] Build calendar sync service
66. [ ] Build meeting link detection
67. [ ] Build Calendly webhook handler
68. [ ] Build reminder notification system
---
# 14. Future Expansion
1. **Database Migration** — Move all in-memory data (clients, tasks, meetings, blockers) to Supabase tables with full CRUD operations
2. **Real-Time Updates** — Use Supabase Realtime for live task status changes and notifications
3. **Client Portal** — Read-only portal for clients to view their own reports and progress
4. **Mobile App** — React Native companion app for on-the-go task management
5. **Email Notifications** — Automated email alerts for overdue tasks, meeting reminders, blocker escalations
6. **Slack Integration** — Post blocker alerts and meeting reminders to Slack channels
7. **Time Tracking** — Track time spent per client, per workstream
8. **Financial Dashboard** — Revenue per client, profitability metrics, retainer tracking
9. **Template System** — Pre-built task templates for different client types
10. **AI-Powered Reports** — Use AI to generate narrative summaries and performance insights
11. **Advanced Analytics** — Historical trend charts, workstream performance comparisons
12. **File Management** — Direct file upload and organization within the platform
13. **Activity Audit Log** — Track all user actions for accountability
14. **Custom Workflows** — User-defined automation rules (e.g., auto-assign tasks based on workstream)
15. **Multi-Tenant Support** — White-label version for other agencies
16. **API Access** — Public API for third-party integrations
17. **Data Export** — Bulk CSV/Excel export of all data
18. **Recurring Tasks** — Auto-create tasks on schedule (e.g., weekly GBP posts)
19. **Client Satisfaction Surveys** — Automated NPS/CSAT collection
20. **Predictive Churn Model** — ML-based churn prediction from risk scores
---
# 15. Assumptions and Missing Details
> Items marked with ⚠️ are assumptions made where explicit requirements were not provided.
1. ⚠️ **Data Persistence:** Currently all client, task, meeting, and blocker data is hardcoded in `src/lib/data.ts`. The system assumes this will be migrated to database tables. The types and structure are defined in `src/lib/types.ts`.
2. ⚠️ **Task Creation:** The Task Create Dialog currently shows a toast notification but does not persist the task. Database integration required.
3. ⚠️ **Report Export:** PDF export, email sending, and "Save to Reports" buttons are placeholder actions (show toast only). Real implementation requires a PDF generation library and email service.
4. ⚠️ **Risk Score Calculation:** The algorithm uses a weighted system but the exact formulas for each pillar are simplified. Production system may need tuning based on real data patterns.
5. ⚠️ **Specialist Task Filtering:** The specialist dashboard currently shows "0" for all metrics. Department-level task filtering needs to be implemented with actual database queries.
6. ⚠️ **Meeting Auto-Generation:** Meetings are generated on page load from static client data. Production system should generate meetings via a cron job or database trigger at the start of each month.
7. ⚠️ **Notification System:** No notification infrastructure exists yet. Meeting reminders (24h, 1h, 10min) are planned but not implemented.
8. ⚠️ **Self-Deactivation Prevention:** The current system does not prevent an admin from deactivating their own account.
9. ⚠️ **Password Reset:** No password reset flow exists. Users would need admin intervention to change passwords.
10. ⚠️ **Google Calendar Integration:** The "Add to Calendar" links use Google Calendar URL scheme (client-side only). Full server-side sync requires OAuth implementation.
11. ⚠️ **Client-Specific Credentials:** Credentials are accessed via external Google Sheets linked per client. No in-app credential storage exists (by design — decentralized approach).
12. ⚠️ **Multi-Role Dashboard:** Users with multiple roles see the dashboard of their "primary" role (first role returned by `get_user_role`). Aggregated multi-role dashboards are planned but not fully implemented.
13. ⚠️ **Demo Data:** The system currently contains demo data for 10 clients, 25 tasks, 5 blockers, and 4 weekly reviews. This data is for demonstration purposes and should be removed before production use.
14. ⚠️ **SLA Enforcement:** Meeting SLAs are tracked but not enforced (no automatic status change to "Overdue" based on SLA deadlines).
15. ⚠️ **Timezone Handling:** All dates are stored as date strings (YYYY-MM-DD) without timezone information. Production system should handle timezone-aware dates.
---
# Appendix A: Design System Tokens
## Color Palette (HSL)
```css
--background: 228 25% 8%        /* Dark navy */
--foreground: 210 20% 90%       /* Light gray */
--card: 228 20% 12%             /* Slightly lighter navy */
--primary: 187 80% 48%          /* Cyan/teal */
--secondary: 228 18% 18%        /* Medium navy */
--muted: 228 15% 16%            /* Dark muted */
--accent: 228 18% 22%           /* Accent navy */
--destructive: 0 72% 55%        /* Red */
--success: 152 60% 45%          /* Green */
--warning: 38 92% 55%           /* Amber */
--info: 210 80% 55%             /* Blue */
--health-green: 152 60% 45%     /* Same as success */
--health-yellow: 38 92% 55%     /* Same as warning */
--health-red: 0 72% 55%         /* Same as destructive */
--excellent: 152 60% 45%        /* ≥95% */
--very-good: 210 80% 55%        /* ≥90% */
--acceptable: 38 92% 55%        /* ≥85% */
--alert: 0 72% 55%              /* <85% */
```
## Typography
- **Body:** Inter (300–800)
- **Monospace:** JetBrains Mono (400–600)
## Component Classes
- `metric-card` — Rounded card with border
- `metric-value` — Large mono number
- `metric-label` — Small uppercase label
- `status-badge` — Pill badge (not-started, in-progress, blocked, done)
- `health-green/yellow/red` — Health indicator badges
- `sidebar-link` — Nav link with hover/active states
- `data-table` — Styled table with hover rows
- `view-tab` — Tab button with active state
- `qa-gate-warning` — Warning callout with left border
- `section-header` — Small uppercase section title
---
# Appendix B: Client List (Demo Data)
| ID | Client Name | Status | Workstreams | Health |
|---|---|---|---|---|
| c1 | OakTree Chimney Solutions | Active | SEO, PPC, Local/GBP | Green |
| c2 | California First Roofing | Active | SEO, PPC, Web/Dev | Green |
| c3 | Northwest Builders & Renovation | Onboarding | SEO, PPC, Social | Yellow |
| c4 | ASAP Restoration | Active | PPC, Local/GBP, Web/Dev | Green |
| c5 | Anytime Roofing | Active | SEO, PPC | Yellow |
| c6 | Rainbow Locksmith NY | Active | SEO, Local/GBP, Social | Green |
| c7 | Upgrade Garage Door & More | Active | PPC, Web/Dev | Red |
| c8 | First Choice Home Builders | Onboarding | SEO, PPC, Social | Yellow |
| c9 | Royal Roofing | Active | SEO, PPC, Local/GBP | Green |
| c10 | Costar Roofing | Active | SEO, PPC, Web/Dev | Green |
---
---

# 16. Team Workload Dashboard

## Overview

The Team Workload Dashboard is a management tool that allows Project Managers and Owners to monitor team capacity, task distribution, and operational bottlenecks across all departments.

It provides a real-time view of how tasks are distributed across team members and highlights potential overload situations before they affect delivery timelines.

This dashboard helps ensure that work is evenly distributed, deadlines are achievable, and specialists are not overwhelmed.

---

## Goals

- Prevent specialist overload
- Balance workload across departments
- Detect delivery risks earlier
- Improve project manager decision-making
- Identify blocked productivity due to task congestion
- Improve task reassignment speed

---

## Key Metrics

| Metric | Description |
|------|------|
| Active Tasks | Tasks assigned to a user that are Not Started or In Progress |
| Tasks Due This Week | Tasks with due dates within the next 7 days |
| Overdue Tasks | Tasks past due date and not completed |
| Blocked Tasks | Tasks currently marked as Blocked |
| Completion Rate | Completed tasks divided by total assigned tasks |
| Workload Level | Visual indicator showing team capacity |

---

## Workload Status Thresholds

| Status | Criteria |
|------|------|
| Healthy | ≤ 8 active tasks |
| Busy | 9–14 active tasks |
| Overloaded | ≥ 15 active tasks |

---

## Workload Indicators

| Indicator | Meaning |
|------|------|
| 🟢 Healthy | Team member has available capacity |
| 🟡 Busy | Team member approaching workload limit |
| 🔴 Overloaded | Team member likely overloaded |

---

# 16.1 Team Workload Dashboard Page

**Route:** `/workload`

**Access:**  
Project Manager  
Owner

---

## Page Purpose

Provide operational visibility into team workload so that managers can balance tasks across specialists and prevent delivery delays.

---

## Components

### 1. Team Workload Table

Displays workload statistics for each team member.

| Column | Description |
|------|------|
| Team Member | Name and role |
| Department | SEO, Ads, Web Dev, Social, etc |
| Active Tasks | Tasks currently assigned |
| Due This Week | Tasks due within 7 days |
| Overdue | Tasks past due |
| Blocked | Tasks currently blocked |
| Completion Rate | Percentage of completed tasks |
| Workload Status | Healthy / Busy / Overloaded |

---

### 2. Workload Heatmap

Visual grid showing relative workload distribution across team members.

Example representation:

| Team Member | Active Tasks | Status |
|------|------|------|
| John (SEO) | 12 | Busy |
| Maria (Ads) | 7 | Healthy |
| Ahmed (Web Dev) | 18 | Overloaded |

Heatmap colors allow quick identification of overloaded departments.

---

### 3. Department Workload Summary

Aggregated task counts per department.

Example:

SEO → 35 tasks  
PPC → 21 tasks  
Web Dev → 14 tasks  
Social → 9 tasks

This helps leadership understand which departments are operating at full capacity.

---

### 4. Task Reassignment Controls

Project Managers can quickly rebalance workloads by:

- Reassigning tasks to other specialists
- Adjusting due dates
- Escalating blocked tasks
- Redistributing tasks across departments

---

# 16.2 Workload Calculation Logic

Workload is calculated dynamically using the `delivery_tasks` table.

Metrics are derived using filters on task status and due dates.

| Metric | Query Logic |
|------|------|
| Active Tasks | status IN ('Not Started','In Progress') |
| Due This Week | due_date BETWEEN today AND today + 7 days |
| Overdue | due_date < today AND status ≠ 'Done' |
| Blocked | status = 'Blocked' |
| Completed | status = 'Done' |

---

## Example Query

Count active tasks per user:

```
SELECT responsible, COUNT(*)
FROM delivery_tasks
WHERE status IN ('Not Started','In Progress')
GROUP BY responsible;
```

---

# 16.3 Optional Future Table (Time Tracking)

If workload analysis expands beyond task counts, a time tracking table can be implemented.

Table: `task_time_logs`

| Column | Type |
|------|------|
| id | UUID |
| task_id | UUID |
| user_id | UUID |
| hours_logged | Decimal |
| logged_at | Timestamp |

This allows workload to be measured using **actual hours instead of task count**.

---

# 16.4 Development Tasks

To implement the Team Workload Dashboard developers should complete the following:

- Build `/workload` page
- Create workload aggregation queries
- Implement workload threshold logic
- Build workload heatmap component
- Build department workload summary
- Implement quick task reassignment
- Add filtering by department
- Add sorting by workload level
- Optimize queries for performance
- Ensure role-based access control
*End of Product Documentation*