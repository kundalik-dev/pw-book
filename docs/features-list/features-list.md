# Features list

Purpose: catalog what Playwright-automatable UI/API surface actually exists
in this app right now vs. what's still missing, so practice sessions know
what's really there before writing a locator for it. Verified against
`apps/web/src` and `apps/api/src` source, cross-checked with
`docs/features.md` and `docs/issues.md`.

## Features available

### Forms & inputs

- Login form (email, password, inline validation)
- Register form (name, email, password, inline validation)
- Text inputs, password inputs, native `<select>` dropdowns
- Checkboxes (category filter), radio buttons (availability filter)
- Range slider (published-year filter)
- Multi-select dropdown (tag filter)
- Native `<input type="date">` (Orders return-date picker, `min`/`max`
  clamped to a 10-day window)
- Admin add/edit-book form (`bookForm.ts`)
- Labeled fields throughout via `formField.ts` (`<label for>` + `data-testid`)

### Buttons & actions

- Standard `<button>`/`<a>` elements everywhere (no clickable `<div>`s)
- Icon-only buttons with `aria-label` + tooltips
- "Load more" pagination button (book grid)
- Bulk-delete action bar (appears on admin table row selection)

### Tables

- Admin book management data table — sortable columns, row checkboxes,
  bulk-delete, pagination
- Orders history table (`/orders`) — sortable, filterable, paginated
- Admin Orders table (`/admin/orders`) — sortable, filterable, paginated,
  role-gated
- Drill-down history tables: `/admin/orders/book/:id/history`,
  `/admin/orders/user/:id/history`

### Alerts / popups / dialogs

- Toast alerts/banners on form submit (success/error)
- Modal dialogs — confirm-delete, "add to wishlist", return-loan modal
  (pre-filled date + admin-handover dropdown)
- Type-to-confirm destructive modal on `/settings` (must type `DELETE`
  before the button enables)
- One deliberate native `confirm()` dialog, isolated on `/account/delete`

### Sorting & pagination

- Book grid sort (native `<select>`) + filter + search
- Sortable/paginated admin table
- Sortable/filterable/paginated Orders and Admin Orders tables

### Auth

- Login and register flows
- JWT access token + refresh token issued on login
- `GET /api/auth/me` protected route (401 handling)
- Bearer-token auth usable directly against the API for storageState-style
  fixture practice

### File download

- `GET /api/books/export` — public CSV download
- `GET /api/loans/me/export` / `GET /api/loans/export` — authenticated CSV
  download via `fetch` + `Authorization` header ("Export to Excel" buttons
  on Orders / Admin Orders pages)

### Dynamic / complex elements

- Skeleton loaders while the book grid fetches (`books.ts` renderSkeletons)
- Book detail tabs (Details / Reviews) + image carousel for cover gallery
- Custom star-rating widget (non-native control) for submitting reviews
- A second star-rating implementation as a Web Component using Shadow DOM
  (`<star-rating>`, `starRatingElement.ts`) — shadow-root piercing practice
- Multi-step borrow wizard (select book → confirm → due-date review → success)
- Drag-and-drop reordering in the wishlist (`localStorage`-backed)
- Theme toggle (light/dark), persisted via `localStorage`
- Breadcrumbs, accordion sections, navbar dropdown (account menu)
- Chaos endpoints for network-condition testing: `GET /api/slow?ms=`
  (configurable delay), `GET /api/flaky` (~30% random 500s)
- Admin-only `POST /api/system/reset` — destructive reset-to-baseline,
  wired to the type-to-confirm modal above

## Features needed for Playwright practice and not available

- **File upload** — no `<input type="file">` anywhere in `apps/web`.
  The backend supports it (`POST /api/books` accepts multipart/form-data
  cover images via Multer; `POST /api/books/bulk-import` accepts CSV) but
  no UI element exposes either, so file-upload interaction can only be
  practiced by calling the API directly, not through a form.
- **Logout/refresh wired to the UI** — `POST /api/auth/logout` and
  `POST /api/auth/refresh` exist and work server-side, but `apps/web`'s
  `ApiClient` never calls them; logout only clears `localStorage`
  client-side. No UI-driven way to practice token-refresh or
  logout-revocation flows end to end (see `docs/issues.md` #2).
- **Delete-review UI** — `DELETE /api/reviews/:id` works and enforces
  ownership, but no page renders a delete button for a review, even one
  the current user owns (see `docs/issues.md` #3).
- **Real browser click-testing** — every page above has only been
  verified via `tsc`/`biome`/`vite build`/curl, never actually clicked
  through in a live browser (see `docs/issues.md` #1). Treat interaction
  behavior as unconfirmed until manually tested.

## Features to present to practice playwright

- file upload and table render => submit or cancel based on data
-
