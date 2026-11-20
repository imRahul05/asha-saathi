import { CallRoom } from '@/components/call/CallRoom';

export const metadata = { title: 'ASHA Saathi call', robots: { index: false, follow: false } };

export default async function CallPage({ params }: { params: Promise<{ t: string }> }) {
  const { t } = await params;
  return <CallRoom link={t} />;
}
