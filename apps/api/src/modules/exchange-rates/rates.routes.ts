import { currencySchema, isoDateSchema, money, todayInTimeZone, type ExchangeRateDTO } from '@mizan/shared';
import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { prisma, type ExchangeRate } from '../../lib/prisma';
import { dateValue, isoDate } from '../../lib/serialize';
import { uid } from '../../middleware/auth';

const rateSchema = z
  .object({
    base: currencySchema,
    quote: currencySchema,
    rate: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).replace(',', '.'))
      .refine((v) => /^\d{1,10}(\.\d{1,8})?$/.test(v) && money(v).gt(0), 'Enter a positive rate with up to 8 decimals'),
    date: isoDateSchema.optional(),
  })
  .refine((v) => v.base !== v.quote, 'Choose two different currencies');

const toDTO = (r: ExchangeRate): ExchangeRateDTO => ({
  id: r.id,
  base: r.base,
  quote: r.quote,
  rate: money(r.rate.toString()).toFixed(),
  date: isoDate(r.date),
  source: r.source,
});

export const ratesRouter = Router();

ratesRouter.get('/', async (req, res) => {
  const rows = await prisma.exchangeRate.findMany({ where: { userId: uid(req) }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 200 });
  res.json({ items: rows.map(toDTO) });
});

ratesRouter.post('/', async (req, res) => {
  const userId = uid(req);
  const input = rateSchema.parse(req.body);
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const date = dateValue(input.date ?? todayInTimeZone(settings?.timezone));
  const row = await prisma.exchangeRate.upsert({
    where: { userId_base_quote_date: { userId, base: input.base, quote: input.quote, date } },
    create: { userId, base: input.base, quote: input.quote, rate: input.rate, date, source: 'manual' },
    update: { rate: input.rate, source: 'manual' },
  });
  res.status(201).json(toDTO(row));
});

ratesRouter.delete('/:id', async (req, res) => {
  const r = await prisma.exchangeRate.deleteMany({ where: { id: String(req.params.id), userId: uid(req) } });
  if (r.count === 0) throw notFound('Exchange rate');
  res.status(204).end();
});

