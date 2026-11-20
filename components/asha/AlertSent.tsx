'use client';

import { Check, Mic, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisitResult } from '@/lib/asha/fixtures';

type Props = { visit: VisitResult };

const STATUS_PILL: Record<'Watch' | 'Normal' | 'Pending', string> = {
  Watch: 'bg-asha-amber text-[#7A4E0A]',
  Normal: 'bg-asha-mint text-asha-teal',
  Pending: 'bg-asha-sand text-asha-muted',
};

// Screen 3: alert delivered, follow-up booked, what is left today.
export function AlertSent({ visit }: Props) {
  const { alert, followUp, remaining } = visit;
  const failed = alert.status === 'failed';
  const draft = alert.status === 'draft';

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-asha-cream lg:h-auto lg:max-w-none">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-8 lg:overflow-visible lg:px-0">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className={cn(
              'flex h-20 w-20 items-center justify-center rounded-full text-white',
              failed ? 'bg-asha-red' : 'bg-asha-teal',
            )}
          >
            {failed ? <TriangleAlert className="h-10 w-10" aria-hidden /> : <Check className="h-11 w-11" aria-hidden />}
          </span>
          <h2 className="text-3xl font-extrabold">
            {failed ? 'Alert नहीं गया' : draft ? 'Alert तैयार है' : 'Alert भेज दिया'}
          </h2>
          <p className="text-base text-asha-muted">
            {alert.doctor} · {alert.phc} {failed ? 'को नहीं पहुँचा' : 'को WhatsApp पर'}
          </p>
        </div>

        <section className="rounded-3xl border border-asha-line bg-white p-4" aria-label="Message sent">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-asha-muted">भेजा गया message</h3>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold',
                failed ? 'bg-asha-red-soft text-asha-red' : draft ? 'bg-asha-amber text-[#7A4E0A]' : 'bg-asha-mint text-asha-teal',
              )}
            >
              {failed ? 'Failed' : draft ? 'Draft' : 'Delivered'}
            </span>
          </div>
          <p className="whitespace-pre-line rounded-2xl bg-asha-mint px-4 py-3 text-base leading-7">{alert.message}</p>
          <p className="mt-3 text-xs text-asha-muted">
            {failed
              ? 'दोबारा भेजने के लिए बोलिए “फिर से भेजो”।'
              : 'एक ही बार भेजा जाता है। दोबारा “हाँ” बोलने पर नहीं जाएगा।'}
          </p>
        </section>

        <section className="flex items-center gap-4 rounded-3xl border border-asha-line bg-white p-4" aria-label="Follow-up">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-asha-teal text-white">
            <span className="text-[11px] font-bold leading-3 tracking-wide">{followUp.month}</span>
            <span className="text-2xl font-extrabold leading-7">{followUp.day}</span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-7">Follow-up visit तय</p>
            <p className="text-base text-asha-muted">{followUp.note}</p>
          </div>
        </section>

        <section aria-label="Visits left today">
          <h3 className="mb-2 text-xl font-extrabold">आज के बाकी visit</h3>
          <ul className="divide-y divide-asha-line overflow-hidden rounded-3xl border border-asha-line bg-white">
            {remaining.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 px-4 py-4">
                <span className="text-lg">
                  {r.name} <span className="text-asha-muted">· {r.village}</span>
                </span>
                <span className={cn('rounded-full px-3 py-1 text-sm font-bold', STATUS_PILL[r.status])}>{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-4 border-t border-asha-line bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-3xl lg:border">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-asha-teal text-white">
          <Mic className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-xl font-extrabold leading-7">अगली visit बताइए</p>
          <p className="text-sm text-asha-muted">या पूछिए: “आज का काम बताओ”</p>
        </div>
      </div>
    </div>
  );
}
