# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm test             # run all tests (Vitest)
npm run test:watch   # watch mode
npx vitest run src/path/to/file.test.tsx  # single test file
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

## Architecture

**Sprintboard** — DSA prep sheet tracker. Import `.xlsx`, track problems day-by-day, Google sign-in via Firebase Auth; data in PostgreSQL.

### Key conventions

- `@/*` → `src/*` (path alias)
- All data calls go through `src/lib/api.ts` → `POST /api/rpc/[fn]` → `src/lib/db/ops.ts`. Add new operations there (zod args, parameterised SQL)
- Server DB access must run inside `withUser(uid, fn)` (`src/lib/db/session.ts`) so RLS applies; never query user data outside it
- Session: Firebase ID token → `__session` cookie (`/auth/callback`); verify with `getSessionUser()` (`src/lib/firebase/admin.ts`)
- Auth guard lives in `src/app/app/layout.tsx` (Server Component) — redirects unauthenticated users to `/`
- `src/proxy.ts` only checks cookie presence; every route handler must call `getSessionUser()`

### State management

| State type | Tool |
|---|---|
| Server/async state | TanStack React Query (staleTime: 30s) |
| URL / filter state | nuqs — `useFilters()` in `src/hooks/use-filters.ts` |
| Sprint actions (cross-component) | React Context — `SprintActionsProvider` in `src/components/sprint/sprint-context.tsx` |
| Accent color | localStorage + `app.users.accent` (`PATCH /api/me`) |

Filters are always URL state via nuqs — never use local state for filter values.

### Mutations

Use the `useOptimistic` helper in `src/hooks/use-sprint.ts` for any mutation needing instant UI feedback. Pattern: cancel in-flight query → apply optimistic cache update → roll back + toast on failure.

Complex DB operations use Postgres functions in `db/migrations/` (e.g. `reschedule_problems`, `copy_public_sheet`, `create_group`).

### Testing

Tests colocated alongside source as `*.test.{ts,tsx}`.

- Use `renderWithProviders()` from `src/test/render.tsx` — wraps with QueryClient + NuqsTestingAdapter
- Mock `@/lib/api` with `vi.mock` + `vi.hoisted` pattern (see `src/components/sprint/sprint-view.test.tsx` for reference)
- Test fixtures in `src/test/fixtures/`
- DB integration tests: `db/*.db.test.ts`, run with `npm run test:db` (needs a migrated `DATABASE_URL`)
