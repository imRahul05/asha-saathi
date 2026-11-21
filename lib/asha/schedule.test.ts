import { describe, expect, it } from 'vitest';
import { daysUntil, dueNowCount, formatDueDate, groupOf, groupSchedule, todayInIndia } from './schedule';
import type { SnapshotScheduleItem } from '@/lib/snapshot-types';

const item = (id: string, dueDate: string, status: SnapshotScheduleItem['status']): SnapshotScheduleItem => ({
  id, dueDate, status, reason: null, beneficiary: { name: id, village: null },
});

describe('schedule grouping', () => {
  const today = '2026-11-21';
  it('groups by days until due', () => {
    expect(groupOf(-2)).toBe('overdue');
    expect(groupOf(0)).toBe('today');
    expect(groupOf(1)).toBe('tomorrow');
    expect(groupOf(7)).toBe('week');
    expect(groupOf(8)).toBe('later');
  });
  it('trusts the server status for overdue and today', () => {
    expect(daysUntil(item('a', '2026-11-21', 'overdue'), today)).toBe(-1);
    expect(daysUntil(item('b', '2026-11-20', 'today'), today)).toBe(0);
    expect(daysUntil(item('c', '2026-11-24', 'upcoming'), today)).toBe(3);
  });
  it('orders groups and counts what is due now', () => {
    const items = [item('later', '2026-12-30', 'upcoming'), item('od', '2026-11-19', 'overdue'), item('now', '2026-11-21', 'today')];
    expect(groupSchedule(items, today).map((g) => g.group)).toEqual(['overdue', 'today', 'later']);
    expect(dueNowCount(items, today)).toBe(2);
  });
  it('formats a weekday and date, and returns the India calendar day', () => {
    expect(formatDueDate('2026-11-24', 'en')).toBe('Tue 24 Nov');
    expect(todayInIndia(new Date('2026-11-21T20:00:00Z'))).toBe('2026-11-22');
  });
});
