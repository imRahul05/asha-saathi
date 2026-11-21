import type { SnapshotScheduleItem } from '@/lib/snapshot-types';

export type ScheduleGroup = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';
export const SCHEDULE_GROUPS: ScheduleGroup[] = ['overdue', 'today', 'tomorrow', 'week', 'later'];

/** Today's date in India (YYYY-MM-DD): the server computes `status` against the same calendar. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Whole days from today to the due date: negative when overdue. */
export function daysUntil(item: Pick<SnapshotScheduleItem, 'dueDate' | 'status'>, today: string): number {
  const diff = Math.round(dayNumber(item.dueDate) - dayNumber(today));
  if (item.status === 'overdue') return Math.min(diff, -1);
  if (item.status === 'today') return 0;
  return Math.max(diff, 0);
}

export function groupOf(days: number): ScheduleGroup {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  return 'later';
}

export type ScheduleRow = { item: SnapshotScheduleItem; days: number };

/** Items grouped by when they are due, earliest first inside each group. Empty groups are left out. */
export function groupSchedule(items: SnapshotScheduleItem[], today: string): { group: ScheduleGroup; rows: ScheduleRow[] }[] {
  const rows = items
    .map((item) => ({ item, days: daysUntil(item, today) }))
    .sort((a, b) => a.days - b.days || a.item.beneficiary.name.localeCompare(b.item.beneficiary.name));
  return SCHEDULE_GROUPS.map((group) => ({ group, rows: rows.filter((r) => groupOf(r.days) === group) })).filter((g) => g.rows.length > 0);
}

/** How many visits need her attention now: overdue plus today. */
export function dueNowCount(items: SnapshotScheduleItem[], today: string): number {
  return items.filter((i) => daysUntil(i, today) <= 0).length;
}

/** "Mon 24 Nov" in the interface language. The date is a calendar day, so it is formatted in UTC to avoid a day shift. */
export function formatDueDate(ymd: string, lang: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const locale = lang === 'en' ? 'en-GB' : `${lang}-IN`;
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return ymd;
  }
}
