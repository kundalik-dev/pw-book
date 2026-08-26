import type sql from 'mssql';
import { ApiError } from '../errors/ApiError';
import { getPool } from './pool';

/**
 * CRUD repositories need a live pool to do anything useful — surface that as
 * a 503 rather than letting a null-pool call throw a raw TypeError.
 */
export function requirePool(): sql.ConnectionPool {
  const pool = getPool();
  if (!pool) {
    throw new ApiError('Database is not connected', 'DB_UNAVAILABLE', 503);
  }
  return pool;
}
