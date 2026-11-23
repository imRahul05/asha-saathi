import { ScribeError, type AudioInput, type SpeechToText, type Transcript, type TranscriptSegment } from './types';

// Murf speech to text, file mode (Beta): https://murf.ai/api/docs/speech-to-text/file-transcription
//  - Indian languages and Indian English go to the India host with the finch_indic_1.0 model.
//  - Accepted audio: WAV, FLAC and OGG. WebM, M4A, AAC and MP4 are refused with 400 "Unable to decode audio file".
//  - No speaker labels. The answer is the text plus a time for every word.
//  - A synchronous call waits for the result. Past 20 seconds the server sends spaces as keepalive before the JSON, so the body is trimmed.
//  - Parts of the audio can be dropped (a "partial_audio_dropped" warning). That is passed on, never hidden.

const INDIC_HOST = 'https://in.api.murf.ai';
const SEGMENT_GAP_MS = 1500; // a pause this long starts a new segment

/** Our language codes to Murf's. English in this app is Indian English. */
const LANGUAGE_CODE: Record<string, string> = { hi: 'hi', kn: 'kn', ta: 'ta', te: 'te', gu: 'gu', bn: 'bn', mr: 'mr', ml: 'ml', en: 'en_IN' };

type MurfWord = { text: string; start: number; end: number; type?: string };
type MurfResponse = {
  language_code?: string;
  text?: string;
  words?: MurfWord[];
  audio_duration_secs?: number;
  warnings?: Array<{ code?: string; message?: string }>;
  detail?: unknown;
};

export function segmentsFromWords(words: MurfWord[]): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  let text = '';
  let start: number | undefined;
  let end: number | undefined;
  let lastEnd = 0;
  const close = () => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t) out.push({ text: t, startMs: start, endMs: end });
    text = '';
    start = undefined;
    end = undefined;
  };
  for (const w of words) {
    const isWord = w.type !== 'spacing';
    if (isWord && text && w.start - lastEnd > SEGMENT_GAP_MS / 1000) close();
    text += w.text;
    if (isWord) {
      if (start === undefined) start = Math.round(w.start * 1000);
      end = Math.round(w.end * 1000);
      lastEnd = w.end;
    }
  }
  close();
  return out;
}

export function createMurfStt(opts: { apiKey?: string; baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): SpeechToText {
  return {
    name: 'murf-finch-indic',
    async transcribe(audio: AudioInput, { language }: { language?: string }): Promise<Transcript> {
      const apiKey = opts.apiKey ?? process.env.MURF_API_KEY;
      if (!apiKey) throw new ScribeError('STT_UNAVAILABLE', 'MURF_API_KEY is not set');
      const doFetch = opts.fetchImpl ?? fetch;
      const base = (opts.baseUrl ?? process.env.MURF_STT_URL ?? INDIC_HOST).replace(/\/$/, '');

      const form = new FormData();
      form.append('file', new Blob([audio.bytes as BlobPart], { type: audio.mime }), `visit.${extensionFor(audio.mime)}`);
      form.append('model', 'finch_indic_1.0');
      const code = language ? LANGUAGE_CODE[language] : undefined;
      if (code) form.append('language_code', code); // left out means "detect the language"
      form.append('timestamps_granularity', 'word');

      let res: Response;
      try {
        res = await doFetch(`${base}/v1/transcription/speech-to-text`, {
          method: 'POST',
          headers: { 'api-key': apiKey },
          body: form,
          signal: AbortSignal.timeout(opts.timeoutMs ?? 280_000),
        });
      } catch (e) {
        throw new ScribeError('STT_UNAVAILABLE', `Could not reach Murf: ${e instanceof Error ? e.message : String(e)}`, true);
      }

      const raw = (await res.text()).trim(); // keepalive spaces come before the JSON
      let body: MurfResponse = {};
      try {
        body = raw ? (JSON.parse(raw) as MurfResponse) : {};
      } catch {
        if (res.ok) throw new ScribeError('STT_FAILED', 'Murf sent an answer that is not JSON', true);
      }

      const detail = body.detail;
      const detailCode = detail && typeof detail === 'object' ? (detail as { code?: string }).code : undefined;
      const detailText = typeof detail === 'string' ? detail : detail && typeof detail === 'object' ? String((detail as { message?: string }).message ?? '') : '';

      if (!res.ok || detail) {
        if (res.status === 400 && /decode/i.test(detailText || raw)) {
          throw new ScribeError('UNSUPPORTED_AUDIO', `Murf cannot read ${audio.mime}. It accepts WAV, FLAC and OGG.`);
        }
        if (detailCode === 'transcription_failed') throw new ScribeError('NO_SPEECH', 'None of the speech could be transcribed');
        if (res.status === 401 || res.status === 403) throw new ScribeError('STT_FAILED', 'Murf refused the API key');
        if (res.status === 429 || res.status >= 500 || /timed out/i.test(detailText) || detailCode === 'processing_timeout' || detailCode === 'internal_error') {
          throw new ScribeError('STT_UNAVAILABLE', `Murf is busy or failed (${res.status}) ${detailText}`.trim(), true);
        }
        throw new ScribeError('STT_FAILED', `Murf answered ${res.status} ${detailText}`.trim());
      }

      const segments = body.words?.length ? segmentsFromWords(body.words) : body.text?.trim() ? [{ text: body.text.trim() }] : [];
      return {
        language: body.language_code ?? null,
        segments,
        durationSec: body.audio_duration_secs != null ? Math.round(body.audio_duration_secs) : null,
        warnings: (body.warnings ?? []).map((w) => w.message ?? w.code ?? 'a warning from the speech service'),
      };
    },
  };
}

function extensionFor(mime: string): string {
  if (/wav|wave/.test(mime)) return 'wav';
  if (/flac/.test(mime)) return 'flac';
  if (/ogg|opus/.test(mime)) return 'ogg';
  if (/webm/.test(mime)) return 'webm';
  if (/mp4|m4a|aac/.test(mime)) return 'm4a';
  return 'bin';
}
