import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { consumeRefreshToken, revokeRefreshToken, storeRefreshToken } from '../db/refreshTokens';
import { requirePool } from '../db/requirePool';
import { ApiError } from '../errors/ApiError';
import type { Role } from '../utils/jwt';
import { decodeExpiry, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { comparePassword, hashPassword } from '../utils/password';

interface UserRow {
  Id: number;
  Name: string;
  Email: string;
  PasswordHash: string;
  Role: Role;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: String(row.Id), name: row.Name, email: row.Email, role: row.Role };
}

async function issueTokenPair(row: UserRow): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: String(row.Id), role: row.Role });
  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: String(row.Id), jti });
  await storeRefreshToken(row.Id, jti, decodeExpiry(refreshToken));
  return { accessToken, refreshToken };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: PublicUser } & TokenPair> {
  const pool = requirePool();

  const existing = await pool
    .request()
    .input('email', sql.NVarChar, input.email)
    .query('SELECT Id FROM dbo.Users WHERE Email = @email');
  if (existing.recordset.length > 0) {
    throw new ApiError('An account with this email already exists.', 'EMAIL_TAKEN', 409);
  }

  const passwordHash = await hashPassword(input.password);
  const inserted = await pool
    .request()
    .input('name', sql.NVarChar, input.name)
    .input('email', sql.NVarChar, input.email)
    .input('passwordHash', sql.NVarChar, passwordHash)
    .query(
      `INSERT INTO dbo.Users (Name, Email, PasswordHash)
       OUTPUT inserted.Id, inserted.Name, inserted.Email, inserted.Role
       VALUES (@name, @email, @passwordHash)`,
    );
  const row = inserted.recordset[0] as UserRow;
  const tokens = await issueTokenPair(row);
  return { user: toPublicUser(row), ...tokens };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: PublicUser } & TokenPair> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar, input.email)
    .query('SELECT Id, Name, Email, PasswordHash, Role FROM dbo.Users WHERE Email = @email');
  const row = result.recordset[0] as UserRow | undefined;

  if (!row || !(await comparePassword(input.password, row.PasswordHash))) {
    throw new ApiError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
  }

  const tokens = await issueTokenPair(row);
  return { user: toPublicUser(row), ...tokens };
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }

  const userId = Number(payload.sub);
  const consumed = await consumeRefreshToken(userId, payload.jti);
  if (!consumed) {
    throw new ApiError(
      'Refresh token has already been used or revoked',
      'INVALID_REFRESH_TOKEN',
      401,
    );
  }

  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, userId)
    .query('SELECT Id, Name, Email, PasswordHash, Role FROM dbo.Users WHERE Id = @id');
  const row = result.recordset[0] as UserRow | undefined;
  if (!row) {
    throw new ApiError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }

  return issueTokenPair(row);
}

export async function logout(refreshToken: string): Promise<void> {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return;
  }
  await revokeRefreshToken(Number(payload.sub), payload.jti);
}

export async function getUserById(id: string): Promise<PublicUser> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, Number(id))
    .query('SELECT Id, Name, Email, Role FROM dbo.Users WHERE Id = @id');
  const row = result.recordset[0] as Omit<UserRow, 'PasswordHash'> | undefined;
  if (!row) throw new ApiError('User not found', 'NOT_FOUND', 404);
  return { id: String(row.Id), name: row.Name, email: row.Email, role: row.Role };
}
