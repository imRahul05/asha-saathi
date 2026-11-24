/**
 * Client-side cookie preference helpers (replaces localStorage).
 * Non-sensitive UI preferences (setup completion, language, voice) are stored in
 * SameSite=Lax cookies so Next.js Server Components can read them during SSR
 * without hydration flashes.
 */

export const SETUP_DONE_COOKIE = 'asha_setup_done';
export const LANGUAGE_COOKIE = 'asha_language';
export const UI_LANGUAGE_COOKIE = 'asha_ui_language';
export const VOICE_COOKIE_PREFIX = 'asha_voice_';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function readPrefCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const prefix = `${name}=`;
    const parts = document.cookie.split(';');
    for (const raw of parts) {
      const part = raw.trim();
      if (part.startsWith(prefix)) {
        return decodeURIComponent(part.slice(prefix.length));
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function writePrefCookie(name: string, value: string, maxAgeSeconds: number = ONE_YEAR_SECONDS): void {
  if (typeof document === 'undefined') return;
  try {
    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      parts.push('Secure');
    }
    document.cookie = parts.join('; ');
  } catch {
    /* ignore blocked cookie writes */
  }
}

export function voiceCookieName(langCode: string): string {
  return `${VOICE_COOKIE_PREFIX}${langCode}`;
}
