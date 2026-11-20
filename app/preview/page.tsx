import { notFound } from 'next/navigation';
import { PreviewClient } from '@/components/asha/PreviewClient';

// Design preview with sample data. Disabled in production so no sample data is ever shown to real users.
export default function PreviewPage() {
  if (process.env.VERCEL_ENV === 'production') notFound();
  return <PreviewClient />;
}
