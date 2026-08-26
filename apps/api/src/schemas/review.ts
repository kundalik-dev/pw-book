import { z } from 'zod';

export const reviewIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(4000).optional(),
});
