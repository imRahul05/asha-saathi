'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { Orb } from './Orb';
import { LANGUAGES, LANGUAGE_ORDER, type LangCode } from '@/lib/languages';
import { HELLO } from '@/lib/i18n';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { ConnectingGreetings } from './ConnectingGreetings';
import { GoodToKnow } from './RecordGuide';
import { cn } from '@/lib/utils';

type StartScreenProps = {
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
  language: LangCode;
  onLanguageChange: (code: LangCode) => void;
};

// Pre-call screen: one big tap target. The whole screen is written in the language the person picked.
export function StartScreen({ isLoading, error, onStart, language, onLanguageChange }: StartScreenProps) {
  const { s, uiLang } = useLanguage();
  const router = useRouter();
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  }
  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col lg:max-w-2xl items-center justify-between bg-asha-cream px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <Link href="/" className="absolute left-4 top-4 rounded-full px-3 py-2 text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal">
        {s.about}
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="absolute right-4 top-4 rounded-full px-3 py-2 text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
      >
        {s.signOut}
      </button>
      <div className="flex flex-col items-center gap-3">
        <BrandMark className="h-14 w-14" />
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-5xl">ASHA Saathi</h1>
        <p className="max-w-[18rem] text-base text-asha-muted lg:max-w-lg lg:text-lg">{s.startTagline}</p>
      </div>

      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-semibold text-asha-muted">{s.callLanguage}</p>
        <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={s.callLanguage}>
          {LANGUAGE_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={language === c}
              disabled={isLoading}
              onClick={() => onLanguageChange(c)}
              className={cn(
                'h-10 rounded-full border px-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-60',
                language === c ? 'border-asha-teal bg-asha-teal text-white' : 'border-asha-line bg-white text-asha-ink hover:bg-asha-sand',
              )}
            >
              {LANGUAGES[c].native}
            </button>
          ))}
        </div>
        {(LANGUAGES[language].standIn || language === 'auto') && (
          <p className="mt-2 text-xs text-asha-muted">
            {language === 'auto' ? s.autoNote : s.betaNote}
          </p>
        )}
      </div>

      <Orb
        state={isLoading ? 'joining' : 'listening'}
        label={isLoading ? s.connecting : s.tapToStart}
        onClick={onStart}
        disabled={isLoading}
        ariaLabel={isLoading ? s.connecting : s.tapToStart}
      />
      {isLoading && <ConnectingGreetings words={language === 'auto' ? Object.values(HELLO) : [HELLO[uiLang]]} />}

      <div className="min-h-12 max-w-[20rem] text-sm text-asha-red" role={error ? 'alert' : undefined}>
        {error}
      </div>
      <GoodToKnow s={s} className="w-full max-w-sm" />
    </div>
  );
}
