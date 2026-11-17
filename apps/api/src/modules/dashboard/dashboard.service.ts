import {
  addMonths,
  balanceFromAggregates,
  convertTotals,
  monthKeys,
  monthRange,
  money,
  netWorth,
  periodQuerySchema,
  previousPeriod,
  resolvePeriod,
  savingsProgress,
  summarizeCashFlow,
  todayInTimeZone,
  totalsByCurrency,
  type Converter,
  type Currency,
  type DashboardDTO,
  type DateRange,
  type ReportableTx,
} from '@mizan/shared';
import { prisma } from '../../lib/prisma';
import { dateValue, isoDate } from '../../lib/serialize';
import { accountAggregates } from '../accounts/accounts.service';
import { listBudgets } from '../budgets/budgets.service';
import { outstandingDebts } from '../debts/debts.service';
import { converterFor } from '../exchange-rates/rates.service';
import { toTransactionDTO, transactionInclude } from '../transactions/transactions.service';

type Raw = { toString(): string } | null;

export function resolveRange(query: unknown, timezone: string): DateRange {
  const q = periodQuerySchema.parse(query ?? {});
  if (q.from && q.to) return { from: q.from, to: q.to };
  return resolvePeriod(q.preset ?? 'this-month', todayInTimeZone(timezone));
}

/** Income/expense totals (reportable rows only) aggregated per type and currency. */
async function reportableTotals(userId: string, range: DateRange): Promise<ReportableTx[]> {
  const rows = await prisma.transaction.groupBy({
    by: ['type', 'currency'],
    where: {
      userId,
      type: { in: ['INCOME', 'EXPENSE'] },
      debtId: null,
      date: { gte: dateValue(range.from), lte: dateValue(range.to) },
    },
    _sum: { amount: true },
  });
  return rows.map((r) => ({ type: r.type, currency: r.currency, amount: r._sum.amount?.toString() ?? '0' }));
}

async function monthlyCashFlow(userId: string, window: DateRange, base: Currency, converter: Converter) {
  const rows = await prisma.$queryRaw<{ m: string; type: 'INCOME' | 'EXPENSE'; currency: Currency; total: Raw }[]>`
    SELECT DATE_FORMAT(\`date\`, '%Y-%m') AS m, \`type\`, currency, SUM(amount) AS total
    FROM \`transactions\`
    WHERE userId = ${userId} AND \`type\` IN ('INCOME', 'EXPENSE') AND debtId IS NULL
      AND \`date\` BETWEEN ${dateValue(window.from)} AND ${dateValue(window.to)}
    GROUP BY m, \`type\`, currency`;
  return monthKeys(window).map((month) => {
    const items = rows.filter((r) => r.m === month).map((r) => ({ type: r.type, currency: r.currency, amount: String(r.total ?? 0) }));
    const s = summarizeCashFlow(items, base, converter);
    return { month, income: s.income.toFixed(2), expense: s.expense.toFixed(2), net: s.net.toFixed(2) };
  });
}

async function spendingByCategory(userId: string, range: DateRange, base: Currency, converter: Converter) {
  const [rows, categories] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['categoryId', 'currency'],
      where: { userId, type: 'EXPENSE', debtId: null, date: { gte: dateValue(range.from), lte: dateValue(range.to) } },
      _sum: { amount: true },
    }),
    prisma.category.findMany({ where: { userId, type: 'EXPENSE' } }),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  // Roll subcategories up into their parent.
  const groups = new Map<string, { currency: Currency; amount: string }[]>();
  for (const r of rows) {
    const c = r.categoryId ? byId.get(r.categoryId) : undefined;
    const key = c?.parentId ?? c?.id ?? 'none';
    const list = groups.get(key) ?? [];
    list.push({ currency: r.currency, amount: r._sum.amount?.toString() ?? '0' });
    groups.set(key, list);
  }
  const items = [...groups.entries()].map(([key, list]) => {
    const total = convertTotals(totalsByCurrency(list), base, converter).total;
    const c = key === 'none' ? undefined : byId.get(key);
    return {
      categoryId: c?.id ?? null,
      name: c?.name ?? 'Uncategorised',
      color: c?.color ?? '#8E8E93',
      icon: c?.icon ?? 'dots',
      amount: total,
    };
  });
  const grand = items.reduce((s, i) => s.plus(i.amount), money(0));
  return items
    .filter((i) => i.amount.gt(0))
    .sort((a, b) => b.amount.comparedTo(a.amount))
    .map((i) => ({
      ...i,
      amount: i.amount.toFixed(2),
      percent: grand.isZero() ? '0.0' : i.amount.div(grand).times(100).toFixed(1),
    }));
}

type DebtHistory = {
  direction: 'BORROWED' | 'LENT';
  currency: Currency;
  principal: string;
  start: string;
  payments: { date: string; amount: string }[];
};

async function debtHistory(userId: string): Promise<DebtHistory[]> {
  const rows = await prisma.debt.findMany({
    where: { userId },
    select: { direction: true, currency: true, principal: true, startDate: true, payments: { select: { date: true, amount: true } } },
  });
  return rows.map((d) => ({
    direction: d.direction,
    currency: d.currency,
    principal: d.principal.toString(),
    start: isoDate(d.startDate),
    payments: d.payments.map((p) => ({ date: isoDate(p.date), amount: p.amount.toString() })),
  }));
}

/** Month-end net worth computed forward from opening balances (current rates). */
async function netWorthSeries(
  userId: string,
  months: string[],
  accounts: { id: string; currency: Currency; openingBalance: string; includeInNetWorth: boolean }[],
  base: Currency,
  converter: Converter,
  debts: DebtHistory[],
) {
  const rows = await prisma.$queryRaw<{ acc: string; m: string; d: Raw }[]>`
    SELECT accountId AS acc, DATE_FORMAT(\`date\`, '%Y-%m') AS m,
           SUM(CASE WHEN \`type\` = 'INCOME' THEN amount ELSE -amount END) AS d
    FROM \`transactions\` WHERE userId = ${userId}
    GROUP BY acc, m
    UNION ALL
    SELECT toAccountId AS acc, DATE_FORMAT(\`date\`, '%Y-%m') AS m, SUM(COALESCE(toAmount, amount)) AS d
    FROM \`transactions\` WHERE userId = ${userId} AND \`type\` = 'TRANSFER' AND toAccountId IS NOT NULL
    GROUP BY acc, m`;
  const included = accounts.filter((a) => a.includeInNetWorth);
  return months.map((month) => {
    const items = included.map((a) => {
      const delta = rows
        .filter((r) => r.acc === a.id && r.m <= month)
        .reduce((s, r) => s.plus(String(r.d ?? 0)), money(0));
      return { currency: a.currency, amount: money(a.openingBalance).plus(delta) };
    });
    // Debts outstanding at month end: owed money counts against net worth, lent money for it.
    for (const d of debts) {
      if (d.start.slice(0, 7) > month) continue;
      const paid = d.payments.filter((p) => p.date.slice(0, 7) <= month).reduce((s, p) => s.plus(p.amount), money(0));
      const left = money(d.principal).minus(paid);
      if (left.lte(0)) continue;
      items.push({ currency: d.currency, amount: d.direction === 'BORROWED' ? left.negated() : left });
    }
    return { month, amount: convertTotals(totalsByCurrency(items), base, converter).total.toFixed(2) };
  });
}

export async function getDashboard(userId: string, query: unknown): Promise<DashboardDTO> {
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
  const base = settings.baseCurrency;
  const range = resolveRange(query, settings.timezone);
  const prev = previousPeriod(range);
  const converter = await converterFor(userId);

  const accounts = await prisma.account.findMany({ where: { userId, isArchived: false } });
  const aggs = await accountAggregates(userId, accounts.map((a) => a.id));
  const balances = new Map(
    accounts.map((a) => [a.id, balanceFromAggregates({ openingBalance: a.openingBalance.toString(), ...aggs.get(a.id) })]),
  );
  const accountLikes = accounts.map((a) => ({
    id: a.id,
    currency: a.currency,
    openingBalance: a.openingBalance.toString(),
    includeInNetWorth: a.includeInNetWorth,
  }));
  const debts = await debtHistory(userId);
  const nw = netWorth(accountLikes, balances, base, converter, await outstandingDebts(userId));
  const byCurrency = totalsByCurrency(accounts.map((a) => ({ currency: a.currency, amount: balances.get(a.id)! })));

  // Cash-flow window: the selected months, or the 6 months ending with the period.
  const span = monthKeys(range);
  const window: DateRange =
    span.length >= 3 ? { from: monthRange(range.from).from, to: monthRange(range.to).to } : { from: addMonths(monthRange(range.to).from, -5), to: monthRange(range.to).to };
  const windowMonths = monthKeys(window).slice(-24);

  const [cur, previous, cashFlow, spending, series, recent, budgets, goals, txCount] = await Promise.all([
    reportableTotals(userId, range),
    reportableTotals(userId, prev),
    monthlyCashFlow(userId, { from: `${windowMonths[0]}-01`, to: window.to }, base, converter),
    spendingByCategory(userId, range, base, converter),
    netWorthSeries(userId, windowMonths, accountLikes, base, converter, debts),
    prisma.transaction.findMany({ where: { userId }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 6, include: transactionInclude }),
    listBudgets(userId),
    prisma.savingsGoal.findMany({
      where: { userId, archivedAt: null },
      include: { contributions: { select: { amount: true } } },
      orderBy: { createdAt: 'asc' },
      take: 4,
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);

  const c = summarizeCashFlow(cur, base, converter);
  const p = summarizeCashFlow(previous, base, converter);

  return {
    range,
    previousRange: prev,
    baseCurrency: base,
    netWorth: { amount: nw.total.toFixed(2), currency: base, unconverted: nw.unconverted },
    balancesByCurrency: [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount: amount.toFixed(2) })),
    current: {
      income: c.income.toFixed(2),
      expense: c.expense.toFixed(2),
      net: c.net.toFixed(2),
      savingsRate: c.savingsRate?.toFixed(1) ?? null,
      unconverted: c.unconverted,
    },
    previous: {
      income: p.income.toFixed(2),
      expense: p.expense.toFixed(2),
      net: p.net.toFixed(2),
      savingsRate: p.savingsRate?.toFixed(1) ?? null,
    },
    cashFlow,
    spendingByCategory: spending,
    netWorthSeries: series,
    recentTransactions: recent.map(toTransactionDTO),
    budgets,
    savingsGoals: goals.map((g) => {
      const prog = savingsProgress(
        g.targetAmount.toString(),
        g.contributions.reduce((s, x) => s.plus(x.amount.toString()), money(0)),
      );
      return {
        id: g.id,
        name: g.name,
        target: prog.target.toFixed(2),
        current: prog.current.toFixed(2),
        percent: prog.percent.toFixed(1),
        currency: g.currency,
      };
    }),
    hasData: accounts.length > 0 || txCount > 0,
  };
}
