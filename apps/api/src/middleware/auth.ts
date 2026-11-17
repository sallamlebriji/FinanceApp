import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from '../lib/errors';

export interface AccessClaims {
  sub: string;
  typ: 'access';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ typ: 'access' }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
    issuer: 'mizan-api',
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'mizan-api' });
  if (typeof payload === 'string' || payload.typ !== 'access' || !payload.sub) throw unauthorized('Invalid token');
  return payload as AccessClaims;
}

/** Requires a valid Bearer access token and exposes `req.userId`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    req.userId = verifyAccessToken(header.slice(7)).sub;
    next();
  } catch {
    next(unauthorized('Your session has expired'));
  }
}

/** Narrowing helper for handlers mounted behind requireAuth. */
export function uid(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
