import { formatMoney, money, type Currency } from '@mizan/shared';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/stores/auth';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function useLocale() {
  return useAuth((s) => s.settings?.locale ?? 'fr-MA');
}

export function fmtMoney(
  value: string,
  currency: Currency,
  locale: string,
  opts: { signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'; compact?: boolean } = {},
) {
  return formatMoney(value, currency, { locale, ...opts });
}

/** Splits a formatted amount so the currency code can be set in a lighter weight. */
export function splitMoney(value: string, currency: Currency, locale: string) {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code' }).formatToParts(
    Number(money(value).toFixed(2)),
  );
  const number = parts
    .filter((p) => p.type !== 'currency')
    .map((p) => p.value)
    .join('')
    .trim();
  return { number, currency };
}

export function fmtDate(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }).format(new Date(`${iso}T00:00:00Z`));
}

export function fmtMonth(key: string, locale: string, style: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
}

/** Relative day label for transaction groups: Today, Yesterday, or a date. */
export function dayLabel(iso: string, today: string, locale: string) {
  if (iso === today) return 'Today';
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (iso === y.toISOString().slice(0, 10)) return 'Yesterday';
  return fmtDate(iso, locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function pctChange(current: string, previous: string): number | null {
  const p = money(previous);
  if (p.isZero()) return null;
  return Number(money(current).minus(p).div(p.abs()).times(100).toFixed(1));
}

/** "52,9 %" in French locales, "52.9%" in English — never a hard-coded dot. */
export function fmtPct(value: string | number, locale: string, opts: { signed?: boolean } = {}) {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, signDisplay: opts.signed ? 'exceptZero' : 'auto' }).format(Number(value) / 100);
}

export function usePct() {
  const locale = useLocale();
  return (value: string | number, opts?: { signed?: boolean }) => fmtPct(value, locale, opts);
}
