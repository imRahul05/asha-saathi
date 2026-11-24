import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/asha/Dashboard';
import { getServerSession } from '@/lib/auth/server';
import { sessionRole } from '@/lib/auth/session';

export const metadata = { title: 'ASHA Saathi · Doctor Dashboard' };

interface DashboardPageProps {
  searchParams: Promise<{ key?: string | string[] }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [session, params] = await Promise.all([getServerSession(), searchParams]);
  const rawKey = params.key;
  const dashboardKey = typeof rawKey === 'string' && rawKey.trim().length > 0 ? rawKey.trim() : null;

  if (session && sessionRole(session) === 'asha' && !dashboardKey) {
    redirect('/app');
  }

  const isDoctorSession = Boolean(session && sessionRole(session) === 'doctor');

  return <Dashboard isDoctorSession={isDoctorSession} dashboardKey={dashboardKey} />;
}
