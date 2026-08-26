import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { listAdmins, listUsers } from '../repositories/users';

export const usersRouter = Router();

// Literal segment, so no ordering conflict with a future `/users/:id`.
usersRouter.get('/users/admins', requireAuth, async (_req, res, next) => {
  try {
    const admins = await listAdmins();
    res.json({ admins });
  } catch (err) {
    next(err);
  }
});

/** All users, admin-only — powers the admin Orders page's customer name/email lookups. */
usersRouter.get('/users', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});
