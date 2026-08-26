import { z } from 'zod';

export const authorIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createAuthorSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  bio: z.string().trim().max(4000).optional(),
});

export const updateAuthorSchema = createAuthorSchema;
