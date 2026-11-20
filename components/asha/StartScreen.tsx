'use client';

import { HeartPulse } from 'lucide-react';
import { Orb } from './Orb';
import { UI_TEXT } from '@/lib/asha/lang';

type StartScreenProps = {
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
};

// Pre-call screen: one big tap target. Hindi first; the live screen follows the spoken language.
export function StartScreen({ isLoading, error, onStart }: StartScreenProps) {
  const t = UI_TEXT.hi;
  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col lg:max-w-2xl items-center justify-between bg-asha-cream px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-asha-teal text-white">
          <HeartPulse className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-5xl">ASHA Saathi</h1>
        <p className="max-w-[18rem] text-base text-asha-muted lg:max-w-lg lg:text-lg">
          बोलकर visit दर्ज करें। हिंदी, ಕನ್ನಡ या English, जिसमें आप सहज हों।
        </p>
      </div>

      <Orb
        state={isLoading ? 'joining' : 'listening'}
        label={isLoading ? 'जुड़ रही हूँ…' : t.tapToStart}
        onClick={onStart}
        disabled={isLoading}
        ariaLabel={isLoading ? 'Starting the call' : 'Start the call'}
      />

      <div className="min-h-12 max-w-[20rem] text-sm text-asha-red" role={error ? 'alert' : undefined}>
        {error}
      </div>
    </div>
  );
}
