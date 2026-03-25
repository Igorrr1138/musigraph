import { useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, Volume1,
  Shuffle, Repeat, Repeat1,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlaybackBar() {
  const {
    isPlaying, currentTrack, artistName,
    togglePlay, nextTrack, prevTrack,
    volume, setVolume,
    currentTime, duration, seekTo,
    shuffle, toggleShuffle,
    repeat, cycleRepeat,
  } = useYouTubePlayer();

  const handleSeek = useCallback(([val]: number[]) => {
    seekTo(val);
  }, [seekTo]);

  const volumeIcon = useMemo(() => {
    if (volume === 0) return <VolumeX className="w-4 h-4" />;
    if (volume < 50) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  }, [volume]);

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl bg-card/70 border-t border-border/40 shadow-[0_-4px_30px_-10px_hsl(var(--primary)/0.15)]">
      {/* Progress bar - full width thin bar at top */}
      <div className="px-4">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.5}
          onValueChange={handleSeek}
          className="w-full h-1 -mt-[2px] cursor-pointer [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-range]]:bg-gradient-to-r [&_[data-radix-slider-range]]:from-primary [&_[data-radix-slider-range]]:to-accent [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:opacity-0 [&:hover_[data-radix-slider-thumb]]:opacity-100 [&_[data-radix-slider-thumb]]:transition-opacity [&_[data-radix-slider-thumb]]:border-primary"
        />
      </div>

      <div className="container mx-auto px-4 py-2 flex items-center gap-3">
        {/* Track info - left */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{currentTrack.title}</p>
            {artistName && (
              <p className="text-xs text-muted-foreground truncate">{artistName}</p>
            )}
          </div>
        </div>

        {/* Center controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            onClick={toggleShuffle}
            className={cn(
              "rounded-full h-8 w-8 transition-colors",
              shuffle && "text-primary"
            )}
          >
            <Shuffle className="w-4 h-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={prevTrack} className="rounded-full h-8 w-8">
            <SkipBack className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost" size="icon" onClick={togglePlay}
            className="rounded-full h-10 w-10 bg-primary/10 hover:bg-primary/20 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-primary transition-transform duration-200" />
            ) : (
              <Play className="w-5 h-5 text-primary ml-0.5 transition-transform duration-200" />
            )}
          </Button>

          <Button variant="ghost" size="icon" onClick={nextTrack} className="rounded-full h-8 w-8">
            <SkipForward className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost" size="icon"
            onClick={cycleRepeat}
            className={cn(
              "rounded-full h-8 w-8 transition-colors",
              repeat !== 'off' && "text-primary"
            )}
          >
            {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </Button>
        </div>

        {/* Right side - time + volume */}
        <div className="flex-1 flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex items-center gap-1.5 w-28">
            <button
              onClick={() => setVolume(volume === 0 ? 80 : 0)}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              {volumeIcon}
            </button>
            <Slider
              value={[volume]}
              max={100}
              step={1}
              onValueChange={([v]) => setVolume(v)}
              className="w-full [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:border-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
