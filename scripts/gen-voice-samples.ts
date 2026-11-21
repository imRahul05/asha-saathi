// Creates one short spoken sample per (language, voice) in public/voice-samples/, played when someone picks a voice on the start screen.
//   pnpm voice:samples            (needs MURF_API_KEY; skips files that already exist; --force to redo)
// Samples are made once and served as static files, so previewing costs no Murf characters and works instantly.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { LANGUAGES, LANGUAGE_ORDER } from '../lib/languages';
import { VOICES } from '../lib/voices';

const OUT = 'public/voice-samples';
const force = process.argv.includes('--force');

(async () => {
  const key = process.env.MURF_API_KEY;
  if (!key) { console.error('MURF_API_KEY is not set'); process.exit(1); }
  mkdirSync(OUT, { recursive: true });
  let made = 0, skipped = 0, failed = 0;
  for (const code of LANGUAGE_ORDER) {
    if (code === 'auto') continue; // Auto uses the Hindi list and the Hindi samples
    const lang = LANGUAGES[code];
    // Just the opening hello of the real greeting, e.g. "வணக்கம் அக்கா!"
    const text = lang.greeting.split(/(?<=[!।.?])\s/)[0] ?? lang.greeting;
    for (const voice of VOICES[code]) {
      const file = `${OUT}/${code}-${voice.id}.mp3`;
      if (!force && existsSync(file)) { skipped++; continue; }
      const res = await fetch('https://global.api.murf.ai/v1/speech/stream', {
        method: 'POST',
        headers: { 'api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: voice.id, model: 'falcon-2.1', locale: lang.murf, format: 'MP3', sampleRate: 24000 }),
      });
      if (!res.ok) { console.log(`FAIL ${code}/${voice.id}: HTTP ${res.status} ${(await res.text()).slice(0, 80)}`); failed++; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, buf);
      console.log(`ok   ${code}/${voice.id}: "${text}" ${buf.length} bytes`);
      made++;
    }
  }
  console.log(`done: ${made} made, ${skipped} already there, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
