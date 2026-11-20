import type { LangCode } from '@/lib/languages';
import { en, type Strings } from './en';
import { hi } from './hi';
import { kn } from './kn';
import { ta } from './ta';
import { te } from './te';
import { gu } from './gu';
import { bn } from './bn';
import { mr } from './mr';
import { ml } from './ml';

export type { Strings };
/** Languages the interface itself is written in (Auto-detect has no text of its own). */
export type UiLang = Exclude<LangCode, 'auto'>;

export const STRINGS: Record<UiLang, Strings> = { hi, en, kn, ta, te, gu, bn, mr, ml };
export const UI_LANGS = Object.keys(STRINGS) as UiLang[];

export function isUiLang(v: unknown): v is UiLang {
  return typeof v === 'string' && v in STRINGS;
}

/** The text set for a language code; Auto and anything unknown use the fallback. */
export function stringsFor(code: string | null | undefined, fallback: UiLang = 'en'): Strings {
  return STRINGS[isUiLang(code) ? code : fallback];
}

/** A short hello in each language, for the language grid and the connecting animation. */
export const HELLO: Record<UiLang, string> = {
  hi: 'नमस्ते दीदी',
  en: 'Hello didi',
  kn: 'ನಮಸ್ಕಾರ ಅಕ್ಕ',
  ta: 'வணக்கம் அக்கா',
  te: 'నమస్కారం అక్కా',
  gu: 'નમસ્તે બહેન',
  bn: 'নমস্কার দিদি',
  mr: 'नमस्कार ताई',
  ml: 'നമസ്കാരം ചേച്ചി',
};

// Script ranges. Devanagari is shared by Hindi and Marathi: text alone cannot tell them apart, so it maps to Hindi.
const SCRIPTS: Array<[UiLang, RegExp]> = [
  ['hi', /[ऀ-ॿ]/g],
  ['bn', /[ঀ-৿]/g],
  ['gu', /[઀-૿]/g],
  ['ta', /[஀-௿]/g],
  ['te', /[ఀ-౿]/g],
  ['kn', /[ಀ-೿]/g],
  ['ml', /[ഀ-ൿ]/g],
];
const LATIN = /[A-Za-z]/g;

/** Which language a spoken or typed message is in, judged by script. Null when there is not enough signal. */
export function detectUiLang(text?: string | null): UiLang | null {
  if (!text) return null;
  let best: UiLang | null = null;
  let bestN = 0;
  for (const [lang, re] of SCRIPTS) {
    const n = text.match(re)?.length ?? 0;
    if (n > bestN) { best = lang; bestN = n; }
  }
  const latin = text.match(LATIN)?.length ?? 0;
  if (best && bestN >= latin / 3) return best;
  return latin >= 4 ? 'en' : null;
}
