import Decimal from 'decimal.js';

/**
 * All monetary arithmetic goes through decimal.js. Never use JS numbers for money.
 * Banker's rounding (half-even) avoids systematic bias when aggregating.
 */
export const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export type Money = Decimal;
export type MoneyInput = Decimal.Value;

export const SUPPORTED_CURRENCIES = ['MAD', 'EUR', 'USD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'MAD';

/** Minor-unit scale per currency (all supported currencies use 2). */
export const CURRENCY_SCALE: Record<Currency, number> = { MAD: 2, EUR: 2, USD: 2 };

export function money(value: MoneyInput | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Money(0);
  return new Money(value);
}

export const ZERO = money(0);

export function sumMoney(values: Iterable<MoneyInput>): Decimal {
  let total = new Money(0);
  for (const v of values) total = total.plus(v);
  return total;
}

/** Round to the currency scale and serialise as a fixed-point string, e.g. "1234.50". */
export function toAmountString(value: MoneyInput, currency: Currency = DEFAULT_CURRENCY): string {
  const scale = CURRENCY_SCALE[currency];
  return money(value).toDecimalPlaces(scale, Money.ROUND_HALF_EVEN).toFixed(scale);
}

/**
 * Locale-aware display. Intl.NumberFormat accepts decimal strings (ES2023), which keeps
 * precision for large values; we fall back to Number for older engines.
 */
export function formatMoney(
  value: MoneyInput,
  currency: Currency = DEFAULT_CURRENCY,
  opts: { locale?: string; signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'; compact?: boolean } = {},
): string {
  const { locale = 'fr-MA', signDisplay = 'auto', compact = false } = opts;
  const fixed = toAmountString(value, currency);
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    signDisplay,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : CURRENCY_SCALE[currency],
    maximumFractionDigits: compact ? 1 : CURRENCY_SCALE[currency],
  });
  try {
    return fmt.format(fixed as unknown as number);
  } catch {
    return fmt.format(Number(fixed));
  }
}

/** Percentage helper returning a Decimal rounded to 1 decimal place. */
export function percent(part: MoneyInput, whole: MoneyInput): Decimal | null {
  const w = money(whole);
  if (w.isZero()) return null;
  return money(part).div(w).times(100).toDecimalPlaces(1, Money.ROUND_HALF_EVEN);
}
