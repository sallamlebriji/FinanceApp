import type { ISODate } from '@mizan/shared';
import { money } from '@mizan/shared';

type DecimalLike = { toString(): string } | string | number;

/** Decimal → fixed 2-dp string. */
export function amount(v: DecimalLike): string;
export function amount(v: DecimalLike | null | undefined): string | null;
export function amount(v: DecimalLike | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return money(v.toString()).toFixed(2);
}

/** Calendar-date column → "YYYY-MM-DD". */
export function isoDate(d: Date): ISODate;
export function isoDate(d: Date | null | undefined): ISODate | null;
export function isoDate(d: Date | null | undefined): ISODate | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** "YYYY-MM-DD" → Date at UTC midnight for DATE columns. */
export function dateValue(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
