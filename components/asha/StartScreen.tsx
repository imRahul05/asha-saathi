'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { SaathiAvatar } from './SaathiAvatar';
import { LANGUAGES, LANGUAGE_ORDER, type LangCode } from '@/lib/languages';
import { HELLO } from '@/lib/i18n';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { ConnectingGreetings } from './ConnectingGreetings';
import { GoodToKnow } from './RecordGuide';
import { VoicePicker } from './VoicePicker';
import { VOICES, resolveVoice } from '@/lib/voices';
import { cn } from '@/lib/utils';

type StepNumber = 1 | 2 | 3;
type SlideDirection = 'none' | 'forward' | 'backward';

interface StartScreenProps {
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
  language: LangCode;
  onLanguageChange: (code: LangCode) => void;
  voice: string;
  onVoiceChange: (id: string) => void;
  /** id of the voice whose sample is playing right now, if any */
  playingVoice?: string | null;
}

interface StepDescriptor {
  number: StepNumber;
  label: string;
}

// Pre-call screen: guided 3-step setup (Language → Voice → Start talking).
export function StartScreen({
  isLoading,
  error,
  onStart,
  language,
  onLanguageChange,
  voice,
  onVoiceChange,
  playingVoice,
}: StartScreenProps) {
  const { s, uiLang } = useLanguage();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [direction, setDirection] = useState<SlideDirection>('none');
  const [justTickedStep, setJustTickedStep] = useState<StepNumber | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const activeStep: StepNumber = isLoading ? 3 : currentStep;

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (direction === 'none') return;
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [activeStep, direction]);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function goToStep(target: StepNumber) {
    if (isLoading) return;
    clearAdvanceTimer();
    setJustTickedStep(null);
    if (target === currentStep) return;
    setDirection(target > currentStep ? 'forward' : 'backward');
    setCurrentStep(target);
  }

  function handleLanguageSelect(code: LangCode) {
    if (isLoading) return;
    onLanguageChange(code);
    clearAdvanceTimer();
    setJustTickedStep(1);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      setJustTickedStep(null);
      setDirection('forward');
      setCurrentStep(2);
    }, 380);
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  }

  const steps: StepDescriptor[] = [
    { number: 1, label: s.callLanguage },
    { number: 2, label: s.voiceLabel },
    { number: 3, label: s.startButton },
  ];

  const selectedVoiceName = resolveVoice(language, voice).name;

  const slideClass =
    direction === 'forward'
      ? 'step-slide-forward'
      : direction === 'backward'
        ? 'step-slide-backward'
        : undefined;

  return (
    <div className="h-full w-full overflow-y-auto bg-asha-cream">
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-between gap-5 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] text-center lg:max-w-2xl">
        <Link
          href="/"
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full px-3 py-2 text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
        >
          {s.about}
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full px-3 py-2 text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
        >
          {s.signOut}
        </button>

        <div className="flex flex-col items-center gap-2.5">
          <BrandMark className="h-12 w-12" />
          <h1 className="text-3xl font-extrabold tracking-tight lg:text-5xl">ASHA Saathi</h1>
          <p className="max-w-[18rem] text-base text-asha-muted lg:max-w-lg lg:text-lg">{s.startTagline}</p>
        </div>

        <nav aria-label={s.stepOf(activeStep, 3)} className="w-full max-w-sm">
          <ol className="flex items-start justify-between">
            {steps.map((step, index) => {
              const isCompleted = step.number < activeStep || step.number === justTickedStep;
              const isActive = step.number === activeStep && step.number !== justTickedStep;
              const canJumpBack = step.number < activeStep && !isLoading;
              const isBarFilled = step.number < activeStep || step.number === justTickedStep;

              return (
                <Fragment key={step.number}>
                  <li className="flex w-20 flex-col items-center">
                    <button
                      type="button"
                      disabled={!canJumpBack}
                      onClick={() => goToStep(step.number)}
                      aria-current={isActive ? 'step' : undefined}
                      className={cn(
                        'group flex w-full flex-col items-center gap-1.5 rounded-xl py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal focus-visible:ring-offset-2',
                        canJumpBack ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 motion-reduce:transition-none',
                          isCompleted && 'bg-asha-teal text-white',
                          canJumpBack && 'group-hover:bg-asha-teal-dark',
                          isActive && 'bg-asha-teal text-white ring-4 ring-asha-teal/20',
                          !isCompleted && !isActive && 'border-2 border-asha-line bg-white text-asha-muted',
                        )}
                      >
                        {isCompleted ? (
                          <Check className="step-tick h-4 w-4 stroke-[3]" aria-hidden />
                        ) : (
                          step.number
                        )}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-semibold leading-tight',
                          isActive || isCompleted ? 'text-asha-ink' : 'text-asha-muted',
                        )}
                      >
                        {step.label}
                      </span>
                    </button>
                  </li>
                  {index < steps.length - 1 && (
                    <li aria-hidden className="mt-4 h-1 flex-1 overflow-hidden rounded-full bg-asha-line">
                      <div
                        className={cn(
                          'h-full w-full origin-left bg-asha-teal transition-transform duration-300 ease-out motion-reduce:transition-none',
                          isBarFilled ? 'scale-x-100' : 'scale-x-0',
                        )}
                      />
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
        </nav>

        <div className="flex w-full max-w-sm flex-col items-center">
          <div className="w-full overflow-x-clip py-1">
            <div key={activeStep} className={slideClass}>
              {activeStep === 1 && (
                <div className="flex flex-col items-center">
                  <h2
                    ref={stepHeadingRef}
                    tabIndex={-1}
                    className="mb-3 text-lg font-extrabold leading-6 text-asha-ink focus:outline-none"
                  >
                    {s.stepLanguage}
                  </h2>
                  <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={s.callLanguage}>
                    {LANGUAGE_ORDER.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={language === c}
                        disabled={isLoading}
                        onClick={() => handleLanguageSelect(c)}
                        className={cn(
                          'h-10 rounded-full border px-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-60',
                          language === c
                            ? 'border-asha-teal bg-asha-teal text-white'
                            : 'border-asha-line bg-white text-asha-ink hover:bg-asha-sand',
                        )}
                      >
                        {LANGUAGES[c].native}
                      </button>
                    ))}
                  </div>
                  {(LANGUAGES[language].standIn || language === 'auto') && (
                    <p className="mt-2.5 text-xs text-asha-muted">
                      {language === 'auto' ? s.autoNote : s.betaNote}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => goToStep(2)}
                    className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-asha-teal px-6 text-base font-semibold text-white transition-colors hover:bg-asha-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal focus-visible:ring-offset-2 disabled:opacity-60"
                  >
                    {s.stepNext}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}

              {activeStep === 2 && (
                <div className="flex flex-col items-center">
                  <h2
                    ref={stepHeadingRef}
                    tabIndex={-1}
                    className="mb-3 text-lg font-extrabold leading-6 text-asha-ink focus:outline-none"
                  >
                    {s.stepVoice}
                  </h2>
                  <div className="w-full">
                    <VoicePicker
                      voices={VOICES[language]}
                      value={voice}
                      onChange={onVoiceChange}
                      disabled={isLoading}
                      s={s}
                      playingId={playingVoice}
                    />
                  </div>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => goToStep(1)}
                      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-asha-line bg-white px-5 text-base font-semibold text-asha-ink transition-colors hover:bg-asha-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-60"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      {s.stepBack}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => goToStep(3)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-asha-teal px-6 text-base font-semibold text-white transition-colors hover:bg-asha-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {s.stepNext}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="flex flex-col items-center">
                  <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => goToStep(1)}
                      aria-label={`${s.callLanguage}: ${LANGUAGES[language].native}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-asha-line bg-white px-3.5 py-1.5 text-sm font-semibold text-asha-ink transition-colors hover:bg-asha-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5] text-asha-teal" aria-hidden />
                      {LANGUAGES[language].native}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => goToStep(2)}
                      aria-label={`${s.voiceLabel}: ${selectedVoiceName}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-asha-line bg-white px-3.5 py-1.5 text-sm font-semibold text-asha-ink transition-colors hover:bg-asha-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5] text-asha-teal" aria-hidden />
                      {selectedVoiceName}
                    </button>
                  </div>

                  <h2
                    ref={stepHeadingRef}
                    tabIndex={-1}
                    className="mb-4 text-lg font-extrabold leading-6 text-asha-ink focus:outline-none"
                  >
                    {s.stepStart}
                  </h2>
                  <SaathiAvatar
                    state={isLoading ? 'connecting' : playingVoice ? 'talking' : 'idle'}
                    label={isLoading ? s.connecting : s.startButton}
                    onClick={onStart}
                    disabled={isLoading}
                  />

                  {isLoading && (
                    <div className="mt-4">
                      <ConnectingGreetings words={language === 'auto' ? Object.values(HELLO) : [HELLO[uiLang]]} />
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => goToStep(2)}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-asha-muted transition-colors hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    {s.stepBack}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 min-h-6 max-w-[20rem] text-sm text-asha-red" role={error ? 'alert' : undefined}>
            {error}
          </div>
        </div>

        <GoodToKnow s={s} className="w-full max-w-sm" />
      </div>
    </div>
  );
}
