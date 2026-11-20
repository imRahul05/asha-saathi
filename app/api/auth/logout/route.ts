import { NextResponse } from 'next/server';
import { sessionCookieHeader } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append('Set-Cookie', sessionCookieHeader('', { clear: true }));
  return res;
}
