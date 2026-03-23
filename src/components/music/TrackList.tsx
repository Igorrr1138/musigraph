import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Music, Clock, Star, PlayCircle } from 'lucide-react';
import { formatDuration } from '@/lib/musicbrainz';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';

interface Track {
  id: string;
  title: string;
  position: number;
  length?: number;
}

interface TrackListProps {
  tracks: Track[];
  albumMbid: string;
  artistName?: string;
  albumTitle?: string;
  onAlbumScoreChange?: (score: number | null) => void;
}

export function TrackList({ tracks, albumMbid, artistName, albumTitle, onAlbumScoreChange }: TrackListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { playTrack: playYT, currentTrack: ytCurrentTrack } = useYouTubePlayer();
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
    if (ratedValues.length > 0) {
      const avg = ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length;
      onAlbumScoreChange?.(parseFloat(avg.toFixed(1)));
    } else {
      onAlbumScoreChange?.(null);
    }
  }, [trackRatings, tracks.length, onAlbumScoreChange]);

  const handleRateTrack = useCallback(async (track: Track, rating: number) => {
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
  }, [user, albumMbid, trackRatings, toast]);

  const handlePlayTrack = useCallback((track: Track) => {
    playYT(track, albumMbid, artistName, albumTitle, tracks);
  }, [playYT, albumMbid, artistName, albumTitle, tracks]);

  // Voice rating: rate the currently playing track
  const handleVoiceRating = useCallback((rating: number) => {
    if (!ytCurrentTrack) return;
    const track = tracks.find(t => t.position === ytCurrentTrack.position);
    if (track) {
      handleRateTrack(track, rating);
      toast({ title: `Rated "${track.title}"`, description: `${rating}/10` });
    }
  }, [ytCurrentTrack, tracks, handleRateTrack, toast]);

  return (
    <div className="space-y-1">
      {/* Voice Assistant */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-4 text-xs text-muted-foreground uppercase tracking-wider">
          <span className="w-8"></span>
          <span>#</span>
          <span>Title</span>
          <span>Rating</span>
          <Clock className="w-4 h-4" />
        </div>
        <VoiceAssistant onRatingDetected={handleVoiceRating} />
      </div>
      
      {tracks.map((track, index) => {
        const currentRating = trackRatings[track.position] || 0;
        const currentHover = hoverRatings[track.position] || 0;
        const displayRating = currentHover || currentRating;
        const isCurrentlyPlaying = ytCurrentTrack?.position === track.position && ytCurrentTrack?.title === track.title;

        return (
          <motion.div
            key={track.id || index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            className={cn(
              "grid grid-cols-[auto_auto_1fr_auto_auto] gap-4 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors group",
              isCurrentlyPlaying && "bg-primary/10 border border-primary/20"
            )}
          >
            {/* Play button */}
            <button
              onClick={() => handlePlayTrack(track)}
              className="flex items-center justify-center w-8 text-muted-foreground hover:text-primary transition-colors"
            >
              <PlayCircle className={cn(
                "w-5 h-5 transition-colors",
                isCurrentlyPlaying && "text-primary fill-primary/20"
              )} />
            </button>

            <span className="text-muted-foreground group-hover:text-primary transition-colors font-mono text-sm w-8">
              {track.position}
            </span>
            
            <div className="flex items-center gap-3 min-w-0">
              <Music className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className={cn(
                "truncate group-hover:text-primary transition-colors",
                isCurrentlyPlaying && "text-primary font-medium"
              )}>
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
