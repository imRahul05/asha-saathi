import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/require';
import { sessionRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { getAsha } from '@/lib/db/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const asha = await getAsha(getDb(), auth.session.ashaId).catch(() => null);
  if (!asha) return NextResponse.json({ error: 'SIGN_IN_REQUIRED' }, { status: 401 }); // e.g. a demo account that has been cleaned up
  return NextResponse.json({
    role: sessionRole(auth.session),
    asha: { name: asha.name, phcName: asha.phcName },
    doctor: { name: asha.doctorName ?? 'Dr. Rao', phcName: asha.phcName },
    mode: auth.session.mode,
  });
}
