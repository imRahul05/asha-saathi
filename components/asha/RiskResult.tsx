'use client';

import { Check, FileText, TriangleAlert, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskLevel, VisitResult } from '@/lib/asha/fixtures';

const LEVEL: Record<RiskLevel, { label: string; hindi: string; bar: string; tile: string }> = {
  urgent: { label: 'URGENT', hindi: 'तुरंत डॉक्टर के पास भेजें', bar: 'bg-asha-red', tile: 'bg-asha-red-soft text-asha-red' },
  high: { label: 'HIGH RISK', hindi: 'डॉक्टर को जल्दी दिखाना ज़रूरी है', bar: 'bg-asha-red', tile: 'bg-asha-red-soft text-asha-red' },
  watch: { label: 'WATCH', hindi: 'अगली visit पर फिर जाँचें', bar: 'bg-[#B7791F]', tile: 'bg-asha-amber text-[#7A4E0A]' },
  normal: { label: 'NORMAL', hindi: 'सब ठीक है', bar: 'bg-asha-teal', tile: 'bg-asha-mint text-asha-teal' },
};

type Props = { visit: VisitResult; time?: string };

// Screen 2: what was recorded, how risky it is, and why. Risk text comes from rules, never from the model.
export function RiskResult({ visit, time = '11:42' }: Props) {
  const { beneficiary: b, vitals: v, risk } = visit;
  const lv = LEVEL[risk.level];
  const hot = risk.level === 'high' || risk.level === 'urgent';
  const waitingForConfirm = visit.tools.some((t) => t.state === 'waiting');

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-asha-cream lg:h-auto lg:max-w-none">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-4 lg:overflow-visible lg:px-0">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-bold text-asha-teal">
            <Check className="h-4 w-4" aria-hidden /> Visit saved · विज़िट सहेजी गई
          </span>
          <span className="text-asha-muted">आज · {time}</span>
        </div>

        {/* Risk banner + patient */}
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
                {b.village} · {b.weeks} सप्ताह{b.firstPregnancy === false ? ' · पहली pregnancy नहीं' : ''}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="BP" hot={hot} value={`${v.bpSys}/${v.bpDia}`} />
              <Tile label="सूजन" value={v.symptoms.length ? 'पैरों में' : '—'} />
              <Tile label="Hb" value={v.hb == null ? '— नहीं लिया' : `${v.hb}`} small={v.hb == null} />
            </div>
          </div>
        </section>

        {/* Why */}
        <section aria-label="Why this risk level">
          <h3 className="mb-2 text-xl font-extrabold">क्यों {risk.level === 'high' ? 'high risk' : risk.level}?</h3>
          <div className="space-y-3 rounded-2xl border border-asha-line bg-white p-4">
            {risk.reasons.map((r) => (
              <div key={r.text} className="space-y-2">
                <p className="text-lg font-semibold leading-7">{r.text}</p>
                {r.citation && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-asha-mint px-3 py-1 text-sm font-semibold text-asha-teal">
                    <FileText className="h-4 w-4" aria-hidden />
                    {r.citation.label}
                    {r.citation.page ? ` · p.${r.citation.page}` : ''}
                  </span>
                )}
              </div>
            ))}
            <p className="text-sm text-asha-muted">
              Rule {risk.rulesVersion} · यह AI ने तय नहीं किया, नियम से निकला है
            </p>
          </div>
        </section>

        {/* Family advice: only from guidelines, never invented */}
        <section aria-label="What to tell the family">
          <h3 className="mb-2 text-xl font-extrabold">परिवार को क्या बताएँ</h3>
          {visit.advice ? (
            <p className="rounded-2xl border border-asha-line bg-white p-4 text-lg leading-8">{visit.advice}</p>
          ) : (
            <p className="rounded-2xl border border-dashed border-asha-line p-4 text-base leading-7 text-asha-muted">
              पूछिए: “परिवार को क्या बताएँ?” सलाह सिर्फ़ official guideline से आएगी, source के साथ।
            </p>
          )}
        </section>

        {/* What Saathi did */}
        <section aria-label="What Saathi did">
          <h3 className="mb-2 text-sm font-semibold text-asha-muted">साथी ने क्या किया</h3>
          <ul className="flex flex-wrap gap-2">
            {visit.tools.map((t) => (
              <li
                key={t.name}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium',
                  t.state === 'done' ? 'border-asha-line bg-white' : 'border-asha-amber bg-asha-amber/60',
                )}
              >
                {t.state === 'done' ? (
                  <Check className="h-4 w-4 text-asha-teal" aria-hidden />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-[#B7791F]" aria-hidden />
                )}
                {t.name}
                {t.note ? ` · ${t.note}` : ''}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Voice prompt dock */}
      <div className="flex shrink-0 items-center gap-4 border-t border-asha-line bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-3xl lg:border">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-asha-teal text-white">
          <Mic className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-xl font-extrabold leading-7">{waitingForConfirm ? 'डॉक्टर को alert भेजूँ?' : 'अगली visit बताइए'}</p>
          <p className="text-sm text-asha-muted">
            {waitingForConfirm ? 'बोलिए: “हाँ, भेज दो” या “नहीं”' : 'या पूछिए: “आज का काम बताओ”'}
          </p>
        </div>
      </div>
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
