import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music, Clock, Star } from 'lucide-react';
import { formatDuration } from '@/lib/musicbrainz';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Track {
  id: string;
  title: string;
  position: number;
  length?: number;
}

interface TrackListProps {
  tracks: Track[];
  albumMbid: string;
  onAlbumScoreChange?: (score: number | null) => void;
}

export function TrackList({ tracks, albumMbid, onAlbumScoreChange }: TrackListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trackRatings, setTrackRatings] = useState<Record<number, number>>({});
  const [hoverRatings, setHoverRatings] = useState<Record<number, number>>({});
  const [savingTrack, setSavingTrack] = useState<number | null>(null);

  // Fetch existing track ratings
  useEffect(() => {
    const fetchTrackRatings = async () => {
      if (!user || !albumMbid) return;

      const { data } = await supabase
        .from('track_ratings')
        .select('track_position, rating')
        .eq('user_id', user.id)
        .eq('album_mbid', albumMbid);

      if (data) {
        const ratingsMap: Record<number, number> = {};
        data.forEach((r: any) => {
          ratingsMap[r.track_position] = r.rating;
        });
        setTrackRatings(ratingsMap);
      }
    };

    fetchTrackRatings();
  }, [user, albumMbid]);

  // Compute and propagate album score
  useEffect(() => {
    const ratedValues = Object.values(trackRatings);
    if (ratedValues.length > 0 && ratedValues.length === tracks.length) {
      const avg = ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length;
      onAlbumScoreChange?.(parseFloat(avg.toFixed(1)));
    } else if (ratedValues.length > 0) {
      const avg = ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length;
      onAlbumScoreChange?.(parseFloat(avg.toFixed(1)));
    } else {
      onAlbumScoreChange?.(null);
    }
  }, [trackRatings, tracks.length, onAlbumScoreChange]);

  const handleRateTrack = async (track: Track, rating: number) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to rate tracks.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTrack(track.position);
    const prevRatings = { ...trackRatings };
    setTrackRatings(prev => ({ ...prev, [track.position]: rating }));

    try {
      const { error } = await supabase
        .from('track_ratings')
        .upsert({
          user_id: user.id,
          album_mbid: albumMbid,
          track_mbid: track.id || null,
          track_title: track.title,
          track_position: track.position,
          rating,
          rated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,album_mbid,track_position',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving track rating:', error);
      setTrackRatings(prevRatings);
      toast({
        title: 'Error',
        description: 'Failed to save track rating.',
        variant: 'destructive',
      });
    } finally {
      setSavingTrack(null);
    }
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
        <span>#</span>
        <span>Title</span>
        <span>Rating</span>
        <Clock className="w-4 h-4" />
      </div>
      
      {tracks.map((track, index) => {
        const currentRating = trackRatings[track.position] || 0;
        const currentHover = hoverRatings[track.position] || 0;
        const displayRating = currentHover || currentRating;

        return (
          <motion.div
            key={track.id || index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors group"
          >
            <span className="text-muted-foreground group-hover:text-primary transition-colors font-mono text-sm w-8">
              {track.position}
            </span>
            
            <div className="flex items-center gap-3 min-w-0">
              <Music className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="truncate group-hover:text-primary transition-colors">
                {track.title}
              </span>
            </div>

            {/* Inline star rating */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={savingTrack === track.position}
                  onClick={() => handleRateTrack(track, star)}
                  onMouseEnter={() => setHoverRatings(prev => ({ ...prev, [track.position]: star }))}
                  onMouseLeave={() => setHoverRatings(prev => ({ ...prev, [track.position]: 0 }))}
                  className={cn(
                    'transition-all duration-150',
                    savingTrack === track.position && 'opacity-50 cursor-wait'
                  )}
                >
                  <Star
                    className={cn(
                      'w-3.5 h-3.5 transition-colors duration-150',
                      star <= displayRating
                        ? 'fill-primary text-primary'
                        : 'fill-transparent text-muted-foreground/40 hover:text-muted-foreground'
                    )}
                  />
                </button>
              ))}
              <span className="ml-1.5 text-xs font-mono text-muted-foreground w-6 text-right">
                {currentRating > 0 ? currentRating : '–'}
              </span>
            </div>
            
            <span className="text-muted-foreground text-sm font-mono">
              {track.length ? formatDuration(track.length) : '--:--'}
            </span>
          </motion.div>
        );
      })}

      {/* Album Score Summary */}
      {Object.keys(trackRatings).length > 0 && (
        <div className="flex items-center justify-between px-4 py-4 mt-2 border-t border-border">
          <span className="text-sm font-semibold text-muted-foreground">
            Album Score ({Object.keys(trackRatings).length}/{tracks.length} tracks rated)
          </span>
          <span className="text-xl font-bold gradient-text">
            {(Object.values(trackRatings).reduce((a, b) => a + b, 0) / Object.values(trackRatings).length).toFixed(1)}/10
          </span>
        </div>
      )}
    </div>
  );
}
