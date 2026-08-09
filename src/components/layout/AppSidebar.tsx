import { Link, useLocation } from 'react-router-dom';
import { House, ChartLine, StarHalf, Playlist, FadersHorizontal, Gear, Sun, Moon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

const ITEMS = [
  { label: 'Home', icon: House, path: '/' },
  { label: 'My stats', icon: ChartLine, path: '/dashboard' },
  { label: 'Rated music', icon: StarHalf, path: '/dashboard/rated-music' },
  { label: 'Playlists', icon: Playlist, path: '/dashboard/playlists' },
  { label: 'Preferences', icon: FadersHorizontal, path: '/dashboard/preferences' },
];

interface AppSidebarProps {
  /** Called after navigating, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

/**
 * Global editorial sidebar: 264px, sticky, rigid 1px rules between rows.
 */
export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);

  return (
    <div className="flex h-full w-full flex-col justify-between bg-background pb-[72px] pt-8 lg:pt-16">
      <div className="flex flex-col px-4">
        {ITEMS.map(({ label, icon: Icon, path }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-5 border-b border-ink px-2 py-4 text-[13px] uppercase transition-colors',
                active
                  ? 'border-b-2 bg-ink text-ink-foreground'
                  : 'text-foreground hover:text-primary',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col">
        <div className="flex flex-col px-4">
          <Link
            to="/dashboard/preferences"
            onClick={onNavigate}
            className="flex h-12 items-center gap-5 border-t border-ink px-2 py-4 text-[13px] uppercase text-foreground transition-colors hover:text-primary"
          >
            <Gear className="h-4 w-4 shrink-0" />
            <span className="leading-none">Settings</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-12 items-center gap-5 border-t border-ink px-2 py-4 text-[13px] uppercase text-foreground transition-colors hover:text-primary"
            aria-label="Toggle colour theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span className="leading-none">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
          </button>
        </div>
        <Link
          to="/pricing"
          onClick={onNavigate}
          className="mt-4 flex items-center justify-center gap-1.5 border border-ink bg-primary px-6 py-4 text-[13px] uppercase text-primary-foreground transition-opacity hover:opacity-90"
        >
          Upgrade to pro
        </Link>
      </div>
    </div>
  );
}
