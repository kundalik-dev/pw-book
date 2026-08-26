# Features

pw-books is a small library-management app whose only real purpose is to be a
target for Playwright practice. Every feature below is chosen because it
exercises a specific testing pattern, not because a library app needs it.
When in doubt about whether to add a feature, ask: "does this give me a new
kind of thing to automate?" — if not, skip it.

## Domain model

- **User** — id, name, email, passwordHash, role (`member` | `admin`), createdAt
- **Author** — id, name, bio
- **Category** — id, name (Fiction, Non-fiction, Sci-Fi, ...)
- **Book** — id, title, isbn, authorId, categoryIds[], description, publishedYear,
  coverImageUrl, totalCopies, availableCopies, createdAt
- **Loan** — id, bookId, userId, borrowedAt, dueAt, returnedAt, returnedToAdminId,
  status (`active` | `returned` | `overdue`)
- **Review** — id, bookId, userId, rating (1-5), comment, createdAt
- **Wishlist item** — userId, bookId, addedAt

## Backend APIs (`apps/api`)

Grouped by the Playwright/API-testing pattern each one is meant to drill.

### Auth
- `POST /api/auth/register` — validation errors (400), duplicate email (409)
- `POST /api/auth/login` — returns JWT access token + refresh token
- `POST /api/auth/refresh` — refresh token rotation
- `POST /api/auth/logout`
- `GET /api/auth/me` — protected route, tests 401 handling
- **Practice:** bearer-token auth flows, protected-route fixtures, storageState reuse across tests

### Books (core CRUD)
- `GET /api/books` — pagination (`page`, `limit`), sorting (`sort=title|-publishedYear`),
  filtering (`category`, `author`, `year`, `available=true`), full-text `q` search
- `GET /api/books/:id`
- `POST /api/books` (admin only, multipart/form-data with cover image via Multer)
- `PUT /api/books/:id`
- `PATCH /api/books/:id/availability`
- `DELETE /api/books/:id`
- `POST /api/books/bulk-import` — CSV upload, partial-failure response shape
- `GET /api/books/export` — CSV download (tests file-download handling)
- **Practice:** query-param combinations, request/response schema assertions, multipart upload, file download

### Authors & Categories
- Standard CRUD on both (`/api/authors`, `/api/categories`)
- **Practice:** simple, fast CRUD to build baseline API test suites and fixtures/teardown patterns

### Loans (borrow/return workflow)
- `POST /api/loans` — borrow a book (fails with 409 if no copies available);
  accepts an optional `dueAt` so a caller can pin a specific return date
  (the Orders page's date picker), validated server-side to fall between
  today and 10 days from today — omit it and the API falls back to the
  default 14-day estimate the borrow wizard uses
- `PUT /api/loans/:id/return` — return a book; requires `receivedByAdminId`
  (the admin the book was physically handed back to — validated against
  `dbo.Users` and rejected with 400 `ADMIN_NOT_FOUND` if it isn't an actual
  admin), and re-increments the book's `AvailableCopies` on success
- `GET /api/loans/me` — current user's loan history
- `GET /api/loans/overdue` — admin report
- `GET /api/loans` — admin-only, every order across every customer, optionally
  narrowed with `?userId=`/`?bookId=` (powers the admin Orders page and its
  per-user/per-book history pages); an admin may also `PUT /loans/:id/return`
  a loan they don't own, so the admin UI can process any customer's return
- `GET /api/users/admins` — list admin users (any authenticated caller;
  powers the Orders page's return-handover dropdown)
- `GET /api/users` — admin-only, every user (id/name/email/role); powers the
  admin Orders page's customer name lookups
- **Practice:** stateful workflows, sequential API calls that must run in
  order, business-rule error codes, server-side date-range validation,
  cross-entity reference validation (the handover admin id), role-gated
  query-filtered listings

### Reviews
- `GET /api/books/:id/reviews`
- `POST /api/books/:id/reviews` — one review per user per book (409 on duplicate)
- `DELETE /api/reviews/:id`
- **Practice:** nested resources, ownership/authorization checks (can't delete someone else's review)

### Infra / chaos endpoints
- `GET /api/health` — liveness
- `GET /api/health/db` — checks live SQL Server connection (DB-connection practice)
- `GET /api/slow` — configurable artificial delay via `?ms=`, for timeout/loading-state tests
- `GET /api/flaky` — randomly returns 500 ~30% of the time, for retry/resilience tests
- **Practice:** timeout config, retry logic, network-condition simulation, `waitForResponse`

### System / admin
- `POST /api/system/reset` — admin-only; wipes all DB data, resets identity
  seeds, re-inserts the same dataset `db:seed` loads, and clears uploaded
  cover images — brings the whole app back to a fresh-seed baseline between
  test runs
- **Practice:** destructive-action confirmation flows, test-suite/global-setup
  reset hooks that call this before a run

## Frontend UI (`apps/web`)

Ordered simple → complex; each maps to Playwright locator/interaction practice.

### Simple
- Login / Register forms — text/password inputs, inline validation messages
- Navbar with active-link state and a dropdown (account menu)
- Book grid/list with a "load more" button (pagination)
- Alerts/banners — success/error toasts on form submit

### Intermediate
- Search bar with debounced input and a results dropdown (autocomplete)
- Filter sidebar — checkboxes (category), radio buttons (availability), a range
  slider (published year), multi-select dropdown (tags)
- Sort dropdown (native `<select>`)
- Breadcrumbs
- Tooltips on icon buttons
- Accordion (book detail sections: description / details / reviews)
- Skeleton loaders while data is fetching

### Complex
- Book detail page with tabs (Details / Reviews) and an image carousel for
  the cover gallery
- Star-rating widget (custom, non-native control) for submitting reviews
- Data table for admin book management — sortable columns, row checkboxes,
  bulk-delete action bar that appears on selection
- Modal dialogs — confirm-delete modal, "add to wishlist" modal
- Multi-step wizard — the borrow/checkout flow (select book → confirm →
  due-date review → success)
- Orders page (`/orders`) — place an order for a book with a user-picked
  return date (native `<input type="date">`, `min`/`max` clamped to a
  10-day window from today), plus a sortable/filterable history table of
  every past and current order (sort by book or order date, filter by book
  title and an order-date range) with a per-row Return action that opens a
  confirm modal — pre-filled with today's return date, an admin-handover
  dropdown (admin users only) that's required before confirming — which
  marks the loan returned and frees up the book's availability
- Admin Orders (`/admin/orders`, admin-only) — every customer's orders in one
  sortable/filterable table (filter by book title, customer, status), each
  row showing who ordered what, ordered/return-by/returned-on dates, which
  admin it was returned to, and a Return action (an admin can return any
  customer's loan). Book and Customer names link to two drill-down pages:
  `/admin/orders/book/:id/history` (everyone who's ordered that book, their
  return status/date) and `/admin/orders/user/:id/history` (one customer's
  full order history) — both admin-only, reusing the same return flow.
- Drag-and-drop — reorder items in the wishlist
- Theme toggle (light/dark), persisted via `localStorage`
- An `<iframe>` — embedded "library location" map/preview panel
- A native Web Component using Shadow DOM — e.g. the star-rating widget
  re-implemented as `<star-rating>`, to force practice piercing shadow roots
- One deliberate native `confirm()` dialog (e.g. "delete account") — kept
  isolated on one page so dialog-handling can be practiced without breaking
  other tests
- Admin-only Settings page (`/settings`) with a "danger zone" reset-app
  button — a custom modal (not the native `confirm()`) requiring the user to
  type `DELETE` before the confirm button enables, for type-to-confirm
  destructive-action practice

## Out of scope

No payment flows, no email sending, no real image storage (local disk is
fine), no production auth hardening (rate limiting on `/api/flaky` and
`/api/slow` aside — those are intentional). This app optimizes for testing
surface, not for being a real product.
