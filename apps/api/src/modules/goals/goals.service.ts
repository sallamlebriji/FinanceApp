import {
  contributionCreateSchema,
  goalCreateSchema,
  goalUpdateSchema,
  money,
  monthlyNeeded,
  savingsProgress,
  todayInTimeZone,
  type GoalCreateInput,
  type GoalUpdateInput,
  type SavingsGoalDTO,
} from '@mizan/shared';
import { badRequest, notFound } from '../../lib/errors';
import { prisma, type SavingsContribution, type SavingsGoal } from '../../lib/prisma';
import { amount, dateValue, isoDate } from '../../lib/serialize';

type GoalRow = SavingsGoal & { contributions: Pick<SavingsContribution, 'id' | 'amount' | 'date' | 'note'>[] };

export function toGoalDTO(g: GoalRow, today: string, withContributions = false): SavingsGoalDTO {
  const saved = g.contributions.reduce((s, c) => s.plus(c.amount.toString()), money(0));
  const p = savingsProgress(g.targetAmount.toString(), saved);
  const needed = monthlyNeeded(p.remaining, today, isoDate(g.deadline));
  return {
    id: g.id,
    name: g.name,
    targetAmount: amount(g.targetAmount),
    currency: g.currency,
    deadline: isoDate(g.deadline),
    icon: g.icon,
    color: g.color,
    archived: !!g.archivedAt,
    saved: p.current.toFixed(2),
    remaining: p.remaining.toFixed(2),
    percent: p.percent.toFixed(1),
    completed: p.completed,
    monthlyNeeded: needed?.toFixed(2) ?? null,
    ...(withContributions
      ? {
          contributions: [...g.contributions]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map((c) => ({ id: c.id, amount: amount(c.amount), date: isoDate(c.date), note: c.note })),
        }
      : {}),
  };
}

const include = {
  contributions: { select: { id: true, amount: true, date: true, note: true }, orderBy: { date: 'desc' } },
} as const;

async function today(userId: string) {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { timezone: true } });
  return todayInTimeZone(s?.timezone);
}

export async function listGoals(userId: string, includeArchived = false) {
  const [goals, t] = await Promise.all([
    prisma.savingsGoal.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      include,
      orderBy: { createdAt: 'asc' },
    }),
    today(userId),
  ]);
  return goals.map((g) => toGoalDTO(g, t));
}

async function owned(userId: string, id: string) {
  const g = await prisma.savingsGoal.findFirst({ where: { id, userId }, include });
  if (!g) throw notFound('Savings goal');
  return g;
}

export async function getGoal(userId: string, id: string) {
  return toGoalDTO(await owned(userId, id), await today(userId), true);
}

export async function createGoal(userId: string, raw: GoalCreateInput) {
  const input = goalCreateSchema.parse(raw);
  const g = await prisma.savingsGoal.create({
    data: { ...input, deadline: input.deadline ? dateValue(input.deadline) : null, userId },
    include,
  });
  return toGoalDTO(g, await today(userId), true);
}

export async function updateGoal(userId: string, id: string, raw: GoalUpdateInput) {
  const { archived, deadline, ...rest } = goalUpdateSchema.parse(raw);
  await owned(userId, id);
  const g = await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...rest,
      ...(deadline !== undefined ? { deadline: deadline ? dateValue(deadline) : null } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
    },
    include,
  });
  return toGoalDTO(g, await today(userId), true);
}

export async function deleteGoal(userId: string, id: string) {
  const r = await prisma.savingsGoal.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw notFound('Savings goal');
}

export async function addContribution(userId: string, goalId: string, raw: unknown) {
  const input = contributionCreateSchema.parse(raw);
  const g = await owned(userId, goalId);
  const saved = g.contributions.reduce((s, c) => s.plus(c.amount.toString()), money(0));
  const value = money(input.amount);
  if (input.kind === 'WITHDRAWAL' && value.gt(saved)) {
    throw badRequest(`You can withdraw at most ${saved.toFixed(2)} ${g.currency} from this goal`);
  }
  await prisma.savingsContribution.create({
    data: {
      goalId,
      amount: (input.kind === 'WITHDRAWAL' ? value.negated() : value).toFixed(2),
      date: dateValue(input.date),
      note: input.note ?? null,
    },
  });
  return getGoal(userId, goalId);
}

export async function deleteContribution(userId: string, goalId: string, contributionId: string) {
  const g = await owned(userId, goalId);
  const c = g.contributions.find((x) => x.id === contributionId);
  if (!c) throw notFound('Contribution');
  // Removing a deposit must not leave the goal with a negative balance.
  const after = g.contributions.reduce((s, x) => (x.id === c.id ? s : s.plus(x.amount.toString())), money(0));
  if (after.isNegative()) throw badRequest('Remove the later withdrawal first — the goal would go below zero');
  await prisma.savingsContribution.delete({ where: { id: contributionId } });
  return getGoal(userId, goalId);
}
