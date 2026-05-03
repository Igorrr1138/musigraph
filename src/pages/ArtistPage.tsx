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
import { buildDiscography, type ClassifiedAlbum } from '@/lib/discography';
import { getArtistTags } from '@/lib/lastfm';
import { resolveGenres } from '@/lib/genreMap';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

const ArtistPage = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<DeezerArtist | null>(null);
  const [albums, setAlbums] = useState<DeezerAlbum[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoadingArtist, setIsLoadingArtist] = useState(true);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);
  const [showExtras, setShowExtras] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    setIsLoadingArtist(true);
    setIsLoadingAlbums(true);
    setArtist(null);
    setAlbums([]);
    setTags([]);

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
   *   • dedup Deluxe/Remastered/Anniversary into the original
   *   • classify by record_type + primary-artist check
   *   • sort every bucket oldest → newest
   */
  const discography = useMemo(
    () => (artist ? buildDiscography(albums, artist.id) : null),
    [albums, artist],
  );

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
  const singleCount        = discography?.singles.length             ?? 0;
  const collaborationCount = discography?.collaborations.length      ?? 0;
  const liveCount          = discography?.live.length                ?? 0;
  const compilationCount   = discography?.compilations.length        ?? 0;

  const hasAnyRelease =
    studioCount + epCount + singleCount + collaborationCount + liveCount + compilationCount > 0;

  const extrasTotal = liveCount + compilationCount;

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
              {renderSection('Singles', discography.singles, studioCount + epCount)}
              {renderSection(
                'Collaborations',
                discography.collaborations,
                studioCount + epCount + singleCount,
              )}

              {extrasTotal > 0 && (
                <div className="mb-12">
                  <div className="flex items-center justify-between gap-4 mb-6 rounded-2xl border border-border/50 bg-card/40 px-5 py-4">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        Live & Compilations
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {extrasTotal} extra release{extrasTotal === 1 ? '' : 's'} hidden by default.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
                      <span>Show extras</span>
                      <Switch
                        checked={showExtras}
                        onCheckedChange={setShowExtras}
                        aria-label="Show live and compilation releases"
                      />
                    </div>
                  </div>

                  {showExtras && (
                    <>
                      {renderSection(
                        'Live Albums',
                        discography.live,
                        studioCount + epCount + singleCount + collaborationCount,
                      )}
                      {renderSection(
                        'Compilations',
                        discography.compilations,
                        studioCount + epCount + singleCount + collaborationCount + liveCount,
                      )}
                    </>
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
