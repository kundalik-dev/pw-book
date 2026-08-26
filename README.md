# pw-books

A small library-management app built as a hands-on target for **Playwright
practice** — API testing, UI testing (simple → complex elements), and
database-connection testing. It is not meant to be a production app; see
[`docs/features.md`](docs/features.md) for why each feature exists.

## Tech stack

- **Backend** — Express + TypeScript, SQL Server via `mssql`, JWT auth
- **Frontend** — Vite + vanilla TypeScript (no framework), HTML/CSS
- **Database** — SQL Server (local instance already installed on the
  machine — no Docker)
- **Tooling** — Turborepo (task orchestration), Biome (lint + format),
  npm workspaces

## Project structure

```
pw-books/
├── apps/
│   ├── api/     # Express + TypeScript backend
│   ├── web/     # Vite + vanilla TS frontend
│   └── db/      # SQL migrations/seed data + scripts (targets local SQL Server)
├── docs/
│   ├── features.md          # what exists and why (API + UI catalogue)
│   ├── issues.md            # known gaps / pending work
│   ├── database-setup.md    # one-time local SQL Server setup
│   └── tasks/                # build plan / task checklists
├── biome.json
├── turbo.json
├── .env.sample
└── package.json
```

## Prerequisites

- Node.js 20+
- npm 10+
- SQL Server installed locally and running as a service — see
  [`docs/database-setup.md`](docs/database-setup.md) for the one-time setup
  (enabling SQL auth, TCP/IP, creating the login/database)

## Setup

```bash
git clone <this-repo>
cd pw-books
npm install
cp .env.sample .env   # fill in real DB credentials (see docs/database-setup.md)
npm run db:migrate
npm run db:seed
```

## Running everything

```bash
npm run dev
```

This single command (via Turborepo) verifies the local SQL Server
connection, then starts:
1. The Express API in watch mode
2. The Vite frontend dev server

(SQL Server itself isn't started by this command — it's the always-on local
service. `npm run dev` fails fast with a clear error if it isn't running.)

Once running:
- Frontend: http://localhost:5173
- API: http://localhost:3000
- API health check: http://localhost:3000/api/health
- DB connectivity check: http://localhost:3000/api/health/db

## Other commands

| Command | Description |
|---|---|
| `npm run dev` | Start DB + API + web together |
| `npm run build` | Build API and web via Turbo |
| `npm run lint` | Lint all workspaces with Biome |
| `npm run format` | Format all workspaces with Biome |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Seed sample data (books, authors, users, loans) |

## Status

The MVP build is complete — all phases in
[`docs/tasks/01-mvp-build-plan.md`](docs/tasks/01-mvp-build-plan.md) are
done, including wiring `npm run dev` to run the DB check, API, and web dev
server together. That file has the full build history; for known gaps and
pending follow-up work, see [`docs/issues.md`](docs/issues.md) — most
notably, the frontend hasn't yet been click-tested in a real browser (only
via `tsc`/`biome`/`vite build`/curl), so treat the UI as build-verified but
not runtime-verified until that pass happens.

The frontend talks to the real API by default now that the backend and DB
exist; set `VITE_USE_MOCK_API=true` in `.env` to fall back to the in-memory
mock client instead (offline work, or no local SQL Server running).

## License

Personal practice project — no license, not intended for reuse as a product.
