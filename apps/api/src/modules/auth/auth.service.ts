import { hash, verify } from '@node-rs/argon2';
import {
  DEFAULT_CATEGORIES,
  type LoginInput,
  type RegisterInput,
  type SettingsDTO,
  type UserDTO,
} from '@mizan/shared';
import { AppError, badRequest, conflict, unauthorized } from '../../lib/errors';
import { prisma, type User, type UserSettings } from '../../lib/prisma';
import { links, mailer } from './mailer';
import { randomToken, revokeAllForUser, sha256 } from './tokens';

// OWASP-recommended Argon2id parameters (m=19 MiB, t=2, p=1).
const ARGON_OPTS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const VERIFY_TTL_H = 48;
const RESET_TTL_MIN = 30;

// Used to keep login timing constant when the email does not exist.
let dummyHash: string | null = null;
async function getDummyHash() {
  dummyHash ??= await hash('not-a-real-password-123', ARGON_OPTS);
  return dummyHash;
}

export const hashPassword = (password: string) => hash(password, ARGON_OPTS);

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: !!u.emailVerifiedAt,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toSettingsDTO(s: UserSettings): SettingsDTO {
  return {
    baseCurrency: s.baseCurrency,
    timezone: s.timezone,
    locale: s.locale as SettingsDTO['locale'],
    weekStartsOn: (s.weekStartsOn === 0 ? 0 : 1) as 0 | 1,
    budgetAlerts: s.budgetAlerts,
  };
}

async function createAuthToken(userId: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET', ttlMs: number) {
  const token = randomToken();
  // Only one live token per purpose.
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.authToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

async function consumeAuthToken(token: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
    throw badRequest('This link is invalid or has expired. Request a new one.');
  }
  const claimed = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) throw badRequest('This link has already been used.');
  return row.userId;
}

export async function sendVerificationEmail(user: Pick<User, 'id' | 'email' | 'name'>) {
  const token = await createAuthToken(user.id, 'EMAIL_VERIFY', VERIFY_TTL_H * 3_600_000);
  await mailer.send({
    to: user.email,
    subject: 'Confirm your email for Mizan',
    text: `Hi ${user.name},\n\nConfirm your email address to secure your account:\n${links.verify(token)}\n\nThis link expires in ${VERIFY_TTL_H} hours.`,
  });
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email: input.email, name: input.name, passwordHash, settings: { create: {} } },
    });
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        userId: u.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        key: c.key,
        isDefault: true,
      })),
    });
    return u;
  });
  await sendVerificationEmail(user);
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId: user.id } });
  return { user, settings };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { settings: true } });
  if (!user) {
    await verify(await getDummyHash(), input.password).catch(() => false);
    throw unauthorized('Incorrect email or password');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in a few minutes.');
  }
  const ok = await verify(user.passwordHash, input.password).catch(() => false);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    throw unauthorized('Incorrect email or password');
  }
  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
  const settings = user.settings ?? (await prisma.userSettings.create({ data: { userId: user.id } }));
  return { user, settings };
}

export async function verifyEmail(token: string) {
  const userId = await consumeAuthToken(token, 'EMAIL_VERIFY');
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

/** Always resolves, whether or not the email exists, to prevent account enumeration. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const token = await createAuthToken(user.id, 'PASSWORD_RESET', RESET_TTL_MIN * 60_000);
  await mailer.send({
    to: user.email,
    subject: 'Reset your Mizan password',
    text: `Hi ${user.name},\n\nReset your password with this link:\n${links.reset(token)}\n\nIt expires in ${RESET_TTL_MIN} minutes. If you didn't ask for this, you can ignore this email.`,
  });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeAuthToken(token, 'PASSWORD_RESET');
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null },
  });
  await revokeAllForUser(userId); // sign out everywhere
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verify(user.passwordHash, currentPassword).catch(() => false);
  if (!ok) throw badRequest('Your current password is incorrect');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}

export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verify(user.passwordHash, password).catch(() => false);
  if (!ok) throw badRequest('Your password is incorrect');
  // Transactions reference accounts with RESTRICT, so remove them first.
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
