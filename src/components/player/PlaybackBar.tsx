import { Play, Pause, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { cn } from '@/lib/utils';

export function PlaybackBar() {
  const { isPlaying, currentTrack, artistName, togglePlay, nextTrack, volume, setVolume } = useYouTubePlayer();

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{currentTrack.title}</p>
          {artistName && (
            <p className="text-xs text-muted-foreground truncate">{artistName}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={togglePlay} className="rounded-full">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={nextTrack} className="rounded-full">
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-32">
          {volume === 0 ? (
            <VolumeX className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={([v]) => setVolume(v)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
