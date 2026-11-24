import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { requireLiveSession } from '@/lib/auth/require';
import { sessionRole } from '@/lib/auth/session';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getAsha } from '@/lib/db/repo';
import type { RtmTokenResponse } from '@/lib/call/signaling-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RTM_TOKEN_TTL_SECONDS = 3600;

export async function GET(request: NextRequest) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const cert = process.env.NEXT_AGORA_APP_CERTIFICATE;
  if (!appId || !cert) {
    return NextResponse.json({ error: 'AGORA_NOT_CONFIGURED' }, { status: 500 });
  }

  try {
    const role = sessionRole(auth.session);
    const asha = hasDatabase() ? await getAsha(getDb(), auth.session.ashaId) : null;

    const channel = `phc-ring-${auth.session.ashaId}`;
    const userId = role === 'doctor' ? `doctor-${auth.session.ashaId}` : `asha-${auth.session.ashaId}`;
    const peerId = role === 'doctor' ? `asha-${auth.session.ashaId}` : `doctor-${auth.session.ashaId}`;

    const expires = Math.floor(Date.now() / 1000) + RTM_TOKEN_TTL_SECONDS;
    const token = RtcTokenBuilder.buildTokenWithRtm(
      appId,
      cert,
      channel,
      userId,
      RtcRole.PUBLISHER,
      expires,
      expires,
    );

    const ashaName = asha?.name ?? 'ASHA';
    const doctorName = asha?.doctorName ?? 'Dr. Rao';
    const selfName = role === 'doctor' ? doctorName : ashaName;
    const peerName = role === 'doctor' ? ashaName : doctorName;
    const phcName = asha?.phcName ?? 'PHC';
    const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

    const payload: RtmTokenResponse = {
      appId,
      token,
      userId,
      peerId,
      channel,
      role,
      selfName,
      peerName,
      phcName,
      telegramConfigured,
    };

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[call/rtm-token]', e);
    return NextResponse.json({ error: 'RTM_TOKEN_UNAVAILABLE' }, { status: 500 });
  }
}
