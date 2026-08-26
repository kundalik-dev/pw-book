import { z } from 'zod';

export const loanIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createLoanSchema = z.object({
  bookId: z.coerce.number().int().positive(),
});
