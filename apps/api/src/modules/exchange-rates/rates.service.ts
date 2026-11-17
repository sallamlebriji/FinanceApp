import { createConverter, type Converter, type Currency, type RateQuote } from '@mizan/shared';
import { prisma } from '../../lib/prisma';

/** Latest recorded rate for every currency pair of the user (optionally as of a date). */
export async function latestRates(userId: string, asOf?: Date): Promise<RateQuote[]> {
  const rows = await prisma.exchangeRate.findMany({
    where: { userId, ...(asOf ? { date: { lte: asOf } } : {}) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  const seen = new Set<string>();
  const quotes: RateQuote[] = [];
  for (const r of rows) {
    const key = `${r.base}>${r.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    quotes.push({ base: r.base as Currency, quote: r.quote as Currency, rate: r.rate.toString() });
  }
  return quotes;
}

export async function converterFor(userId: string, asOf?: Date): Promise<Converter> {
  return createConverter(await latestRates(userId, asOf));
}
