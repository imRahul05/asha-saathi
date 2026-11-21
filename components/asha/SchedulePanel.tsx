'use client';

import { useMemo } from 'react';
import { CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SnapshotScheduleItem } from '@/lib/snapshot-types';
import type { Strings, UiLang } from '@/lib/i18n';
import { formatDueDate, groupSchedule, todayInIndia, type ScheduleGroup } from '@/lib/asha/schedule';

const groupLabel = (s: Strings, g: ScheduleGroup) =>
  ({ overdue: s.schedOverdue, today: s.schedToday, tomorrow: s.schedTomorrow, week: s.schedWeek, later: s.schedLater })[g];

const relative = (s: Strings, days: number) =>
  days < 0 ? s.relOverdue(-days) : days === 0 ? s.relToday : days === 1 ? s.relTomorrow : s.relInDays(days);

/** The planned follow-up visits, grouped by when they are due. */
export function SchedulePanel({ schedule, s, lang }: { schedule: SnapshotScheduleItem[]; s: Strings; lang: UiLang }) {
  const groups = useMemo(() => groupSchedule(schedule, todayInIndia()), [schedule]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-asha-line bg-white/60 px-6 py-10 text-center">
        <CalendarCheck className="h-10 w-10 text-asha-teal" aria-hidden />
        <p className="max-w-sm text-lg leading-7 text-asha-ink">{s.schedEmpty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {groups.map(({ group, rows }) => {
        const overdue = group === 'overdue';
        return (
          <section key={group} aria-label={groupLabel(s, group)}>
            <h3 className={cn('mb-2 flex items-center gap-2 px-1 text-lg font-extrabold', overdue ? 'text-asha-red' : 'text-asha-ink')}>
              {groupLabel(s, group)}
              <span className={cn('rounded-full px-2.5 py-0.5 text-base font-bold', overdue ? 'bg-asha-red-soft text-asha-red' : 'bg-asha-sand text-asha-ink')}>{rows.length}</span>
            </h3>
            <ul className="space-y-2">
              {rows.map(({ item, days }) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3',
                    overdue ? 'border-asha-red/30 bg-asha-red-soft' : 'border-asha-line bg-white',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold leading-6 text-asha-ink">{item.beneficiary.name}</p>
                    <p className="truncate text-base leading-6 text-asha-ink/80">
                      {[item.beneficiary.village, item.reason].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-base font-bold leading-6', overdue ? 'text-asha-red' : 'text-asha-teal')}>{relative(s, days)}</p>
                    <p className="text-base leading-6 text-asha-ink/80">{formatDueDate(item.dueDate, lang)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
