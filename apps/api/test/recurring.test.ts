import { todayInTimeZone } from '@mizan/shared';
import { describe, expect, it } from 'vitest';
import { generateForUser } from '../src/modules/recurring/recurring.service';
import { authed, signUp } from './helpers';

/** ISO date `months` before today, on day `day` (clamped to 28 to stay valid). */
function monthsAgo(months: number, day: number) {
  const t = todayInTimeZone('Africa/Casablanca');
  const d = new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1 - months, Math.min(day, 28)));
  return d.toISOString().slice(0, 10);
}

async function setup() {
  const s = await signUp();
  const api = authed(s.token);
  const bank = (await api.post('/api/accounts', { name: 'Bank', type: 'BANK', currency: 'MAD', openingBalance: '10000' })).body;
  const eur = (await api.post('/api/accounts', { name: 'Euro', type: 'BANK', currency: 'EUR' })).body;
  const cats = (await api.get('/api/categories')).body.items as { id: string; name: string }[];
  return { s, api, bank, eur, rent: cats.find((c) => c.name === 'Housing')! };
}

describe('recurring transactions', () => {
  it('posts every past occurrence once, even when the generator runs again', async () => {
    const { s, api, bank, rent } = await setup();
    const start = monthsAgo(2, 1);
    const r = await api.post('/api/recurring', {
      type: 'EXPENSE',
      amount: '3000',
      accountId: bank.id,
      categoryId: rent.id,
      description: 'Rent',
      frequency: 'MONTHLY',
      startDate: start,
    });
    expect(r.status).toBe(201);
    expect(r.body.monthlyAmount).toBe('3000.00');
    expect(r.body.nextDate > start).toBe(true);

    const list = async () => (await api.get('/api/transactions?q=Rent')).body;
    expect((await list()).total).toBe(3); // two months ago, last month, this month
    expect(await generateForUser(s.user.id)).toBe(0);
    expect((await api.get('/api/recurring')).status).toBe(200);
    expect((await list()).total).toBe(3);
    expect((await api.get(`/api/accounts/${bank.id}`)).body.balance).toBe('1000.00');
  });

  it('stops at the end date, can be paused, and keeps posted rows when deleted', async () => {
    const { api, bank } = await setup();
    const r = await api.post('/api/recurring', {
      type: 'INCOME',
      amount: '100',
      accountId: bank.id,
      description: 'Allowance',
      frequency: 'WEEKLY',
      startDate: monthsAgo(1, 1),
      endDate: monthsAgo(1, 15),
    });
    expect(r.status).toBe(201);
    expect(r.body.nextDate).toBeNull();
    expect(r.body.isActive).toBe(false);
    const posted = (await api.get('/api/transactions?q=Allowance')).body.total;
    expect(posted).toBeGreaterThanOrEqual(2);
    expect(posted).toBeLessThanOrEqual(3);

    const p = await api.patch(`/api/recurring/${r.body.id}`, { isActive: false, amount: '120' });
    expect(p.body.amount).toBe('120.00');
    expect((await api.delete(`/api/recurring/${r.body.id}`)).status).toBe(204);
    expect((await api.get('/api/transactions?q=Allowance')).body.total).toBe(posted);
  });

  it('rejects cross-currency transfers and other users’ accounts', async () => {
    const { api, bank, eur } = await setup();
    const fx = await api.post('/api/recurring', {
      type: 'TRANSFER',
      amount: '100',
      accountId: bank.id,
      toAccountId: eur.id,
      description: 'Save',
      frequency: 'MONTHLY',
      startDate: monthsAgo(0, 1),
    });
    expect(fx.status).toBe(400);
    const other = authed((await signUp('Other')).token);
    const cross = await other.post('/api/recurring', {
      type: 'EXPENSE',
      amount: '1',
      accountId: bank.id,
      description: 'x',
      frequency: 'DAILY',
      startDate: monthsAgo(0, 1),
    });
    expect(cross.status).toBe(404);
  });
});
