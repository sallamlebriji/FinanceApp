import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');

export interface IssuedRefreshToken {
  token: string;
  id: string;
  expiresAt: Date;
}

export async function issueRefreshToken(
  userId: string,
  meta: { userAgent?: string; ip?: string },
  familyId?: string,
): Promise<IssuedRefreshToken> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      familyId: familyId ?? randomToken().slice(0, 24),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255),
      ip: meta.ip?.slice(0, 64),
    },
  });
  return { token, id: row.id, expiresAt };
}

export type RotateResult =
  | { ok: true; userId: string; next: IssuedRefreshToken }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' };

/**
 * Rotates a refresh token. Presenting an already-rotated token means it was stolen or
 * replayed: the whole token family is revoked and the user must sign in again.
 */
export async function rotateRefreshToken(raw: string, meta: { userAgent?: string; ip?: string }): Promise<RotateResult> {
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!existing) return { ok: false, reason: 'unknown' };
  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, reason: 'reused' };
  }
  if (existing.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  // Atomically claim the token so two concurrent refreshes cannot both succeed.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date(), lastUsedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: 'reused' };

  const next = await issueRefreshToken(existing.userId, meta, existing.familyId);
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { replacedById: next.id } });
  return { ok: true, userId: existing.userId, next };
}

export async function revokeRefreshToken(raw: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
