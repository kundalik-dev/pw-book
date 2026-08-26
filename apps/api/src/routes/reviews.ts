import { Router } from 'express';
import { ApiError } from '../errors/ApiError';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getBookById } from '../repositories/books';
import {
  createReview,
  deleteReview,
  getReviewById,
  listReviewsForBook,
} from '../repositories/reviews';
import { bookIdParamSchema } from '../schemas/book';
import { createReviewSchema, reviewIdParamSchema } from '../schemas/review';

export const reviewsRouter = Router();

reviewsRouter.get(
  '/books/:id/reviews',
  validate(bookIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const bookId = Number(req.params.id);
      const book = await getBookById(bookId);
      if (!book) throw new ApiError('Book not found', 'BOOK_NOT_FOUND', 404);
      const reviews = await listReviewsForBook(bookId);
      res.json({ reviews });
    } catch (err) {
      next(err);
    }
  },
);

reviewsRouter.post(
  '/books/:id/reviews',
  requireAuth,
  validate(bookIdParamSchema, 'params'),
  validate(createReviewSchema),
  async (req, res, next) => {
    try {
      const bookId = Number(req.params.id);
      const book = await getBookById(bookId);
      if (!book) throw new ApiError('Book not found', 'BOOK_NOT_FOUND', 404);
      const review = await createReview({
        bookId,
        userId: Number(req.user?.id),
        rating: req.body.rating,
        comment: req.body.comment,
      });
      res.status(201).json({ review });
    } catch (err) {
      next(err);
    }
  },
);

reviewsRouter.delete(
  '/reviews/:id',
  requireAuth,
  validate(reviewIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const review = await getReviewById(Number(req.params.id));
      if (!review) throw new ApiError('Review not found', 'REVIEW_NOT_FOUND', 404);
      if (review.userId !== Number(req.user?.id) && req.user?.role !== 'admin') {
        throw new ApiError('You can only delete your own reviews', 'FORBIDDEN', 403);
      }
      await deleteReview(review.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
