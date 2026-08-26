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

Root `npm run dev` runs `turbo run dev`, which runs `db#verify` (a quick
connect check against the local instance) before starting the API and Vite
dev server together. The API also retries its DB connection pool on
transient failures rather than crashing.

## Current status

- **`apps/web` (Phases 6-7) is scaffolded and builds/lints/type-checks
  clean**, but `apps/api` and `apps/db` (Phases 1-5) don't exist yet — the
  frontend was built ahead of the backend at the user's request. It talks
  to a swappable `ApiClient` (`apps/web/src/api/client.ts`): an in-memory
  `MockApiClient` by default, or `HttpApiClient` (real `fetch`, matching
  the `{ error: { message, code } }` shape) when `VITE_USE_MOCK_API=false`.
  Implemented so far: login/register with inline validation, navbar with
  account dropdown, book grid with "load more" pagination, toast
  notifications.
- **Known issues / not yet done:**
  - Not verified in a real browser this session (no Chrome extension
    connection available) — only `tsc`, `biome check`, and `vite build`
    were run. Click through `npm run dev -w apps/web` before relying on it.
  - Once Phases 1-5 land, flip `VITE_USE_MOCK_API=false` and re-check
    `HttpApiClient` / the register/login error-code handling against the
    real API — the mock only assumes `EMAIL_TAKEN` and
    `INVALID_CREDENTIALS` codes from `docs/features.md`, not whatever the
    real backend actually returns.
  - `apps/db` and `apps/api` (Phases 1-5) still need to be built before
    `npm run dev` at root does anything with the DB/API.

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
