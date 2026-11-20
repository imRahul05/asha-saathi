'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
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
  const router = useRouter();
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  }
  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col lg:max-w-2xl items-center justify-between bg-asha-cream px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-center">
      <Link href="/" className="absolute left-4 top-4 rounded-full px-3 py-2 text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal">
        About ASHA Saathi
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="absolute right-4 top-4 rounded-full px-3 py-2 text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
      >
        Sign out
      </button>
      <div className="flex flex-col items-center gap-3">
        <BrandMark className="h-14 w-14" />
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
