import {
  debtCreateSchema,
  debtPaymentCreateSchema,
  debtRemaining,
  debtUpdateSchema,
  money,
  todayInTimeZone,
  type Currency,
  type DebtCreateInput,
  type DebtDTO,
  type DebtUpdateInput,
} from '@mizan/shared';
import { badRequest, notFound } from '../../lib/errors';
import { prisma, type Prisma, type Tx } from '../../lib/prisma';
import { amount, dateValue, isoDate } from '../../lib/serialize';

/*
 * A debt optionally moves real money: borrowing credits an account, lending debits one, and
 * each repayment does the opposite. Those transactions carry `debtId`, so balances stay right
 * while income/expense reports ignore them (a loan is not income). Net worth subtracts what
 * you still owe and adds what you're still owed, so taking a loan leaves net worth unchanged.
 */

const include = {
  payments: {
    orderBy: { date: 'desc' },
    include: { transaction: { select: { account: { select: { id: true, name: true } } } } },
  },
  transactions: {
    where: { debtPayment: null },
    select: { account: { select: { id: true, name: true } } },
    take: 1,
  },
} as const satisfies Prisma.DebtInclude;

type DebtRow = Prisma.DebtGetPayload<{ include: typeof include }>;

export function toDebtDTO(d: DebtRow, today: string, withPayments = false): DebtDTO {
  const r = debtRemaining(
    d.principal.toString(),
    d.payments.map((p) => p.amount.toString()),
  );
  const principal = money(d.principal.toString());
  const due = isoDate(d.dueDate);
  return {
    id: d.id,
    direction: d.direction,
    counterparty: d.counterparty,
    principal: amount(d.principal),
    currency: d.currency,
    startDate: isoDate(d.startDate),
    dueDate: due,
    note: d.note,
    paid: r.paid.toFixed(2),
    remaining: r.remaining.toFixed(2),
    percent: principal.isZero() ? '0.0' : r.paid.div(principal).times(100).toDecimalPlaces(1).toFixed(1),
    settled: r.settled,
    overdue: !r.settled && !!due && due < today,
    account: d.transactions[0]?.account ?? null,
    ...(withPayments
      ? {
          payments: d.payments.map((p) => ({
            id: p.id,
            amount: amount(p.amount),
            date: isoDate(p.date),
            note: p.note,
            account: p.transaction?.account ?? null,
          })),
        }
      : {}),
  };
}

async function today(userId: string) {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { timezone: true } });
  return todayInTimeZone(s?.timezone);
}

export async function listDebts(userId: string, includeSettled = true) {
  const [rows, t] = await Promise.all([
    prisma.debt.findMany({
      where: { userId, ...(includeSettled ? {} : { settledAt: null }) },
      include,
      orderBy: [{ settledAt: 'asc' }, { createdAt: 'desc' }],
    }),
    today(userId),
  ]);
  return rows.map((d) => toDebtDTO(d, t));
}

async function owned(userId: string, id: string, db: Tx | typeof prisma = prisma) {
  const d = await db.debt.findFirst({ where: { id, userId }, include });
  if (!d) throw notFound('Debt');
  return d;
}

export async function getDebt(userId: string, id: string) {
  return toDebtDTO(await owned(userId, id), await today(userId), true);
}

/** The account must belong to the user, be active, and hold the debt's currency. */
async function assertAccount(db: Tx, userId: string, accountId: string, currency: Currency) {
  const a = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!a) throw notFound('Account');
  if (a.isArchived) throw badRequest('This account is archived — restore it or pick another one');
  if (a.currency !== currency) throw badRequest(`Pick an account in ${currency} — this debt is in ${currency}`);
}

export async function createDebt(userId: string, raw: DebtCreateInput) {
  const input = debtCreateSchema.parse(raw);
  const id = await prisma.$transaction(async (db) => {
    if (input.accountId) await assertAccount(db, userId, input.accountId, input.currency);
    const d = await db.debt.create({
      data: {
        userId,
        direction: input.direction,
        counterparty: input.counterparty,
        principal: input.principal,
        currency: input.currency,
        startDate: dateValue(input.startDate),
        dueDate: input.dueDate ? dateValue(input.dueDate) : null,
        note: input.note ?? null,
      },
    });
    if (input.accountId) {
      await db.transaction.create({
        data: {
          userId,
          debtId: d.id,
          type: input.direction === 'BORROWED' ? 'INCOME' : 'EXPENSE',
          amount: input.principal,
          currency: input.currency,
          date: dateValue(input.startDate),
          description: input.direction === 'BORROWED' ? `Loan from ${input.counterparty}` : `Loan to ${input.counterparty}`,
          accountId: input.accountId,
        },
      });
    }
    return d.id;
  });
  return getDebt(userId, id);
}

export async function updateDebt(userId: string, id: string, raw: DebtUpdateInput) {
  const input = debtUpdateSchema.parse(raw);
  await owned(userId, id);
  await prisma.debt.update({
    where: { id },
    data: {
      ...(input.counterparty !== undefined ? { counterparty: input.counterparty } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? dateValue(input.dueDate) : null } : {}),
    },
  });
  return getDebt(userId, id);
}

/** Deleting a debt also removes the account movements it created, restoring balances. */
export async function deleteDebt(userId: string, id: string) {
  await prisma.$transaction(async (db) => {
    await owned(userId, id, db);
    await db.transaction.deleteMany({ where: { userId, debtId: id } });
    await db.debt.delete({ where: { id } });
  });
}

async function syncSettled(db: Tx, d: DebtRow) {
  const fresh = await db.debtPayment.findMany({ where: { debtId: d.id }, select: { amount: true } });
  const r = debtRemaining(d.principal.toString(), fresh.map((p) => p.amount.toString()));
  if (r.settled !== !!d.settledAt) {
    await db.debt.update({ where: { id: d.id }, data: { settledAt: r.settled ? new Date() : null } });
  }
}

export async function addPayment(userId: string, debtId: string, raw: unknown) {
  const input = debtPaymentCreateSchema.parse(raw);
  await prisma.$transaction(async (db) => {
    const d = await owned(userId, debtId, db);
    const r = debtRemaining(d.principal.toString(), d.payments.map((p) => p.amount.toString()));
    if (money(input.amount).gt(r.remaining)) {
      throw badRequest(`Only ${r.remaining.toFixed(2)} ${d.currency} is left on this debt`);
    }
    let transactionId: string | null = null;
    if (input.accountId) {
      await assertAccount(db, userId, input.accountId, d.currency);
      const t = await db.transaction.create({
        data: {
          userId,
          debtId: d.id,
          type: d.direction === 'BORROWED' ? 'EXPENSE' : 'INCOME',
          amount: input.amount,
          currency: d.currency,
          date: dateValue(input.date),
          description: d.direction === 'BORROWED' ? `Repayment to ${d.counterparty}` : `Repayment from ${d.counterparty}`,
          accountId: input.accountId,
        },
      });
      transactionId = t.id;
    }
    await db.debtPayment.create({
      data: { debtId, amount: input.amount, date: dateValue(input.date), note: input.note ?? null, transactionId },
    });
    await syncSettled(db, d);
  });
  return getDebt(userId, debtId);
}

export async function deletePayment(userId: string, debtId: string, paymentId: string) {
  await prisma.$transaction(async (db) => {
    const d = await owned(userId, debtId, db);
    const p = d.payments.find((x) => x.id === paymentId);
    if (!p) throw notFound('Payment');
    await db.debtPayment.delete({ where: { id: p.id } });
    if (p.transactionId) await db.transaction.delete({ where: { id: p.transactionId } });
    await syncSettled(db, d);
  });
  return getDebt(userId, debtId);
}

/** Outstanding amounts for net worth. */
export async function outstandingDebts(userId: string) {
  const rows = await prisma.debt.findMany({
    where: { userId, settledAt: null },
    select: { principal: true, currency: true, direction: true, payments: { select: { amount: true } } },
  });
  return rows.map((d) => ({
    currency: d.currency,
    direction: d.direction,
    remaining: debtRemaining(d.principal.toString(), d.payments.map((p) => p.amount.toString())).remaining,
  }));
}
