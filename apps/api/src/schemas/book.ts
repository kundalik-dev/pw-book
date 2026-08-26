import { z } from 'zod';

export const bookIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Multipart form fields arrive as strings (and `categoryIds` may show up as a
// single value, a repeated field, or a comma-separated string), so normalize
// before coercing each entry to a number.
function normalizeCategoryIds(val: unknown): unknown {
  if (val === undefined || val === null || val === '') return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return val;
}

const categoryIdsSchema = z.preprocess(
  normalizeCategoryIds,
  z.array(z.coerce.number().int().positive()),
);

export const createBookSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(300),
  isbn: z.string().trim().min(1, 'isbn is required').max(20),
  authorId: z.coerce.number().int().positive(),
  categoryIds: categoryIdsSchema.default([]),
  description: z.string().trim().max(8000).optional(),
  publishedYear: z.coerce.number().int().min(0).max(9999).optional(),
  totalCopies: z.coerce.number().int().min(0).default(1),
});

export const updateBookSchema = createBookSchema;

export const availabilitySchema = z.object({
  availableCopies: z.coerce.number().int().min(0),
});

export const listBooksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['title', '-title', 'publishedYear', '-publishedYear', 'createdAt', '-createdAt'])
    .default('title'),
  category: z.coerce.number().int().positive().optional(),
  author: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().optional(),
  available: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().trim().min(1).max(200).optional(),
});
