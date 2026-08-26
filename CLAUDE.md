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
- **`apps/api` (Phases 2-4) is built and verified end-to-end against the
  live local SQL Server instance** — the Phase 1 login blocker below was
  resolved and the DB is now migrated + seeded. `/api/health` and
  `/api/health/db` both work as designed. Auth (Phase 3): register, login,
  refresh (with rotation + reuse-detection), logout, `GET /api/auth/me`,
  and `requireAuth`/`requireRole('admin')` middleware are all live —
  see `src/routes/auth.ts`, `src/services/authService.ts`,
  `src/middleware/auth.ts`, `src/utils/{jwt,password}.ts`,
  `src/db/refreshTokens.ts`. Core CRUD (Phase 4): full Authors/Categories/
  Books CRUD, all mutating routes admin-gated via Phase 3's middleware,
  Books list with pagination/sort/filter/search, Multer cover-image upload
  served from `/uploads/covers/`, and `PATCH /api/books/:id/availability`
  — see `src/routes/{authors,categories,books}.ts`,
  `src/repositories/{authors,categories,books}.ts`,
  `src/schemas/{author,category,book}.ts`. `GET /api/books/export` is a
  501 stub — real CSV export is Phase 5. Details and the full curl-verified
  test matrix are in `docs/tasks/01-mvp-build-plan.md` (Phase 3 and Phase 4
  sections).
  - **Bug found and fixed (Phase 2):** the repo has one root `.env`, but
    plain `dotenv/config` and Vite's default `envDir` each only look in
    their own workspace's cwd, so `apps/api` and `apps/web` were silently
    missing every root env var. Both now resolve the path up to the repo
    root explicitly (see `apps/api/src/config.ts` and
    `apps/web/vite.config.ts`) — the same pattern `apps/db/scripts/env.js`
    already used. Follow this pattern for any new workspace that reads env
    vars.
- **`apps/db` (Phase 1) is fully migrated and seeded** — the mixed-mode
  login blocker was resolved by a human running the elevated PowerShell
  step, and `npm run db:migrate` / `npm run db:seed` have both run
  successfully against `localhost:1433` (SQL Server 2025 Express,
  `SQLEXPRESS`). All 8 tables plus the Phase 3 `dbo.RefreshTokens` table
  (`apps/db/migrations/002_refresh_tokens.sql`) exist; seed data (6
  authors, 5 categories, 20 books, 3 users, 3 loans, 4 reviews) is loaded.
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
