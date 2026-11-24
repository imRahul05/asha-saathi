import { redirect } from 'next/navigation';
import { LoginCard } from '@/components/asha/LoginCard';
import { ashaExists, getServerSession } from '@/lib/auth/server';
import { sessionRole } from '@/lib/auth/session';

export const metadata = { title: 'Try ASHA Saathi' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const session = await getServerSession();
  const live = session ? await ashaExists(session.ashaId) : false;
  if (session && live) {
    redirect(sessionRole(session) === 'doctor' ? '/dashboard' : '/app');
  }
  const { expired } = await searchParams;
  // A valid cookie without an account, or an explicit ?expired=1, means the person was signed in before: say so.
  return <LoginCard expired={Boolean(session) || expired === '1'} />;
}
