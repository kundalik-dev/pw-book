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

## Phase 4 — Core CRUD APIs ✅

- [x] Authors CRUD (`GET /api/authors`, `GET /api/authors/:id`, admin-only
      `POST`/`PUT`/`DELETE`) — deleting an author still referenced by a book
      returns 409 `AUTHOR_HAS_BOOKS` (FK violation translated, SQL error 547)
- [x] Categories CRUD (`GET /api/categories`, `GET /api/categories/:id`,
      admin-only `POST`/`PUT`/`DELETE`) — duplicate name returns 409
      `CATEGORY_EXISTS`; deleting a category cascades off `BookCategories`
      (schema-level `ON DELETE CASCADE`), so it's never blocked
- [x] Books CRUD:
      - `GET /api/books` — `page`/`limit` pagination, `sort` (whitelisted
        `title|-title|publishedYear|-publishedYear|createdAt|-createdAt`),
        filters (`category`, `author`, `year`, `available=true|false`),
        full-text `q` (LIKE across title/isbn/description)
      - `GET /api/books/:id` — 404 `BOOK_NOT_FOUND`
      - Admin-only `POST /api/books` / `PUT /api/books/:id` — multipart via
        Multer (`cover` field, JPEG/PNG/WebP, 5MB limit), stored under
        `apps/api/uploads/covers` and served at `/uploads/covers/<file>`;
        duplicate ISBN → 409 `BOOK_ISBN_EXISTS`, bad `authorId`/`categoryIds`
        → 400 `AUTHOR_NOT_FOUND`/`CATEGORY_NOT_FOUND`
      - Admin-only `DELETE /api/books/:id`
- [x] Admin-only `PATCH /api/books/:id/availability` — 400
      `INVALID_AVAILABILITY` if the new value would exceed `totalCopies`

  All mutating routes are gated with the `requireAuth` + `requireRole('admin')`
  middleware Phase 3 landed (no TODO/placeholder needed — Phase 3 finished
  before this phase's routes were wired up). New files: `src/repositories/{authors,categories,books}.ts`,
  `src/schemas/{author,category,book}.ts`, `src/routes/{authors,categories,books}.ts`,
  `src/middleware/upload.ts`, `src/db/requirePool.ts` (503 `DB_UNAVAILABLE`
  if a repository call runs while the pool is down). Added `multer` +
  `@types/multer` to `apps/api/package.json`; added `apps/api/uploads/` to
  `.gitignore`.

  Verified end-to-end against the live local DB (not just `tsc`/`biome`) via
  curl against the running dev server: full list/filter/sort/search/paginate
  matrix, get-by-id + 404, validation errors (bad id, bad `sort` enum) → 400
  `VALIDATION_ERROR`, unauthenticated admin routes → 401, authenticated admin
  create/update/delete/patch-availability, duplicate-category 409,
  over-capacity availability 400, FK-conflict author delete 409, multipart
  cover upload → file written to disk and served back over `/uploads/...`,
  bad `authorId` on create → 400. All test data created during verification
  was deleted afterward.

  **`GET /api/books/export` is intentionally a 501 `NOT_IMPLEMENTED` stub for
  now** — it's explicit Phase 5 scope (CSV export), not part of this phase.
  It's registered ahead of `/api/books/:id` so the `:id` route doesn't
  swallow the `export` path; keep that ordering when Phase 5 implements it
  for real.

## Phase 5 — Advanced/workflow APIs ✅

- [x] Loans: `POST /api/loans` (borrow), `PUT /api/loans/:id/return`,
      `GET /api/loans/me`, admin-only `GET /api/loans/overdue` — see
      `src/routes/loans.ts`, `src/repositories/loans.ts`, `src/schemas/loan.ts`
- [x] Reviews: `GET /api/books/:id/reviews`, `POST /api/books/:id/reviews`
      (one-per-user-per-book), `DELETE /api/reviews/:id` (owner or admin only,
      403 `FORBIDDEN` otherwise) — see `src/routes/reviews.ts`,
      `src/repositories/reviews.ts`, `src/schemas/review.ts`
- [x] `POST /api/books/bulk-import` — CSV via Multer, unknown authors/
      categories created on the fly, per-row partial-failure response
      (201 all-success / 207 partial / 400 all-failed), `src/utils/csv.ts` for
      parse/stringify
- [x] `GET /api/books/export` — real CSV download (replaced the Phase 4 501
      stub), `title,isbn,authorName,categoryNames,description,publishedYear,
      totalCopies,availableCopies` with `;`-joined category names
- [x] `GET /api/slow?ms=` (clamped 0-30000ms) and `GET /api/flaky` (30%
      random 500) — `src/routes/chaos.ts`, mounted unauthenticated for easy
      Playwright timeout/retry practice

  New files: `src/repositories/{loans,reviews}.ts`, `src/routes/{loans,
  reviews,chaos}.ts`, `src/schemas/{loan,review}.ts`, `src/utils/csv.ts`.
  All routes registered in `src/app.ts`. No stub/placeholder logic remains
  anywhere in `apps/api` — every route in Phases 2-5 has a real handler.

## Phase 6 — Frontend scaffold (`apps/web`) ✅

- [x] Vite + vanilla TypeScript project
- [x] Minimal client-side router (or plain multi-page app — simpler is fine)
- [x] Typed `fetch` API client wrapping the backend base URL from env
- [x] Global layout: navbar + page container + toast/alert host

  Originally built ahead of the backend (Phases 1-5 weren't done yet); now
  reconciled against the real, live-verified API from Phases 3-5.
  `apps/web/src/api/client.ts` still selects between a real `HttpApiClient`
  (fetch-based) and an in-memory `MockApiClient` via `VITE_USE_MOCK_API`,
  but **the default flipped**: real API by default now, `VITE_USE_MOCK_API=
  true` opts back into the mock (offline work, or no local SQL Server
  running). Both implement the same `ApiClient` interface in
  `src/api/types.ts`.

  **Contract fixes made while reconciling against the real API** (the
  frontend was built from `docs/features.md` assumptions before the API
  existed, and several didn't match what got built):
  - `Book` used `id: string`, `author: string`, `categories: string[]`.
    The real API returns numeric `id`/`authorId`/`categoryIds[]` (books
    only reference authors/categories by id, not by embedded name) — types
    and the book-card renderer updated to match, with two new
    `ApiClient` methods (`listAuthors`/`listCategories`, backed by the
    existing `GET /api/authors` / `GET /api/categories`) used to build
    id→name lookup maps client-side.
  - `PaginatedBooks` assumed `{ items, page, limit, total, hasMore }`; the
    real `GET /api/books` returns `{ books, pagination: { page, limit,
    total, totalPages } }`. Updated the type, `HttpApiClient.listBooks`,
    `MockApiClient.listBooks` (now returns the same shape), and the books
    page's "load more" logic (`hasMore` derived from `page < totalPages`).
  - `AuthResult`/`User`/register/login error codes (`EMAIL_TAKEN`,
    `INVALID_CREDENTIALS`) needed **no changes** — verified via live curl
    against `/api/auth/{register,login}`, the shapes matched what was
    assumed exactly.
  - Updated `MockApiClient`/`mockData.ts` to the new shapes too (added
    `mockAuthors`/`mockCategories`) so the mock fallback still type-checks
    and stays usable, rather than leaving it to bit-rot now that it's no
    longer the default.
  - `.env.sample`'s stray "local Docker-based development" comment was
    stale (this repo deliberately has no Docker, see `CLAUDE.md`) — fixed
    to reference the local SQL Server instance instead.

## Phase 7 — Frontend: simple UI ✅

- [x] Login / Register pages with inline validation
- [x] Navbar with account dropdown, active-link styling
- [x] Book list page: grid, "load more" pagination
- [x] Toast notifications on success/error

  **Verified against the real, running API** (not the mock) via `tsc`,
  `biome check`, `vite build`, and live curl round-trips against
  `/api/auth/login`, `/api/books`, `/api/authors`, `/api/categories` while
  both dev servers (`api` on :3000, `web` on :5173) were running — response
  shapes confirmed to match the updated frontend types exactly (see Phase 6
  notes above for what had to change).

  **Still not click-tested in an actual browser this session** — the
  Chrome extension wasn't connected, so the UI itself (as opposed to the
  API contract it calls) is only compile/build-verified. Before fully
  trusting this UI, load `npm run dev -w apps/web` with
  `VITE_USE_MOCK_API=false` and check: register → redirected to /books
  with a welcome toast and real book cards (author/category names
  resolved via the new lookup maps, not raw ids); load more paginates the
  real 20-book seed set using `pagination.totalPages`; logout clears the
  account dropdown and redirects to /login.

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
