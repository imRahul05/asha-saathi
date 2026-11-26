'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useLanguage } from '@/components/i18n/LanguageProvider';

// Sticky top bar. A 1px sentinel tells us when the page has scrolled, so there is no scroll listener.
export function StickyHeader() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const { s } = useLanguage();

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} className="pointer-events-none absolute left-0 top-0 h-px w-px" aria-hidden />
      <header
        className={cn(
          'sticky top-0 z-40 bg-asha-night text-white transition-shadow duration-300',
          stuck ? 'shadow-[0_10px_30px_rgba(0,0,0,0.28)]' : 'shadow-none',
        )}
      >
        <nav className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5 transition-[height] duration-300 sm:px-8" aria-label="Main">
          <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight">
            <BrandMark />
            {/* Name hidden on narrow phones so the language, theme and Try buttons fit on one row */}
            <span className="sr-only min-[440px]:not-sr-only">ASHA Saathi</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              href="/app"
              prefetch={false}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-5',
                stuck ? 'bg-asha-orange text-asha-night hover:bg-[#E8863C]' : 'border border-white/25 hover:bg-white/10',
              )}
            >
              {s.navTry}
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
