import { redirect } from 'next/navigation';
import LandingPage from '@/components/LandingPage';
import { ashaExists, getServerSession } from '@/lib/auth/server';

// The voice app itself. Requires a (demo) sign-in; the marketing page lives at "/".
export default async function AppPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  if (!(await ashaExists(session.ashaId))) redirect('/login?expired=1'); // signed cookie, but the demo account is gone
  return <LandingPage />;
}
