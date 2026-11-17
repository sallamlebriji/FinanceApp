import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, authed, signUp } from './helpers';

const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('reports', () => {
  it('summarises a period, excludes transfers, and exports XLSX and PDF', async () => {
    const s = await signUp();
    const api = authed(s.token);
    const bank = (await api.post('/api/accounts', { name: 'Bank', type: 'BANK', currency: 'MAD', openingBalance: '5000' })).body;
    const save = (await api.post('/api/accounts', { name: 'Save', type: 'SAVINGS', currency: 'MAD' })).body;
    const cats = (await api.get('/api/categories')).body.items as { id: string; name: string }[];
    const food = cats.find((c) => c.name === 'Food')!.id;
    const salary = cats.find((c) => c.name === 'Salary')!.id;
    const add = (b: object) => api.post('/api/transactions', { accountId: bank.id, ...b });
    await add({ type: 'INCOME', amount: '10000', date: '2026-10-01', categoryId: salary, description: 'Salary' });
    await add({ type: 'EXPENSE', amount: '300', date: '2026-10-05', categoryId: food, description: 'Marjane' });
    await add({ type: 'EXPENSE', amount: '200', date: '2026-10-12', categoryId: food, description: 'marjane ' });
    await add({ type: 'EXPENSE', amount: '120', date: '2026-10-06', description: 'Taxi' });
    await add({ type: 'TRANSFER', amount: '1000', date: '2026-10-07', toAccountId: save.id, description: 'Save' });
    await add({ type: 'EXPENSE', amount: '50', date: '2026-09-20', categoryId: food, description: 'Marjane' });

    const q = 'from=2026-10-01&to=2026-10-31';
    const r = (await api.get(`/api/reports?${q}`)).body;
    expect(r.totals.income).toBe('10000.00');
    expect(r.totals.expense).toBe('620.00');
    expect(r.totals.net).toBe('9380.00');
    expect(r.totals.savingsRate).toBe('93.8');
    expect(r.totals.averageDailySpend).toBe('20.00'); // 620 / 31
    expect(r.totals.transactionCount).toBe(5);
    const foodRow = r.expenseByCategory.find((c: { name: string }) => c.name === 'Food');
    expect(foodRow.amount).toBe('500.00');
    expect(foodRow.previous).toBe('50.00');
    expect(r.topPayees[0]).toMatchObject({ description: 'Marjane', amount: '500.00', count: 2 });
    expect(r.largestExpenses[0].amount).toBe('300.00');
    expect(r.byWeekday).toHaveLength(7);
    expect(r.byWeekday.reduce((s: number, d: { amount: string }) => s + Number(d.amount), 0)).toBe(620);

    const xlsx = await request(app).get(`/api/reports/export.xlsx?${q}`).set('Authorization', `Bearer ${s.token}`).buffer(true).parse(binary);
    expect(xlsx.status).toBe(200);
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    const pdf = await request(app).get(`/api/reports/export.pdf?${q}`).set('Authorization', `Bearer ${s.token}`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    expect((await request(app).get(`/api/reports?${q}`)).status).toBe(401);
  });
});
