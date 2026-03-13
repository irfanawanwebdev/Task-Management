# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Type-check + production build (tsc -b && vite build)
npm run lint      # ESLint
npm run preview   # Preview production build
```

No test framework is currently configured.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 |
| Backend/Auth | Supabase (Auth, PostgreSQL, Edge Functions) |
| State | React hooks + TanStack React Query (planned) |
| Routing | React Router v6 (planned) |
| Components | shadcn/ui or Radix UI primitives (planned) |

**Path alias:** `@/` → `./src/` (configured in both `vite.config.ts` and `tsconfig.app.json`)

**TypeScript:** Strict mode with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`.

## Project Overview

**JZ Smart Media — Operations Hub** is an internal operations management platform for a digital marketing agency. It centralizes client delivery tracking, team coordination, meeting management, reporting, and risk monitoring.

The codebase is currently a **Vite starter template** — the full application described in `PRODUCT_DOCUMENTATION.md` needs to be built from scratch.

## Application Architecture (to be built)

### Routes & Access Control

| Route | Purpose | Roles |
|---|---|---|
| `/login` | Auth + first-time admin setup | Public |
| `/` | PM Dashboard (Operations Control Tower) | project_manager, owner |
| `/owner` | Executive Dashboard | owner |
| `/specialist` | Specialist personal workspace | All authenticated |
| `/tasks` | Master task database | All authenticated |
| `/clients` | Client CRM directory | project_manager, owner |
| `/clients/:id` | Client detail hub (8 tabs) | project_manager, owner |
| `/raci` | RACI responsibility matrix | project_manager, owner |
| `/blockers` | Blocker oversight | All authenticated |
| `/meetings` | Meetings & reports center | All authenticated |
| `/instructions/*` | Internal workspace / SOPs | project_manager, owner |
| `/admin` | User management | owner, project_manager |
| `/settings` | Integration connectors | owner, project_manager |

### User Roles (Supabase `user_roles` table)

`owner` | `project_manager` | `web_developer` | `seo` | `ads_manager` | `social_media` | `account_manager` | `viewer`

Users can hold multiple roles. Role checks use a server-side `has_role(_user_id, _role)` security definer function. New users are only created via a `create-user` Supabase Edge Function (no public signup).

### Core Domain Concepts

**16 Delivery Steps (Steps 0–15):** The client lifecycle from "Client Signs" (Day 0) through "Optimization & Scale" (Week 6+). Every step maps to tasks with RACI assignments.

**RACI roles:** A/R (Accountable + Responsible), A (Accountable), R (Responsible), C (Consulted), I (Informed). The **QA Gate Rule**: A/R output must be logged before the next step begins.

**4-Pillar Risk Score (0–100 per client):**
- Delivery: 0–30 pts (task completion, overdue, blocked)
- Sentiment: 0–25 pts (weekly reviews)
- Performance: 0–25 pts (metrics)
- Visibility: 0–20 pts (meeting compliance, report delivery)
- Health: 0–25 = Green, 26–45 = Yellow, 46–100 = Red

**10 Workstreams:** Sales, Ops/PM, AM, Tracking, SEO, PPC, Web/Dev, Local/GBP, Social, VA/Vendor

**Meeting Governance:** Exactly 2 meetings per client per month (Mid-Month ~14th, End-of-Month ~27th). Meeting compliance is tracked as Completed ÷ Expected.

**Reports:** Weekly update every Friday per active client; last Friday of month becomes Monthly Report. Auto-generated from completed tasks.

### Database Schema (Supabase PostgreSQL)

**Implemented tables:** `profiles`, `user_roles`

**Enums:** `app_role`, `app_department`

**Database functions:** `get_user_role`, `has_role`, `setup_first_admin`

**Future tables** (currently in-memory as static data in `src/lib/data.ts`): `clients`, `delivery_tasks`, `blockers`, `meetings`, `weekly_reviews`, `reports`, `sops`, `connector_tokens`

See `PRODUCT_DOCUMENTATION.md` §8 for full schema definitions and example records.

## Source Structure

```
src/
  features/
    auth/           AuthContext, LoginPage, ProtectedRoute
    admin/          AdminPage (user management)
    dashboard/      PMDashboard, OwnerDashboard
    specialist/     SpecialistDashboard
    clients/        ClientsPage, ClientDetailPage (8-tab hub)
    tasks/          TasksPage (6 views + TaskDetailDialog)
    raci/           RACIPage (static matrix)
  components/
    layout/         AppLayout, Sidebar
  lib/
    types.ts        All domain types + DELIVERY_STEPS + WORKSTREAMS constants
    supabase.ts     Supabase client (createClient<Database>)
    database.types.ts  Type stub (replace with CLI-generated types after migration)
    permissions.ts  canAccessRoute, getNavForRole, capability helpers
    timezone.ts     All date/time utils (EST timezone, SLA, report cadence)
    utils.ts        cn() helper
```

## Key Patterns

**Supabase queries with joins** — When using `select('*, relation(field)')`, the stub `database.types.ts` can't resolve foreign keys. Cast results with `as unknown as Type[]`. Replace `database.types.ts` with CLI-generated types once the Supabase project is connected.

**Mutations** — Use `as never` when TypeScript can't infer the update/insert type from the stub, e.g. `.update({ field: value } as never)`.

**React Query** — `queryKey` arrays used throughout. Mutations call `queryClient.invalidateQueries({ queryKey: ['key'] })` on success.

**`setup_first_admin` RPC** — Called via `supabase.rpc as unknown as ...` because the function args type in the stub doesn't match the strict Function type.

### Planned Integrations (UI-ready, OAuth not yet implemented)

Google Calendar, Google Meet, Zoom, Calendly, Google Drive, Notion — tokens stored in `connector_tokens` table per user.
