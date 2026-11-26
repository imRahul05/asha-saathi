'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Mic, ShieldCheck, FileText, BellRing } from 'lucide-react';
import { DemoStage } from './DemoStage';
import { HowSteps } from './HowSteps';
import { Reveal, WordReveal } from './Reveal';
import { StickyHeader } from './StickyHeader';
import { VisitLayers } from './VisitLayers';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { LANGUAGES } from '@/lib/languages';
import { HELLO, UI_LANGS } from '@/lib/i18n';

const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const CTA =
  'inline-flex h-14 items-center justify-center rounded-full bg-asha-orange px-8 text-lg font-bold text-asha-night transition-colors hover:bg-[#E8863C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50';

const FEATURE_ICONS = [Mic, ShieldCheck, FileText, BellRing];

const rise = (i: number) => ({ '--i': i }) as CSSProperties;

// The whole page is written in the language picked in the header (remembered in this browser).
export function Landing() {
  const { s, uiLang } = useLanguage();
  const heroSize = uiLang === 'en' ? 'text-5xl sm:text-6xl lg:text-7xl' : 'text-4xl sm:text-5xl lg:text-6xl';
  return (
    <main className="relative bg-asha-cream text-asha-ink">
      <StickyHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-asha-night text-white">
        <div className={`${CONTAINER} grid items-center gap-12 pb-20 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-14`}>
          <div>
            <h1 className={`font-display font-extrabold leading-[1.15] tracking-tight ${heroSize}`}>
              <span className="hero-rise block" style={rise(0)}>
                {s.heroL1}
              </span>
              <span className="hero-rise block" style={rise(1)}>
                {s.heroL2}
              </span>
            </h1>
            <p className="hero-rise mt-6 max-w-xl text-lg leading-8 text-white/80 sm:text-xl sm:leading-9" style={rise(2)}>
              {s.heroP}
            </p>
            <div className="hero-rise mt-9 flex flex-wrap items-center gap-4" style={rise(3)}>
              <Link href="/app" prefetch={false} className={CTA}>
                {s.navTry}
              </Link>
              <a
                href="#how"
                className="rounded-full px-4 py-3 text-base font-semibold text-white/85 underline decoration-white/30 underline-offset-8 hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {s.heroSee}
              </a>
            </div>
            <p className="hero-rise mt-5 text-sm text-white/60" style={rise(4)}>
              {s.heroNote}
            </p>
          </div>
          <div className="hero-rise" style={rise(3)}>
            <DemoStage />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 lg:py-28">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
          <Reveal as="h2" className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
            {s.problemH}
          </Reveal>
          <dl className="divide-y divide-asha-line border-y border-asha-line">
            {s.problems.map(([t, d], i) => (
              <Reveal key={t} delay={i * 120} className="grid gap-1 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
                <dt className="text-lg font-bold">{t}</dt>
                <dd className="text-lg leading-8 text-asha-muted">{d}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* What it does */}
      <section className="bg-asha-sand py-20 lg:py-28">
        <div className={CONTAINER}>
          <Reveal as="h2" className="max-w-2xl font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
            {s.featuresH}
          </Reveal>
          <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {s.features.map(([t, d], idx) => {
              const Icon = FEATURE_ICONS[idx] ?? Mic;
              return (
                <Reveal key={t} delay={(idx % 2) * 110} from={idx % 2 ? 'right' : 'left'} className="flex gap-4">
                  <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-asha-teal text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold">{t}</h3>
                    <p className="mt-1 text-lg leading-8 text-asha-muted">{d}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works: a real sequence, so numbered and progressive */}
      <section id="how" className="scroll-mt-24 py-20 lg:py-28">
        <div className={CONTAINER}>
          <Reveal as="h2" className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
            {s.howH}
          </Reveal>
          <HowSteps steps={s.steps.map(([t, d]) => ({ t, d }))} />
        </div>
      </section>

      {/* Inside one visit: the same steps as a 3D stack, driven by scroll or by tapping a step */}
      <VisitLayers />

      {/* Safety */}
      <section className="bg-asha-night py-20 text-white lg:py-28">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20`}>
          <WordReveal text={s.safeH} className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl" />
          <Reveal delay={250} className="space-y-5 text-lg leading-8 text-white/80">
            <p>{s.safeP1}</p>
            <p>{s.safeP2}</p>
          </Reveal>
        </div>
      </section>

      {/* Languages */}
      <section className="py-20 lg:py-28">
        <div className={CONTAINER}>
          <Reveal as="h2" className="max-w-2xl font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
            {s.langH}
          </Reveal>
          <Reveal as="p" delay={100} className="mt-4 max-w-xl text-lg leading-8 text-asha-muted">
            {s.langP}
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {UI_LANGS.map((code, i) => (
              <Reveal key={code} delay={(i % 3) * 130} from="scale" className="border-t-4 border-asha-teal pt-5">
                <p className="text-3xl font-bold leading-10 sm:text-4xl sm:leading-[3rem]">{HELLO[code]}</p>
                <p className="mt-2 text-lg text-asha-muted">{LANGUAGES[code].native}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final call */}
      <section className="bg-asha-orange py-20 text-asha-night lg:py-24">
        <div className={`${CONTAINER} flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between`}>
          <Reveal as="h2" className="max-w-2xl font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
            {s.ctaH}
          </Reveal>
          <Reveal delay={150} from="scale">
            <Link
              href="/app"
              prefetch={false}
              className="inline-flex h-14 shrink-0 items-center justify-center rounded-full bg-asha-night px-8 text-lg font-bold text-white transition-colors hover:bg-asha-night-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-night/40"
            >
              {s.navTry}
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="bg-asha-night py-10 text-sm text-white/65">
        <div className={`${CONTAINER} flex flex-col gap-2 sm:flex-row sm:justify-between`}>
          <p>{s.footer1}</p>
          <p>{s.footer2}</p>
        </div>
      </footer>
    </main>
  );
}
