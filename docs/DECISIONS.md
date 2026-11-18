# Architecture decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Next.js 16 without `cacheComponents`.** The scaffold enabled it; we turned it off. | Every `/app` route is per-user and reads cookies. The classic dynamic rendering model is simpler and avoids caching per-tenant data by mistake. We can revisit it for marketing pages. |
| 2 | **Middleware is `src/proxy.ts`** (Next 16 renamed `middleware` to `proxy`). | Follows the framework convention. It only refreshes sessions and makes optimistic redirects. |
| 3 | **Active workspace stored in an httpOnly cookie**, not in the URL. | Keeps the `/app/dashboard` URLs from the spec. The cookie is validated against memberships on every request. |
| 4 | **Tenancy mutations go through `SECURITY DEFINER` RPCs.** | Creating a workspace (workspace + owner + trial) and accepting invitations must be atomic and must not depend on permissive insert policies. |
| 5 | **Plan limits live in the `plans` table.** | Limits and features can change without a deploy. One helper (`private.plan_limit`) is used everywhere. |
| 6 | **14-day Growth trial, no card**, created by `create_workspace`. | Gets small businesses to value quickly. Stripe takes over from Stage 8. |
| 7 | **shadcn/ui components added by hand** in `src/components/ui`. | The shadcn registry host is blocked in the build environment. The files follow shadcn v4 conventions (`components.json` is present), so the CLI works wherever it is reachable. |
| 8 | **Native `<select>` for timezones.** | Around 400 options; native controls are faster and fully accessible. |
| 9 | **Forms use Server Actions + `useActionState` + zod** (no react-hook-form). | Progressive enhancement, server-side validation as the source of truth, fewer dependencies. Field errors come back from the server. |
| 10 | **Modules not yet built appear in the sidebar as disabled "Soon" items.** | Never ship dead links or fake functionality. |
| 11 | **Module registry (`src/lib/modules.ts`).** | One switch per module lights it up across navigation, quick actions, search and the dashboard. No hard-coded "coming soon" states scattered through the code. |
| 12 | **The notifications table shipped in Stage 2** (planned for Stage 7). | The notification centre had to show real data. Membership and invitation events already exist, so triggers can produce genuine notifications now. |
| 13 | **Invite Member quick action enabled in Stage 2.** | The invitation RPCs and accept page already existed (Stage 1). The full Team page (member list, roles, deactivation) is still Stage 6. Invitation emails stay unsent until an email provider is configured; the dialog gives the owner a copyable link. |
| 14 | **Per-widget `catchError` boundaries** (Next 16) instead of hand-written error boundary classes. | They integrate with the framework's redirect, notFound and retry behaviour. |
| 15 | **Sidebar collapse state in a cookie**, not localStorage. | The server renders the correct width on the first paint (no layout shift). It's a per-viewer convenience with no security relevance. |
| 16 | **Separate `sop_drafts` working copy plus immutable `sop_versions`.** | RLS is per row; unpublished edits must never be readable by members. Snapshots make history, compare and restore trivial and tamper-proof. |
| 17 | **Steps stored relationally in the working copy and as jsonb in versions.** | Steps are edited as rows (ordering, attachment foreign keys); versions are frozen snapshots. |
| 18 | **Tiptap pinned to 3.32.2** (not the 3-day-old 3.34.0). | Prefer releases that have had time to settle. |
| 19 | **Custom React renderer for SOP rich text** instead of `generateHTML` + `dangerouslySetInnerHTML`. | It works with server rendering and is XSS-safe by construction; it re-sanitizes even content written directly through the API. |
| 20 | **Restore = new version.** Restoring refuses to overwrite unpublished edits unless the user confirms. | History is never rewritten, and no change is lost silently. |
| 21 | **Acknowledgments are keyed by (SOP, version, user).** | An acknowledgment of v2 never counts for v3. Publishing a new version notifies everyone who can read the SOP. |
| 22 | ~~Attachments belong to the SOP, not to a version.~~ Superseded by #23. | — |
| 23 | **Attachments are versioned** (`sop_versions.attachment_ids`, soft removal with `removed_at`). | Audit H2: unpublished files must not be visible, and history must keep its files. |
| 24 | **SOP activity stores no titles;** titles are looked up live under RLS. | Audit H1: the log is append-only, but titles change and visibility changes, so the log must not freeze secrets. |
| 25 | **Category, owner and acknowledgment are staged in the draft.** Access (visibility) stays an immediate setting. | Audit M1: what readers see should only change on publish; access is a deliberate, separate control. |
| 26 | **SOP owners (members) do not get draft access.** | Drafts stay restricted to owners and admins (spec); owners are told about their SOP when it is published. |
| 27 | **App gateway route with 30-second signed URLs** instead of 1-hour signed URLs in pages. | Audit M3: access is re-checked on every request. Redirecting (rather than proxying bytes) avoids serverless response-size limits for 10 MB files. |
| 28 | **Quota from stored objects, plus an hourly orphan sweep** (`CRON_SECRET`). | Audit M4: SQL can't delete storage objects safely, so a service-role job does it through the Storage API. |
| 29 | **Client save ids for idempotent retries,** plus a local backup of unconfirmed content. | Audit M6: a lost response must not look like someone else's edit, and nothing should be lost when navigation can't be intercepted. |
