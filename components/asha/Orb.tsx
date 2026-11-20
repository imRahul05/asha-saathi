'use client';

import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrbState } from '@/lib/asha/lang';

type OrbProps = {
  state: OrbState;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'md' | 'lg';
  ariaLabel: string;
};

// The orb is the one big control: it shows what the agent is doing and toggles the mic.
export function Orb({ state, label, onClick, disabled, size = 'lg', ariaLabel }: OrbProps) {
  const waiting = state === 'joining' || state === 'not-joined';
  const active = state === 'listening' || state === 'speaking';
  const dim = size === 'lg' ? 'h-40 w-40' : 'h-24 w-24';

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
    <div className="flex flex-col items-center gap-4">
      <div className={cn('relative flex items-center justify-center', dim)}>
        {active && (
          <>
            <span className={cn('orb-ring absolute inset-0 rounded-full', ringTone)} aria-hidden />
            <span className={cn('orb-ring-d absolute inset-0 rounded-full', ringTone)} aria-hidden />
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
            <span className="orb-think absolute inset-3 rounded-full border-4 border-white/30 border-t-white" aria-hidden />
          ) : null}
          {waiting ? (
            <Loader2 className="h-10 w-10 animate-spin text-asha-ink/60" aria-hidden />
          ) : state === 'muted' || state === 'disconnected' ? (
            <MicOff className="h-10 w-10" aria-hidden />
          ) : (
            <Mic className={size === 'lg' ? 'h-12 w-12' : 'h-8 w-8'} aria-hidden />
          )}
        </button>
      </div>
      <p className="min-h-8 text-center text-2xl font-bold leading-8 text-asha-ink" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
