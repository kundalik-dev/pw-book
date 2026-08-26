import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  borrowBook,
  listAllLoans,
  listLoansForUser,
  listOverdueLoans,
  returnLoan,
} from '../repositories/loans';
import {
  createLoanSchema,
  listLoansQuerySchema,
  loanIdParamSchema,
  returnLoanSchema,
} from '../schemas/loan';

export const loansRouter = Router();

loansRouter.post('/loans', requireAuth, validate(createLoanSchema), async (req, res, next) => {
  try {
    const loan = await borrowBook(Number(req.user?.id), req.body.bookId, req.body.dueAt);
    res.status(201).json({ loan });
  } catch (err) {
    next(err);
  }
});

// `/loans/me` and `/loans/overdue` are literal segments, so registration
// order relative to each other doesn't matter — but keep both ahead of any
// future `GET /loans/:id` so a numeric id route can't swallow them.
loansRouter.get('/loans/me', requireAuth, async (req, res, next) => {
  try {
    const loans = await listLoansForUser(Number(req.user?.id));
    res.json({ loans });
  } catch (err) {
    next(err);
  }
});

loansRouter.get('/loans/overdue', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const loans = await listOverdueLoans();
    res.json({ loans });
  } catch (err) {
    next(err);
  }
});

/**
 * Admin-only all-orders listing, optionally narrowed with `?userId=`/`?bookId=`
 * — powers the admin Orders page and its per-user / per-book history pages.
 */
loansRouter.get(
  '/loans',
  requireAuth,
  requireRole('admin'),
  validate(listLoansQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { userId, bookId } = req.query as { userId?: number; bookId?: number };
      const loans = await listAllLoans({ userId, bookId });
      res.json({ loans });
    } catch (err) {
      next(err);
    }
  },
);

loansRouter.put(
  '/loans/:id/return',
  requireAuth,
  validate(loanIdParamSchema, 'params'),
  validate(returnLoanSchema),
  async (req, res, next) => {
    try {
      const loan = await returnLoan(
        Number(req.params.id),
        { id: Number(req.user?.id), role: req.user?.role ?? '' },
        req.body.receivedByAdminId,
      );
      res.json({ loan });
    } catch (err) {
      next(err);
    }
  },
);
