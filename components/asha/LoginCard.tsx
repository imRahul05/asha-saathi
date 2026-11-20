'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mic } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

const REASONS: Record<string, string> = {
  RATE_LIMITED: 'Too many sign-ins from this network. Please try again in a few minutes.',
  NOT_SEEDED: 'The demo is not set up yet. An admin needs to run the database seed.',
  DATABASE_NOT_CONFIGURED: 'The database is not connected yet, so the demo cannot start.',
};

// One-click demo sign-in. The server creates a private demo ASHA for this visitor and sets a signed cookie.
export function LoginCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.message ?? REASONS[body?.error] ?? 'Could not start the demo. Please try again.');
        setBusy(false);
        return;
      }
      router.push('/app');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 bg-asha-cream px-6 py-10 text-center">
      <BrandMark className="h-16 w-16" />
      <div className="space-y-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Try ASHA Saathi</h1>
        <p className="text-lg leading-8 text-asha-muted">
          One tap signs you in as a demo ASHA with six sample mothers. You get your own private copy, so nothing you do
          affects anyone else. Demo data is deleted after 24 hours.
        </p>
      </div>

      <div className="w-full space-y-3">
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-asha-orange px-8 text-lg font-bold text-asha-night transition-colors hover:bg-[#E8863C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50 disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
          {busy ? 'Setting up your demo…' : 'Continue as demo ASHA'}
        </button>
        <p className="text-sm text-asha-muted">Needs a microphone. Speak Hindi, Kannada or English.</p>
        {error && (
          <p role="alert" className="rounded-2xl bg-asha-red-soft px-4 py-3 text-sm font-medium text-asha-red">
            {error}
          </p>
        )}
      </div>

      <Link href="/" className="text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink">
        About ASHA Saathi
      </Link>
    </main>
  );
}
