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

## Data model (Stages 1–3)

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
| `notifications` | Per-user inbox scoped to a workspace (Stage 2). Rows are created only by triggers/RPCs reacting to real events; recipients may only set `read_at` or delete their own |

Tables planned for later stages: `tasks`, `task_comments`, `task_activity`, `checklist_templates`, `checklist_items`, `checklist_instances`, `checklist_completions`, `handovers`, `handover_notes`. Each one gets a `workspace_id`, composite foreign keys to keep references inside one workspace, the `prevent_workspace_change` trigger and RLS built on the same helpers.

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

## Application shell & dashboard (Stage 2)

- **Module registry:** `src/lib/modules.ts` records which modules are live. The sidebar, quick actions, global search sources, calendar and dashboard widgets all read it. A module that isn't live is shown as a disabled "Soon" item, never as a link.
- **Shell:** a collapsible sidebar (`app-sidebar.tsx`; the preference is stored in the `tinyops_sidebar` cookie so the server renders the right width with no layout shift). The sidebar holds the workspace switcher; below `lg` the switcher sits under the top bar and in the mobile drawer. The top bar has global search, notifications, help and the account menu.
- **Dashboard read model** (`src/features/dashboard/queries.ts`): RLS-scoped queries wrapped in React `cache`, so widgets that share data make one request. `getOperationsInputs`, `getUpcomingTasks`, `getRecentSops` and `getCalendarEvents` are the extension points for Stages 3–5. They return `undefined`/`null` until a module is live, and the UI shows that as an honest empty state rather than zeros.
- **Metrics** (`metrics.ts`): KPIs and the operations-health score are computed by pure functions with unit tests. A `Metric` is either `ready` (a real number) or `unavailable` (with a caption).
- **Streaming and errors:** each data widget renders inside `<Suspense>` with a skeleton, and inside a `catchError` boundary (`widget-boundary.tsx`), so one failing widget never breaks the page.
- **Global search:** `public.search_workspace(workspace, query, limit)` is `SECURITY INVOKER`, so RLS decides what each caller can find. It escapes LIKE wildcards and requires at least 2 characters. Today it searches team members; later modules add `UNION` branches to it. Pages and workspace switching are matched on the client.
- **Notifications:** created by triggers when a member joins (owners and admins are notified) or a role changes (the member is notified), and by `create_invitation` when the invitee already has an account. Accepting or revoking an invitation deletes that invitation's notification. The bell loads its list on demand; the layout fetches only the unread count.
- **Activity feed:** triggers log workspace edits (name, timezone, logo, description), role changes, deactivation and reactivation, leaving or removal, and revoked invitations. Invitation activity no longer stores the invitee's email.

## SOP Library (Stage 3)

| Table | Purpose |
|---|---|
| `sop_categories` | Per-workspace categories. The 7 defaults are seeded by a trigger on workspace creation. Categories can be renamed, archived, or deleted once their SOPs have been moved (`delete_sop_category`) |
| `sop_documents` | One row per SOP: category, owner, status, visibility, `requires_acknowledgment`, `current_version`, plus the **published** title, description and full-text index (`search`). Members read this |
| `sop_drafts` | The editable **working copy**: title, description, rich-text `sections` and staged metadata (category, owner, acknowledgment), a `dirty` flag (recomputed by comparing with the published version), a `revision` counter and `last_save_id` for optimistic concurrency. Owners and admins only |
| `sop_steps` | Ordered steps of the working copy (title, instructions, notes, optional attachment) |
| `sop_versions` | Immutable snapshots created on publish: content, steps, metadata, `attachment_ids`, revision note, publisher and `restored_from_version` |
| `sop_permissions` | Grants for restricted SOPs: the Members role or specific members |
| `sop_acknowledgments` | One row per user **per version** (FK to `sop_versions`) |
| `sop_attachments` | Files in the private `sop-attachments` bucket at `<workspace>/<sop>/<uuid>.<ext>`. `removed_at` marks files removed from the working copy but kept for published versions |

**Why a separate draft table:** RLS filters rows, not columns. Keeping unpublished edits in `sop_drafts`, which owners and admins read, means members can never see work-in-progress on a published SOP, whether in the UI, through the API or in search.

**Visibility** comes from one function, `private.can_user_view_sop(sop, user)`. It is reused by RLS on documents, versions and attachments, by the storage policies, by `search_workspace` (which runs as the caller) and by the acknowledgment roster.
- **Owners and admins:** every SOP, in every status.
- **Members:** published SOPs that are workspace-wide, or restricted SOPs granted to the Members role, to them personally, or that they own.
- **Archived SOPs:** hidden from members.

**Lifecycle RPCs:** `create_sop`, `save_sop_draft` (also called by autosave; a stale `revision` raises `40001`), `publish_sop` (refuses a publish with no changes), `restore_sop_version` (copies an old snapshot into a **new** version and refuses to discard unpublished edits unless asked explicitly), `archive_sop`, `unarchive_sop`, `duplicate_sop`, `set_sop_access`, `acknowledge_sop` (always the current version), `get_sop_acknowledgments` (owners and admins only). Plan limits: `sops` (active SOPs) and `storage_mb` (attachment quota).

**Rich text:** the editor is Tiptap (StarterKit, task lists, tables, images, links). Editor JSON goes through `sanitizeSections()` (an allowlist of nodes, marks and attributes; `http`, `https` and `mailto` links only; images only as `attachmentId` references) before every save. It is sanitized **again** when rendered by `RichText`, a React renderer that never uses `dangerouslySetInnerHTML`. Images resolve to short-lived signed URLs.

**Editor reliability:**
- **Saving:** autosave runs 1.5 s after the last edit, ⌘S saves immediately, and failed saves retry every 10 s. Concurrent saves are queued.
- **Lost responses:** each attempt carries a `saveId`, and attempts whose responses were lost are sent back as `unconfirmedSaveIds`, so the server recognises the client's own earlier save.
- **Conflicts:** a genuine conflict (someone else saved) locks the editor, and the rich-text editors become read-only.
- **Leaving the page:** a `beforeunload` prompt, a link guard and a shared guard (`src/lib/unsaved-changes.ts`) cover the workspace switcher, the command palette and sign-out. Pending work is flushed when the page is hidden or the editor unmounts (for example, the browser Back button).
- **Local backup:** unsaved content is also kept on this device (`localStorage`, cleared after a successful save). On the next visit the editor offers to restore anything the server doesn't have.
- **Archived SOPs** open read-only.

**Attachment access:** see `docs/SECURITY.md`. Pages never embed storage URLs; `/api/sops/attachments/[id]` checks access on every request and redirects to a 30-second signed URL.

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
