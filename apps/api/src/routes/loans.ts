import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { borrowBook, listLoansForUser, listOverdueLoans, returnLoan } from '../repositories/loans';
import { createLoanSchema, loanIdParamSchema } from '../schemas/loan';

export const loansRouter = Router();

loansRouter.post('/loans', requireAuth, validate(createLoanSchema), async (req, res, next) => {
  try {
    const loan = await borrowBook(Number(req.user?.id), req.body.bookId);
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

loansRouter.put(
  '/loans/:id/return',
  requireAuth,
  validate(loanIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const loan = await returnLoan(Number(req.params.id), {
        id: Number(req.user?.id),
        role: req.user?.role ?? '',
      });
      res.json({ loan });
    } catch (err) {
      next(err);
    }
  },
);
