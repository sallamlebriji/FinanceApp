import {
  money,
  todayInTimeZone,
  transactionCreateSchema,
  transactionQuerySchema,
  transactionUpdateSchema,
  type Paginated,
  type TransactionCreateInput,
  type TransactionDTO,
  type TransactionQuery,
  type TransactionUpdateInput,
} from '@mizan/shared';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma, type Prisma, type Tx } from '../../lib/prisma';
import { amount, dateValue, isoDate } from '../../lib/serialize';
import { evaluateBudgetAlerts } from '../budgets/budgets.service';

export const transactionInclude = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  account: { select: { id: true, name: true, color: true } },
  toAccount: { select: { id: true, name: true, color: true } },
} as const;

type TxRow = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;

export function toTransactionDTO(t: TxRow): TransactionDTO {
  return {
    id: t.id,
    type: t.type,
    amount: amount(t.amount),
    currency: t.currency,
    date: isoDate(t.date),
    description: t.description,
    note: t.note,
    paymentMethod: t.paymentMethod,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    toAmount: amount(t.toAmount),
    toCurrency: t.toCurrency,
    exchangeRate: t.exchangeRate ? money(t.exchangeRate.toString()).toFixed() : null,
    categoryId: t.categoryId,
    category: t.category,
    account: t.account,
    toAccount: t.toAccount,
    debtId: t.debtId,
    createdAt: t.createdAt.toISOString(),
  };
}

interface Resolved {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: string;
  currency: 'MAD' | 'EUR' | 'USD';
  accountId: string;
  toAccountId: string | null;
  toAmount: string | null;
  toCurrency: 'MAD' | 'EUR' | 'USD' | null;
  exchangeRate: string | null;
  categoryId: string | null;
}

/**
 * Validates ownership and business rules, and resolves currency fields. A transfer between
 * accounts in different currencies requires the credited amount; the implied rate is
 * stored on the row and recorded in the exchange-rate history.
 */
export async function resolveTransaction(
  db: Tx,
  userId: string,
  v: {
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    amount: string;
    accountId: string;
    toAccountId?: string | null;
    toAmount?: string | null;
    categoryId?: string | null;
  },
): Promise<Resolved> {
  const account = await db.account.findFirst({ where: { id: v.accountId, userId } });
  if (!account) throw notFound('Account');
  if (account.isArchived) throw badRequest('This account is archived. Restore it to add transactions.');

  if (v.type === 'TRANSFER') {
    if (!v.toAccountId) throw badRequest('Choose the destination account');
    if (v.toAccountId === v.accountId) throw badRequest('Choose two different accounts');
    const to = await db.account.findFirst({ where: { id: v.toAccountId, userId } });
    if (!to) throw notFound('Destination account');
    if (to.isArchived) throw badRequest('The destination account is archived');
    let toAmount = v.amount;
    let rate: string | null = null;
    if (to.currency !== account.currency) {
      if (!v.toAmount) {
        throw badRequest(`Enter the amount received in ${to.currency}`, { field: 'toAmount' });
      }
      toAmount = v.toAmount;
      rate = money(toAmount).div(v.amount).toDecimalPlaces(8).toFixed();
    }
    return {
      type: 'TRANSFER',
      amount: v.amount,
      currency: account.currency,
      accountId: account.id,
      toAccountId: to.id,
      toAmount,
      toCurrency: to.currency,
      exchangeRate: rate,
      categoryId: null,
    };
  }

  if (v.categoryId) {
    const c = await db.category.findFirst({ where: { id: v.categoryId, userId } });
    if (!c) throw notFound('Category');
    if (c.type !== v.type) throw badRequest(`Choose ${v.type === 'INCOME' ? 'an income' : 'an expense'} category`);
  }
  return {
    type: v.type,
    amount: v.amount,
    currency: account.currency,
    accountId: account.id,
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
    exchangeRate: null,
    categoryId: v.categoryId ?? null,
  };
}

async function recordTransferRate(db: Tx, userId: string, r: Resolved, date: string) {
  if (!r.exchangeRate || !r.toCurrency) return;
  await db.exchangeRate.upsert({
    where: { userId_base_quote_date: { userId, base: r.currency, quote: r.toCurrency, date: dateValue(date) } },
    create: { userId, base: r.currency, quote: r.toCurrency, rate: r.exchangeRate, date: dateValue(date), source: 'transfer' },
    update: { rate: r.exchangeRate, source: 'transfer' },
  });
}

export async function createTransaction(userId: string, raw: TransactionCreateInput): Promise<TransactionDTO> {
  const input = transactionCreateSchema.parse(raw);
  const row = await prisma.$transaction(async (db) => {
    const r = await resolveTransaction(db, userId, {
      ...input,
      toAccountId: input.type === 'TRANSFER' ? input.toAccountId : null,
      toAmount: input.type === 'TRANSFER' ? input.toAmount : null,
      categoryId: input.type !== 'TRANSFER' ? input.categoryId : null,
    });
    await recordTransferRate(db, userId, r, input.date);
    return db.transaction.create({
      data: {
        userId,
        ...r,
        date: dateValue(input.date),
        description: input.description,
        note: input.note ?? null,
        paymentMethod: input.paymentMethod ?? null,
      },
      include: transactionInclude,
    });
  });
  if (row.type === 'EXPENSE') await evaluateBudgetAlerts(userId);
  return toTransactionDTO(row);
}

async function getOwned(userId: string, id: string) {
  const t = await prisma.transaction.findFirst({ where: { id, userId }, include: transactionInclude });
  if (!t) throw notFound('Transaction');
  return t;
}

/** Loan and repayment rows are owned by their debt; changing them here would desync it. */
function assertNotDebtRow(t: { debtId: string | null }) {
  if (t.debtId) throw conflict('This entry belongs to a debt — change it from Debts');
}

export async function getTransaction(userId: string, id: string) {
  return toTransactionDTO(await getOwned(userId, id));
}

/** The type of a transaction is immutable; everything else can change. */
export async function updateTransaction(userId: string, id: string, raw: TransactionUpdateInput): Promise<TransactionDTO> {
  const input = transactionUpdateSchema.parse(raw);
  const current = await getOwned(userId, id);
  assertNotDebtRow(current);
  const row = await prisma.$transaction(async (db) => {
    const merged = {
      type: current.type,
      amount: input.amount ?? amount(current.amount),
      accountId: input.accountId ?? current.accountId,
      toAccountId: input.toAccountId !== undefined ? input.toAccountId : current.toAccountId,
      // A changed amount or accounts invalidates the previous credited amount for FX transfers.
      toAmount:
        input.toAmount !== undefined
          ? input.toAmount
          : input.amount || input.accountId || input.toAccountId
            ? null
            : amount(current.toAmount),
      categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
    };
    const r = await resolveTransaction(db, userId, merged);
    const date = input.date ?? isoDate(current.date);
    await recordTransferRate(db, userId, r, date);
    return db.transaction.update({
      where: { id },
      data: {
        ...r,
        date: dateValue(date),
        description: input.description ?? current.description,
        note: input.note !== undefined ? input.note : current.note,
        paymentMethod: input.paymentMethod !== undefined ? input.paymentMethod : current.paymentMethod,
      },
      include: transactionInclude,
    });
  });
  if (row.type === 'EXPENSE') await evaluateBudgetAlerts(userId);
  return toTransactionDTO(row);
}

export async function deleteTransaction(userId: string, id: string) {
  assertNotDebtRow(await getOwned(userId, id));
  const r = await prisma.transaction.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw notFound('Transaction');
}

/** Duplicates a transaction onto today's date (in the user's time zone). */
export async function duplicateTransaction(userId: string, id: string): Promise<TransactionDTO> {
  const t = await getOwned(userId, id);
  assertNotDebtRow(t);
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const base = {
    amount: amount(t.amount),
    date: todayInTimeZone(settings?.timezone),
    accountId: t.accountId,
    description: t.description,
    note: t.note,
    paymentMethod: t.paymentMethod,
  };
  return createTransaction(
    userId,
    t.type === 'TRANSFER'
      ? { ...base, type: 'TRANSFER', toAccountId: t.toAccountId!, toAmount: amount(t.toAmount) }
      : { ...base, type: t.type, categoryId: t.categoryId },
  );
}

export function buildWhere(userId: string, q: ReturnType<typeof transactionQuerySchema.parse>): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [{ userId }];
  if (q.type) and.push({ type: q.type });
  if (q.accountId) and.push({ OR: [{ accountId: q.accountId }, { toAccountId: q.accountId }] });
  if (q.categoryId) and.push({ OR: [{ categoryId: q.categoryId }, { category: { parentId: q.categoryId } }] });
  if (q.from) and.push({ date: { gte: dateValue(q.from) } });
  if (q.to) and.push({ date: { lte: dateValue(q.to) } });
  if (q.minAmount) and.push({ amount: { gte: q.minAmount } });
  if (q.maxAmount) and.push({ amount: { lte: q.maxAmount } });
  if (q.q) and.push({ OR: [{ description: { contains: q.q } }, { note: { contains: q.q } }] });
  return { AND: and };
}

export async function listTransactions(userId: string, raw: TransactionQuery): Promise<Paginated<TransactionDTO>> {
  const q = transactionQuerySchema.parse(raw);
  const where = buildWhere(userId, q);
  const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
    q.sort === 'date'
      ? [{ date: q.order }, { createdAt: q.order }]
      : [{ [q.sort]: q.order } as Prisma.TransactionOrderByWithRelationInput, { date: 'desc' }];
  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy,
      include: transactionInclude,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    items: rows.map(toTransactionDTO),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/** Escapes a CSV cell and neutralises spreadsheet formula injection. */
function csvCell(value: string | null | undefined): string {
  let v = value ?? '';
  if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = `'${v}`;
  return /[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function exportTransactionsCsv(userId: string, raw: TransactionQuery): Promise<string> {
  const q = transactionQuerySchema.parse({ ...raw, page: 1, pageSize: 1 });
  const rows = await prisma.transaction.findMany({
    where: buildWhere(userId, q),
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: transactionInclude,
    take: 50_000,
  });
  const header = ['Date', 'Type', 'Description', 'Category', 'Account', 'To account', 'Amount', 'Currency', 'To amount', 'To currency', 'Payment method', 'Note'];
  const lines = rows.map((t) =>
    [
      isoDate(t.date),
      t.type,
      t.description,
      t.category?.name,
      t.account.name,
      t.toAccount?.name,
      (t.type === 'EXPENSE' || t.type === 'TRANSFER' ? '-' : '') + amount(t.amount),
      t.currency,
      amount(t.toAmount),
      t.toCurrency,
      t.paymentMethod,
      t.note,
    ]
      .map((c) => csvCell(c ?? ''))
      .join(','),
  );
  return '﻿' + [header.join(','), ...lines].join('\r\n');
}
