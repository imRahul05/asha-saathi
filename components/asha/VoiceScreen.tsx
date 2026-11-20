'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, PhoneOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { Orb } from './Orb';
import { cn } from '@/lib/utils';
import { SAMPLE_ASHA, SAMPLE_STATS } from '@/lib/asha/fixtures';
import {
  LANG_NAME,
  ORB_LABEL,
  UI_TEXT,
  detectLang,
  type Lang,
  type LangChoice,
  type OrbState,
} from '@/lib/asha/lang';

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
  onEnd: () => void;
  micSelector?: ReactNode;
  /** A plain-words problem to show (e.g. agent never joined, RTC error), with an optional retry. */
  problem?: { text: string; onRetry?: () => void } | null;
};

export function VoiceScreen({
  orbState,
  messageList,
  currentInProgressMessage,
  agentUID,
  onToggleMic,
  onEnd,
  micSelector,
  problem,
}: VoiceScreenProps) {
  const [choice, setChoice] = useState<LangChoice>('auto');
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => (currentInProgressMessage ? [...messageList, currentInProgressMessage] : messageList),
    [messageList, currentInProgressMessage],
  );

  // Detected language = language of the most recent message that has real text.
  const detected = useMemo<Lang>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const d = detectLang(messages[i].text);
      if (d) return d;
    }
    return 'hi';
  }, [messages]);

  const lang: Lang = choice === 'auto' ? detected : choice;
  const t = UI_TEXT[lang];

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const orbClickable = orbState !== 'joining' && orbState !== 'not-joined' && orbState !== 'disconnected';

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-asha-cream pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {/* Header: who is signed in + detected language */}
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-asha-teal text-lg font-bold text-white">
            {SAMPLE_ASHA.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-6">{SAMPLE_ASHA.name}</p>
            <p className="truncate text-sm text-asha-muted">
              {SAMPLE_ASHA.role} · {SAMPLE_ASHA.phc}
            </p>
          </div>
        </div>

        <Menu>
          <MenuTrigger
            render={
              <button
                type="button"
                aria-label="Language"
                className="flex h-11 items-center gap-2 rounded-full bg-asha-sand px-4 text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
              />
            }
          >
            <span className={cn('h-2 w-2 rounded-full', choice === 'auto' ? 'bg-asha-teal' : 'bg-asha-orange')} aria-hidden />
            {LANG_NAME[lang]}
            <ChevronDown className="h-4 w-4 text-asha-muted" aria-hidden />
          </MenuTrigger>
          <MenuContent align="end" className="w-48 bg-white">
            {(['auto', 'hi', 'kn', 'en'] as LangChoice[]).map((c) => (
              <MenuItem key={c} onClick={() => setChoice(c)}>
                <span>{c === 'auto' ? `Auto · ${LANG_NAME[detected]}` : LANG_NAME[c]}</span>
                {choice === c && <Check className="ml-auto h-4 w-4 text-asha-teal" aria-hidden />}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </header>

      {/* Sample stat chips (real numbers arrive with the database) */}
      <div className="flex gap-2 px-4 pb-2">
        <span className="rounded-full border border-asha-line bg-white px-3 py-1 text-sm font-medium">
          {SAMPLE_STATS.visitsToday} visits
        </span>
        <span className="rounded-full bg-asha-red-soft px-3 py-1 text-sm font-bold text-asha-red">
          {SAMPLE_STATS.highRisk} high risk
        </span>
      </div>

      {problem && (
        <div role="alert" className="mx-4 mb-2 flex items-start gap-3 rounded-2xl border border-asha-red/20 bg-asha-red-soft p-3 text-sm text-asha-red">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 break-words font-medium">{problem.text}</p>
          {problem.onRetry && (
            <Button variant="outline" size="sm" className="shrink-0 border-asha-red/30 bg-white text-asha-red" onClick={problem.onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Retry
            </Button>
          )}
        </div>
      )}

      {/* Conversation */}
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-2" aria-label="Conversation">
        {messages.length === 0 ? (
          <p className="m-auto max-w-[16rem] text-center text-base text-asha-muted">{t.empty}</p>
        ) : (
          messages.map((m, i) => {
            const isAgent = String(m.uid) === agentUID;
            const text = m.text?.trim();
            return (
              <div key={`${m.turn_id ?? m.uid}-${i}`} className={cn('flex flex-col', isAgent ? 'items-start' : 'items-end')}>
                <span className="mb-1 px-1 text-xs font-semibold text-asha-muted">{isAgent ? t.saathi : t.you}</span>
                <p
                  className={cn(
                    'max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-4 py-3 text-[17px] leading-7',
                    isAgent
                      ? 'rounded-tl-lg border border-asha-line bg-white text-asha-ink'
                      : 'rounded-tr-lg bg-asha-teal text-white',
                  )}
                >
                  {text || '…'}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Orb + controls */}
      <div className="flex shrink-0 flex-col items-center gap-4 px-4 pb-6 pt-4">
        <Orb
          state={orbState}
          label={ORB_LABEL[lang][orbState]}
          onClick={orbClickable ? onToggleMic : undefined}
          disabled={!orbClickable}
          ariaLabel={orbState === 'muted' ? 'Unmute microphone' : 'Mute microphone'}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onEnd}
            className="h-12 rounded-full border-asha-line bg-white px-6 text-base font-bold text-asha-ink hover:bg-asha-sand"
            aria-label="End call"
          >
            <PhoneOff className="h-4 w-4" aria-hidden />
            {t.end}
          </Button>
          {micSelector}
        </div>
      </div>
    </div>
  );
}
