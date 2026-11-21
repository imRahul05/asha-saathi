'use client';

import { Loader2, Mic } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { cn } from '@/lib/utils';

type Props = {
  /** idle: inviting pulse; talking: a voice sample is playing; connecting: the call is being set up */
  state: 'idle' | 'talking' | 'connecting';
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

/**
 * The start control: Saathi's picture as a big round button with a mic badge, and a clear labeled pill under it.
 * It pulses softly to say "press me", and while a voice sample plays its rings and bars move, so it looks like she is speaking.
 * (Agora's video avatars need a third-party vendor key and extra video cost, so this is an in-app avatar.)
 */
export function SaathiAvatar({ state, label, onClick, disabled }: Props) {
  const talking = state === 'talking';
  const connecting = state === 'connecting';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-44 w-44 items-center justify-center lg:h-52 lg:w-52">
        {(talking || state === 'idle') && (
          <>
            <span className={cn('orb-ring pointer-events-none absolute inset-0 rounded-full', talking ? 'bg-asha-teal' : 'bg-asha-orange')} aria-hidden />
            <span className={cn('orb-ring-d pointer-events-none absolute inset-0 rounded-full', talking ? 'bg-asha-teal' : 'bg-asha-orange')} aria-hidden />
          </>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            'relative z-10 h-full w-full rounded-full border-[6px] bg-white shadow-[0_14px_36px_rgba(217,115,42,0.35)] transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/40 enabled:hover:scale-[1.03] enabled:active:scale-95 disabled:cursor-default',
            talking ? 'border-asha-teal' : 'border-asha-orange',
            state === 'idle' && 'orb-breathe',
          )}
        >
          <BrandMark className="h-full w-full rounded-full" />
          {connecting && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-asha-night/55">
              <Loader2 className="h-12 w-12 animate-spin text-white" aria-hidden />
            </span>
          )}
        </button>
        {!connecting && (
          <span className="absolute bottom-1 right-1 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-asha-orange text-white shadow-lg" aria-hidden>
            <Mic className="h-6 w-6" />
          </span>
        )}
      </div>

      {talking && (
        <div className="wave-speak flex h-8 items-center gap-[4px]" aria-hidden>
          {[0.4, 0.8, 0.55, 1, 0.65, 0.9, 0.5, 0.85, 0.45].map((h, i) => (
            <span key={i} className="wave-bar w-[4px] rounded-full bg-asha-teal" style={{ height: `${h * 100}%`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-asha-orange px-8 text-xl font-extrabold text-asha-night shadow-md transition-colors hover:bg-[#E8863C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50 disabled:opacity-70"
      >
        {connecting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
        {label}
      </button>
    </div>
  );
}
