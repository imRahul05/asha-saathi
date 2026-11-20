'use client';

import { useState } from 'react';
import { Check, Phone, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SnapshotRemaining, SnapshotVisit } from '@/lib/snapshot-types';
import type { Strings } from '@/lib/i18n';

type Props = { visit: SnapshotVisit; remaining: SnapshotRemaining[]; s: Strings };

const STATUS_PILL: Record<SnapshotRemaining['status'], string> = {
  High: 'bg-asha-red-soft text-asha-red',
  Watch: 'bg-asha-amber text-[#7A4E0A]',
  Normal: 'bg-asha-mint text-asha-teal',
  Pending: 'bg-asha-sand text-asha-muted',
};

const statusLabel = (st: SnapshotRemaining['status'], s: Strings) =>
  st === 'High' ? s.riskHigh : st === 'Watch' ? s.riskWatch : st === 'Normal' ? s.riskNormal : s.pending;

// provider is stored like "twilio-sms", "twilio-whatsapp" or "console"
const channelLabel = (p: string | null, s: Strings) =>
  p === 'telegram' ? 'Telegram' : p?.endsWith('sms') ? 'SMS' : p?.endsWith('whatsapp') ? 'WhatsApp' : p === 'console' ? s.chScreen : s.chMessage;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function daysFromToday(isoDate: string): number {
  const today = new Date();
  const d = new Date(`${isoDate}T00:00:00`);
  return Math.round((d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
}

// Alert status, follow-up, and who is left to visit today. Only shown once there is an alert or a follow-up.
// Opens the voice call page for this visit in a new tab, so the AI call (and its microphone) can stay as it is.
function CallDoctorButton({ visitId, doctor, s }: { visitId: string; doctor: string; s: Strings }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const open = async () => {
    setBusy(true); setErr(false);
    try {
      const r = await fetch(`/api/call/link?visit=${encodeURIComponent(visitId)}`, { cache: 'no-store' });
      const b = await r.json();
      if (!r.ok || !b.asha) throw new Error('link');
      window.open(b.asha, '_blank', 'noopener');
    } catch { setErr(true); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={open} disabled={busy} className="inline-flex h-14 items-center gap-2 rounded-full bg-asha-teal px-6 text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/40 disabled:opacity-70">
        <Phone className="h-5 w-5" aria-hidden /> {s.callDoctor(doctor)}
      </button>
      {err && <p role="alert" className="text-sm font-semibold text-asha-red">{s.callFailed}</p>}
    </div>
  );
}

export function AlertSent({ visit, remaining, s }: Props) {
  const { alert, followUp } = visit;
  const failed = alert?.status === 'failed';
  const draft = alert?.status === 'draft';

  return (
    <div className="space-y-5">
      {alert && (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <span className={cn('flex h-20 w-20 items-center justify-center rounded-full text-white', failed ? 'bg-asha-red' : draft ? 'bg-[#B7791F]' : 'bg-asha-teal')}>
              {failed ? <TriangleAlert className="h-10 w-10" aria-hidden /> : <Check className="h-11 w-11" aria-hidden />}
            </span>
            <h2 className="text-3xl font-extrabold">{failed ? s.alertFailedT : draft ? s.alertDraftT : s.alertSentT}</h2>
            <p className="text-base text-asha-muted">
              {[alert.doctor, alert.phc].filter(Boolean).join(' · ')} {failed ? s.toFailed : draft ? s.toDraft : s.toVia(channelLabel(alert.channel, s))}
            </p>
          </div>

          {alert.status === 'sent' && <CallDoctorButton visitId={visit.id} doctor={alert.doctor ?? 'Doctor'} s={s} />}

          <section className="rounded-3xl border border-asha-line bg-white p-4" aria-label="Alert message">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-asha-muted">{draft ? s.msgDraft : s.msgSent}</h3>
              <span className={cn('rounded-full px-3 py-1 text-xs font-bold', failed ? 'bg-asha-red-soft text-asha-red' : draft ? 'bg-asha-amber text-[#7A4E0A]' : 'bg-asha-mint text-asha-teal')}>
                {failed ? s.alertFailedT : draft ? s.alertDraftT : s.alertSentT}
              </span>
            </div>
            <p className="whitespace-pre-line rounded-2xl bg-asha-mint px-4 py-3 text-base leading-7">{alert.message}</p>
            <p className="mt-3 text-xs text-asha-muted">
              {failed ? s.hintFailed(alert.error ?? '') : draft ? s.hintDraft : s.hintSent}
            </p>
          </section>
        </>
      )}

      {followUp && (
        <section className="flex items-center gap-4 rounded-3xl border border-asha-line bg-white p-4" aria-label="Follow-up">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-asha-teal text-white">
            <span className="text-[11px] font-bold leading-3 tracking-wide">{MONTHS[Number(followUp.dueDate.slice(5, 7)) - 1]}</span>
            <span className="text-2xl font-extrabold leading-7">{Number(followUp.dueDate.slice(8, 10))}</span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-7">{s.followT}</p>
            <p className="text-base text-asha-muted">
              {s.daysLater(daysFromToday(followUp.dueDate))}{followUp.reason ? ` · ${followUp.reason}` : ''}
            </p>
          </div>
        </section>
      )}

      {remaining.length > 0 && (
        <section aria-label="Visits left today">
          <h3 className="mb-2 text-xl font-extrabold">{s.remainingT}</h3>
          <ul className="divide-y divide-asha-line overflow-hidden rounded-3xl border border-asha-line bg-white">
            {remaining.map((r) => (
              <li key={`${r.name}-${r.village}`} className="flex items-center justify-between gap-3 px-4 py-4">
                <span className="text-lg">
                  {r.name} {r.village && <span className="text-asha-muted">· {r.village}</span>}
                </span>
                <span className={cn('rounded-full px-3 py-1 text-sm font-bold', STATUS_PILL[r.status])}>{statusLabel(r.status, s)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
