import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../errors/ApiError';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Request-validation middleware pattern for Phase 3+ routes to consume, e.g.
 * `router.post('/auth/register', validate(registerSchema), handler)`.
 */
export function validate(schema: ZodType, part: RequestPart = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(', ');
      next(new ApiError(message, 'VALIDATION_ERROR', 400));
      return;
    }
    req[part] = result.data;
    next();
  };
}
