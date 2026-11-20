import { describe, expect, it } from 'vitest';
import { assessAnc } from './anc.v1';
import { VisitFacts } from '@/lib/schemas';

const visit = (v: Partial<VisitFacts>): VisitFacts => ({ symptoms: [], ...v }) as VisitFacts;

describe('assessAnc (rules anc.v1)', () => {
  const cases: Array<[string, Partial<VisitFacts>, { age?: number; parity?: number }, string, string[]]> = [
    ['normal BP, nothing else', { bpSys: 118, bpDia: 76 }, {}, 'normal', []],
    ['BP exactly 140/90 is high', { bpSys: 140, bpDia: 90 }, {}, 'high', ['BP_HIGH']],
    ['only systolic raised', { bpSys: 150, bpDia: 80 }, {}, 'high', ['BP_HIGH']],
    ['only diastolic raised', { bpSys: 120, bpDia: 92 }, {}, 'high', ['BP_HIGH']],
    ['just below 140/90 is normal', { bpSys: 139, bpDia: 89 }, {}, 'normal', []],
    ['the demo case: 150/100 with swelling in feet', { bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] }, {}, 'high', ['BP_HIGH']],
    ['severe range BP is urgent', { bpSys: 165, bpDia: 100 }, {}, 'urgent', ['BP_SEVERE']],
    ['severe diastolic is urgent', { bpSys: 150, bpDia: 112 }, {}, 'urgent', ['BP_SEVERE']],
    ['Hb below 7 is high', { hb: 6.5 }, {}, 'high', ['HB_SEVERE']],
    ['Hb 7 is not severe, but is anaemia (watch)', { hb: 7 }, {}, 'watch', ['HB_LOW']],
    ['Hb 10.9 is watch', { hb: 10.9 }, {}, 'watch', ['HB_LOW']],
    ['Hb 11 is normal', { hb: 11 }, {}, 'normal', []],
    ['bleeding is urgent', { symptoms: ['bleeding'] }, {}, 'urgent', ['BLEEDING']],
    ['convulsions are urgent', { symptoms: ['convulsions'] }, {}, 'urgent', ['CONVULSIONS']],
    ['severe headache + blurred vision are high', { symptoms: ['severe_headache', 'blurred_vision'] }, {}, 'high', ['SEVERE_HEADACHE', 'BLURRED_VISION']],
    ['reduced movement is high', { symptoms: ['reduced_fetal_movement'] }, {}, 'high', ['REDUCED_FETAL_MOVEMENT']],
    ['swelling of face/hands is watch', { symptoms: ['swelling_face_hands'] }, {}, 'watch', ['SWELLING_FACE_HANDS']],
    ['age 18 is a risk factor', {}, { age: 18 }, 'watch', ['AGE_RISK']],
    ['age 19 is fine', {}, { age: 19 }, 'normal', []],
    ['age 35 is fine', {}, { age: 35 }, 'normal', []],
    ['age 36 is a risk factor', {}, { age: 36 }, 'watch', ['AGE_RISK']],
    ['parity 4 is fine', {}, { parity: 4 }, 'normal', []],
    ['parity 5 is a risk factor', {}, { parity: 5 }, 'watch', ['PARITY_RISK']],
    ['unknown age and parity are ignored', { bpSys: 120, bpDia: 80 }, {}, 'normal', []],
  ];

  it.each(cases)('%s', (_name, facts, profile, level, codes) => {
    const r = assessAnc(visit(facts), profile);
    expect(r.level).toBe(level);
    expect(r.reasons.map((x) => x.code).sort()).toEqual([...codes].sort());
    expect(r.rulesVersion).toBe('anc.v1');
  });

  it('the highest level wins and reasons are listed most serious first', () => {
    const r = assessAnc(visit({ bpSys: 150, bpDia: 100, hb: 10, symptoms: ['bleeding'] }), { age: 17 });
    expect(r.level).toBe('urgent');
    expect(r.reasons[0].code).toBe('BLEEDING');
    expect(r.reasons.map((x) => x.level)).toEqual(['urgent', 'high', 'watch', 'watch']);
  });

  it('is deterministic', () => {
    const f = visit({ bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] });
    expect(assessAnc(f, { age: 22 })).toEqual(assessAnc(f, { age: 22 }));
  });

  it('cites ICMR page 1 for criteria that are quoted in the evidence file', () => {
    const r = assessAnc(visit({ bpSys: 150, bpDia: 100 }));
    expect(r.reasons[0].evidence).toMatchObject({ sourceId: 'icmr-anc-stw', page: '1', status: 'cited' });
  });

  it('never cites a source for rules that are not in the official documents', () => {
    for (const facts of [{ bpSys: 165, bpDia: 100 }, { hb: 9 }, { symptoms: ['swelling_face_hands'] }] as Partial<VisitFacts>[]) {
      const r = assessAnc(visit(facts));
      expect(r.reasons[0].evidence.status).toBe('pending');
      expect(r.reasons[0].evidence.page).toBeUndefined();
    }
  });

  it('tells the ASHA to repeat a high BP after 6 hours (the ICMR criterion needs two readings)', () => {
    expect(assessAnc(visit({ bpSys: 150, bpDia: 100 })).reasons[0].text).toMatch(/Repeat after 6 hours/);
  });
});

describe('VisitFacts validation', () => {
  it('rejects BP with only one value', () => {
    expect(VisitFacts.safeParse({ bpSys: 150 }).success).toBe(false);
  });
  it('rejects systolic not above diastolic', () => {
    expect(VisitFacts.safeParse({ bpSys: 90, bpDia: 100 }).success).toBe(false);
  });
  it('rejects absurd BP (a speech-recognition slip like 999)', () => {
    expect(VisitFacts.safeParse({ bpSys: 999, bpDia: 100 }).success).toBe(false);
  });
  it('accepts a normal report and defaults symptoms', () => {
    const r = VisitFacts.parse({ bpSys: 150, bpDia: 100, gestationWeeks: 28 });
    expect(r.symptoms).toEqual([]);
  });
});
