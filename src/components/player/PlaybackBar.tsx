import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, Volume1,
  Shuffle, Repeat, Repeat1,
  Mic, MicOff, Image as ImageIcon, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { cn } from '@/lib/utils';
import { cleanTrackTitle } from '@/lib/cleanMetadata';
import { AddToPlaylistButton } from '@/components/music/AddToPlaylistButton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { DeezerTrack } from '@/lib/deezer';
import { findArtistMbid, coverArtArchiveReleaseGroupUrl } from '@/lib/musicbrainz';
import { emitTrackRating, onTrackRating } from '@/lib/ratingEvents';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function PlaybackBar() {
  const {
    isPlaying, currentTrack, currentAlbumMbid, artistName, albumTitle,
    togglePlay, nextTrack, prevTrack,
    volume, setVolume,
    currentTime, duration, seekTo,
    shuffle, toggleShuffle,
    repeat, cycleRepeat,
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
      .from('track_ratings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('album_deezer_id', currentAlbumMbid)
      .eq('track_position', currentTrack.position)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRating(data?.rating ?? null);
      });
    return () => { cancelled = true; };
  }, [user, currentTrack, currentAlbumMbid]);

  useEffect(() => {
    return onTrackRating(({ albumId, trackPosition, rating: r }) => {
      if (!currentTrack || !currentAlbumMbid) return;
      if (albumId === currentAlbumMbid && trackPosition === currentTrack.position) {
        setRating(prev => (prev === r ? prev : r));
      }
    });
  }, [currentTrack, currentAlbumMbid]);

  // Resolve the artist MBID from MusicBrainz so the playback bar can link
  // back to the artist and album pages.
  useEffect(() => {
    setArtistMbid(null);
    if (!artistName) return;
    let cancelled = false;
    findArtistMbid('', artistName).then((mbid) => {
      if (!cancelled) setArtistMbid(mbid);
    });
    return () => { cancelled = true; };
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

  const saveRating = useCallback(async (value: number) => {
    if (!user) {
      toast({ title: 'Sign in to rate tracks', variant: 'destructive' });
      return;
    }
    if (!currentTrack || !currentAlbumMbid) return;
    const prev = rating;
    setRating(value);
    emitTrackRating({ albumId: currentAlbumMbid, trackPosition: currentTrack.position, rating: value });
    const { error } = await supabase
      .from('track_ratings')
      .upsert({
        user_id: user.id,
        album_deezer_id: currentAlbumMbid,
        track_deezer_id: currentTrack.id ? String(currentTrack.id) : null,
        track_position: currentTrack.position,
        track_title: currentTrack.title,
        rating: value,
        rated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,album_deezer_id,track_position' });
    if (error) {
      setRating(prev);
      toast({ title: 'Could not save rating', description: error.message, variant: 'destructive' });
    }
  }, [user, currentTrack, currentAlbumMbid, rating]);

  const handleSeek = useCallback(([val]: number[]) => seekTo(val), [seekTo]);

  const { enabled: voiceOn, voiceState, toggle: toggleVoice } = useVoiceAssistant({
    onRatingDetected: (r) => { void saveRating(r); },
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
      if (
        volumeContainerRef.current &&
        !volumeContainerRef.current.contains(e.target as Node)
      ) {
        setIsVolumeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [isVolumeOpen]);

  // Close vertical rating popover on outside click
  useEffect(() => {
    if (!isRatingOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (
        ratingContainerRef.current &&
        !ratingContainerRef.current.contains(e.target as Node)
      ) {
        setIsRatingOpen(false);
        setHoverRating(null);
        setCursorY(null);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
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
    <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl bg-card/80 border-t border-border/40 shadow-[0_-4px_30px_-10px_hsl(var(--primary)/0.15)]">
      <div className="container mx-auto px-4 py-2.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        {/* LEFT: cover + meta + add */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-secondary border border-border/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {coverUrl && !coverError ? (
              <img
                src={coverUrl}
                alt={albumTitle ?? 'Album cover'}
                className="w-full h-full object-cover"
                onError={() => setCoverError(true)}
                loading="lazy"
              />
            ) : (
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">
              {cleanTrackTitle(currentTrack.title)}
            </p>
            {(artistName || albumTitle) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 min-w-0">
                {artistName && artistMbid ? (
                  <Link
                    to={`/artist/${artistMbid}`}
                    title={artistName}
                    className="truncate min-w-0 flex-[1_1_0%] hover:text-foreground hover:underline transition-colors"
                  >
                    {artistName}
                  </Link>
                ) : artistName ? (
                  <span className="truncate min-w-0 flex-[1_1_0%]" title={artistName}>
                    {artistName}
                  </span>
                ) : null}
                {artistName && albumTitle ? (
                  <span className="flex-shrink-0 opacity-60">•</span>
                ) : null}
                {albumTitle && currentAlbumMbid ? (
                  <Link
                    to={`/album/${currentAlbumMbid}?artistId=${artistMbid ?? ''}&artistName=${encodeURIComponent(artistName ?? '')}`}
                    title={albumTitle}
                    className="truncate min-w-0 flex-[1_1_0%] hover:text-foreground hover:underline transition-colors"
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
          <AddToPlaylistButton
            track={trackForPlaylist}
            artistName={artistName ?? undefined}
            albumTitle={albumTitle ?? undefined}
            albumDeezerId={currentAlbumMbid ?? undefined}
          />
        </div>

        {/* CENTER: controls + progress */}
        <div className="flex flex-col items-center gap-1 min-w-[320px] md:min-w-[420px]">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon"
              onClick={toggleShuffle}
              className={cn('rounded-full h-8 w-8 transition-colors', shuffle && 'text-primary')}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={prevTrack} className="rounded-full h-8 w-8">
              <SkipBack className="w-4 h-4 fill-current" />
            </Button>
            <Button
              variant="ghost" size="icon" onClick={togglePlay}
              className="rounded-full h-9 w-9 bg-foreground text-background hover:bg-foreground/90 hover:text-background"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={nextTrack} className="rounded-full h-8 w-8">
              <SkipForward className="w-4 h-4 fill-current" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={cycleRepeat}
              className={cn('rounded-full h-8 w-8 transition-colors', repeat !== 'off' && 'text-primary')}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </Button>
          </div>

          <div className="w-full flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.5}
              onValueChange={handleSeek}
              className="flex-1 cursor-pointer [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-foreground [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:opacity-0 [&:hover_[data-radix-slider-thumb]]:opacity-100 [&_[data-radix-slider-thumb]]:transition-opacity [&_[data-radix-slider-thumb]]:border-foreground"
            />
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* RIGHT: rating + voice + volume */}
        <div className="flex items-center justify-end gap-4">
          {/* Rating — star icon toggles a vertical 1–10 scale */}
          <div ref={ratingContainerRef} className="relative flex items-center justify-center">
            <button
              onClick={() => setIsRatingOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full',
                isRatingOpen && 'text-primary bg-primary/10'
              )}
              aria-label={isRatingOpen ? 'Hide rating scale' : 'Rate this track'}
              aria-expanded={isRatingOpen}
              title={user ? `Rate this track (${rating ?? '–'}/10)` : 'Sign in to rate'}
            >
              <Star className={cn('w-4 h-4', rating ? 'fill-primary text-primary' : '')} />
              <span className="text-sm font-semibold tabular-nums">{rating ?? '–'}</span>
            </button>

            {isRatingOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 rounded-2xl bg-card/95 border border-border/60 backdrop-blur-xl shadow-[0_-8px_30px_-10px_hsl(var(--primary)/0.2)] z-50 flex flex-col items-center gap-2 min-w-[44px]">
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
                  onMouseLeave={() => { setHoverRating(null); setCursorY(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') saveRating(Math.min(10, (rating ?? 0) + 1));
                    else if (e.key === 'ArrowDown') saveRating(Math.max(1, (rating ?? 1) - 1));
                  }}
                  className="relative h-28 w-1.5 rounded-full bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-foreground rounded-full transition-all duration-150"
                    style={{ height: `${((hoverRating ?? rating ?? 0) / 10) * 100}%`, opacity: hoverRating !== null ? 0.6 : 1 }}
                  />
                  {hoverRating !== null && cursorY !== null && (
                    <span
                      className="pointer-events-none absolute left-4 -translate-y-1/2 rounded-md border border-border/60 bg-background/95 px-1.5 py-0.5 text-xs font-semibold tabular-nums shadow-sm"
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
            className="relative flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle voice control"
          >
            <div className="flex items-center gap-1.5">
              {voiceOn ? <Mic className={cn("w-4 h-4", voiceState === 'active' ? 'text-primary animate-pulse' : 'text-primary')} /> : <MicOff className="w-4 h-4" />}
              <span className="text-xs font-medium">{voiceOn ? (voiceState === 'active' ? 'Listening…' : 'On') : 'Off'}</span>
            </div>
            <span className="absolute top-[calc(100%+2px)] left-1/2 -translate-x-1/2 text-[10px] leading-none whitespace-nowrap hidden md:inline">
              {voiceOn ? 'Say "wake up" then 1–10' : 'Voice control'}
            </span>
          </button>

          {/* Volume */}
          <div ref={volumeContainerRef} className="relative flex items-center justify-center">
            <button
              onClick={() => setIsVolumeOpen((v) => !v)}
              className={cn(
                "text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-2 rounded-full",
                isVolumeOpen && "text-primary bg-primary/10"
              )}
              aria-label={isVolumeOpen ? 'Hide volume' : 'Show volume'}
              aria-expanded={isVolumeOpen}
            >
              {volumeIcon}
            </button>

            {isVolumeOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 rounded-2xl bg-card/95 border border-border/60 backdrop-blur-xl shadow-[0_-8px_30px_-10px_hsl(var(--primary)/0.2)] z-50 flex flex-col items-center gap-2 min-w-[44px]">
                <Slider
                  orientation="vertical"
                  value={[volume]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setVolume(v)}
                  className="h-28 w-5 [&_[data-radix-slider-track]]:w-1.5 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-foreground [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:border-foreground"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
