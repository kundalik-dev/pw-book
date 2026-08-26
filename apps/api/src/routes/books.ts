import { Router } from 'express';
import { ZodError, type z } from 'zod';
import { ApiError } from '../errors/ApiError';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadCoverImage, uploadCsvFile } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { findOrCreateAuthorByName } from '../repositories/authors';
import {
  createBook,
  deleteBook,
  getBookById,
  listAllBooksForExport,
  listBooks,
  updateAvailability,
  updateBook,
} from '../repositories/books';
import { findOrCreateCategoryByName } from '../repositories/categories';
import {
  availabilitySchema,
  bookIdParamSchema,
  bulkImportRowSchema,
  createBookSchema,
  listBooksQuerySchema,
  updateBookSchema,
} from '../schemas/book';
import { parseCsv, stringifyCsv } from '../utils/csv';

export const booksRouter = Router();

type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

booksRouter.get('/books', validate(listBooksQuerySchema, 'query'), async (req, res, next) => {
  try {
    const query = req.query as unknown as ListBooksQuery;
    const { books, total } = await listBooks(query);
    res.json({
      books,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// NOTE: `/books/export` and `/books/bulk-import` are registered before
// `/books/:id` so they aren't swallowed by the :id param match.
booksRouter.get('/books/export', async (_req, res, next) => {
  try {
    const books = await listAllBooksForExport();
    const header = [
      'title',
      'isbn',
      'authorName',
      'categoryNames',
      'description',
      'publishedYear',
      'totalCopies',
      'availableCopies',
    ];
    const rows = books.map((book) => [
      book.title,
      book.isbn,
      book.authorName,
      book.categoryNames.join(';'),
      book.description ?? '',
      book.publishedYear?.toString() ?? '',
      book.totalCopies.toString(),
      book.availableCopies.toString(),
    ]);
    const csv = stringifyCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="books-export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// CSV columns: title, isbn, authorName, categoryNames (';'-separated),
// description, publishedYear, totalCopies. Unknown authors/categories are
// created on the fly (matched by exact name), matching how `apps/db`'s seed
// script builds its fixtures. Each row succeeds or fails independently so
// one bad row doesn't sink the rest of the file.
const CSV_HEADER_MAP: Record<string, string> = {
  title: 'title',
  isbn: 'isbn',
  authorname: 'authorName',
  categorynames: 'categoryNames',
  description: 'description',
  publishedyear: 'publishedYear',
  totalcopies: 'totalCopies',
};

interface BulkImportSuccess {
  row: number;
  bookId: number;
}
interface BulkImportFailure {
  row: number;
  error: string;
}

booksRouter.post(
  '/books/bulk-import',
  requireAuth,
  requireRole('admin'),
  uploadCsvFile,
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new ApiError('CSV file is required (field name "file")', 'FILE_REQUIRED', 400);
      }
      const rows = parseCsv(req.file.buffer.toString('utf-8'));
      if (rows.length === 0) {
        throw new ApiError('CSV file is empty', 'EMPTY_FILE', 400);
      }

      const [header, ...dataRows] = rows;
      const columns = header.map((h) => CSV_HEADER_MAP[h.trim().toLowerCase()] ?? h.trim());

      const imported: BulkImportSuccess[] = [];
      const failed: BulkImportFailure[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const rowNumber = i + 2; // 1-indexed, plus the header row
        try {
          const raw = Object.fromEntries(
            columns.map((col, idx) => [col, (dataRows[i][idx] ?? '').trim()]),
          );
          const parsed = bulkImportRowSchema.parse(raw);

          const totalCopies = parsed.totalCopies ? Number(parsed.totalCopies) : 1;
          if (!Number.isInteger(totalCopies) || totalCopies < 0) {
            throw new ApiError('totalCopies must be a non-negative integer', 'VALIDATION_ERROR');
          }
          let publishedYear: number | undefined;
          if (parsed.publishedYear) {
            publishedYear = Number(parsed.publishedYear);
            if (!Number.isInteger(publishedYear)) {
              throw new ApiError('publishedYear must be an integer', 'VALIDATION_ERROR');
            }
          }

          const author = await findOrCreateAuthorByName(parsed.authorName);
          const categoryNames = parsed.categoryNames
            ? parsed.categoryNames
                .split(';')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
          const categoryIds: number[] = [];
          for (const name of categoryNames) {
            const category = await findOrCreateCategoryByName(name);
            categoryIds.push(category.id);
          }

          const book = await createBook({
            title: parsed.title,
            isbn: parsed.isbn,
            authorId: author.id,
            categoryIds,
            description: parsed.description || undefined,
            publishedYear,
            totalCopies,
          });
          imported.push({ row: rowNumber, bookId: book.id });
        } catch (err) {
          const message =
            err instanceof ApiError
              ? err.message
              : err instanceof ZodError
                ? err.issues.map((issue) => issue.message).join(', ')
                : 'Unknown error';
          failed.push({ row: rowNumber, error: message });
        }
      }

      const status = failed.length === 0 ? 201 : imported.length === 0 ? 400 : 207;
      res.status(status).json({ imported, failed });
    } catch (err) {
      next(err);
    }
  },
);

booksRouter.get('/books/:id', validate(bookIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const book = await getBookById(Number(req.params.id));
    if (!book) throw new ApiError('Book not found', 'BOOK_NOT_FOUND', 404);
    res.json({ book });
  } catch (err) {
    next(err);
  }
});

booksRouter.post(
  '/books',
  requireAuth,
  requireRole('admin'),
  uploadCoverImage,
  validate(createBookSchema),
  async (req, res, next) => {
    try {
      const coverImageUrl = req.file ? `/uploads/covers/${req.file.filename}` : undefined;
      const book = await createBook({ ...req.body, coverImageUrl });
      res.status(201).json({ book });
    } catch (err) {
      next(err);
    }
  },
);

booksRouter.put(
  '/books/:id',
  requireAuth,
  requireRole('admin'),
  uploadCoverImage,
  validate(bookIdParamSchema, 'params'),
  validate(updateBookSchema),
  async (req, res, next) => {
    try {
      const coverImageUrl = req.file ? `/uploads/covers/${req.file.filename}` : undefined;
      const book = await updateBook(Number(req.params.id), { ...req.body, coverImageUrl });
      if (!book) throw new ApiError('Book not found', 'BOOK_NOT_FOUND', 404);
      res.json({ book });
    } catch (err) {
      next(err);
    }
  },
);

booksRouter.patch(
  '/books/:id/availability',
  requireAuth,
  requireRole('admin'),
  validate(bookIdParamSchema, 'params'),
  validate(availabilitySchema),
  async (req, res, next) => {
    try {
      const book = await updateAvailability(Number(req.params.id), req.body.availableCopies);
      if (!book) throw new ApiError('Book not found', 'BOOK_NOT_FOUND', 404);
      res.json({ book });
    } catch (err) {
      next(err);
    }
  },
);

booksRouter.delete(
  '/books/:id',
  requireAuth,
  requireRole('admin'),
  validate(bookIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const deleted = await deleteBook(Number(req.params.id));
      if (!deleted) throw new ApiError('Book not found', 'BOOK_NOT_FOUND', 404);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
