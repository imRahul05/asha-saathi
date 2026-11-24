import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { sessionRole } from '@/lib/auth/session';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getAsha, getBeneficiary, getVisit, logEvent } from '@/lib/db/repo';
import {
  callChannel,
  callUrl,
  directCallChannel,
  directCallUrl,
  verifyAnyCallLink,
  type AnyCallLink,
  type CallRole,
} from '@/lib/call/link';
import type { CallContextSummary, RingCallResponse } from '@/lib/call/signaling-types';
import { telegramNotifier } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  visitId: z.string().uuid().optional(),
  patientName: z.string().trim().min(1).max(160).optional(),
  patientVillage: z.string().trim().max(160).nullable().optional(),
  riskLevel: z.enum(['normal', 'watch', 'high', 'urgent']).nullable().optional(),
  notifyTelegram: z.boolean().optional(),
  fallbackPeerUrl: z.string().url().max(2500).optional(),
});

function extractVerifiedFallbackLink(url: string | undefined, expectedAshaId: string): AnyCallLink | null {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/\/call\/([^/]+)$/);
    if (!match?.[1]) return null;
    const verified = verifyAnyCallLink(decodeURIComponent(match[1]));
    if (!verified || verified.ashaId !== expectedAshaId) return null;
    return verified;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });

  const rawBody = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }

  try {
    const db = getDb();
    const role: CallRole = sessionRole(auth.session);
    const peerRole: CallRole = role === 'doctor' ? 'asha' : 'doctor';
    const asha = await getAsha(db, auth.session.ashaId);

    const ashaName = asha?.name ?? 'ASHA';
    const doctorName = asha?.doctorName ?? 'Dr. Rao';
    const selfName = role === 'doctor' ? doctorName : ashaName;
    const peerName = role === 'doctor' ? ashaName : doctorName;
    const base = process.env.PUBLIC_BASE_URL ?? request.nextUrl.origin;

    const fallbackLink = extractVerifiedFallbackLink(parsed.data.fallbackPeerUrl, auth.session.ashaId);

    let callId: string;
    let channel: string;
    let selfUrl: string;
    let peerUrl: string;
    let summary: CallContextSummary;

    if (parsed.data.visitId) {
      const visit = await getVisit(db, auth.session.ashaId, parsed.data.visitId);
      if (!visit) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
      const beneficiary = await getBeneficiary(db, auth.session.ashaId, visit.beneficiaryId);
      callId = visit.id;
      channel = callChannel(visit.id);
      selfUrl = callUrl(base, visit, role);
      peerUrl =
        fallbackLink && fallbackLink.kind === 'visit' && fallbackLink.visitId === visit.id && parsed.data.fallbackPeerUrl
          ? parsed.data.fallbackPeerUrl
          : callUrl(base, visit, peerRole);
      summary = {
        mother: beneficiary?.name ?? parsed.data.patientName ?? 'Patient',
        village: beneficiary?.village ?? parsed.data.patientVillage ?? null,
        riskLevel: visit.riskLevel,
        visitId: visit.id,
      };
    } else if (fallbackLink && fallbackLink.kind === 'direct' && parsed.data.fallbackPeerUrl) {
      callId = fallbackLink.callId;
      channel = directCallChannel(callId);
      const patientName = parsed.data.patientName ?? fallbackLink.patientName;
      const patientVillage = parsed.data.patientVillage ?? fallbackLink.patientVillage ?? null;
      const riskLevel = parsed.data.riskLevel ?? fallbackLink.riskLevel ?? null;
      selfUrl = directCallUrl(base, {
        callId,
        ashaId: auth.session.ashaId,
        role,
        ...(patientName ? { patientName } : {}),
        ...(patientVillage ? { patientVillage } : {}),
        ...(riskLevel ? { riskLevel } : {}),
      });
      peerUrl = parsed.data.fallbackPeerUrl;
      summary = {
        mother: patientName ?? 'Direct consultation',
        village: patientVillage,
        riskLevel,
        visitId: null,
      };
    } else {
      callId = randomUUID().slice(0, 12);
      channel = directCallChannel(callId);
      const patientName = parsed.data.patientName;
      const patientVillage = parsed.data.patientVillage ?? null;
      const riskLevel = parsed.data.riskLevel ?? null;
      selfUrl = directCallUrl(base, {
        callId,
        ashaId: auth.session.ashaId,
        role,
        ...(patientName ? { patientName } : {}),
        ...(patientVillage ? { patientVillage } : {}),
        ...(riskLevel ? { riskLevel } : {}),
      });
      peerUrl = directCallUrl(base, {
        callId,
        ashaId: auth.session.ashaId,
        role: peerRole,
        ...(patientName ? { patientName } : {}),
        ...(patientVillage ? { patientVillage } : {}),
        ...(riskLevel ? { riskLevel } : {}),
      });
      summary = {
        mother: patientName ?? 'Direct consultation',
        village: patientVillage,
        riskLevel,
        visitId: null,
      };
    }

    let telegramSent = false;
    let telegramError: string | null = null;
    if (
      parsed.data.notifyTelegram &&
      role === 'asha' &&
      process.env.TELEGRAM_BOT_TOKEN &&
      process.env.TELEGRAM_CHAT_ID
    ) {
      const lines: string[] = [`📞 INCOMING CALL from ${ashaName} (ASHA)`];
      if (summary.mother && summary.mother !== 'Direct consultation') {
        lines.push(`Mother: ${summary.mother}${summary.village ? `, ${summary.village}` : ''}`);
      }
      lines.push(`Join voice call in browser: ${peerUrl}`);
      try {
        await telegramNotifier().send(
          { name: doctorName, phone: asha?.doctorPhone ?? null },
          lines.join('\n'),
        );
        telegramSent = true;
      } catch (e) {
        telegramError = e instanceof Error ? e.message : String(e);
        console.error('[call/ring] telegram notification failed:', telegramError);
      }
    }

    await logEvent(db, {
      sessionId: null,
      ashaId: auth.session.ashaId,
      type: 'call',
      name: 'webCallRing',
      input: {
        callId,
        role,
        visitId: summary.visitId,
        mother: summary.mother,
        telegramSent,
      },
      ok: true,
    });

    const response: RingCallResponse = {
      callId,
      channel,
      selfUrl,
      peerUrl,
      selfName,
      peerName,
      telegramSent,
      telegramError,
      summary,
    };

    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[call/ring]', e);
    return NextResponse.json({ error: 'RING_UNAVAILABLE' }, { status: 500 });
  }
}
