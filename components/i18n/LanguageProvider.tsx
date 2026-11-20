'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_LANGUAGE, isLangCode, type LangCode } from '@/lib/languages';
import { STRINGS, isUiLang, type Strings, type UiLang } from '@/lib/i18n';

// One language choice for the whole site: the landing page text, the sign-in, the start screen and (unless it is Auto) the call language.
// It is remembered in this browser only. Auto keeps the last real interface language, because Auto has no text of its own.
const KEY = 'asha_language';
const UI_KEY = 'asha_ui_language';

type Ctx = {
  /** What the person picked, which may be "auto" */
  language: LangCode;
  /** The language the interface text is written in */
  uiLang: UiLang;
  s: Strings;
  setLanguage: (code: LangCode) => void;
};

const LanguageContext = createContext<Ctx | null>(null);

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private window or blocked storage: the choice just is not remembered
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // First visit: the marketing page opens in English; the app opens in Hindi, the language ASHA workers are most likely to want.
  const fallback: UiLang = pathname === '/' ? 'en' : (DEFAULT_LANGUAGE as UiLang);
  const [language, setLang] = useState<LangCode>(fallback);
  const [lastUi, setLastUi] = useState<UiLang>(fallback);

  useEffect(() => {
    const saved = read(KEY);
    const ui = read(UI_KEY);
    if (isLangCode(saved)) setLang(saved);
    if (isUiLang(ui)) setLastUi(ui);
    else if (isLangCode(saved) && saved !== 'auto') setLastUi(saved);
  }, []);

  const setLanguage = useCallback((code: LangCode) => {
    setLang(code);
    write(KEY, code);
    if (code !== 'auto') {
      setLastUi(code);
      write(UI_KEY, code);
    }
  }, []);

  const uiLang: UiLang = language === 'auto' ? lastUi : language;

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  const value = useMemo<Ctx>(() => ({ language, uiLang, s: STRINGS[uiLang], setLanguage }), [language, uiLang, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  const c = useContext(LanguageContext);
  if (!c) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return c;
}
