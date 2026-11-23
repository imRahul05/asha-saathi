import { describe, expect, it } from 'vitest';
import { checkExtraction, mapDigits, normalizeText, quoteInTranscript } from './verify';
import { Extraction, type TranscriptSegment } from './types';

const seg = (text: string): TranscriptSegment[] => [{ text }];
const T = seg('सुनीता देवी के घर गई थी। सात महीने हैं। BP 150 by 100 आया। पैरों में सूजन है। खून बहना नहीं है। पिछली बार बुखार था।');
const ex = (o: object) => Extraction.parse(o);
const pres = { polarity: 'present' as const };

describe('text normalising', () => {
  it('writes Indian digits as 0-9 and ignores punctuation and case', () => {
    expect(mapDigits('१५०/१००')).toBe('150/100');
    expect(normalizeText('BP 150/100, आया!')).toBe('bp 150 100 आया');
  });
  it('finds a quote only as whole words', () => {
    const t = normalizeText('bp 1500 by 100');
    expect(quoteInTranscript(t, 'bp 150')).toBe(false);
    expect(quoteInTranscript(t, 'bp 1500 by 100')).toBe(true);
    expect(quoteInTranscript(t, 'by')).toBe(false); // too short to prove anything
  });
});

describe('checking what the model returned', () => {
  it('keeps a value whose quote is in the transcript and whose number matches', () => {
    const r = checkExtraction(ex({ bp: { sys: 150, dia: 100, quote: 'BP 150 by 100', ...pres } }), T);
    expect(r.facts.bpSys).toBe(150);
    expect(r.facts.bpDia).toBe(100);
    expect(r.fields[0]).toMatchObject({ key: 'bp', value: '150/100', status: 'ok' });
  });

  it('drops a value whose quote the model invented', () => {
    const r = checkExtraction(ex({ hb: { value: 7.5, quote: 'हीमोग्लोबिन 7.5 है', ...pres } }), T);
    expect(r.facts.hb).toBeUndefined();
    expect(r.dropped[0]).toMatchObject({ key: 'hb', reason: 'the quoted words are not in the transcript' });
  });

  it('drops a number that differs from the number in its own quote', () => {
    const r = checkExtraction(ex({ bp: { sys: 140, dia: 100, quote: 'BP 150 by 100', ...pres } }), T);
    expect(r.facts.bpSys).toBeUndefined();
    expect(r.dropped[0].reason).toContain('top number');
  });

  it('removes denied and past symptoms so they can never start an alert', () => {
    const r = checkExtraction(
      ex({
        symptoms: [
          { value: 'swelling_feet', quote: 'पैरों में सूजन है', ...pres },
          { value: 'bleeding', quote: 'खून बहना नहीं है', polarity: 'absent' },
          { value: 'fever', quote: 'पिछली बार बुखार था', polarity: 'historical' },
        ],
      }),
      T,
    );
    expect(r.facts.symptoms).toEqual(['swelling_feet']);
    expect(r.dropped.map((d) => d.key)).toEqual(['symptom:bleeding', 'symptom:fever']);
  });

  it('shows half a blood pressure as incomplete and never saves it', () => {
    const t = seg('BP 150 आया');
    const r = checkExtraction(ex({ bp: { sys: 150, dia: null, quote: 'BP 150', ...pres } }), t);
    expect(r.facts.bpSys).toBeUndefined();
    expect(r.fields[0]).toMatchObject({ key: 'bp', status: 'check' });
    expect(r.fields[0].note).toContain('Ask for both');
  });

  it('rejects a blood pressure with the numbers the wrong way round, and one outside what is possible', () => {
    expect(checkExtraction(ex({ bp: { sys: 100, dia: 150, quote: 'BP 150 by 100', ...pres } }), T).dropped.length).toBeGreaterThan(0);
    const wrongWay = checkExtraction(ex({ bp: { sys: 100, dia: 100, quote: 'BP 150 by 100', ...pres } }), T);
    expect(wrongWay.facts.bpSys).toBeUndefined();
  });

  it('flags a conversion (seven months to 28 weeks) instead of hiding it', () => {
    const r = checkExtraction(ex({ gestationWeeks: { value: 28, quote: 'सात महीने', conversion: '7 months is about 28 weeks', ...pres } }), T);
    expect(r.facts.gestationWeeks).toBe(28);
    expect(r.fields[0]).toMatchObject({ status: 'check' });
    expect(r.fields[0].note).toContain('converted');
  });

  it('flags a number spoken in words because code cannot check it', () => {
    const t = seg('weeks one twenty eight hai');
    const r = checkExtraction(ex({ gestationWeeks: { value: 28, quote: 'weeks one twenty eight', ...pres } }), t);
    expect(r.fields[0].status).toBe('check');
    expect(r.fields[0].note).toContain('words');
  });

  it('flags a value said by someone else or by an unknown speaker', () => {
    const r = checkExtraction(ex({ symptoms: [{ value: 'swelling_feet', quote: 'पैरों में सूजन है', speaker: 'other', ...pres }] }), T);
    expect(r.fields[0].status).toBe('check');
    expect(r.fields[0].note).toContain('someone other');
    const u = checkExtraction(ex({ symptoms: [{ value: 'swelling_feet', quote: 'पैरों में सूजन है', speaker: 'unsure', ...pres }] }), T);
    expect(u.fields[0].note).toContain('not sure who');
  });

  it('matches Indian-script digits against ASCII digits', () => {
    const t = seg('बीपी १५० बाय १०० आया');
    const r = checkExtraction(ex({ bp: { sys: 150, dia: 100, quote: 'बीपी १५० बाय १००', ...pres } }), t);
    expect(r.facts.bpSys).toBe(150);
  });

  it('keeps the mother name, lists each symptom once, and passes warnings through', () => {
    const r = checkExtraction(
      ex({
        mother: { name: ' Sunita Devi ', village: '' },
        symptoms: [
          { value: 'swelling_feet', quote: 'पैरों में सूजन है', ...pres },
          { value: 'swelling_feet', quote: 'पैरों में सूजन है', ...pres },
        ],
      }),
      T,
      ['1 of 12 audio segments could not be transcribed'],
    );
    expect(r.mother).toEqual({ name: 'Sunita Devi', village: null });
    expect(r.facts.symptoms).toEqual(['swelling_feet']);
    expect(r.warnings).toHaveLength(1);
  });

  it('returns an empty result for an empty extraction', () => {
    const r = checkExtraction(ex({}), T);
    expect(r.fields).toEqual([]);
    expect(r.facts.symptoms).toEqual([]);
  });
});
