# Local setup & configuration

## Prerequisites

- Node.js 22+
- Docker (for the local Supabase stack)

## 1. Install and start Supabase locally

```bash
npm install
npx supabase start
```

`supabase start` prints the local API URL and keys. If your network cannot reach `public.ecr.aws`, pull images from Docker Hub instead:

```bash
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start
```

Local services:

| Service | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Mailpit (catches all auth emails) | http://127.0.0.1:54324 |

## 2. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from `npx supabase status`.

## 3. Run

```bash
npm run dev
```

## Tests

| Command | What it covers |
|---|---|
| `npm run test` | Unit tests (Vitest) |
| `npm run test:db` | pgTAP database tests: RLS isolation, role escalation, invitations, plan limits |
| `npm run build && npm run test:e2e` | Playwright end-to-end journeys against the local stack (reads emails from Mailpit) |
| `npm run lint` / `npm run typecheck` | Static checks |

After changing migrations, run `npm run db:reset` and then `npm run db:types`.

## Hosted Supabase project (production)

1. Create a project and link it: `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
2. **Authentication → Providers → Email:** turn on "Confirm email". Set a minimum password length of 8 and require letters and digits.
3. **Authentication → URL configuration:** set the Site URL to your production URL and add `https://<your-domain>/**` to the redirect URLs.
4. **Authentication → Email templates:** paste the templates from `supabase/templates/` (confirmation, recovery, email change). Their links go to `/auth/confirm` with a `token_hash`, so verification works in any browser.
5. **Authentication → SMTP:** configure a real SMTP provider. Supabase's built-in sender is rate-limited and only meant for testing.
6. Add the environment variables to Vercel: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. **Only `SUPABASE_SECRET_KEY` is secret, and it must never get the `NEXT_PUBLIC_` prefix.**

## Still to configure (later stages)

| Item | Needed for |
|---|---|
| Stripe secret key, webhook secret, price IDs for Starter/Growth/Business | Stage 8 billing |
| `CRON_SECRET` + Vercel Cron | **Now required:** hourly `/api/cron/storage-cleanup` (configured in `vercel.json`) removes orphaned SOP files. Stage 5 also uses it for checklist generation |
| Email provider key (e.g. Resend) | Stage 6 invitation emails (copying the invite link works without one) |
| AI provider key | Stage 7 TinyOps AI (the panel stays clearly disabled until a key is set) |
