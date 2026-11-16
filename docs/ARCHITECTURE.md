# TinyOps architecture

TinyOps is a multi-tenant SaaS for small-business operations: SOPs, tasks, recurring checklists, team handovers and reports. A **workspace** is one business. A user can belong to several workspaces, and every workspace's data is isolated at the database level.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui components (Radix primitives), Lucide icons, Plus Jakarta Sans |
| Data / auth | Supabase Postgres + Auth + Storage, Row Level Security on every table |
| Billing | Stripe Checkout, Customer Portal and webhooks (Stage 8) |
| Hosting | Vercel |
| Tests | pgTAP (database/RLS), Vitest (unit), Playwright (E2E) |

## Request flow

```
Browser ─► src/proxy.ts            refreshes the Supabase session; optimistic redirects only
        ─► Server Components         read through the user's JWT (RLS enforced)
        ─► Server Actions            zod validation → session check → role check → Supabase (RLS again)
        ─► Postgres RPCs              atomic, security-definer operations that re-check identity and role
Stripe  ─► /api/stripe/webhook       (Stage 8) the only writer of subscriptions, besides the trial RPC
```

Authorization is enforced in **three layers**:
1. **Proxy:** convenience redirects for signed-out users. It is never trusted for security.
2. **Data access layer** (`src/lib/auth/session.ts`, `src/lib/workspace/active.ts`): it verifies the session with `getClaims()` on every request, resolves the active workspace from the user's own memberships, and checks roles before mutations.
3. **Postgres RLS + RPCs:** the source of truth. Even a direct API call with a valid user token cannot read or write another workspace's data (covered by `supabase/tests/database`).

## Folder structure

```
src/
  app/
    (marketing)/          public site (interim home + legal pages; full site in Stage 9)
    (auth)/               login, signup, forgot/reset password, verify email
    auth/confirm/         handler for email links (token_hash verification)
    invite/[token]/       invitation preview and acceptance
    onboarding/           create a workspace
    app/                  authenticated application at /app/* (layout = auth guard + shell)
  components/
    ui/                   shadcn/ui primitives (hand-added; the registry host is not reachable from CI)
    brand/                TinyOps logo (vector redraw of public/brand/tinyops-logo-full.webp)
    layout/               sidebar, top bar, workspace switcher, user menu, mobile nav
    shared/               form fields, page header, image upload, notices
  features/<module>/      actions.ts (Server Actions) · schemas.ts (zod) · components/
  lib/
    supabase/             server, browser, proxy and admin (service-role, server-only) clients
    auth/                 session DAL, safe redirect helper
    workspace/            active workspace resolution, subscription read model
    dates/, forms.ts, env.ts, utils.ts
  hooks/                  small client hooks
  types/database.ts       generated from the local schema (npm run db:types)
supabase/
  migrations/             schema, RLS, RPCs
  tests/database/         pgTAP tests (npm run test:db)
  templates/              branded auth emails
tests/
  unit/                   Vitest
  e2e/                    Playwright (runs against the local Supabase stack + Mailpit)
```

## Data model (Stage 1)

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user (name, email synced from auth, avatar, personal timezone) |
| `workspaces` | A business: name, slug, description, logo, **timezone** |
| `workspace_members` | user ↔ workspace with role (`owner`/`admin`/`member`) and status (`active`/`deactivated`). Only one owner per workspace (partial unique index) |
| `workspace_invitations` | Email invitations. Only a **SHA-256 hash** of the token is stored; tokens expire after 7 days and can be used once |
| `plans` | Pricing **configuration**: price, Stripe price id, `limits` jsonb, `features` jsonb. Change limits without a deploy |
| `subscriptions` | One per workspace. Clients can read it but never write it |
| `stripe_events` | Webhook idempotency (service role only) |
| `activity_log` | Workspace activity feed. Written only by trusted functions/triggers |

Tables planned for later stages: `sop_categories`, `sop_documents`, `sop_steps`, `sop_versions`, `sop_attachments`, `tasks`, `task_comments`, `task_activity`, `checklist_templates`, `checklist_items`, `checklist_instances`, `checklist_completions`, `handovers`, `handover_notes`, `notifications`. Each one gets a `workspace_id`, composite foreign keys to keep references inside one workspace, the `prevent_workspace_change` trigger and RLS built on the same helpers.

### RLS helpers (`private` schema, not exposed over the API)

- `private.is_workspace_member(ws)`: the caller is an **active** member.
- `private.has_workspace_role(ws, roles[])`: the caller has one of the given roles.
- `private.shares_workspace_with(user)`: used for profile visibility.
- `private.plan_limit(ws, key)`: the numeric limit from the effective plan, or `NULL` for unlimited.

### RPCs

- `create_workspace(name, timezone, description)` creates the workspace, the owner membership and a 14-day Growth trial in one atomic call.
- `create_invitation(workspace, email, role)` is available to owners and admins (admins can only invite members). It enforces the plan's member limit and returns the raw token once.
- `get_invitation_preview(token)` returns only what the accept page needs.
- `accept_invitation(token)` requires a verified email that matches the invitation. Each token works once and must not have expired.

### Role rules (enforced by the `guard_member_update` trigger + RLS)

- **Owner:** everything, including workspace settings and billing. Cannot demote themselves or leave (ownership transfer comes later).
- **Admin:** runs operations. Can invite and deactivate **members**, but cannot promote anyone or touch other admins or the owner.
- **Member:** reads their workspace and can leave it. Cannot change any membership, including their own.

## Recurring checklists (Stage 5 design)

- Templates store a recurrence (`daily` / `weekly` with weekdays / `monthly` with day-of-month, clamped to the month's last day), a due time and a start date.
- `generate_checklist_instances(now)` computes each workspace's **local date** with `now AT TIME ZONE workspace.timezone` and inserts any instance that is due, using `ON CONFLICT DO NOTHING` on a unique `(template_id, period_date)`. Running it repeatedly is safe and cannot create duplicates.
- When an instance is created, its items are **snapshotted** into `checklist_completions` (label and position). Editing a template never rewrites history, and each item records who completed it and when.
- Triggers: pg_cron every 15 minutes, a Vercel Cron route protected by `CRON_SECRET` as backup, and a lazy run when the Checklists page loads.

## Billing (Stage 8 design)

- One subscription per workspace, managed by the owner.
- Checkout and Portal sessions are created on the server only after an owner check.
- The webhook verifies Stripe signatures, records the event id in `stripe_events` (idempotency) and upserts `subscriptions` with the service role.
- The app reads access from `subscriptions` and plan limits from `plans` only. Frontend state never grants access.
