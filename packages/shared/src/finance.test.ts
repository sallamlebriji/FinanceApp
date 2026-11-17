import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  balancesByAccount,
  budgetStatus,
  createConverter,
  debtRemaining,
  isReportable,
  netWorth,
  newlyCrossedThresholds,
  savingsProgress,
  savingsRate,
  summarizeCashFlow,
  sumMoney,
  toAmountString,
  type LedgerEntry,
} from './index';

const noRates = createConverter([]);

describe('money precision', () => {
  it('never suffers from floating point drift', () => {
    expect(sumMoney(['0.1', '0.2']).toFixed(2)).toBe('0.30');
    expect(toAmountString(sumMoney(Array.from({ length: 1000 }, () => '0.01')))).toBe('10.00');
  });
  it('rounds half-even at the currency scale', () => {
    expect(toAmountString('2.345')).toBe('2.34');
    expect(toAmountString('2.355')).toBe('2.36');
  });
});

describe('account balance', () => {
  const entries: LedgerEntry[] = [
    { type: 'INCOME', amount: '10000.00', accountId: 'a' },
    { type: 'EXPENSE', amount: '2500.50', accountId: 'a' },
    { type: 'TRANSFER', amount: '1000.00', accountId: 'a', toAccountId: 'b', toAmount: '1000.00' },
  ];

  it('income increases, expenses decrease the balance', () => {
    expect(accountBalance('500', 'a', entries).toFixed(2)).toBe('6999.50');
  });

  it('a transfer debits the source and credits the destination', () => {
    expect(accountBalance('0', 'b', entries).toFixed(2)).toBe('1000.00');
    const map = balancesByAccount(
      [
        { id: 'a', currency: 'MAD', openingBalance: '500' },
        { id: 'b', currency: 'MAD', openingBalance: '0' },
      ],
      entries,
    );
    expect(map.get('a')!.toFixed(2)).toBe('6999.50');
    expect(map.get('b')!.toFixed(2)).toBe('1000.00');
  });

  it('cross-currency transfers credit the converted amount', () => {
    const e: LedgerEntry[] = [{ type: 'TRANSFER', amount: '1085.00', accountId: 'mad', toAccountId: 'eur', toAmount: '100.00' }];
    expect(accountBalance('0', 'mad', e).toFixed(2)).toBe('-1085.00');
    expect(accountBalance('0', 'eur', e).toFixed(2)).toBe('100.00');
  });

  it('deleting a transaction updates derived balances', () => {
    expect(accountBalance('500', 'a', entries.slice(0, 1)).toFixed(2)).toBe('10500.00');
  });
});

describe('reporting rules', () => {
  it('transfers are neither income nor expense', () => {
    const s = summarizeCashFlow(
      [
        { type: 'INCOME', amount: '8000', currency: 'MAD' },
        { type: 'EXPENSE', amount: '3000', currency: 'MAD' },
        { type: 'TRANSFER', amount: '2000', currency: 'MAD' },
      ],
      'MAD',
      noRates,
    );
    expect(s.income.toFixed(2)).toBe('8000.00');
    expect(s.expense.toFixed(2)).toBe('3000.00');
    expect(s.net.toFixed(2)).toBe('5000.00');
    expect(s.savingsRate!.toFixed(1)).toBe('62.5');
  });

  it('debt movements are excluded to avoid double counting', () => {
    expect(isReportable({ type: 'EXPENSE', debtId: 'd1' })).toBe(false);
    const s = summarizeCashFlow(
      [
        { type: 'INCOME', amount: '20000', currency: 'MAD', debtId: 'loan' }, // loan received
        { type: 'EXPENSE', amount: '2000', currency: 'MAD', debtId: 'loan' }, // repayment
        { type: 'EXPENSE', amount: '500', currency: 'MAD' },
      ],
      'MAD',
      noRates,
    );
    expect(s.income.toFixed(2)).toBe('0.00');
    expect(s.expense.toFixed(2)).toBe('500.00');
    expect(s.savingsRate).toBeNull();
  });

  it('never mixes currencies without a rate', () => {
    const s = summarizeCashFlow(
      [
        { type: 'EXPENSE', amount: '100', currency: 'MAD' },
        { type: 'EXPENSE', amount: '50', currency: 'EUR' },
      ],
      'MAD',
      noRates,
    );
    expect(s.expense.toFixed(2)).toBe('100.00');
    expect(s.unconverted).toEqual(['EUR']);
  });

  it('converts with explicit rates, including inverse and triangulated', () => {
    const conv = createConverter([
      { base: 'EUR', quote: 'MAD', rate: '10.85' },
      { base: 'USD', quote: 'MAD', rate: '9.95' },
    ]);
    expect(conv.convert('100', 'EUR', 'MAD').toFixed(2)).toBe('1085.00');
    expect(conv.convert('1085', 'MAD', 'EUR').toFixed(2)).toBe('100.00');
    expect(conv.convert('100', 'EUR', 'USD').toFixed(2)).toBe('109.05');
  });

  it('savings rate is null without income and can be negative', () => {
    expect(savingsRate('0', '100')).toBeNull();
    expect(savingsRate('1000', '1500')!.toFixed(1)).toBe('-50.0');
  });
});

describe('net worth', () => {
  it('sums included accounts and subtracts money owed', () => {
    const conv = createConverter([{ base: 'EUR', quote: 'MAD', rate: '10' }]);
    const accounts = [
      { id: 'a', currency: 'MAD' as const, openingBalance: '1000' },
      { id: 'b', currency: 'EUR' as const, openingBalance: '100' },
      { id: 'c', currency: 'MAD' as const, openingBalance: '999', includeInNetWorth: false },
    ];
    const balances = balancesByAccount(accounts, []);
    const nw = netWorth(accounts, balances, 'MAD', conv, [
      { currency: 'MAD', direction: 'BORROWED', remaining: '300' },
      { currency: 'MAD', direction: 'LENT', remaining: '50' },
    ]);
    expect(nw.total.toFixed(2)).toBe('1750.00');
    expect(nw.unconverted).toEqual([]);
  });
});

describe('budgets', () => {
  it('computes consumption, remaining and state', () => {
    const s = budgetStatus('2000', '1500');
    expect(s.percent.toFixed(1)).toBe('75.0');
    expect(s.remaining.toFixed(2)).toBe('500.00');
    expect(s.threshold).toBe(75);
    expect(s.state).toBe('warning');
    expect(budgetStatus('2000', '2100').state).toBe('over');
    expect(budgetStatus('2000', '100').threshold).toBeNull();
  });

  it('detects newly crossed alert thresholds (50/75/90/100)', () => {
    expect(newlyCrossedThresholds('40', '92')).toEqual([50, 75, 90]);
    expect(newlyCrossedThresholds('92', '95')).toEqual([]);
    expect(newlyCrossedThresholds('99.9', '100')).toEqual([100]);
  });
});

describe('goals and debts', () => {
  it('savings progress', () => {
    const p = savingsProgress('10000', '2500');
    expect(p.percent.toFixed(1)).toBe('25.0');
    expect(p.remaining.toFixed(2)).toBe('7500.00');
    expect(p.completed).toBe(false);
  });

  it('remaining debt after partial payments never goes negative', () => {
    expect(debtRemaining('5000', ['1000', '1500.50']).remaining.toFixed(2)).toBe('2499.50');
    const settled = debtRemaining('100', ['60', '60']);
    expect(settled.remaining.toFixed(2)).toBe('0.00');
    expect(settled.settled).toBe(true);
  });
});

describe('balanceFromAggregates', () => {
  it('matches the ledger rule', async () => {
    const { balanceFromAggregates } = await import('./finance');
    expect(
      balanceFromAggregates({ openingBalance: '500', income: '10000', expense: '2500.50', transferOut: '1000', transferIn: null }).toFixed(2),
    ).toBe('6999.50');
  });
});
