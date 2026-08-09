import { Link, useLocation } from 'react-router-dom';
import { User, LogOut, BarChart3, Star, ListMusic, Settings2 } from '@/components/icons';
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

export function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="container mx-auto px-6">
        <div className="flex items-center gap-6 h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-7 h-7 rounded-lg gradient-bg" />
            <span className="text-lg font-boldonse tracking-wider text-foreground">
              SOUNDVAULT
            </span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-md mx-auto hidden md:block">
            <GlobalSearch />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-5 ml-auto">
            <Link
              to="/pricing"
              className={`hidden md:inline text-sm uppercase tracking-wider transition-colors ${
                isActive('/pricing') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pricing
            </Link>
            <a
              href="#"
              className="hidden md:inline text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Download App
            </a>
            {user && (
              <Link
                to="/dashboard"
                className={`hidden md:inline text-sm uppercase tracking-wider transition-colors ${
                  isActive('/dashboard') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My stats
              </Link>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> My stats
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/rated-music" className="flex items-center gap-2">
                      <Star className="w-4 h-4" /> Rated music
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/playlists" className="flex items-center gap-2">
                      <ListMusic className="w-4 h-4" /> Playlists
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/preferences" className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4" /> Preferences
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button className="gradient-bg text-primary-foreground border-0 hover:opacity-90 uppercase tracking-wider text-xs font-medium px-6">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
