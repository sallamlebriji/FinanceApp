import { describe, expect, it } from 'vitest';
import { authed, signUp } from './helpers';

async function setup() {
  const s = await signUp();
  const api = authed(s.token);
  const bank = (await api.post('/api/accounts', { name: 'Bank', type: 'BANK', currency: 'MAD', openingBalance: '1000.00' })).body;
  const savings = (await api.post('/api/accounts', { name: 'Savings', type: 'SAVINGS', currency: 'MAD' })).body;
  const cats = (await api.get('/api/categories')).body.items as { id: string; key?: string; name: string; type: string }[];
  const food = cats.find((c) => c.name === 'Food')!;
  const salary = cats.find((c) => c.name === 'Salary')!;
  return { s, api, bank, savings, food, salary };
}

describe('accounts and transactions', () => {
  it('isolates data between users', async () => {
    const a = await setup();
    const b = await signUp('Other');
    const other = authed(b.token);
    expect((await other.get(`/api/accounts/${a.bank.id}`)).status).toBe(404);
    expect((await other.patch(`/api/accounts/${a.bank.id}`, { name: 'hacked' })).status).toBe(404);
    const tx = await a.api.post('/api/transactions', { type: 'EXPENSE', amount: '10', date: '2026-11-02', accountId: a.bank.id, description: 'Coffee' });
    expect((await other.get(`/api/transactions/${tx.body.id}`)).status).toBe(404);
    expect((await other.delete(`/api/transactions/${tx.body.id}`)).status).toBe(404);
    // Cannot post into someone else's account or category.
    const cross = await other.post('/api/transactions', { type: 'EXPENSE', amount: '5', date: '2026-11-02', accountId: a.bank.id, description: 'x' });
    expect(cross.status).toBe(404);
    expect((await other.get('/api/transactions')).body.total).toBe(0);
  });

  it('keeps balances exact and updates them on edit and delete', async () => {
    const { api, bank, food, salary } = await setup();
    await api.post('/api/transactions', { type: 'INCOME', amount: '0.10', date: '2026-11-01', accountId: bank.id, categoryId: salary.id, description: 'a' });
    const t = await api.post('/api/transactions', { type: 'EXPENSE', amount: '0.20', date: '2026-11-01', accountId: bank.id, categoryId: food.id, description: 'b' });
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('999.90');
    await api.patch(`/api/transactions/${t.body.id}`, { amount: '100.05' });
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('900.05');
    await api.delete(`/api/transactions/${t.body.id}`);
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('1000.10');
  });

  it('rejects a category of the wrong type and amounts with more than 2 decimals', async () => {
    const { api, bank, salary } = await setup();
    const wrong = await api.post('/api/transactions', { type: 'EXPENSE', amount: '10', date: '2026-11-01', accountId: bank.id, categoryId: salary.id, description: 'x' });
    expect(wrong.status).toBe(400);
    const precise = await api.post('/api/transactions', { type: 'EXPENSE', amount: '10.123', date: '2026-11-01', accountId: bank.id, description: 'x' });
    expect(precise.status).toBe(400);
  });

  it('moves money atomically with a transfer that is neither income nor expense', async () => {
    const { api, bank, savings } = await setup();
    const tr = await api.post('/api/transactions', { type: 'TRANSFER', amount: '400', date: '2026-11-03', accountId: bank.id, toAccountId: savings.id, description: 'Save' });
    expect(tr.status).toBe(201);
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('600.00');
    expect((await api.get(`/api/accounts/${savings.id}`)).body.balance).toBe('400.00');
    const dash = (await api.get('/api/dashboard?from=2026-11-01&to=2026-11-30')).body;
    expect(dash.current.income).toBe('0.00');
    expect(dash.current.expense).toBe('0.00');
    expect(dash.netWorth.amount).toBe('1000.00');
  });

  it('requires the received amount for cross-currency transfers and records the rate', async () => {
    const { api, bank } = await setup();
    const eur = (await api.post('/api/accounts', { name: 'Euro', type: 'BANK', currency: 'EUR' })).body;
    const missing = await api.post('/api/transactions', { type: 'TRANSFER', amount: '1085', date: '2026-11-05', accountId: bank.id, toAccountId: eur.id, description: 'FX' });
    expect(missing.status).toBe(400);
    const ok = await api.post('/api/transactions', { type: 'TRANSFER', amount: '1000', toAmount: '92.17', date: '2026-11-05', accountId: bank.id, toAccountId: eur.id, description: 'FX' });
    expect(ok.status).toBe(201);
    expect(ok.body.exchangeRate).toBe('0.09217');
    expect((await api.get(`/api/accounts/${eur.id}`)).body.balance).toBe('92.17');
    const rates = (await api.get('/api/exchange-rates')).body.items;
    expect(rates[0]).toMatchObject({ base: 'MAD', quote: 'EUR', source: 'transfer' });
    // Net worth converts EUR back to MAD with the recorded rate: 0 + 92.17 / 0.09217 = 1000.
    const dash = (await api.get('/api/dashboard?from=2026-11-01&to=2026-11-30')).body;
    expect(dash.netWorth.amount).toBe('1000.00');
    expect(dash.netWorth.unconverted).toEqual([]);
  });

  it('computes period income, expense, savings rate and comparison', async () => {
    const { api, bank, food, salary } = await setup();
    await api.post('/api/transactions', { type: 'INCOME', amount: '10000', date: '2026-10-28', accountId: bank.id, categoryId: salary.id, description: 'Oct salary' });
    await api.post('/api/transactions', { type: 'EXPENSE', amount: '4000', date: '2026-10-15', accountId: bank.id, categoryId: food.id, description: 'Oct food' });
    await api.post('/api/transactions', { type: 'INCOME', amount: '12000', date: '2026-11-28', accountId: bank.id, categoryId: salary.id, description: 'Nov salary' });
    await api.post('/api/transactions', { type: 'EXPENSE', amount: '3000', date: '2026-11-10', accountId: bank.id, categoryId: food.id, description: 'Nov food' });
    const d = (await api.get('/api/dashboard?from=2026-11-01&to=2026-11-30')).body;
    expect(d.current).toMatchObject({ income: '12000.00', expense: '3000.00', net: '9000.00', savingsRate: '75.0' });
    expect(d.previous).toMatchObject({ income: '10000.00', expense: '4000.00', savingsRate: '60.0' });
    expect(d.spendingByCategory[0]).toMatchObject({ name: 'Food', amount: '3000.00', percent: '100.0' });
    expect(d.cashFlow.at(-1)).toMatchObject({ month: '2026-11', income: '12000.00', expense: '3000.00' });
    expect(d.netWorthSeries.at(-1).amount).toBe('16000.00');
  });

  it('refuses to delete an account with history but allows archiving', async () => {
    const { api, bank } = await setup();
    await api.post('/api/transactions', { type: 'EXPENSE', amount: '1', date: '2026-11-01', accountId: bank.id, description: 'x' });
    expect((await api.delete(`/api/accounts/${bank.id}`)).status).toBe(409);
    expect((await api.patch(`/api/accounts/${bank.id}`, { isArchived: true })).body.isArchived).toBe(true);
    const add = await api.post('/api/transactions', { type: 'EXPENSE', amount: '1', date: '2026-11-01', accountId: bank.id, description: 'x' });
    expect(add.status).toBe(400);
  });

  it('searches, filters, paginates and exports CSV safely', async () => {
    const { api, bank, food } = await setup();
    for (let i = 1; i <= 5; i++) {
      await api.post('/api/transactions', { type: 'EXPENSE', amount: `${i}0`, date: `2026-11-0${i}`, accountId: bank.id, categoryId: food.id, description: i === 3 ? '=HYPERLINK("x")' : `Market ${i}` });
    }
    const page = (await api.get('/api/transactions?pageSize=2&page=2&sort=amount&order=asc')).body;
    expect(page.total).toBe(5);
    expect(page.items.map((t: { amount: string }) => t.amount)).toEqual(['30.00', '40.00']);
    expect((await api.get('/api/transactions?q=market')).body.total).toBe(4);
    expect((await api.get('/api/transactions?minAmount=25')).body.total).toBe(3);
    const csv = await api.get('/api/transactions/export.csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('duplicates a transaction', async () => {
    const { api, bank } = await setup();
    const t = await api.post('/api/transactions', { type: 'EXPENSE', amount: '42', date: '2026-01-01', accountId: bank.id, description: 'Gym' });
    const d = await api.post(`/api/transactions/${t.body.id}/duplicate`);
    expect(d.status).toBe(201);
    expect(d.body.id).not.toBe(t.body.id);
    expect(d.body.amount).toBe('42.00');
  });
});

describe('budgets', () => {
  it('tracks consumption and notifies once per threshold and period', async () => {
    const { api, bank, food } = await setup();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date());
    const b = await api.post('/api/budgets', { name: 'Food', period: 'MONTHLY', amount: '1000', categoryId: food.id });
    expect(b.status).toBe(201);
    await api.post('/api/transactions', { type: 'EXPENSE', amount: '760', date: today, accountId: bank.id, categoryId: food.id, description: 'Groceries' });
    let list = (await api.get('/api/budgets')).body.items;
    expect(list[0].current).toMatchObject({ spent: '760.00', remaining: '240.00', percent: '76.0', threshold: 75, state: 'warning' });
    await api.post('/api/transactions', { type: 'EXPENSE', amount: '10', date: today, accountId: bank.id, categoryId: food.id, description: 'Bread' });
    let notes = (await api.get('/api/notifications')).body;
    expect(notes.items.filter((n: { type: string }) => n.type === 'BUDGET_THRESHOLD')).toHaveLength(1);
    await api.post('/api/transactions', { type: 'EXPENSE', amount: '300', date: today, accountId: bank.id, categoryId: food.id, description: 'Feast' });
    list = (await api.get('/api/budgets')).body.items;
    expect(list[0].current.state).toBe('over');
    notes = (await api.get('/api/notifications')).body;
    expect(notes.items.map((n: { title: string }) => n.title)).toEqual(['Food budget reached', 'Food budget at 75%']);
    expect(notes.unread).toBe(2);
  });

  it('rejects income categories for budgets', async () => {
    const { api, salary } = await setup();
    const r = await api.post('/api/budgets', { name: 'x', period: 'WEEKLY', amount: '100', categoryId: salary.id });
    expect(r.status).toBe(400);
  });
});
