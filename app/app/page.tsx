import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LandingPage from '@/components/LandingPage';
import { ashaExists, getServerSession } from '@/lib/auth/server';
import { sessionRole } from '@/lib/auth/session';
import { SETUP_DONE_COOKIE } from '@/lib/client-prefs';

// The voice app itself. Requires a (demo) sign-in; the marketing page lives at "/".
export default async function AppPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  if (!(await ashaExists(session.ashaId))) redirect('/login?expired=1'); // signed cookie, but the demo account is gone
  if (sessionRole(session) === 'doctor') redirect('/dashboard');
  const initialSetupDone = (await cookies()).get(SETUP_DONE_COOKIE)?.value === '1';
  return <LandingPage initialSetupDone={initialSetupDone} />;
}
