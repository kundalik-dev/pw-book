import sql from 'mssql';
import { requirePool } from '../db/requirePool';
import { ApiError } from '../errors/ApiError';

export interface Loan {
  id: number;
  bookId: number;
  userId: number;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  returnedToAdminId: number | null;
  status: 'active' | 'returned' | 'overdue';
}

interface LoanRow {
  Id: number;
  BookId: number;
  UserId: number;
  BorrowedAt: Date;
  DueAt: Date;
  ReturnedAt: Date | null;
  ReturnedToAdminId: number | null;
  Status: 'active' | 'returned' | 'overdue';
}

const LOAN_COLUMNS = 'Id, BookId, UserId, BorrowedAt, DueAt, ReturnedAt, ReturnedToAdminId, Status';
const LOAN_PERIOD_DAYS = 14;

function mapLoan(row: LoanRow): Loan {
  return {
    id: row.Id,
    bookId: row.BookId,
    userId: row.UserId,
    borrowedAt: row.BorrowedAt,
    dueAt: row.DueAt,
    returnedAt: row.ReturnedAt,
    returnedToAdminId: row.ReturnedToAdminId,
    status: row.Status,
  };
}

/**
 * `dueAt` lets a caller pin a specific return date (e.g. the Orders page's
 * user-selected date, capped to ORDER_RETURN_WINDOW_DAYS by the request
 * schema) instead of the default LOAN_PERIOD_DAYS estimate the borrow wizard
 * uses.
 */
export async function borrowBook(userId: number, bookId: number, dueAt?: Date): Promise<Loan> {
  const pool = requirePool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const bookResult = await new sql.Request(transaction)
      .input('bookId', sql.Int, bookId)
      .query('SELECT AvailableCopies FROM dbo.Books WITH (UPDLOCK, ROWLOCK) WHERE Id = @bookId');
    const book = bookResult.recordset[0] as { AvailableCopies: number } | undefined;
    if (!book) {
      throw new ApiError('Book not found', 'BOOK_NOT_FOUND', 404);
    }
    if (book.AvailableCopies <= 0) {
      throw new ApiError('No copies available to borrow', 'NO_COPIES_AVAILABLE', 409);
    }

    await new sql.Request(transaction)
      .input('bookId', sql.Int, bookId)
      .query('UPDATE dbo.Books SET AvailableCopies = AvailableCopies - 1 WHERE Id = @bookId');

    const resolvedDueAt = dueAt ?? new Date(Date.now() + LOAN_PERIOD_DAYS * 86_400_000);
    const loanResult = await new sql.Request(transaction)
      .input('bookId', sql.Int, bookId)
      .input('userId', sql.Int, userId)
      .input('dueAt', sql.DateTime2, resolvedDueAt)
      .query(
        `INSERT INTO dbo.Loans (BookId, UserId, DueAt, Status)
         OUTPUT INSERTED.*
         VALUES (@bookId, @userId, @dueAt, 'active')`,
      );

    await transaction.commit();
    return mapLoan(loanResult.recordset[0] as LoanRow);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function returnLoan(
  loanId: number,
  requestingUser: { id: number; role: string },
  receivedByAdminId: number,
): Promise<Loan> {
  const pool = requirePool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const existingResult = await new sql.Request(transaction)
      .input('id', sql.Int, loanId)
      .query(`SELECT ${LOAN_COLUMNS} FROM dbo.Loans WITH (UPDLOCK, ROWLOCK) WHERE Id = @id`);
    const existing = existingResult.recordset[0] as LoanRow | undefined;
    if (!existing) {
      throw new ApiError('Loan not found', 'LOAN_NOT_FOUND', 404);
    }
    if (requestingUser.role !== 'admin' && existing.UserId !== requestingUser.id) {
      throw new ApiError('You can only return your own loans', 'FORBIDDEN', 403);
    }
    if (existing.Status === 'returned') {
      throw new ApiError('This loan has already been returned', 'LOAN_ALREADY_RETURNED', 409);
    }

    const adminResult = await new sql.Request(transaction)
      .input('adminId', sql.Int, receivedByAdminId)
      .query("SELECT Id FROM dbo.Users WHERE Id = @adminId AND Role = 'admin'");
    if (adminResult.recordset.length === 0) {
      throw new ApiError('Selected admin not found', 'ADMIN_NOT_FOUND', 400);
    }

    const updateResult = await new sql.Request(transaction)
      .input('id', sql.Int, loanId)
      .input('adminId', sql.Int, receivedByAdminId)
      .query(
        `UPDATE dbo.Loans
           SET Status = 'returned', ReturnedAt = SYSUTCDATETIME(), ReturnedToAdminId = @adminId
           OUTPUT INSERTED.*
           WHERE Id = @id`,
      );
    await new sql.Request(transaction).input('bookId', sql.Int, existing.BookId).query(
      `UPDATE dbo.Books
         SET AvailableCopies = AvailableCopies + 1
         WHERE Id = @bookId AND AvailableCopies < TotalCopies`,
    );

    await transaction.commit();
    return mapLoan(updateResult.recordset[0] as LoanRow);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function listLoansForUser(userId: number): Promise<Loan[]> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`SELECT ${LOAN_COLUMNS} FROM dbo.Loans WHERE UserId = @userId ORDER BY BorrowedAt DESC`);
  return (result.recordset as LoanRow[]).map(mapLoan);
}

/**
 * Admin-only all-orders listing behind `GET /loans`, optionally narrowed to
 * one customer or one book — powers the admin Orders page and its per-user
 * / per-book order-history drill-downs.
 */
export async function listAllLoans(
  filters: { userId?: number; bookId?: number } = {},
): Promise<Loan[]> {
  const pool = requirePool();
  const request = pool.request();
  const conditions: string[] = [];
  if (filters.userId !== undefined) {
    request.input('userId', sql.Int, filters.userId);
    conditions.push('UserId = @userId');
  }
  if (filters.bookId !== undefined) {
    request.input('bookId', sql.Int, filters.bookId);
    conditions.push('BookId = @bookId');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await request.query(
    `SELECT ${LOAN_COLUMNS} FROM dbo.Loans ${where} ORDER BY BorrowedAt DESC`,
  );
  return (result.recordset as LoanRow[]).map(mapLoan);
}

/**
 * Blocks book deletion while any copy is still out with a customer — checked
 * by `DELETE /books/:id` before it removes the row.
 */
export async function hasActiveLoansForBook(bookId: number): Promise<boolean> {
  const pool = requirePool();
  const result = await pool
    .request()
    .input('bookId', sql.Int, bookId)
    .query(
      "SELECT TOP 1 Id FROM dbo.Loans WHERE BookId = @bookId AND Status IN ('active', 'overdue')",
    );
  return result.recordset.length > 0;
}

/**
 * Flips any `active` loan whose due date has passed to `overdue` before
 * reading the report, so the Status column stays meaningful without a
 * separate cron/scheduled job.
 */
export async function listOverdueLoans(): Promise<Loan[]> {
  const pool = requirePool();
  await pool
    .request()
    .query(
      "UPDATE dbo.Loans SET Status = 'overdue' WHERE Status = 'active' AND DueAt < SYSUTCDATETIME()",
    );
  const result = await pool
    .request()
    .query(`SELECT ${LOAN_COLUMNS} FROM dbo.Loans WHERE Status = 'overdue' ORDER BY DueAt ASC`);
  return (result.recordset as LoanRow[]).map(mapLoan);
}
