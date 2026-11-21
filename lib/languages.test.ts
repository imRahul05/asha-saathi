import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HELLO } from '@/lib/i18n';
import { LANGUAGES, LANGUAGE_ORDER } from './languages';
import { buildSystemPrompt } from './prompt';
import { VOICES } from './voices';

describe('greeting is built from one place', () => {
  it('every greeting is hello + address word + question', () => {
    for (const code of LANGUAGE_ORDER) {
      const l = LANGUAGES[code];
      expect(l.greeting).toBe(`${l.hello} ${l.address}! ${l.ask}`);
      expect(l.helloLabel).toBe(`${l.hello} ${l.address}`);
      expect(l.address.length).toBeGreaterThan(0);
    }
  });

  it('English addresses her as sister, never didi', () => {
    expect(LANGUAGES.en.address).toBe('sister');
    expect(LANGUAGES.en.greeting).not.toMatch(/didi/i);
    expect(buildSystemPrompt({ language: 'en' })).toContain('"sister"');
  });

  it('on-screen hello labels match the spoken greeting', () => {
    for (const [code, label] of Object.entries(HELLO)) {
      expect(LANGUAGES[code as keyof typeof LANGUAGES].greeting.startsWith(label)).toBe(true);
    }
  });

  it('the prompt of every language names that language\'s own address word', () => {
    for (const code of LANGUAGE_ORDER) {
      if (code === 'auto') continue;
      expect(buildSystemPrompt({ language: code })).toContain(`"${LANGUAGES[code].address}"`);
    }
  });

  it('a voice sample exists for every language and voice (run pnpm voice:samples after changing voices or greetings)', () => {
    for (const code of LANGUAGE_ORDER) {
      if (code === 'auto') continue;
      for (const v of VOICES[code]) expect(existsSync(`public/voice-samples/${code}-${v.id}.mp3`), `${code}/${v.id}`).toBe(true);
    }
  });
});
