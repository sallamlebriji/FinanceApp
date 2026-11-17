import {
  balanceFromAggregates,
  money,
  type AccountCreateInput,
  type AccountDTO,
  type AccountUpdateInput,
} from '@mizan/shared';
import { accountCreateSchema, accountUpdateSchema } from '@mizan/shared';
import { conflict, notFound } from '../../lib/errors';
import { prisma, type Account } from '../../lib/prisma';
import { amount } from '../../lib/serialize';

interface Agg {
  income: string;
  expense: string;
  transferOut: string;
  transferIn: string;
  count: number;
}

/** Per-account ledger aggregates computed in the database (2 grouped queries). */
export async function accountAggregates(userId: string, accountIds?: string[]): Promise<Map<string, Agg>> {
  const scope = accountIds ? { in: accountIds } : undefined;
  const [outgoing, incoming] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { userId, ...(scope ? { accountId: scope } : {}) },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ['toAccountId'],
      where: { userId, type: 'TRANSFER', toAccountId: scope ?? { not: null } },
      _sum: { toAmount: true },
      _count: { _all: true },
    }),
  ]);
  const map = new Map<string, Agg>();
  const get = (id: string) => {
    let a = map.get(id);
    if (!a) map.set(id, (a = { income: '0', expense: '0', transferOut: '0', transferIn: '0', count: 0 }));
    return a;
  };
  for (const row of outgoing) {
    const a = get(row.accountId);
    const sum = row._sum.amount?.toString() ?? '0';
    if (row.type === 'INCOME') a.income = sum;
    else if (row.type === 'EXPENSE') a.expense = sum;
    else a.transferOut = sum;
    a.count += row._count._all;
  }
  for (const row of incoming) {
    if (!row.toAccountId) continue;
    const a = get(row.toAccountId);
    a.transferIn = row._sum.toAmount?.toString() ?? '0';
    a.count += row._count._all;
  }
  return map;
}

export function toAccountDTO(a: Account, agg?: Agg): AccountDTO {
  const balance = balanceFromAggregates({ openingBalance: a.openingBalance.toString(), ...agg });
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    openingBalance: amount(a.openingBalance),
    balance: balance.toFixed(2),
    color: a.color,
    institution: a.institution,
    includeInNetWorth: a.includeInNetWorth,
    isArchived: a.isArchived,
    transactionCount: agg?.count ?? 0,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAccounts(userId: string, includeArchived = false): Promise<AccountDTO[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, ...(includeArchived ? {} : { isArchived: false }) },
    orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const aggs = await accountAggregates(userId, accounts.map((a) => a.id));
  return accounts.map((a) => toAccountDTO(a, aggs.get(a.id)));
}

export async function getOwnedAccount(userId: string, id: string): Promise<Account> {
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw notFound('Account');
  return account;
}

export async function getAccount(userId: string, id: string): Promise<AccountDTO> {
  const a = await getOwnedAccount(userId, id);
  const aggs = await accountAggregates(userId, [id]);
  return toAccountDTO(a, aggs.get(id));
}

export async function createAccount(userId: string, raw: AccountCreateInput) {
  const input = accountCreateSchema.parse(raw);
  const count = await prisma.account.count({ where: { userId } });
  const a = await prisma.account.create({
    data: { ...input, userId, sortOrder: count, color: input.color ?? '#4B3FD1' },
  });
  return toAccountDTO(a);
}

export async function updateAccount(userId: string, id: string, raw: AccountUpdateInput) {
  const input = accountUpdateSchema.parse(raw);
  await getOwnedAccount(userId, id);
  await prisma.account.update({ where: { id }, data: input });
  return getAccount(userId, id);
}

/** Deleting is only allowed when nothing references the account; otherwise archive it. */
export async function deleteAccount(userId: string, id: string) {
  await getOwnedAccount(userId, id);
  const used = await prisma.transaction.count({ where: { userId, OR: [{ accountId: id }, { toAccountId: id }] } });
  if (used > 0) {
    throw conflict(`This account has ${used} transaction${used > 1 ? 's' : ''}. Archive it instead to keep your history.`, {
      transactionCount: used,
    });
  }
  await prisma.account.delete({ where: { id } });
}

/** Month-end balances for the last `months` months plus the latest entries with running balance. */
export async function accountHistory(userId: string, id: string, months = 12) {
  const account = await getOwnedAccount(userId, id);
  const rows = await prisma.transaction.findMany({
    where: { userId, OR: [{ accountId: id }, { toAccountId: id }] },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      type: true,
      amount: true,
      toAmount: true,
      accountId: true,
      toAccountId: true,
      date: true,
      description: true,
      category: { select: { name: true, color: true, icon: true } },
    },
  });
  let running = money(account.openingBalance.toString());
  const byMonth = new Map<string, string>();
  const entries = rows.map((r) => {
    let effect = money(0);
    if (r.accountId === id) effect = r.type === 'INCOME' ? effect.plus(r.amount.toString()) : effect.minus(r.amount.toString());
    if (r.type === 'TRANSFER' && r.toAccountId === id) effect = effect.plus((r.toAmount ?? r.amount).toString());
    running = running.plus(effect);
    const d = r.date.toISOString().slice(0, 10);
    byMonth.set(d.slice(0, 7), running.toFixed(2));
    return {
      id: r.id,
      date: d,
      description: r.description,
      type: r.type,
      category: r.category,
      change: effect.toFixed(2),
      balanceAfter: running.toFixed(2),
    };
  });

  // Fill months without activity with the previous month-end balance.
  const series: { month: string; balance: string }[] = [];
  const now = new Date();
  let last = money(account.openingBalance.toString()).toFixed(2);
  const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const sortedMonths = [...byMonth.keys()].sort();
  for (const m of sortedMonths) if (m < firstMonth.toISOString().slice(0, 7)) last = byMonth.get(m)!;
  for (let i = 0; i < months; i++) {
    const key = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    if (byMonth.has(key)) last = byMonth.get(key)!;
    series.push({ month: key, balance: last });
  }

  return { series, entries: entries.reverse().slice(0, 100) };
}
