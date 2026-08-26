import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { resetSystem } from '../services/resetService';

export const systemRouter = Router();

systemRouter.post('/system/reset', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const summary = await resetSystem();
    res.json({ message: 'Database reset to default seed state.', summary });
  } catch (err) {
    next(err);
  }
});
