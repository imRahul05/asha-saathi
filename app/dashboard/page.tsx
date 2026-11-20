import { Dashboard } from '@/components/asha/Dashboard';

export const metadata = { title: 'ASHA Saathi · Live dashboard' };

// Projector view. Uses sample data until it subscribes to /api/events.
export default function DashboardPage() {
  return <Dashboard />;
}
