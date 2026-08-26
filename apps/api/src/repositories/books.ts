import sql from 'mssql';
import { requirePool } from '../db/requirePool';
import { ApiError } from '../errors/ApiError';

export interface Book {
  id: number;
  title: string;
  isbn: string;
  authorId: number;
  categoryIds: number[];
  description: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
  totalCopies: number;
  availableCopies: number;
  createdAt: Date;
}

interface BookRow {
  Id: number;
  Title: string;
  Isbn: string;
  AuthorId: number;
  Description: string | null;
  PublishedYear: number | null;
  CoverImageUrl: string | null;
  TotalCopies: number;
  AvailableCopies: number;
  CreatedAt: Date;
}

const BOOK_COLUMNS =
  'Id, Title, Isbn, AuthorId, Description, PublishedYear, CoverImageUrl, TotalCopies, AvailableCopies, CreatedAt';
const BOOK_COLUMNS_QUALIFIED = BOOK_COLUMNS.split(', ')
  .map((col) => `b.${col}`)
  .join(', ');

function mapBookRow(row: BookRow, categoryIds: number[]): Book {
  return {
    id: row.Id,
    title: row.Title,
    isbn: row.Isbn,
    authorId: row.AuthorId,
    categoryIds,
    description: row.Description,
    publishedYear: row.PublishedYear,
    coverImageUrl: row.CoverImageUrl,
    totalCopies: row.TotalCopies,
    availableCopies: row.AvailableCopies,
    createdAt: row.CreatedAt,
  };
}

function isDuplicateIsbnError(err: unknown): boolean {
  const number = (err as sql.RequestError).number;
  return number === 2627 || number === 2601;
}

function isForeignKeyError(err: unknown): boolean {
  return (err as sql.RequestError).number === 547;
}

async function fetchCategoryIdsForBooks(
  pool: sql.ConnectionPool,
  bookIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (bookIds.length === 0) return map;

  const request = pool.request();
  const placeholders = bookIds.map((id, i) => {
    request.input(`bookId${i}`, sql.Int, id);
    return `@bookId${i}`;
  });
  const result = await request.query(
    `SELECT BookId, CategoryId FROM dbo.BookCategories WHERE BookId IN (${placeholders.join(', ')})`,
  );
  for (const row of result.recordset as { BookId: number; CategoryId: number }[]) {
    const list = map.get(row.BookId) ?? [];
    list.push(row.CategoryId);
    map.set(row.BookId, list);
  }
  return map;
}

async function setBookCategories(
  pool: sql.ConnectionPool,
  bookId: number,
  categoryIds: number[],
): Promise<void> {
  await pool
    .request()
    .input('bookId', sql.Int, bookId)
    .query('DELETE FROM dbo.BookCategories WHERE BookId = @bookId');
  for (const categoryId of categoryIds) {
    await pool
      .request()
      .input('bookId', sql.Int, bookId)
      .input('categoryId', sql.Int, categoryId)
      .query('INSERT INTO dbo.BookCategories (BookId, CategoryId) VALUES (@bookId, @categoryId)');
  }
}

export interface ListBooksFilters {
  page: number;
  limit: number;
  sort: string;
  category?: number[];
  author?: number[];
  year?: number;
  yearMin?: number;
  yearMax?: number;
  available?: boolean;
  q?: string;
}

const SORT_COLUMNS: Record<string, string> = {
  title: 'Title ASC',
  '-title': 'Title DESC',
  publishedYear: 'PublishedYear ASC',
  '-publishedYear': 'PublishedYear DESC',
  createdAt: 'CreatedAt ASC',
  '-createdAt': 'CreatedAt DESC',
};

// id[] filters are bound as @prefix0, @prefix1, ... on each request; the
// placeholder list below must use the same naming so it matches whichever
// request (count or list) the resulting WHERE-clause text is later run
// against — see bindFilterInputs.
function idPlaceholders(prefix: string, ids: number[]): string {
  return ids.map((_, i) => `@${prefix}${i}`).join(', ');
}

function bindIdList(request: sql.Request, prefix: string, ids: number[]): void {
  for (const [i, id] of ids.entries()) request.input(`${prefix}${i}`, sql.Int, id);
}

function bindFilterInputs(request: sql.Request, filters: ListBooksFilters): void {
  if (filters.category?.length) bindIdList(request, 'category', filters.category);
  if (filters.author?.length) bindIdList(request, 'author', filters.author);
  if (filters.year !== undefined) request.input('year', sql.Int, filters.year);
  if (filters.yearMin !== undefined) request.input('yearMin', sql.Int, filters.yearMin);
  if (filters.yearMax !== undefined) request.input('yearMax', sql.Int, filters.yearMax);
  if (filters.q !== undefined) request.input('q', sql.NVarChar(200), `%${filters.q}%`);
}

function buildWhereClause(filters: ListBooksFilters): string {
  const conditions: string[] = [];
  if (filters.author?.length) {
    conditions.push(`b.AuthorId IN (${idPlaceholders('author', filters.author)})`);
  }
  if (filters.year !== undefined) conditions.push('b.PublishedYear = @year');
  if (filters.yearMin !== undefined) conditions.push('b.PublishedYear >= @yearMin');
  if (filters.yearMax !== undefined) conditions.push('b.PublishedYear <= @yearMax');
  if (filters.available !== undefined) {
    conditions.push(filters.available ? 'b.AvailableCopies > 0' : 'b.AvailableCopies = 0');
  }
  if (filters.q !== undefined) {
    conditions.push('(b.Title LIKE @q OR b.Isbn LIKE @q OR b.Description LIKE @q)');
  }
  if (filters.category?.length) {
    conditions.push(
      `EXISTS (SELECT 1 FROM dbo.BookCategories bc WHERE bc.BookId = b.Id AND bc.CategoryId IN (${idPlaceholders('category', filters.category)}))`,
    );
  }
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

export async function listBooks(
  filters: ListBooksFilters,
): Promise<{ books: Book[]; total: number }> {
  const pool = requirePool();
  const whereClause = buildWhereClause(filters);
  const orderBy = SORT_COLUMNS[filters.sort] ?? SORT_COLUMNS.title;
  const offset = (filters.page - 1) * filters.limit;

  const countRequest = pool.request();
  bindFilterInputs(countRequest, filters);
  const countResult = await countRequest.query(
    `SELECT COUNT(*) AS Total FROM dbo.Books b ${whereClause}`,
  );
  const total = countResult.recordset[0].Total as number;

  const listRequest = pool.request();
  bindFilterInputs(listRequest, filters);
  listRequest.input('offset', sql.Int, offset);
  listRequest.input('limit', sql.Int, filters.limit);
  const listResult = await listRequest.query(
    `SELECT ${BOOK_COLUMNS_QUALIFIED}
     FROM dbo.Books b
     ${whereClause}
     ORDER BY b.${orderBy}
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
  );

  const rows = listResult.recordset as BookRow[];
  const categoryMap = await fetchCategoryIdsForBooks(
    pool,
    rows.map((r) => r.Id),
  );
  const books = rows.map((row) => mapBookRow(row, categoryMap.get(row.Id) ?? []));

  return { books, total };
}

export async function getBookById(id: number): Promise<Book | null> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT ${BOOK_COLUMNS} FROM dbo.Books WHERE Id = @id`);
  const row = result.recordset[0] as BookRow | undefined;
  if (!row) return null;
  const categoryMap = await fetchCategoryIdsForBooks(pool, [row.Id]);
  return mapBookRow(row, categoryMap.get(row.Id) ?? []);
}

export interface BookInput {
  title: string;
  isbn: string;
  authorId: number;
  categoryIds: number[];
  description?: string;
  publishedYear?: number;
  coverImageUrl?: string;
  totalCopies: number;
}

export async function createBook(data: BookInput): Promise<Book> {
  const pool = requirePool();
  let bookId: number;
  try {
    const result = await pool
      .request()
      .input('title', sql.NVarChar(300), data.title)
      .input('isbn', sql.NVarChar(20), data.isbn)
      .input('authorId', sql.Int, data.authorId)
      .input('description', sql.NVarChar(sql.MAX), data.description ?? null)
      .input('publishedYear', sql.Int, data.publishedYear ?? null)
      .input('coverImageUrl', sql.NVarChar(500), data.coverImageUrl ?? null)
      .input('totalCopies', sql.Int, data.totalCopies)
      .input('availableCopies', sql.Int, data.totalCopies)
      .query(
        `INSERT INTO dbo.Books (Title, Isbn, AuthorId, Description, PublishedYear, CoverImageUrl, TotalCopies, AvailableCopies)
         OUTPUT INSERTED.Id
         VALUES (@title, @isbn, @authorId, @description, @publishedYear, @coverImageUrl, @totalCopies, @availableCopies)`,
      );
    bookId = (result.recordset[0] as { Id: number }).Id;
  } catch (err) {
    if (isDuplicateIsbnError(err)) {
      throw new ApiError('A book with this ISBN already exists', 'BOOK_ISBN_EXISTS', 409);
    }
    if (isForeignKeyError(err)) {
      throw new ApiError('authorId does not reference an existing author', 'AUTHOR_NOT_FOUND', 400);
    }
    throw err;
  }

  if (data.categoryIds.length > 0) {
    try {
      await setBookCategories(pool, bookId, data.categoryIds);
    } catch (err) {
      if (isForeignKeyError(err)) {
        throw new ApiError(
          'categoryIds references a category that does not exist',
          'CATEGORY_NOT_FOUND',
          400,
        );
      }
      throw err;
    }
  }

  const book = await getBookById(bookId);
  if (!book) throw new ApiError('Failed to load created book', 'INTERNAL_ERROR', 500);
  return book;
}

export async function updateBook(id: number, data: BookInput): Promise<Book | null> {
  const pool = requirePool();
  try {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar(300), data.title)
      .input('isbn', sql.NVarChar(20), data.isbn)
      .input('authorId', sql.Int, data.authorId)
      .input('description', sql.NVarChar(sql.MAX), data.description ?? null)
      .input('publishedYear', sql.Int, data.publishedYear ?? null)
      .input('coverImageUrl', sql.NVarChar(500), data.coverImageUrl ?? null)
      .input('totalCopies', sql.Int, data.totalCopies)
      .query(
        `UPDATE dbo.Books
         SET Title = @title, Isbn = @isbn, AuthorId = @authorId, Description = @description,
             PublishedYear = @publishedYear,
             CoverImageUrl = COALESCE(@coverImageUrl, CoverImageUrl),
             TotalCopies = @totalCopies,
             AvailableCopies = CASE WHEN AvailableCopies > @totalCopies THEN @totalCopies ELSE AvailableCopies END
         OUTPUT INSERTED.Id
         WHERE Id = @id`,
      );
    if (result.recordset.length === 0) return null;
  } catch (err) {
    if (isDuplicateIsbnError(err)) {
      throw new ApiError('A book with this ISBN already exists', 'BOOK_ISBN_EXISTS', 409);
    }
    if (isForeignKeyError(err)) {
      throw new ApiError('authorId does not reference an existing author', 'AUTHOR_NOT_FOUND', 400);
    }
    throw err;
  }

  try {
    await setBookCategories(pool, id, data.categoryIds);
  } catch (err) {
    if (isForeignKeyError(err)) {
      throw new ApiError(
        'categoryIds references a category that does not exist',
        'CATEGORY_NOT_FOUND',
        400,
      );
    }
    throw err;
  }

  return getBookById(id);
}

export async function deleteBook(id: number): Promise<boolean> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.Books WHERE Id = @id');
  return (result.rowsAffected[0] ?? 0) > 0;
}

export interface BookExportRow {
  id: number;
  title: string;
  isbn: string;
  authorName: string;
  categoryNames: string[];
  description: string | null;
  publishedYear: number | null;
  totalCopies: number;
  availableCopies: number;
}

interface BookExportQueryRow {
  Id: number;
  Title: string;
  Isbn: string;
  AuthorName: string;
  Description: string | null;
  PublishedYear: number | null;
  TotalCopies: number;
  AvailableCopies: number;
}

async function fetchCategoryNamesForBooks(
  pool: sql.ConnectionPool,
  bookIds: number[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (bookIds.length === 0) return map;

  const request = pool.request();
  const placeholders = bookIds.map((id, i) => {
    request.input(`bookId${i}`, sql.Int, id);
    return `@bookId${i}`;
  });
  const result = await request.query(
    `SELECT bc.BookId, c.Name AS CategoryName
     FROM dbo.BookCategories bc
     JOIN dbo.Categories c ON c.Id = bc.CategoryId
     WHERE bc.BookId IN (${placeholders.join(', ')})`,
  );
  for (const row of result.recordset as { BookId: number; CategoryName: string }[]) {
    const list = map.get(row.BookId) ?? [];
    list.push(row.CategoryName);
    map.set(row.BookId, list);
  }
  return map;
}

export async function listAllBooksForExport(): Promise<BookExportRow[]> {
  const pool = requirePool();
  const result = await pool.request().query(
    `SELECT b.Id, b.Title, b.Isbn, a.Name AS AuthorName, b.Description, b.PublishedYear,
            b.TotalCopies, b.AvailableCopies
     FROM dbo.Books b
     JOIN dbo.Authors a ON a.Id = b.AuthorId
     ORDER BY b.Title`,
  );
  const rows = result.recordset as BookExportQueryRow[];
  const categoryMap = await fetchCategoryNamesForBooks(
    pool,
    rows.map((r) => r.Id),
  );
  return rows.map((row) => ({
    id: row.Id,
    title: row.Title,
    isbn: row.Isbn,
    authorName: row.AuthorName,
    categoryNames: categoryMap.get(row.Id) ?? [],
    description: row.Description,
    publishedYear: row.PublishedYear,
    totalCopies: row.TotalCopies,
    availableCopies: row.AvailableCopies,
  }));
}

export async function updateAvailability(
  id: number,
  availableCopies: number,
): Promise<Book | null> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('availableCopies', sql.Int, availableCopies)
    .query(
      `UPDATE dbo.Books
       SET AvailableCopies = @availableCopies
       OUTPUT INSERTED.Id
       WHERE Id = @id AND @availableCopies <= TotalCopies`,
    );
  if (result.recordset.length > 0) return getBookById(id);

  const existing = await getBookById(id);
  if (!existing) return null;
  throw new ApiError('availableCopies cannot exceed totalCopies', 'INVALID_AVAILABILITY', 400);
}
