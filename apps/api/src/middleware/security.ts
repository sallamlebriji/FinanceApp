import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { corsOrigins, env } from '../config/env';
import { forbidden } from '../lib/errors';

const skip = () => env.NODE_ENV === 'test';

/** Global limiter: generous, protects against floods. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } },
});

/** Strict limiter for credential endpoints (login, register, password reset). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again in a few minutes.' } },
});

/**
 * CSRF defence for cookie-authenticated endpoints (refresh/logout): the refresh cookie is
 * SameSite=Strict and scoped to /api/auth, and we additionally reject cross-origin browser
 * requests. Native clients send no Origin header.
 */
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (!origin || corsOrigins.includes(origin)) return next();
  next(forbidden('Untrusted origin'));
};
