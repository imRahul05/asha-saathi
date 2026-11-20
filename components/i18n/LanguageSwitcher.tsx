'use client';

import { Languages } from 'lucide-react';
import { LANGUAGES } from '@/lib/languages';
import { UI_LANGS, isUiLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useLanguage } from './LanguageProvider';

// Pick the language of the whole interface. A native <select>: it works with a keyboard, a screen reader and every phone's own picker.
export function LanguageSwitcher({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const { uiLang, setLanguage, s } = useLanguage();
  return (
    <label
      className={cn(
        'relative inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold focus-within:ring-2',
        tone === 'dark' ? 'border-white/25 text-white focus-within:ring-white' : 'border-asha-line bg-white text-asha-ink focus-within:ring-asha-teal',
        className,
      )}
    >
      <Languages className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">{s.language}</span>
      <select
        value={uiLang}
        onChange={(e) => {
          if (isUiLang(e.target.value)) setLanguage(e.target.value);
        }}
        className="max-w-[9rem] cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        {UI_LANGS.map((code) => (
          <option key={code} value={code} className="text-asha-ink">
            {LANGUAGES[code].native}
          </option>
        ))}
      </select>
    </label>
  );
}
