import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');

config({ path: rootEnvPath });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.sample to .env at the repo root and fill it in (see docs/database-setup.md).`,
    );
  }
  return value;
}

export function getDbConfig({ database } = {}) {
  return {
    server: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 1433),
    database: database ?? required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    },
    connectionTimeout: 5000,
    requestTimeout: 15000,
  };
}
