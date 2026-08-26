import { Router } from 'express';
import type { z } from 'zod';
import { ApiError } from '../errors/ApiError';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadCoverImage } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  createBook,
  deleteBook,
  getBookById,
  listBooks,
  updateAvailability,
  updateBook,
} from '../repositories/books';
import {
  availabilitySchema,
  bookIdParamSchema,
  createBookSchema,
  listBooksQuerySchema,
  updateBookSchema,
} from '../schemas/book';

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

// NOTE: registered before `/books/:id` so it isn't swallowed by the :id
// param match. Phase 5 implements the actual CSV export — keep this route
// ahead of `/books/:id` when that lands.
booksRouter.get('/books/export', (_req, _res, next) => {
  next(new ApiError('Not implemented yet — see Phase 5', 'NOT_IMPLEMENTED', 501));
});

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
