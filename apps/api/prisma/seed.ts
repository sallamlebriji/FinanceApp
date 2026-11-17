/**
 * Development seed — creates a demo user with ~6 months of realistic Moroccan household data.
 * Refuses to run in production. Demo sign-in (local only):
 *   email:    demo@mizan.local
 *   password: MizanDemo2026
 */
import { addDays, addMonths, money, monthRange, todayInTimeZone } from '@mizan/shared';
import { prisma } from '../src/lib/prisma';
import { register } from '../src/modules/auth/auth.service';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

const EMAIL = 'demo@mizan.local';
const PASSWORD = 'MizanDemo2026';

// Deterministic pseudo-random generator so the seed is reproducible.
let state = 42;
const rand = () => ((state = (state * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const between = (min: number, max: number) => money(min + rand() * (max - min)).toDecimalPlaces(2).toFixed(2);
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await prisma.transaction.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const { user } = await register({ name: 'Salma', email: EMAIL, password: PASSWORD });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  const userId = user.id;
  const cats = await prisma.category.findMany({ where: { userId } });
  const cat = (key: string) => cats.find((c) => c.key === key)!.id;

  const today = todayInTimeZone('Africa/Casablanca');
  const start = addMonths(monthRange(today).from, -5);

  const [bank, cash, savings, euro] = await Promise.all([
    prisma.account.create({ data: { userId, name: 'CIH Current', type: 'BANK', currency: 'MAD', openingBalance: '8450.00', color: '#4B3FD1', institution: 'CIH Bank', sortOrder: 0 } }),
    prisma.account.create({ data: { userId, name: 'Cash wallet', type: 'CASH', currency: 'MAD', openingBalance: '600.00', color: '#2E9E62', sortOrder: 1 } }),
    prisma.account.create({ data: { userId, name: 'Savings', type: 'SAVINGS', currency: 'MAD', openingBalance: '12000.00', color: '#C9952B', institution: 'Attijariwafa', sortOrder: 2 } }),
    prisma.account.create({ data: { userId, name: 'Euro account', type: 'BANK', currency: 'EUR', openingBalance: '320.00', color: '#2F93B8', sortOrder: 3 } }),
  ]);

  await prisma.exchangeRate.createMany({
    data: [
      { userId, base: 'EUR', quote: 'MAD', rate: '10.8500', date: d(start), source: 'manual' },
      { userId, base: 'USD', quote: 'MAD', rate: '9.9500', date: d(start), source: 'manual' },
    ],
  });

  const rows: Record<string, unknown>[] = [];
  const push = (r: Record<string, unknown>) => rows.push({ userId, currency: "MAD", ...r });

  for (let m = 0; m < 6; m++) {
    const month = addMonths(start, m);
    const at = (day: number) => {
      const iso = addDays(month, day - 1);
      return iso <= today ? d(iso) : null;
    };
    const add = (day: number, r: Record<string, unknown>) => {
      const date = at(day);
      if (date) push({ date, ...r });
    };

    add(1, { type: 'EXPENSE', amount: '4200.00', accountId: bank.id, categoryId: cat('housing'), description: 'Rent', paymentMethod: 'TRANSFER' });
    add(3, { type: 'EXPENSE', amount: between(310, 420), accountId: bank.id, categoryId: cat('bills'), description: 'Lydec — water & electricity', paymentMethod: 'DIRECT_DEBIT' });
    add(4, { type: 'EXPENSE', amount: '249.00', accountId: bank.id, categoryId: cat('bills'), description: 'Maroc Telecom fibre', paymentMethod: 'DIRECT_DEBIT' });
    add(5, { type: 'EXPENSE', amount: '99.00', accountId: bank.id, categoryId: cat('subscriptions'), description: 'Netflix', paymentMethod: 'CARD' });
    add(6, { type: 'EXPENSE', amount: '59.99', accountId: bank.id, categoryId: cat('subscriptions'), description: 'Spotify', paymentMethod: 'CARD' });
    add(8, { type: 'EXPENSE', amount: '250.00', accountId: bank.id, categoryId: cat('healthcare'), description: 'Gym membership', paymentMethod: 'CARD' });
    for (const day of [2, 9, 16, 23]) {
      add(day, { type: 'EXPENSE', amount: between(380, 640), accountId: bank.id, categoryId: cat('food'), description: day === 16 ? 'Marjane' : 'Carrefour Market', paymentMethod: 'CARD' });
      add(day + 2, { type: 'EXPENSE', amount: between(40, 120), accountId: cash.id, categoryId: cat('food'), description: 'Souk — fruits & vegetables', paymentMethod: 'CASH' });
      add(day + 1, { type: 'EXPENSE', amount: between(60, 110), accountId: bank.id, categoryId: cat('transport'), description: 'Careem', paymentMethod: 'CARD' });
    }
    add(12, { type: 'EXPENSE', amount: between(280, 360), accountId: bank.id, categoryId: cat('transport'), description: 'Fuel — Afriquia', paymentMethod: 'CARD' });
    add(14, { type: 'EXPENSE', amount: between(160, 420), accountId: bank.id, categoryId: cat('restaurants'), description: 'Dinner out', paymentMethod: 'CARD' });
    add(21, { type: 'EXPENSE', amount: between(90, 180), accountId: cash.id, categoryId: cat('restaurants'), description: 'Café & pastries', paymentMethod: 'CASH' });
    if (m % 2 === 0) add(18, { type: 'EXPENSE', amount: between(350, 900), accountId: bank.id, categoryId: cat('shopping'), description: 'Morocco Mall', paymentMethod: 'CARD' });
    if (m === 2) add(20, { type: 'EXPENSE', amount: '2350.00', accountId: bank.id, categoryId: cat('travel'), description: 'Train & riad — Chefchaouen', paymentMethod: 'CARD' });
    if (m === 4) add(11, { type: 'EXPENSE', amount: '45.00', currency: 'EUR', accountId: euro.id, categoryId: cat('education'), description: 'Online course', paymentMethod: 'CARD' });
    add(7, { type: 'TRANSFER', amount: '800.00', accountId: bank.id, toAccountId: cash.id, toAmount: '800.00', toCurrency: 'MAD', description: 'ATM withdrawal' });
    add(28, { type: 'INCOME', amount: '16500.00', accountId: bank.id, categoryId: cat('salary'), description: 'Salary', paymentMethod: 'TRANSFER' });
    add(29, { type: 'TRANSFER', amount: '2000.00', accountId: bank.id, toAccountId: savings.id, toAmount: '2000.00', toCurrency: 'MAD', description: 'Monthly saving' });
    if (m % 3 === 1) add(19, { type: 'INCOME', amount: between(2500, 4200), accountId: bank.id, categoryId: cat('freelance'), description: 'Freelance — brand identity', paymentMethod: 'TRANSFER' });
  }

  await prisma.transaction.createMany({ data: rows as never });

  await prisma.budget.createMany({
    data: [
      { userId, name: 'Groceries', period: 'MONTHLY', amount: '2800.00', categoryId: cat('food') },
      { userId, name: 'Eating out', period: 'MONTHLY', amount: '500.00', categoryId: cat('restaurants') },
      { userId, name: 'Transport', period: 'WEEKLY', amount: '250.00', categoryId: cat('transport') },
      { userId, name: 'All spending', period: 'MONTHLY', amount: '11000.00' },
    ],
  });

  const goal = await prisma.savingsGoal.create({
    data: { userId, name: 'Emergency fund', targetAmount: '50000.00', deadline: d(addMonths(today, 10)), icon: 'piggy', color: '#2E9E62' },
  });
  const trip = await prisma.savingsGoal.create({
    data: { userId, name: 'Summer in Agadir', targetAmount: '9000.00', deadline: d(addMonths(today, 7)), icon: 'plane', color: '#2F93B8' },
  });
  await prisma.savingsContribution.createMany({
    data: [
      { goalId: goal.id, amount: '12000.00', date: d(start), note: 'Starting balance' },
      ...Array.from({ length: 5 }, (_, i) => ({ goalId: goal.id, amount: '2000.00', date: d(addDays(addMonths(start, i), 28)) })),
      { goalId: trip.id, amount: '1500.00', date: d(addMonths(start, 3)) },
      { goalId: trip.id, amount: '1200.00', date: d(addMonths(start, 5)) },
    ],
  });

  console.log(`Seeded ${rows.length} transactions for ${EMAIL} (password: ${PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
