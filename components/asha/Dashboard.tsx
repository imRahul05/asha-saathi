'use client';

import { useEffect, useState } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { cn } from '@/lib/utils';
import { useSnapshot } from '@/hooks/use-snapshot';
import { RiskResult } from './RiskResult';
import { AlertSent } from './AlertSent';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import type { Snapshot } from '@/lib/snapshot-types';

// Projector view: live, read-only. Everything on it comes from the database; nothing is sample data.
export function Dashboard() {
  const [key, setKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setKey(new URLSearchParams(window.location.search).get('key'));
    setReady(true);
  }, []);
  const url = ready ? `/api/dashboard${key ? `?key=${encodeURIComponent(key)}` : ''}` : null;
  const { snapshot, error } = useSnapshot(url);

  return (
    <div className="min-h-dvh bg-asha-cream px-4 py-5 text-asha-ink sm:px-8 sm:py-8">
      <Header snapshot={snapshot} />
      <div className="mx-auto mt-6 max-w-7xl">
        {error === 'UNAUTHORIZED' ? (
          <Notice title="This dashboard needs its access key" body="Open it with /dashboard?key=… (the DASHBOARD_KEY set on the server)." />
        ) : error === 'DATABASE_NOT_CONFIGURED' ? (
          <Notice title="The database is not connected" body="Add DATABASE_URL, then run pnpm db:migrate and pnpm db:seed." />
        ) : error && !snapshot ? (
          <Notice title="Could not load live data" body={`Reason: ${error}. It will retry automatically.`} />
        ) : !snapshot ? (
          <p className="py-20 text-center text-asha-muted">Loading…</p>
        ) : !snapshot.asha ? (
          <Notice title="No ASHA is set up yet" body="Run pnpm db:seed to create the first ASHA and her registered mothers." />
        ) : (
          <Body snapshot={snapshot} />
        )}
      </div>
    </div>
  );
}

function Header({ snapshot }: { snapshot: Snapshot | null }) {
  const lastEvent = snapshot?.events[snapshot.events.length - 1];
  // Compare against the server's clock (in the snapshot) so this stays pure and immune to a wrong device clock.
  const live = Boolean(snapshot && lastEvent && new Date(snapshot.serverTime).getTime() - new Date(lastEvent.at).getTime() < 2 * 60_000);
  return (
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <BrandMark className="h-12 w-12" />
        <div>
          <h1 className="font-display text-2xl font-extrabold leading-7">ASHA Saathi</h1>
          <p className="text-sm text-asha-muted">{snapshot?.asha ? `${snapshot.asha.phcName} · ${snapshot.asha.name}` : 'Live dashboard'}</p>
        </div>
      </div>
      <span className="flex items-center gap-2 rounded-full border border-asha-line bg-white px-4 py-2 text-sm font-semibold">
        <span className={cn('h-2.5 w-2.5 rounded-full', live ? 'bg-asha-red' : 'bg-asha-line')} aria-hidden />
        {live ? 'Live call' : 'Waiting for a call'}
      </span>
    </header>
  );
}

function Body({ snapshot }: { snapshot: Snapshot }) {
  const { counts, visit, events, remaining } = snapshot;
  const { s } = useLanguage();
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr_22rem]">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Stat label={s.statVisits} value={counts.visits} />
          <Stat label="High risk" value={counts.highRisk} tone="red" />
          <Stat label={s.statAlerts} value={counts.alertsSent} />
          <Stat label="Follow-ups" value={counts.followUps} />
        </div>
        {visit && visit.alert && <AlertSent visit={visit} remaining={remaining} s={s} />}
        {!visit && remaining.length > 0 && <AlertSent visit={EMPTY_VISIT} remaining={remaining} s={s} />}
      </div>

      <div>
        {visit ? (
          <RiskResult visit={visit} events={events} s={s} />
        ) : (
          <div className="rounded-3xl border border-dashed border-asha-line bg-white/60 p-10 text-center">
            <p className="text-xl font-extrabold">No visit recorded yet</p>
            <p className="mt-2 text-asha-muted">Start a call at /app and report a visit. It appears here the moment it is saved.</p>
          </div>
        )}
      </div>

      <section className="h-fit rounded-3xl border border-asha-line bg-white p-5" aria-label="Agent timeline">
        <h2 className="text-xl font-extrabold">Agent timeline</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-asha-muted">Tool calls appear here as the agent works.</p>
        ) : (
          <ul className="mt-3 divide-y divide-asha-line">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', e.ok ? 'bg-asha-mint text-asha-teal' : 'bg-asha-red-soft text-asha-red')}>
                  {e.ok ? <Check className="h-4 w-4" aria-hidden /> : <TriangleAlert className="h-4 w-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[15px] font-medium">{e.name}</span>
                  {e.note && <span className="block text-sm text-asha-muted">{e.note}</span>}
                </span>
                {e.ms != null && <span className="whitespace-nowrap font-mono text-sm text-asha-muted">{e.ms} ms</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Used only to render the "who is left today" list when no visit exists yet.
const EMPTY_VISIT = {
  id: '', visitedAt: new Date(0).toISOString(),
  beneficiary: { name: '', village: null, weeks: null, age: null, firstPregnancy: null },
  vitals: { bpSys: null, bpDia: null, hb: null, symptoms: [] },
  risk: { level: 'normal' as const, rulesVersion: '', reasons: [] },
  alert: null, followUp: null,
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'red' }) {
  return (
    <div className={cn('rounded-3xl border border-asha-line px-5 py-4', tone === 'red' && value > 0 ? 'bg-asha-red-soft' : 'bg-white')}>
      <p className={cn('text-sm font-medium', tone === 'red' && value > 0 ? 'text-asha-red' : 'text-asha-muted')}>{label}</p>
      <p className={cn('text-4xl font-extrabold', tone === 'red' && value > 0 && 'text-asha-red')}>{value}</p>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-asha-line bg-white p-8 text-center">
      <p className="text-xl font-extrabold">{title}</p>
      <p className="mt-2 text-asha-muted">{body}</p>
    </div>
  );
}
