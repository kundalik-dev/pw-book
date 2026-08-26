# Local SQL Server setup (one-time)

pw-books connects to the SQL Server instance already installed on this
machine — there's no Docker container to manage. Do this once before
running any `db:*` scripts.

## 1. Confirm the instance and its name

Open **SQL Server Configuration Manager** → *SQL Server Services* and note
the instance name:
- Default instance → connect as `localhost` (or `.`), port `1433`
- Named instance (e.g. `SQLEXPRESS`) → connect as `localhost\SQLEXPRESS`;
  either enable **SQL Server Browser** or find the fixed port under
  *SQL Server Network Configuration → Protocols → TCP/IP → IP Addresses →
  IPAll → TCP Port* and use that port directly

Put whichever applies in `.env` as `DB_HOST` (and `DB_PORT` if not 1433).

## 2. Enable TCP/IP

In **SQL Server Configuration Manager** → *SQL Server Network Configuration
→ Protocols for <instance>* → enable **TCP/IP** if it isn't already, then
restart the SQL Server service for it to take effect.

## 3. Enable SQL Server Authentication (mixed mode)

The `mssql` npm package (Tedious driver) connects with a SQL login, not
Windows Integrated auth. In **SSMS**: right-click the server instance →
*Properties → Security* → set **SQL Server and Windows Authentication mode**
→ restart the SQL Server service.

## 4. Create a login and database for this project

Run in SSMS, Azure Data Studio, or `sqlcmd`:

```sql
CREATE LOGIN pw_books_app WITH PASSWORD = 'YourStrong!Passw0rd';
CREATE DATABASE pw_books;
GO
USE pw_books;
CREATE USER pw_books_app FOR LOGIN pw_books_app;
ALTER ROLE db_owner ADD MEMBER pw_books_app;
```

Use a real password of your choosing — it just needs to match `.env`.

## 5. Fill in `.env`

Copy `.env.sample` to `.env` and set:

```
DB_HOST=localhost              # or localhost\SQLEXPRESS for a named instance
DB_PORT=1433
DB_NAME=pw_books
DB_USER=pw_books_app
DB_PASSWORD=YourStrong!Passw0rd
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

`DB_ENCRYPT=false` / `DB_TRUST_SERVER_CERTIFICATE=true` avoid TLS
certificate issues on a local, non-production instance. Don't use these
values against a real/shared server.

## 6. Verify

```bash
npm run db:migrate
npm run db:seed
```

`apps/db/scripts/verify-connection.js` is what `npm run dev` (via Turbo)
runs before starting the API, so a stopped SQL Server service or a wrong
password fails immediately with a clear error instead of the API hanging.
