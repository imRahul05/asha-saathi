'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Step = { t: string; d: string };

// The five steps light up in order as you scroll past them, and a rail fills behind the numbers.
// IntersectionObserver only: no scroll handlers, nothing recalculated per frame.
export function HowSteps({ steps }: { steps: Step[] }) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const [reached, setReached] = useState(-1); // index of the furthest step that has been reached
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReached(steps.length - 1);
      return;
    }
    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = refs.current.indexOf(e.target as HTMLLIElement);
            if (i >= 0) setReached((r) => Math.max(r, i));
          }
        }
      },
      { rootMargin: '0px 0px -30% 0px', threshold: 0.3 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);

  const progress = steps.length > 1 ? Math.max(0, reached) / (steps.length - 1) : 0;

  return (
    <div className="relative mt-14">
      {/* Rail (wide screens): fills left to right as steps are reached */}
      <div className="absolute left-0 right-0 top-[1.55rem] hidden h-0.5 bg-asha-line lg:block" aria-hidden>
        <div
          className="h-full origin-left bg-asha-orange transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${armed ? progress : 1})` }}
        />
      </div>
      <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
        {steps.map((s, i) => {
          const on = !armed || i <= reached;
          return (
            <li
              key={s.t}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className={cn('transition-all duration-700 ease-out', on ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-35')}
            >
              <span
                className={cn(
                  'inline-flex h-12 min-w-12 items-center justify-center rounded-full bg-asha-cream px-1 font-display text-4xl font-extrabold transition-colors duration-500',
                  on ? 'text-asha-orange' : 'text-asha-line',
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="mt-2 text-xl font-bold">{s.t}</h3>
              <p className="mt-2 text-base leading-7 text-asha-muted">{s.d}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
