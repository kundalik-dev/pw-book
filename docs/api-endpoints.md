# API endpoints

Every route registered in `apps/api` (mounted under the `/api` prefix,
see `apps/api/src/app.ts`), grouped by who can call it. This is a
reference list, not a spec — for request/response shapes see the
[Swagger docs](../api-swagger/README.md) (`api-swagger/`, currently
covering the Auth module; more endpoints are documented there over
time) or the route/schema files under `apps/api/src/routes` and
`apps/api/src/schemas`.

Auth is a bearer JWT (`Authorization: Bearer <accessToken>`), verified
by `requireAuth`; role is enforced on top of that by
`requireRole('admin')` — see `apps/api/src/middleware/auth.ts`.

## Public (no login required)

| Method | Endpoint                 | Name                             |
| ------ | ------------------------ | -------------------------------- |
| GET    | `/api/health`            | Health check                     |
| GET    | `/api/health/db`         | Database connection health check |
| POST   | `/api/auth/register`     | Register a new user              |
| POST   | `/api/auth/login`        | Log in                           |
| POST   | `/api/auth/refresh`      | Refresh access token             |
| POST   | `/api/auth/logout`       | Log out                          |
| GET    | `/api/books`             | List/search/filter/sort books    |
| GET    | `/api/books/export`      | Export all books as CSV          |
| GET    | `/api/books/:id`         | Get book details                 |
| GET    | `/api/books/:id/reviews` | List reviews for a book          |
| GET    | `/api/authors`           | List authors                     |
| GET    | `/api/authors/:id`       | Get author details               |
| GET    | `/api/categories`        | List categories                  |
| GET    | `/api/categories/:id`    | Get category details             |
| GET    | `/api/slow`              | Chaos: delayed response          |
| GET    | `/api/flaky`             | Chaos: randomly-failing response |
| GET    | `/api/docs`              | Swagger UI                       |
| GET    | `/api/docs-src/*`        | Raw OpenAPI YAML source          |

## Member (any logged-in user)

| Method | Endpoint                 | Name                                                 |
| ------ | ------------------------ | ---------------------------------------------------- |
| GET    | `/api/auth/me`           | Get current user                                     |
| GET    | `/api/users/admins`      | List admins (for the "return to" picker)             |
| POST   | `/api/books/:id/reviews` | Add a review                                         |
| DELETE | `/api/reviews/:id`       | Delete a review _(own review; admin may delete any)_ |
| POST   | `/api/loans`             | Borrow a book                                        |
| GET    | `/api/loans/me`          | List my loans                                        |
| GET    | `/api/loans/me/export`   | Export my loans as CSV                               |
| PUT    | `/api/loans/:id/return`  | Return a loan _(own loan; admin may return any)_     |

## Admin only

| Method | Endpoint                      | Name                                              |
| ------ | ----------------------------- | ------------------------------------------------- |
| GET    | `/api/users`                  | List all users                                    |
| POST   | `/api/authors`                | Create author                                     |
| PUT    | `/api/authors/:id`            | Update author                                     |
| DELETE | `/api/authors/:id`            | Delete author                                     |
| POST   | `/api/categories`             | Create category                                   |
| PUT    | `/api/categories/:id`         | Update category                                   |
| DELETE | `/api/categories/:id`         | Delete category                                   |
| POST   | `/api/books`                  | Create book (with optional cover image upload)    |
| PUT    | `/api/books/:id`              | Update book (with optional cover image upload)    |
| PATCH  | `/api/books/:id/availability` | Adjust available copies                           |
| DELETE | `/api/books/:id`              | Delete book                                       |
| POST   | `/api/books/bulk-import`      | Bulk-import books from CSV                        |
| GET    | `/api/loans`                  | List all loans (optionally filtered by user/book) |
| GET    | `/api/loans/overdue`          | List overdue loans                                |
| GET    | `/api/loans/export`           | Export all loans as CSV                           |
| POST   | `/api/system/reset`           | Reset the database to seed state                  |
