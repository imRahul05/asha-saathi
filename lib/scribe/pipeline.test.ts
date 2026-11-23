import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db/client';
import { insertBeneficiary } from '@/lib/db/repo';
import { chunkIndexes, discardScribe, getScribe, putChunk, startScribe } from '@/lib/db/scribe-repo';
import { createTestDb } from '@/lib/db/test-db';
import type { Notifier } from '@/lib/notify';
import { confirmScribe, missingChunks, processScribe } from './pipeline';
import { Extraction, ScribeError, type Extractor, type SpeechToText, type Transcript } from './types';

let db: Db & { close: () => Promise<void> };
let ashaId: string;
let otherAshaId: string;
let sunitaId: string;

const notifier: Notifier = { name: 'test', async send() { return { providerId: 'x' }; } };
const b64 = (s: string) => Buffer.from(s).toString('base64');

const TRANSCRIPT: Transcript = {
  language: 'hi',
  durationSec: 42,
  warnings: [],
  segments: [{ text: 'सुनीता देवी के घर गई थी। सात महीने हैं। BP 150 by 100 आया। पैरों में सूजन है। खून बहना नहीं है।' }],
};
const EXTRACTION = Extraction.parse({
  mother: { name: 'Sunita Devi', village: 'Narsapura' },
  gestationWeeks: { value: 28, quote: 'सात महीने', conversion: '7 months is 28 weeks', polarity: 'present' },
  bp: { sys: 150, dia: 100, quote: 'BP 150 by 100', polarity: 'present' },
  symptoms: [
    { value: 'swelling_feet', quote: 'पैरों में सूजन है', polarity: 'present' },
    { value: 'bleeding', quote: 'खून बहना नहीं है', polarity: 'absent' },
  ],
});

let sttCalls = 0;
let sttSaw: { bytes: number; mime: string } | null = null;
const stt = (over: Partial<SpeechToText> = {}): SpeechToText => ({
  name: 'fake',
  async transcribe(audio) {
    sttCalls += 1;
    sttSaw = { bytes: audio.bytes.length, mime: audio.mime };
    return TRANSCRIPT;
  },
  ...over,
});
const extractor = (over: Partial<Extractor> = {}): Extractor => ({ name: 'fake', async extract() { return EXTRACTION; }, ...over });

async function upload(clientId: string, pieces = ['abc', 'def'], who = ashaId) {
  const s = await startScribe(db, { ashaId: who, clientId, language: 'hi', mime: 'audio/ogg' });
  for (const [i, p] of pieces.entries()) await putChunk(db, s.id, i, b64(p));
  return s;
}

beforeAll(async () => {
  db = await createTestDb();
  ashaId = (await db.query<{ id: string }>(`insert into ashas (name, phc_name, doctor_name, doctor_phone) values ('Meena','Kolar PHC','Dr Rao','+919999900001') returning id`))[0].id;
  otherAshaId = (await db.query<{ id: string }>(`insert into ashas (name, phc_name) values ('Other','Elsewhere') returning id`))[0].id;
  sunitaId = (await insertBeneficiary(db, { ashaId, name: 'Sunita Devi', village: 'Narsapura', age: 24, parity: 1 })).id;
});
afterAll(() => db.close());

describe('starting a recording', () => {
  it('the same client id gives back the same recording, so a retry never makes a second', async () => {
    const a = await startScribe(db, { ashaId, clientId: 'dup-1', language: 'hi', mime: 'audio/ogg' });
    const b = await startScribe(db, { ashaId, clientId: 'dup-1', language: 'hi', mime: 'audio/ogg' });
    expect(b.id).toBe(a.id);
  });
  it('a recording belongs to one ASHA only', async () => {
    const s = await startScribe(db, { ashaId, clientId: 'mine-1', language: 'hi', mime: 'audio/ogg' });
    expect(await getScribe(db, otherAshaId, s.id)).toBeNull();
  });
  it('sending the same piece twice keeps one copy', async () => {
    const s = await startScribe(db, { ashaId, clientId: 'twice-1', language: 'hi', mime: 'audio/ogg' });
    await putChunk(db, s.id, 0, b64('one'));
    await putChunk(db, s.id, 0, b64('one'));
    expect(await chunkIndexes(db, s.id)).toEqual([0]);
  });
});

describe('processing a recording', () => {
  it('finds missing pieces', () => {
    expect(missingChunks([0, 2], 4)).toEqual([1, 3]);
  });

  it('asks for the missing pieces instead of guessing', async () => {
    const s = await upload('gap-1', ['abc']);
    await expect(processScribe({ db, stt: stt(), extractor: extractor() }, ashaId, s.id, 3)).rejects.toMatchObject({ code: 'MISSING_CHUNKS' });
    expect((await getScribe(db, ashaId, s.id))?.status).toBe('recording');
  });

  it('joins the pieces, transcribes, extracts, checks, finds the mother and deletes the audio', async () => {
    sttCalls = 0;
    const s = await upload('ok-1');
    const r = await processScribe({ db, stt: stt(), extractor: extractor() }, ashaId, s.id, 2);
    expect(sttSaw).toEqual({ bytes: 6, mime: 'audio/ogg' }); // "abc" + "def"
    expect(r.status).toBe('ready');
    expect(r.durationSec).toBe(42);
    expect(r.checked?.facts).toMatchObject({ bpSys: 150, bpDia: 100, gestationWeeks: 28, symptoms: ['swelling_feet'] });
    expect(r.checked?.dropped.map((d) => d.key)).toEqual(['symptom:bleeding']);
    expect(r.candidates).toEqual([{ id: sunitaId, name: 'Sunita Devi', village: 'Narsapura' }]);
    expect(await chunkIndexes(db, s.id)).toEqual([]);
    // a second call changes nothing
    await processScribe({ db, stt: stt(), extractor: extractor() }, ashaId, s.id, 2);
    expect(sttCalls).toBe(1);
  });

  it('records a failure with its code, keeps the audio, and can be tried again', async () => {
    const s = await upload('fail-1');
    const down = stt({ async transcribe() { throw new ScribeError('STT_UNAVAILABLE', 'busy', true); } });
    await expect(processScribe({ db, stt: down, extractor: extractor() }, ashaId, s.id, 2)).rejects.toMatchObject({ code: 'STT_UNAVAILABLE' });
    const failed = await getScribe(db, ashaId, s.id);
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'STT_UNAVAILABLE' });
    expect(await chunkIndexes(db, s.id)).toEqual([0, 1]);
    const again = await processScribe({ db, stt: stt(), extractor: extractor() }, ashaId, s.id, 2);
    expect(again.status).toBe('ready');
  });

  it('fails clearly when there was no speech, and when the model fails', async () => {
    const quiet = await upload('quiet-1');
    const silent = stt({ async transcribe() { return { ...TRANSCRIPT, segments: [{ text: '   ' }] }; } });
    await expect(processScribe({ db, stt: silent, extractor: extractor() }, ashaId, quiet.id, 2)).rejects.toMatchObject({ code: 'NO_SPEECH' });
    const broken = await upload('llm-1');
    const bad = extractor({ async extract() { throw new ScribeError('LLM_FAILED', 'bad', true); } });
    await expect(processScribe({ db, stt: stt(), extractor: bad }, ashaId, broken.id, 2)).rejects.toMatchObject({ code: 'LLM_FAILED' });
  });

  it('passes on a warning that part of the audio was dropped', async () => {
    const s = await upload('warn-1');
    const partial = stt({ async transcribe() { return { ...TRANSCRIPT, warnings: ['1 of 12 audio segments could not be transcribed'] }; } });
    const r = await processScribe({ db, stt: partial, extractor: extractor() }, ashaId, s.id, 2);
    expect(r.checked?.warnings).toEqual(['1 of 12 audio segments could not be transcribed']);
  });

  it("another ASHA cannot process or read someone else's recording", async () => {
    const s = await upload('other-1');
    await expect(processScribe({ db, stt: stt(), extractor: extractor() }, otherAshaId, s.id, 2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('confirming', () => {
  async function ready(clientId: string) {
    const s = await upload(clientId);
    await processScribe({ db, stt: stt(), extractor: extractor() }, ashaId, s.id, 2);
    return s.id;
  }
  const values = () => ({ beneficiaryId: sunitaId, gestationWeeks: 28, bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] });

  it('saves the visit through the same rules as the voice call, and saves once', async () => {
    const id = await ready('conf-1');
    const r = await confirmScribe({ db, notifier }, ashaId, id, values());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.visit).toMatchObject({ beneficiary: { name: 'Sunita Devi' }, vitals: { bp: '150/100' }, risk: { level: 'high' } });
    expect(r.scribe.status).toBe('saved');
    expect(r.scribe.visitId).toBeTruthy();
    const again = await confirmScribe({ db, notifier }, ashaId, id, values());
    expect(again.ok && again.visit).toMatchObject({ alreadySaved: true });
    const visits = await db.query<{ n: number }>('select count(*)::int as n from visits where beneficiary_id = $1', [sunitaId]);
    expect(visits[0].n).toBe(1);
  });

  it('uses the values the ASHA edited, not the model', async () => {
    const id = await ready('conf-2');
    const r = await confirmScribe({ db, notifier }, ashaId, id, { ...values(), bpSys: 120, bpDia: 80, symptoms: [] });
    expect(r.ok && r.visit).toMatchObject({ vitals: { bp: '120/80' }, risk: { level: 'normal' } });
  });

  it('keeps the recording ready when the visit cannot be saved, so she can fix it and try again', async () => {
    const id = await ready('conf-3');
    const bad = await confirmScribe({ db, notifier }, ashaId, id, { beneficiaryId: sunitaId, symptoms: [] });
    expect(bad).toMatchObject({ ok: false, code: 'NOTHING_TO_RECORD' });
    expect((await getScribe(db, ashaId, id))?.status).toBe('ready');
    const nobp = await confirmScribe({ db, notifier }, ashaId, id, { beneficiaryId: sunitaId, bpSys: 150, symptoms: [] });
    expect(nobp.ok).toBe(false);
    expect((await confirmScribe({ db, notifier }, ashaId, id, values())).ok).toBe(true);
  });

  it('refuses a recording that is not ready, a discarded one, and another ASHA', async () => {
    const early = await upload('conf-4');
    await expect(confirmScribe({ db, notifier }, ashaId, early.id, values())).rejects.toMatchObject({ code: 'BAD_STATE' });
    const id = await ready('conf-5');
    await expect(confirmScribe({ db, notifier }, otherAshaId, id, values())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await discardScribe(db, ashaId, id)).toBe(true);
    const gone = await getScribe(db, ashaId, id);
    expect(gone).toMatchObject({ status: 'discarded', transcript: null, checked: null });
    await expect(confirmScribe({ db, notifier }, ashaId, id, values())).rejects.toMatchObject({ code: 'BAD_STATE' });
  });
});
