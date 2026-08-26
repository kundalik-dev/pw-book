import sql from 'mssql';
import { requirePool } from '../db/requirePool';
import { ApiError } from '../errors/ApiError';

export interface Review {
  id: number;
  bookId: number;
  userId: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

interface ReviewRow {
  Id: number;
  BookId: number;
  UserId: number;
  Rating: number;
  Comment: string | null;
  CreatedAt: Date;
}

const REVIEW_COLUMNS = 'Id, BookId, UserId, Rating, Comment, CreatedAt';

function mapReview(row: ReviewRow): Review {
  return {
    id: row.Id,
    bookId: row.BookId,
    userId: row.UserId,
    rating: row.Rating,
    comment: row.Comment,
    createdAt: row.CreatedAt,
  };
}

function isDuplicateReviewError(err: unknown): boolean {
  const number = (err as sql.RequestError).number;
  return number === 2627 || number === 2601;
}

export async function listReviewsForBook(bookId: number): Promise<Review[]> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('bookId', sql.Int, bookId)
    .query(
      `SELECT ${REVIEW_COLUMNS} FROM dbo.Reviews WHERE BookId = @bookId ORDER BY CreatedAt DESC`,
    );
  return (result.recordset as ReviewRow[]).map(mapReview);
}

export async function getReviewById(id: number): Promise<Review | null> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT ${REVIEW_COLUMNS} FROM dbo.Reviews WHERE Id = @id`);
  const row = result.recordset[0] as ReviewRow | undefined;
  return row ? mapReview(row) : null;
}

export async function createReview(data: {
  bookId: number;
  userId: number;
  rating: number;
  comment?: string;
}): Promise<Review> {
  const pool = requirePool();
  try {
    const result = await pool
      .request()
      .input('bookId', sql.Int, data.bookId)
      .input('userId', sql.Int, data.userId)
      .input('rating', sql.Int, data.rating)
      .input('comment', sql.NVarChar(sql.MAX), data.comment ?? null)
      .query(
        `INSERT INTO dbo.Reviews (BookId, UserId, Rating, Comment)
         OUTPUT INSERTED.*
         VALUES (@bookId, @userId, @rating, @comment)`,
      );
    return mapReview(result.recordset[0] as ReviewRow);
  } catch (err) {
    if (isDuplicateReviewError(err)) {
      throw new ApiError('You have already reviewed this book', 'REVIEW_ALREADY_EXISTS', 409);
    }
    throw err;
  }
}

export async function deleteReview(id: number): Promise<boolean> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.Reviews WHERE Id = @id');
  return (result.rowsAffected[0] ?? 0) > 0;
}
