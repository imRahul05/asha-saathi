import { describe, expect, it } from 'vitest';
import { dateColumnToIso, daysBetween, todayInIndia } from './dates';

describe('dates', () => {
  it('reads a DATE column (a JS Date at local midnight) as the same calendar day, in any server timezone', () => {
    expect(dateColumnToIso(new Date(2026, 10, 21))).toBe('2026-11-21'); // 21 Nov at local midnight
    expect(dateColumnToIso(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(dateColumnToIso('2026-11-21T00:00:00.000Z')).toBe('2026-11-21');
    expect(dateColumnToIso(null)).toBeNull();
  });

  it('counts days between two calendar dates and gives today in India', () => {
    expect(daysBetween('2026-11-21', '2026-11-24')).toBe(3);
    expect(daysBetween('2026-11-21', '2026-11-19')).toBe(-2);
    expect(todayInIndia(new Date('2026-11-21T19:00:00Z'))).toBe('2026-11-22'); // 00:30 IST next day
  });
});
