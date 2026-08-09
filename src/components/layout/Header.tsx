import { Link } from 'react-router-dom';
import { User, Hamburger, LogOut, BarChart3, Star, ListMusic, Settings2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onOpenMenu?: () => void;
}

/**
 * Sticky editorial header: wordmark, flat search field, account block.
 */
export function Header({ onOpenMenu }: HeaderProps) {
  const { user, signOut } = useAuth();

  const nickname = user?.email ? user.email.split('@')[0] : null;

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-background">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 px-6 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="lg:hidden text-foreground"
            aria-label="Open navigation"
          >
            <Hamburger className="h-5 w-5" />
          </button>
          <Link to="/" className="font-display text-[24px] uppercase leading-[1.2] md:text-[33px]">
            SoundVault
          </Link>
        </div>

        <div className="hidden md:block max-w-[520px] w-full justify-self-center">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-5 px-2 py-2.5 justify-self-end">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3" aria-label="Account menu">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="hidden font-display text-[13px] uppercase leading-none md:inline">
                    {nickname}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border border-ink bg-popover">
                <div className="px-3 py-2">
                  <p className="truncate text-sm">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> My stats
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/rated-music" className="flex items-center gap-2">
                    <Star className="h-4 w-4" /> Rated music
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/playlists" className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4" /> Playlists
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/preferences" className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" /> Preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button className="border border-ink bg-primary px-6 text-xs uppercase text-primary-foreground hover:opacity-90">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
