import { Link, useLocation } from "react-router-dom";
import { BarChart3, ListMusic, LogOut, Settings2, User } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const matchesPath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="group flex items-center gap-3">
            <span className="font-boldonse text-xl tracking-wider text-primary">SOUNDVAULT</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/" className={`nav-link ${matchesPath("/") && !matchesPath("/ratings") && !matchesPath("/graph") && !matchesPath("/playlists") ? "active" : ""}`}>
              Discover
            </Link>
            {user ? (
              <>
                <Link to="/ratings" className={`nav-link ${matchesPath("/ratings") ? "active" : ""}`}>
                  My Ratings
                </Link>
                <Link to="/graph" className={`nav-link ${matchesPath("/graph") ? "active" : ""}`}>
                  Rating Graph
                </Link>
                <Link to="/playlists" className={`nav-link ${matchesPath("/playlists") ? "active" : ""}`}>
                  Playlists
                </Link>
              </>
            ) : null}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-full">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass w-60">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/playlists" className="flex items-center gap-2">
                      <ListMusic className="h-4 w-4" />
                      Playlists
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings/account" className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Account Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="md:hidden">
                    <Link to="/ratings" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      My Ratings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="md:hidden">
                    <Link to="/graph" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Rating Graph
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem onClick={() => void signOut()} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button className="gradient-bg border-0 px-6 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:opacity-90">
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
