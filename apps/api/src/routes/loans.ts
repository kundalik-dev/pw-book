import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  borrowBook,
  type LoanExportRow,
  listAllLoans,
  listLoansForExport,
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
import { stringifyCsv } from '../utils/csv';

export const loansRouter = Router();

const LOAN_EXPORT_DATE_FIELDS = ['borrowedAt', 'dueAt', 'returnedAt'] as const;

function loanExportHeader(includeCustomer: boolean): string[] {
  return [
    'book',
    ...(includeCustomer ? ['customerName', 'customerEmail'] : []),
    'orderedOn',
    'returnBy',
    'returnedOn',
    'returnedTo',
    'status',
  ];
}

function loanExportRow(row: LoanExportRow, includeCustomer: boolean): string[] {
  const [orderedOn, returnBy, returnedOn] = LOAN_EXPORT_DATE_FIELDS.map((field) => {
    const value = row[field];
    return value ? value.toISOString().slice(0, 10) : '';
  });
  return [
    row.bookTitle,
    ...(includeCustomer ? [row.customerName, row.customerEmail] : []),
    orderedOn,
    returnBy,
    returnedOn,
    row.returnedToAdminName ?? '',
    row.status,
  ];
}

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

/** CSV download of the current user's own order history — the "My orders" page's export button. */
loansRouter.get('/loans/me/export', requireAuth, async (req, res, next) => {
  try {
    const rows = await listLoansForExport({ userId: Number(req.user?.id) });
    const csv = stringifyCsv([
      loanExportHeader(false),
      ...rows.map((row) => loanExportRow(row, false)),
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="my-orders-export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/** Admin-only CSV download of every order across every customer — the admin "All orders" page's export button. */
loansRouter.get('/loans/export', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const rows = await listLoansForExport();
    const csv = stringifyCsv([
      loanExportHeader(true),
      ...rows.map((row) => loanExportRow(row, true)),
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="all-orders-export.csv"');
    res.send(csv);
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
