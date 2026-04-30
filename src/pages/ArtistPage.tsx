import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Disc3, ExternalLink, User } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { AlbumCard } from '@/components/music/AlbumCard';
import { getArtist, getArtistAlbums, pickArtistImage, deezerRecordCategory, type DeezerArtist, type DeezerAlbum } from '@/lib/deezer';
import { getArtistTags } from '@/lib/lastfm';
import { resolveGenre } from '@/lib/genreMap';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';

const ArtistPage = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<DeezerArtist | null>(null);
  const [albums, setAlbums] = useState<DeezerAlbum[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoadingArtist, setIsLoadingArtist] = useState(true);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);
  const [activeOtherFilters, setActiveOtherFilters] = useState<Set<string>>(new Set());

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

  const groupedAlbums = useMemo(() => {
    const sortByYear = (items: DeezerAlbum[]) =>
      [...items].sort((a, b) => (a.release_date ?? '9999').localeCompare(b.release_date ?? '9999'));

    const albumsList = sortByYear(albums.filter(a => deezerRecordCategory(a.record_type) === 'Album'));
    const eps = sortByYear(albums.filter(a => deezerRecordCategory(a.record_type) === 'EP'));
    const others = sortByYear(albums.filter(a => {
      const cat = deezerRecordCategory(a.record_type);
      return cat !== 'Album' && cat !== 'EP';
    }));
    const otherTypes = Array.from(new Set(others.map(a => deezerRecordCategory(a.record_type))));

    return { albumsList, eps, others, otherTypes };
  }, [albums]);

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

  const { albumsList, eps, others, otherTypes } = groupedAlbums;
  const filteredOthers = activeOtherFilters.size === 0
    ? others
    : others.filter(a => activeOtherFilters.has(deezerRecordCategory(a.record_type)));

  const toggleFilter = (type: string) => {
    setActiveOtherFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const renderSection = (title: string, items: DeezerAlbum[], startIndex: number) =>
    items.length > 0 && (
      <div className="mb-12">
        <h3 className="text-xl font-semibold mb-5 text-muted-foreground">{title} ({items.length})</h3>
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
                const genre = resolveGenre(tags);
                return (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Link
                      to={`/genre/${encodeURIComponent(genre.toLowerCase())}`}
                      className="inline-flex"
                    >
                      <Badge
                        variant="secondary"
                        className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 cursor-pointer text-sm px-3 py-1"
                      >
                        {genre}
                      </Badge>
                    </Link>
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

          {isLoadingAlbums ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : albums.length > 0 ? (
            <>
              {renderSection('Albums', albumsList, 0)}
              {renderSection('EPs', eps, albumsList.length)}

              {others.length > 0 && (
                <div className="mb-12">
                  <h3 className="text-xl font-semibold mb-4 text-muted-foreground">
                    Other Releases ({filteredOthers.length})
                  </h3>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <button
                      onClick={() => setActiveOtherFilters(new Set())}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        activeOtherFilters.size === 0
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All
                    </button>
                    {otherTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => toggleFilter(type)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          activeOtherFilters.has(type)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredOthers.map((album, index) => (
                      <AlbumCard
                        key={album.id}
                        album={{ ...album, artist: { id: artist.id, name: artist.name } }}
                        index={albumsList.length + eps.length + index}
                      />
                    ))}
                  </div>
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
