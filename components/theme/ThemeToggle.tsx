'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/i18n/LanguageProvider';

// Light / dark switch for the landing header. The first choice follows the phone's own setting;
// a tap stores an explicit choice (next-themes keeps it in localStorage).
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { s } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === 'dark';
  const label = dark ? s.themeLight : s.themeDark;
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        className,
      )}
    >
      {/* Both icons are rendered so the server HTML and first client paint match; CSS picks one. */}
      <Sun className={cn('h-[18px] w-[18px] transition-all duration-300', dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0')} aria-hidden />
      <Moon className={cn('absolute h-[18px] w-[18px] transition-all duration-300', dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100')} aria-hidden />
    </button>
  );
}
