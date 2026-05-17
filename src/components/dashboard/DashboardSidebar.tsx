import { Link } from 'react-router-dom';
import { BarChart3, Star, ListMusic, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DashboardTab = 'stats' | 'rated' | 'playlists' | 'preferences';

const ITEMS: Array<{ id: DashboardTab; label: string; icon: typeof BarChart3; path: string }> = [
  { id: 'stats', label: 'My Stats', icon: BarChart3, path: '/dashboard' },
  { id: 'rated', label: 'Rated Music', icon: Star, path: '/dashboard/rated-music' },
  { id: 'playlists', label: 'Playlists', icon: ListMusic, path: '/dashboard/playlists' },
  { id: 'preferences', label: 'Preferences', icon: Settings2, path: '/dashboard/preferences' },
];

interface DashboardSidebarProps {
  active: DashboardTab;
}

export function DashboardSidebar({ active }: DashboardSidebarProps) {
  return (
    <aside className="w-full md:w-60 shrink-0">
      <div className="md:sticky md:top-24 rounded-2xl border border-border/40 bg-card/40 p-2 backdrop-blur-sm">
        <nav className="flex md:flex-col gap-1">
          {ITEMS.map(({ id, label, icon: Icon, path }) => {
            const isActive = active === id;
            return (
              <Link
                key={id}
                to={path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm uppercase tracking-[0.18em] transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
