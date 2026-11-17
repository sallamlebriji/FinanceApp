import type Decimal from 'decimal.js';
import { MissingRateError, type Converter } from './currency';
import { money, percent, sumMoney, type Currency, type MoneyInput } from './money';

/**
 * Centralised financial rules. Every figure the API serves is derived here so that web,
 * mobile and reports agree. Rules:
 *  - Income increases, expenses decrease the account balance.
 *  - A transfer is a single ledger row: it debits `accountId` by `amount` and credits
 *    `toAccountId` by `toAmount` (equal to `amount` for same-currency transfers).
 *    Transfers are never income or expense.
 *  - Rows linked to a debt (loan received/given, repayments) move balances but are excluded
 *    from income/expense reports, which prevents double counting.
 *  - Currencies are never mixed without an explicit rate.
 */
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface LedgerEntry {
  type: TransactionType;
  amount: MoneyInput;
  accountId: string;
  toAccountId?: string | null;
  toAmount?: MoneyInput | null;
  debtId?: string | null;
}

/** Signed effect of one ledger row on one account. */
export function effectOnAccount(entry: LedgerEntry, accountId: string): Decimal {
  let effect = money(0);
  if (entry.accountId === accountId) {
    if (entry.type === 'INCOME') effect = effect.plus(entry.amount);
    else effect = effect.minus(entry.amount); // EXPENSE and TRANSFER (outgoing leg)
  }
  if (entry.type === 'TRANSFER' && entry.toAccountId === accountId) {
    effect = effect.plus(entry.toAmount ?? entry.amount);
  }
  return effect;
}

export function accountBalance(openingBalance: MoneyInput, accountId: string, entries: Iterable<LedgerEntry>): Decimal {
  let balance = money(openingBalance);
  for (const e of entries) balance = balance.plus(effectOnAccount(e, accountId));
  return balance;
}

export interface AccountLike {
  id: string;
  currency: Currency;
  openingBalance: MoneyInput;
  includeInNetWorth?: boolean;
  isArchived?: boolean;
}

export function balancesByAccount(accounts: AccountLike[], entries: LedgerEntry[]): Map<string, Decimal> {
  const map = new Map<string, Decimal>(accounts.map((a) => [a.id, money(a.openingBalance)]));
  for (const e of entries) {
    if (map.has(e.accountId)) {
      const sign = e.type === 'INCOME' ? 1 : -1;
      map.set(e.accountId, map.get(e.accountId)!.plus(money(e.amount).times(sign)));
    }
    if (e.type === 'TRANSFER' && e.toAccountId && map.has(e.toAccountId)) {
      map.set(e.toAccountId, map.get(e.toAccountId)!.plus(e.toAmount ?? e.amount));
    }
  }
  return map;
}

/** Totals grouped by currency — never mixes currencies. */
export function totalsByCurrency(items: { currency: Currency; amount: MoneyInput }[]): Map<Currency, Decimal> {
  const map = new Map<Currency, Decimal>();
  for (const i of items) map.set(i.currency, (map.get(i.currency) ?? money(0)).plus(i.amount));
  return map;
}

export interface ConvertedTotal {
  currency: Currency;
  total: Decimal;
  /** Currencies that could not be converted and are therefore excluded from `total`. */
  unconverted: Currency[];
}

export function convertTotals(byCurrency: Map<Currency, Decimal>, target: Currency, converter: Converter): ConvertedTotal {
  let total = money(0);
  const unconverted: Currency[] = [];
  for (const [cur, amount] of byCurrency) {
    try {
      total = total.plus(converter.convert(amount, cur, target));
    } catch (err) {
      if (err instanceof MissingRateError) unconverted.push(cur);
      else throw err;
    }
  }
  return { currency: target, total, unconverted };
}

/** Net worth = balances of accounts included in net worth − outstanding money owed + money lent. */
export function netWorth(
  accounts: AccountLike[],
  balances: Map<string, Decimal>,
  target: Currency,
  converter: Converter,
  debts: { currency: Currency; direction: 'BORROWED' | 'LENT'; remaining: MoneyInput }[] = [],
): ConvertedTotal {
  const items: { currency: Currency; amount: Decimal }[] = [];
  for (const a of accounts) {
    if (a.includeInNetWorth === false) continue;
    items.push({ currency: a.currency, amount: balances.get(a.id) ?? money(a.openingBalance) });
  }
  for (const d of debts) {
    const r = money(d.remaining);
    items.push({ currency: d.currency, amount: d.direction === 'BORROWED' ? r.negated() : r });
  }
  return convertTotals(totalsByCurrency(items), target, converter);
}

export interface ReportableTx {
  type: TransactionType;
  amount: MoneyInput;
  currency: Currency;
  debtId?: string | null;
}

/** Transfers and debt movements are excluded from income/expense reporting. */
export function isReportable(tx: { type: TransactionType; debtId?: string | null }): boolean {
  return tx.type !== 'TRANSFER' && !tx.debtId;
}

export interface CashFlowSummary {
  currency: Currency;
  income: Decimal;
  expense: Decimal;
  net: Decimal;
  /** (income − expense) / income × 100, or null when there is no income. */
  savingsRate: Decimal | null;
  unconverted: Currency[];
}

export function summarizeCashFlow(txs: ReportableTx[], target: Currency, converter: Converter): CashFlowSummary {
  const income: { currency: Currency; amount: MoneyInput }[] = [];
  const expense: { currency: Currency; amount: MoneyInput }[] = [];
  for (const t of txs) {
    if (!isReportable(t)) continue;
    (t.type === 'INCOME' ? income : expense).push({ currency: t.currency, amount: t.amount });
  }
  const inc = convertTotals(totalsByCurrency(income), target, converter);
  const exp = convertTotals(totalsByCurrency(expense), target, converter);
  const net = inc.total.minus(exp.total);
  return {
    currency: target,
    income: inc.total,
    expense: exp.total,
    net,
    savingsRate: savingsRate(inc.total, exp.total),
    unconverted: [...new Set([...inc.unconverted, ...exp.unconverted])],
  };
}

export function savingsRate(income: MoneyInput, expense: MoneyInput): Decimal | null {
  const inc = money(income);
  if (inc.lte(0)) return null;
  return percent(inc.minus(expense), inc);
}

export const BUDGET_THRESHOLDS = [50, 75, 90, 100] as const;
export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number];

export interface BudgetStatus {
  limit: Decimal;
  spent: Decimal;
  remaining: Decimal;
  /** Consumption in percent (1 decimal), may exceed 100. */
  percent: Decimal;
  /** Highest threshold reached, or null below 50%. */
  threshold: BudgetThreshold | null;
  state: 'ok' | 'warning' | 'critical' | 'over';
}

export function budgetStatus(limit: MoneyInput, spent: MoneyInput): BudgetStatus {
  const l = money(limit);
  const s = money(spent);
  const pct = l.isZero() ? (s.gt(0) ? money(100) : money(0)) : s.div(l).times(100).toDecimalPlaces(1);
  let threshold: BudgetThreshold | null = null;
  for (const t of BUDGET_THRESHOLDS) if (pct.gte(t)) threshold = t;
  const state = pct.gt(100) ? 'over' : pct.gte(90) ? 'critical' : pct.gte(75) ? 'warning' : 'ok';
  return { limit: l, spent: s, remaining: l.minus(s), percent: pct, threshold, state };
}

/** Thresholds newly crossed between a previous and a current consumption. */
export function newlyCrossedThresholds(previousPercent: MoneyInput, currentPercent: MoneyInput): BudgetThreshold[] {
  const prev = money(previousPercent);
  const cur = money(currentPercent);
  return BUDGET_THRESHOLDS.filter((t) => prev.lt(t) && cur.gte(t));
}

export function savingsProgress(target: MoneyInput, current: MoneyInput) {
  const t = money(target);
  const c = money(current);
  const pct = t.isZero() ? money(0) : c.div(t).times(100).toDecimalPlaces(1);
  return {
    target: t,
    current: c,
    remaining: clampZero(t.minus(c)),
    percent: pct,
    completed: c.gte(t) && t.gt(0),
  };
}

export function debtRemaining(principal: MoneyInput, payments: Iterable<MoneyInput>) {
  const paid = sumMoney(payments);
  const remaining = money(principal).minus(paid);
  return { principal: money(principal), paid, remaining: clampZero(remaining), settled: remaining.lte(0) };
}

function clampZero(d: Decimal): Decimal {
  return d.isNegative() ? money(0) : d;
}

/** Balance from per-account database aggregates (same rules as `effectOnAccount`). */
export function balanceFromAggregates(a: {
  openingBalance: MoneyInput;
  income?: MoneyInput | null;
  expense?: MoneyInput | null;
  transferOut?: MoneyInput | null;
  transferIn?: MoneyInput | null;
}): Decimal {
  return money(a.openingBalance)
    .plus(money(a.income))
    .minus(money(a.expense))
    .minus(money(a.transferOut))
    .plus(money(a.transferIn));
}

/**
 * Amount to set aside per calendar month (current month included) to reach `remaining` by
 * `deadline`. Null when nothing is left to save or the deadline has passed.
 */
export function monthlyNeeded(remaining: MoneyInput, today: string, deadline: string | null | undefined): Decimal | null {
  const r = money(remaining);
  if (!deadline || r.lte(0) || deadline < today) return null;
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  const [dy, dm] = deadline.split('-').map(Number) as [number, number];
  const months = dy * 12 + dm - (ty * 12 + tm) + 1;
  return r.div(months).toDecimalPlaces(2, 0 /* ROUND_UP: never fall short */);
}
