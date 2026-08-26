import { createHash } from 'node:crypto';
import sql from 'mssql';
import { requirePool } from './requirePool';

function hashToken(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

export async function storeRefreshToken(
  userId: number,
  jti: string,
  expiresAt: Date,
): Promise<void> {
  await requirePool()
    .request()
    .input('userId', sql.Int, userId)
    .input('tokenHash', sql.NVarChar, hashToken(jti))
    .input('expiresAt', sql.DateTime2, expiresAt)
    .query(
      `INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt) VALUES (@userId, @tokenHash, @expiresAt)`,
    );
}

/**
 * Atomically marks a refresh token used (rotation) and reports whether it was
 * valid beforehand — unknown, expired, and already-consumed tokens all return
 * false so `/auth/refresh` can reject replay attempts with one code path.
 */
export async function consumeRefreshToken(userId: number, jti: string): Promise<boolean> {
  const result = await requirePool()
    .request()
    .input('userId', sql.Int, userId)
    .input('tokenHash', sql.NVarChar, hashToken(jti))
    .query(
      `UPDATE dbo.RefreshTokens
       SET RevokedAt = SYSUTCDATETIME()
       OUTPUT inserted.Id
       WHERE UserId = @userId AND TokenHash = @tokenHash AND RevokedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()`,
    );
  return result.recordset.length > 0;
}

export async function revokeRefreshToken(userId: number, jti: string): Promise<void> {
  await requirePool()
    .request()
    .input('userId', sql.Int, userId)
    .input('tokenHash', sql.NVarChar, hashToken(jti))
    .query(
      `UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME()
       WHERE UserId = @userId AND TokenHash = @tokenHash AND RevokedAt IS NULL`,
    );
}
