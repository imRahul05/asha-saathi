'use client';

import { Activity, CalendarDays, Check, ClipboardList, Droplets, Minus, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SnapshotVisit } from '@/lib/snapshot-types';
import type { Strings } from '@/lib/i18n';

/** What Saathi will NOT do, in plain words. Collapsed by default so it never crowds the screen. */
export function GoodToKnow({ s, className }: { s: Strings; className?: string }) {
  return (
    <details className={cn('rounded-2xl border border-asha-line bg-white px-4 py-3 text-left', className)}>
      <summary className="cursor-pointer text-base font-bold text-asha-ink">{s.goodToKnow}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-asha-muted">
        {s.cant.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

/** The four things Saathi picks out of a spoken visit report. Used for the hints and for the checklist. */
const FIELDS = (s: Strings) => [
  { key: 'bp', label: s.chipBp, Icon: Activity },
  { key: 'hb', label: s.chipHb, Icon: Droplets },
  { key: 'weeks', label: s.chipWeeks, Icon: CalendarDays },
  { key: 'symptoms', label: s.chipSymptoms, Icon: ClipboardList },
];

/** A thin strip above the conversation (phones show the visit on another tab, so the hint has to be here too). */
export function HintStrip({ s }: { s: Strings }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-asha-muted" aria-label={s.canRecordT}>
      <span className="font-semibold">{s.canRecordT}:</span>
      {FIELDS(s).map(({ key, label }) => (
        <span key={key} className="rounded-full border border-asha-line bg-white px-3 py-1 font-medium text-asha-ink">
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Before a visit is saved: what Saathi can record, with an example sentence.
 * After: a checklist of what was actually picked up (BP, Hb, weeks, symptoms), what is missing, and how long it took.
 */
export function RecordGuide({ visit, seconds, s }: { visit: SnapshotVisit | null; seconds?: number | null; s: Strings }) {
  if (!visit) {
    return (
      <section aria-label={s.canRecordT} className="space-y-4 rounded-3xl border border-asha-line bg-white p-5">
        <h3 className="text-xl font-extrabold">{s.canRecordT}</h3>
        <ul className="grid grid-cols-2 gap-2">
          {FIELDS(s).map(({ key, label, Icon }) => (
            <li key={key} className="flex items-center gap-2 rounded-2xl bg-asha-sand px-3 py-3 text-base font-semibold">
              <Icon className="h-5 w-5 shrink-0 text-asha-teal" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
        <div>
          <p className="text-sm font-semibold text-asha-muted">{s.youCanSay}</p>
          <p className="mt-1 rounded-2xl bg-asha-mint px-4 py-3 text-lg leading-8">“{s.example}”</p>
        </div>
        <p className="text-sm text-asha-muted">{s.visitEmpty}</p>
        <GoodToKnow s={s} />
      </section>
    );
  }

  const v = visit.vitals;
  const rows: Array<{ key: string; label: string; value: string | null; Icon: typeof Activity }> = [
    { key: 'bp', label: s.chipBp, value: v.bpSys != null && v.bpDia != null ? `${v.bpSys}/${v.bpDia}` : null, Icon: Activity },
    { key: 'hb', label: s.chipHb, value: v.hb != null ? String(v.hb) : null, Icon: Droplets },
    { key: 'weeks', label: s.chipWeeks, value: visit.beneficiary.weeks != null ? String(visit.beneficiary.weeks) : null, Icon: CalendarDays },
    { key: 'symptoms', label: s.chipSymptoms, value: v.symptoms.length > 0 ? String(v.symptoms.length) : s.noneMentioned, Icon: ClipboardList },
  ];

  return (
    <section aria-label={s.visitSaved} className="space-y-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map(({ key, label, value, Icon }) => {
          const missing = value === null;
          return (
            <li key={key} className={cn('rounded-2xl border px-3 py-2', missing ? 'border-[#B7791F]/40 bg-asha-amber text-[#7A4E0A]' : 'border-asha-line bg-white')}>
              <p className="flex items-center gap-1.5 text-xs font-bold">
                {missing ? <Minus className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5 text-asha-teal" aria-hidden />}
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="truncate">{label}</span>
              </p>
              <p className="text-base font-extrabold leading-6">{missing ? s.notRecorded : value}</p>
            </li>
          );
        })}
      </ul>
      {seconds != null && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-asha-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-asha-mint px-3 py-1 font-bold text-asha-teal">
            <Timer className="h-4 w-4" aria-hidden />
            {s.recordedIn(seconds)}
          </span>
          {s.recordedInHelp}
        </p>
      )}
    </section>
  );
}
