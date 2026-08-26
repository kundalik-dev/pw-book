import { Router } from 'express';
import { ApiError } from '../errors/ApiError';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from '../repositories/categories';
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from '../schemas/category';

export const categoriesRouter = Router();

categoriesRouter.get('/categories', async (_req, res, next) => {
  try {
    const categories = await listCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.get(
  '/categories/:id',
  validate(categoryIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const category = await getCategoryById(Number(req.params.id));
      if (!category) throw new ApiError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      res.json({ category });
    } catch (err) {
      next(err);
    }
  },
);

categoriesRouter.post(
  '/categories',
  requireAuth,
  requireRole('admin'),
  validate(createCategorySchema),
  async (req, res, next) => {
    try {
      const category = await createCategory(req.body);
      res.status(201).json({ category });
    } catch (err) {
      next(err);
    }
  },
);

categoriesRouter.put(
  '/categories/:id',
  requireAuth,
  requireRole('admin'),
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategorySchema),
  async (req, res, next) => {
    try {
      const category = await updateCategory(Number(req.params.id), req.body);
      if (!category) throw new ApiError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      res.json({ category });
    } catch (err) {
      next(err);
    }
  },
);

categoriesRouter.delete(
  '/categories/:id',
  requireAuth,
  requireRole('admin'),
  validate(categoryIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const deleted = await deleteCategory(Number(req.params.id));
      if (!deleted) throw new ApiError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
