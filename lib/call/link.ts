import { timingSafeEqual } from 'node:crypto';
import { hmacScoped } from '@/lib/auth/session';
import type { RiskLevel } from '@/lib/snapshot-types';

// A call link is a signed, expiring value that says: this person may join the call about THIS visit (or direct call), as THIS role.
// No account, no table. The page that opens it asks the server for an RTC token, so the link itself is never an Agora token.
export type CallRole = 'doctor' | 'asha';
export type CallLink = { visitId: string; ashaId: string; role: CallRole; exp: number };

export interface DirectCallLink {
  kind: 'direct';
  callId: string;
  ashaId: string;
  role: CallRole;
  patientName?: string;
  patientVillage?: string;
  riskLevel?: RiskLevel;
  exp: number;
}

export type AnyCallLink = ({ kind: 'visit' } & CallLink) | DirectCallLink;

interface ParsedCallLinkPayload {
  kind?: string;
  visitId?: string;
  callId?: string;
  ashaId?: string;
  role?: string;
  patientName?: string;
  patientVillage?: string;
  riskLevel?: string;
  exp?: number;
}

export const CALL_LINK_TTL_SECONDS = 6 * 60 * 60;
const SCOPE = 'call-link';

function isRiskLevel(value: string | undefined): value is RiskLevel {
  return value === 'normal' || value === 'watch' || value === 'high' || value === 'urgent';
}

function verifySignedPayload(value: string | null | undefined): ParsedCallLinkPayload | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const want = Buffer.from(hmacScoped(SCOPE, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ParsedCallLinkPayload;
  } catch {
    return null;
  }
}

export function signCallLink(l: CallLink): string {
  const body = Buffer.from(JSON.stringify(l)).toString('base64url');
  return `${body}.${hmacScoped(SCOPE, body)}`;
}

export function signDirectCallLink(l: DirectCallLink): string {
  const body = Buffer.from(JSON.stringify(l)).toString('base64url');
  return `${body}.${hmacScoped(SCOPE, body)}`;
}

export function verifyCallLink(value: string | null | undefined, nowMs: number = Date.now()): CallLink | null {
  const l = verifySignedPayload(value);
  if (!l) return null;
  if (l.kind !== undefined && l.kind !== 'visit') return null;
  if (typeof l.visitId !== 'string' || typeof l.ashaId !== 'string' || typeof l.exp !== 'number') return null;
  if (l.role !== 'doctor' && l.role !== 'asha') return null;
  if (l.exp * 1000 < nowMs) return null;
  return { visitId: l.visitId, ashaId: l.ashaId, role: l.role, exp: l.exp };
}

export function verifyAnyCallLink(value: string | null | undefined, nowMs: number = Date.now()): AnyCallLink | null {
  const l = verifySignedPayload(value);
  if (!l) return null;
  if (typeof l.ashaId !== 'string' || typeof l.exp !== 'number') return null;
  if (l.role !== 'doctor' && l.role !== 'asha') return null;
  if (l.exp * 1000 < nowMs) return null;

  if (l.kind === 'direct') {
    if (typeof l.callId !== 'string' || l.callId.length === 0) return null;
    const result: DirectCallLink = {
      kind: 'direct',
      callId: l.callId,
      ashaId: l.ashaId,
      role: l.role,
      exp: l.exp,
    };
    if (typeof l.patientName === 'string') result.patientName = l.patientName;
    if (typeof l.patientVillage === 'string') result.patientVillage = l.patientVillage;
    if (isRiskLevel(l.riskLevel)) result.riskLevel = l.riskLevel;
    return result;
  }

  if (l.kind !== undefined && l.kind !== 'visit') return null;
  if (typeof l.visitId !== 'string' || l.visitId.length === 0) return null;
  return { kind: 'visit', visitId: l.visitId, ashaId: l.ashaId, role: l.role, exp: l.exp };
}

export function callUrl(baseUrl: string, visit: { id: string; ashaId: string }, role: CallRole, nowMs: number = Date.now()): string {
  const t = signCallLink({ visitId: visit.id, ashaId: visit.ashaId, role, exp: Math.floor(nowMs / 1000) + CALL_LINK_TTL_SECONDS });
  return `${baseUrl.replace(/\/$/, '')}/call/${t}`;
}

export function directCallUrl(
  baseUrl: string,
  params: Omit<DirectCallLink, 'kind' | 'exp'>,
  nowMs: number = Date.now(),
): string {
  const t = signDirectCallLink({
    kind: 'direct',
    ...params,
    exp: Math.floor(nowMs / 1000) + CALL_LINK_TTL_SECONDS,
  });
  return `${baseUrl.replace(/\/$/, '')}/call/${t}`;
}

/** One channel per visit, and fixed UIDs per role, so the two sides never collide and a re-join replaces the old connection. */
export const callChannel = (visitId: string) => `call-${visitId}`;
export const directCallChannel = (callId: string) => `direct-${callId}`;
export const CALL_UID: Record<CallRole, number> = { doctor: 7001, asha: 7002 };
