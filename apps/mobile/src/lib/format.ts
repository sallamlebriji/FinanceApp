import { formatMoney, money, todayInTimeZone, type Currency } from '@mizan/shared';
import { useAuth } from '@/stores/auth';

export function useLocale() {
  return useAuth((s) => s.settings?.locale ?? 'fr-MA');
}

export function useToday() {
  const tz = useAuth((s) => s.settings?.timezone);
  return todayInTimeZone(tz);
}

export function fmtMoney(
  value: string,
  currency: Currency,
  locale: string,
  opts: { signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'; compact?: boolean } = {},
) {
  return formatMoney(value, currency, { locale, ...opts });
}

export function fmtDate(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }).format(new Date(`${iso}T00:00:00Z`));
}

export function fmtMonth(key: string, locale: string, style: 'short' | 'long' | 'narrow' = 'short') {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
}

export function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Relative day label for transaction groups: Today, Yesterday, or a date. */
export function dayLabel(iso: string, today: string, locale: string) {
  if (iso === today) return 'Today';
  if (iso === shiftDays(today, -1)) return 'Yesterday';
  const label = fmtDate(iso, locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

/** Shows a stored decimal ("37.25") the way the person types it ("37,25" in fr-MA). */
export function toInputAmount(value: string, locale: string) {
  const sep = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
  return value.replace('.', sep);
}

export function pctChange(current: string, previous: string): number | null {
  const p = money(previous);
  if (p.isZero()) return null;
  return Number(money(current).minus(p).div(p.abs()).times(100).toFixed(1));
}

/** Percent from the API's decimal string, in the person's number format ("92,5 %"). */
export function fmtPct(value: string | number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(value)) + '\u00A0%';
}
