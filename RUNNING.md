# Running Sprintboard Locally

This guide gets the app running on your machine with the Firebase Auth emulator and a local PostgreSQL database.

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| Node.js | 20+ (24 recommended) | Next.js app, scripts |
| npm | 10+ | Dependencies |
| PostgreSQL | 14+ (16 recommended) | Data store |
| Java (JDK) | 17+ (21 recommended) | Firebase Auth emulator |
| Docker (optional) | any recent | Easiest way to run Postgres |

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-sprintboard.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-sprintboard

DATABASE_URL=postgres://sprintboard_app:sprintboard_app@localhost:5432/sprintboard
MIGRATION_DATABASE_URL=postgres://postgres:postgres@localhost:5432/sprintboard

NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

- `DATABASE_URL` is the app login (subject to row-level security).
- `MIGRATION_DATABASE_URL` is the owner role, used only by migrations.
- The emulator variables make auth use the local emulator instead of a real Firebase project.

## 3. Start PostgreSQL

### Option A: Docker

```bash
npm run db:up
```

### Option B: Local PostgreSQL (no Docker)

**On macOS (Homebrew):**

```bash
brew services start postgresql@16
createdb sprintboard
psql -d sprintboard -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';"
psql -d sprintboard -f db/local-roles.sql
```

**On Debian/Ubuntu:**

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb sprintboard
sudo -u postgres psql -d sprintboard -f db/local-roles.sql
```

## 4. Apply migrations

```bash
npm run db:migrate
```

Re-run this whenever new files appear in `db/migrations/`.

## 5. Start the Firebase Auth emulator

In a separate terminal (requires Java):

```bash
npm run emulators
```

- Auth emulator: `127.0.0.1:9099`
- Emulator UI: <http://localhost:4000>

Warnings about `::1` only mean IPv6 is unavailable; they are harmless.

## 6. Start the app

In another terminal:

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with Google. The emulator shows a fake account picker; choose **Add new account** and auto-generate the details.

## Summary: the 4 things that must be running

1. PostgreSQL (port 5432)
2. Firebase Auth emulator (port 9099)
3. Migrations applied (one-off per change)
4. `npm run dev` (port 3000)

## Verify

```bash
npm test            # unit and component tests
npm run test:db     # RLS / SQL integration tests (needs Postgres)
npm run typecheck
npm run lint
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `docker: not found` | Use Option B (local PostgreSQL) in step 3. |
| `db:migrate` fails on missing env | Make sure `.env.local` exists and is saved before running. |
| Connection refused on 5432 | PostgreSQL isn't running; start it (step 3). |
| Emulator fails to start | Check `java -version`; install JDK 17+. |
| Sign-in fails or hangs | Confirm the emulator is running and both emulator env vars are set; restart `npm run dev` after editing `.env.local`. |
| Port already in use | Stop the other process or change ports in `firebase.json` / `next dev -p <port>`. |

## Production

See the Deploy section in `README.md`. Production uses a real Firebase project (`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT`) and a pooled `DATABASE_URL`, with no emulator variables.
