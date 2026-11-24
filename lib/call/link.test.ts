import { describe, expect, it } from 'vitest';
import {
  CALL_LINK_TTL_SECONDS,
  callChannel,
  callUrl,
  directCallChannel,
  directCallUrl,
  signCallLink,
  signDirectCallLink,
  verifyAnyCallLink,
  verifyCallLink,
} from './link';

process.env.SESSION_SECRET = 'test-call-link-secret-0123456789';

const NOW_MS = 1_750_000_000_000;
const EXP_FUTURE = Math.floor(NOW_MS / 1000) + 3600;
const EXP_PAST = Math.floor(NOW_MS / 1000) - 60;

describe('lib/call/link', () => {
  it('round-trips visit call links via verifyCallLink and verifyAnyCallLink', () => {
    const token = signCallLink({
      visitId: 'visit-123',
      ashaId: 'asha-456',
      role: 'doctor',
      exp: EXP_FUTURE,
    });

    expect(verifyCallLink(token, NOW_MS)).toEqual({
      visitId: 'visit-123',
      ashaId: 'asha-456',
      role: 'doctor',
      exp: EXP_FUTURE,
    });

    expect(verifyAnyCallLink(token, NOW_MS)).toEqual({
      kind: 'visit',
      visitId: 'visit-123',
      ashaId: 'asha-456',
      role: 'doctor',
      exp: EXP_FUTURE,
    });
  });

  it('round-trips direct call links via signDirectCallLink and verifyAnyCallLink', () => {
    const token = signDirectCallLink({
      kind: 'direct',
      callId: 'abc123def456',
      ashaId: 'asha-456',
      role: 'asha',
      patientName: 'Sunita Devi',
      patientVillage: 'Narsapura',
      riskLevel: 'high',
      exp: EXP_FUTURE,
    });

    expect(verifyAnyCallLink(token, NOW_MS)).toEqual({
      kind: 'direct',
      callId: 'abc123def456',
      ashaId: 'asha-456',
      role: 'asha',
      patientName: 'Sunita Devi',
      patientVillage: 'Narsapura',
      riskLevel: 'high',
      exp: EXP_FUTURE,
    });

    // verifyCallLink remains strictly for visit-linked tokens
    expect(verifyCallLink(token, NOW_MS)).toBeNull();
  });

  it('rejects expired visit and direct call links', () => {
    const expiredVisit = signCallLink({
      visitId: 'visit-123',
      ashaId: 'asha-456',
      role: 'doctor',
      exp: EXP_PAST,
    });
    const expiredDirect = signDirectCallLink({
      kind: 'direct',
      callId: 'abc123',
      ashaId: 'asha-456',
      role: 'doctor',
      exp: EXP_PAST,
    });

    expect(verifyCallLink(expiredVisit, NOW_MS)).toBeNull();
    expect(verifyAnyCallLink(expiredVisit, NOW_MS)).toBeNull();
    expect(verifyAnyCallLink(expiredDirect, NOW_MS)).toBeNull();
  });

  it('rejects tampered payloads and signatures', () => {
    const visitToken = signCallLink({
      visitId: 'visit-123',
      ashaId: 'asha-456',
      role: 'asha',
      exp: EXP_FUTURE,
    });
    const [visitBody, visitSig] = visitToken.split('.');
    const tamperedSig = `${visitBody}.${visitSig.slice(0, -1)}${visitSig.endsWith('a') ? 'b' : 'a'}`;
    expect(verifyCallLink(tamperedSig, NOW_MS)).toBeNull();
    expect(verifyAnyCallLink(tamperedSig, NOW_MS)).toBeNull();

    const directToken = signDirectCallLink({
      kind: 'direct',
      callId: 'call-1',
      ashaId: 'asha-456',
      role: 'asha',
      exp: EXP_FUTURE,
    });
    const [, directSig] = directToken.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({
        kind: 'direct',
        callId: 'call-1',
        ashaId: 'asha-456',
        role: 'doctor',
        exp: EXP_FUTURE,
      }),
    ).toString('base64url');
    expect(verifyAnyCallLink(`${forgedBody}.${directSig}`, NOW_MS)).toBeNull();
    expect(verifyAnyCallLink('not-a-token', NOW_MS)).toBeNull();
    expect(verifyAnyCallLink(null, NOW_MS)).toBeNull();
    expect(verifyAnyCallLink(undefined, NOW_MS)).toBeNull();
  });

  it('builds valid callUrl, directCallUrl, and channel helpers', () => {
    const vUrl = callUrl('https://example.org/', { id: 'visit-1', ashaId: 'asha-1' }, 'doctor', NOW_MS);
    expect(vUrl.startsWith('https://example.org/call/')).toBe(true);
    const vToken = vUrl.slice('https://example.org/call/'.length);
    expect(verifyAnyCallLink(vToken, NOW_MS)).toEqual({
      kind: 'visit',
      visitId: 'visit-1',
      ashaId: 'asha-1',
      role: 'doctor',
      exp: Math.floor(NOW_MS / 1000) + CALL_LINK_TTL_SECONDS,
    });

    const dUrl = directCallUrl(
      'https://example.org/',
      { callId: 'direct-99', ashaId: 'asha-1', role: 'asha', patientName: 'Meera' },
      NOW_MS,
    );
    expect(dUrl.startsWith('https://example.org/call/')).toBe(true);
    const dToken = dUrl.slice('https://example.org/call/'.length);
    expect(verifyAnyCallLink(dToken, NOW_MS)).toEqual({
      kind: 'direct',
      callId: 'direct-99',
      ashaId: 'asha-1',
      role: 'asha',
      patientName: 'Meera',
      exp: Math.floor(NOW_MS / 1000) + CALL_LINK_TTL_SECONDS,
    });

    expect(callChannel('visit-1')).toBe('call-visit-1');
    expect(directCallChannel('direct-99')).toBe('direct-direct-99');
  });
});
