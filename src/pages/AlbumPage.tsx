import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Disc3, ExternalLink, Music, Clock } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { RatingStars } from '@/components/music/RatingStars';
import { TrackList } from '@/components/music/TrackList';
import { getReleaseGroupReleases, getRelease, getCoverArtUrl, type MusicBrainzRelease } from '@/lib/musicbrainz';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const AlbumPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [release, setRelease] = useState<MusicBrainzRelease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [isSavingRating, setIsSavingRating] = useState(false);

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

  // Fetch user's rating
  useEffect(() => {
    const fetchRating = async () => {
      if (!user || !id) return;

      const { data } = await supabase
        .from('album_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('album_mbid', id)
        .maybeSingle();

      if (data) {
        setUserRating(data.rating);
      }
    };

    fetchRating();
  }, [user, id]);

  const handleRate = async (rating: number) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to rate albums.',
        variant: 'destructive',
      });
      return;
    }

    if (!id || !release) return;

    setIsSavingRating(true);
    setUserRating(rating);

    try {
      const artistName = release['artist-credit']?.[0]?.artist.name;
      const coverUrl = getCoverArtUrl(id, '500');

      const { error } = await supabase
        .from('album_ratings')
        .upsert({
          user_id: user.id,
          album_mbid: id,
          album_title: release.title,
          artist_name: artistName,
          cover_url: coverUrl,
          rating,
          rated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,album_mbid',
        });

      if (error) throw error;

      toast({
        title: 'Rating saved!',
        description: `You rated "${release.title}" ${rating}/10`,
      });
    } catch (error) {
      console.error('Error saving rating:', error);
      toast({
        title: 'Error',
        description: 'Failed to save rating. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingRating(false);
    }
  };

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
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to search
          </Link>

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

              {/* Rating */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-3">Your Rating</h3>
                <RatingStars
                  rating={userRating}
                  onRate={handleRate}
                  readonly={isSavingRating}
                  size="lg"
                />
                {!user && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <Link to="/auth" className="text-primary hover:underline">
                      Sign in
                    </Link>{' '}
                    to save your ratings
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
              <TrackList tracks={tracks} albumMbid={id!} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default AlbumPage;
