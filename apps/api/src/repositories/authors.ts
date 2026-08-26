import sql from 'mssql';
import { requirePool } from '../db/requirePool';
import { ApiError } from '../errors/ApiError';

export interface Author {
  id: number;
  name: string;
  bio: string | null;
}

interface AuthorRow {
  Id: number;
  Name: string;
  Bio: string | null;
}

function mapAuthor(row: AuthorRow): Author {
  return { id: row.Id, name: row.Name, bio: row.Bio };
}

function isForeignKeyError(err: unknown): boolean {
  return (err as sql.RequestError).number === 547;
}

export async function listAuthors(): Promise<Author[]> {
  const pool = requirePool();
  const result = await pool.request().query('SELECT Id, Name, Bio FROM dbo.Authors ORDER BY Name');
  return (result.recordset as AuthorRow[]).map(mapAuthor);
}

export async function getAuthorById(id: number): Promise<Author | null> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT Id, Name, Bio FROM dbo.Authors WHERE Id = @id');
  const row = result.recordset[0] as AuthorRow | undefined;
  return row ? mapAuthor(row) : null;
}

export async function createAuthor(data: { name: string; bio?: string }): Promise<Author> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), data.name)
    .input('bio', sql.NVarChar(sql.MAX), data.bio ?? null)
    .query(
      'INSERT INTO dbo.Authors (Name, Bio) OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Bio VALUES (@name, @bio)',
    );
  return mapAuthor(result.recordset[0] as AuthorRow);
}

export async function updateAuthor(
  id: number,
  data: { name: string; bio?: string },
): Promise<Author | null> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(200), data.name)
    .input('bio', sql.NVarChar(sql.MAX), data.bio ?? null)
    .query(
      'UPDATE dbo.Authors SET Name = @name, Bio = @bio OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Bio WHERE Id = @id',
    );
  const row = result.recordset[0] as AuthorRow | undefined;
  return row ? mapAuthor(row) : null;
}

/** Used by bulk-import: reuse an existing author by exact name match, or create one. */
export async function findOrCreateAuthorByName(name: string): Promise<Author> {
  const pool = requirePool();
  const existing = await pool
    .request()
    .input('name', sql.NVarChar(200), name)
    .query('SELECT Id, Name, Bio FROM dbo.Authors WHERE Name = @name');
  const row = existing.recordset[0] as AuthorRow | undefined;
  if (row) return mapAuthor(row);
  return createAuthor({ name });
}

export async function deleteAuthor(id: number): Promise<boolean> {
  const pool = requirePool();
  try {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.Authors WHERE Id = @id');
    return (result.rowsAffected[0] ?? 0) > 0;
  } catch (err) {
    if (isForeignKeyError(err)) {
      throw new ApiError('Cannot delete an author that has books', 'AUTHOR_HAS_BOOKS', 409);
    }
    throw err;
  }
}
