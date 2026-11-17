import { describe, expect, it } from 'vitest';
import { addMonths, dueOccurrences, nextOccurrence, isISODate, monthKeys, monthRange, previousPeriod, resolvePeriod, todayInTimeZone, weekRange } from './dates';

describe('dates', () => {
  it('validates real calendar dates', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
  });

  it('respects the user time zone for "today"', () => {
    const instant = new Date('2026-11-30T23:30:00Z');
    expect(todayInTimeZone('Africa/Casablanca', instant)).toBe('2026-12-01'); // UTC+1
    expect(todayInTimeZone('America/New_York', instant)).toBe('2026-11-30');
  });

  it('clamps month arithmetic to month end and keeps the anchor day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
  });

  it('computes month, week and comparison periods', () => {
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(weekRange('2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-22' }); // Monday
    expect(previousPeriod(monthRange('2026-03-15'))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(previousPeriod({ from: '2026-11-10', to: '2026-11-16' })).toEqual({ from: '2026-11-03', to: '2026-11-09' });
    expect(resolvePeriod('last-3-months', '2026-11-16')).toEqual({ from: '2026-09-01', to: '2026-11-30' });
    expect(monthKeys({ from: '2026-11-05', to: '2027-01-02' })).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('recurring schedules', () => {
  it('keeps the anchor day across short months', () => {
    expect(nextOccurrence('2026-01-31', 'MONTHLY', 1, 31)).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', 'MONTHLY', 1, 31)).toBe('2026-03-31');
    expect(nextOccurrence('2028-02-29', 'YEARLY', 1, 29)).toBe('2029-02-28');
    expect(nextOccurrence('2026-11-17', 'WEEKLY', 2)).toBe('2026-12-01');
    expect(nextOccurrence('2026-11-30', 'QUARTERLY', 1, 30)).toBe('2027-02-28');
  });

  it('lists every due occurrence once and respects the end date', () => {
    const r = dueOccurrences({ nextDate: '2026-09-15', frequency: 'MONTHLY', anchorDay: 15 }, '2026-11-17');
    expect(r.dates).toEqual(['2026-09-15', '2026-10-15', '2026-11-15']);
    expect(r.next).toBe('2026-12-15');
    expect(r.finished).toBe(false);
    const ended = dueOccurrences({ nextDate: '2026-11-01', frequency: 'DAILY', endDate: '2026-11-03' }, '2026-11-17');
    expect(ended.dates).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(ended.finished).toBe(true);
    expect(dueOccurrences({ nextDate: '2026-12-01', frequency: 'MONTHLY' }, '2026-11-17').dates).toEqual([]);
  });
});
