'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PhoneOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Orb } from './Orb';
import { RiskResult } from './RiskResult';
import { AlertSent } from './AlertSent';
import { cn } from '@/lib/utils';
import type { Snapshot } from '@/lib/snapshot-types';
import type { OrbState } from '@/lib/asha/lang';
import { LANGUAGES, isLangCode } from '@/lib/languages';
import { HELLO, STRINGS, detectUiLang, type UiLang } from '@/lib/i18n';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { ConnectingGreetings } from './ConnectingGreetings';
import { AlertBar } from './AlertBar';
import { TypeBox } from './TypeBox';
import { HintStrip, RecordGuide } from './RecordGuide';
import { TabBar } from './TabBar';
import { SchedulePanel } from './SchedulePanel';
import { dueNowCount, todayInIndia } from '@/lib/asha/schedule';

export type TranscriptMessage = {
  turn_id?: string | number;
  uid: number;
  text?: string;
  createdAt?: number;
};

type VoiceScreenProps = {
  orbState: OrbState;
  messageList: TranscriptMessage[];
  currentInProgressMessage: TranscriptMessage | null;
  agentUID: string;
  onToggleMic: () => void;
  /** Send a typed message to Saathi (for noisy places). Hidden when not provided. */
  onSendText?: (text: string) => Promise<void> | void;
  onEnd: () => void;
  micSelector?: ReactNode;
  /** A plain-words problem to show (e.g. agent never joined, RTC error), with an optional retry. */
  problem?: { text: string; onRetry?: () => void } | null;
  /** Live data for this call from /api/session/state. Null until the first response. */
  snapshot?: Snapshot | null;
  snapshotError?: string | null;
  /** Language the call was started in (fixed for the call) */
  callLanguage?: string;
  /** Which tab to open first (the dev preview uses this; real calls start on the conversation). */
  initialTab?: 'talk' | 'result' | 'schedule';
};

const orbLabel = (s: (typeof STRINGS)['en'], state: OrbState): string =>
  ({ joining: s.connecting, 'not-joined': s.orbNotJoined, listening: s.orbListening, thinking: s.orbThinking, speaking: s.orbSpeaking, muted: s.orbMuted, disconnected: s.orbDisconnected })[state];

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export function VoiceScreen({
  orbState, messageList, currentInProgressMessage, agentUID, onToggleMic, onSendText, onEnd, micSelector, problem, snapshot = null, snapshotError = null, callLanguage = 'hi', initialTab = 'talk',
}: VoiceScreenProps) {
  // Phone: talk | result | schedule. Desktop: the conversation is always visible; the right panel shows result or schedule.
  const [tab, setTab] = useState<'talk' | 'result' | 'schedule'>(initialTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenVisit = useRef<string | null>(null);
  // How long a visit took: from her first words in this call to the moment the visit shows up as saved.
  const firstWordsAt = useRef<number | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState<number | null>(null);

  const messages = useMemo(
    () => (currentInProgressMessage ? [...messageList, currentInProgressMessage] : messageList),
    [messageList, currentInProgressMessage],
  );

  // Detected language = language of the most recent message that has real text.
  const { uiLang } = useLanguage();
  const detected = useMemo<UiLang | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const d = detectUiLang(messages[i].text);
      if (d) return d;
    }
    return null;
  }, [messages]);

  // The call language is fixed (chosen on the start screen). Only in Auto mode do the labels follow what was last spoken.
  const call = isLangCode(callLanguage) ? LANGUAGES[callLanguage] : LANGUAGES.hi;
  const lang: UiLang = call.code === 'auto' ? (detected ?? uiLang) : call.code;
  const s = STRINGS[lang];

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, tab]);

  // Note the moment she first speaks.
  useEffect(() => {
    if (firstWordsAt.current != null) return;
    if (messages.some((m) => String(m.uid) !== agentUID && (m.text ?? '').trim().length > 0)) firstWordsAt.current = Date.now();
  }, [messages, agentUID]);

  // When a new visit is saved, bring the result into view on phones (desktop always shows both).
  const visit = snapshot?.visit ?? null;
  useEffect(() => {
    if (visit && visit.id !== seenVisit.current) {
      seenVisit.current = visit.id;
      setTab('result');
      if (firstWordsAt.current != null) {
        setRecordedSeconds(Math.max(1, Math.round((Date.now() - firstWordsAt.current) / 1000)));
        firstWordsAt.current = null; // the next visit in this call is timed from her next words
      } else {
        setRecordedSeconds(null);
      }
    }
  }, [visit]);

  const schedule = useMemo(() => snapshot?.schedule ?? [], [snapshot]);
  const dueNow = useMemo(() => dueNowCount(schedule, todayInIndia()), [schedule]);
  const dueBadge = dueNow > 0 && (
    <span className="min-w-6 rounded-full bg-asha-red px-1.5 text-center text-sm font-bold leading-6 text-white" aria-label={s.schedDue(dueNow)}>
      {dueNow}
    </span>
  );
  const visitDot = visit && tab !== 'result' && <span className="h-2.5 w-2.5 rounded-full bg-asha-red" aria-label="new" />;

  const orbClickable =orbState !== 'joining' && orbState !== 'not-joined' && orbState !== 'disconnected';
  const asha = snapshot?.asha ?? null;
  const counts = snapshot?.counts ?? null;
  const noDb = snapshotError === 'DATABASE_NOT_CONFIGURED';
  const signedOut = snapshotError === 'SIGN_IN_REQUIRED' || snapshotError === 'SESSION_EXPIRED';

  return (
    // Phone: one column, one screen. Desktop (lg+): full-width grid, conversation left, orb + result right.
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-asha-cream pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] lg:grid lg:max-w-7xl lg:grid-cols-[minmax(24rem,30rem)_1fr] lg:grid-rows-[auto_auto_auto_auto_auto_minmax(0,1fr)] lg:gap-x-10 lg:px-10 lg:pb-8">
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 lg:col-span-2 lg:px-0 lg:pt-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-asha-teal text-lg font-bold text-white lg:h-14 lg:w-14 lg:text-xl">
            {asha ? initials(asha.name) : 'AS'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-6 lg:text-xl">{asha?.name ?? 'ASHA Saathi'}</p>
            <p className="truncate text-sm text-asha-muted">{asha ? `ASHA · ${asha.phcName}` : s.connecting}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-xl font-extrabold tracking-tight text-asha-teal lg:block">ASHA Saathi</span>
          <span
            className="flex h-11 items-center gap-2 rounded-full bg-asha-sand px-4 text-base font-bold"
            aria-label={`Call language: ${call.name}`}
          >
            <span className="h-2 w-2 rounded-full bg-asha-teal" aria-hidden />
            {call.native}
          </span>
        </div>
      </header>

      {counts && (
        <div className="flex gap-2 px-4 pb-2 lg:col-span-2 lg:px-0 lg:pb-4">
          <span className="rounded-full border border-asha-line bg-white px-3 py-1 text-sm font-medium">{s.visitsToday(counts.visits)}</span>
          {counts.highRisk > 0 && (
            <span className="rounded-full bg-asha-red-soft px-3 py-1 text-sm font-bold text-asha-red">{s.highRiskCount(counts.highRisk)}</span>
          )}
          {counts.alertsSent > 0 && (
            <span className="rounded-full bg-asha-mint px-3 py-1 text-sm font-medium text-asha-teal">{s.alertsSent(counts.alertsSent)}</span>
          )}
        </div>
      )}

      {(problem || noDb || signedOut) && (
        <div className="space-y-2 px-4 pb-2 lg:col-span-2 lg:px-0 lg:pb-4">
          {signedOut && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-asha-red/20 bg-asha-red-soft p-3 text-sm text-asha-red">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 font-medium">{s.signedOut}</p>
              <a href="/login?expired=1" className="shrink-0 rounded-full border border-asha-red/30 bg-white px-3 py-1 font-bold">{s.signInAgain}</a>
            </div>
          )}
          {noDb && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-asha-red/20 bg-asha-amber/60 p-3 text-sm">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="font-medium">The database is not connected, so visits cannot be saved. Add DATABASE_URL (see README).</p>
            </div>
          )}
          {problem && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-asha-red/20 bg-asha-red-soft p-3 text-sm text-asha-red">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 break-words font-medium">{problem.text}</p>
              {problem.onRetry && (
                <Button variant="outline" size="sm" className="shrink-0 border-asha-red/30 bg-white text-asha-red" onClick={problem.onRetry}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> {s.retry}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phone: switch between the conversation and the saved result. Desktop shows both. */}
      <TabBar
        ariaLabel="View"
        idPrefix="phone-tab"
        className="mx-4 mb-2 grid lg:hidden"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'talk', label: s.tabTalk },
          { key: 'result', label: s.tabVisit, badge: visitDot },
          { key: 'schedule', label: s.tabSchedule, badge: dueBadge },
        ]}
      />

      {/* Conversation */}
      <div
        ref={scrollRef}
        className={cn(
          'min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-2 lg:col-start-1 lg:row-span-3 lg:row-start-4 lg:flex lg:flex-none lg:rounded-3xl lg:border lg:border-asha-line lg:bg-white/60 lg:p-5',
          tab === 'talk' ? 'flex' : 'hidden',
        )}
        aria-label="Conversation"
      >
        {!visit && <HintStrip s={s} />}
        {messages.length === 0 ? (
          <p className="m-auto max-w-[16rem] text-center text-base text-asha-muted">{s.empty}</p>
        ) : (
          messages.map((m, i) => {
            const isAgent = String(m.uid) === agentUID;
            const text = m.text?.trim();
            return (
              <div key={`${m.turn_id ?? m.uid}-${i}`} className={cn('flex flex-col', isAgent ? 'items-start' : 'items-end')}>
                <span className="mb-1 px-1 text-xs font-semibold text-asha-muted">{isAgent ? s.saathi : s.you}</span>
                <p
                  className={cn(
                    'max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-4 py-3 text-[17px] leading-7',
                    isAgent ? 'rounded-tl-lg border border-asha-line bg-white text-asha-ink' : 'rounded-tr-lg bg-asha-teal text-white',
                  )}
                >
                  {text || '…'}
                </p>
              </div>
            );
          })
        )}
        {onSendText && <TypeBox onSend={onSendText} disabled={orbState === 'joining' || orbState === 'not-joined' || orbState === 'disconnected'} s={s} />}
      </div>

      {/* Orb + controls: bottom dock on phone, centred main stage on desktop */}
      <div
        className={cn(
          'order-last flex shrink-0 flex-col items-center gap-4 px-4 pb-6 pt-4 lg:order-none lg:col-start-2 lg:row-start-4 lg:pb-4 lg:pt-0',
          // Schedule tab (desktop): orb and buttons sit side by side so the list gets the space
          tab === 'schedule' ? 'lg:flex-row lg:justify-center lg:gap-10 lg:pb-6 lg:pt-2' : 'lg:gap-5',
        )}
      >
        <Orb
          state={orbState}
          label={orbLabel(s, orbState)}
          onClick={orbClickable ? onToggleMic : undefined}
          compact={tab === 'schedule'}
          disabled={!orbClickable}
          ariaLabel={orbState === 'muted' ? 'Unmute microphone' : 'Mute microphone'}
        />
        {(orbState === 'joining' || orbState === 'not-joined') && (
          <ConnectingGreetings words={call.code === 'auto' ? Object.values(HELLO) : [HELLO[lang]]} />
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onEnd}
            className="h-12 rounded-full border-asha-line bg-white px-6 text-base font-bold text-asha-ink hover:bg-asha-sand"
            aria-label="End call"
          >
            <PhoneOff className="h-4 w-4" aria-hidden />
            {s.end}
          </Button>
          {micSelector}
        </div>
      </div>

      {/* Desktop only: switch the right panel between the visit result and the schedule. */}
      <TabBar
        ariaLabel="Panel"
        idPrefix="panel-tab"
        className="mb-3 hidden lg:col-start-2 lg:row-start-5 lg:grid"
        value={tab === 'schedule' ? 'schedule' : 'result'}
        onChange={setTab}
        tabs={[
          { key: 'result', label: s.tabVisit, badge: visitDot },
          { key: 'schedule', label: s.tabSchedule, badge: dueBadge },
        ]}
      />

      {/* Planned follow-up visits, grouped by when they are due. */}
      <div
        role="tabpanel"
        aria-label={s.tabSchedule}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1 lg:col-start-2 lg:row-start-6 lg:flex-none lg:px-0',
          tab === 'schedule' ? 'block' : 'hidden',
        )}
      >
        <SchedulePanel schedule={schedule} s={s} lang={lang} />
      </div>

      {/* Saved visit: risk, why, alert, follow-up, who is left today. Real data from the database. */}
      <div
        role="tabpanel"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1 lg:col-start-2 lg:row-start-6 lg:flex-none lg:px-0',
          tab === 'result' ? 'block lg:block' : tab === 'schedule' ? 'hidden' : 'hidden lg:block',
        )}
        aria-label="Visit details"
      >
        {visit && snapshot ? (
          <div className="space-y-6 pb-4">
            <AlertBar visit={visit} s={s} />
            <RecordGuide visit={visit} seconds={recordedSeconds} s={s} />
            <RiskResult visit={visit} events={snapshot.events} s={s} />
            <AlertSent visit={visit} remaining={snapshot.remaining} s={s} />
          </div>
        ) : (
          <RecordGuide visit={null} s={s} />
        )}
      </div>
    </div>
  );
}
