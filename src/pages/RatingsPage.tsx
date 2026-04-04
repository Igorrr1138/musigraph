import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Disc3, ArrowRight, User, TrendingUp, Music } from 'lucide-react';
import { useArtistImage } from '@/hooks/useArtistImage';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Rating {
  id: string;
  album_mbid: string;
  album_title: string;
  artist_name: string | null;
  cover_url: string | null;
  rating: number;
  rated_at: string;
}

interface ArtistSummary {
  name: string;
  albumCount: number;
  avgRating: number;
  ratings: number[];
  latestCover: string | null;
}

const RatingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchRatings = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('album_ratings')
          .select('*')
          .eq('user_id', user.id)
          .order('rated_at', { ascending: false });
        if (error) throw error;
        setRatings(data || []);
      } catch (error) {
        console.error('Error fetching ratings:', error);
        toast({ title: 'Error', description: 'Failed to load ratings.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    if (user) fetchRatings();
  }, [user, toast]);

  // Group by artist
  const artists = useMemo<ArtistSummary[]>(() => {
    const map = new Map<string, ArtistSummary>();
    ratings.forEach(r => {
      const name = r.artist_name || 'Unknown Artist';
      const existing = map.get(name);
      if (existing) {
        existing.albumCount++;
        existing.ratings.push(r.rating);
        existing.avgRating = existing.ratings.reduce((a, b) => a + b, 0) / existing.ratings.length;
        if (!existing.latestCover && r.cover_url) existing.latestCover = r.cover_url;
      } else {
        map.set(name, {
          name,
          albumCount: 1,
          avgRating: r.rating,
          ratings: [r.rating],
          latestCover: r.cover_url,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.albumCount - a.albumCount);
  }, [ratings]);

  const totalAlbums = ratings.length;
  const overallAvg = totalAlbums > 0
    ? (ratings.reduce((s, r) => s + r.rating, 0) / totalAlbums).toFixed(1)
    : '0';

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="pt-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            ← Back to search
          </Link>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Ratings Center</h1>
              <p className="text-muted-foreground">
                {artists.length} artists • {totalAlbums} albums rated • Average: {overallAvg}/10
              </p>
            </div>
            {ratings.length > 0 && (
              <div className="flex gap-3">
                <Link to="/graph">
                  <Button variant="outline">Rating Timeline</Button>
                </Link>
                <Link to="/discography-map">
                  <Button className="gradient-bg text-primary-foreground border-0">Discography Map</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Artist Cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Disc3 className="w-12 h-12 text-primary animate-spin" />
            </div>
          ) : artists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artists.map((artist, index) => (
                <ArtistCard key={artist.name} artist={artist} index={index} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No ratings yet</h3>
              <p className="text-muted-foreground mb-6">
                Start exploring and rating your favorite albums
              </p>
              <Link to="/">
                <Button className="gradient-bg text-primary-foreground border-0">Discover Music</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ArtistCard({ artist, index }: { artist: ArtistSummary; index: number }) {
  const { imageUrl } = useArtistImage(artist.name);

  // Mini sparkline data
  const sparkline = artist.ratings;
  const sparkMax = 10;
  const sparkWidth = 100;
  const sparkHeight = 32;
  const points = sparkline.map((v, i) => {
    const x = sparkline.length === 1 ? sparkWidth / 2 : (i / (sparkline.length - 1)) * sparkWidth;
    const y = sparkHeight - (v / sparkMax) * sparkHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link
        to={`/ratings/artist/${encodeURIComponent(artist.name)}`}
        className="group block bg-card rounded-2xl border border-border/50 p-5 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5"
      >
        <div className="flex items-start gap-4">
          {/* Artist Image */}
          <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
            {!imageError ? (
              <img
                src={imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
              {artist.name}
            </h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Music className="w-3.5 h-3.5" />
                {artist.albumCount} album{artist.albumCount > 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                {artist.avgRating.toFixed(1)}
              </span>
            </div>

            {/* Mini sparkline */}
            {sparkline.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <svg width={sparkWidth} height={sparkHeight} className="overflow-visible">
                  <polyline
                    fill="none"
                    stroke="hsl(174, 72%, 56%)"
                    strokeWidth="2"
                    points={points}
                  />
                </svg>
              </div>
            )}
          </div>

          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
        </div>
      </Link>
    </motion.div>
  );
}

export default RatingsPage;
