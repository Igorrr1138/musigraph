import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Disc3 } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { DashboardSidebar, type DashboardTab } from '@/components/dashboard/DashboardSidebar';
import { MyStatsTab } from '@/components/dashboard/MyStatsTab';
import { useAuth } from '@/hooks/useAuth';

const TAB_MAP: Record<string, DashboardTab> = {
  'rated-music': 'rated',
  playlists: 'playlists',
  preferences: 'preferences',
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();

  const active: DashboardTab = tab ? TAB_MAP[tab] ?? 'stats' : 'stats';

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="pt-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row gap-6">
            <DashboardSidebar active={active} />
            <main className="flex-1 min-w-0">
              {active === 'stats' && <MyStatsTab />}
              {active === 'rated' && <ComingSoon title="Rated Music" />}
              {active === 'playlists' && <ComingSoon title="Playlists" />}
              {active === 'preferences' && <ComingSoon title="Preferences" />}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-16 text-center backdrop-blur-sm">
      <h1 className="text-3xl font-boldonse mb-3">{title}</h1>
      <p className="text-muted-foreground">This section is coming soon.</p>
    </div>
  );
}
