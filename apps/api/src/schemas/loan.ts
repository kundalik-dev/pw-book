import { z } from 'zod';

export const loanIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Mirrors LOAN_PERIOD_DAYS in repositories/loans.ts — the cap for a caller-supplied `dueAt`. */
export const ORDER_RETURN_WINDOW_DAYS = 10;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const createLoanSchema = z.object({
  bookId: z.coerce.number().int().positive(),
  dueAt: z.coerce
    .date()
    .optional()
    .refine(
      (date) => {
        if (!date) return true;
        const min = startOfTodayUTC();
        const max = new Date(min.getTime() + ORDER_RETURN_WINDOW_DAYS * 86_400_000);
        return date.getTime() >= min.getTime() && date.getTime() <= max.getTime();
      },
      {
        message: `Return date must be between today and ${ORDER_RETURN_WINDOW_DAYS} days from today`,
      },
    ),
});

/** The admin the physical book is handed back to, picked from the Orders page's return modal. */
export const returnLoanSchema = z.object({
  receivedByAdminId: z.coerce.number().int().positive(),
});

/** Optional filters for the admin-only `GET /loans` all-orders listing. */
export const listLoansQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  bookId: z.coerce.number().int().positive().optional(),
});
