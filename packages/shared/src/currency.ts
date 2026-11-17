import type Decimal from 'decimal.js';
import { money, type Currency, type MoneyInput } from './money';

/** 1 unit of `base` = `rate` units of `quote`. */
export interface RateQuote {
  base: Currency;
  quote: Currency;
  rate: string;
}

export class MissingRateError extends Error {
  constructor(
    public readonly from: Currency,
    public readonly to: Currency,
  ) {
    super(`No exchange rate available for ${from} → ${to}`);
    this.name = 'MissingRateError';
  }
}

export interface Converter {
  canConvert(from: Currency, to: Currency): boolean;
  /** Throws MissingRateError when no direct, inverse or triangulated rate exists. */
  convert(amount: MoneyInput, from: Currency, to: Currency): Decimal;
}

/**
 * Builds a converter from explicit rate quotes. Currencies are never mixed implicitly:
 * a conversion only happens through a recorded rate (direct, inverse, or one hop through
 * a pivot currency).
 */
export function createConverter(quotes: RateQuote[]): Converter {
  const direct = new Map<string, Decimal>();
  for (const q of quotes) {
    const r = money(q.rate);
    if (r.lte(0)) continue;
    direct.set(`${q.base}>${q.quote}`, r);
    if (!direct.has(`${q.quote}>${q.base}`)) direct.set(`${q.quote}>${q.base}`, money(1).div(r));
  }
  const currencies = new Set<Currency>(quotes.flatMap((q) => [q.base, q.quote]));

  function rate(from: Currency, to: Currency): Decimal | null {
    if (from === to) return money(1);
    const d = direct.get(`${from}>${to}`);
    if (d) return d;
    for (const pivot of currencies) {
      const a = direct.get(`${from}>${pivot}`);
      const b = direct.get(`${pivot}>${to}`);
      if (a && b) return a.times(b);
    }
    return null;
  }

  return {
    canConvert: (from, to) => rate(from, to) !== null,
    convert(amount, from, to) {
      const r = rate(from, to);
      if (!r) throw new MissingRateError(from, to);
      return money(amount).times(r);
    },
  };
}
