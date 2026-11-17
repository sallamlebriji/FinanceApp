import {
  convertTotals,
  diffDays,
  money,
  monthKeys,
  previousPeriod,
  summarizeCashFlow,
  todayInTimeZone,
  totalsByCurrency,
  type Currency,
  type ReportDTO,
} from '@mizan/shared';
import { prisma } from '../../lib/prisma';
import { dateValue } from '../../lib/serialize';
import { monthlyCashFlow, reportableTotals, resolveRange, spendingByCategory } from '../dashboard/dashboard.service';
import { converterFor } from '../exchange-rates/rates.service';
import { generateForUser } from '../recurring/recurring.service';
import { toTransactionDTO, transactionInclude } from '../transactions/transactions.service';

type Raw = { toString(): string } | null;

/**
 * Analytics for a period, all in the user's main currency (converted with recorded rates only;
 * currencies without a rate are listed in `unconverted` rather than guessed). Transfers and
 * debt movements are excluded, like everywhere else in reporting.
 */
export async function getReport(userId: string, query: unknown): Promise<ReportDTO> {
  await generateForUser(userId);
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
  const base = settings.baseCurrency;
  const range = resolveRange(query, settings.timezone);
  const prev = previousPeriod(range);
  const converter = await converterFor(userId);
  const between = { gte: dateValue(range.from), lte: dateValue(range.to) };
  const months = monthKeys(range).slice(-24);

  const [cur, previous, monthly, expenseCats, prevCats, incomeCats, count, payees, largest, weekdays] = await Promise.all([
    reportableTotals(userId, range),
    reportableTotals(userId, prev),
    monthlyCashFlow(userId, { from: `${months[0]}-01`, to: range.to }, base, converter),
    spendingByCategory(userId, range, base, converter),
    spendingByCategory(userId, prev, base, converter),
    spendingByCategory(userId, range, base, converter, 'INCOME'),
    prisma.transaction.count({ where: { userId, date: between } }),
    prisma.transaction.groupBy({
      by: ['description', 'currency'],
      where: { userId, type: 'EXPENSE', debtId: null, date: between },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', debtId: null, date: between },
      orderBy: { amount: 'desc' },
      take: 5,
      include: transactionInclude,
    }),
    // MySQL WEEKDAY(): 0 = Monday … 6 = Sunday.
    prisma.$queryRaw<{ wd: number; currency: Currency; total: Raw }[]>`
      SELECT WEEKDAY(\`date\`) AS wd, currency, SUM(amount) AS total
      FROM \`transactions\`
      WHERE userId = ${userId} AND \`type\` = 'EXPENSE' AND debtId IS NULL
        AND \`date\` BETWEEN ${dateValue(range.from)} AND ${dateValue(range.to)}
      GROUP BY wd, currency`,
  ]);

  const c = summarizeCashFlow(cur, base, converter);
  const p = summarizeCashFlow(previous, base, converter);

  // Average over elapsed days only, so a half-finished month isn't diluted.
  const today = todayInTimeZone(settings.timezone);
  const end = range.to > today && range.from <= today ? today : range.to;
  const days = Math.max(1, diffDays(range.from, end) + 1);

  const prevById = new Map(prevCats.map((x) => [x.categoryId ?? 'none', x.amount]));

  // Group payees by a normalised description so "Marjane" and "marjane " merge.
  const payeeGroups = new Map<string, { description: string; items: { currency: Currency; amount: string }[]; count: number }>();
  for (const r of payees) {
    const key = r.description.trim().toLowerCase();
    const g = payeeGroups.get(key) ?? { description: r.description.trim(), items: [], count: 0 };
    g.items.push({ currency: r.currency, amount: r._sum.amount?.toString() ?? '0' });
    g.count += r._count._all;
    payeeGroups.set(key, g);
  }
  const topPayees = [...payeeGroups.values()]
    .map((g) => ({ description: g.description, amount: convertTotals(totalsByCurrency(g.items), base, converter).total, count: g.count }))
    .sort((a, b) => b.amount.comparedTo(a.amount))
    .slice(0, 8)
    .map((g) => ({ ...g, amount: g.amount.toFixed(2) }));

  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map((wd) => {
    const items = weekdays.filter((r) => Number(r.wd) === wd).map((r) => ({ currency: r.currency, amount: String(r.total ?? 0) }));
    return { weekday: wd, amount: convertTotals(totalsByCurrency(items), base, converter).total.toFixed(2) };
  });

  return {
    range,
    previousRange: prev,
    baseCurrency: base,
    totals: {
      income: c.income.toFixed(2),
      expense: c.expense.toFixed(2),
      net: c.net.toFixed(2),
      savingsRate: c.savingsRate?.toFixed(1) ?? null,
      averageDailySpend: c.expense.div(days).toDecimalPlaces(2).toFixed(2),
      transactionCount: count,
      unconverted: c.unconverted,
    },
    previousTotals: { income: p.income.toFixed(2), expense: p.expense.toFixed(2), net: p.net.toFixed(2) },
    // Leading months before the first recorded activity add nothing but noise.
    monthly: monthly.slice(Math.max(0, monthly.findIndex((m) => m.income !== '0.00' || m.expense !== '0.00'))),
    expenseByCategory: expenseCats.map((x) => ({ ...x, previous: money(prevById.get(x.categoryId ?? 'none') ?? '0').toFixed(2) })),
    incomeByCategory: incomeCats,
    topPayees,
    largestExpenses: largest.map(toTransactionDTO),
    byWeekday,
  };
}
