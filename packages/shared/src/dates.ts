/**
 * Calendar-date helpers. Transactions carry a *local calendar date* (YYYY-MM-DD) in the
 * user's timezone, so period maths runs on plain dates in UTC to avoid DST drift.
 */
export type ISODate = string; // YYYY-MM-DD

export const DEFAULT_TIMEZONE = 'Africa/Casablanca';
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!;
}

function parse(date: ISODate): Date {
  if (!isISODate(date)) throw new RangeError(`Invalid ISO date: ${date}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in the given IANA timezone. */
export function todayInTimeZone(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): ISODate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Adds months, clamping to the end of the target month (Jan 31 + 1 month = Feb 28/29).
 * `anchorDay` keeps recurring schedules on their original day (e.g. the 31st) when possible.
 */
export function addMonths(date: ISODate, months: number, anchorDay?: number): ISODate {
  const d = parse(date);
  const day = anchorDay ?? d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const clamped = Math.min(day, daysInMonth(target.getUTCFullYear(), target.getUTCMonth() + 1));
  target.setUTCDate(clamped);
  return fmt(target);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

export interface DateRange {
  from: ISODate;
  to: ISODate; // inclusive
}

export function monthRange(date: ISODate): DateRange {
  const d = parse(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(daysInMonth(y, m)).padStart(2, '0')}` };
}

/** Week range; weekStartsOn 1 = Monday (default in Morocco). */
export function weekRange(date: ISODate, weekStartsOn: 0 | 1 = 1): DateRange {
  const d = parse(date);
  const offset = (d.getUTCDay() - weekStartsOn + 7) % 7;
  const from = addDays(date, -offset);
  return { from, to: addDays(from, 6) };
}

export function yearRange(date: ISODate): DateRange {
  const y = date.slice(0, 4);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export const PERIOD_PRESETS = ['this-month', 'last-month', 'last-3-months', 'this-year', 'last-12-months'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export function resolvePeriod(preset: PeriodPreset, today: ISODate): DateRange {
  switch (preset) {
    case 'this-month':
      return monthRange(today);
    case 'last-month':
      return monthRange(addMonths(monthRange(today).from, -1));
    case 'last-3-months':
      return { from: addMonths(monthRange(today).from, -2), to: monthRange(today).to };
    case 'this-year':
      return yearRange(today);
    case 'last-12-months':
      return { from: addMonths(monthRange(today).from, -11), to: monthRange(today).to };
  }
}

/**
 * The comparison period: for whole calendar months it is the same number of preceding
 * months, otherwise the same number of preceding days.
 */
export function previousPeriod(range: DateRange): DateRange {
  const isWholeMonths = range.from.endsWith('-01') && monthRange(range.to).to === range.to;
  if (isWholeMonths) {
    const months =
      (+range.to.slice(0, 4) - +range.from.slice(0, 4)) * 12 + (+range.to.slice(5, 7) - +range.from.slice(5, 7)) + 1;
    const from = addMonths(range.from, -months);
    return { from, to: addDays(range.from, -1) };
  }
  const len = diffDays(range.from, range.to) + 1;
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

/** Enumerates YYYY-MM keys between two dates (inclusive). */
export function monthKeys(range: DateRange): string[] {
  const keys: string[] = [];
  let cursor = monthRange(range.from).from;
  while (cursor <= range.to) {
    keys.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, 1);
  }
  return keys;
}

export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** The occurrence after `date`. Month-based schedules keep `anchorDay` (31st → 28/29/30/31). */
export function nextOccurrence(date: ISODate, frequency: Frequency, interval = 1, anchorDay?: number | null): ISODate {
  const n = Math.max(1, Math.trunc(interval));
  switch (frequency) {
    case 'DAILY':
      return addDays(date, n);
    case 'WEEKLY':
      return addDays(date, 7 * n);
    case 'MONTHLY':
      return addMonths(date, n, anchorDay ?? undefined);
    case 'QUARTERLY':
      return addMonths(date, 3 * n, anchorDay ?? undefined);
    case 'YEARLY':
      return addMonths(date, 12 * n, anchorDay ?? undefined);
  }
}

/**
 * Occurrences from `nextDate` up to and including `until` (and `endDate`, if any), plus the
 * next date still to come. `limit` caps catch-up after a long pause.
 */
export function dueOccurrences(
  rule: { nextDate: ISODate; frequency: Frequency; interval?: number; anchorDay?: number | null; endDate?: ISODate | null },
  until: ISODate,
  limit = 400,
): { dates: ISODate[]; next: ISODate; finished: boolean } {
  const dates: ISODate[] = [];
  let d = rule.nextDate;
  const stop = rule.endDate && rule.endDate < until ? rule.endDate : until;
  while (d <= stop && dates.length < limit) {
    dates.push(d);
    d = nextOccurrence(d, rule.frequency, rule.interval, rule.anchorDay);
  }
  return { dates, next: d, finished: !!rule.endDate && d > rule.endDate };
}
