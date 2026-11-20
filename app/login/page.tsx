import { redirect } from 'next/navigation';
import { LoginCard } from '@/components/asha/LoginCard';
import { getServerSession } from '@/lib/auth/server';

export const metadata = { title: 'Try ASHA Saathi' };

export default async function LoginPage() {
  if (await getServerSession()) redirect('/app');
  return <LoginCard />;
}
