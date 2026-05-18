import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Disc3, ArrowRight, User, TrendingUp, Music } from 'lucide-react';

import { RatingSparkline } from '@/components/charts/brand-charts';
import { useArtistImage } from '@/hooks/useArtistImage';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Rating {
  id: string;
  album_deezer_id: string;
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

export function RatedMusicTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const artists = useMemo<ArtistSummary[]>(() => {
    const map = new Map<string, ArtistSummary>();
    ratings.forEach((rating) => {
      const name = rating.artist_name || 'Unknown Artist';
      const existing = map.get(name);
      if (existing) {
        existing.albumCount += 1;
        existing.ratings.push(rating.rating);
        existing.avgRating =
          existing.ratings.reduce((sum, value) => sum + value, 0) / existing.ratings.length;
        if (!existing.latestCover && rating.cover_url) existing.latestCover = rating.cover_url;
      } else {
        map.set(name, {
          name,
          albumCount: 1,
          avgRating: rating.rating,
          ratings: [rating.rating],
          latestCover: rating.cover_url,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.albumCount - a.albumCount);
  }, [ratings]);

  const totalAlbums = ratings.length;
  const overallAvg =
    totalAlbums > 0
      ? (ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalAlbums).toFixed(1)
      : '0';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-boldonse mb-3">Rated music</h1>
        <p className="text-muted-foreground">
          {artists.length} artists • {totalAlbums} albums rated • Average: {overallAvg}/10
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Disc3 className="w-12 h-12 text-primary animate-spin" />
        </div>
      ) : artists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {artists.map((artist, index) => (
            <ArtistCard key={artist.name} artist={artist} index={index} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 rounded-2xl border border-border/40 bg-card/40">
          <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No ratings yet</h3>
          <p className="text-muted-foreground mb-6">
            Start exploring and rating your favorite albums
          </p>
          <Link
            to="/"
            className="inline-block rounded-xl gradient-bg text-primary-foreground px-5 py-2.5 text-sm font-medium"
          >
            Discover Music
          </Link>
        </div>
      )}
    </div>
  );
}

function ArtistCard({ artist, index }: { artist: ArtistSummary; index: number }) {
  const { imageUrl } = useArtistImage(artist.name);
  const sparkline = artist.ratings;
  const trendDelta = sparkline.length > 1 ? sparkline[sparkline.length - 1] - sparkline[0] : 0;
  const trendLabel =
    trendDelta === 0 ? 'flat' : `${trendDelta > 0 ? '+' : ''}${trendDelta.toFixed(1)}`;
  const trendTone = trendDelta >= 0 ? 'text-primary' : 'text-accent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link
        to={`/dashboard/rated-music/${encodeURIComponent(artist.name)}`}
        className="group block bg-card rounded-2xl border border-border/50 p-5 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt={artist.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

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
          </div>

          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
        </div>

        {sparkline.length > 1 && (
          <div className="mt-4 w-full rounded-2xl border border-border/40 bg-background/40 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                Rating Flow
              </div>
              <p className={`text-xs font-medium ${trendTone}`}>{trendLabel}</p>
            </div>
            <RatingSparkline values={sparkline} width={288} className="mt-3 h-12 w-full" />
          </div>
        )}
      </Link>
    </motion.div>
  );
}
