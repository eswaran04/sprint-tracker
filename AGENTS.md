<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sprintboard — Agent Guide

DSA prep sheet tracker: import an `.xlsx` sheet, track problems day-by-day, share public sheets, study groups, and
AI helpers (NL filters, note review, goal-based sprint generation). Google sign-in via Firebase Auth; data in PostgreSQL
with row-level security.

Stack: Next.js 16.3 (App Router, Turbopack, `src/proxy.ts` — not `middleware.ts`), React 19.2, TypeScript, Tailwind v4,
shadcn/ui (Radix), TanStack Query/Virtual, nuqs, zod v4, `pg`, Firebase Auth, Gemini via `@google/genai`, Vitest.

## Commands

```bash
npm run dev                                  # dev server (http://localhost:3000)
npm run build                                # production build
npm test                                     # unit + component tests (Vitest, jsdom)
npx vitest run src/path/to/file.test.tsx     # single test file
npm run lint                                 # ESLint
npm run typecheck                            # tsc --noEmit
npm run test:db                              # Postgres RLS/SQL integration tests (needs migrated DATABASE_URL)
npm run test:ai                              # live Gemini evals (*.eval.ts) — not CI, needs credentials
npm run db:up && npm run db:migrate          # local Postgres (Docker) + migrations
npm run emulators                            # Firebase Auth emulator on :9099 (needs Java)
```

Before finishing a change, run `npm run typecheck`, `npm run lint` and `npm test` (plus `npm run test:db` if you
touched SQL). Local setup details live in `RUNNING.md`; deployment in `README.md`.

## Layout

- `src/app/` — routes. `/` landing, `/app/**` authenticated app, `/auth/*` session callback/signout.
- `src/app/api/rpc/[fn]/route.ts` — single allowlisted data endpoint, dispatches to `src/lib/db/ops.ts`.
- `src/app/api/ai/{filters,review,generate}` — AI route handlers; `src/app/api/me` — profile/accent/goal.
- `src/lib/` — pure, unit-tested logic (`schedule`, `filters`, `stats`, `groups`, `xlsx/`, `review/`, `generate/`, `ai/`).
- `src/lib/db/` — `pool.ts`, `session.ts` (`withUser`), `ops.ts` (all data operations).
- `src/lib/firebase/` — client SDK, admin SDK (`getSessionUser`), env/session cookie name.
- `src/hooks/` — `useSprint` (optimistic mutations), `useFilters` (URL state), shortcuts, groups.
- `src/components/` — feature folders (`sprint`, `import`, `explore`, `groups`, `stats`, `shell`) + `ui/` (shadcn).
- `db/migrations/` — timestamped SQL: schema, RLS policies, security-definer functions, pgvector.
- `scripts/` — `migrate.mjs`, `embed-sheets.mjs`.

## Conventions

- Path alias `@/*` → `src/*`.
- **Data access**: browser → `src/lib/api.ts` → `POST /api/rpc/[fn]` → `ops` in `src/lib/db/ops.ts`. To add an
  operation: define zod args + parameterised SQL in `ops.ts`, then a typed wrapper in `api.ts`. Never interpolate
  request values into SQL; patch column names come from fixed allowlists (`.strict()` zod objects).
- **RLS**: user data must only be queried inside `withUser(uid, fn)` (`src/lib/db/session.ts`). It sets
  `role authenticated` + `app.uid` transaction-locally. Do not query user tables outside it.
- **Auth**: `src/proxy.ts` only checks cookie presence. Every route handler must call `getSessionUser()` and return
  401 when null. The page guard lives in `src/app/app/layout.tsx`.
- Route handlers that use `pg`/firebase-admin set `export const runtime = "nodejs"`. Server-only modules import
  `"server-only"`.
- Complex multi-row DB logic goes in Postgres functions in a **new** migration file
  (`db/migrations/YYYYMMDDHHMMSS_name.sql`). Never edit an already-applied migration.

### State

| State | Tool |
| --- | --- |
| Server/async | TanStack Query (staleTime 30s) |
| Filters / URL | nuqs via `useFilters()` — never local state for filter values |
| Cross-component sprint actions | `SprintActionsProvider` (`src/components/sprint/sprint-context.tsx`) |
| Accent color | localStorage + `app.users.accent` (`PATCH /api/me`) |

Mutations needing instant feedback use the `useOptimistic` helper in `src/hooks/use-sprint.ts`: cancel in-flight
query → optimistic cache update → roll back + toast on failure.

### AI features

- Client/config in `src/lib/ai/vertex.ts`: `isAiEnabled()`, `vertexJson`, `vertexLlm`, model getters
  (`AI_FILTERS_MODEL`, `AI_REVIEW_MODEL`, `AI_GENERATE_MODEL`, default `gemini-2.5-flash-lite`).
- Works with Vertex AI (ADC, `GOOGLE_CLOUD_PROJECT`) or an API key (`GEMINI_API_KEY`). `AI_ENABLED=false` disables it.
- Every AI feature must degrade gracefully: review and generate fall back to offline heuristics
  (`src/lib/review/heuristics.ts`, `src/lib/generate/heuristic.ts`) when AI is off or the model fails.
- Validate model output with zod; the generator may only pick existing catalogue problem IDs.
- AI routes use `createRateLimiter` / `createLru` from `src/lib/ai/limits.ts`; only cache successful AI results.

## Testing

- Tests are colocated as `*.test.{ts,tsx}`; DB tests are `db/*.db.test.ts`; live AI evals are `src/**/*.eval.ts`.
- Render components with `renderWithProviders()` from `src/test/render.tsx` (QueryClient + NuqsTestingAdapter).
- Mock `@/lib/api` with `vi.mock` + `vi.hoisted` (reference: `src/components/sprint/sprint-view.test.tsx`).
- Fixtures live in `src/test/fixtures/`. Unit tests must not hit the network, a database or a real model.

## Gotchas

- `.env*` files are gitignored, so never commit secrets. Env is loaded from `.env.local` (scripts use `--env-file-if-exists`).
- Restart `npm run dev` after editing `.env.local`.
- Don't set emulator variables (`*_AUTH_EMULATOR_HOST`) in production.
- Check `node_modules/next/dist/docs/` before using Next.js APIs (e.g. `RouteContext<"/api/rpc/[fn]">` typed params,
  async `ctx.params`, `after()`).
- Keep changes focused: reuse existing helpers in `src/lib/` and avoid unrelated refactors.
