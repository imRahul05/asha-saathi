import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { z } from 'zod';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getAsha, getBeneficiary, getVisit } from '@/lib/db/repo';
import { CALL_UID, callChannel, directCallChannel, verifyAnyCallLink } from '@/lib/call/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ t: z.string().min(10).max(2000) });
const TOKEN_SECONDS = 3600;

// Opened by the call page. Checks the signed link, then returns a short-lived RTC token plus a SMALL summary of the visit
// (what the doctor needs to talk about it). The link is the only credential, so it expires and carries nothing else.
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const link = parsed.success ? verifyAnyCallLink(parsed.data.t) : null;
  if (!link) return NextResponse.json({ error: 'LINK_INVALID' }, { status: 401 });

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const cert = process.env.NEXT_AGORA_APP_CERTIFICATE;
  if (!appId || !cert) return NextResponse.json({ error: 'AGORA_NOT_CONFIGURED' }, { status: 500 });
  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });

  try {
    const db = getDb();

    if (link.kind === 'direct') {
      const asha = await getAsha(db, link.ashaId);
      const channel = directCallChannel(link.callId);
      const uid = CALL_UID[link.role];
      const expires = Math.floor(Date.now() / 1000) + TOKEN_SECONDS;
      const token = RtcTokenBuilder.buildTokenWithUid(appId, cert, channel, uid, RtcRole.PUBLISHER, expires, expires);

      return NextResponse.json(
        {
          appId,
          channel,
          uid,
          token,
          role: link.role,
          linkExpiresAt: new Date(link.exp * 1000).toISOString(),
          summary: {
            mother: link.patientName ?? 'Direct consultation',
            village: link.patientVillage ?? null,
            weeks: null,
            bp: null,
            hb: null,
            symptoms: [],
            risk: link.riskLevel ?? 'normal',
            reasons: [],
            ashaName: asha?.name ?? 'ASHA',
            doctorName: asha?.doctorName ?? 'Dr. Rao',
          },
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const visit = await getVisit(db, link.ashaId, link.visitId);
    if (!visit) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const [asha, b] = await Promise.all([getAsha(db, link.ashaId), getBeneficiary(db, link.ashaId, visit.beneficiaryId)]);

    const channel = callChannel(visit.id);
    const uid = CALL_UID[link.role];
    const expires = Math.floor(Date.now() / 1000) + TOKEN_SECONDS;
    const token = RtcTokenBuilder.buildTokenWithUid(appId, cert, channel, uid, RtcRole.PUBLISHER, expires, expires);

    return NextResponse.json(
      {
        appId,
        channel,
        uid,
        token,
        role: link.role,
        linkExpiresAt: new Date(link.exp * 1000).toISOString(),
        summary: {
          mother: b?.name ?? 'Unknown',
          village: b?.village ?? null,
          weeks: visit.gestationWeeks,
          bp: visit.bpSys != null && visit.bpDia != null ? `${visit.bpSys}/${visit.bpDia}` : null,
          hb: visit.hb,
          symptoms: visit.symptoms,
          risk: visit.riskLevel,
          reasons: visit.riskReasons.map((r) => r.text),
          ashaName: asha?.name ?? 'ASHA',
          doctorName: asha?.doctorName ?? 'Doctor',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('[call/join]', e);
    return NextResponse.json({ error: 'CALL_UNAVAILABLE' }, { status: 500 });
  }
}
