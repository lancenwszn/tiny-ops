# Changelog

## Stage 3 — SOP Library

- SOP Library with search across titles, descriptions, categories and content; category and status filters; sorting by last updated, title, created or published date; list and card views; and quick actions (open, edit, history, duplicate, archive, restore).
- Categories: 7 defaults per workspace; create, rename, describe, recolour and archive; deletion only after moving the category's SOPs.
- Editor: Tiptap rich text (headings, bold, italic, underline, strike, bulleted, numbered and check lists, quotes, links, tables, private images, dividers) for Purpose, Scope, Required materials, Procedure overview, Responsibilities and Additional notes. Structured steps with notes and an optional file, reorderable. Category, owner and acknowledgment settings. Autosave, explicit save, conflict detection and leave-page protection.
- Lifecycle: draft, published and archived; publishing with a revision note; full version history with word-level compare and restore-as-new-version; duplicate.
- Access: workspace-wide or restricted (the Members role or specific people), enforced by RLS everywhere.
- Acknowledgments per version, with reminders and an owner/admin roster (who has acknowledged, who hasn't, date and version).
- Private attachments with signed links, type and size validation, and a plan storage quota.
- Global search, the dashboard (recent SOPs, counts, Create SOP quick action, getting started), the activity feed and notifications now use real SOP data. The SOP Library is live in the sidebar.
- Tests: 91 new pgTAP assertions (188 total), 33 new unit tests (80 total), 13 new Playwright journeys (36 total).

## Stage 2 — Application shell & dashboard

- Collapsible sidebar with the workspace switcher, active indicators and "Soon" states driven by a new module registry. Mobile drawer and a mobile workspace bar.
- Top bar: global search (⌘K) across team members, pages and workspaces; notification centre with unread badge, mark-read and mark-all-read; help menu (getting started, docs, support, about); account menu.
- Three-column dashboard: welcome hero (greeting, workspace, date and live clock in the workspace timezone), four KPI cards, operations health ring, getting-started progress, team activity feed, upcoming tasks, operations calendar (month navigation, today indicator, event slots), recent SOPs, quick actions and a TinyOps AI placeholder. Metrics for modules that aren't built show honest empty states.
- Invite Member quick action (owners and admins), which creates a copyable invitation link.
- New `/app/notifications` page.
- Database: `notifications` table, notification and activity triggers, the `search_workspace` RPC, and `create_invitation` v2 (no invitee emails in activity, in-app invite for existing users).
- Tests: 37 new pgTAP assertions (97 total), 21 new unit tests (47 total), 11 new Playwright journeys (23 total).

## Stage 1 — Foundation

- Next.js 16 + TypeScript + Tailwind v4 project with TinyOps design tokens, Plus Jakarta Sans and shadcn/ui primitives.
- TinyOps brand: vector logo mark, wordmark and favicon based on the supplied logo.
- Supabase local stack configuration, branded auth email templates.
- Database: profiles, workspaces, members, invitations, plans, subscriptions, Stripe event log, activity log. RLS helpers, role guard trigger, tenancy RPCs, branding storage bucket.
- Auth: sign up, email verification and resend, sign in, sign out, forgot and reset password, change password, protected routes.
- Workspaces: onboarding, multiple workspaces per user, workspace switcher, workspace settings (owner only), logo upload, profile with avatar and timezone, invitation acceptance page.
- App shell: sidebar, top bar, mobile navigation drawer, and a Stage 1 dashboard (greeting, real setup progress, workspace facts, trial state).
- Tests: 60 pgTAP assertions, 26 unit tests, 12 Playwright journeys.
