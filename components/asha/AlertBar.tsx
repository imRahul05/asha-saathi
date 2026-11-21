'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Phone, Send, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SnapshotVisit } from '@/lib/snapshot-types';
import type { Strings } from '@/lib/i18n';

// provider is stored like "telegram", "twilio-sms", "twilio-whatsapp" or "console"
const channelLabel = (p: string | null, s: Strings) =>
  p === 'telegram' ? 'Telegram' : p?.endsWith('sms') ? 'SMS' : p?.endsWith('whatsapp') ? 'WhatsApp' : p === 'console' ? s.chScreen : s.chMessage;

/**
 * The alert's state in one place, always at the top of the result area (it used to sit far down, out of sight on a desktop screen):
 * - drafted but not sent: say so plainly and offer "Send now" (her tap is the confirmation);
 * - failed: say so and offer "Try again";
 * - sent: say where it went, offer "Talk to the doctor", and warn when it only went to the test console.
 */
export function AlertBar({ visit, s }: { visit: SnapshotVisit; s: Strings }) {
  const alert = visit.alert;
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // a new visit or a new alert state clears an old error
  useEffect(() => setErr(null), [visit.id, alert?.status]);
  if (!alert) return null;

  const draft = alert.status === 'draft';
  const failed = alert.status === 'failed';
  const testMode = alert.status === 'sent' && alert.channel === 'console';
  const doctor = alert.doctor ?? 'Doctor';

  async function sendNow() {
    setSending(true);
    setErr(null);
    try {
      const res = await fetch('/api/alerts/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitId: visit.id }) });
      if (res.status === 401) {
        window.location.href = '/login?expired=1';
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.ok === false) setErr(s.sendError);
      // On success the screen updates by itself within a couple of seconds (it polls the saved state).
    } catch {
      setErr(s.sendError);
    } finally {
      setSending(false);
    }
  }

  async function talk() {
    setCalling(true);
    setErr(null);
    try {
      const r = await fetch(`/api/call/link?visit=${encodeURIComponent(visit.id)}`, { cache: 'no-store' });
      const b = await r.json();
      if (!r.ok || !b.asha) throw new Error('link');
      window.open(b.asha, '_blank', 'noopener');
    } catch {
      setErr(s.callFailed);
    } finally {
      setCalling(false);
    }
  }

  const tone = failed ? 'border-asha-red/30 bg-asha-red-soft text-asha-red' : draft || testMode ? 'border-[#B7791F]/40 bg-asha-amber text-[#7A4E0A]' : 'border-asha-teal/30 bg-asha-mint text-asha-teal';
  const title = failed ? s.failedBar : draft ? s.readyBar : s.sentViaBar(doctor, channelLabel(alert.channel, s));
  const Icon = failed || draft || testMode ? TriangleAlert : Check;
  const actionClass = 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-base font-bold focus-visible:outline-none focus-visible:ring-4 disabled:opacity-70';

  return (
    <section aria-label={title} className={cn('rounded-3xl border p-4', tone)}>
      <div className="flex flex-wrap items-center gap-3">
        <Icon className="h-6 w-6 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 text-lg font-extrabold leading-6">{title}</p>
        {(draft || failed) && (
          <button type="button" onClick={sendNow} disabled={sending} className={cn(actionClass, 'bg-asha-night text-white focus-visible:ring-asha-night/40')}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {sending ? s.sendingNow : failed ? s.tryAgain : s.sendNow}
          </button>
        )}
        {alert.status === 'sent' && (
          <button type="button" onClick={talk} disabled={calling} className={cn(actionClass, 'bg-asha-teal text-white focus-visible:ring-asha-teal/40')}>
            {calling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Phone className="h-4 w-4" aria-hidden />}
            {s.callDoctor(doctor)}
          </button>
        )}
      </div>
      {visit.call?.doctorJoinedAt && <p className="mt-2 text-sm font-bold">{s.doctorJoined(doctor)}</p>}
      {testMode && <p className="mt-2 text-sm font-medium">{s.testModeNote}</p>}
      {failed && alert.error && <p className="mt-2 break-words text-sm font-medium">{alert.error}</p>}
      {err && (
        <p role="alert" className="mt-2 text-sm font-bold">
          {err}
        </p>
      )}
    </section>
  );
}
