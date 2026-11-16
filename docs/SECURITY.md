# Security model

## Tenant isolation
- Every workspace-owned table has `workspace_id` and RLS enabled, with policies built on `private.is_workspace_member` and `private.has_workspace_role`.
- The helpers are `SECURITY DEFINER` with `search_path = ''`. They live in the `private` schema, which PostgREST does not expose.
- `workspace_id` cannot change after insert (`private.prevent_workspace_change` trigger).
- The active-workspace cookie is only a preference. It is honoured only when the user is an active member, and RLS blocks everything else anyway (E2E test: "forged workspace cookie").
- Deactivated members lose all access immediately, because the helpers require `status = 'active'`.

## Privileges
- Clients cannot insert workspaces, memberships, invitations, subscriptions, plans or activity rows directly. Those go through RPCs or trusted server code.
- Column-level grants limit what clients can update: profiles (`full_name`, `avatar_path`, `timezone`), workspaces (`name`, `description`, `logo_path`, `timezone`, owner only), memberships (`role`, `status`, narrowed further by a trigger), invitations (`revoked_at`).
- The service-role key (`SUPABASE_SECRET_KEY`) is used only in `src/lib/supabase/admin.ts`, which imports `server-only` so any client import fails the build.

## Authentication
- Email verification is required before sign-in. Passwords need at least 8 characters with letters and digits.
- The server verifies sessions with `supabase.auth.getClaims()`, never `getSession()`.
- `?next=` redirects go through `safeNext()`, which only allows same-origin relative paths.
- Sign-up and password reset return the same response whether or not the account exists, so they don't reveal who has signed up.
- Email links use `token_hash` verification through `/auth/confirm`.

## Invitations
- Tokens are 256-bit random values. Only their SHA-256 hash is stored. They expire after 7 days, can be revoked and work once.
- Acceptance requires a verified email that matches the invited address. Plan member limits apply.
- Admins can invite only members. Nobody can be invited as owner.

## Uploads
- The public `branding` bucket accepts only PNG, JPEG or WebP up to 2 MB. SVG is excluded because it can carry scripts.
- Storage RLS: only the owner can write `workspaces/<id>/…`, and each user can write only `users/<their id>/…`.
- Server Actions check that saved paths sit inside the caller's own folder.

## HTTP
- Security headers set in `next.config.ts`: CSP, X-Frame-Options DENY, frame-ancestors 'none', nosniff, Referrer-Policy and Permissions-Policy. HSTS is added in production.
- Known gap: `script-src` includes `'unsafe-inline'` because Next.js inlines its bootstrap scripts. Moving to nonce-based CSP is tracked for Stage 10.

## Billing (Stage 8)
- Paid access comes only from `subscriptions`, which is written by the signature-verified, idempotent Stripe webhook. Clients cannot write it (pgTAP: "owners cannot upgrade their own subscription from the client").
