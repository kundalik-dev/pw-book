import { Router } from 'express';
import { isDbConnected } from '../db/pool';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/health/db', (_req, res) => {
  const connected = isDbConnected();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    dbConnected: connected,
  });
});
