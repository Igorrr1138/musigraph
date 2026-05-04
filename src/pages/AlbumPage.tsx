import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Disc3, ExternalLink, Music } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { TrackList } from '@/components/music/TrackList';
import { getAlbum, getArtistAlbums, pickAlbumCover, type DeezerAlbum, type DeezerTrack } from '@/lib/deezer';
import { resolveOriginalAlbumId, filterTrackList, looksLikeVariant } from '@/lib/discography';
import { getArtistTags } from '@/lib/lastfm';
import { resolveGenres } from '@/lib/genreMap';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';

const AlbumPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [album, setAlbum] = useState<DeezerAlbum | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [tags, setTags] = useState<string[]>([]);

  /**
   * Album_id used for music_cache rating writes/reads.
   *
   * If the user lands on "Album (Deluxe Edition)" we want their rating to
   * attach to the original release in `album_ratings` so the score survives
   * the studio-album de-duplication on the artist page. Going-forward only:
   * we don't migrate existing rows.
   *
   * Defaults to the displayed album's id; overwritten with the original's id
   * once we have the artist's album list.
   */
  const [originalAlbumId, setOriginalAlbumId] = useState<string | null>(null);

  useEffect(() => {
    if (!album?.artist?.id || !album?.artist?.name) return;
    let cancelled = false;
    getArtistTags(String(album.artist.id), album.artist.name).then(t => {
      if (!cancelled) setTags(t);
    });
    return () => { cancelled = true; };
  }, [album?.artist?.id, album?.artist?.name]);

  // Resolve the original album_id (collapses Deluxe / Remastered / Anniversary
  // variants into the earliest-released version of the same title) so the
  // album_ratings upsert writes against the original.
  useEffect(() => {
    if (!album?.artist?.id) {
      setOriginalAlbumId(null);
      return;
    }
    let cancelled = false;
    getArtistAlbums(String(album.artist.id), 100).then(artistAlbums => {
      if (cancelled) return;
      setOriginalAlbumId(resolveOriginalAlbumId(album, artistAlbums));
    });
    return () => { cancelled = true; };
  }, [album]);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getAlbum(id)
      .then(setAlbum)
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    const fetchRating = async () => {
      if (!user || !id) return;

      // Prefer the rating attached to the original release, but fall back to
      // the displayed album's id so legacy rows (rated on the Deluxe before
      // this refactor) continue to show up.
      const lookupId = originalAlbumId ?? id;

      const { data } = await supabase
        .from('album_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('album_deezer_id', lookupId)
        .maybeSingle();

      if (data) {
        setUserRating(data.rating);
        return;
      }

      if (originalAlbumId && originalAlbumId !== id) {
        const { data: legacy } = await supabase
          .from('album_ratings')
          .select('rating')
          .eq('user_id', user.id)
          .eq('album_deezer_id', id)
          .maybeSingle();
        if (legacy) setUserRating(legacy.rating);
      }
    };
    fetchRating();
  }, [user, id, originalAlbumId]);

  const albumWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAlbumScoreChange = useCallback((score: number | null) => {
    if (!user || !id || !album || score === null) {
      if (score === null) setUserRating(0);
      return;
    }

    const roundedScore = Math.round(score * 10) / 10;
    setUserRating(roundedScore);

    if (albumWriteTimer.current) clearTimeout(albumWriteTimer.current);
    albumWriteTimer.current = setTimeout(() => {
      const artistName = album.artist?.name;
      const coverUrl = pickAlbumCover(album);

      // Always write to the original release id so the rating attaches to
      // the de-duplicated version surfaced on the artist page.
      const writeAlbumId = originalAlbumId ?? id;

      supabase
        .from('album_ratings')
        .upsert({
          user_id: user.id,
          album_deezer_id: writeAlbumId,
          artist_deezer_id: album.artist?.id ? String(album.artist.id) : null,
          album_title: album.title,
          artist_name: artistName,
          cover_url: coverUrl,
          rating: Math.round(roundedScore),
          rated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,album_deezer_id',
        })
        .then(({ error }) => {
          if (error) console.error('Error saving album score:', error);
        });
    }, 600);
  }, [user, id, album, originalAlbumId]);

  useEffect(() => () => {
    if (albumWriteTimer.current) clearTimeout(albumWriteTimer.current);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 px-4">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-8 w-32 mb-8" />
            <div className="flex flex-col md:flex-row gap-8">
              <Skeleton className="w-72 h-72 rounded-2xl" />
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

  if (!album) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Album not found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const artistName = album.artist?.name;
  const artistId = album.artist?.id;

  // Filter out bonus/live/demo/remix tracks for the core tracklist experience.
  // isDeluxe=true triggers strict position-gap trim in addition to keyword filter.
  const isDeluxe = looksLikeVariant(album.title ?? '');
  const rawTracks: DeezerTrack[] = album.tracks?.data ?? [];
  const tracks = filterTrackList(rawTracks, isDeluxe);

  const coverUrl = pickAlbumCover(album);

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
              {artistId && artistName && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`/artist/${artistId}`}>{artistName}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{album.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-72 h-72 rounded-2xl bg-secondary flex-shrink-0 overflow-hidden glow-primary"
            >
              {coverUrl && !imageError ? (
                <img
                  src={coverUrl}
                  alt={album.title}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc3 className="w-24 h-24 text-muted-foreground animate-float" />
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1"
            >
              {album.record_type && (
                <span className="inline-block px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground mb-4 capitalize">
                  {album.record_type}
                </span>
              )}

              <h1 className="text-4xl md:text-5xl font-bold mb-2">{album.title}</h1>

              {artistName && artistId && (
                <Link
                  to={`/artist/${artistId}`}
                  className="text-xl text-muted-foreground hover:text-primary transition-colors"
                >
                  {artistName}
                </Link>
              )}

              {tags.length > 0 && (() => {
                const genres = resolveGenres(tags, 5, album.artist?.name);
                return (
                  <div className="flex flex-wrap gap-2 mt-3">
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

              <div className="flex flex-wrap items-center gap-4 mt-4 text-muted-foreground">
                {album.release_date && (
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {album.release_date}
                  </span>
                )}
                {tracks.length > 0 && (
                  <span className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    {tracks.length} track{tracks.length !== 1 ? 's' : ''}
                    {rawTracks.length !== tracks.length && (
                      <span className="text-xs opacity-60">
                        ({rawTracks.length - tracks.length} bonus filtered)
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-2">Album Score</h3>
                {userRating > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold gradient-text">{userRating}/10</span>
                    <span className="text-sm text-muted-foreground">avg of your track ratings</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {user ? (
                      'Rate individual tracks below to generate your album score'
                    ) : (
                      <>
                        <Link to="/auth" className="text-primary hover:underline">Sign in</Link>{' '}
                        to rate tracks and build your discography map
                      </>
                    )}
                  </p>
                )}
              </div>

              <a
                href={`https://www.deezer.com/album/${album.id}`}
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

      {tracks.length > 0 && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold mb-6">Tracks</h2>
            <div className="bg-card/50 rounded-2xl border border-border/50 p-4">
              <TrackList
                tracks={tracks}
                albumDeezerId={String(id)}
                artistName={artistName}
                albumTitle={album.title}
                onAlbumScoreChange={handleAlbumScoreChange}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default AlbumPage;
