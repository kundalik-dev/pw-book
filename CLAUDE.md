# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

pw-books is a small library-management app built **solely to be a target for
Playwright practice** — API testing, UI testing, and database-connection
testing. It is not a production app. When making decisions, optimize for
"does this give useful, varied surface to automate against" over
"is this how a real library SaaS would do it."

Full scope lives in [`docs/features.md`](docs/features.md). The build is
sequenced in [`docs/tasks/01-mvp-build-plan.md`](docs/tasks/01-mvp-build-plan.md)
— follow that phase order rather than jumping ahead, and check items off as
they're completed.

## Architecture

npm workspaces + Turborepo monorepo:

- `apps/api` — Express + TypeScript backend, SQL Server via the `mssql`
  package, JWT auth
- `apps/web` — Vite + vanilla TypeScript frontend (no UI framework —
  deliberately using raw DOM so there's real markup to write Playwright
  locators against)
- `apps/db` — no application code; just migration/seed SQL and small Node
  scripts (`migrate`, `seed`, `verify`) that run against the SQL Server
  instance already installed on the machine — **no Docker container**. See
  [`docs/database-setup.md`](docs/database-setup.md) for one-time local
  instance setup (auth mode, login, TCP/IP).

Root `npm run dev` runs `turbo run dev`, which will run `db#verify` (a quick
connect check against the local instance) before starting the API and Vite
dev server together — that Turbo wiring is Phase 11, not done yet, so today
`api` and `web` dev tasks just run independently. The API retries its DB
connection pool on transient failures rather than crashing (Phase 2, done).

## Current status

- **`apps/web` (Phases 6-7) is scaffolded and builds/lints/type-checks
  clean**, built ahead of the backend at the user's request. It talks to a
  swappable `ApiClient` (`apps/web/src/api/client.ts`): an in-memory
  `MockApiClient` by default, or `HttpApiClient` (real `fetch`, matching
  the `{ error: { message, code } }` shape) when `VITE_USE_MOCK_API=false`.
  Implemented so far: login/register with inline validation, navbar with
  account dropdown, book grid with "load more" pagination, toast
  notifications.
- **Known issues / not yet done:**
  - Not verified in a real browser this session (no Chrome extension
    connection available) — only `tsc`, `biome check`, and `vite build`
    were run. Click through `npm run dev -w apps/web` before relying on it.
  - Once Phase 3 (auth APIs) lands, flip `VITE_USE_MOCK_API=false` and
    re-check `HttpApiClient` / the register/login error-code handling
    against the real API — the mock only assumes `EMAIL_TAKEN` and
    `INVALID_CREDENTIALS` codes from `docs/features.md`, not whatever the
    real backend actually returns.
- **`apps/api` (Phase 2) is built and verified end-to-end** against the
  currently-login-blocked local SQL Server instance (see `apps/db` below):
  server starts and stays up, `/api/health` returns 200, `/api/health/db`
  correctly returns 503 while the DB is unreachable and the pool keeps
  retrying every 5s in the background without crashing the process, and a
  404 confirmed the `{ error: { message, code } }` shape end-to-end. Zod
  validation middleware (`src/middleware/validate.ts`) is written but has
  no consumer yet — Phase 3's routes will be the first. Nothing here is
  wired into `apps/web` yet (still on the mock client) since there's no
  `/api/auth/*` for it to call — that's Phase 3.
  - **Bug found and fixed:** the repo has one root `.env`, but plain
    `dotenv/config` and Vite's default `envDir` each only look in their own
    workspace's cwd, so `apps/api` and `apps/web` were silently missing
    every root env var. Both now resolve the path up to the repo root
    explicitly (see `apps/api/src/config.ts` and `apps/web/vite.config.ts`)
    — the same pattern `apps/db/scripts/env.js` already used. Follow this
    pattern for any new workspace that reads env vars.
- **`apps/db` (Phase 1) is built but not yet run end-to-end** — blocked on
  one manual step outside this repo. Details:
  - Local instance discovered: SQL Server 2025 Express, instance
    `SQLEXPRESS`, TCP/IP already enabled on fixed port 1433 (so
    `DB_HOST=localhost` / `DB_PORT=1433` works — no named-instance suffix
    or SQL Browser needed).
  - **Blocker:** the instance's `LoginMode` is Windows-Authentication-only.
    Creating a SQL login doesn't require that (done — see next bullet), but
    *connecting* with one does. Flipping `LoginMode` to mixed mode and
    restarting the `MSSQL$SQLEXPRESS` service both require OS admin rights,
    which this session doesn't have — needs a human to run, in an elevated
    PowerShell:
    ```powershell
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer' -Name 'LoginMode' -Value 2
    Restart-Service -Name 'MSSQL$SQLEXPRESS' -Force
    ```
  - Already done via `sqlcmd` (Windows auth, no admin needed): created the
    `pw_books_app` SQL login, the `pw_books` database, and granted
    `db_owner`. Also ran `apps/db/migrations/001_init.sql` directly via
    `sqlcmd` to validate it — all 8 tables (Users, Authors, Categories,
    Books, BookCategories, Loans, Reviews, WishlistItems) created
    successfully, and a second run confirmed the guards make it idempotent.
  - `apps/db/scripts/verify-connection.js` was run and correctly fails with
    a "Login failed" error pointing at `docs/database-setup.md` — this
    confirms the env-loading and `mssql` connection plumbing work; the only
    thing standing between here and a working `npm run db:migrate` /
    `npm run db:seed` is the elevated command above.
  - `apps/db/scripts/seed.js` (20 books, 6 authors, 5 categories, 3 users,
    3 loans, 4 reviews — deliberately including an unavailable book, an
    overdue loan, and a book with zero reviews per `docs/tasks` phase 10)
    has **not** been run yet; it's written but unverified against a live
    connection. Run it once the login works and sanity-check the row counts
    match the comment in `main()`.
  - Seeded user login for later UI/API testing: any of
    `admin@pwbooks.test` / `member@pwbooks.test` / `alex@pwbooks.test`,
    password `Password123!` for all three.

## Conventions

- TypeScript everywhere, `strict: true`. No `any` unless truly justified.
- Biome is the only linter/formatter — don't add ESLint/Prettier alongside
  it. Run `npm run lint` / `npm run format` from the root.
- Keep the frontend framework-free. Don't introduce React/Vue/etc. — the
  point is practicing selectors against plain HTML, not framework testing
  patterns.
- API error responses always use the shape `{ error: { message, code } }`.
- Prefer adding a new, clearly-named endpoint/UI element over overloading an
  existing one with flags — this app's job is to have lots of distinct,
  learnable surface, not to be DRY.
- Env vars are documented in `.env.sample`; never commit a real `.env`.

## Commands (once scaffolded)

- `npm run dev` — start DB + API + web together
- `npm run build` — build API and web via Turbo
- `npm run lint` / `npm run format` — Biome across all workspaces
- `npm run db:migrate` / `npm run db:seed` — from `apps/db`

## Working in this repo

- Check `docs/tasks/01-mvp-build-plan.md` for current phase/progress before
  starting new work; update checkboxes as tasks complete.
- If scope changes, update `docs/features.md` to match — it's the source of
  truth for what should exist, not this file.
- This repo intentionally does not include a Playwright test suite itself
  (see "Explicitly deferred" in the task plan) — don't add one unless asked.
