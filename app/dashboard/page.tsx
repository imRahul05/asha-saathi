import { Dashboard } from '@/components/asha/Dashboard';

export const metadata = { title: 'ASHA Saathi · Live dashboard' };

// Projector view. Live data from the database; open /dashboard?key=<DASHBOARD_KEY> when a key is configured.
export default function DashboardPage() {
  return <Dashboard />;
}
