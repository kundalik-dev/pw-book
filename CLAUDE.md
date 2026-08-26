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
they're completed. Known gaps and pending work are tracked in
[`docs/issues.md`](docs/issues.md).

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
dev server together (Phase 11, done) — a stopped SQL Server service fails
`npm run dev` fast with a clear error instead of the API silently retrying
forever. The API also retries its own DB connection pool on transient
failures rather than crashing (Phase 2).

## Current status

All 11 build phases in `docs/tasks/01-mvp-build-plan.md` are done — the app
is fully built, wired together, and verified (Phase 12, this docs pass, is
the last step). That file has the complete phase-by-phase history, decisions,
and curl/tsc/biome-verified test matrices; don't duplicate it here. For open
items, see [`docs/issues.md`](docs/issues.md) — most importantly, **the
frontend has never been click-tested in a real browser** (no Chrome
extension connection has been available in any session so far), so treat
the UI as compile/build/curl-verified but not runtime-verified until that
happens.

Quick orientation:

- `apps/db` — migrated and seeded against the local SQL Server instance
  (`localhost:1433`, SQL Server 2025 Express, `SQLEXPRESS`). Seeded login
  for UI/API testing: `admin@pwbooks.test` / `member@pwbooks.test` /
  `alex@pwbooks.test`, password `Password123!` for all three.
- `apps/api` — full Auth/Books/Authors/Categories/Loans/Reviews CRUD,
  CSV bulk-import/export, chaos routes (`/api/slow`, `/api/flaky`), and an
  admin-only `POST /api/system/reset` that wipes and reseeds the DB back to
  baseline. No stub/placeholder handlers anywhere.
- `apps/web` — login/register, book grid with search/filter/sort, book
  detail (tabs, carousel, reviews, star ratings), borrow wizard, wishlist
  (drag-and-drop, `localStorage`-backed, no backend API — never in scope),
  admin data table (sort/select/bulk-delete), an admin-only `/settings`
  reset-app page, theme toggle, a Shadow DOM `<star-rating>` element, and
  one isolated native `confirm()` on `/account/delete`. Talks to a
  swappable `ApiClient` (`apps/web/src/api/client.ts`): real `HttpApiClient`
  by default, or in-memory `MockApiClient` when `VITE_USE_MOCK_API=true`.
- Two env-loading fixes to know about if you scaffold another workspace
  that reads env vars: the repo has one root `.env`, but plain
  `dotenv/config` / Vite's default `envDir` each only look in their own
  workspace's cwd — `apps/api/src/config.ts` and `apps/web/vite.config.ts`
  both resolve the path up to the repo root explicitly, matching the
  pattern `apps/db/scripts/env.js` already used.

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
- Accessibility isn't optional here — it's what makes elements reliably
  targetable by Playwright locators. Every interactive element needs an
  accessible name: real `<button>`/`<a>`/`<input>` elements (not clickable
  `<div>`s), form inputs associated with a `<label for>` (or wrapped in one),
  icon-only controls given `aria-label`, grouped checkboxes/radios in a
  `<fieldset><legend>`, and `data-testid` added on top for anything a visible
  label/role can't uniquely identify (repeated rows, icon buttons). This
  favors `getByRole`/`getByLabel` locators over brittle CSS/XPath selectors.

## Commands

- `npm run dev` — start DB + API + web together
- `npm run build` — build API and web via Turbo
- `npm run lint` / `npm run format` — Biome across all workspaces
- `npm run db:migrate` / `npm run db:seed` — from `apps/db`

## Working in this repo

- Check `docs/tasks/01-mvp-build-plan.md` for phase history/progress before
  starting new work; update checkboxes as tasks complete.
- Check [`docs/issues.md`](docs/issues.md) for known gaps/pending work
  before starting new work, and update it as issues are found or resolved
  (resolved items get deleted from it, not marked done in place — the task
  plan is the historical record, that file is a live list).
- If scope changes, update `docs/features.md` to match — it's the source of
  truth for what should exist, not this file.
- This repo intentionally does not include a Playwright test suite itself
  (see "Explicitly deferred" in the task plan) — don't add one unless asked.
- Dont use chrome extension for testing instead ask me to do testing and in terminal show what to test for that feature in short.
