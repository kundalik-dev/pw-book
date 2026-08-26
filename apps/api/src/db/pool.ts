import sql from 'mssql';
import { config } from '../config';

const RETRY_DELAY_MS = 5000;

let pool: sql.ConnectionPool | null = null;
let retryLoopStarted = false;

function buildSqlConfig(): sql.config {
  return {
    server: config.db.host,
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
    options: {
      encrypt: config.db.encrypt,
      trustServerCertificate: config.db.trustServerCertificate,
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getPool(): sql.ConnectionPool | null {
  return pool;
}

export function isDbConnected(): boolean {
  return pool !== null && pool.connected;
}

/**
 * Connects in the background and keeps retrying on failure instead of
 * crashing the process — Turbo doesn't guarantee the local SQL Server
 * instance is reachable before the API starts (see CLAUDE.md).
 */
export async function connectWithRetry(): Promise<void> {
  if (retryLoopStarted) return;
  retryLoopStarted = true;

  while (!pool) {
    try {
      const candidate = new sql.ConnectionPool(buildSqlConfig());
      candidate.on('error', (err: Error) => {
        console.error('[db] pool error, will reconnect:', err.message);
        pool = null;
        retryLoopStarted = false;
        void connectWithRetry();
      });
      await candidate.connect();
      pool = candidate;
      console.log('[db] connected');
    } catch (err) {
      console.warn(
        `[db] connection failed, retrying in ${RETRY_DELAY_MS}ms:`,
        (err as Error).message,
      );
      await delay(RETRY_DELAY_MS);
    }
  }

  retryLoopStarted = false;
}
