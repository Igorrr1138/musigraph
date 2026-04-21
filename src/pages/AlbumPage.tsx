import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Disc3, ExternalLink, Music } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { TrackList } from '@/components/music/TrackList';
import { getReleaseGroupReleases, getRelease, getCoverArtUrl, type MusicBrainzRelease } from '@/lib/musicbrainz';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';

const AlbumPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [release, setRelease] = useState<MusicBrainzRelease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        // Get releases for this release group
        const releases = await getReleaseGroupReleases(id);
        
        if (releases.length > 0) {
          // Get detailed info for the first release
          const releaseDetails = await getRelease(releases[0].id);
          setRelease(releaseDetails);
        }
      } catch (error) {
        console.error('Error fetching album:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Fetch existing album score
  useEffect(() => {
    const fetchRating = async () => {
      if (!user || !id) return;
      const { data } = await supabase
        .from('album_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('album_mbid', id)
        .maybeSingle();
      if (data) setUserRating(data.rating);
    };
    fetchRating();
  }, [user, id]);

  // Debounced album_ratings upsert — coalesces rapid track rating changes
  const albumWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAlbumScoreChange = useCallback((score: number | null) => {
    if (!user || !id || !release || score === null) {
      if (score === null) setUserRating(0);
      return;
    }

    const roundedScore = Math.round(score * 10) / 10;
    setUserRating(roundedScore);

    if (albumWriteTimer.current) clearTimeout(albumWriteTimer.current);
    albumWriteTimer.current = setTimeout(() => {
      const artistName = release['artist-credit']?.[0]?.artist.name;
      const coverUrl = getCoverArtUrl(id, '500');

      // Fire-and-forget — no select(), no await
      supabase
        .from('album_ratings')
        .upsert({
          user_id: user.id,
          album_mbid: id,
          album_title: release.title,
          artist_name: artistName,
          cover_url: coverUrl,
          rating: Math.round(roundedScore),
          rated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,album_mbid',
        })
        .then(({ error }) => {
          if (error) console.error('Error saving album score:', error);
        });
    }, 600);
  }, [user, id, release]);

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

  if (!release) {
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

  const artistName = release['artist-credit']?.[0]?.artist.name;
  const artistId = release['artist-credit']?.[0]?.artist.id;
  const tracks = release.media?.[0]?.tracks || [];
  const coverUrl = id ? getCoverArtUrl(id, '500') : '';

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
                <BreadcrumbPage>{release.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Cover Art */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-72 h-72 rounded-2xl bg-secondary flex-shrink-0 overflow-hidden glow-primary"
            >
              {!imageError ? (
                <img
                  src={coverUrl}
                  alt={release.title}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc3 className="w-24 h-24 text-muted-foreground animate-float" />
                </div>
              )}
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1"
            >
              {release['release-group']?.['primary-type'] && (
                <span className="inline-block px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground mb-4">
                  {release['release-group']['primary-type']}
                </span>
              )}

              <h1 className="text-4xl md:text-5xl font-bold mb-2">{release.title}</h1>

              {artistName && (
                <Link
                  to={`/artist/${artistId}`}
                  className="text-xl text-muted-foreground hover:text-primary transition-colors"
                >
                  {artistName}
                </Link>
              )}

              <div className="flex flex-wrap items-center gap-4 mt-4 text-muted-foreground">
                {release.date && (
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {release.date}
                  </span>
                )}
                {tracks.length > 0 && (
                  <span className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    {tracks.length} tracks
                  </span>
                )}
              </div>

              {/* Album Score (computed from track ratings) */}
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
                href={`https://musicbrainz.org/release/${release.id}`}
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

      {/* Track List */}
      {tracks.length > 0 && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold mb-6">Tracks</h2>
            <div className="bg-card/50 rounded-2xl border border-border/50 p-4">
              <TrackList tracks={tracks} albumMbid={id!} artistName={artistName} albumTitle={release.title} onAlbumScoreChange={handleAlbumScoreChange} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default AlbumPage;
