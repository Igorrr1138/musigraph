import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Music, PlayCircle, Plus, Star } from "lucide-react";

import { TrackDetailsPanel } from "@/components/music/TrackDetailsPanel";
import { PlaylistPickerDialog } from "@/components/music/PlaylistPickerDialog";
import { VoiceAssistant } from "@/components/voice/VoiceAssistant";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/musicbrainz";
import { cn } from "@/lib/utils";

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

export function TrackList({
  tracks,
  albumMbid,
  artistName,
  albumTitle,
  onAlbumScoreChange,
}: TrackListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { playTrack: playYT, currentTrack: ytCurrentTrack } = useYouTubePlayer();
  const [trackRatings, setTrackRatings] = useState<Record<number, number>>({});
  const [hoverRatings, setHoverRatings] = useState<Record<number, number>>({});
  const [savingTrack, setSavingTrack] = useState<number | null>(null);
  const [expandedTrackPosition, setExpandedTrackPosition] = useState<number | null>(null);
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);

  useEffect(() => {
    const fetchTrackRatings = async () => {
      if (!user || !albumMbid) return;

      const { data } = await supabase
        .from("track_ratings")
        .select("track_position, rating")
        .eq("user_id", user.id)
        .eq("album_mbid", albumMbid);

      if (data) {
        const ratingsMap: Record<number, number> = {};
        data.forEach((rating) => {
          ratingsMap[rating.track_position] = rating.rating;
        });
        setTrackRatings(ratingsMap);
      }
    };

    void fetchTrackRatings();
  }, [albumMbid, user]);

  useEffect(() => {
    const ratedValues = Object.values(trackRatings);
    if (ratedValues.length > 0) {
      const average = ratedValues.reduce((sum, value) => sum + value, 0) / ratedValues.length;
      onAlbumScoreChange?.(Number(average.toFixed(1)));
    } else {
      onAlbumScoreChange?.(null);
    }
  }, [onAlbumScoreChange, trackRatings]);

  const handleRateTrack = useCallback(
    async (track: Track, rating: number) => {
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to rate tracks.",
          variant: "destructive",
        });
        return;
      }

      setSavingTrack(track.position);
      const previousRatings = { ...trackRatings };
      setTrackRatings((current) => ({ ...current, [track.position]: rating }));

      try {
        const { error } = await supabase.from("track_ratings").upsert(
          {
            user_id: user.id,
            album_mbid: albumMbid,
            album_title: albumTitle ?? null,
            artist_name: artistName ?? null,
            track_mbid: track.id || null,
            track_title: track.title,
            track_position: track.position,
            duration_ms: track.length ?? null,
            rating,
            rated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,album_mbid,track_position",
          },
        );

        if (error) throw error;
      } catch (error) {
        console.error("Error saving track rating:", error);
        setTrackRatings(previousRatings);
        toast({
          title: "Error",
          description: "Failed to save track rating.",
          variant: "destructive",
        });
      } finally {
        setSavingTrack(null);
      }
    },
    [albumMbid, albumTitle, artistName, toast, trackRatings, user],
  );

  const handlePlayTrack = useCallback(
    (track: Track) => {
      playYT(track, albumMbid, artistName, albumTitle, tracks);
    },
    [albumMbid, albumTitle, artistName, playYT, tracks],
  );

  const handleVoiceRating = useCallback(
    (rating: number) => {
      if (!ytCurrentTrack) return;
      const track = tracks.find((entry) => entry.position === ytCurrentTrack.position);
      if (!track) return;

      void handleRateTrack(track, rating);
      toast({
        title: `Rated "${track.title}"`,
        description: `${rating}/10`,
      });
    },
    [handleRateTrack, toast, tracks, ytCurrentTrack],
  );

  const toggleTrackDetails = (trackPosition: number) => {
    setExpandedTrackPosition((current) => (current === trackPosition ? null : trackPosition));
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] gap-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="w-8" />
            <span>#</span>
            <span>Title</span>
            <span>Actions</span>
            <span>Rating</span>
            <span className="inline-flex items-center justify-end">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <VoiceAssistant onRatingDetected={handleVoiceRating} />
        </div>

        {tracks.map((track, index) => {
          const currentRating = trackRatings[track.position] || 0;
          const currentHover = hoverRatings[track.position] || 0;
          const displayRating = currentHover || currentRating;
          const isCurrentlyPlaying =
            ytCurrentTrack?.position === track.position && ytCurrentTrack?.title === track.title;
          const isExpanded = expandedTrackPosition === track.position;

          return (
            <div
              key={track.id || index}
              className={cn(
                "rounded-2xl border border-border/50 bg-card/40 transition-colors",
                isExpanded && "border-primary/30 bg-primary/5",
              )}
            >
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
                className={cn(
                  "grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] gap-4 px-4 py-3 group",
                  isCurrentlyPlaying && "rounded-t-2xl bg-primary/10",
                )}
              >
                <button
                  type="button"
                  onClick={() => handlePlayTrack(track)}
                  className="flex w-8 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                >
                  <PlayCircle
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isCurrentlyPlaying && "fill-primary/20 text-primary",
                    )}
                  />
                </button>

                <span className="w-8 font-mono text-sm text-muted-foreground transition-colors group-hover:text-primary">
                  {track.position}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                  <Music className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  <span
                    className={cn(
                      "truncate transition-colors group-hover:text-primary",
                      isCurrentlyPlaying && "font-medium text-primary",
                    )}
                  >
                    {track.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full border-border/60 bg-background/40 px-3 text-xs"
                    onClick={() => toggleTrackDetails(track.position)}
                  >
                    Details
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full border-border/60 bg-background/40"
                    onClick={() => setPlaylistTrack(track)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      key={star}
                      type="button"
                      disabled={savingTrack === track.position}
                      onClick={() => void handleRateTrack(track, star)}
                      onMouseEnter={() =>
                        setHoverRatings((current) => ({ ...current, [track.position]: star }))
                      }
                      onMouseLeave={() =>
                        setHoverRatings((current) => ({ ...current, [track.position]: 0 }))
                      }
                      className={cn(
                        "transition-all duration-150",
                        savingTrack === track.position && "cursor-wait opacity-50",
                      )}
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5 transition-colors duration-150",
                          star <= displayRating
                            ? "fill-primary text-primary"
                            : "fill-transparent text-muted-foreground/40 hover:text-muted-foreground",
                        )}
                      />
                    </button>
                  ))}
                  <span className="ml-1.5 w-6 text-right font-mono text-xs text-muted-foreground">
                    {currentRating > 0 ? currentRating : "–"}
                  </span>
                </div>

                <span className="text-right font-mono text-sm text-muted-foreground">
                  {track.length ? formatDuration(track.length) : "--:--"}
                </span>
              </motion.div>

              {isExpanded ? (
                <div className="px-4 pb-4">
                  <TrackDetailsPanel
                    track={track}
                    albumMbid={albumMbid}
                    artistName={artistName}
                    albumTitle={albumTitle}
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        {Object.keys(trackRatings).length > 0 ? (
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 py-4">
            <span className="text-sm font-semibold text-muted-foreground">
              Album Score ({Object.keys(trackRatings).length}/{tracks.length} tracks rated)
            </span>
            <span className="gradient-text text-xl font-bold">
              {(
                Object.values(trackRatings).reduce((sum, value) => sum + value, 0) /
                Object.values(trackRatings).length
              ).toFixed(1)}
              /10
            </span>
          </div>
        ) : null}
      </div>

      <PlaylistPickerDialog
        open={Boolean(playlistTrack)}
        onOpenChange={(open) => {
          if (!open) setPlaylistTrack(null);
        }}
        track={
          playlistTrack
            ? {
                trackMbid: playlistTrack.id || null,
                trackTitle: playlistTrack.title,
                trackPosition: playlistTrack.position,
                albumMbid,
                albumTitle: albumTitle ?? null,
                artistName: artistName ?? null,
                durationMs: playlistTrack.length ?? null,
              }
            : null
        }
      />
    </>
  );
}
