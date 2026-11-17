import {
  dueOccurrences,
  money,
  recurringCreateSchema,
  recurringUpdateSchema,
  todayInTimeZone,
  type Frequency,
  type RecurringCreateInput,
  type RecurringDTO,
  type RecurringUpdateInput,
} from '@mizan/shared';
import { badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma, type Prisma } from '../../lib/prisma';
import { amount, dateValue, isoDate } from '../../lib/serialize';
import { evaluateBudgetAlerts } from '../budgets/budgets.service';
import { resolveTransaction } from '../transactions/transactions.service';

const include = {
  account: { select: { id: true, name: true, color: true } },
  toAccount: { select: { id: true, name: true, color: true } },
  category: { select: { id: true, name: true, icon: true, color: true } },
} as const satisfies Prisma.RecurringTransactionInclude;

type Row = Prisma.RecurringTransactionGetPayload<{ include: typeof include }>;

const PER_MONTH: Record<Frequency, number> = { DAILY: 365 / 12, WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };

function toDTO(r: Row): RecurringDTO {
  const ended = !r.isActive || (!!r.endDate && r.nextDate > r.endDate);
  return {
    id: r.id,
    type: r.type,
    amount: amount(r.amount),
    currency: r.currency,
    description: r.description,
    paymentMethod: r.paymentMethod,
    frequency: r.frequency,
    interval: r.interval,
    startDate: isoDate(r.startDate),
    endDate: isoDate(r.endDate),
    nextDate: ended ? null : isoDate(r.nextDate),
    isActive: r.isActive,
    account: r.account,
    toAccount: r.toAccount,
    category: r.category,
    monthlyAmount: money(r.amount.toString()).times(PER_MONTH[r.frequency]).div(r.interval).toDecimalPlaces(2).toFixed(2),
  };
}

export async function listRecurring(userId: string) {
  const rows = await prisma.recurringTransaction.findMany({ where: { userId }, include, orderBy: [{ isActive: 'desc' }, { nextDate: 'asc' }] });
  return rows.map(toDTO);
}

async function owned(userId: string, id: string) {
  const r = await prisma.recurringTransaction.findFirst({ where: { id, userId }, include });
  if (!r) throw notFound('Recurring transaction');
  return r;
}

export async function createRecurring(userId: string, raw: RecurringCreateInput) {
  const input = recurringCreateSchema.parse(raw);
  const resolved = await prisma.$transaction((db) =>
    resolveTransaction(db, userId, {
      type: input.type,
      amount: input.amount,
      accountId: input.accountId,
      toAccountId: input.type === 'TRANSFER' ? input.toAccountId : null,
      // No credited amount: a recurring transfer repeats one amount, so both accounts must
      // share a currency (the resolver rejects a cross-currency pair without it).
      toAmount: null,
      categoryId: input.type === 'TRANSFER' ? null : input.categoryId,
    }),
  );
  const row = await prisma.recurringTransaction.create({
    data: {
      userId,
      type: resolved.type,
      amount: resolved.amount,
      currency: resolved.currency,
      accountId: resolved.accountId,
      toAccountId: resolved.toAccountId,
      categoryId: resolved.categoryId,
      description: input.description,
      paymentMethod: input.paymentMethod ?? null,
      frequency: input.frequency,
      interval: input.interval,
      startDate: dateValue(input.startDate),
      endDate: input.endDate ? dateValue(input.endDate) : null,
      nextDate: dateValue(input.startDate),
      anchorDay: Number(input.startDate.slice(8, 10)),
    },
  });
  await generateForUser(userId);
  return toDTO(await owned(userId, row.id));
}

export async function updateRecurring(userId: string, id: string, raw: RecurringUpdateInput) {
  const input = recurringUpdateSchema.parse(raw);
  const current = await owned(userId, id);
  if (input.categoryId) {
    if (current.type === 'TRANSFER') throw badRequest('Transfers have no category');
    const c = await prisma.category.findFirst({ where: { id: input.categoryId, userId } });
    if (!c) throw notFound('Category');
    if (c.type !== current.type) throw badRequest(`Choose ${current.type === 'INCOME' ? 'an income' : 'an expense'} category`);
  }
  if (input.endDate && input.endDate < isoDate(current.startDate)) throw badRequest('The end date must be after the start date');
  await prisma.recurringTransaction.update({
    where: { id },
    data: {
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? dateValue(input.endDate) : null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  // Resuming a paused rule catches up on occurrences missed meanwhile.
  if (input.isActive) await generateForUser(userId);
  return toDTO(await owned(userId, id));
}

/** Deleting a rule keeps the transactions it already created (their link is cleared). */
export async function deleteRecurring(userId: string, id: string) {
  const r = await prisma.recurringTransaction.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw notFound('Recurring transaction');
}

/**
 * Creates every due occurrence up to today (in the user's time zone). Idempotent: the unique
 * (recurringId, recurrenceDate) key means a retry or a concurrent run can't double-post.
 */
export async function generateForUser(userId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { timezone: true } });
  const today = todayInTimeZone(settings?.timezone);
  const rules = await prisma.recurringTransaction.findMany({
    where: { userId, isActive: true, nextDate: { lte: dateValue(today) } },
    include: { account: { select: { isArchived: true } }, toAccount: { select: { isArchived: true } } },
  });
  let created = 0;
  let expenses = false;
  for (const r of rules) {
    // Paused implicitly while an account is archived; catches up once it's restored.
    if (r.account.isArchived || r.toAccount?.isArchived) continue;
    const due = dueOccurrences(
      { nextDate: isoDate(r.nextDate), frequency: r.frequency, interval: r.interval, anchorDay: r.anchorDay, endDate: isoDate(r.endDate) },
      today,
    );
    await prisma.$transaction(async (db) => {
      if (due.dates.length) {
        const res = await db.transaction.createMany({
          skipDuplicates: true,
          data: due.dates.map((d) => ({
            userId,
            type: r.type,
            amount: r.amount,
            currency: r.currency,
            date: dateValue(d),
            description: r.description,
            paymentMethod: r.paymentMethod,
            accountId: r.accountId,
            toAccountId: r.toAccountId,
            toAmount: r.type === 'TRANSFER' ? r.amount : null,
            toCurrency: r.type === 'TRANSFER' ? r.currency : null,
            categoryId: r.categoryId,
            recurringId: r.id,
            recurrenceDate: dateValue(d),
          })),
        });
        created += res.count;
        if (r.type === 'EXPENSE' && res.count) expenses = true;
      }
      await db.recurringTransaction.update({
        where: { id: r.id },
        data: { nextDate: dateValue(due.next), ...(due.finished ? { isActive: false } : {}) },
      });
    });
  }
  if (expenses) await evaluateBudgetAlerts(userId);
  return created;
}

/** Runs the generator for every user with something due. Safe to run from several processes. */
export async function generateAll() {
  // The earliest time zone on Earth: anything due anywhere today is picked up.
  const users = await prisma.recurringTransaction.findMany({
    where: { isActive: true, nextDate: { lte: dateValue(todayInTimeZone('Pacific/Kiritimati')) } },
    select: { userId: true },
    distinct: ['userId'],
  });
  let total = 0;
  for (const u of users) {
    try {
      total += await generateForUser(u.userId);
    } catch (err) {
      logger.error({ err, userId: u.userId }, 'Recurring generation failed');
    }
  }
  if (total) logger.info({ created: total }, 'Recurring transactions generated');
  return total;
}
