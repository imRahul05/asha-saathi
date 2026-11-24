'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceOption } from '@/lib/voices';
import type { Strings } from '@/lib/i18n';

// A row of voice cards you can swipe (or scroll, or use the arrows or arrow keys on). The card nearest the centre is the chosen voice,
// and tapping a card chooses it too. Plain scroll-snap, so it feels native on a phone.
export function VoicePicker({
  voices, value, onChange, disabled, s, playingId,
}: { voices: VoiceOption[]; value: string; onChange: (id: string) => void; disabled?: boolean; s: Strings; playingId?: string | null }) {
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<Array<HTMLButtonElement | null>>([]);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const programmatic = useRef(false);
  const index = Math.max(0, voices.findIndex((x) => x.id === value));

  const centre = useCallback((i: number, smooth = true) => {
    const el = cards.current[i];
    const t = track.current;
    if (!el || !t) return;
    programmatic.current = true;
    t.scrollTo({ left: el.offsetLeft - (t.clientWidth - el.clientWidth) / 2, behavior: smooth ? 'smooth' : 'instant' });
    setTimeout(() => { programmatic.current = false; }, 450);
  }, []);

  // Keep the chosen card centred (also when the language, and so the list, changes).
  useEffect(() => centre(index, false), [voices, index, centre]);

  // After a swipe stops, choose the card nearest the centre.
  const onScroll = () => {
    if (programmatic.current || disabled) return;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const t = track.current;
      if (!t) return;
      const mid = t.scrollLeft + t.clientWidth / 2;
      let best = 0;
      let bestD = Infinity;
      cards.current.forEach((c, i) => {
        if (!c) return;
        const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (voices[best] && voices[best].id !== value) onChange(voices[best].id);
    }, 120);
  };

  const step = (dir: -1 | 1) => {
    const next = Math.min(voices.length - 1, Math.max(0, index + dir));
    if (voices[next]) { onChange(voices[next].id); centre(next); }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => step(-1)} disabled={disabled || index === 0} aria-label={s.voicePrev}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-asha-muted hover:bg-asha-sand disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div
          ref={track}
          onScroll={onScroll}
          role="radiogroup"
          aria-label={s.voiceLabel}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } }}
          className="relative flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingInline: 'calc(50% - 3.5rem)' }}
        >
          {voices.map((x, i) => {
            const on = x.id === value;
            return (
              <button
                key={x.id}
                ref={(el) => { cards.current[i] = el; }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                disabled={disabled}
                onClick={() => { onChange(x.id); centre(i); }}
                className={cn(
                  'flex h-20 w-28 shrink-0 snap-center flex-col items-center justify-center rounded-2xl border px-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-60',
                  on ? 'scale-100 border-asha-teal bg-asha-teal text-white shadow-md' : 'scale-90 border-asha-line bg-white text-asha-ink opacity-70',
                )}
              >
                <span className="text-lg font-bold leading-6">{x.name}</span>
                {playingId === x.id ? (
                  <span className="wave-speak flex h-4 items-center gap-[3px]" aria-hidden>
                    {[0.5, 1, 0.7, 0.95, 0.6, 0.85, 0.45].map((h, k) => (
                      <span key={k} className="wave-bar w-[3px] rounded-full bg-white" style={{ height: `${h * 100}%`, animationDelay: `${k * 80}ms` }} />
                    ))}
                  </span>
                ) : (
                  <span className={cn('text-xs font-medium', on ? 'text-white/85' : 'text-asha-muted')}>{x.gender === 'female' ? s.voiceFemale : s.voiceMale}</span>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => step(1)} disabled={disabled || index >= voices.length - 1} aria-label={s.voiceNext}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-asha-muted hover:bg-asha-sand disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {voices.length > 1 && <p className="mt-1 text-xs text-asha-muted">{s.voiceHint}</p>}
    </div>
  );
}
