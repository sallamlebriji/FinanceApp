import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
  type AuthResponse,
} from '@mizan/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { isProd } from '../../config/env';
import { notFound, unauthorized } from '../../lib/errors';
import { prisma, type User, type UserSettings } from '../../lib/prisma';
import { requireAuth, signAccessToken, uid } from '../../middleware/auth';
import { authLimiter, requireTrustedOrigin } from '../../middleware/security';
import * as auth from './auth.service';
import { issueRefreshToken, revokeAllForUser, revokeRefreshToken, rotateRefreshToken, sha256 } from './tokens';

export const REFRESH_COOKIE = 'mz_rt';
const COOKIE_PATH = '/api/auth';

/** Native apps (Expo) store the refresh token in SecureStore and send it in the body. */
const isNative = (req: Request) => req.get('x-client-platform') === 'native';
const meta = (req: Request) => ({ userAgent: req.get('user-agent'), ip: req.ip });

function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: isProd, sameSite: 'strict', path: COOKIE_PATH });
}

async function respondWithSession(req: Request, res: Response, user: User, settings: UserSettings, status = 200) {
  const refresh = await issueRefreshToken(user.id, meta(req));
  const body: AuthResponse = {
    user: auth.toUserDTO(user),
    settings: auth.toSettingsDTO(settings),
    accessToken: signAccessToken(user.id),
  };
  if (isNative(req)) body.refreshToken = refresh.token;
  else setRefreshCookie(res, refresh.token, refresh.expiresAt);
  res.status(status).json(body);
}

function readRefreshToken(req: Request): string | undefined {
  if (isNative(req)) return z.object({ refreshToken: z.string().min(20).max(200) }).safeParse(req.body).data?.refreshToken;
  return req.cookies?.[REFRESH_COOKIE];
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const { user, settings } = await auth.register(registerSchema.parse(req.body));
  await respondWithSession(req, res, user, settings, 201);
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { user, settings } = await auth.login(loginSchema.parse(req.body));
  await respondWithSession(req, res, user, settings);
});

authRouter.post('/refresh', requireTrustedOrigin, async (req, res) => {
  const raw = readRefreshToken(req);
  if (!raw) throw unauthorized('No active session');
  const result = await rotateRefreshToken(raw, meta(req));
  if (!result.ok) {
    clearRefreshCookie(res);
    throw unauthorized(result.reason === 'reused' ? 'Session revoked for your security. Sign in again.' : 'Your session has expired');
  }
  const user = await prisma.user.findUnique({ where: { id: result.userId }, include: { settings: true } });
  if (!user || !user.settings) throw unauthorized();
  const body: AuthResponse = {
    user: auth.toUserDTO(user),
    settings: auth.toSettingsDTO(user.settings),
    accessToken: signAccessToken(user.id),
  };
  if (isNative(req)) body.refreshToken = result.next.token;
  else setRefreshCookie(res, result.next.token, result.next.expiresAt);
  res.json(body);
});

authRouter.post('/logout', requireTrustedOrigin, async (req, res) => {
  const raw = readRefreshToken(req);
  if (raw) await revokeRefreshToken(raw);
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.post('/verify-email', async (req, res) => {
  await auth.verifyEmail(verifyEmailSchema.parse(req.body).token);
  res.json({ verified: true });
});

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  await auth.requestPasswordReset(forgotPasswordSchema.parse(req.body).email);
  res.json({ message: 'If an account exists for this email, a reset link is on its way.' });
});

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await auth.resetPassword(token, password);
  clearRefreshCookie(res);
  res.json({ reset: true });
});

/* ---------- authenticated ---------- */

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: uid(req) }, include: { settings: true } });
  if (!user || !user.settings) throw notFound('User');
  res.json({ user: auth.toUserDTO(user), settings: auth.toSettingsDTO(user.settings) });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const data = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: uid(req) }, data });
  res.json({ user: auth.toUserDTO(user) });
});

authRouter.post('/resend-verification', requireAuth, authLimiter, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (!user.emailVerifiedAt) await auth.sendVerificationEmail(user);
  res.json({ sent: !user.emailVerifiedAt });
});

authRouter.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const userId = uid(req);
  await auth.changePassword(userId, currentPassword, newPassword);
  // Keep the current session, sign out every other device.
  const current = readRefreshToken(req);
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, ...(current ? { NOT: { tokenHash: sha256(current) } } : {}) },
    data: { revokedAt: new Date() },
  });
  res.json({ changed: true });
});

authRouter.get('/sessions', requireAuth, async (req, res) => {
  const current = readRefreshToken(req);
  const currentHash = current ? sha256(current) : null;
  const sessions = await prisma.refreshToken.findMany({
    where: { userId: uid(req), revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    items: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
      current: s.tokenHash === currentHash,
    })),
  });
});

authRouter.delete('/sessions/:id', requireAuth, async (req, res) => {
  const r = await prisma.refreshToken.updateMany({
    where: { id: String(req.params.id), userId: uid(req), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (r.count === 0) throw notFound('Session');
  res.status(204).end();
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await revokeAllForUser(uid(req));
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.delete('/me', requireAuth, authLimiter, async (req, res) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
  await auth.deleteAccount(uid(req), password);
  clearRefreshCookie(res);
  res.status(204).end();
});
