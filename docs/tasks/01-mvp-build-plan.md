# Task list: pw-books MVP build

Source of truth for scope: [`docs/features.md`](../features.md). Work top to
bottom — later phases assume earlier ones are done. Check items off as you go.

## Phase 0 — Repo & tooling bootstrap ✅

- [x] `npm init` at root, set up npm workspaces: `apps/*`, `packages/*`
- [x] Install & configure Turborepo (`turbo.json` with `dev`, `build`, `lint`,
      `test` pipelines; `dev` is `persistent`/`cache: false`)
- [x] Install & configure Biome at root (`biome.json`) — lint + format,
      applied across all workspaces; added root `lint` / `format` scripts
- [x] Root `.gitignore` (`node_modules`, `dist`, `.env`, `*.log`, `.turbo`)
- [x] Root `.env.sample` present; real `.env` gitignored
- [x] Verified `npm run dev` / `npm run build` at root resolve cleanly with
      0 packages (no workspaces wired up yet) — sanity check before adding
      apps

## Phase 1 — Database (`apps/db`) — ⚠️ built, blocked on one manual step - completed migration successfuly✅

Uses the SQL Server instance already installed on the machine — no
container. See [`docs/database-setup.md`](../database-setup.md) for the
one-time local instance setup (auth mode, login, TCP/IP).

- [x] Create `apps/db` workspace (scripts + SQL only, no app code)
- [x] Confirm the local SQL Server instance is reachable — found: SQL
      Server 2025 Express, instance `SQLEXPRESS`, TCP/IP already enabled on
      fixed port 1433 (no named-instance suffix needed)
- [x] `apps/db/migrations/001_init.sql` — idempotent `CREATE TABLE ... IF
NOT EXISTS`-style DDL for Users, Authors, Categories, Books,
      BookCategories, Loans, Reviews, WishlistItems. Validated directly via
      `sqlcmd` (Windows auth): all 8 tables created, re-run confirmed
      idempotent.
- [x] `apps/db/scripts/seed.js` — 6 authors, 5 categories, 20 books (varied
      availability incl. two at 0 copies), 3 users, 3 loans (active,
      overdue, returned), 4 reviews. **Written but not yet executed** — see
      blocker below.
- [x] `apps/db/scripts/migrate.js` — reads `.env`, ensures the DB exists,
      runs `migrations/*.sql` in order. **Written but not yet executed
      end-to-end via Node** (the SQL itself was validated separately via
      `sqlcmd`, see above).
- [x] `apps/db/scripts/verify-connection.js` — done and run; correctly
      fails right now with a "Login failed" error (expected — see blocker),
      confirming the env-loading/connection plumbing itself works.
- [x] `apps/db/package.json` scripts: `migrate`, `seed`, `verify`
- [x] Confirm `npm run db:migrate` then `npm run db:seed` succeed against
      the local instance — **blocked, see below**

**Blocker (needs a human with OS admin rights):** the SQLEXPRESS instance
is Windows-Authentication-only. The `pw_books_app` SQL login, the
`pw_books` database, and `db_owner` grant were already created (via
`sqlcmd` with Windows auth — doesn't need admin), but SQL Server won't
accept that login until mixed mode is turned on. Run this once, in an
**elevated** PowerShell:

```powershell
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer' -Name 'LoginMode' -Value 2
Restart-Service -Name 'MSSQL$SQLEXPRESS' -Force
```

Then run `npm run db:migrate` and `npm run db:seed` from the repo root to
finish Phase 1. Seeded login for later testing: `admin@pwbooks.test` /
`member@pwbooks.test` / `alex@pwbooks.test`, password `Password123!`.

## Phase 2 — Backend core (`apps/api`) ✅

- [x] Scaffold Express + TypeScript (`tsx watch` for dev, `tsc` for build).
      CommonJS, not ESM — NodeNext's mandatory `.js` extensions on relative
      imports weren't worth it for a small backend; matches how `apps/db`'s
      scripts are structured too.
- [x] Config module (`src/config.ts`) reading `.env` (DB creds, JWT secret,
      PORT, CORS origin) — throws a clear error naming the missing var if
      one's absent, same as `apps/db/scripts/env.js`
- [x] `mssql` connection pool module (`src/db/pool.ts`) with retry-on-startup
      — retries every 5s in the background and re-arms on pool `error`
      events; verified live against the real (currently login-blocked, see
      Phase 1) SQL Server instance: server starts and stays up, keeps
      retrying, never crashes
- [x] Central error-handling middleware (`src/middleware/errorHandler.ts`) →
      `{ error: { message, code } }`; verified via curl (404 route, and any
      `ApiError` thrown downstream)
- [x] Request logging via `morgan` (`dev` format outside production)
- [x] `GET /api/health` (always 200) and `GET /api/health/db` (200 when the
      pool is connected, 503 with `{ dbConnected: false }` otherwise) —
      manually verified against the currently-unreachable DB
- [x] Zod request-validation middleware pattern established
      (`src/middleware/validate.ts`, a `validate(schema, part)` factory) —
      not yet consumed by a route since there's nothing to validate until
      Phase 3's auth endpoints exist

  **Bug found and fixed while testing this end-to-end:** the repo has one
  root `.env` (per README), but plain `dotenv/config` and Vite's default
  `envDir` each only look in their own workspace's cwd — so `apps/api` and
  `apps/web` were silently missing every root env var. Fixed both:
  `apps/api/src/config.ts` now calls `dotenv.config({ path: ... })` resolved
  up to the repo root (matching the pattern `apps/db/scripts/env.js` already
  used), and `apps/web/vite.config.ts` now sets `envDir` to the repo root
  too. If you scaffold another workspace that reads env vars, use the same
  pattern — don't rely on the default cwd-relative lookup.

## Phase 3 — Auth APIs ✅

- [x] `POST /api/auth/register` (bcrypt hash via `bcryptjs`, duplicate-email
      409 `EMAIL_TAKEN`)
- [x] `POST /api/auth/login` (JWT access + refresh token, 401
      `INVALID_CREDENTIALS`)
- [x] `POST /api/auth/refresh` — refresh token rotation: each refresh
      atomically revokes the presented token and issues a new pair; reusing
      an already-rotated or revoked token returns 401
      `INVALID_REFRESH_TOKEN`. Backed by a new `dbo.RefreshTokens` table
      (`apps/db/migrations/002_refresh_tokens.sql`, storing a SHA-256 hash
      of each token's `jti`, not the raw token)
- [x] `POST /api/auth/logout` — revokes the given refresh token server-side
      (204; idempotent on an already-invalid token)
- [x] `GET /api/auth/me` + `requireAuth` middleware (401 on missing/invalid
      bearer token)
- [x] `requireRole(...roles)` middleware (`admin` vs `member`) for later use
      — not yet wired to a route, Phase 4/5 CRUD will consume it

  Verified end-to-end against the live local DB (not just `tsc`/`biome`):
  register → login → `/auth/me` → refresh → old-token replay rejected →
  logout → refresh-after-logout rejected → duplicate-email 409. New files:
  `src/routes/auth.ts`, `src/services/authService.ts`,
  `src/schemas/auth.ts`, `src/middleware/auth.ts`, `src/utils/jwt.ts`,
  `src/utils/password.ts`, `src/db/refreshTokens.ts`. Added `bcryptjs` and
  `jsonwebtoken` (+ `@types/jsonwebtoken`) to `apps/api/package.json`.

## Phase 4 — Core CRUD APIs

- [ ] Authors CRUD
- [ ] Categories CRUD
- [ ] Books CRUD (list with pagination/sort/filter/search, get-by-id,
      create/update with Multer cover upload, delete)
- [ ] `PATCH /api/books/:id/availability`

## Phase 5 — Advanced/workflow APIs

- [ ] Loans: borrow, return, `GET /api/loans/me`, `GET /api/loans/overdue`
- [ ] Reviews: list, create (one-per-user-per-book), delete (ownership check)
- [ ] `POST /api/books/bulk-import` (CSV, partial-failure response)
- [ ] `GET /api/books/export` (CSV download)
- [ ] `GET /api/slow?ms=` and `GET /api/flaky`

## Phase 6 — Frontend scaffold (`apps/web`)

- [x] Vite + vanilla TypeScript project
- [x] Minimal client-side router (or plain multi-page app — simpler is fine)
- [x] Typed `fetch` API client wrapping the backend base URL from env
- [x] Global layout: navbar + page container + toast/alert host

  Built ahead of the backend (Phases 1-5 aren't done yet — see note below),
  so `apps/web/src/api/client.ts` selects between a real `HttpApiClient`
  (fetch-based) and an in-memory `MockApiClient` via `VITE_USE_MOCK_API`
  (defaults to mock). Both implement the same `ApiClient` interface in
  `src/api/types.ts`, so switching to the real backend later is a one-line
  env flip, not a rewrite.

## Phase 7 — Frontend: simple UI

- [x] Login / Register pages with inline validation
- [x] Navbar with account dropdown, active-link styling
- [x] Book list page: grid, "load more" pagination
- [x] Toast notifications on success/error

  **Not yet verified in a real browser** — the Chrome extension wasn't
  connected in this session, so this was validated via `tsc`, `biome
check`, and `vite build` only, not by clicking through the app. Before
  trusting this UI, load `npm run dev -w apps/web` and check: register →
  redirected to /books with a welcome toast; load more paginates the mock
  24-book set; logout clears the account dropdown and redirects to /login.

  **Needs fixing once Phase 2-5 backend exists:** set
  `VITE_USE_MOCK_API=false` in `.env`, then re-check `register`/`login`
  error-code handling in `src/pages/register.ts` and
  `src/api/httpClient.ts` against the real `{ error: { message, code } }`
  responses — the mock only exercises the `EMAIL_TAKEN` and
  `INVALID_CREDENTIALS` codes assumed from `docs/features.md`, not
  whatever the real API actually returns.

## Phase 8 — Frontend: intermediate UI

- [ ] Debounced search bar with autocomplete dropdown
- [ ] Filter sidebar: checkboxes, radio buttons, year range slider,
      multi-select
- [ ] Sort dropdown
- [ ] Breadcrumbs, tooltips
- [ ] Accordion on book detail sections
- [ ] Skeleton loaders during fetch

## Phase 9 — Frontend: complex UI

- [ ] Book detail page: tabs + cover image carousel
- [ ] Star-rating widget (plain) + a Shadow DOM `<star-rating>` custom
      element variant
- [ ] Admin data table: sortable columns, row selection, bulk-delete bar
- [ ] Modals: confirm-delete, add-to-wishlist
- [ ] Multi-step borrow/checkout wizard
- [ ] Drag-and-drop wishlist reordering
- [ ] Light/dark theme toggle persisted to `localStorage`
- [ ] `<iframe>` panel (library location placeholder)
- [ ] One isolated page with a native `confirm()` dialog (delete account)

## Phase 10 — Seed data & fixtures polish

- [ ] Re-check seed data covers: an unavailable book (0 copies), a book with
      no reviews, a book with many reviews, an overdue loan, a user with an
      active loan — so UI/API edge cases are reachable without manual setup

## Phase 11 — Wiring it all together

- [ ] `turbo.json` `dev` pipeline: `api` and `web` run in parallel; `api`'s
      `dev` task depends on `db#verify` so `npm run dev` fails fast with a
      clear message if the local SQL Server service isn't running, instead
      of the API silently retrying forever
- [ ] Confirm `npm run dev` at root brings up API + web with one command
      (DB itself is just the always-on local Windows service — nothing to
      start for it)
- [ ] API retries its DB connection pool on transient failures (from
      Phase 2) so brief hiccups don't crash the process
- [ ] `npm run lint` / `npm run format` at root run Biome across every
      workspace
- [ ] `npm run build` builds `apps/api` and `apps/web` via Turbo

## Phase 12 — Docs pass

- [ ] Update `README.md` if any setup step changed from what's documented
- [ ] Update `CLAUDE.md` if conventions or structure shifted during the build
- [ ] Update `docs/features.md` if scope changed
- [ ] Update `docs/database-setup.md` if local SQL Server setup steps changed

## Explicitly deferred (not part of this MVP)

- A `tests/` Playwright workspace inside this repo — the whole point of
  pw-books is to be automated _from outside_; add a Playwright project
  later, once the app is stable, if you want it living alongside the app.
- CI pipeline — not needed for a local practice target.
- Any real email/payment/production-auth hardening.
- Docker for SQL Server — deliberately not used. A SQL Server instance is
  already installed locally, so `apps/db` only holds scripts/SQL, not a
  container definition.
