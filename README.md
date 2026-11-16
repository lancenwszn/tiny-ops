# TinyOps

**Your business, organized.** A business operations hub for small teams: SOPs, recurring checklists, tasks, team handovers and operational reports in one simple workspace. Built by SZN Labs.

## Status

| Stage | Scope | State |
|---|---|---|
| 1 | Foundation: design system, auth, workspaces, RLS | ✅ Done |
| 2 | App shell and operational dashboard | ✅ Done (in review) |
| 3 | SOP management | Next |
| 4 | Task management | Planned |
| 5 | Recurring checklists | Planned |
| 6 | Team management and handovers | Planned |
| 7 | Notifications, activity, reports, AI | Planned |
| 8 | Stripe billing | Planned |
| 9 | Marketing website | Planned |
| 10 | QA, security review, deployment | Planned |

## Quick start

```bash
npm install
npx supabase start          # needs Docker
cp .env.example .env.local  # then paste the values from `npx supabase status`
npm run dev
```

Open http://localhost:3000. Auth emails go to Mailpit at http://127.0.0.1:54324.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | Static checks |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:db` | Database and RLS tests (pgTAP) |
| `npm run test:e2e` | End-to-end tests (Playwright; build first) |
| `npm run db:reset` / `db:types` | Re-apply migrations and regenerate types |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Setup & configuration](docs/SETUP.md)
- [Security model](docs/SECURITY.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Changelog](docs/CHANGELOG.md)
