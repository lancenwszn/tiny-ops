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
