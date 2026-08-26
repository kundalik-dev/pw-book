import path from 'node:path';
import dotenv from 'dotenv';

// The monorepo has a single root `.env` (see README.md), not a per-workspace
// one — resolve relative to this file so it's found regardless of cwd.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '3000')),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),
  jwt: {
    accessSecret: required('JWT_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },
  db: {
    host: required('DB_HOST'),
    port: Number(optional('DB_PORT', '1433')),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    encrypt: optional('DB_ENCRYPT', 'false') === 'true',
    trustServerCertificate: optional('DB_TRUST_SERVER_CERTIFICATE', 'true') === 'true',
  },
} as const;
