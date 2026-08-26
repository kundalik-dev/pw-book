import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';

// Matches the API's `{ error: { message, code } }` response shape (see CLAUDE.md).
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
};
