import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { getVisit } from '@/lib/db/repo';
import { callUrl } from '@/lib/call/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The signed-in ASHA asks for the call links of one of HER visits: one to open herself, one to share with the doctor.
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const visitId = request.nextUrl.searchParams.get('visit') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(visitId)) return NextResponse.json({ error: 'BAD_VISIT' }, { status: 400 });
  const visit = await getVisit(getDb(), auth.session.ashaId, visitId);
  if (!visit) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const base = process.env.PUBLIC_BASE_URL ?? request.nextUrl.origin;
  return NextResponse.json({ asha: callUrl(base, visit, 'asha'), doctor: callUrl(base, visit, 'doctor') }, { headers: { 'Cache-Control': 'no-store' } });
}
