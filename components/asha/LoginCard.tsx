'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mic, Stethoscope } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useLanguage } from '@/components/i18n/LanguageProvider';

const REASONS: Record<string, string> = {
  RATE_LIMITED: 'Too many sign-ins from this network. Please try again in a few minutes.',
  NOT_SEEDED: 'The demo is not set up yet. An admin needs to run the database seed.',
  DATABASE_NOT_CONFIGURED: 'The database is not connected yet, so the demo cannot start. Set DATABASE_URL (see README).',
  SETUP_PROBLEM: 'The server is not set up correctly. Run `pnpm setup:local` and `pnpm db:migrate`.',
};

type DemoRole = 'asha' | 'doctor';

interface DemoSignInErrorBody {
  error?: string;
  message?: string;
}

// One-click demo sign-in. The server creates a private demo ASHA or signs in as the PHC doctor and sets a signed cookie.
export function LoginCard({ expired = false }: { expired?: boolean }) {
  const router = useRouter();
  const { s } = useLanguage();
  const [busyRole, setBusyRole] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBusy = busyRole !== null;

  async function start(role: DemoRole) {
    setBusyRole(role);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const body = (await res.json().catch(() => ({}))) as DemoSignInErrorBody;
      if (!res.ok) {
        const reasonText = body.error ? REASONS[body.error] : undefined;
        setError(body.message ?? reasonText ?? 'Could not start the demo. Please try again.');
        setBusyRole(null);
        return;
      }
      router.push(role === 'doctor' ? '/dashboard' : '/app');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setBusyRole(null);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 bg-asha-cream px-6 py-10 text-center">
      <LanguageSwitcher tone="light" className="absolute right-4 top-4" />
      <BrandMark className="h-16 w-16" />
      <div className="space-y-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{s.loginTitle}</h1>
        <p className="text-lg leading-8 text-asha-muted">
          {s.loginIntro}
        </p>
      </div>

      <div className="w-full space-y-5">
        {expired && (
          <p role="status" className="rounded-2xl bg-asha-amber px-4 py-3 text-sm font-medium text-[#7A4E0A]">
            {s.loginExpired}
          </p>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => start('asha')}
            disabled={isBusy}
            className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-asha-orange px-8 text-lg font-bold text-asha-night transition-colors hover:bg-[#E8863C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50 disabled:opacity-70"
          >
            {busyRole === 'asha' ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Mic className="h-5 w-5" aria-hidden />
            )}
            {busyRole === 'asha' ? s.loginBusy : s.loginButton}
          </button>
          <p className="text-sm text-asha-muted">{s.loginMic}</p>
        </div>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-asha-line" />
          <span className="text-xs font-semibold uppercase tracking-wider text-asha-muted">or</span>
          <div className="h-px flex-1 bg-asha-line" />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => start('doctor')}
            disabled={isBusy}
            className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-asha-teal bg-white px-8 text-lg font-bold text-asha-teal transition-colors hover:bg-asha-mint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/40 disabled:opacity-70"
          >
            {busyRole === 'doctor' ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Stethoscope className="h-5 w-5" aria-hidden />
            )}
            {busyRole === 'doctor' ? 'Opening doctor dashboard…' : 'Continue as Doctor (PHC)'}
          </button>
          <p className="text-sm text-asha-muted">
            View high-risk alerts, patient history, and join calls with ASHAs.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-asha-red-soft px-4 py-3 text-sm font-medium text-asha-red">
            {error}
          </p>
        )}
      </div>

      <Link href="/" className="text-sm font-medium text-asha-muted underline underline-offset-4 hover:text-asha-ink">
        {s.about}
      </Link>
    </main>
  );
}
