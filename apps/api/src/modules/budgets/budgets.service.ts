import {
  budgetCreateSchema,
  budgetStatus,
  budgetUpdateSchema,
  formatMoney,
  monthRange,
  todayInTimeZone,
  weekRange,
  type BudgetCreateInput,
  type BudgetDTO,
  type Converter,
  type Currency,
  type DateRange,
  money,
} from '@mizan/shared';
import { badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma, type Budget, type Category, type UserSettings } from '../../lib/prisma';
import { dateValue } from '../../lib/serialize';
import { converterFor } from '../exchange-rates/rates.service';

export function budgetRange(period: 'MONTHLY' | 'WEEKLY', today: string, weekStartsOn: number): DateRange {
  return period === 'MONTHLY' ? monthRange(today) : weekRange(today, weekStartsOn === 0 ? 0 : 1);
}

/** Expense total for a budget in its own currency (subcategories included, debt rows excluded). */
export async function budgetSpent(userId: string, budget: Budget, range: DateRange, converter: Converter) {
  let categoryIds: string[] | undefined;
  if (budget.categoryId) {
    const children = await prisma.category.findMany({ where: { userId, parentId: budget.categoryId }, select: { id: true } });
    categoryIds = [budget.categoryId, ...children.map((c) => c.id)];
  }
  const rows = await prisma.transaction.groupBy({
    by: ['currency'],
    where: {
      userId,
      type: 'EXPENSE',
      debtId: null,
      date: { gte: dateValue(range.from), lte: dateValue(range.to) },
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    },
    _sum: { amount: true },
  });
  let spent = money(0);
  const unconverted: Currency[] = [];
  for (const r of rows) {
    const v = r._sum.amount?.toString() ?? '0';
    if (converter.canConvert(r.currency, budget.currency)) spent = spent.plus(converter.convert(v, r.currency, budget.currency));
    else unconverted.push(r.currency);
  }
  return { spent, unconverted };
}

type BudgetWithCategory = Budget & { category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null };

export async function toBudgetDTO(
  userId: string,
  b: BudgetWithCategory,
  settings: Pick<UserSettings, 'timezone' | 'weekStartsOn'>,
  converter: Converter,
): Promise<BudgetDTO> {
  const range = budgetRange(b.period, todayInTimeZone(settings.timezone), settings.weekStartsOn);
  const { spent } = await budgetSpent(userId, b, range, converter);
  const s = budgetStatus(b.amount.toString(), spent);
  return {
    id: b.id,
    name: b.name,
    period: b.period,
    amount: s.limit.toFixed(2),
    currency: b.currency,
    categoryId: b.categoryId,
    category: b.category,
    current: {
      range,
      spent: s.spent.toFixed(2),
      remaining: s.remaining.toFixed(2),
      percent: s.percent.toFixed(1),
      state: s.state,
      threshold: s.threshold,
    },
  };
}

const categorySelect = { select: { id: true, name: true, icon: true, color: true } } as const;

export async function listBudgets(userId: string): Promise<BudgetDTO[]> {
  const [budgets, settings, converter] = await Promise.all([
    prisma.budget.findMany({ where: { userId, isActive: true }, include: { category: categorySelect }, orderBy: { createdAt: 'asc' } }),
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    converterFor(userId),
  ]);
  return Promise.all(budgets.map((b) => toBudgetDTO(userId, b, settings, converter)));
}

async function assertExpenseCategory(userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const c = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!c) throw notFound('Category');
  if (c.type !== 'EXPENSE') throw badRequest('Budgets can only track expense categories');
}

export async function createBudget(userId: string, raw: BudgetCreateInput) {
  const input = budgetCreateSchema.parse(raw);
  await assertExpenseCategory(userId, input.categoryId);
  const b = await prisma.budget.create({ data: { ...input, categoryId: input.categoryId ?? null, userId }, include: { category: categorySelect } });
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
  return toBudgetDTO(userId, b, settings, await converterFor(userId));
}

export async function updateBudget(userId: string, id: string, raw: unknown) {
  const input = budgetUpdateSchema.parse(raw);
  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Budget');
  await assertExpenseCategory(userId, input.categoryId);
  const b = await prisma.budget.update({ where: { id }, data: input, include: { category: categorySelect } });
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
  return toBudgetDTO(userId, b, settings, await converterFor(userId));
}

export async function deleteBudget(userId: string, id: string) {
  const r = await prisma.budget.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw notFound('Budget');
}

/**
 * Creates at most one notification per budget, period and threshold (50/75/90/100).
 * Called after expenses change; failures are logged, never surfaced to the user action.
 */
export async function evaluateBudgetAlerts(userId: string) {
  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.budgetAlerts) return;
    const [budgets, converter] = await Promise.all([
      prisma.budget.findMany({ where: { userId, isActive: true }, include: { category: categorySelect } }),
      converterFor(userId),
    ]);
    for (const b of budgets) {
      const dto = await toBudgetDTO(userId, b, settings, converter);
      const t = dto.current.threshold;
      if (!t) continue;
      const over = t === 100;
      await prisma.notification.createMany({
        skipDuplicates: true,
        data: [
          {
            userId,
            type: 'BUDGET_THRESHOLD',
            dedupeKey: `budget:${b.id}:${dto.current.range.from}:${t}`,
            title: over ? `${b.name} budget reached` : `${b.name} budget at ${t}%`,
            body: over
              ? `You've spent ${formatMoney(dto.current.spent, b.currency, { locale: settings.locale })} of ${formatMoney(dto.amount, b.currency, { locale: settings.locale })} this ${b.period === 'MONTHLY' ? 'month' : 'week'}.`
              : `${formatMoney(dto.current.remaining, b.currency, { locale: settings.locale })} left until ${new Intl.DateTimeFormat(settings.locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dto.current.range.to}T00:00:00Z`))}.`,
            data: { budgetId: b.id, threshold: t, periodStart: dto.current.range.from },
          },
        ],
      });
    }
  } catch (err) {
    logger.error({ err }, 'Budget alert evaluation failed');
  }
}
