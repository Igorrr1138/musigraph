import { useEffect, useMemo, useReducer } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc3, Plus, Star, Music, ListMusic } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { AlbumCard } from '@/components/music/AlbumCard';
import { ArtistCard } from '@/components/music/ArtistCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import {
  getLastReleases,
  getRecommendedArtists,
  getRecentlyRated,
  getHomePlaylists,
} from '@/lib/homeFeed';

const ROTATING_WORDS = ['Discover', 'Listen', '& Rate'];
const ROTATION_INTERVAL_MS = 2500;

function useReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function RotatingHeadline() {
  const reduced = useReducedMotion();
  const [index, tick] = useReducer((i: number) => (i + 1) % ROTATING_WORDS.length, 0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(tick, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  const word = reduced ? 'Discover & Rate' : ROTATING_WORDS[index];

  return (
    <h1 className="text-6xl md:text-8xl font-boldonse tracking-wide leading-[1.05]">
      {/* Full phrase for SEO / screen readers */}
      <span className="sr-only">Discover, Listen, &amp; Rate</span>
      <span aria-hidden="true" className="relative inline-block min-h-[1.05em]">
        <AnimatePresence mode="wait">
          <motion.span
            key={word}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="gradient-text inline-block"
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </h1>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-boldonse mb-5 uppercase tracking-wider">{children}</h2>
  );
}

function GridSkeleton({ count, aspect = 'aspect-square' }: { count: number; aspect?: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className={`${aspect} w-full rounded-xl`} />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

const Index = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const lastReleasesQ = useQuery({
    queryKey: ['home', 'lastReleases', userId],
    queryFn: () => getLastReleases(userId, 5),
    staleTime: 5 * 60 * 1000,
  });
  const recommendedQ = useQuery({
    queryKey: ['home', 'recommended', userId],
    queryFn: () => getRecommendedArtists(userId, 5),
    staleTime: 5 * 60 * 1000,
  });
  const recentlyRatedQ = useQuery({
    queryKey: ['home', 'recentlyRated', userId],
    queryFn: () => getRecentlyRated(userId, 3),
    staleTime: 60 * 1000,
  });
  const playlistsQ = useQuery({
    queryKey: ['home', 'playlists', userId],
    queryFn: () => getHomePlaylists(userId, 2),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  const recentlyRated = recentlyRatedQ.data ?? [];
  const playlists = playlistsQ.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative pt-32 pb-12 px-4 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        <div className="container mx-auto max-w-7xl relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <RotatingHeadline />
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Explore millions of artists and albums. Rate your favorites and visualize your musical journey.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-8 lg:gap-10 items-start">
            {/* LEFT: discovery feed */}
            <div className="space-y-12 min-w-0">
              <div>
                <SectionHeading>Last releases</SectionHeading>
                {lastReleasesQ.isLoading ? (
                  <GridSkeleton count={5} />
                ) : lastReleasesQ.data && lastReleasesQ.data.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {lastReleasesQ.data.map((album, i) => (
                      <AlbumCard key={album.id} album={album} index={i} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No releases to show yet.</p>
                )}
              </div>

              <div>
                <SectionHeading>Recommended</SectionHeading>
                {recommendedQ.isLoading ? (
                  <GridSkeleton count={5} />
                ) : recommendedQ.data && recommendedQ.data.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {recommendedQ.data.map((artist, i) => (
                      <ArtistCard key={artist.id} artist={artist} index={i} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {user ? 'Rate a few albums to unlock recommendations.' : 'Sign in to see tailored picks.'}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT: stats aside */}
            <aside className="lg:sticky lg:top-24 rounded-2xl bg-card/50 border border-border/40 p-5 space-y-8">
              <div>
                <h3 className="text-lg font-boldonse mb-4 uppercase tracking-wider">
                  Recently rated
                </h3>
                {recentlyRatedQ.isLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="flex gap-3 items-center">
                        <Skeleton className="w-14 h-14 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentlyRated.length > 0 ? (
                  <ul className="space-y-3">
                    {recentlyRated.map(r => (
                      <li key={r.id}>
                        <Link
                          to={r.albumId ? `/album/${r.albumId}` : '#'}
                          className="flex gap-3 items-center group"
                        >
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                            {r.coverUrl ? (
                              <img
                                src={r.coverUrl}
                                alt={r.albumTitle}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Disc3 className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                              {r.albumTitle}
                            </p>
                            {r.artistName && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {r.artistName}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-xs mt-0.5">
                              <Star className="w-3 h-3 fill-primary text-primary" />
                              <span className="font-semibold">{r.rating}/10</span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {user ? 'Your rated albums will show up here.' : 'Sign in to start rating.'}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-boldonse mb-4 uppercase tracking-wider">
                  My playlists
                </h3>
                {!user ? (
                  <Link
                    to="/auth"
                    className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Sign in to build playlists →
                  </Link>
                ) : playlistsQ.isLoading ? (
                  <div className="space-y-3">
                    {[0, 1].map(i => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {playlists.map(p => (
                      <li key={p.id}>
                        <Link
                          to={`/dashboard/playlists`}
                          className="flex gap-3 items-center group"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
                            {p.coverUrl ? (
                              <img
                                src={p.coverUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <ListMusic className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Music className="w-3 h-3" />
                              {p.trackCount} tracks
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link
                        to="/dashboard/playlists"
                        className="flex gap-3 items-center group text-muted-foreground hover:text-primary transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full border border-dashed border-border flex items-center justify-center flex-shrink-0">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-semibold">Add New Playlist</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
