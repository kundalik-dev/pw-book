import sql from 'mssql';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getDbConfig } from './env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '../migrations');

function splitBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*$/im)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function ensureDatabaseExists(dbName) {
  const masterPool = await sql.connect(getDbConfig({ database: 'master' }));
  try {
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'${dbName}')
      BEGIN
        EXEC('CREATE DATABASE [${dbName}]');
      END
    `);
  } finally {
    await masterPool.close();
  }
}

async function main() {
  const dbConfig = getDbConfig();

  console.log(`Ensuring database "${dbConfig.database}" exists...`);
  await ensureDatabaseExists(dbConfig.database);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const pool = await sql.connect(dbConfig);
  try {
    for (const file of files) {
      console.log(`Applying ${file}...`);
      const contents = await readFile(resolve(migrationsDir, file), 'utf8');
      const batches = splitBatches(contents);
      for (const batch of batches) {
        await pool.request().query(batch);
      }
    }
    console.log(`Applied ${files.length} migration file(s) successfully.`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
