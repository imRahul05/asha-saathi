'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BellRing, Check, CalendarCheck, Mic, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/i18n/LanguageProvider';

// "Inside one visit": the five steps of a visit drawn as a 3D stack of layers, from the spoken sentence at the
// bottom to the doctor's alert at the top. The active layer lifts out of the stack and turns to face you.
//
// Two ways to drive it, so it works with or without scrolling:
// - Wide screens: the section is tall and its stage is sticky. Scrolling through it opens the stack and walks the layers.
//   The step list on the left jumps to a layer (it scrolls to that point, so scroll and tap never disagree).
// - Phones, or any time: tap a step. On phones it also plays through on its own while in view, until the first tap.
// Pointer movement tilts the stack a little. prefers-reduced-motion: no autoplay, no tilt, stack shown open.
//
// Only CSS 3D transforms and opacity change. Scroll work is one rAF-throttled read that writes CSS variables.
// SAMPLE content only, the same scripted visit as the hero demo.

const LAYERS = 5;
const AUTOPLAY_MS = 2600;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function VisitLayers() {
  const { s } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [scrollDriven, setScrollDriven] = useState(false);
  const [reduced, setReduced] = useState(false);
  const userPicked = useRef(false);

  // Which mode are we in? Re-checked when the window crosses the breakpoint.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReduced(rm.matches);
      setScrollDriven(wide.matches && !rm.matches);
    };
    sync();
    wide.addEventListener('change', sync);
    rm.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
      rm.removeEventListener('change', sync);
    };
  }, []);

  // Scroll-driven mode: progress through the tall section opens the stack and picks the layer.
  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    if (!scrollDriven) {
      stage.style.setProperty('--open', '1');
      stage.style.setProperty('--spin', '0deg');
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? clamp(-rect.top / travel) : 0;
      stage.style.setProperty('--open', clamp(p / 0.12 + 0.15).toFixed(3));
      stage.style.setProperty('--spin', `${(p * 14).toFixed(2)}deg`);
      setActive(Math.min(LAYERS - 1, Math.floor(p * LAYERS)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollDriven]);

  // Tap mode: play through on its own while on screen, until someone picks a step.
  useEffect(() => {
    const section = sectionRef.current;
    if (scrollDriven || reduced || !section) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        clearInterval(timer);
        if (entry.isIntersecting && !userPicked.current) {
          timer = setInterval(() => setActive((a) => (a + 1) % LAYERS), AUTOPLAY_MS);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, [scrollDriven, reduced]);

  const pick = useCallback(
    (i: number) => {
      userPicked.current = true;
      const section = sectionRef.current;
      if (scrollDriven && section) {
        const top = section.getBoundingClientRect().top + window.scrollY;
        const travel = section.offsetHeight - window.innerHeight;
        window.scrollTo({ top: top + ((i + 0.5) / LAYERS) * travel, behavior: 'smooth' });
      } else {
        setActive(i);
      }
    },
    [scrollDriven],
  );

  // Small pointer tilt, mouse/pen only.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === 'touch') return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--tilt-z', `${(dx * 10).toFixed(2)}deg`);
    el.style.setProperty('--tilt-x', `${(-dy * 8).toFixed(2)}deg`);
  };
  const onPointerLeave = () => {
    stageRef.current?.style.setProperty('--tilt-z', '0deg');
    stageRef.current?.style.setProperty('--tilt-x', '0deg');
  };

  const faces: ReactNode[] = [
    <FaceSpeak key="speak" text={s.demoSpoken} />,
    <FaceUnderstand key="understand" weeks={s.demoWeeks} swelling={s.demoSwelling} feet={s.demoFeet} />,
    <FaceCheck key="check" title={s.demoRiskH} detail={s.demoRiskD} />,
    <FaceConfirm key="confirm" ask={s.demoAsk} yes={s.demoYes} />,
    <FaceFollow key="follow" done={s.demoDone} follow={s.demoFollow} />,
  ];

  return (
    <section
      ref={sectionRef}
      id="inside"
      aria-labelledby="inside-h"
      className={cn('relative overflow-x-clip bg-asha-sand', scrollDriven ? 'h-[340vh]' : 'py-20')}
    >
      <div className={cn(scrollDriven && 'sticky top-20 flex h-[calc(100svh-5rem)] items-center overflow-hidden')}>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
          {/* Text column: heading, then the five steps as buttons */}
          <div className="relative z-10">
            <h2 id="inside-h" className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
              {s.layersH}
            </h2>
            <p className="mt-4 max-w-md text-lg leading-8 text-asha-muted">{s.layersP}</p>
            <ol className="relative mt-8 space-y-1 border-l-2 border-asha-line pl-0">
              {s.steps.map(([t, d], i) => {
                const on = i === active;
                return (
                  <li key={t} className="relative">
                    <span
                      className={cn(
                        'absolute -left-[2px] top-0 h-full w-[2px] origin-top bg-asha-orange transition-transform duration-500',
                        i <= active ? 'scale-y-100' : 'scale-y-0',
                      )}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => pick(i)}
                      aria-current={on ? 'step' : undefined}
                      className={cn(
                        'group w-full rounded-r-2xl py-2.5 pl-5 pr-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal',
                        on ? 'bg-asha-paper/70' : 'hover:bg-asha-paper/40',
                      )}
                    >
                      <span className="flex items-baseline gap-3">
                        <span className={cn('font-display text-lg font-extrabold tabular-nums', on ? 'text-asha-orange' : 'text-asha-muted')}>
                          {i + 1}
                        </span>
                        <span className={cn('text-lg font-bold', !on && 'text-asha-muted')}>{t}</span>
                      </span>
                      <span
                        className={cn(
                          'grid transition-[grid-template-rows,opacity] duration-500 ease-out',
                          on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                        )}
                      >
                        <span className="overflow-hidden">
                          <span className="block pb-1 pl-7 pt-1 text-base leading-7 text-asha-muted">{d}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* 3D stage */}
          <div
            ref={stageRef}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            className="layer-stage relative mx-auto mt-16 h-[400px] lg:mt-0 w-full max-w-[560px] sm:h-[540px]"
            style={{ '--open': 1, '--spin': '0deg', '--tilt-x': '0deg', '--tilt-z': '0deg' } as CSSProperties}
            aria-hidden
          >
            <div className="layer-floor" />
            <div className="layer-stack">
              {faces.map((face, i) => (
                <div
                  key={i}
                  className="layer-card"
                  data-state={i === active ? 'active' : i < active ? 'past' : 'next'}
                  style={{ '--i': i } as CSSProperties}
                >
                  <div className="layer-face">
                    <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-asha-muted">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-asha-orange text-[11px] text-asha-night">{i + 1}</span>
                      {s.steps[i]?.[0]}
                    </p>
                    {face}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Layer faces: tiny pieces of the real screens ---------- */

const BARS = [0.45, 0.85, 0.35, 1, 0.6, 0.9, 0.4, 0.75, 0.5, 0.95, 0.4, 0.7];

function FaceSpeak({ text }: { text: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asha-orange text-white">
          <Mic className="h-4 w-4" />
        </span>
        <div className="flex h-7 flex-1 items-center gap-[3px]">
          {BARS.map((h, i) => (
            <span key={i} className="voice-bar w-1 rounded-full bg-asha-orange" style={{ height: `${h * 100}%`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-6">{text}</p>
    </div>
  );
}

function FaceUnderstand({ weeks, swelling, feet }: { weeks: string; swelling: string; feet: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { k: 'BP', v: '150/100', hot: true },
        { k: weeks, v: '28' },
        { k: swelling, v: feet },
      ].map((c) => (
        <div key={c.k} className={cn('rounded-xl px-2.5 py-2', c.hot ? 'bg-asha-red-soft' : 'bg-asha-sand')}>
          <p className={cn('truncate text-[11px] font-medium', c.hot ? 'text-asha-red' : 'text-asha-muted')}>{c.k}</p>
          <p className={cn('truncate text-base font-bold', c.hot && 'text-asha-red')}>{c.v}</p>
        </div>
      ))}
    </div>
  );
}

function FaceCheck({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 rounded-xl bg-asha-red px-3 py-2.5 text-white">
        <TriangleAlert className="h-5 w-5 shrink-0" />
        <p className="text-[15px] font-extrabold leading-5">{title}</p>
      </div>
      <p className="flex items-start gap-2 text-[13px] leading-5 text-asha-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-asha-teal" />
        <span className="line-clamp-2">{detail}</span>
      </p>
    </div>
  );
}

function FaceConfirm({ ask, yes }: { ask: string; yes: string }) {
  return (
    <div className="space-y-2">
      <p className="w-fit max-w-[90%] rounded-2xl rounded-tl-md border border-asha-line bg-asha-cream px-3 py-2 text-[14px] leading-5">{ask}</p>
      <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-tr-md bg-asha-teal px-3 py-2 text-[14px] leading-5 text-white">{yes}</p>
    </div>
  );
}

function FaceFollow({ done, follow }: { done: string; follow: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 rounded-xl bg-asha-mint px-3 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-asha-teal text-white">
          <Check className="h-4 w-4" />
        </span>
        <p className="flex-1 text-[14px] font-semibold leading-5">{done}</p>
        <BellRing className="h-4 w-4 text-asha-teal" />
      </div>
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <CalendarCheck className="h-4 w-4 text-asha-teal" />
        {follow}
      </p>
    </div>
  );
}
