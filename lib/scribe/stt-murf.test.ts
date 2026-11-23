import { describe, expect, it, vi } from 'vitest';
import { createMurfStt, segmentsFromWords } from './stt-murf';
import { ScribeError } from './types';

const audio = { bytes: new Uint8Array([1, 2, 3]), mime: 'audio/ogg' };
const reply = (status: number, body: unknown, pad = '') => vi.fn(async () => new Response(pad + (typeof body === 'string' ? body : JSON.stringify(body)), { status }));
const stt = (f: ReturnType<typeof reply>) => createMurfStt({ apiKey: 'k', fetchImpl: f as unknown as typeof fetch });
const words = (list: Array<[string, number, number]>) => list.flatMap(([t, s, e], i) => [{ text: t, start: s, end: e, type: 'word' }, ...(i < list.length - 1 ? [{ text: ' ', start: e, end: e, type: 'spacing' }] : [])]);

describe('Murf speech to text', () => {
  it('turns the words into segments, starting a new one after a long pause', () => {
    const seg = segmentsFromWords(words([['नमस्ते', 0.1, 0.5], ['दीदी', 0.6, 1.0], ['BP', 4.0, 4.3], ['150', 4.4, 4.8]]));
    expect(seg).toEqual([
      { text: 'नमस्ते दीदी', startMs: 100, endMs: 1000 },
      { text: 'BP 150', startMs: 4000, endMs: 4800 },
    ]);
  });

  it('sends the file with the key, the Indic model and the language, and returns the transcript', async () => {
    const f = reply(200, { language_code: 'hi', text: 'नमस्ते', words: words([['नमस्ते', 0, 0.5]]), audio_duration_secs: 5.4 });
    const t = await stt(f).transcribe(audio, { language: 'hi' });
    expect(t).toMatchObject({ language: 'hi', durationSec: 5, segments: [{ text: 'नमस्ते' }], warnings: [] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://in.api.murf.ai/v1/transcription/speech-to-text');
    expect((init.headers as Record<string, string>)['api-key']).toBe('k');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('finch_indic_1.0');
    expect(form.get('language_code')).toBe('hi');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it('asks Murf to detect the language when none is given, and uses Indian English for en', async () => {
    const f = reply(200, { text: 'hello' });
    await stt(f).transcribe(audio, {});
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData).toSatisfy((b: FormData) => b.get('language_code') === null);
    const g = reply(200, { text: 'hello' });
    await stt(g).transcribe(audio, { language: 'en' });
    expect(((g.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData).get('language_code')).toBe('en_IN');
  });

  it('reads an answer that starts with keepalive spaces', async () => {
    const t = await stt(reply(200, { text: 'hello', words: [] }, '          ')).transcribe(audio, {});
    expect(t.segments).toEqual([{ text: 'hello' }]);
  });

  it('passes on a "part of the audio was dropped" warning instead of hiding it', async () => {
    const t = await stt(reply(200, { text: 'hi', warnings: [{ code: 'partial_audio_dropped', message: '1 of 12 audio segments could not be transcribed' }] })).transcribe(audio, {});
    expect(t.warnings).toEqual(['1 of 12 audio segments could not be transcribed']);
  });

  it('answers with a clear code for each failure', async () => {
    const code = async (status: number, body: unknown) => {
      try {
        await stt(reply(status, body)).transcribe(audio, {});
        return 'no error';
      } catch (e) {
        return e instanceof ScribeError ? `${e.code}${e.retryable ? ' (retry)' : ''}` : String(e);
      }
    };
    expect(await code(400, { detail: 'Unable to decode audio file' })).toBe('UNSUPPORTED_AUDIO');
    expect(await code(200, { detail: { code: 'transcription_failed', message: 'None of the speech in the file could be transcribed' } })).toBe('NO_SPEECH');
    expect(await code(429, { detail: 'offline transcription capacity reached' })).toBe('STT_UNAVAILABLE (retry)');
    expect(await code(500, 'oops')).toBe('STT_UNAVAILABLE (retry)');
    expect(await code(401, { detail: 'bad key' })).toBe('STT_FAILED');
  });

  it('says so plainly when there is no key or Murf cannot be reached', async () => {
    await expect(createMurfStt({ apiKey: '', fetchImpl: vi.fn() as unknown as typeof fetch }).transcribe(audio, {})).rejects.toMatchObject({ code: 'STT_UNAVAILABLE' });
    const down = vi.fn(async () => { throw new Error('network down'); });
    await expect(createMurfStt({ apiKey: 'k', fetchImpl: down as unknown as typeof fetch }).transcribe(audio, {})).rejects.toMatchObject({ code: 'STT_UNAVAILABLE', retryable: true });
  });
});
