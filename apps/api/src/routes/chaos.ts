import { Router } from 'express';

export const chaosRouter = Router();

const DEFAULT_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const FLAKY_FAILURE_RATE = 0.3;

chaosRouter.get('/slow', (req, res) => {
  const requested = Number(req.query.ms);
  const delayMs = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 0), MAX_DELAY_MS)
    : DEFAULT_DELAY_MS;
  setTimeout(() => {
    res.json({ message: `Responded after ${delayMs}ms`, delayMs });
  }, delayMs);
});

chaosRouter.get('/flaky', (_req, res) => {
  if (Math.random() < FLAKY_FAILURE_RATE) {
    res
      .status(500)
      .json({ error: { message: 'Random failure — try again', code: 'FLAKY_FAILURE' } });
    return;
  }
  res.json({ message: 'ok' });
});
