import { Router } from 'express';
import { ApiError } from '../errors/ApiError';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from '../schemas/auth';
import * as authService from '../services/authService';

export const authRouter = Router();

authRouter.post('/auth/register', validate(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/auth/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/auth/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/auth/logout', validate(logoutSchema), async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.user)
      throw new ApiError('Missing or invalid Authorization header', 'UNAUTHORIZED', 401);
    const user = await authService.getUserById(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
