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

## Phase 8 — Frontend: intermediate UI ✅ (except accordion, see below)

- [x] Debounced search bar with autocomplete dropdown — `apps/web/src/pages/books.ts`,
      300ms debounce, dropdown of up to 5 title/author matches, click-to-fill,
      Enter submits immediately, Escape/outside-click closes it
- [x] Filter sidebar: checkboxes (category, multi), radio buttons
      (availability: all/available/unavailable), year range slider (two
      `<input type="range">`, min/max clamp against each other),
      multi-select dropdown (authors, native `<select multiple>`) — all in
      the new `.filters-sidebar`, each control triggers an immediate
      reset-and-reload; a "Clear filters" button resets everything
- [x] Sort dropdown — native `<select>`: title A–Z/Z–A, year newest/oldest
- [x] Breadcrumbs, tooltips — breadcrumb nav (Home / Books) above the
      heading; each book card has an "ⓘ" icon button with a CSS-only
      tooltip showing the ISBN (a real DOM element that becomes visible on
      hover/focus, not a native `title` attribute, so it's meaningfully
      Playwright-testable)
- [ ] Accordion on book detail sections — **intentionally deferred to
      Phase 9.** Coordinated with the session building the book detail
      page (tabs + carousel): rather than build a throwaway accordion-only
      detail page here and have Phase 9 replace it, Phase 9 owns the
      detail page's section structure outright (tabs superseding/including
      any accordion). No `/books/:id` page or router change was added by
      this phase.
- [x] Skeleton loaders during fetch — pre-existing from Phase 6/7, kept and
      reused for filter/search/sort-triggered reloads too, not just the
      initial load and "load more"

**Backend extension (additive, needed for the filter sidebar):** the
`GET /api/books` filters from Phase 4 (`category`, `author`, `year`,
`available`, `q`) only supported single-value `category`/`author` and an
exact-match `year`. Extended additively rather than overloaded:
`category`/`author` now also accept repeated query params
(`?category=1&category=2`) and are matched via `IN (...)`, coerced to an
array by a shared Zod preprocessor (`idListSchema` in
`src/schemas/book.ts`); a single value still works unchanged (backward
compatible). Added `yearMin`/`yearMax` (inclusive range) alongside the
existing exact `year`, rather than replacing it. See
`src/repositories/books.ts` (`bindIdList`/`idPlaceholders`,
`buildWhereClause`) — verified directly via curl: multi-category,
multi-author, year-range, `available` + `sort` combos, and combining all
of the above at once all return correctly filtered/sorted/counted
results. `apps/web/src/api/{types.ts,httpClient.ts,mock/mockClient.ts}`
updated to match (`ListBooksParams` gained `sort`, `category: number[]`,
`author: number[]`, `yearMin`, `yearMax`, `available`; the mock client's
`listBooks` mirrors the same filter/sort semantics so `VITE_USE_MOCK_API=true`
still works for this UI).

  **Not yet click-tested in a real browser** — no Chrome extension
  connection was available this session (same limitation as Phase 6/7).
  Verified via: clean `tsc -b --force` (web) and `tsc` (api) with zero
  errors, `biome check` clean, and curl against the live API for every
  new filter/sort/search combination. Click through
  `npm run dev -w apps/web` — search, each filter control, sort, clear
  filters, tooltips — before fully relying on this UI.

## Phase 9 — Frontend: complex UI ✅

- [x] Book detail page: tabs + cover image carousel — `apps/web/src/pages/bookDetail.ts`
      at `/books/:id` (new dynamic-route support added to `router/router.ts`,
      `:param` segments). Tabs (Details / Reviews) via new
      `components/tabs.ts`; cover carousel via new `components/carousel.ts`
      — since `Book` only has one `coverImageUrl` and no gallery data model,
      the carousel shows the real cover (if any) plus two clearly-labelled
      placeholder slides so it's always exercisable with >1 slide. Includes
      a breadcrumb (Books / title) reusing Phase 8's `.breadcrumbs` styles,
      folding in the accordion checkbox Phase 8 deferred here (tabs
      supersede it, per the cross-session coordination note above).
- [x] Star-rating widget (plain) + a Shadow DOM `<star-rating>` custom
      element variant — `components/starRating.ts` (interactive, used in
      the review form and read-only in review display) and
      `components/starRatingElement.ts` (`customElements.define('star-rating', ...)`,
      registered in `main.ts`, read-only, genuinely inside a shadow root so
      Playwright locators must pierce it).
- [x] Admin data table: sortable columns, row selection, bulk-delete bar —
      `pages/admin.ts` at `/admin` (admin-role-gated, redirects otherwise).
      Sortable Title/Published/Added columns via `apiClient.listBooks({ sort })`;
      row + select-all checkboxes; bulk-delete bar appears on selection,
      confirms via the new modal, calls `apiClient.deleteBook` per row.
- [x] Modals: confirm-delete, add-to-wishlist — new `components/modal.ts`
      (generic `openModal` + `openConfirmModal` helper), used by both the
      admin table's delete flow and the book detail page's "Add to
      wishlist" button.
- [x] Multi-step borrow/checkout wizard — `pages/borrow.ts` at
      `/borrow/:bookId`: select (book summary) → confirm (agree checkbox)
      → due-date review (client-estimated, `LOAN_PERIOD_DAYS = 14` mirrored
      from the API's `repositories/loans.ts` constant) → success (real
      server-returned loan id/due date after `apiClient.createLoan`).
- [x] Drag-and-drop wishlist reordering — `pages/wishlist.ts` at
      `/wishlist`, native HTML5 drag-and-drop. Wishlist itself is
      client-only (`state/wishlist.ts`, `localStorage`) — `docs/features.md`
      lists a `WishlistItem` domain model and `WishlistItems` migration
      table exists, but no backend endpoints for it were ever in scope
      (not listed under "Backend APIs" in `docs/features.md`, and Phases
      4/5 never added any) — treated that as intentional rather than a gap
      to fill in this phase.
- [x] Light/dark theme toggle persisted to `localStorage` — `state/theme.ts`
      + a toggle button in the navbar; dark-mode variable overrides live in
      `styles/phase9.css` under `:root[data-theme="dark"]`.
- [x] `<iframe>` panel (library location placeholder) — on the book detail
      page, embedding a static local `apps/web/public/library-location.html`
      (kept local/offline rather than a real map, matching this app's
      no-external-network-dependency practice-target ethos).
- [x] One isolated page with a native `confirm()` dialog (delete account) —
      `pages/deleteAccount.ts` at `/account/delete`, reachable from the
      navbar account dropdown. No `DELETE /api/users/:id` endpoint exists
      (out of scope per `docs/features.md`), so confirming only clears the
      local session — it doesn't touch the backend.

  **Cross-session coordination:** this phase ran concurrently with another
  session's Phase 8 work in the same working tree. New standalone files
  (pages, components, `state/theme.ts`, `state/wishlist.ts`) were built
  first to avoid touching shared files. `router.ts`/`main.ts`/`navbar.ts`
  were reserved for this phase from the start (Phase 8 deliberately left
  them alone). Once Phase 8 finished and released `api/{types,client,
  httpClient}.ts` and `api/mock/{mockClient,mockData}.ts`, `getBook`/
  `deleteBook`/`listBookReviews`/`createReview`/`deleteReview`/`createLoan`/
  `listMyLoans` were folded into the shared `ApiClient` interface (real +
  mock implementations) instead of staying in a temporary standalone
  module — along with adding `createdAt` to the `Book` type (the API
  already returned it; the frontend type just hadn't caught up) and
  extending `BooksSort` with `createdAt`/`-createdAt` (already
  backend-whitelisted per Phase 4, just not yet exposed on the frontend
  type). Also wired the book-grid card title to link to `/books/:id`
  (Phase 8 built the grid before this route existed, and left that hookup
  for this phase).

  **Verified:** clean `tsc --noEmit`, clean `biome check`, clean
  `vite build`. Live-curl-verified against the running API (not just the
  mock): `GET /api/books/:id`, `GET /api/books/:id/reviews`, sorted
  `GET /api/books?sort=...` (including `-publishedYear`), `POST /api/loans`
  → `PUT /api/loans/:id/return`, and `POST /api/books/:id/reviews` →
  `DELETE /api/reviews/:id` — all response shapes match the frontend types
  exactly; test loan/review data created during verification was cleaned
  up (loan returned, review deleted) afterward.

  **Not yet click-tested in an actual browser** — no Chrome extension
  connection was available this session (same limitation as Phases 6-8).
  Before fully relying on this UI, load `npm run dev -w apps/web` and
  check: book card → detail page (carousel arrows/dots, tab switching,
  submitting a star-rated review) → borrow wizard all 4 steps → wishlist
  add/drag-reorder/remove → admin table sort/select/bulk-delete (as an
  admin user) → theme toggle persists across reload → delete-account's
  `confirm()` dialog.

  **Still true as of Phase 11** — the Chrome extension was unavailable in
  that session too. As the best available substitute, did a full manual
  read-through of every page/component file across Phases 6-9 (not grep
  excerpts — full files, cross-checked against how each caller actually
  invokes them) hunting specifically for the class of bug curl/tsc/biome
  can't catch. Found and fixed four real ones:
  - **`apps/web/src/api/httpClient.ts`** — `HttpApiClient.request()`
    always called `response.json()` on a successful response, but
    `DELETE /api/books/:id` and `DELETE /api/reviews/:id` both return
    `204 No Content` with an empty body (confirmed live: `curl -X DELETE`
    → `status=204 size=0`). Parsing an empty body as JSON throws, so
    clicking "Delete" in the admin table would have thrown inside the
    `try` in `admin.ts`'s `confirmDelete`, surfaced as a misleading
    "Could not delete one or more books" toast — even though the delete
    had actually succeeded server-side. This is exactly the kind of bug
    curl-testing the raw API (which doesn't care about parsing) can't
    catch. Fixed by short-circuiting on `response.status === 204` before
    the `.json()` call.
  - **`apps/web/src/components/navbar.ts`** — `mountNavbar`'s `render()`
    (re-run on every route change and every auth-state change) added a
    *new* `document.addEventListener('click', ...)` each time to close
    the account dropdown, never removing the old ones — an unbounded
    listener leak over the life of a session. Fixed by attaching that
    listener once, outside `render()`, querying the live DOM for the
    current dropdown/toggle at click time instead of closing over
    per-render elements.
  - **`apps/web/src/pages/books.ts`** — `fetchSuggestions` (the search
    autocomplete) had no request-sequencing guard, unlike the main list
    load right next to it, so a slower earlier suggestions request could
    resolve after a faster later one and clobber the dropdown with stale
    results. Fixed with the same `seq`-counter pattern already used for
    `loadPage`.
  - **`apps/web/src/pages/admin.ts`** — bulk-deleting exactly one book
    produced the modal message `Delete ""? This can't be undone.` (the
    bulk caller passes an empty `label`, but the message logic branched
    on `ids.length === 1` alone). Fixed to require a non-empty label for
    the quoted-title phrasing, falling back to `Delete 1 book?` /
    `Delete N books?` otherwise.

  Re-ran `npm run lint` and `npm run build` after each fix — both stay
  clean. **Note:** while this review was in progress, a concurrent session
  in this same working tree landed a new `/settings` admin page
  (`pages/settings.ts`, wired into `main.ts` and `navbar.ts`) for
  resetting the app to its seed state via the already-existing
  `POST /api/system/reset` endpoint — unrelated to this review, mentioned
  here only per this repo's cross-session-visibility convention (see the
  Phase 8/9 coordination notes above). It landed cleanly on top of the
  `navbar.ts` fix above with no conflict.

  Real click-testing in a browser is still the one thing this couldn't
  substitute for — do that pass whenever the Chrome extension is
  available before fully trusting the UI.

## Phase 10 — Seed data & fixtures polish ✅

- [x] Re-check seed data covers: an unavailable book (0 copies), a book with
      no reviews, a book with many reviews, an overdue loan, a user with an
      active loan — so UI/API edge cases are reachable without manual setup

  Re-verified live against the running local SQL Server instance (not just
  reading `apps/db/scripts/seed.js`) via ad-hoc queries, then discarded the
  scratch script — no new migration/seed changes were needed, the Phase 1
  seed already covers every case:
  - **0-copy books:** 3 of 20 (`Sense and Sensibility`, `The Bluest Eye`,
    `1Q84`).
  - **Zero-review books:** 18 of 20 have no review rows.
  - **Many-reviews book:** `Pride and Prejudice` has 3 — the maximum
    possible under the current `Reviews` uniqueness constraint
    (one review per user per book) with only 3 seeded users, so this is
    already at ceiling; not a gap.
  - **Overdue loan:** loan id 2, `alex@pwbooks.test` / `Foundation`, still
    `active`-shaped but past `DueAt` (borrowed 30 days ago, due 16 days
    ago) — confirmed genuinely overdue relative to today's date.
  - **Active loan:** loan id 1, `member@pwbooks.test` / `Pride and
    Prejudice`.

  **Resolved (checked during Phase 11):** the live `Loans` table has extra
  `returned` rows beyond the 3 from `seed.js` (ids 4-6 as of Phase 11,
  `Emma` x2 and `Animal Farm`, all same-day borrow→return pairs). Confirmed
  via a direct query these are exactly what earlier phases' notes already
  said they'd be: leftover history from live curl verification of the
  borrow/return endpoints (Phase 9's `POST /api/loans` →
  `PUT /api/loans/:id/return` round-trip, plus Phase 11's own). Returning a
  loan updates its status rather than deleting the row — that's correct
  library-domain behavior, not a script bug or pollution — so this needed
  no fix, just confirmation it isn't a regression. No other "Issues found"
  section exists elsewhere in this doc; the earlier cross-reference was
  stale.

## Phase 11 — Wiring it all together ✅

- [x] `turbo.json` `dev` pipeline: `api` and `web` run in parallel; `api`'s
      `dev` task depends on `db#verify` so `npm run dev` fails fast with a
      clear message if the local SQL Server service isn't running, instead
      of the API silently retrying forever
- [x] Confirm `npm run dev` at root brings up API + web with one command
      (DB itself is just the always-on local Windows service — nothing to
      start for it)
- [x] API retries its DB connection pool on transient failures (from
      Phase 2) so brief hiccups don't crash the process
- [x] `npm run lint` / `npm run format` at root run Biome across every
      workspace
- [x] `npm run build` builds `apps/api` and `apps/web` via Turbo

  Added a package-scoped task override to `turbo.json`:
  `"@pw-books/api#dev": { "dependsOn": ["@pw-books/db#verify"], "cache":
  false, "persistent": true }` (plus a bare `"verify": { "cache": false }`
  task definition so `db#verify` is recognized at all) — `apps/db`'s
  existing `verify` script (`scripts/verify-connection.js`, from Phase 1)
  needed no changes, it already exits non-zero with a clear message on
  connection failure. `web`'s `dev` task has no such dependency and starts
  immediately in parallel, as intended.

  **Verified:** `npx turbo run dev --dry-run=json` confirms the resolved
  graph — `@pw-books/api#dev` now lists `@pw-books/db#verify` as a
  dependency, `@pw-books/web#dev` has none, both are `persistent`. Ran
  `npm run dev` for real: `db#verify` connected to the live local SQL
  Server instance and printed its confirmation line, then `api#dev` and
  `web#dev` started together (`web` fell back to a free port since 5173
  was already bound by another already-running dev instance in this
  environment — expected port-picking behavior, not a wiring bug; killed
  this verification run's process tree afterward, leaving the
  pre-existing dev servers on :3000/:5173 untouched and still healthy per
  `curl`). `npm run lint`, `npm run format:check`, and `npm run build`
  (root) all pass clean with zero errors across `api`/`web` (`db` has no
  build/lint-specific step beyond the shared root Biome check, which
  covers it too).

## Phase 12 — Docs pass ✅

- [x] Update `README.md` if any setup step changed from what's documented
- [x] Update `CLAUDE.md` if conventions or structure shifted during the build
- [x] Update `docs/features.md` if scope changed
- [x] Update `docs/database-setup.md` if local SQL Server setup steps changed
- [x] Create `docs/issues.md` — a live list of known gaps/pending work,
      separate from this file's phase-by-phase build history — and
      reference it from `CLAUDE.md`

  **`README.md`:** the "Status" section was still describing the
  pre-Phase-1 state (`apps/api`/`apps/db` "don't exist yet") — rewrote it
  to reflect the completed build and point at this file + `docs/issues.md`
  instead of duplicating detail. Added `docs/issues.md` and
  `docs/database-setup.md` to the project-structure tree (both existed
  already but weren't listed).

  **`CLAUDE.md`:** the "Current status" section had grown into a very long
  phase-by-phase changelog (accurate, but now fully redundant with this
  file, which is the actual source of truth for build history). Replaced
  it with a short current-state summary plus pointers to this file and the
  new `docs/issues.md`; updated the "Architecture" section's stale "Phase
  11, not done yet" line now that it's done; dropped the "(once
  scaffolded)" qualifier from the Commands section; added a
  `docs/issues.md` pointer to both the intro and "Working in this repo"
  sections.

  **`docs/features.md`:** already current — a concurrent session had
  already added the `/settings` reset-app page and
  `POST /api/system/reset` to it while Phase 11 was running (see that
  phase's note above). No changes needed.

  **`docs/database-setup.md`:** step 6 referenced "once `apps/db` exists
  (Phase 1 of the build plan)", stale now that the whole build is done —
  reworded to state the verify/migrate/seed steps directly.

  **`docs/issues.md`** (new): three open items, each with concrete
  next-step guidance — (1) real browser click-testing has never been done
  in any session (no Chrome extension connection was ever available; see
  the Phase 6-11 notes above for what static review substituted for it),
  (2) the frontend never calls `POST /api/auth/logout` or
  `POST /api/auth/refresh` even though both are fully built and
  curl-verified on the backend (Phase 3) — logout only clears local
  storage, and access-token expiry requires a fresh login rather than a
  silent refresh, (3) `DELETE /api/reviews/:id` has no UI entry point —
  it works and enforces the ownership check `docs/features.md` calls out
  as its specific practice value, but nothing renders a delete button for
  a user's own review. None of these are regressions — they're gaps that
  were never in scope for the phase that would have closed them, surfaced
  now during this docs pass. Convention going forward: delete an item from
  `docs/issues.md` when it's resolved rather than checking it off in
  place — this file (the build plan) stays the historical record,
  `issues.md` stays a live list.

## Explicitly deferred (not part of this MVP)

- A `tests/` Playwright workspace inside this repo — the whole point of
  pw-books is to be automated _from outside_; add a Playwright project
  later, once the app is stable, if you want it living alongside the app.
- CI pipeline — not needed for a local practice target.
- Any real email/payment/production-auth hardening.
- Docker for SQL Server — deliberately not used. A SQL Server instance is
  already installed locally, so `apps/db` only holds scripts/SQL, not a
  container definition.
