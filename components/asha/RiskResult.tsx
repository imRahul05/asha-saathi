'use client';

import { Check, FileText, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskLevel, SnapshotEvent, SnapshotVisit } from '@/lib/snapshot-types';

const LEVEL: Record<RiskLevel, { label: string; hindi: string; bar: string }> = {
  urgent: { label: 'URGENT', hindi: 'तुरंत health centre ले जाएँ', bar: 'bg-asha-red' },
  high: { label: 'HIGH RISK', hindi: 'डॉक्टर को जल्दी दिखाना ज़रूरी है', bar: 'bg-asha-red' },
  watch: { label: 'WATCH', hindi: 'अगली visit पर फिर जाँचें', bar: 'bg-[#B7791F]' },
  normal: { label: 'NORMAL', hindi: 'सब ठीक है', bar: 'bg-asha-teal' },
};

type Props = { visit: SnapshotVisit; events?: SnapshotEvent[] };

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(iso));

// What was recorded, how risky it is, and why. The risk text comes from fixed rules, never from the model.
export function RiskResult({ visit, events = [] }: Props) {
  const { beneficiary: b, vitals: v, risk } = visit;
  const lv = LEVEL[risk.level];
  const hot = risk.level === 'high' || risk.level === 'urgent';
  // One chip per tool, newest state wins.
  const chips = Array.from(new Map(events.map((e) => [e.name, e])).values());

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-bold text-asha-teal">
          <Check className="h-4 w-4" aria-hidden /> Visit saved · विज़िट सहेजी गई
        </span>
        <span className="text-asha-muted">आज · {timeOf(visit.visitedAt)}</span>
      </div>

      <section className="overflow-hidden rounded-3xl border border-asha-line bg-white" aria-label="Risk result">
        <div className={cn('flex items-center gap-3 px-5 py-4 text-white', lv.bar)}>
          <TriangleAlert className="h-7 w-7 shrink-0" aria-hidden />
          <div>
            <p className="text-xl font-extrabold leading-6 tracking-wide">{lv.label}</p>
            <p className="text-base font-semibold leading-6">{lv.hindi}</p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-2xl font-extrabold leading-8">{b.name}</h2>
            <p className="text-base text-asha-muted">
              {[b.village, b.weeks != null ? `${b.weeks} सप्ताह` : null, b.firstPregnancy === false ? 'पहली pregnancy नहीं' : b.firstPregnancy ? 'पहली pregnancy' : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="BP" hot={hot && v.bpSys != null} value={v.bpSys != null ? `${v.bpSys}/${v.bpDia}` : '—'} />
            <Tile label="लक्षण" value={v.symptoms.length ? String(v.symptoms.length) : '—'} />
            <Tile label="Hb" value={v.hb == null ? '— नहीं लिया' : `${v.hb}`} small={v.hb == null} />
          </div>
          {v.symptoms.length > 0 && <p className="text-sm text-asha-muted">{v.symptoms.map((s) => s.replace(/_/g, ' ')).join(', ')}</p>}
        </div>
      </section>

      {risk.reasons.length > 0 && (
        <section aria-label="Why this risk level">
          <h3 className="mb-2 text-xl font-extrabold">क्यों {risk.level === 'urgent' ? 'urgent' : risk.level === 'high' ? 'high risk' : risk.level}?</h3>
          <div className="space-y-4 rounded-2xl border border-asha-line bg-white p-4">
            {risk.reasons.map((r) => (
              <div key={r.code} className="space-y-2">
                <p className="text-lg font-semibold leading-7">{r.text}</p>
                {/* A citation appears only when the rule's source quote and page are verified. */}
                {r.citation && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-asha-mint px-3 py-1 text-sm font-semibold text-asha-teal">
                    <FileText className="h-4 w-4" aria-hidden />
                    {r.citation.label}
                    {r.citation.page ? ` · p.${r.citation.page}` : ''}
                  </span>
                )}
              </div>
            ))}
            <p className="text-sm text-asha-muted">Rule {risk.rulesVersion} · यह AI ने तय नहीं किया, नियम से निकला है</p>
          </div>
        </section>
      )}

      {chips.length > 0 && (
        <section aria-label="What Saathi did">
          <h3 className="mb-2 text-sm font-semibold text-asha-muted">साथी ने क्या किया</h3>
          <ul className="flex flex-wrap gap-2">
            {chips.map((t) => (
              <li
                key={t.name}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium',
                  t.ok ? 'border-asha-line bg-white' : 'border-asha-red/30 bg-asha-red-soft text-asha-red',
                )}
              >
                {t.ok ? <Check className="h-4 w-4 text-asha-teal" aria-hidden /> : <TriangleAlert className="h-4 w-4" aria-hidden />}
                {t.name}
                {t.note ? ` · ${t.note}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, hot, small }: { label: string; value: string; hot?: boolean; small?: boolean }) {
  return (
    <div className={cn('rounded-2xl px-3 py-3', hot ? 'bg-asha-red-soft' : 'bg-asha-sand')}>
      <p className={cn('text-xs font-bold', hot ? 'text-asha-red' : 'text-asha-muted')}>
        {label}
        {hot ? ' ▲' : ''}
      </p>
      <p className={cn('font-extrabold leading-7', small ? 'text-base' : 'text-xl', hot && 'text-asha-red')}>{value}</p>
    </div>
  );
}
