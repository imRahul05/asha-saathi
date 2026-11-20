import { redirect } from 'next/navigation';
import LandingPage from '@/components/LandingPage';
import { getServerSession } from '@/lib/auth/server';

// The voice app itself. Requires a (demo) sign-in; the marketing page lives at "/".
export default async function AppPage() {
  if (!(await getServerSession())) redirect('/login');
  return <LandingPage />;
}
