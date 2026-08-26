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

## Phase 1 — Database (`apps/db`)

Uses the SQL Server instance already installed on the machine — no
container. See [`docs/database-setup.md`](../database-setup.md) for the
one-time local instance setup (auth mode, login, TCP/IP).

- [ ] Create `apps/db` workspace (scripts + SQL only, no app code)
- [ ] Confirm the local SQL Server instance is reachable (via `sqlcmd` or
      SSMS/Azure Data Studio) using the credentials that will go in `.env`
      before writing any scripts against it
- [ ] `apps/db/migrations/001_init.sql` — `CREATE DATABASE pw_books` (if not
      exists) + tables: Users, Authors, Categories, Books, BookCategories
      (junction), Loans, Reviews, WishlistItems
- [ ] `apps/db/seed.sql` (or a small Node seed script) — a handful of authors,
      categories, ~20 books with varied availability, 1 admin + 1 member user
- [ ] `apps/db/scripts/migrate.js` — connects with the `mssql` package using
      `.env` creds and runs the migration SQL file(s)
- [ ] `apps/db/scripts/seed.js` — same, for seed data
- [ ] `apps/db/scripts/verify-connection.js` — quick connect-and-disconnect
      check; this is what Turbo runs before `api`'s `dev` task so a missing/
      stopped local SQL Server service fails fast with a clear message
- [ ] `apps/db/package.json` scripts: `migrate`, `seed`, `verify`
- [ ] Confirm `npm run db:migrate` then `npm run db:seed` succeed against the
      local instance before wiring into Turbo

## Phase 2 — Backend core (`apps/api`)

- [ ] Scaffold Express + TypeScript (`tsx` or `ts-node-dev` for watch mode)
- [ ] Config module reading `.env` (DB creds, JWT secret, PORT, CORS origin)
- [ ] `mssql` connection pool module with retry-on-startup (don't crash if
      the local SQL Server service isn't running yet or is momentarily
      unreachable)
- [ ] Central error-handling middleware → consistent JSON error shape
      `{ error: { message, code } }`
- [ ] Request logging (morgan or pino)
- [ ] `GET /api/health` and `GET /api/health/db`
- [ ] Zod (or equivalent) request-validation middleware pattern established

## Phase 3 — Auth APIs

- [ ] `POST /api/auth/register` (bcrypt hash, duplicate-email 409)
- [ ] `POST /api/auth/login` (JWT access + refresh token)
- [ ] `POST /api/auth/refresh`
- [ ] `POST /api/auth/logout`
- [ ] `GET /api/auth/me` + auth middleware (401 on missing/invalid token)
- [ ] Role-check middleware (`admin` vs `member`) for later use

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
  pw-books is to be automated *from outside*; add a Playwright project
  later, once the app is stable, if you want it living alongside the app.
- CI pipeline — not needed for a local practice target.
- Any real email/payment/production-auth hardening.
- Docker for SQL Server — deliberately not used. A SQL Server instance is
  already installed locally, so `apps/db` only holds scripts/SQL, not a
  container definition.
