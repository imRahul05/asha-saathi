'use client';

import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrbState } from '@/lib/asha/lang';

const BAR_H = [0.35, 0.7, 0.5, 1, 0.6, 0.85, 0.4, 0.95, 0.55, 0.8, 0.45, 0.7, 0.9, 0.4, 0.6, 0.75, 0.35];
const SMOOTH = 'transition-[width,height] duration-300 motion-reduce:transition-none';

/** A row of bars that dances while Saathi speaks, ripples gently while she listens, and three dots bounce while she thinks. */
function VoiceWave({ state, compact }: { state: OrbState; compact: boolean }) {
  // Phone: 48px tall bars. Desktop: smaller, and smaller again when the orb is compact.
  const h = compact ? 'h-12 lg:h-6' : 'h-12 lg:h-9';
  if (state === 'thinking') {
    return (
      <div className={cn('flex items-center gap-2', SMOOTH, h)} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('think-dot rounded-full bg-asha-teal', compact ? 'h-3 w-3 lg:h-2 lg:w-2' : 'h-3 w-3 lg:h-2.5 lg:w-2.5')}
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
    );
  }
  if (state !== 'speaking' && state !== 'listening') return <div className={cn(SMOOTH, h)} aria-hidden />;
  const speaking = state === 'speaking';
  return (
    <div
      className={cn('flex items-center', SMOOTH, h, compact ? 'gap-[5px] lg:gap-[3px]' : 'gap-[5px] lg:gap-1', speaking ? 'wave-speak' : 'wave-listen')}
      aria-hidden
    >
      {BAR_H.map((v, i) => (
        <span
          key={i}
          className={cn('wave-bar rounded-full', compact ? 'w-[5px] lg:w-[3px]' : 'w-[5px] lg:w-1', speaking ? 'bg-asha-teal' : 'bg-asha-orange/70')}
          style={{ height: `${v * 100}%`, animationDelay: `${(i % 6) * 90}ms` }}
        />
      ))}
    </div>
  );
}

type OrbProps = {
  state: OrbState;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** sm and md are fixed sizes; lg is the main control: big on phones, smaller on desktop. */
  size?: 'sm' | 'md' | 'lg';
  /** Desktop only (lg+, size lg): shrink the whole block (circle, bars, label) and put the label beside the circle. */
  compact?: boolean;
  ariaLabel: string;
};

// The orb is the one big control: it shows what the agent is doing and toggles the mic.
export function Orb({ state, label, onClick, disabled, size = 'lg', compact = false, ariaLabel }: OrbProps) {
  const waiting = state === 'joining' || state === 'not-joined';
  const active = state === 'listening' || state === 'speaking';
  const shrink = size === 'lg' && compact;
  const dim = size === 'lg' ? cn('h-40 w-40', shrink ? 'lg:h-20 lg:w-20' : 'lg:h-36 lg:w-36') : size === 'md' ? 'h-24 w-24' : 'h-16 w-16';
  const micIcon = size === 'lg' ? cn('h-12 w-12', SMOOTH, shrink ? 'lg:h-8 lg:w-8' : 'lg:h-12 lg:w-12') : size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
  const stateIcon = size === 'lg' ? cn('h-10 w-10', SMOOTH, shrink ? 'lg:h-7 lg:w-7' : 'lg:h-10 lg:w-10') : size === 'md' ? 'h-10 w-10' : 'h-6 w-6';

  const tone =
    state === 'speaking'
      ? 'bg-asha-teal shadow-[0_16px_40px_rgba(31,107,94,0.35)]'
      : state === 'muted' || state === 'disconnected'
        ? 'bg-asha-ink/80 shadow-[0_12px_30px_rgba(30,40,36,0.25)]'
        : waiting
          ? 'bg-asha-sand shadow-[0_10px_26px_rgba(30,40,36,0.12)]'
          : 'bg-asha-orange shadow-[0_16px_40px_rgba(217,115,42,0.38)]';

  const ringTone = state === 'speaking' ? 'bg-asha-teal' : 'bg-asha-orange';

  return (
    <div className={cn('flex flex-col items-center gap-4', shrink ? 'lg:flex-row lg:gap-5' : 'lg:gap-3')}>
      <div className={cn('relative flex shrink-0 items-center justify-center', SMOOTH, dim)}>
        {active && (
          <>
            <span className={cn('orb-ring pointer-events-none absolute inset-0 rounded-full', ringTone)} aria-hidden />
            <span className={cn('orb-ring-d pointer-events-none absolute inset-0 rounded-full', ringTone)} aria-hidden />
          </>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'relative z-10 flex h-full w-full items-center justify-center rounded-full text-white transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/40 disabled:cursor-default',
            tone,
            state === 'listening' && 'orb-breathe',
          )}
        >
          {state === 'thinking' ? (
            <span className={cn('orb-think absolute rounded-full border-white/30 border-t-white', shrink ? 'inset-3 border-4 lg:inset-2 lg:border-[3px]' : 'inset-3 border-4')} aria-hidden />
          ) : null}
          {waiting ? (
            <Loader2 className={cn(stateIcon, 'animate-spin text-asha-ink/60')} aria-hidden />
          ) : state === 'muted' || state === 'disconnected' ? (
            <MicOff className={stateIcon} aria-hidden />
          ) : (
            <Mic className={micIcon} aria-hidden />
          )}
        </button>
      </div>
      <div className={cn('flex flex-col items-center gap-4', shrink ? 'lg:items-start lg:gap-1' : 'lg:gap-3')}>
        <VoiceWave state={state} compact={shrink} />
        <p
          className={cn(
            'min-h-8 text-center text-2xl font-bold leading-8 text-asha-ink',
            shrink ? 'lg:text-left lg:text-xl' : 'lg:text-2xl',
          )}
          aria-live="polite"
        >
          {label}
        </p>
      </div>
    </div>
  );
}
