import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Disc3, ExternalLink, User } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { AlbumCard } from '@/components/music/AlbumCard';
import { getArtist, getArtistReleaseGroups, type MusicBrainzArtist, type MusicBrainzReleaseGroup } from '@/lib/musicbrainz';
import { Skeleton } from '@/components/ui/skeleton';

const ArtistPage = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<MusicBrainzArtist | null>(null);
  const [albums, setAlbums] = useState<MusicBrainzReleaseGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOtherFilters, setActiveOtherFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        const [artistData, albumsData] = await Promise.all([
          getArtist(id),
          getArtistReleaseGroups(id, 50),
        ]);

        setArtist(artistData);
        setAlbums(albumsData);
      } catch (error) {
        console.error('Error fetching artist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (isLoading) {
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

  const lifeSpan = artist['life-span'];
  const yearsActive = lifeSpan?.begin
    ? `${lifeSpan.begin.split('-')[0]} - ${lifeSpan.ended ? lifeSpan.end?.split('-')[0] : 'Present'}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container mx-auto max-w-6xl relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to search
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-48 h-48 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 gradient-border overflow-hidden"
            >
              <User className="w-20 h-20 text-muted-foreground" />
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1"
            >
              {artist.type && (
                <span className="inline-block px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground mb-4">
                  {artist.type}
                </span>
              )}

              <h1 className="text-4xl md:text-5xl font-bold mb-4">{artist.name}</h1>

              {artist.disambiguation && (
                <p className="text-lg text-muted-foreground mb-4">
                  {artist.disambiguation}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                {artist.country && (
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {artist.country}
                  </span>
                )}
                {yearsActive && (
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {yearsActive}
                  </span>
                )}
                {albums.length > 0 && (
                  <span className="flex items-center gap-2">
                    <Disc3 className="w-4 h-4" />
                    {albums.length} albums
                  </span>
                )}
              </div>

              <a
                href={`https://musicbrainz.org/artist/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-primary hover:underline"
              >
                View on MusicBrainz
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Discography */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold mb-8">Discography</h2>

          {albums.length > 0 ? (
            <>
              {(() => {
                const sortByYear = (items: typeof albums) =>
                  [...items].sort((a, b) => {
                    const yearA = a['first-release-date']?.split('-')[0] || '9999';
                    const yearB = b['first-release-date']?.split('-')[0] || '9999';
                    return yearA.localeCompare(yearB);
                  });

                // Official albums: primary type Album with no secondary types (excludes live, compilations, etc.)
                const officialAlbums = sortByYear(
                  albums.filter(a => a['primary-type'] === 'Album' && (!a['secondary-types'] || a['secondary-types'].length === 0))
                );
                const eps = sortByYear(albums.filter(a => a['primary-type'] === 'EP'));
                const others = sortByYear(
                  albums.filter(a => {
                    if (a['primary-type'] === 'EP') return false;
                    if (a['primary-type'] === 'Album' && (!a['secondary-types'] || a['secondary-types'].length === 0)) return false;
                    return true;
                  })
                );

                // Extract unique types from "others"
                const otherTypes = [...new Set(others.map(a => a['primary-type'] || 'Unknown'))];

                const filteredOthers = activeOtherFilters.size === 0
                  ? others
                  : others.filter(a => activeOtherFilters.has(a['primary-type'] || 'Unknown'));

                const toggleFilter = (type: string) => {
                  setActiveOtherFilters(prev => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    return next;
                  });
                };

                const renderSection = (title: string, items: typeof albums, startIndex: number) =>
                  items.length > 0 && (
                    <div className="mb-12">
                      <h3 className="text-xl font-semibold mb-5 text-muted-foreground">{title} ({items.length})</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {items.map((album, index) => (
                          <AlbumCard
                            key={album.id}
                            album={{
                              id: album.id,
                              title: album.title,
                              artistName: artist.name,
                              releaseDate: album['first-release-date'],
                              type: album['primary-type'],
                            }}
                            index={startIndex + index}
                          />
                        ))}
                      </div>
                    </div>
                  );

                return (
                  <>
                    {renderSection('Albums', officialAlbums, 0)}
                    {renderSection('EPs', eps, officialAlbums.length)}

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
                              album={{
                                id: album.id,
                                title: album.title,
                                artistName: artist.name,
                                releaseDate: album['first-release-date'],
                                type: album['primary-type'],
                              }}
                              index={officialAlbums.length + eps.length + index}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
