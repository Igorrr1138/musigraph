import { Link, useLocation } from 'react-router-dom';
import { Music2, User, LogOut, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <span className="text-xl font-boldonse tracking-wider text-primary">
              SOUNDVAULT
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`nav-link ${isActive('/') ? 'active' : ''}`}
            >
              Discover
            </Link>
            {user && (
              <>
                <Link
                  to="/ratings"
                  className={`nav-link ${isActive('/ratings') ? 'active' : ''}`}
                >
                  My Ratings
                </Link>
                <Link
                  to="/graph"
                  className={`nav-link ${isActive('/graph') ? 'active' : ''}`}
                >
                  Rating Graph
                </Link>
              </>
            )}
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-3">
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
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="md:hidden">
                    <Link to="/ratings" className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      My Ratings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="md:hidden">
                    <Link to="/graph" className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Rating Graph
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem onClick={signOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
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
