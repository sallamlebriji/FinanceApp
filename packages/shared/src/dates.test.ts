import { describe, expect, it } from 'vitest';
import { addMonths, isISODate, monthKeys, monthRange, previousPeriod, resolvePeriod, todayInTimeZone, weekRange } from './dates';

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
