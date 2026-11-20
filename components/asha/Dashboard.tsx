'use client';

import { Check, HeartPulse, Mic, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAMPLE_ASHA, SAMPLE_STATS, SAMPLE_VISIT, type VisitResult } from '@/lib/asha/fixtures';
import type { OrbState } from '@/lib/asha/lang';

type Line = { from: 'saathi' | 'asha'; text: string };

type Props = {
  visit?: VisitResult;
  orbState?: OrbState;
  orbLabel?: string;
  transcript?: Line[];
};

// SAMPLE transcript until the dashboard subscribes to live events.
const SAMPLE_TRANSCRIPT: Line[] = [
  { from: 'saathi', text: 'नमस्ते दीदी! किसके घर visit हुई?' },
  { from: 'asha', text: 'सुनीता जी के घर गई थी, सात महीने, BP 150 by 100, पैरों में सूजन है।' },
  { from: 'saathi', text: 'सुनीता जी का BP 150/100 है, यह high risk है। डॉक्टर को alert भेजूँ?' },
  { from: 'asha', text: 'हाँ, भेज दो।' },
];

// Screen 4: what judges watch. Wide, high-contrast, readable from a distance.
export function Dashboard({
  visit = SAMPLE_VISIT,
  orbState = 'listening',
  orbLabel = 'सुन रही हूँ…',
  transcript = SAMPLE_TRANSCRIPT,
}: Props) {
  const high = visit.risk.level === 'high' || visit.risk.level === 'urgent';
  const alertsSent = visit.alert.status === 'sent' ? 1 : 0;

  return (
    <div className="min-h-dvh bg-asha-cream px-4 py-5 text-asha-ink sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-asha-teal text-white">
            <HeartPulse className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-7">ASHA Saathi</h1>
            <p className="text-sm text-asha-muted">
              {SAMPLE_ASHA.phc} · {SAMPLE_ASHA.name} का session
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="flex items-center gap-2 rounded-full border border-asha-line bg-white px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-asha-red" aria-hidden /> Live call
          </span>
          <span className="rounded-full border border-asha-line bg-white px-4 py-2">भाषा: हिंदी</span>
          <span className="rounded-full border border-asha-line bg-white px-4 py-2">Agora · Murf Falcon · Deepgram</span>
        </div>
      </header>

      <div className="mx-auto mt-6 grid max-w-7xl gap-5 lg:grid-cols-[22rem_1fr_24rem]">
        {/* Live conversation */}
        <section className="rounded-3xl border border-asha-line bg-white p-5" aria-label="Live conversation">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white',
                orbState === 'speaking' ? 'bg-asha-teal' : orbState === 'muted' || orbState === 'disconnected' ? 'bg-asha-ink/80' : 'bg-asha-orange',
              )}
              role="img"
              aria-label={`Voice state: ${orbState}`}
            >
              {(orbState === 'listening' || orbState === 'speaking') && (
                <span className={cn('orb-ring absolute inset-0 rounded-full', orbState === 'speaking' ? 'bg-asha-teal' : 'bg-asha-orange')} aria-hidden />
              )}
              <Mic className="relative h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-2xl font-extrabold leading-8">{orbLabel}</p>
              <p className="text-sm text-asha-muted">ASHA बोल रही हैं</p>
            </div>
          </div>
          <h2 className="mb-3 mt-4 text-xs font-bold text-asha-muted">Live transcript</h2>
          <div className="space-y-3">
            {transcript.map((l, i) => (
              <p
                key={i}
                className={cn(
                  'w-fit max-w-[92%] rounded-3xl px-4 py-2.5 text-[17px] leading-7',
                  l.from === 'saathi' ? 'rounded-tl-lg bg-asha-sand' : 'ml-auto rounded-tr-lg bg-asha-teal text-white',
                )}
              >
                {l.text}
              </p>
            ))}
          </div>
        </section>

        {/* Stats + risk card */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Visits आज" value={SAMPLE_STATS.visitsToday} />
            <Stat label="High risk" value={SAMPLE_STATS.highRisk} tone="red" />
            <Stat label="Alerts भेजे" value={alertsSent} />
            <Stat label="Follow-ups" value={3} />
          </div>

          <section className="overflow-hidden rounded-3xl border border-asha-line bg-white" aria-label="Current visit">
            <div className={cn('flex items-center justify-between px-6 py-4 text-white', high ? 'bg-asha-red' : 'bg-asha-teal')}>
              <p className="flex items-center gap-2 text-2xl font-extrabold">
                {high && <TriangleAlert className="h-6 w-6" aria-hidden />}
                {visit.risk.level === 'urgent' ? 'URGENT' : high ? 'HIGH RISK' : visit.risk.level.toUpperCase()}
              </p>
              <p className="text-sm font-semibold">Rule {visit.risk.rulesVersion}</p>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <h2 className="text-3xl font-extrabold">{visit.beneficiary.name}</h2>
                <p className="text-base text-asha-muted">
                  {visit.beneficiary.village} · {visit.beneficiary.weeks} सप्ताह · visit {visit.alert.sentAt ?? '—'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Metric label="BP" value={`${visit.vitals.bpSys}/${visit.vitals.bpDia}`} hot={high} />
                <Metric label="सूजन" value={visit.vitals.symptoms.length ? 'पैरों में' : '—'} />
                <Metric label="Hb" value={visit.vitals.hb == null ? '—' : String(visit.vitals.hb)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {visit.risk.reasons.map(
                  (r) =>
                    r.citation && (
                      <span key={r.text} className="rounded-full bg-asha-mint px-3 py-1 text-sm font-semibold text-asha-teal">
                        {r.citation.label}
                        {r.citation.page ? ` · p.${r.citation.page}` : ''}
                      </span>
                    ),
                )}
                {visit.alert.status === 'sent' && (
                  <span className="rounded-full bg-asha-mint px-3 py-1 text-sm font-semibold text-asha-teal">Alert delivered</span>
                )}
                <span className="rounded-full bg-asha-sand px-3 py-1 text-sm font-semibold">
                  Follow-up · {visit.followUp.day} {visit.followUp.month}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Agent timeline: the proof that it is acting, not just talking */}
        <section className="rounded-3xl border border-asha-line bg-white p-5" aria-label="Agent timeline">
          <h2 className="text-xl font-extrabold">Agent timeline</h2>
          <ul className="mt-3 divide-y divide-asha-line">
            {TIMELINE.map((t) => (
              <li key={t.name} className="flex items-center gap-3 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-asha-mint text-asha-teal">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[15px] font-medium">{t.name}</span>
                  <span className="block text-sm text-asha-muted">{t.note}</span>
                </span>
                <span className="whitespace-nowrap font-mono text-sm text-asha-muted">{t.ms} ms</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-asha-muted">Sample timeline. Live tool calls replace this once the tool layer is connected.</p>
        </section>
      </div>
    </div>
  );
}

const TIMELINE = [
  { name: 'findBeneficiary', note: '“Sunita” → 1 match', ms: 180 },
  { name: 'recordVisit', note: 'risk: high', ms: 240 },
  { name: 'searchGuidelines', note: '3 chunks · cited', ms: 410 },
  { name: 'draftAlert', note: 'waiting for “हाँ”', ms: 95 },
  { name: 'sendAlert', note: 'WhatsApp · once', ms: 620 },
  { name: 'scheduleFollowUp', note: '+3 days', ms: 110 },
];

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'red' }) {
  return (
    <div className={cn('rounded-3xl border border-asha-line px-5 py-4', tone === 'red' ? 'bg-asha-red-soft' : 'bg-white')}>
      <p className={cn('text-sm font-medium', tone === 'red' ? 'text-asha-red' : 'text-asha-muted')}>{label}</p>
      <p className={cn('text-4xl font-extrabold', tone === 'red' && 'text-asha-red')}>{value}</p>
    </div>
  );
}

function Metric({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className={cn('rounded-2xl px-4 py-4', hot ? 'bg-asha-red-soft' : 'bg-asha-sand')}>
      <p className={cn('text-xs font-bold', hot ? 'text-asha-red' : 'text-asha-muted')}>
        {label}
        {hot ? ' ▲' : ''}
      </p>
      <p className={cn('text-3xl font-extrabold', hot && 'text-asha-red')}>{value}</p>
    </div>
  );
}
