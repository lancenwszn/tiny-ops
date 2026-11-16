@AGENTS.md

# TinyOps — project notes

- Read `docs/ARCHITECTURE.md` and `docs/SECURITY.md` before changing data access.
- Every workspace-owned table needs `workspace_id`, RLS policies built on `private.is_workspace_member` / `private.has_workspace_role`, the `prevent_workspace_change` trigger, and pgTAP tests in `supabase/tests/database`.
- Server Actions: validate with zod, re-check the session and role, and return `FormState` (`src/lib/forms.ts`).
- Never import `src/lib/supabase/admin.ts` outside trusted server routes (webhooks, cron, contact form).
- Never show fabricated metrics. Modules that are not built yet are disabled "Soon" items in `src/components/layout/nav.ts`.
- After changing migrations: `npm run db:reset && npm run db:types && npm run test:db`.
