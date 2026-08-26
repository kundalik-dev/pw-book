import { Router } from 'express';
import { ApiError } from '../errors/ApiError';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createAuthor,
  deleteAuthor,
  getAuthorById,
  listAuthors,
  updateAuthor,
} from '../repositories/authors';
import { authorIdParamSchema, createAuthorSchema, updateAuthorSchema } from '../schemas/author';

export const authorsRouter = Router();

authorsRouter.get('/authors', async (_req, res, next) => {
  try {
    const authors = await listAuthors();
    res.json({ authors });
  } catch (err) {
    next(err);
  }
});

authorsRouter.get(
  '/authors/:id',
  validate(authorIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const author = await getAuthorById(Number(req.params.id));
      if (!author) throw new ApiError('Author not found', 'AUTHOR_NOT_FOUND', 404);
      res.json({ author });
    } catch (err) {
      next(err);
    }
  },
);

authorsRouter.post(
  '/authors',
  requireAuth,
  requireRole('admin'),
  validate(createAuthorSchema),
  async (req, res, next) => {
    try {
      const author = await createAuthor(req.body);
      res.status(201).json({ author });
    } catch (err) {
      next(err);
    }
  },
);

authorsRouter.put(
  '/authors/:id',
  requireAuth,
  requireRole('admin'),
  validate(authorIdParamSchema, 'params'),
  validate(updateAuthorSchema),
  async (req, res, next) => {
    try {
      const author = await updateAuthor(Number(req.params.id), req.body);
      if (!author) throw new ApiError('Author not found', 'AUTHOR_NOT_FOUND', 404);
      res.json({ author });
    } catch (err) {
      next(err);
    }
  },
);

authorsRouter.delete(
  '/authors/:id',
  requireAuth,
  requireRole('admin'),
  validate(authorIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const deleted = await deleteAuthor(Number(req.params.id));
      if (!deleted) throw new ApiError('Author not found', 'AUTHOR_NOT_FOUND', 404);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
