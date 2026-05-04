import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Disc3, ExternalLink, User } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { AlbumCard } from '@/components/music/AlbumCard';
import {
  getArtist,
  getArtistAlbums,
  pickArtistImage,
  type DeezerArtist,
  type DeezerAlbum,
} from '@/lib/deezer';
import {
  buildDiscography,
  sortByReleaseDateAsc,
  type ClassifiedAlbum,
} from '@/lib/discography';
import { getArtistTags } from '@/lib/lastfm';
import { resolveGenres } from '@/lib/genreMap';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

type OtherReleasesTab = 'all' | 'singles' | 'live' | 'compilations';

/** Strict ascending sort by release_date using Date.getTime(). */
function chronoSort<T extends { release_date?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ta = new Date(a.release_date ?? '9999-12-31').getTime();
    const tb = new Date(b.release_date ?? '9999-12-31').getTime();
    return ta - tb;
  });
}

const ArtistPage = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<DeezerArtist | null>(null);
  const [albums, setAlbums] = useState<DeezerAlbum[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoadingArtist, setIsLoadingArtist] = useState(true);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);
  const [otherTab, setOtherTab] = useState<OtherReleasesTab>('all');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    setIsLoadingArtist(true);
    setIsLoadingAlbums(true);
    setArtist(null);
    setAlbums([]);
    setTags([]);
    setOtherTab('all');

    getArtist(id).then(data => {
      if (cancelled) return;
      setArtist(data);
      setIsLoadingArtist(false);
      if (data?.name) {
        getArtistTags(id, data.name).then(t => { if (!cancelled) setTags(t); });
      }
    });

    getArtistAlbums(id, 100).then(data => {
      if (!cancelled) {
        setAlbums(data);
        setIsLoadingAlbums(false);
      }
    });

    return () => { cancelled = true; };
  }, [id]);

  const artistImage = artist ? pickArtistImage(artist) : null;

  /**
   * Build a Wikipedia-style discography from the raw Deezer feed:
   *   • dedup Deluxe/Remastered/Anniversary into the original (oldest variant wins)
   *   • classify by record_type + primary-artist + title heuristics
   *   • sort every bucket oldest → newest
   *
   * After buildDiscography(), apply an explicit Date.getTime() sort so that
   * the album grid strictly follows chronological order regardless of any
   * internal sort implementation details.
   */
  const discography = useMemo(() => {
    if (!artist) return null;
    const d = buildDiscography(albums, artist.id);
    return {
      studioAlbums:   chronoSort(d.studioAlbums),
      eps:            chronoSort(d.eps),
      singles:        d.singles,        // singles sorted inside buildDiscography
      collaborations: chronoSort(d.collaborations),
      live:           d.live,
      compilations:   d.compilations,
    };
  }, [albums, artist]);

  /**
   * Other Releases — Singles / Live / Compilations rolled into one section
   * with filter tabs. The "all" view re-sorts the merged list ascending.
   */
  const otherReleases = useMemo(() => {
    const empty = { all: [], singles: [], live: [], compilations: [] } as Record<
      OtherReleasesTab,
      ClassifiedAlbum[]
    >;
    if (!discography) return empty;
    return {
      singles:      discography.singles,
      live:         discography.live,
      compilations: discography.compilations,
      all:          sortByReleaseDateAsc([
        ...discography.singles,
        ...discography.live,
        ...discography.compilations,
      ]),
    };
  }, [discography]);

  if (isLoadingArtist) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 px-4">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-8 w-32 mb-8" />
            <div className="flex flex-col md:flex-row gap-8">
              <Skeleton className="w-48 h-48 rounded-full" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Artist not found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const renderSection = (
    title: string,
    items: ClassifiedAlbum[],
    startIndex: number,
  ) =>
    items.length > 0 && (
      <div className="mb-12">
        <h3 className="text-xl font-semibold mb-5 text-muted-foreground">
          {title} ({items.length})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {items.map((album, index) => (
            <AlbumCard
              key={album.id}
              album={{ ...album, artist: { id: artist.id, name: artist.name } }}
              index={startIndex + index}
            />
          ))}
        </div>
      </div>
    );

  // Section count totals so each card's animation index stays unique
  // across sections (preserves the existing staggered entrance).
  const studioCount        = discography?.studioAlbums.length        ?? 0;
  const epCount            = discography?.eps.length                 ?? 0;
  const collaborationCount = discography?.collaborations.length      ?? 0;

  const otherTotal = otherReleases.all.length;
  const visibleOther = otherReleases[otherTab];

  const hasAnyRelease =
    studioCount + epCount + collaborationCount + otherTotal > 0;

  const otherTabs: Array<{ id: OtherReleasesTab; label: string; count: number }> = [
    { id: 'all',          label: 'All',          count: otherReleases.all.length },
    { id: 'singles',      label: 'Singles',      count: otherReleases.singles.length },
    { id: 'live',         label: 'Live',         count: otherReleases.live.length },
    { id: 'compilations', label: 'Compilations', count: otherReleases.compilations.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="pt-24 pb-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container mx-auto max-w-6xl relative">
          <Breadcrumb className="mb-8">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{artist.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-48 h-48 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 gradient-border overflow-hidden"
            >
              {artistImage ? (
                <img src={artistImage} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-20 h-20 text-muted-foreground" />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1"
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4">{artist.name}</h1>

              {tags.length > 0 && (() => {
                const genres = resolveGenres(tags, 5, artist.name);
                return (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {genres.map(g => (
                      <Link key={g.slug} to={`/genre/${encodeURIComponent(g.slug)}`} className="inline-flex">
                        <Badge
                          variant="secondary"
                          className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 cursor-pointer text-sm px-3 py-1"
                        >
                          {g.label}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                {typeof artist.nb_fan === 'number' && artist.nb_fan > 0 && (
                  <span>{artist.nb_fan.toLocaleString()} fans</span>
                )}
                {!isLoadingAlbums && albums.length > 0 && (
                  <span className="flex items-center gap-2">
                    <Disc3 className="w-4 h-4" />
                    {albums.length} releases
                  </span>
                )}
              </div>

              <a
                href={`https://www.deezer.com/artist/${artist.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-primary hover:underline"
              >
                View on Deezer
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold mb-8">Discography</h2>

          {isLoadingAlbums || !discography ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : hasAnyRelease ? (
            <>
              {renderSection('Studio Albums', discography.studioAlbums, 0)}
              {renderSection('EPs', discography.eps, studioCount)}
              {renderSection(
                'Collaborations',
                discography.collaborations,
                studioCount + epCount,
              )}

              {otherTotal > 0 && (
                <div className="mb-12">
                  <h3 className="text-xl font-semibold mb-5 text-muted-foreground">
                    Other Releases ({otherTotal})
                  </h3>

                  <div
                    role="tablist"
                    aria-label="Filter other releases"
                    className="flex flex-wrap gap-2 mb-6"
                  >
                    {otherTabs.map(tab => {
                      const disabled = tab.id !== 'all' && tab.count === 0;
                      const active = otherTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          role="tab"
                          type="button"
                          aria-selected={active}
                          aria-disabled={disabled || undefined}
                          disabled={disabled}
                          onClick={() => setOtherTab(tab.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground'
                              : disabled
                                ? 'bg-secondary/40 text-muted-foreground/40 cursor-not-allowed'
                                : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      );
                    })}
                  </div>

                  {visibleOther.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {visibleOther.map((album, index) => (
                        <AlbumCard
                          key={album.id}
                          album={{ ...album, artist: { id: artist.id, name: artist.name } }}
                          index={
                            studioCount + epCount + collaborationCount + index
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-6">
                      No releases in this category.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Disc3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No releases found</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ArtistPage;
