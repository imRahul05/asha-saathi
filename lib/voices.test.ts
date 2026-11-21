import { describe, expect, it } from 'vitest';
import { LANGUAGE_ORDER } from '@/lib/languages';
import { VOICES, defaultVoice, resolveVoice } from './voices';

describe('voices', () => {
  it('offers at least one voice for every language, with unique ids', () => {
    for (const code of LANGUAGE_ORDER) {
      const list = VOICES[code];
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    }
  });

  it('uses native voices for the languages Pooja does not cover', () => {
    for (const code of ['gu', 'bn', 'mr', 'ml'] as const) {
      expect(defaultVoice(code).id).not.toBe('Pooja');
      expect(defaultVoice(code).id.startsWith(`${code}-IN-`)).toBe(true);
    }
  });

  it('accepts an offered voice and falls back for anything else', () => {
    expect(resolveVoice('hi', 'hi-IN-chirag').id).toBe('hi-IN-chirag');
    expect(resolveVoice('hi', 'ml-IN-nimisha').id).toBe('Pooja'); // a voice of another language is refused
    expect(resolveVoice('gu', undefined).id).toBe(defaultVoice('gu').id);
    expect(resolveVoice('en', '<script>').id).toBe('Pooja');
  });
});
