import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Volume1,
  Shuffle,
  Repeat,
  Repeat1,
  Mic,
  MicOff,
  Image as ImageIcon,
  Star,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { cn } from "@/lib/utils";
import { cleanTrackTitle } from "@/lib/cleanMetadata";
import { AddToPlaylistButton } from "@/components/music/AddToPlaylistButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DeezerTrack } from "@/lib/deezer";
import { findArtistMbid, coverArtArchiveReleaseGroupUrl } from "@/lib/musicbrainz";
import { emitTrackRating, onTrackRating } from "@/lib/ratingEvents";

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function PlaybackBar() {
  const {
    isPlaying,
    currentTrack,
    currentAlbumMbid,
    artistName,
    albumTitle,
    togglePlay,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    currentTime,
    duration,
    seekTo,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
  } = useYouTubePlayer();

  const { user } = useAuth();
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const preDuckVolumeRef = useRef<number | null>(null);
  const [artistMbid, setArtistMbid] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverError, setCoverError] = useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [cursorY, setCursorY] = useState<number | null>(null);
  const ratingBarRef = useRef<HTMLDivElement | null>(null);
  const ratingContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch user's rating for the current track
  useEffect(() => {
    if (!user || !currentTrack || !currentAlbumMbid) {
      setRating(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("track_ratings")
      .select("rating")
      .eq("user_id", user.id)
      .eq("album_deezer_id", currentAlbumMbid)
      .eq("track_position", currentTrack.position)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRating(data?.rating ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, currentTrack, currentAlbumMbid]);

  useEffect(() => {
    return onTrackRating(({ albumId, trackPosition, rating: r }) => {
      if (!currentTrack || !currentAlbumMbid) return;
      if (albumId === currentAlbumMbid && trackPosition === currentTrack.position) {
        setRating((prev) => (prev === r ? prev : r));
      }
    });
  }, [currentTrack, currentAlbumMbid]);

  // Resolve the artist MBID from MusicBrainz so the playback bar can link
  // back to the artist and album pages.
  useEffect(() => {
    setArtistMbid(null);
    if (!artistName) return;
    let cancelled = false;
    findArtistMbid("", artistName).then((mbid) => {
      if (!cancelled) setArtistMbid(mbid);
    });
    return () => {
      cancelled = true;
    };
  }, [artistName, currentAlbumMbid]);

  // Derive the album cover from the current release-group MBID.
  useEffect(() => {
    setCoverError(false);
    if (!currentAlbumMbid) {
      setCoverUrl(null);
      return;
    }
    setCoverUrl(coverArtArchiveReleaseGroupUrl(currentAlbumMbid, 250));
  }, [currentAlbumMbid]);

  const computeRatingFromEvent = useCallback((clientY: number): number => {
    const el = ratingBarRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height));
    return Math.max(1, Math.min(10, Math.round(ratio * 10) || 1));
  }, []);

  const saveRating = useCallback(
    async (value: number) => {
      if (!user) {
        toast({ title: "Sign in to rate tracks", variant: "destructive" });
        return;
      }
      if (!currentTrack || !currentAlbumMbid) return;
      const prev = rating;
      setRating(value);
      emitTrackRating({ albumId: currentAlbumMbid, trackPosition: currentTrack.position, rating: value });
      const { error } = await supabase.from("track_ratings").upsert(
        {
          user_id: user.id,
          album_deezer_id: currentAlbumMbid,
          track_deezer_id: currentTrack.id ? String(currentTrack.id) : null,
          track_position: currentTrack.position,
          track_title: currentTrack.title,
          rating: value,
          rated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,album_deezer_id,track_position" },
      );
      if (error) {
        setRating(prev);
        toast({ title: "Could not save rating", description: error.message, variant: "destructive" });
      }
    },
    [user, currentTrack, currentAlbumMbid, rating],
  );

  const handleSeek = useCallback(([val]: number[]) => seekTo(val), [seekTo]);

  const {
    enabled: voiceOn,
    voiceState,
    toggle: toggleVoice,
  } = useVoiceAssistant({
    onRatingDetected: (r) => {
      void saveRating(r);
    },
    onDuckVolume: (ducked) => {
      if (ducked) {
        if (preDuckVolumeRef.current === null) preDuckVolumeRef.current = volume;
        setVolume(Math.min(volume, 20));
      } else if (preDuckVolumeRef.current !== null) {
        setVolume(preDuckVolumeRef.current);
        preDuckVolumeRef.current = null;
      }
    },
    hasActiveTrack: !!currentTrack,
  });

  // Close vertical volume popover on outside click
  useEffect(() => {
    if (!isVolumeOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (volumeContainerRef.current && !volumeContainerRef.current.contains(e.target as Node)) {
        setIsVolumeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [isVolumeOpen]);

  // Close vertical rating popover on outside click
  useEffect(() => {
    if (!isRatingOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (ratingContainerRef.current && !ratingContainerRef.current.contains(e.target as Node)) {
        setIsRatingOpen(false);
        setHoverRating(null);
        setCursorY(null);
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [isRatingOpen]);

  const volumeIcon = useMemo(() => {
    if (volume === 0) return <VolumeX className="w-4 h-4" />;
    if (volume < 50) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  }, [volume]);

  if (!currentTrack) return null;

  // Build a minimal DeezerTrack for AddToPlaylistButton
  const trackForPlaylist = {
    id: Number(currentTrack.id) || 0,
    title: currentTrack.title,
    duration: currentTrack.length ? Math.round(currentTrack.length / 1000) : undefined,
  } as unknown as DeezerTrack;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-ink">
      <div className="px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        {/* LEFT: cover + meta + add */}
        <div className="flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-secondary border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
              {coverUrl && !coverError ? (
                <img
                  src={coverUrl}
                  alt={albumTitle ?? "Album cover"}
                  className="w-full h-full object-cover"
                  onError={() => setCoverError(true)}
                  loading="lazy"
                />
              ) : (
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display uppercase text-[12px] leading-[1.3] truncate">
                {cleanTrackTitle(currentTrack.title)}
              </p>
              {(artistName || albumTitle) && (
                <div className="flex items-center gap-1 text-[11px] leading-[1.3] uppercase text-muted-foreground mt-1 min-w-0 font-display">
                  {artistName && artistMbid ? (
                    <Link
                      to={`/artist/${artistMbid}`}
                      title={artistName}
                      className="truncate min-w-0 hover:text-foreground transition-colors"
                    >
                      {artistName}
                    </Link>
                  ) : artistName ? (
                    <span className="truncate min-w-0 flex-[1_1_0%]" title={artistName}>
                      {artistName}
                    </span>
                  ) : null}
                  {artistName && albumTitle ? <span className="flex-shrink-0">•</span> : null}
                  {albumTitle && currentAlbumMbid ? (
                    <Link
                      to={`/album/${currentAlbumMbid}?artistId=${artistMbid ?? ""}&artistName=${encodeURIComponent(artistName ?? "")}`}
                      title={albumTitle}
                      className="truncate min-w-0 flex-[1_1_0%] hover:text-foreground transition-colors"
                    >
                      {albumTitle}
                    </Link>
                  ) : albumTitle ? (
                    <span className="truncate min-w-0 flex-[1_1_0%]" title={albumTitle}>
                      {albumTitle}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <AddToPlaylistButton
              track={trackForPlaylist}
              artistName={artistName ?? undefined}
              albumTitle={albumTitle ?? undefined}
              albumDeezerId={currentAlbumMbid ?? undefined}
            />
            <span className="caption-tech leading-none">
              add song to
              <br />
              playlist
            </span>
          </div>
          <div className="lg:hidden">
            <AddToPlaylistButton
              track={trackForPlaylist}
              artistName={artistName ?? undefined}
              albumTitle={albumTitle ?? undefined}
              albumDeezerId={currentAlbumMbid ?? undefined}
            />
          </div>
        </div>

        {/* CENTER: controls + progress */}
        <div className="flex flex-col items-center gap-1.5 min-w-[300px] md:min-w-[420px]">
          <div className="flex items-center gap-6">
            <button
              onClick={toggleShuffle}
              aria-label="Shuffle"
              className={cn(
                "text-muted-foreground hover:text-foreground transition-colors",
                shuffle && "text-primary",
              )}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4">
              <button onClick={prevTrack} aria-label="Previous track" className="hover:opacity-70 transition-opacity">
                <SkipBack className="w-6 h-6" weight="fill" />
              </button>
              <button onClick={togglePlay} aria-label="Play/pause" className="hover:opacity-70 transition-opacity">
                {isPlaying ? (
                  <Pause className="w-7 h-7" weight="fill" />
                ) : (
                  <Play className="w-7 h-7" weight="fill" />
                )}
              </button>
              <button onClick={nextTrack} aria-label="Next track" className="hover:opacity-70 transition-opacity">
                <SkipForward className="w-6 h-6" weight="fill" />
              </button>
            </div>
            <button
              onClick={cycleRepeat}
              aria-label="Repeat"
              className={cn(
                "text-muted-foreground hover:text-foreground transition-colors",
                repeat !== "off" && "text-primary",
              )}
            >
              {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          <div className="w-full flex items-center gap-2.5">
            <span className="numeric text-[11px] text-muted-foreground w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.5}
              onValueChange={handleSeek}
              className="flex-1 cursor-pointer [&_[data-radix-slider-track]]:h-[2px] [&_[data-radix-slider-track]]:rounded-none [&_[data-radix-slider-track]]:bg-border [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-2.5 [&_[data-radix-slider-thumb]]:w-2.5 [&_[data-radix-slider-thumb]]:rounded-none [&_[data-radix-slider-thumb]]:opacity-0 [&:hover_[data-radix-slider-thumb]]:opacity-100 [&_[data-radix-slider-thumb]]:transition-opacity [&_[data-radix-slider-thumb]]:border-foreground"
            />
            <span className="numeric text-[11px] text-muted-foreground w-10">{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT: rating + voice + volume */}
        <div className="flex items-start justify-end gap-8 pr-2">
          {/* Rating — star icon toggles a vertical 1–10 scale */}
          <div ref={ratingContainerRef} className="relative flex flex-col items-center">
            <button
              onClick={() => setIsRatingOpen((v) => !v)}
              className={cn(
                "flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity",
                isRatingOpen && "text-primary",
              )}
              aria-label={isRatingOpen ? "Hide rating scale" : "Rate this track"}
              aria-expanded={isRatingOpen}
              title={user ? `Rate this track (${rating ?? "–"}/10)` : "Sign in to rate"}
            >
              <Star className="w-5 h-5" weight={rating ? "fill" : "regular"} />
              <span className="numeric text-[13px]">{rating ? String(rating).padStart(2, "0") : "–"}</span>
            </button>
            <span className="caption-tech mt-1.5 hidden md:inline">Rating</span>

            {isRatingOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-background border border-ink z-50 flex flex-col items-center gap-2 min-w-[44px]">
                <div
                  ref={ratingBarRef}
                  role="slider"
                  aria-label="Rate this track"
                  aria-valuemin={1}
                  aria-valuemax={10}
                  aria-valuenow={rating ?? 0}
                  aria-orientation="vertical"
                  tabIndex={0}
                  onClick={(e) => saveRating(computeRatingFromEvent(e.clientY))}
                  onMouseMove={(e) => {
                    setHoverRating(computeRatingFromEvent(e.clientY));
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCursorY(e.clientY - rect.top);
                  }}
                  onMouseLeave={() => {
                    setHoverRating(null);
                    setCursorY(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") saveRating(Math.min(10, (rating ?? 0) + 1));
                    else if (e.key === "ArrowDown") saveRating(Math.max(1, (rating ?? 1) - 1));
                  }}
                  className="relative h-28 w-1.5 bg-border cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground"
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-primary transition-all duration-150"
                    style={{
                      height: `${((hoverRating ?? rating ?? 0) / 10) * 100}%`,
                      opacity: hoverRating !== null ? 0.6 : 1,
                    }}
                  />
                  {hoverRating !== null && cursorY !== null && (
                    <span
                      className="numeric pointer-events-none absolute left-4 -translate-y-1/2 border border-ink bg-background px-1.5 py-0.5 text-xs"
                      style={{ top: cursorY }}
                    >
                      {hoverRating}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Voice control */}
          <button
            onClick={toggleVoice}
            className="relative flex flex-col items-center text-foreground hover:opacity-70 transition-opacity"
            aria-label="Toggle voice control"
          >
            <div className="flex items-center gap-1">
              {voiceOn ? (
                <Mic className={cn("w-5 h-5 text-primary", voiceState === "active" && "animate-pulse")} />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
              <span className="font-display uppercase text-[13px] leading-none">
                {voiceOn ? (voiceState === "active" ? "Listening…" : "On") : "Off"}
              </span>
            </div>
            <span className="caption-tech mt-1.5 whitespace-nowrap hidden md:inline">
              {voiceOn ? 'Say "wake up" then 1–10' : "Voice control"}
            </span>
          </button>

          {/* Volume */}
          <div ref={volumeContainerRef} className="relative flex flex-col items-center">
            <button
              onClick={() => setIsVolumeOpen((v) => !v)}
              className={cn(
                "text-foreground hover:opacity-70 transition-opacity flex-shrink-0",
                isVolumeOpen && "text-primary",
              )}
              aria-label={isVolumeOpen ? "Hide volume" : "Show volume"}
              aria-expanded={isVolumeOpen}
            >
              {volumeIcon}
            </button>
            <span className="caption-tech mt-1.5 hidden md:inline">Volume</span>

            {isVolumeOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-background border border-ink z-50 flex flex-col items-center gap-2 min-w-[44px]">
                <Slider
                  orientation="vertical"
                  value={[volume]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setVolume(v)}
                  className="h-28 w-5 [&_[data-radix-slider-track]]:w-1.5 [&_[data-radix-slider-track]]:rounded-none [&_[data-radix-slider-track]]:bg-border [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-2.5 [&_[data-radix-slider-thumb]]:w-2.5 [&_[data-radix-slider-thumb]]:rounded-none [&_[data-radix-slider-thumb]]:border-foreground"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

