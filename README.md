# Sprintboard

Turn an `.xlsx` DSA prep sheet into a day-by-day sprint tracker. Sign in with Google, then:

- **Describe your goal**: type something like "Google SDE-2 in 6 weeks, 2 hrs/day, weak at DP and graphs, skip weekends" and get a personalised sprint built from problems in public sheets. The AI only selects and orders catalogue problem IDs (validated before use), so there are no invented problems or broken links. You review it in the same preview before saving. Gemini runs server-side on Vertex AI or Google AI Studio (see `RUNNING.md`); without it a built-in planner is used.
- **Import** any sheet. Columns (Name, Url, Subject, Difficulty, Companies, Topics, Sprint, Day) are auto-detected, and you can fix the mapping before importing. Parsing happens in the browser.
- **Track** progress. Mark problems done, star them to revisit, and write Markdown notes with highlighted code (autosaved).
- **AI Note Review**: instant analysis of your solution notes — evaluates time & space complexity, flags missing edge cases, and tags algorithmic patterns via Gemini (with an offline analyzer fallback when AI is disabled).
- **Filter & sort** by company, topic, difficulty, subject and status, with free-text search and AI natural-language filter parsing. Save filter combos you use often.
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

### 4. Deploy to Firebase App Hosting (Postgres on Cloud SQL)

In production the app connects through the [Cloud SQL connector](https://github.com/GoogleCloudPlatform/cloud-sql-nodejs-connector) when `CLOUD_SQL_INSTANCE` is set, using `DB_USER` / `DB_PASS` / `DB_NAME` instead of `DATABASE_URL`. Use one region for the backend and the instance.

1. **Cloud SQL**: create the instance, database and owner password.
   ```bash
   gcloud sql instances create sprintboard --database-version=POSTGRES_16 --edition=ENTERPRISE \
     --tier=db-f1-micro --region=<region> --project=<project>
   gcloud sql databases create sprintboard --instance=sprintboard --project=<project>
   gcloud sql users set-password postgres --instance=sprintboard --password='<owner-pw>' --project=<project>
   ```
2. **Schema**: run [`cloud-sql-proxy`](https://cloud.google.com/sql/docs/postgres/sql-proxy) `<project>:<region>:sprintboard` in another terminal. Then apply migrations as `postgres`:
   ```bash
   MIGRATION_DATABASE_URL="postgres://postgres:<owner-pw>@127.0.0.1:5432/sprintboard" npm run db:migrate
   ```
   The migrations create `app_server`. Create the app login role as `postgres`, with `psql` through the proxy or with **Cloud SQL Studio** in the console:
   `create role sprintboard_app login password '<app-pw>'; grant app_server to sprintboard_app;`
3. **Firebase**: `firebase use --add` (alias `prod`). Review configuration in [`apphosting.yaml`](apphosting.yaml) (project, region, and Cloud SQL instance). Store the app role password as a secret:
   `firebase apphosting:secrets:set sprintboard-db-pass --project prod`
4. `firebase apphosting:backends:create --project prod`. Connect this GitHub repo, root `/`, and pick the live branch. Each push to that branch rolls out.
5. Let the backend reach Cloud SQL:
   `gcloud projects add-iam-policy-binding <project> --member=serviceAccount:firebase-app-hosting-compute@<project>.iam.gserviceaccount.com --role=roles/cloudsql.client`
6. Add the backend domain (`<backend>--<project>.<region>.hosted.app`) under **Authentication → Settings → Authorized domains**.

On App Hosting, `firebase-admin` uses the backend's default credentials, so `FIREBASE_SERVICE_ACCOUNT` isn't needed. Don't set any emulator variables in production.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit + component tests (Vitest) |
| `npm run test:db` | Postgres integration tests |
| `npm run test:ai` | Gemini / Vertex AI live eval tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:up` | Start local Postgres container |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run embed:sheets` | Backfill vector embeddings for public sheets |
| `npm run emulators` | Firebase Auth emulator |

## Layout

```
src/
  app/                  routes: landing, /app, /app/import, /app/s/[id], /app/s/[id]/stats, /auth/*
  proxy.ts              cookie-presence redirects (real checks in layout + /api)
  app/api/
    ai/                 routes for filters, review (note analysis), and generate (sprint plan)
    rpc/[fn]            allowlisted data operations, run as the signed-in user
  lib/
    ai/                 Vertex AI / Google AI Studio Gemini client, prompts, and parsers
    review/             solution note analyzer (Gemini + offline rule-based fallback)
    generate/           sprint goal planner and catalog problem selector
    xlsx/               parseWorkbook (hyperlink-aware) + detectMapping/toProblems
    schedule.ts         plan day ↔ date, currentPlanDay, shiftBacklog, sprintForDay
    filters.ts          Filters schema, applyFilters, facets
    stats.ts            streaks, heatmap, summary, breakdown
    api.ts              browser data access (fetch → /api/rpc)
    db/                 pg pool, withUser (RLS session), ops
    firebase/           client SDK, admin SDK + session cookies
  hooks/                useSprint (optimistic mutations), useFilters (URL state), useShortcuts
  components/           sprint (timeline, table, filters, notes drawer), import, ui
db/migrations/          schema, RLS policies, SQL functions, pgvector
```

## Data & privacy

Every table has row-level security (`user_id = app.uid()`; each request sets the verified Firebase uid as a transaction-local setting), so users only see their own sprints. The uploaded file is never stored, only the parsed rows. Person-progress columns in the sheet (e.g. "Prathis", "Eswaran") are ignored on import.
