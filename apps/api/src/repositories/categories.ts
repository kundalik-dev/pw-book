import sql from 'mssql';
import { requirePool } from '../db/requirePool';
import { ApiError } from '../errors/ApiError';

export interface Category {
  id: number;
  name: string;
}

interface CategoryRow {
  Id: number;
  Name: string;
}

function mapCategory(row: CategoryRow): Category {
  return { id: row.Id, name: row.Name };
}

function isDuplicateNameError(err: unknown): boolean {
  const number = (err as sql.RequestError).number;
  return number === 2627 || number === 2601;
}

export async function listCategories(): Promise<Category[]> {
  const pool = requirePool();
  const result = await pool.request().query('SELECT Id, Name FROM dbo.Categories ORDER BY Name');
  return (result.recordset as CategoryRow[]).map(mapCategory);
}

export async function getCategoryById(id: number): Promise<Category | null> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT Id, Name FROM dbo.Categories WHERE Id = @id');
  const row = result.recordset[0] as CategoryRow | undefined;
  return row ? mapCategory(row) : null;
}

export async function createCategory(data: { name: string }): Promise<Category> {
  const pool = requirePool();
  try {
    const result = await pool
      .request()
      .input('name', sql.NVarChar(100), data.name)
      .query('INSERT INTO dbo.Categories (Name) OUTPUT INSERTED.Id, INSERTED.Name VALUES (@name)');
    return mapCategory(result.recordset[0] as CategoryRow);
  } catch (err) {
    if (isDuplicateNameError(err)) {
      throw new ApiError('A category with this name already exists', 'CATEGORY_EXISTS', 409);
    }
    throw err;
  }
}

export async function updateCategory(
  id: number,
  data: { name: string },
): Promise<Category | null> {
  const pool = requirePool();
  try {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(100), data.name)
      .query(
        'UPDATE dbo.Categories SET Name = @name OUTPUT INSERTED.Id, INSERTED.Name WHERE Id = @id',
      );
    const row = result.recordset[0] as CategoryRow | undefined;
    return row ? mapCategory(row) : null;
  } catch (err) {
    if (isDuplicateNameError(err)) {
      throw new ApiError('A category with this name already exists', 'CATEGORY_EXISTS', 409);
    }
    throw err;
  }
}

export async function deleteCategory(id: number): Promise<boolean> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.Categories WHERE Id = @id');
  return (result.rowsAffected[0] ?? 0) > 0;
}
