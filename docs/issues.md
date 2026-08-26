# Known issues / pending work

Open items only — for the full phase-by-phase build history (what was
built, verified, and fixed along the way) see
[`docs/tasks/01-mvp-build-plan.md`](tasks/01-mvp-build-plan.md). When an
item below is resolved, delete it from this file rather than marking it
done in place — the build plan is the historical record, this file is a
live list.

## 1. Real browser click-testing has never been done

Every page in `apps/web` (Phases 6-9) has been verified only via `tsc`,
`biome check`, `vite build`, and curl against the live API — never by
actually clicking through it in a browser, across every session that
built or reviewed this app, because a Chrome extension connection was
never available.

A Phase 11 static read-through of every page/component (substituting for
the browser pass) did catch and fix four real bugs this way — most
notably `HttpApiClient.request()` crashing on the `204 No Content`
responses from `DELETE /api/books/:id` / `DELETE /api/reviews/:id`,
which would have broken admin book deletion — see the Phase 11 section of
the build plan for the full list. But a static read can only catch what's
visible in the source; it can't catch actual rendering/layout problems,
CSS issues, or interaction sequences that only show up at runtime.

**Next step:** once a Chrome extension connection is available, click
through: register/login, book grid + load more, search + every filter +
sort + clear filters, book detail (carousel, tabs, star-rated review
submit), the borrow wizard all 4 steps, wishlist add/drag-reorder/remove,
admin table sort/select/bulk-delete, the `/settings` reset-app flow,
theme toggle persistence, and delete-account's `confirm()` dialog.

## 2. Frontend never calls `POST /api/auth/logout` or `POST /api/auth/refresh`

`apps/web`'s `ApiClient` interface (`api/types.ts`) has no `logout()` or
`refresh()` method. The navbar's "Log out" button
(`components/navbar.ts`) only calls `clearAuthState()`, which removes the
tokens from `localStorage` client-side — it never hits
`POST /api/auth/logout`, so the refresh token issued at login is never
revoked server-side (it just sits in `dbo.RefreshTokens` until it expires
or a token-reuse-detection event revokes it some other way). Likewise
nothing calls `POST /api/auth/refresh`: once the short-lived access token
expires, the user has to log in again rather than the frontend silently
refreshing.

Both backend endpoints exist and were curl-verified in Phase 3
(rotation + reuse-detection all work). This is a frontend gap, not a
backend one.

**Impact:** minor for this app's actual purpose (a Playwright practice
target) — the refresh-rotation flow is still fully exercisable by
hitting the API directly. But it means there's currently no UI-driven way
to practice testing token refresh or logout-side revocation end to end.

**Next step:** either wire `logout`/`refresh` into `ApiClient` and call
them from the UI, or explicitly document this as an intentional
API-only-practice surface in `docs/features.md` if it's staying this way.

## 3. No UI to delete a review

`DELETE /api/reviews/:id` exists, works, and enforces the
owner-or-admin-only check `docs/features.md` calls out as the Reviews
endpoint's specific practice value ("ownership/authorization checks")
— but no page renders a delete button for a review, even one the current
user owns (`pages/bookDetail.ts`'s `renderReviewItem` has no delete
action). The endpoint is reachable only via a direct API call, not
through any UI element.

**Next step:** add a delete button to a user's own review in the Reviews
tab of the book detail page (`pages/bookDetail.ts`), gated on
`review.userId === current user's id`, calling the already-implemented
`ApiClient.deleteReview`.
