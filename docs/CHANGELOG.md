# Changelog

## Stage 1 — Foundation

- Next.js 16 + TypeScript + Tailwind v4 project with TinyOps design tokens, Plus Jakarta Sans and shadcn/ui primitives.
- TinyOps brand: vector logo mark, wordmark and favicon based on the supplied logo.
- Supabase local stack configuration, branded auth email templates.
- Database: profiles, workspaces, members, invitations, plans, subscriptions, Stripe event log, activity log. RLS helpers, role guard trigger, tenancy RPCs, branding storage bucket.
- Auth: sign up, email verification and resend, sign in, sign out, forgot and reset password, change password, protected routes.
- Workspaces: onboarding, multiple workspaces per user, workspace switcher, workspace settings (owner only), logo upload, profile with avatar and timezone, invitation acceptance page.
- App shell: sidebar, top bar, mobile navigation drawer, and a Stage 1 dashboard (greeting, real setup progress, workspace facts, trial state).
- Tests: 60 pgTAP assertions, 26 unit tests, 12 Playwright journeys.
