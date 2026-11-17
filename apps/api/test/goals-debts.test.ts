import { describe, expect, it } from 'vitest';
import { authed, signUp } from './helpers';

async function setup() {
  const s = await signUp();
  const api = authed(s.token);
  const bank = (await api.post('/api/accounts', { name: 'Bank', type: 'BANK', currency: 'MAD', openingBalance: '1000.00' })).body;
  return { api, bank };
}

describe('savings goals', () => {
  it('tracks deposits and withdrawals and refuses to go below zero', async () => {
    const { api } = await setup();
    const g = await api.post('/api/goals', { name: 'Trip', targetAmount: '1000', currency: 'MAD', deadline: '2099-12-31' });
    expect(g.status).toBe(201);
    expect(g.body.saved).toBe('0.00');
    let r = await api.post(`/api/goals/${g.body.id}/contributions`, { amount: '250,50', date: '2026-11-01' });
    expect(r.status).toBe(201);
    expect(r.body.saved).toBe('250.50');
    expect(r.body.percent).toBe('25.0'); // 25.05 → half-even
    expect(r.body.remaining).toBe('749.50');
    expect(r.body.monthlyNeeded).not.toBeNull();
    r = await api.post(`/api/goals/${g.body.id}/contributions`, { amount: '300', kind: 'WITHDRAWAL', date: '2026-11-02' });
    expect(r.status).toBe(400);
    r = await api.post(`/api/goals/${g.body.id}/contributions`, { amount: '50.50', kind: 'WITHDRAWAL', date: '2026-11-02' });
    expect(r.body.saved).toBe('200.00');
    // Removing the deposit would leave the withdrawal below zero.
    const deposit = r.body.contributions.find((c: { amount: string }) => c.amount === '250.50');
    expect((await api.delete(`/api/goals/${g.body.id}/contributions/${deposit.id}`)).status).toBe(400);
  });

  it('archives goals and isolates them between users', async () => {
    const { api } = await setup();
    const g = (await api.post('/api/goals', { name: 'Car', targetAmount: '50000' })).body;
    const other = authed((await signUp('Other')).token);
    expect((await other.get(`/api/goals/${g.id}`)).status).toBe(404);
    expect((await other.post(`/api/goals/${g.id}/contributions`, { amount: '1', date: '2026-11-01' })).status).toBe(404);
    await api.patch(`/api/goals/${g.id}`, { archived: true });
    expect((await api.get('/api/goals')).body.items).toHaveLength(0);
    expect((await api.get('/api/goals?archived=true')).body.items).toHaveLength(1);
  });
});

describe('debts', () => {
  it('moves the account, leaves net worth and income unchanged, and settles on full repayment', async () => {
    const { api, bank } = await setup();
    const d = await api.post('/api/debts', {
      direction: 'BORROWED',
      counterparty: 'Karim',
      principal: '500',
      currency: 'MAD',
      startDate: '2026-11-05',
      accountId: bank.id,
    });
    expect(d.status).toBe(201);
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('1500.00');
    let dash = (await api.get('/api/dashboard?from=2026-11-01&to=2026-11-30')).body;
    expect(dash.netWorth.amount).toBe('1000.00');
    expect(dash.current.income).toBe('0.00');

    // The loan row can't be edited from Transactions.
    const loanTx = (await api.get('/api/transactions')).body.items[0];
    expect(loanTx.debtId).toBe(d.body.id);
    expect((await api.patch(`/api/transactions/${loanTx.id}`, { amount: '1' })).status).toBe(409);
    expect((await api.delete(`/api/transactions/${loanTx.id}`)).status).toBe(409);

    expect((await api.post(`/api/debts/${d.body.id}/payments`, { amount: '600', date: '2026-11-10' })).status).toBe(400);
    let p = await api.post(`/api/debts/${d.body.id}/payments`, { amount: '200', date: '2026-11-10', accountId: bank.id });
    expect(p.body.remaining).toBe('300.00');
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('1300.00');
    p = await api.post(`/api/debts/${d.body.id}/payments`, { amount: '300', date: '2026-11-12', accountId: bank.id });
    expect(p.body.settled).toBe(true);
    dash = (await api.get('/api/dashboard?from=2026-11-01&to=2026-11-30')).body;
    expect(dash.netWorth.amount).toBe('1000.00');
    expect(dash.current.expense).toBe('0.00');

    // Removing a repayment reopens the debt and restores the balance.
    const r = await api.delete(`/api/debts/${d.body.id}/payments/${p.body.payments[0].id}`);
    expect(r.body.settled).toBe(false);
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('1300.00');

    // Deleting the debt removes every movement it created.
    expect((await api.delete(`/api/debts/${d.body.id}`)).status).toBe(204);
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('1000.00');
  });

  it('counts money lent without an account as an asset and rejects a currency mismatch', async () => {
    const { api, bank } = await setup();
    const lent = await api.post('/api/debts', { direction: 'LENT', counterparty: 'Sara', principal: '250', startDate: '2026-11-01' });
    expect(lent.status).toBe(201);
    const dash = (await api.get('/api/dashboard?from=2026-11-01&to=2026-11-30')).body;
    expect(dash.netWorth.amount).toBe('1250.00');
    const eur = await api.post('/api/debts', {
      direction: 'BORROWED',
      counterparty: 'Bank',
      principal: '100',
      currency: 'EUR',
      startDate: '2026-11-01',
      accountId: bank.id,
    });
    expect(eur.status).toBe(400);
  });
});
