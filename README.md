# Sprintboard

Turn an `.xlsx` DSA prep sheet into a day-by-day sprint tracker. Sign in with Google, then:

- **Import** any sheet. Columns (Name, Url, Subject, Difficulty, Companies, Topics, Sprint, Day) are auto-detected, and you can fix the mapping before importing. Parsing happens in the browser.
- **Track** progress. Mark problems done, star them to revisit, and write Markdown notes with highlighted code (autosaved).
- **Filter & sort** by company, topic, difficulty, subject and status, with free-text search. Save filter combos you use often.
- **Reschedule**:
  - Set a start date, skip weekends and add rest days.
  - Drag problems between days, or use "Move to day…" on touch.
  - **Shift backlog** moves your earliest unfinished day to today and slides everything unfinished after it forward.
- **Public sheets**: make a sprint public (Settings → Sharing). It then appears in **Explore** (`/app/explore`), and other signed-in users can view the problem list and **copy** it as their own sprint. Your progress and notes are never shared.
- **Study groups**: start a group from any sprint (header → **Group**) and share the invite link. Each member gets their own copy of the sheet, and everyone sees who completed each problem: avatars on every problem card, a leaderboard, and a member-by-problem progress grid. Only done/not-done is shared; notes and stars stay private.
- **Stats**: streaks, a 26-week heatmap, solved-per-day, and completion by difficulty, topic and company.
- **Keyboard**: `⌘K` palette · `j/k` move · `x` done · `s` star · `n` notes · `o` open · `m` move · `/` search · `t` view · `g t` today.

Stack: Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, Tailwind v4, shadcn/ui (Radix), Firebase Auth (Google) + PostgreSQL (RLS, SQL functions) via `pg` in Next.js route handlers, TanStack Query/Virtual, dnd-kit, SheetJS, nuqs, Recharts, Vitest.

## Setup

### 1. Firebase project (auth)

1. Create a project at <https://console.firebase.google.com>, add a **Web app** and copy its config (API key, auth domain, project id).
2. **Authentication → Sign-in method**: enable **Google**. Under **Settings → Authorized domains**, add your production domain.
3. **Project settings → Service accounts → Generate new private key**. Put the JSON (on one line) in `FIREBASE_SERVICE_ACCOUNT`.

### 2. PostgreSQL (data)

Any Postgres 14+ works (Cloud SQL, Neon, local Docker).

1. Create a login role for the app and grant it `app_server`. It must not own tables or have `BYPASSRLS`:
   `create role app_server nologin; create role sprintboard_app login password '...'; grant app_server to sprintboard_app;`
2. Set `MIGRATION_DATABASE_URL` (owner role) and run `npm run db:migrate`. This applies [`db/migrations/`](db/migrations) in order.
3. Set `DATABASE_URL` to the app role.

### 3. Run locally (emulator + Docker Postgres)

```bash
cp .env.example .env.local   # defaults point at the emulator and local Postgres
npm install
npm run db:up                # Postgres 16 in Docker (creates the app role)
npm run db:migrate
npm run emulators            # Firebase Auth emulator on :9099 (needs Java), UI on :4000
npm run dev                  # http://localhost:3000
npm run test:db              # RLS / SQL function integration tests against DATABASE_URL
```

### 4. Deploy to Firebase App Hosting (Postgres on Neon)

1. **Neon**: create a project with database `sprintboard`. In the SQL editor, run the role statements from step 2.1 with a strong password. Then run migrations with the **direct** (non-pooler) owner URL:
   `MIGRATION_DATABASE_URL="postgres://<owner>:<pw>@<host>/sprintboard?sslmode=require" npm run db:migrate`
2. **Firebase**: `firebase use --add` (alias `prod`). Fill the `NEXT_PUBLIC_FIREBASE_*` values in [`apphosting.yaml`](apphosting.yaml).
3. Store the **pooled** (`-pooler` host) app URL as a secret:
   `firebase apphosting:secrets:set database-url --project prod`
   Value: `postgres://sprintboard_app:<pw>@<pooler-host>/sprintboard?sslmode=require`
4. `firebase apphosting:backends:create --project prod`. Connect this GitHub repo, root `/`, and pick the live branch. Each push to that branch rolls out.
5. Add the backend domain (`<backend>--<project>.<region>.hosted.app`) under **Authentication → Settings → Authorized domains**.

On App Hosting, `firebase-admin` uses the backend's default credentials, so `FIREBASE_SERVICE_ACCOUNT` isn't needed. Don't set any emulator variables in production.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit + component tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run emulators` | Firebase Auth emulator |
| `npm run test:db` | Postgres integration tests |

## Layout

```
src/
  app/                  routes: landing, /app, /app/import, /app/s/[id], /app/s/[id]/stats, /auth/*
  proxy.ts              cookie-presence redirects (real checks in layout + /api)
  app/api/rpc/[fn]      allowlisted data operations, run as the signed-in user
  lib/
    xlsx/               parseWorkbook (hyperlink-aware) + detectMapping/toProblems
    schedule.ts         plan day ↔ date, currentPlanDay, shiftBacklog, sprintForDay
    filters.ts          Filters schema, applyFilters, facets
    stats.ts            streaks, heatmap, summary, breakdown
    api.ts              browser data access (fetch → /api/rpc)
    db/                 pg pool, withUser (RLS session), ops
    firebase/           client SDK, admin SDK + session cookies
  hooks/                useSprint (optimistic mutations), useFilters (URL state), useShortcuts
  components/sprint/    timeline, table, filter bar, notes drawer, dialogs
db/migrations/          schema, RLS policies, SQL functions
```

## Data & privacy

Every table has row-level security (`user_id = app.uid()`; each request sets the verified Firebase uid as a transaction-local setting), so users only see their own sprints. The uploaded file is never stored, only the parsed rows. Person-progress columns in the sheet (e.g. "Prathis", "Eswaran") are ignored on import.
