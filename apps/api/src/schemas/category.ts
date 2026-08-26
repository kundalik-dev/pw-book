import { z } from 'zod';

export const categoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
});

export const updateCategorySchema = createCategorySchema;
