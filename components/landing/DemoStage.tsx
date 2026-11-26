'use client';

import { useEffect, useState } from 'react';
import { Check, TriangleAlert, CalendarCheck, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/i18n/LanguageProvider';

// A looping, scripted preview of one visit: speech -> structured record -> risk -> alert.
// SAMPLE content only. It is an illustration, not live data.
const STEP_MS = 1900;
const LAST_STEP = 5;

const BARS = [0.5, 0.9, 0.4, 1, 0.65, 0.85, 0.35, 0.95, 0.55, 0.8, 0.45, 0.7, 0.9, 0.4, 0.75];

export function DemoStage() {
  const [step, setStep] = useState(0);
  const { s } = useLanguage();

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setStep(LAST_STEP);
      return;
    }
    const id = setInterval(() => setStep((s) => (s >= LAST_STEP + 1 ? 0 : s + 1)), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const on = (n: number) => step >= n;
  const reveal = (n: number) =>
    cn('transition-all duration-500 ease-out', on(n) ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0');

  return (
    <div
      className="relative mx-auto w-full max-w-md rounded-[2rem] bg-asha-cream p-5 dark:ring-1 dark:ring-white/10 text-asha-ink shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-6"
      role="img"
      aria-label={`${s.demoSpoken} → ${s.demoRiskH} → ${s.demoDone}`}
    >
      {/* Voice line */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-asha-orange text-white">
          <Mic className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex h-9 flex-1 items-center gap-[3px]" aria-hidden>
          {BARS.map((h, i) => (
            <span
              key={i}
              className="voice-bar w-[5px] rounded-full bg-asha-orange"
              style={{ height: `${h * 100}%`, animationDelay: `${i * 70}ms`, opacity: on(0) && step < 2 ? 1 : 0.3 }}
            />
          ))}
        </div>
      </div>

      <p className={cn('mt-4 text-xl font-semibold leading-8 sm:text-2xl sm:leading-9', reveal(0))}>
        {s.demoSpoken}
      </p>

      {/* Extracted record */}
      <div className={cn('mt-5 grid grid-cols-3 gap-2', reveal(1))}>
        {[
          { k: 'BP', v: '150/100', hot: true },
          { k: s.demoWeeks, v: '28' },
          { k: s.demoSwelling, v: s.demoFeet },
        ].map((c) => (
          <div key={c.k} className={cn('rounded-2xl px-3 py-2', c.hot ? 'bg-asha-red-soft' : 'bg-asha-sand')}>
            <p className={cn('text-xs font-medium', c.hot ? 'text-asha-red' : 'text-asha-muted')}>{c.k}</p>
            <p className={cn('text-lg font-bold', c.hot && 'text-asha-red')}>{c.v}</p>
          </div>
        ))}
      </div>

      {/* Risk */}
      <div className={cn('mt-3 flex items-center gap-3 rounded-2xl bg-asha-red px-4 py-3 text-white', reveal(2))}>
        <TriangleAlert className="h-6 w-6 shrink-0" aria-hidden />
        <div>
          <p className="text-base font-extrabold leading-5">{s.demoRiskH}</p>
          <p className="text-sm leading-5 text-white/85">{s.demoRiskD}</p>
        </div>
      </div>

      {/* Confirmation by voice */}
      <div className={cn('mt-4 space-y-2', reveal(3))}>
        <p className="max-w-[85%] rounded-3xl rounded-tl-lg border border-asha-line bg-asha-paper px-4 py-2.5 text-base leading-6">
          {s.demoAsk}
        </p>
        <p className={cn('ml-auto w-fit rounded-3xl rounded-tr-lg bg-asha-teal px-4 py-2.5 text-base text-white', reveal(4))}>
          {s.demoYes}
        </p>
      </div>

      {/* Done */}
      <div className={cn('mt-4 flex items-center gap-3 rounded-2xl bg-asha-mint px-4 py-3', reveal(5))}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-asha-teal text-white">
          <Check className="h-5 w-5" aria-hidden />
        </span>
        <p className="flex-1 text-sm font-semibold leading-5">{s.demoDone}</p>
        <CalendarCheck className="h-5 w-5 text-asha-teal" aria-hidden />
        <p className="text-sm font-semibold">{s.demoFollow}</p>
      </div>
    </div>
  );
}
