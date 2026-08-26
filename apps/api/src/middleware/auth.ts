import type { RequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';
import { type Role, verifyAccessToken } from '../utils/jwt';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    next(new ApiError('Missing or invalid Authorization header', 'UNAUTHORIZED', 401));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new ApiError('Invalid or expired access token', 'UNAUTHORIZED', 401));
  }
};

/** For Phase 4+ routes to restrict by role, e.g. `requireRole('admin')`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ApiError('Insufficient permissions', 'FORBIDDEN', 403));
      return;
    }
    next();
  };
}
