import sql from 'mssql';
import { getDbConfig } from './env.js';

async function main() {
  const config = getDbConfig();
  console.log(
    `Connecting to ${config.server}:${config.port}/${config.database} as ${config.user}...`,
  );

  let pool;
  try {
    pool = await sql.connect(config);
    const result = await pool
      .request()
      .query('SELECT DB_NAME() AS db, SYSUTCDATETIME() AS serverTimeUtc;');
    const row = result.recordset[0];
    console.log(
      `Connected. Database: ${row.db}, server time (UTC): ${row.serverTimeUtc.toISOString()}`,
    );
  } catch (err) {
    console.error('Database connection failed.');
    console.error(err.message);
    console.error(
      '\nCheck: is the SQL Server service running, is SQL Server Authentication (mixed mode) enabled, ' +
        'and does .env match a real login? See docs/database-setup.md.',
    );
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

main();
